import asyncio
import hashlib
import io
import json
import logging
import re
import threading
import time
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

import yt_dlp
from fastapi import Depends, FastAPI, File, HTTPException, Response, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from fastbencode import bencode
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.config import get_config
from ..core.detector import detect_video_type, is_valid_url
from ..core.downloader import Downloader
from ..db.models import Download, SessionLocal, Torrent, Setting, get_db, init_db
from ..image_tools.background import BackgroundRemover
from ..image_tools.svg import SvgConverter
from ..image_tools.passport import PassportConverter, NoFaceDetectedError
from ..image_tools.passport_sizes import COUNTRY_SPECS
from PIL import Image
from ..torrent.manager import get_manager as get_torrent_manager
from ..watermark.remover import WatermarkRemover

logger = logging.getLogger(__name__)

config = get_config()
executor = ThreadPoolExecutor(max_workers=config.max_concurrent_downloads)
progress_connections: dict[int, list[asyncio.Queue]] = {}
torrent_progress_connections: dict[str, list[asyncio.Queue]] = {}
pause_events: dict[int, threading.Event] = {}
_cleanup_stop = threading.Event()

def _cleanup_old_files():
    while not _cleanup_stop.is_set():
        try:
            now = time.time()
            cutoff = now - 3600
            for f in config.download_dir.iterdir():
                if f.is_file() and f.stat().st_mtime < cutoff:
                    f.unlink(missing_ok=True)
        except Exception:
            pass
        _cleanup_stop.wait(1800)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    config.ensure_dirs()
    tm = get_torrent_manager()
    tm.start()
    cleanup_thread = threading.Thread(target=_cleanup_old_files, daemon=True)
    cleanup_thread.start()
    yield
    _cleanup_stop.set()
    cleanup_thread.join(timeout=5)
    tm.stop()


app = FastAPI(title="EasyBay API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FormatRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    quality: str = "best"
    remove_watermark: bool = False


class DownloadResponse(BaseModel):
    id: int
    url: str
    video_type: str
    quality: str
    filename: str | None
    status: str
    progress: float
    speed: str | None
    eta: str | None
    file_size: int | None
    error_message: str | None
    remove_watermark: bool = False
    created_at: str | None
    completed_at: str | None


def _format_label(fmt: dict) -> str:
    height = fmt.get("height") or 0
    ext = fmt.get("ext", "")
    filesize = fmt.get("filesize") or fmt.get("filesize_approx") or 0
    size_str = (
        f"{filesize / 1024 / 1024:.0f}MB" if filesize else "Unknown size"
    )

    vcodec = fmt.get("vcodec", "")
    acodec = fmt.get("acodec", "")

    has_video = vcodec and vcodec != "none"
    has_audio = acodec and acodec != "none"

    if has_video and height >= 2160:
        label = f"4K ({height}p)"
    elif has_video and height >= 1440:
        label = f"1440p ({height}p)"
    elif has_video and height >= 1080:
        label = "1080p"
    elif has_video and height >= 720:
        label = "720p"
    elif has_video and height >= 480:
        label = "480p"
    elif has_video and height >= 360:
        label = "360p"
    elif has_video:
        label = f"{height}p"
    elif has_audio and not has_video:
        abr = fmt.get("abr") or 0
        label = f"Audio {abr:.0f}kbps" if abr else "Audio only"
    else:
        label = ext.upper()

    return f"{label} · {size_str} · {ext.upper()}"


@app.post("/api/formats")
def list_formats(request: FormatRequest):
    import yt_dlp

    try:
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "socket_timeout": 10,
            "extractor_retries": 1,
            "ignoreerrors": True,
            "noplaylist": True,
        }
        cookies_file = get_config().download_dir.parent / "cookies.txt"
        if cookies_file.exists():
            ydl_opts["cookiefile"] = str(cookies_file)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            raw_formats = info.get("formats", []) if info else []

        seen = set()
        result = []
        for f in raw_formats:
            vcodec = f.get("vcodec", "")
            acodec = f.get("acodec", "")
            height = f.get("height") or 0
            ext = f.get("ext", "")

            if not vcodec and not acodec:
                continue
            if vcodec and vcodec != "none" and not height:
                continue

            f_id = f["format_id"]
            if f_id in seen:
                continue
            seen.add(f_id)

            filesize = f.get("filesize") or f.get("filesize_approx")

            result.append({
                "format_id": f_id,
                "height": height,
                "width": f.get("width") or 0,
                "ext": ext,
                "filesize": filesize,
                "vcodec": vcodec,
                "acodec": acodec,
                "fps": f.get("fps"),
                "vbr": f.get("vbr"),
                "abr": f.get("abr"),
                "label": _format_label(f),
            })

        result.sort(key=lambda x: -(x["height"] or 0))
        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


