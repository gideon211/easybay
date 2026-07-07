# EasyBay

A private media downloader for downloading videos from YouTube, TikTok, Instagram, and Twitter.

## Features

- Download videos from YouTube, TikTok, Instagram, and Twitter/X
- Quality selection (best, worst, 1080p, 720p, 480p, audio-only)
- Real-time progress display
- Automatic retry on failure
- Clean filenames with timestamps

## Quick Start

### Prerequisites

- Python 3.10+
- ffmpeg (for video merging)

### Installation

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -e ".[dev]"
```

### Usage

```bash
# Download a video (best quality)
python -m src.cli.main download "https://youtube.com/watch?v=..."

# Download at specific quality
python -m src.cli.main download "https://youtube.com/watch?v=..." --quality 720p

# Download audio only
python -m src.cli.main download "https://youtube.com/watch?v=..." --quality audio

# Get video info
python -m src.cli.main info "https://youtube.com/watch?v=..."

# List available formats
python -m src.cli.main formats "https://youtube.com/watch?v=..."
```

### Quality Options

| Option | Description |
|--------|-------------|
| `best` | Best available quality (default) |
| `worst` | Lowest quality, fastest download |
| `1080p` | Max 1080p resolution |
| `720p` | Max 720p resolution |
| `480p` | Max 480p resolution |
| `audio` | Audio only (no video) |

## Development

```bash
# Run tests
make test

# Run linter
make lint

# Install all dependencies
make install
```

## Architecture

```
backend/
├── src/
│   ├── cli/          # CLI interface (Typer + Rich)
│   ├── core/         # Shared download logic
│   ├── api/          # FastAPI backend (Phase 2)
│   ├── torrent/      # Torrent support (Phase 3)
│   ├── watermark/    # Watermark removal (Phase 4)
│   └── db/           # Database layer
└── tests/
```

## Roadmap

- [x] Phase 1: CLI tool with quality selection
- [ ] Phase 2: Web UI + Docker
- [ ] Phase 3: Torrent support
- [ ] Phase 4: Watermark removal

## License

MIT
