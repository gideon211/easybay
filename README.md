# EasyBay

> **Social media downloads, torrent support, and watermark removal — all in one place.**

EasyBay is a self-hosted media downloader with a modern web UI. Download videos from YouTube, TikTok, Instagram, and Twitter/X, fetch torrents via magnet links, and remove watermarks — all with real-time progress, pause/resume, and a clean gallery interface.

![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Multi-platform downloads** — YouTube, TikTok, Instagram, Twitter/X
- **Torrent support** — Magnet URIs, DHT peer discovery, HTTP trackers
- **Watermark removal** — FFmpeg-based `delogo` filter for TikTok/Instagram
- **Real-time progress** — WebSocket-powered live speed, ETA, and progress bar
- **Pause/Resume** — Pause downloads anytime, resume later (like uTorrent)
- **Smart quality selection** — Dynamic format dropdown with resolution badges and file sizes
- **Media preview** — In-app video/audio player with backdrop blur
- **Gallery grid** — Responsive card layout with thumbnails, platform icons, and status indicators
- **Dark/light-aware design** — Neutral OKLCH palette with electric blue accent
- **FastAPI backend** — SQLite + SQLAlchemy, ThreadPoolExecutor for concurrent downloads
- **Single-command deploy** — Works with `uvicorn` or Docker

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 20+
- FFmpeg (for watermark removal and video merging)
- Git

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -e ".[dev]"
uvicorn src.api.app:app --reload --port 8000
```

The API is now running at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The web UI is now running at `http://localhost:5173` (proxies `/api` to the backend).

---

## Usage

### Web UI

Open `http://localhost:5173` in your browser:

1. **Downloads tab** — Paste a URL, select quality, optionally enable watermark removal
2. **Torrents tab** — Paste a magnet URI or upload a `.torrent` file
3. **Gallery** — Browse completed and in-progress downloads with thumbnails and status
4. **Preview** — Click any completed download to play it in-browser

### CLI

```bash
# Download a video
easybay download "https://youtube.com/watch?v=..." --quality 1080p

# List available formats
easybay formats "https://youtube.com/watch?v=..."

# Get video info
easybay info "https://youtube.com/watch?v=..."
```

### API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/download` | Submit a new download |
| `GET` | `/api/downloads` | List all downloads |
| `GET` | `/api/downloads/{id}` | Get download details |
| `DELETE` | `/api/downloads/{id}` | Delete a download |
| `POST` | `/api/downloads/{id}/pause` | Pause a download |
| `POST` | `/api/downloads/{id}/resume` | Resume a download |
| `GET` | `/api/downloads/{id}/file` | Stream the downloaded file |
| `GET` | `/api/downloads/{id}/thumbnail` | Get video thumbnail |
| `POST` | `/api/formats` | List available formats for a URL |
| `POST` | `/api/torrents` | Add a torrent (magnet or file) |
| `GET` | `/api/torrents` | List all torrents |
| `DELETE` | `/api/torrents/{id}` | Delete a torrent |
| `WS` | `/ws/{download_id}` | Real-time download progress |
| `WS` | `/ws/torrent/{id}` | Real-time torrent progress |
| `GET` | `/api/health` | Health check |

---

## Architecture

```
easybay/
├── backend/
│   ├── src/
│   │   ├── api/          # FastAPI server, REST endpoints, WebSocket
│   │   ├── cli/          # Typer CLI interface
│   │   ├── core/         # Downloader engine, quality resolution, config
│   │   ├── db/           # SQLAlchemy models, session management
│   │   ├── torrent/      # Magnet parsing, DHT, tracker, manager
│   │   └── watermark/    # FFmpeg-based watermark removal
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/   # React components (gallery, player, forms)
│       ├── hooks/        # Custom React hooks
│       ├── lib/          # Utilities, API client, WebSocket
│       └── styles/       # Tailwind CSS setup
├── Makefile
└── README.md
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, SQLAlchemy, SQLite, yt-dlp |
| Frontend | React 19, Vite, Tailwind CSS 4, lucide-react |
| Torrent | aiotorrent, custom DHT/tracker components |
| Media | FFmpeg, yt-dlp |
| Real-time | WebSockets, asyncio |

---

## Development

```bash
# Install everything
make install

# Run backend tests
make test

# Lint and type-check
make lint

# Run backend dev server
cd backend && uvicorn src.api.app:app --reload --port 8000

# Run frontend dev server
cd frontend && npm run dev
```

### Configuration

Configuration lives in `backend/src/core/config.py`. Key defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| `download_dir` | `~/Downloads/EasyBay/` | Where downloaded files are stored |
| `max_retries` | `1` | Download retry count on failure |
| `retry_delay` | `2.0` | Seconds between retries |
| `max_concurrent_downloads` | `5` | Max simultaneous downloads |
| `torrent_dht_timeout` | `15` | DHT bootstrap timeout (seconds) |

---

## License

[MIT](LICENSE)

---

*Built with [yt-dlp](https://github.com/yt-dlp/yt-dlp), [FastAPI](https://fastapi.tiangolo.com/), and [React](https://react.dev/).*