NETWORK_ERROR_PATTERNS = (
    "timeout", "timed out", "connection reset", "connection refused",
    "connection aborted", "name or service not known", "no address associated",
    "network is unreachable", "eof", "remote disconnected",
    "http error 429", "http error 502", "http error 503", "http error 504",
    "unable to download webpage", "request error",
)


def is_network_error(msg: str) -> bool:
    lower = msg.lower()
    return any(p in lower for p in NETWORK_ERROR_PATTERNS)


def run_download(download_id: int, url: str, quality: str):
    db = SessionLocal()
    try:
        download = db.query(Download).filter(Download.id == download_id).first()
        if not download:
            return

        download.status = "downloading"
        if download_id in pause_events:
            pause_events[download_id].clear()
        db.commit()

        last_persisted_at = 0.0
        last_persisted_progress = -1.0

        def on_progress(info):
            nonlocal last_persisted_at, last_persisted_progress
            if download_id in pause_events and pause_events[download_id].is_set():
                raise yt_dlp.utils.DownloadError("Paused by user")

            download.progress = info.progress
            download.speed = info.speed or download.speed
            download.eta = info.eta or download.eta
            download.filename = info.filename or download.filename

            # yt-dlp can report dozens of callbacks per second. Committing every callback made
            # SQLite and disk I/O compete with the media transfer, so large downloads slowed
            # down as they progressed. Persist at most twice per second while WebSocket clients
            # still receive the live in-memory values below.
            now = time.monotonic()
            progress_delta = abs(info.progress - last_persisted_progress)
            if now - last_persisted_at >= 0.5 or progress_delta >= 0.02:
                db.commit()
                last_persisted_at = now
                last_persisted_progress = info.progress

            if download_id in progress_connections:
                for queue in progress_connections[download_id]:
                    queue.put_nowait({
                        "progress": info.progress,
                        "speed": info.speed,
                        "eta": info.eta,
                        "status": info.status.value,
                        "filename": info.filename,
                    })

        pause_event = pause_events.get(download_id)
        downloader = Downloader(progress_callback=on_progress, cancel_event=pause_event)
        result = downloader.download(url, quality)

        if result.success:
            download.status = "completed"
            download.progress = 1.0
            download.filename = result.filename
            download.completed_at = datetime.utcnow()
            filepath = config.download_dir / result.filename
            if filepath.exists():
                download.file_size = filepath.stat().st_size

            if download.remove_watermark and WatermarkRemover.has_watermark(download.video_type):
                filepath = config.download_dir / result.filename
                if filepath.exists():
                    remover = WatermarkRemover()
                    remover.remove(filepath, download.video_type)
        elif (pause_event and pause_event.is_set()) or (result.error and "paused by user" in result.error.lower()):
            download.status = "paused"
            download.error_message = None
        else:
            download.status = "failed"
            download.error_message = result.error

        db.commit()

        if download_id in progress_connections:
            for queue in progress_connections[download_id]:
                queue.put_nowait({
                    "progress": download.progress,
                    "speed": download.speed,
                    "eta": download.eta,
                    "status": download.status,
                    "filename": download.filename,
                    "error": download.error_message,
                })

    except Exception as e:
        download = db.query(Download).filter(Download.id == download_id).first()
        if download:
            error_str = str(e)
            if "paused by user" in error_str.lower():
                download.status = "paused"
                download.error_message = None
            elif is_network_error(error_str):
                download.status = "paused"
                download.error_message = error_str
            else:
                download.status = "failed"
                download.error_message = error_str
            db.commit()
    finally:
        db.close()


