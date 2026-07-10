import logging
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    create_engine,
    text,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


class Download(Base):
    __tablename__ = "downloads"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False)
    video_type = Column(String, nullable=False)
    quality = Column(String, default="best")
    filename = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending/downloading/completed/failed
    progress = Column(Float, default=0.0)
    speed = Column(String, nullable=True)
    eta = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    remove_watermark = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "url": self.url,
            "video_type": self.video_type,
            "quality": self.quality,
            "filename": self.filename,
            "status": self.status,
            "progress": self.progress,
            "speed": self.speed,
            "eta": self.eta,
            "error_message": self.error_message,
            "file_size": self.file_size,
            "remove_watermark": self.remove_watermark,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {self.key: self.value}


class Torrent(Base):
    __tablename__ = "torrents"

    id = Column(Integer, primary_key=True, index=True)
    magnet = Column(String, nullable=False)
    name = Column(String, nullable=True)
    info_hash = Column(String, nullable=True, index=True)
    save_path = Column(String, nullable=True)
    filename = Column(String, nullable=True)
    status = Column(String, default="pending")
    progress = Column(Float, default=0.0)
    speed = Column(String, nullable=True)
    eta = Column(String, nullable=True)
    peers = Column(Integer, default=0)
    total_size = Column(Integer, nullable=True)
    downloaded = Column(Integer, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "magnet": self.magnet,
            "name": self.name,
            "info_hash": self.info_hash,
            "save_path": self.save_path,
            "filename": self.filename,
            "status": self.status,
            "progress": self.progress,
            "speed": self.speed,
            "eta": self.eta,
            "peers": self.peers,
            "total_size": self.total_size,
            "downloaded": self.downloaded,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


DATABASE_URL = "sqlite:///./downloads.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
    _seed_default_settings()


def _seed_default_settings():
    try:
        db = SessionLocal()
        try:
            existing = db.query(Setting).count()
            if existing == 0:
                from ..core.config import get_config
                cfg = get_config()
                for key, value in cfg.to_dict().items():
                    db.add(Setting(key=key, value=str(value)))
                db.commit()
        finally:
            db.close()
    except Exception:
        pass
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE downloads ADD COLUMN remove_watermark BOOLEAN DEFAULT 0"))
            conn.commit()
    except Exception:
        logger.debug("Migration ALTER TABLE remove_watermark skipped (likely already exists)")

    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE downloads ADD COLUMN file_size INTEGER"))
            conn.commit()
    except Exception:
        logger.debug("Migration ALTER TABLE file_size skipped (likely already exists)")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
