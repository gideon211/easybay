import pytest
import yt_dlp

from src.core.downloader import Downloader
from src.core.models import DownloadStatus, ProgressInfo, Quality
from src.core.quality import get_format_string, parse_quality


class TestQuality:
    def test_best_format(self):
        expected = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        assert get_format_string(Quality.BEST) == expected

    def test_720p_format(self):
        expected = "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best"
        assert get_format_string(Quality.Q720P) == expected

    def test_audio_format(self):
        assert get_format_string(Quality.AUDIO) == "bestaudio/best"

    def test_parse_quality_valid(self):
        assert parse_quality("best") == Quality.BEST
        assert parse_quality("720p") == Quality.Q720P
        assert parse_quality("audio") == Quality.AUDIO

    def test_parse_quality_invalid(self):
        with pytest.raises(ValueError):
            parse_quality("invalid")


class TestProgressInfo:
    def test_default_values(self):
        info = ProgressInfo()
        assert info.progress == 0.0
        assert info.speed == ""
        assert info.eta == ""
        assert info.status == DownloadStatus.PENDING

    def test_transfer_finished_waits_for_post_processing(self):
        downloader = Downloader()
        downloader._current_info = ProgressInfo(status=DownloadStatus.DOWNLOADING)

        downloader._progress_hook({"status": "finished"})

        assert downloader._current_info.progress == 0.94
        assert downloader._current_info.status == DownloadStatus.DOWNLOADING

    def test_fragment_progress_is_used_when_byte_total_is_missing(self):
        downloader = Downloader()
        downloader._current_info = ProgressInfo(status=DownloadStatus.DOWNLOADING)

        downloader._progress_hook({
            "status": "downloading",
            "fragment_index": 5,
            "fragment_count": 10,
            "filename": "social-video.mp4",
        })

        assert downloader._current_info.progress == pytest.approx(0.47)

    def test_separate_video_and_audio_transfers_never_move_progress_backwards(self):
        downloader = Downloader()
        downloader._current_info = ProgressInfo(status=DownloadStatus.DOWNLOADING)

        downloader._progress_hook({
            "status": "downloading",
            "downloaded_bytes": 90,
            "total_bytes": 100,
            "filename": "video.f137.mp4",
        })
        video_progress = downloader._current_info.progress
        downloader._progress_hook({
            "status": "downloading",
            "downloaded_bytes": 10,
            "total_bytes": 100,
            "filename": "audio.f140.m4a",
        })

        assert downloader._current_info.progress >= video_progress


def test_large_download_options_resume_and_fetch_fragments_concurrently(monkeypatch, tmp_path):
    captured_options = {}

    class FakeYoutubeDL:
        def __init__(self, options):
            captured_options.update(options)

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def extract_info(self, _url, download):
            assert download is True
            (tmp_path / "video-id.mp4").write_bytes(b"merged media")
            return {"id": "video-id", "title": "Large file", "ext": "mp4"}

    monkeypatch.setattr(yt_dlp, "YoutubeDL", FakeYoutubeDL)
    downloader = Downloader()
    downloader._current_info = ProgressInfo()

    result = downloader._download_with_retry("https://example.com/video", "best", tmp_path)

    assert result.success is True
    assert captured_options["continuedl"] is True
    assert captured_options["concurrent_fragment_downloads"] == 4
    assert captured_options["fragment_retries"] == 10
    assert (tmp_path / "Large file.mp4").read_bytes() == b"merged media"