@app.post("/api/download", response_model=DownloadResponse)
def submit_download(request: DownloadRequest, db: Session = Depends(get_db)):
    if not is_valid_url(request.url):
        raise HTTPException(status_code=400, detail="Invalid URL format")

    video_type = detect_video_type(request.url)
    quality = request.quality

    download = Download(
        url=request.url,
        video_type=video_type.value,
        quality=quality,
        status="pending",
        remove_watermark=request.remove_watermark,
    )
    db.add(download)
    db.commit()
    db.refresh(download)

    pause_events[download.id] = threading.Event()
    executor.submit(run_download, download.id, request.url, quality)

    return DownloadResponse(**download.to_dict())


@app.get("/api/downloads", response_model=list[DownloadResponse])
def list_downloads(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    downloads = db.query(Download).order_by(Download.created_at.desc()).offset(skip).limit(limit).all()
    return [DownloadResponse(**d.to_dict()) for d in downloads]


@app.get("/api/downloads/{download_id}", response_model=DownloadResponse)
def get_download(download_id: int, db: Session = Depends(get_db)):
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    return DownloadResponse(**download.to_dict())


@app.delete("/api/downloads/{download_id}")
def delete_download(download_id: int, db: Session = Depends(get_db)):
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")

    if download.filename:
        filepath = config.download_dir / download.filename
        if filepath.exists():
            filepath.unlink()

    pause_events.pop(download_id, None)
    db.delete(download)
    db.commit()
    return {"message": "Download deleted"}


@app.post("/api/downloads/{download_id}/pause")
def pause_download(download_id: int, db: Session = Depends(get_db)):
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")

    event = pause_events.get(download_id)
    if event:
        event.set()

    download.status = "paused"
    db.commit()

    if download_id in progress_connections:
        for queue in progress_connections[download_id]:
            queue.put_nowait({
                "progress": download.progress,
                "status": "paused",
            })

    return {"message": "Download paused"}


@app.post("/api/downloads/clear-failed")
def clear_failed_downloads(db: Session = Depends(get_db)):
    failed = db.query(Download).filter(Download.status == "failed").all()
    count = len(failed)
    for d in failed:
        if d.filename:
            filepath = config.download_dir / d.filename
            if filepath.exists():
                filepath.unlink()
        pause_events.pop(d.id, None)
        db.delete(d)
    db.commit()
    return {"message": f"Cleared {count} failed downloads"}


@app.post("/api/downloads/{download_id}/retry")
def retry_download(download_id: int, db: Session = Depends(get_db)):
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")

    download.status = "pending"
    download.error_message = None
    download.progress = 0.0
    download.speed = None
    download.eta = None
    download.filename = None
    download.file_size = None
    download.completed_at = None
    db.commit()

    pause_events[download.id] = threading.Event()
    executor.submit(run_download, download.id, download.url, download.quality)

    return DownloadResponse(**download.to_dict())


@app.post("/api/downloads/{download_id}/resume")
def resume_download(download_id: int, db: Session = Depends(get_db)):
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")

    event = pause_events.get(download_id)
    if event:
        event.clear()

    download.status = "pending"
    download.error_message = None
    db.commit()

    executor.submit(run_download, download.id, download.url, download.quality)

    if download_id in progress_connections:
        for queue in progress_connections[download_id]:
            queue.put_nowait({
                "progress": download.progress,
                "status": "pending",
            })

    return {"message": "Download resumed"}


@app.get("/api/downloads/{download_id}/file")
def get_download_file(download_id: int, db: Session = Depends(get_db)):
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    if not download.filename:
        raise HTTPException(status_code=404, detail="File not available")

    filepath = config.download_dir / download.filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    ext = Path(download.filename).suffix.lower()
    media_types = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
        ".ogg": "audio/ogg",
    }

    return FileResponse(
        path=str(filepath),
        filename=download.filename,
        media_type=media_types.get(ext, "application/octet-stream"),
        content_disposition_type="inline",
        headers={
            "Accept-Ranges": "bytes",
        },
    )


