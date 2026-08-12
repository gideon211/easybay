import asyncio
import threading

import pytest
from fastapi.testclient import TestClient

from src.api.app import (
    app,
    config,
    progress_connections,
    progress_connections_lock,
    publish_download_progress,
)
from src.db.models import Base, Download, SessionLocal, init_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    db = SessionLocal()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
    finally:
        db.close()
    yield


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_submit_download_invalid_url():
    response = client.post("/api/download", json={"url": "not-a-url", "quality": "best"})
    assert response.status_code == 400


def test_submit_download_invalid_quality():
    # Raw format IDs are now accepted - passed through to yt-dlp
    response = client.post("/api/download", json={"url": "https://youtube.com/watch?v=123", "quality": "invalid"})
    assert response.status_code == 200


def test_list_downloads_empty():
    response = client.get("/api/downloads")
    assert response.status_code == 200
    assert response.json() == []


def test_get_download_not_found():
    response = client.get("/api/downloads/999")
    assert response.status_code == 404


def test_delete_download_not_found():
    response = client.delete("/api/downloads/999")
    assert response.status_code == 404


def test_saving_download_keeps_local_copy_for_future_playback(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "download_dir", tmp_path)
    media_path = tmp_path / "saved-video.mp4"
    media_path.write_bytes(b"test media payload")

    with SessionLocal() as db:
        download = Download(
            url="https://example.com/video",
            video_type="unknown",
            quality="best",
            filename=media_path.name,
            status="completed",
            progress=1.0,
            file_size=media_path.stat().st_size,
        )
        db.add(download)
        db.commit()
        db.refresh(download)
        download_id = download.id

    response = client.get(f"/api/downloads/{download_id}/stream")

    assert response.status_code == 200
    assert response.content == b"test media payload"
    assert media_path.exists()


def test_worker_thread_progress_wakes_websocket_event_loop():
    async def receive_worker_update():
        download_id = 987654
        loop = asyncio.get_running_loop()
        queue = asyncio.Queue(maxsize=1)
        connection = (loop, queue)
        with progress_connections_lock:
            progress_connections[download_id] = [connection]

        try:
            worker = threading.Thread(
                target=publish_download_progress,
                args=(download_id, {"status": "downloading", "progress": 0.42}),
            )
            worker.start()
            worker.join()
            return await asyncio.wait_for(queue.get(), timeout=1)
        finally:
            with progress_connections_lock:
                progress_connections.pop(download_id, None)

    payload = asyncio.run(receive_worker_update())

    assert payload == {"status": "downloading", "progress": 0.42}
