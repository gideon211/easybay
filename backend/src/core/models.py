from dataclasses import dataclass
from enum import Enum
from typing import Optional
from datetime import datetime


class VideoType(Enum):
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    INSTAGRAM = "instagram"
    TWITTER = "twitter"
    UNKNOWN = "unknown"


class DownloadStatus(Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


class Quality(Enum):
    BEST = "best"
    WORST = "worst"
    Q1080P = "1080p"
    Q720P = "720p"
    Q480P = "480p"
    AUDIO = "audio"


@dataclass
class DownloadResult:
    success: bool
    filename: Optional[str] = None
    filepath: Optional[str] = None
    error: Optional[str] = None
    video_type: VideoType = VideoType.UNKNOWN


@dataclass
class ProgressInfo:
    progress: float = 0.0
    speed: str = ""
    eta: str = ""
    filename: str = ""
    status: DownloadStatus = DownloadStatus.PENDING
