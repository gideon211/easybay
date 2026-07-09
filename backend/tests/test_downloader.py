import pytest

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
