import pytest
from fastapi.testclient import TestClient
from src.api.app import app
from src.db.models import init_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    yield


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_submit_download_invalid_url():
    response = client.post("/api/download", json={"url": "not-a-url", "quality": "best"})
    assert response.status_code == 400


def test_submit_download_invalid_quality():
    response = client.post("/api/download", json={"url": "https://youtube.com/watch?v=123", "quality": "invalid"})
    assert response.status_code == 400


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