@app.get("/api/downloads/{download_id}/stream")
def stream_download_file(download_id: int, db: Session = Depends(get_db)):
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    if not download.filename:
        raise HTTPException(status_code=404, detail="File not available")

    filepath = config.download_dir / download.filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File expired — re-download from source")

    ext = Path(download.filename).suffix.lower()
    media_types = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
        ".ogg": "audio/ogg",
    }

    def cleanup():
        try:
            if filepath.exists():
                filepath.unlink()
            with SessionLocal() as clean_db:
                d = clean_db.query(Download).filter(Download.id == download_id).first()
                if d:
                    d.file_size = None
                    clean_db.commit()
        except Exception:
            pass

    file_size = filepath.stat().st_size
    return FileResponse(
        path=str(filepath),
        filename=download.filename,
        media_type=media_types.get(ext, "application/octet-stream"),
        content_disposition_type="attachment",
        headers={
            "Content-Length": str(file_size),
            "Content-Disposition": f'attachment; filename="{download.filename}"',
        },
        background=BackgroundTask(cleanup),
    )


@app.post("/api/downloads/{download_id}/re-download")
def redownload(download_id: int, db: Session = Depends(get_db)):
    existing = db.query(Download).filter(Download.id == download_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Download not found")

    new_dl = Download(
        url=existing.url,
        video_type=existing.video_type,
        quality=existing.quality,
        status="pending",
        remove_watermark=existing.remove_watermark,
    )
    db.add(new_dl)
    db.commit()
    db.refresh(new_dl)

    pause_events[new_dl.id] = threading.Event()
    executor.submit(run_download, new_dl.id, new_dl.url, new_dl.quality)

    return DownloadResponse(**new_dl.to_dict())


@app.get("/api/downloads/{download_id}/thumbnail")
def get_download_thumbnail(download_id: int, db: Session = Depends(get_db)):
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")

    if download.video_type == "youtube":
        match = re.search(
            r"[?&]v=([a-zA-Z0-9_-]{11})",
            download.url,
        )
        if match:
            return {"thumbnail_url": f"https://img.youtube.com/vi/{match.group(1)}/mqdefault.jpg"}

    if download.video_type == "instagram":
        try:
            oembed_url = (
                f"https://api.instagram.com/oembed?url={urllib.parse.quote(download.url)}&format=json"
            )
            with urllib.request.urlopen(oembed_url, timeout=5) as resp:  # nosec
                data = json.loads(resp.read())
                if data.get("thumbnail_url"):
                    return {"thumbnail_url": data["thumbnail_url"]}
        except Exception:
            return None

    raise HTTPException(status_code=404, detail="No thumbnail available")


class TorrentAddRequest(BaseModel):
    source: str
    name: str = ""
    info_hash: str = ""


class TorrentResponse(BaseModel):
    id: int
    magnet: str
    name: str | None
    info_hash: str | None
    save_path: str | None
    filename: str | None
    status: str
    progress: float
    speed: str | None
    eta: str | None
    peers: int
    total_size: int | None
    downloaded: int | None
    error_message: str | None
    created_at: str | None
    completed_at: str | None


@app.post("/api/torrents", response_model=TorrentResponse)
async def add_torrent(
    source: str = "",
    name: str = "",
    info_hash: str = "",
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    tm = get_torrent_manager()
    torrent_file_path: Path | None = None

    # Handle .torrent file upload
    if file and file.filename and file.filename.lower().endswith(".torrent"):
        content = await file.read()
        torrent_file_path = config.torrent_dir / file.filename
        torrent_file_path.parent.mkdir(parents=True, exist_ok=True)
        torrent_file_path.write_bytes(content)

        # Parse info hash from the .torrent file
        try:
            from fastbencode import bdecode
            decoded = bdecode(content)
            info_dict = decoded.get(b"info", {})
            import hashlib as hl
            info_hash = hl.sha1(bencode(info_dict)).hexdigest()
        except Exception:
            # Fallback: hash the filename
            info_hash = hashlib.sha256(file.filename.encode()).hexdigest()[:40]

        if not source:
            source = file.filename
        if not name:
            name = file.filename.rsplit(".", 1)[0]

    elif source and not tm.is_magnet(source) and Path(source).is_file():
        # Source is a local .torrent file path
        torrent_file_path = Path(source)
        try:
            import hashlib as hl

            from fastbencode import bdecode
            content = torrent_file_path.read_bytes()
            decoded = bdecode(content)
            info_dict = decoded.get(b"info", {})
            info_hash = hl.sha1(bencode(info_dict)).hexdigest()
        except Exception:
            info_hash = hashlib.sha256(source.encode()).hexdigest()[:40]
        if not name:
            name = torrent_file_path.stem

    elif tm.is_magnet(source):
        try:
            from ..torrent.magnet import parse_magnet
            ih_bytes, magnet_name, _ = parse_magnet(source)
            info_hash = ih_bytes.hex()
            if not name:
                name = magnet_name
        except Exception:
            info_hash = info_hash if info_hash else hashlib.sha256(source.encode()).hexdigest()[:20]
    elif not info_hash:
        info_hash = hashlib.sha256(source.encode()).hexdigest()[:20]

    torrent = Torrent(
        magnet=source,
        name=name or "unknown",
        info_hash=info_hash,
        status="queued",
        progress=0.0,
    )
    db.add(torrent)
    db.commit()
    db.refresh(torrent)

    async def on_progress(state: dict):
        db_refresh = SessionLocal()
        try:
            t = db_refresh.query(Torrent).filter(Torrent.id == torrent.id).first()
            if t:
                t.status = state.get("status", t.status)
                t.progress = state.get("progress", t.progress)
                t.speed = state.get("speed", t.speed)
                t.eta = state.get("eta", t.eta)
                t.peers = state.get("peers", t.peers)
                t.total_size = state.get("total_size", t.total_size)
                t.downloaded = state.get("downloaded", t.downloaded)
                if state.get("status") == "completed":
                    t.completed_at = datetime.utcnow()
                if state.get("error_message"):
                    t.error_message = state["error_message"]
                db_refresh.commit()

            if torrent_id_str in torrent_progress_connections:
                for queue in torrent_progress_connections[torrent_id_str]:
                    queue.put_nowait(state)
        except Exception as e:
            logger.error(f"Torrent progress DB error: {e}")
        finally:
            db_refresh.close()

    torrent_id_str = str(torrent.id)
    await tm.start_download(
        source=source,
        info_hash=info_hash,
        name=name,
        torrent_path=torrent_file_path,
        notify=on_progress,
    )

    return TorrentResponse(**torrent.to_dict())


@app.get("/api/torrents", response_model=list[TorrentResponse])
def list_torrents(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    torrents = db.query(Torrent).order_by(Torrent.created_at.desc()).offset(skip).limit(limit).all()
    return [TorrentResponse(**t.to_dict()) for t in torrents]


@app.get("/api/torrents/{torrent_id}", response_model=TorrentResponse)
def get_torrent(torrent_id: int, db: Session = Depends(get_db)):
    torrent = db.query(Torrent).filter(Torrent.id == torrent_id).first()
    if not torrent:
        raise HTTPException(status_code=404, detail="Torrent not found")
    return TorrentResponse(**torrent.to_dict())


@app.delete("/api/torrents/{torrent_id}")
def delete_torrent(torrent_id: int, db: Session = Depends(get_db)):
    torrent = db.query(Torrent).filter(Torrent.id == torrent_id).first()
    if not torrent:
        raise HTTPException(status_code=404, detail="Torrent not found")

    if torrent.info_hash:
        tm = get_torrent_manager()
        tm.remove(torrent.info_hash)

    db.delete(torrent)
    db.commit()
    return {"message": "Torrent deleted"}


@app.get("/api/torrents/{torrent_id}/file")
def get_torrent_file(torrent_id: int, db: Session = Depends(get_db)):
    torrent = db.query(Torrent).filter(Torrent.id == torrent_id).first()
    if not torrent:
        raise HTTPException(status_code=404, detail="Torrent not found")
    if not torrent.status == "completed" or not torrent.save_path:
        raise HTTPException(status_code=400, detail="File not available yet")

    path = Path(torrent.save_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    if path.is_dir():
        files = list(path.rglob("*"))
        files = [f for f in files if f.is_file()]
        if not files:
            raise HTTPException(status_code=404, detail="No files found")
        path = files[0]

    ext = path.suffix.lower()
    media_types = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
        ".ogg": "audio/ogg",
    }

    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type=media_types.get(ext, "application/octet-stream"),
        content_disposition_type="inline",
        headers={"Accept-Ranges": "bytes"},
    )


@app.websocket("/ws/torrent/{torrent_id}")
async def websocket_torrent_progress(websocket: WebSocket, torrent_id: int):
    await websocket.accept()

    queue: asyncio.Queue = asyncio.Queue()
    key = str(torrent_id)
    if key not in torrent_progress_connections:
        torrent_progress_connections[key] = []
    torrent_progress_connections[key].append(queue)

    try:
        while True:
            try:
                data = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_json(data)
                if data.get("status") in ("completed", "error", "cancelled"):
                    break
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        if key in torrent_progress_connections:
            torrent_progress_connections[key].remove(queue)
            if not torrent_progress_connections[key]:
                del torrent_progress_connections[key]


@app.websocket("/ws/{download_id}")
async def websocket_progress(websocket: WebSocket, download_id: int):
    await websocket.accept()

    queue: asyncio.Queue = asyncio.Queue()
    if download_id not in progress_connections:
        progress_connections[download_id] = []
    progress_connections[download_id].append(queue)

    try:
        while True:
            try:
                data = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_json(data)
                if data.get("status") in ("completed", "failed"):
                    break
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        if download_id in progress_connections:
            progress_connections[download_id].remove(queue)
            if not progress_connections[download_id]:
                del progress_connections[download_id]


ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"}


def _save_upload(file: UploadFile) -> Path:
    ext = Path(file.filename or "upload.png").suffix or ".png"
    stem = uuid.uuid4().hex
    dest = config.uploads_dir / f"{stem}{ext}"
    content = file.file.read()
    dest.write_bytes(content)
    return dest


# ── Background Removal (async with WebSocket progress) ──

bg_tasks: dict[str, dict] = {}
bg_results: dict[str, bytes] = {}
background_remover = BackgroundRemover()


def _run_remove_bg(task_id: str, input_bytes: bytes, output_format: str):
    try:
        def on_progress(phase: str, progress: int, label: str):
            bg_tasks[task_id] = {
                "phase": phase, "progress": progress,
                "label": label, "status": "processing",
            }

        result = background_remover.remove(input_bytes, output_format=output_format, progress_callback=on_progress)
        bg_results[task_id] = result
        bg_tasks[task_id] = {"phase": "done", "progress": 100, "label": "Complete", "status": "complete"}
    except Exception as e:
        logger.exception("Background removal failed for task %s", task_id)
        bg_tasks[task_id] = {"phase": "error", "progress": 0, "label": str(e), "status": "error", "error": str(e)}


@app.post("/api/remove-bg/start")
async def start_remove_bg(file: UploadFile = File(...), output_format: str = "PNG"):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {file.content_type}")

    input_bytes = await file.read()
    task_id = uuid.uuid4().hex
    bg_tasks[task_id] = {"phase": "queued", "progress": 0, "label": "Starting...", "status": "processing"}

    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _run_remove_bg, task_id, input_bytes, output_format)

    return {"task_id": task_id}


@app.websocket("/ws/remove-bg/{task_id}")
async def websocket_remove_bg(websocket: WebSocket, task_id: str):
    await websocket.accept()
    last_progress = -1
    ticks = 0

    try:
        while True:
            ticks += 1

            if task_id in bg_tasks:
                t = bg_tasks[task_id]

                if t["status"] == "complete":
                    await websocket.send_json({"type": "complete", "progress": 100, "phase": "done", "label": "Complete"})
                    await websocket.close(code=1000)
                    return

                if t["status"] == "error":
                    await websocket.send_json({"type": "error", "error": t.get("error", "Processing failed")})
                    await websocket.close(code=1000)
                    return

                # Send progress only when it changes
                if t["progress"] != last_progress:
                    last_progress = t["progress"]
                    try:
                        await websocket.send_json({
                            "type": "progress", "phase": t["phase"],
                            "progress": t["progress"], "label": t["label"],
                        })
                    except WebSocketDisconnect:
                        return

            # Heartbeat every ~20 ticks (10s)
            if ticks % 20 == 0:
                try:
                    await websocket.send_json({"type": "ping"})
                except WebSocketDisconnect:
                    return

            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        logger.warning("WebSocket disconnected for task %s", task_id)
    except Exception:
        logger.exception("Unexpected error in WS handler for task %s", task_id)


@app.get("/api/remove-bg/result/{task_id}")
def get_remove_bg_result(task_id: str, format: str = "png"):
    result = bg_results.get(task_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Result not found")

    fmt = format.lower()
    if fmt == "webp":
        img = Image.open(io.BytesIO(result))
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=95)
        return Response(content=buf.getvalue(), media_type="image/webp", headers={
            "Content-Disposition": 'attachment; filename="nobg.webp"',
        })
    elif fmt == "svg":
        svg_str = SvgConverter().convert(result, img_format="png")
        return Response(content=svg_str, media_type="image/svg+xml", headers={
            "Content-Disposition": 'attachment; filename="nobg.svg"',
        })

    return Response(content=result, media_type="image/png", headers={
        "Content-Disposition": 'attachment; filename="nobg.png"',
    })


@app.post("/api/remove-bg/download/{download_id}")
def remove_bg_from_download(download_id: int, db: Session = Depends(get_db)):
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    if not download.filename:
        raise HTTPException(status_code=400, detail="Download has no file")

    input_path = config.download_dir / download.filename
    if not input_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    try:
        output = background_remover.remove(input_path.read_bytes())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Background removal failed: {e}") from e

    filename = f"{Path(download.filename).stem}_nobg.png"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=output, media_type="image/png", headers=headers)


