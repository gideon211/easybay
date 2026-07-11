import logging
import threading
import time
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

import yt_dlp

from .config import get_config
from .detector import detect_video_type
from .models import DownloadResult, DownloadStatus, ProgressInfo
from .quality import resolve_format_string

logger = logging.getLogger(__name__)


class DownloadError(Exception):
    pass


class Downloader:
    def __init__(
        self,
        progress_callback: Callable[[ProgressInfo], None] | None = None,
        cancel_event: threading.Event | None = None,
    ):
        self.config = get_config()
        self.progress_callback = progress_callback
        self._current_info: ProgressInfo | None = None
        self._cancel_event = cancel_event

    def _progress_hook(self, d: dict):
        if self._current_info is None:
            return

        if self._cancel_event and self._cancel_event.is_set():
            raise yt_dlp.utils.DownloadError("Paused by user")

        if d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
            downloaded = d.get('downloaded_bytes', 0)
            speed = d.get('speed')
            eta = d.get('eta')
            info_dict = d.get("info_dict") or {}

            self._current_info.progress = downloaded / total if total > 0 else 0
            self._current_info.speed = f"{speed / 1024 / 1024:.1f}MB/s" if speed else ""
            self._current_info.eta = self._format_eta(eta) if eta else ""
            self._current_info.status = DownloadStatus.DOWNLOADING

            # yt-dlp already includes the title in its first progress event. Using it here
            # avoids a separate metadata request before every download, which was especially
            # noticeable on large files and on sites with slow extractor responses.
            title = info_dict.get("title")
            if title:
                ext = info_dict.get("ext") or "mp4"
                self._current_info.filename = self._generate_filename(
                    title,
                    ext,
                    detect_video_type(info_dict.get("webpage_url") or info_dict.get("original_url") or ""),
                )

        elif d['status'] == 'finished':
            # A finished transfer may still need an audio/video merge. Keeping the value just
            # below 100% prevents the UI from offering a file while FFmpeg is still writing it.
            self._current_info.progress = 0.99
            self._current_info.status = DownloadStatus.DOWNLOADING

        if self.progress_callback:
            self.progress_callback(self._current_info)

    def _format_eta(self, seconds: int) -> str:
        if seconds < 60:
            return f"{seconds}s"
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}:{secs:02d}"

    def _generate_filename(self, title: str, ext: str, video_type=None) -> str:
        auto_prefixes = ("video by ", "photo by ", "image by ", "reel by ", "post by ")
        if title.lower().startswith(auto_prefixes):
            parts = title.split(" by ", 1)
            username = parts[1].strip() if len(parts) > 1 else "download"
            safe_username = "".join(c for c in username if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_username = safe_username[:50]
            platform = video_type.value if video_type else "download"
            return f"{safe_username}_{platform}.{ext}"
        safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_title = safe_title[:100]
        return f"{safe_title}.{ext}"

    def _download_with_retry(self, url: str, quality: str, output_dir: Path) -> DownloadResult:
        video_type = detect_video_type(url)
        format_string = resolve_format_string(quality)

        ydl_opts = {
            'format': format_string,
            'merge_output_format': 'mp4',
            'outtmpl': str(output_dir / '%(id)s.%(ext)s'),
            'progress_hooks': [self._progress_hook],
            'noplaylist': True,
            'quiet': True,
            'no_warnings': True,
            # These options make interrupted multi-gigabyte transfers resume from their .part
            # files and let DASH/HLS fragments download in parallel. Retries are handled inside
            # yt-dlp so a transient fragment failure does not restart the entire media file.
            'continuedl': True,
            'retries': 10,
            'fragment_retries': 10,
            'file_access_retries': 3,
            'concurrent_fragment_downloads': 4,
            'buffersize': 1024 * 1024,
        }

        cookies_file = self.config.download_dir.parent / "cookies.txt"
        if cookies_file.exists():
            ydl_opts['cookiefile'] = str(cookies_file)

        if self.config.download_speed_limit > 0:
            ydl_opts['ratelimit'] = self.config.download_speed_limit * 1024  # KB/s to B/s

        last_error = None
        for attempt in range(self.config.max_retries + 1):
            if self._cancel_event and self._cancel_event.is_set():
                return DownloadResult(
                    success=False,
                    error="Paused by user",
                    video_type=video_type,
                )
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=True)

                    if info:
                        title = info.get('title', 'download')
                        ext = info.get('ext', 'mp4')

                        video_id = info['id']
                        candidates = [
                            path
                            for path in output_dir.glob(f"{video_id}.*")
                            if not path.name.endswith((".part", ".ytdl", ".temp"))
                            and ".f" not in path.stem
                        ]
                        # Separate video/audio formats create several files with the same ID.
                        # Selecting alphabetically could rename a video-only fragment as the
                        # final result. The merged output is written last, so mtime is the safest
                        # cross-extractor signal when yt-dlp does not expose a final filepath.
                        temp_path = max(candidates, key=lambda path: path.stat().st_mtime) if candidates else None
                        if temp_path is None:
                            return DownloadResult(
                                success=False,
                                error="Download completed but the output file was not found",
                                video_type=video_type,
                            )
                        ext = temp_path.suffix.lstrip(".") or ext

                        filename = self._generate_filename(title, ext, video_type)
                        filepath = output_dir / filename

                        counter = 1
                        stem = Path(filename).stem
                        while filepath.exists() and filepath != temp_path:
                            filename = f"{stem}_{counter}.{ext}"
                            filepath = output_dir / filename
                            counter += 1

                        if temp_path.exists() and temp_path != filepath:
                            temp_path.rename(filepath)

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

    def download(self, url: str, quality: str = "best", output_dir: Path | None = None) -> DownloadResult:
        self.config.ensure_dirs()
        output = output_dir or self.config.download_dir

        self._current_info = ProgressInfo(
            status=DownloadStatus.PENDING,
            filename=url,
        )
        if self.progress_callback:
            self.progress_callback(self._current_info)

        try:
            return self._download_with_retry(url, quality, output)
        finally:
            self._current_info = None
