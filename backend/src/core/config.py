from dataclasses import dataclass
from pathlib import Path


@dataclass
class Config:
    download_dir: Path = Path.home() / "Downloads" / "EasyBay"
    max_retries: int = 1
    retry_delay: float = 2.0
    log_file: Path = Path("logs/downloader.log")
    max_concurrent_downloads: int = 5
    max_youtube_concurrent: int = 5
    torrent_port_start: int = 6881
    torrent_port_end: int = 6889
    torrent_dir: Path = Path.home() / "Downloads" / "EasyBay" / "torrents"
    torrent_dht_timeout: int = 15
    torrent_metadata_timeout: int = 10

    def ensure_dirs(self):
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.torrent_dir.mkdir(parents=True, exist_ok=True)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)


_config: Config | None = None


def get_config() -> Config:
    global _config
    if _config is None:
        _config = Config()
    return _config