@app.post("/api/to-svg")
async def convert_to_svg(
    file: UploadFile = File(...),
    mode: str = "fidelity",
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {file.content_type}")
    input_bytes = await file.read()
    ext = Path(file.filename or "image.png").suffix.lstrip(".").lower() or "png"
    try:
        converter = SvgConverter()
        svg = converter.convert(input_bytes, img_format=ext, mode=mode)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SVG conversion failed: {e}") from e

    stem = Path(file.filename or "image").stem
    headers = {"Content-Disposition": f'attachment; filename="{stem}.svg"'}
    return Response(content=svg, media_type="image/svg+xml", headers=headers)


@app.post("/api/to-svg/download/{download_id}")
def convert_download_to_svg(
    download_id: int,
    mode: str = "fidelity",
    db: Session = Depends(get_db),
):
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    if not download.filename:
        raise HTTPException(status_code=400, detail="Download has no file")

    input_path = config.download_dir / download.filename
    if not input_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    ext = input_path.suffix.lstrip(".").lower() or "png"
    try:
        converter = SvgConverter()
        svg = converter.convert(input_path.read_bytes(), img_format=ext, mode=mode)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SVG conversion failed: {e}") from e

    stem = Path(download.filename).stem
    headers = {"Content-Disposition": f'attachment; filename="{stem}.svg"'}
    return Response(content=svg, media_type="image/svg+xml", headers=headers)


@app.get("/api/settings")
def get_settings():
    return get_config().to_dict()


class SettingsUpdate(BaseModel):
    key: str
    value: str


@app.put("/api/settings")
def update_settings(updates: list[SettingsUpdate]):
    cfg = get_config()
    for u in updates:
        cfg.update(u.key, u.value)
    return cfg.to_dict()


@app.get("/api/passport/sizes")
def list_passport_sizes():
    return [
        {
            "country": s.country,
            "code": s.code,
            "region": s.region,
            "width_mm": s.width_mm,
            "height_mm": s.height_mm,
            "width_px": s.width_px,
            "height_px": s.height_px,
            "dpi": s.dpi,
            "bg_color": s.bg_color,
            "bg_color_name": s.bg_color_name,
            "emoji": s.emoji,
            "notes": s.notes,
        }
        for s in COUNTRY_SPECS
    ]


@app.post("/api/passport/convert")
async def convert_passport(
    file: UploadFile = File(...),
    country_code: str = "US",
    bg_color: str = "#ffffff",
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {file.content_type}")

    input_bytes = await file.read()
    converter = PassportConverter()

    try:
        result_bytes = await asyncio.get_running_loop().run_in_executor(
            None,
            converter.convert,
            input_bytes,
            country_code,
            bg_color,
            None,
        )
    except NoFaceDetectedError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Passport conversion failed")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {e}")

    return Response(content=result_bytes, media_type="image/png", headers={
        "Content-Disposition": 'attachment; filename="passport.png"',
    })


@app.post("/api/passport/batch")
async def convert_passport_batch(
    files: list[UploadFile] = File(...),
    country_code: str = "US",
    bg_color: str = "#ffffff",
):
    import io
    import zipfile

    for f in files:
        if f.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail=f"Unsupported image type: {f.content_type}")

    converter = PassportConverter()
    loop = asyncio.get_running_loop()
    zip_buf = io.BytesIO()

    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in files:
            input_bytes = await file.read()
            stem = Path(file.filename or "photo").stem
            try:
                result_bytes = await loop.run_in_executor(
                    None,
                    converter.convert,
                    input_bytes,
                    country_code,
                    bg_color,
                    None,
                )
                zf.writestr(f"{stem}_passport.png", result_bytes)
            except NoFaceDetectedError:
                zf.writestr(f"{stem}_ERROR.txt", f"No face detected in {file.filename}")
            except Exception as e:
                zf.writestr(f"{stem}_ERROR.txt", f"Conversion failed: {e}")

    zip_buf.seek(0)
    return Response(content=zip_buf.getvalue(), media_type="application/zip", headers={
        "Content-Disposition": 'attachment; filename="passport_photos.zip"',
    })


ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"}


