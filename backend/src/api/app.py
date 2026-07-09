import asyncio
import hashlib
import logging
import re
import json
import threading
import urllib.request
import urllib.parse
import yt_dlp
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional
from pathlib import Path


logger = logging.getLogger(__name__)
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor

from ..db.models import Download, Torrent, init_db, get_db, SessionLocal
from ..core.models import DownloadStatus
from ..core.detector import detect_video_type, is_valid_url
from ..core.downloader import Downloader
from ..core.config import get_config
from ..core.quality import parse_quality
from ..watermark.remover import WatermarkRemover
from ..torrent.manager import get_manager as get_torrent_manager

config = get_config()
executor = ThreadPoolExecutor(max_workers=config.max_concurrent_downloads)
progress_connections: dict[int, list[asyncio.Queue]] = {}
torrent_progress_connections: dict[str, list[asyncio.Queue]] = {}
pause_events: dict[int, threading.Event] = {}
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    config.ensure_dirs()
    tm = get_torrent_manager()
    tm.start()
    yield
    tm.stop()


app = FastAPI(title="EasyBay API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
    filename: Optional[str]
    status: str
    progress: float
    speed: Optional[str]
    eta: Optional[str]
    error_message: Optional[str]
    remove_watermark: bool = False
    created_at: Optional[str]
    completed_at: Optional[str]


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
        label = f"1080p"
    elif has_video and height >= 720:
        label = f"720p"
    elif has_video and height >= 480:
        label = f"480p"
    elif has_video and height >= 360:
        label = f"360p"
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
        raise HTTPException(status_code=400, detail=str(e))


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

        def on_progress(info):
            if download_id in pause_events and pause_events[download_id].is_set():
                raise yt_dlp.utils.DownloadError("Paused by user")

            download.progress = info.progress
            download.speed = info.speed or download.speed
            download.eta = info.eta or download.eta
            download.filename = info.filename or download.filename
            db.commit()

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

    try:
        parse_quality(request.quality)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid quality: {request.quality}"
        ) from None

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
        headers={
            "Accept-Ranges": "bytes",
        },
    )


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
            with urllib.request.urlopen(oembed_url, timeout=5) as resp:
                data = json.loads(resp.read())
                if data.get("thumbnail_url"):
                    return {"thumbnail_url": data["thumbnail_url"]}
        except Exception:
            pass

    raise HTTPException(status_code=404, detail="No thumbnail available")


class TorrentAddRequest(BaseModel):
    source: str
    name: str = ""
    info_hash: str = ""


class TorrentResponse(BaseModel):
    id: int
    magnet: str
    name: Optional[str]
    info_hash: Optional[str]
    save_path: Optional[str]
    filename: Optional[str]
    status: str
    progress: float
    speed: Optional[str]
    eta: Optional[str]
    peers: int
    total_size: Optional[int]
    downloaded: Optional[int]
    error_message: Optional[str]
    created_at: Optional[str]
    completed_at: Optional[str]


@app.post("/api/torrents", response_model=TorrentResponse)
async def add_torrent(request: TorrentAddRequest, db: Session = Depends(get_db)):
    tm = get_torrent_manager()

    info_hash = request.info_hash
    if tm.is_magnet(request.source):
        try:
            from ..torrent.magnet import parse_magnet
            ih_bytes, name, _ = parse_magnet(request.source)
            info_hash = ih_bytes.hex()
            if not request.name:
                request.name = name
        except Exception:
            info_hash = hashlib.sha256(request.source.encode()).hexdigest()[:20] if not info_hash else info_hash
    elif not info_hash:
        info_hash = hashlib.sha256(request.source.encode()).hexdigest()[:20]

    torrent = Torrent(
        magnet=request.source,
        name=request.name or "unknown",
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
        source=request.source,
        info_hash=info_hash,
        name=request.name,
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


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}
