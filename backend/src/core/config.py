from pathlib import Path
from datetime import datetime


class Config:
    def __init__(self):
        self._loaded = False
        self._load_defaults()

    def _load_defaults(self):
        self.download_dir: Path = Path.home() / "Downloads" / "EasyBay"
        self.max_retries: int = 1
        self.retry_delay: float = 2.0
        self.log_file: Path = Path("logs/downloader.log")
        self.max_concurrent_downloads: int = 5
        self.max_youtube_concurrent: int = 5
        self.torrent_port_start: int = 6881
        self.torrent_port_end: int = 6889
        self.torrent_dir: Path = Path.home() / "Downloads" / "EasyBay" / "torrents"
        self.torrent_dht_timeout: int = 15
        self.torrent_metadata_timeout: int = 10
        self.uploads_dir: Path = Path.home() / "Downloads" / "EasyBay" / "uploads"
        self.bg_results_dir: Path = Path.home() / "Downloads" / "EasyBay" / "bg_results"

    def _ensure_loaded(self):
        if not self._loaded:
            self._load_from_db()
            self._loaded = True

    def _load_from_db(self):
        try:
            from ..db.models import SessionLocal, Setting
            db = SessionLocal()
            try:
                settings = db.query(Setting).all()
                for s in settings:
                    self._apply_setting(s.key, s.value)
            finally:
                db.close()
        except Exception:
            pass

    def _apply_setting(self, key: str, value: str | None):
        if value is None:
            return
        if key == "download_dir":
            self.download_dir = Path(value)
        elif key == "max_retries":
            self.max_retries = int(value)
        elif key == "retry_delay":
            self.retry_delay = float(value)
        elif key == "log_file":
            self.log_file = Path(value)
        elif key == "max_concurrent_downloads":
            self.max_concurrent_downloads = int(value)
        elif key == "max_youtube_concurrent":
            self.max_youtube_concurrent = int(value)
        elif key == "torrent_port_start":
            self.torrent_port_start = int(value)
        elif key == "torrent_port_end":
            self.torrent_port_end = int(value)
        elif key == "torrent_dir":
            self.torrent_dir = Path(value)
        elif key == "torrent_dht_timeout":
            self.torrent_dht_timeout = int(value)
        elif key == "torrent_metadata_timeout":
            self.torrent_metadata_timeout = int(value)
        elif key == "uploads_dir":
            self.uploads_dir = Path(value)
        elif key == "bg_results_dir":
            self.bg_results_dir = Path(value)

    def update(self, key: str, value: str):
        self._ensure_loaded()
        self._apply_setting(key, value)
        try:
            from ..db.models import SessionLocal, Setting
            db = SessionLocal()
            try:
                setting = db.query(Setting).filter(Setting.key == key).first()
                if not setting:
                    setting = Setting(key=key)
                    db.add(setting)
                setting.value = value
                setting.updated_at = datetime.utcnow()
                db.commit()
            finally:
                db.close()
        except Exception:
            pass

    def to_dict(self) -> dict[str, str]:
        self._ensure_loaded()
        return {
            "download_dir": str(self.download_dir),
            "max_retries": str(self.max_retries),
            "retry_delay": str(self.retry_delay),
            "log_file": str(self.log_file),
            "max_concurrent_downloads": str(self.max_concurrent_downloads),
            "max_youtube_concurrent": str(self.max_youtube_concurrent),
            "torrent_port_start": str(self.torrent_port_start),
            "torrent_port_end": str(self.torrent_port_end),
            "torrent_dir": str(self.torrent_dir),
            "torrent_dht_timeout": str(self.torrent_dht_timeout),
            "torrent_metadata_timeout": str(self.torrent_metadata_timeout),
            "uploads_dir": str(self.uploads_dir),
            "bg_results_dir": str(self.bg_results_dir),
        }

    def ensure_dirs(self):
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.torrent_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.bg_results_dir.mkdir(parents=True, exist_ok=True)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)


_config: Config | None = None


def get_config() -> Config:
    global _config
    if _config is None:
        _config = Config()
    return _config
