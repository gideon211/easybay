import time
import yt_dlp
from pathlib import Path
from typing import Callable, Optional
from datetime import datetime

from .models import VideoType, DownloadResult, ProgressInfo, DownloadStatus, Quality
from .detector import detect_video_type
from .quality import get_format_string
from .config import get_config


class DownloadError(Exception):
    pass


class Downloader:
    def __init__(self, progress_callback: Optional[Callable[[ProgressInfo], None]] = None):
        self.config = get_config()
        self.progress_callback = progress_callback
        self._current_info: Optional[ProgressInfo] = None

    def _progress_hook(self, d: dict):
        if self._current_info is None:
            return

        if d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
            downloaded = d.get('downloaded_bytes', 0)
            speed = d.get('speed')
            eta = d.get('eta')

            self._current_info.progress = downloaded / total if total > 0 else 0
            self._current_info.speed = f"{speed / 1024 / 1024:.1f}MB/s" if speed else ""
            self._current_info.eta = self._format_eta(eta) if eta else ""
            self._current_info.status = DownloadStatus.DOWNLOADING

        elif d['status'] == 'finished':
            self._current_info.progress = 1.0
            self._current_info.status = DownloadStatus.COMPLETED
            self._current_info.filename = d.get('filename', '')

        if self.progress_callback:
            self.progress_callback(self._current_info)

    def _format_eta(self, seconds: int) -> str:
        if seconds < 60:
            return f"{seconds}s"
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}:{secs:02d}"

    def _generate_filename(self, title: str, ext: str) -> str:
        safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_title = safe_title[:100]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{safe_title}_{timestamp}.{ext}"

    def _download_with_retry(self, url: str, quality: Quality, output_dir: Path) -> DownloadResult:
        video_type = detect_video_type(url)
        format_string = get_format_string(quality)

        ydl_opts = {
            'format': format_string,
            'outtmpl': str(output_dir / '%(title)s.%(ext)s'),
            'progress_hooks': [self._progress_hook],
            'noplaylist': True,
            'quiet': True,
            'no_warnings': True,
        }

        last_error = None
        for attempt in range(self.config.max_retries + 1):
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=True)

                    if info:
                        title = info.get('title', 'download')
                        ext = info.get('ext', 'mp4')
                        filename = self._generate_filename(title, ext)
                        filepath = output_dir / filename

                        return DownloadResult(
                            success=True,
                            filename=filename,
                            filepath=str(filepath),
                            video_type=video_type
                        )

            except yt_dlp.utils.DownloadError as e:
                last_error = str(e)
                if attempt < self.config.max_retries:
                    time.sleep(self.config.retry_delay)
            except Exception as e:
                last_error = str(e)
                if attempt < self.config.max_retries:
                    time.sleep(self.config.retry_delay)

        return DownloadResult(
            success=False,
            error=last_error or "Download failed",
            video_type=video_type
        )

    def download(self, url: str, quality: Quality = Quality.BEST, output_dir: Optional[Path] = None) -> DownloadResult:
        self.config.ensure_dirs()
        output = output_dir or self.config.download_dir

        self._current_info = ProgressInfo(
            status=DownloadStatus.PENDING,
            filename=url
        )
        if self.progress_callback:
            self.progress_callback(self._current_info)

        try:
            return self._download_with_retry(url, quality, output)
        finally:
            self._current_info = None
