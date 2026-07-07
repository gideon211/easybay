import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor

from ..db.models import Download, init_db, get_db, SessionLocal
from ..core.models import Quality, DownloadStatus
from ..core.detector import detect_video_type, is_valid_url
from ..core.downloader import Downloader
from ..core.config import get_config


config = get_config()
executor = ThreadPoolExecutor(max_workers=config.max_concurrent_downloads)
progress_connections: dict[int, list[asyncio.Queue]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    config.ensure_dirs()
    yield


app = FastAPI(title="EasyBay API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DownloadRequest(BaseModel):
    url: str
    quality: str = "best"


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
    created_at: Optional[str]
    completed_at: Optional[str]


def run_download(download_id: int, url: str, quality: Quality):
    db = SessionLocal()
    try:
        download = db.query(Download).filter(Download.id == download_id).first()
        if not download:
            return

        download.status = "downloading"
        db.commit()

        def on_progress(info):
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

        downloader = Downloader(progress_callback=on_progress)
        result = downloader.download(url, quality)

        if result.success:
            download.status = "completed"
            download.progress = 1.0
            download.filename = result.filename
            download.completed_at = datetime.utcnow()
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
            download.status = "failed"
            download.error_message = str(e)
            db.commit()
    finally:
        db.close()


@app.post("/api/download", response_model=DownloadResponse)
def submit_download(request: DownloadRequest, db: Session = Depends(get_db)):
    if not is_valid_url(request.url):
        raise HTTPException(status_code=400, detail="Invalid URL format")

    try:
        quality = Quality(request.quality.lower())
    except ValueError:
        valid = ", ".join(q.value for q in Quality)
        raise HTTPException(status_code=400, detail=f"Invalid quality. Options: {valid}")

    video_type = detect_video_type(request.url)

    download = Download(
        url=request.url,
        video_type=video_type.value,
        quality=quality.value,
        status="pending",
    )
    db.add(download)
    db.commit()
    db.refresh(download)

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

    db.delete(download)
    db.commit()
    return {"message": "Download deleted"}


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