@app.get("/api/files")
def list_files():
    d = config.download_dir
    if not d.exists():
        return []
    entries: list[dict] = []
    for p in sorted(d.iterdir(), key=lambda x: x.name.lower()):
        if p.name.startswith("."):
            continue
        is_dir = p.is_dir()
        if is_dir:
            continue
        stat = p.stat()
        entries.append({
            "name": p.name,
            "path": str(p),
            "size": stat.st_size,
            "is_dir": is_dir,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "extension": p.suffix.lower(),
        })
    return entries


@app.get("/api/files/preview/{filename:path}")
def file_preview(filename: str):
    filepath = config.download_dir / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    ext = filepath.suffix.lower()
    if ext in ALLOWED_IMAGE_EXTS:
        return FileResponse(path=str(filepath), media_type=f"image/{ext[1:]}")
    raise HTTPException(status_code=400, detail="No preview available")


@app.get("/api/files/download/{filename:path}")
def file_download(filename: str):
    filepath = config.download_dir / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=str(filepath),
        filename=filepath.name,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filepath.name}"'},
    )


@app.delete("/api/files/{filename:path}")
def delete_file(filename: str):
    filepath = config.download_dir / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    filepath.unlink()
    return {"message": "File deleted"}


@app.post("/api/cookies")
def upload_cookies(file: UploadFile = File(...)):
    dest = config.download_dir.parent / "cookies.txt"
    content = file.file.read()
    dest.write_bytes(content)
    return {"message": "Cookies uploaded", "size": len(content)}


@app.get("/api/cookies")
def get_cookies_status():
    dest = config.download_dir.parent / "cookies.txt"
    return {"exists": dest.exists(), "size": dest.stat().st_size if dest.exists() else 0}


@app.delete("/api/cookies")
def delete_cookies():
    dest = config.download_dir.parent / "cookies.txt"
    if dest.exists():
        dest.unlink()
    return {"message": "Cookies deleted"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/system-stats")
def get_system_stats():
    import psutil
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpu_percent": cpu,
        "ram_percent": mem.percent,
        "ram_used_gb": round(mem.used / (1024**3), 1),
        "ram_total_gb": round(mem.total / (1024**3), 1),
        "disk_percent": disk.percent,
        "disk_used_gb": round(disk.used / (1024**3), 1),
        "disk_total_gb": round(disk.total / (1024**3), 1),
    }
