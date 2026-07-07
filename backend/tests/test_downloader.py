import pytest
from src.core.models import Quality, VideoType, DownloadStatus, ProgressInfo
from src.core.quality import get_format_string, parse_quality
from src.core.detector import detect_video_type


class TestQuality:
    def test_best_format(self):
        assert get_format_string(Quality.BEST) == "bestvideo+bestaudio/best"

    def test_720p_format(self):
        assert get_format_string(Quality.Q720P) == "bestvideo[height<=720]+bestaudio/best[height<=720]"

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
