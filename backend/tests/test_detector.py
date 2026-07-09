from src.core.detector import detect_video_type, is_valid_url
from src.core.models import VideoType


class TestDetectVideoType:
    def test_youtube_standard(self):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert detect_video_type(url) == VideoType.YOUTUBE

    def test_youtube_short(self):
        url = "https://youtu.be/dQw4w9WgXcQ"
        assert detect_video_type(url) == VideoType.YOUTUBE

    def test_youtube_shorts(self):
        url = "https://www.youtube.com/shorts/dQw4w9WgXcQ"
        assert detect_video_type(url) == VideoType.YOUTUBE

    def test_youtube_mobile(self):
        url = "https://m.youtube.com/watch?v=dQw4w9WgXcQ"
        assert detect_video_type(url) == VideoType.YOUTUBE

    def test_tiktok_standard(self):
        url = "https://www.tiktok.com/@user/video/1234567890"
        assert detect_video_type(url) == VideoType.TIKTOK

    def test_tiktok_short(self):
        url = "https://vm.tiktok.com/abc123"
        assert detect_video_type(url) == VideoType.TIKTOK

    def test_instagram_post(self):
        url = "https://www.instagram.com/p/ABC123/"
        assert detect_video_type(url) == VideoType.INSTAGRAM

    def test_instagram_reel(self):
        url = "https://www.instagram.com/reel/ABC123/"
        assert detect_video_type(url) == VideoType.INSTAGRAM

    def test_twitter_standard(self):
        url = "https://twitter.com/user/status/1234567890"
        assert detect_video_type(url) == VideoType.TWITTER

    def test_twitter_x(self):
        url = "https://x.com/user/status/1234567890"
        assert detect_video_type(url) == VideoType.TWITTER

    def test_unknown_url(self):
        url = "https://example.com/video"
        assert detect_video_type(url) == VideoType.UNKNOWN


class TestIsValidUrl:
    def test_valid_https(self):
        assert is_valid_url("https://youtube.com") is True

    def test_valid_http(self):
        assert is_valid_url("http://youtube.com") is True

    def test_valid_with_path(self):
        assert is_valid_url("https://youtube.com/watch?v=123") is True

    def test_invalid_no_protocol(self):
        assert is_valid_url("youtube.com") is False

    def test_invalid_empty(self):
        assert is_valid_url("") is False

    def test_invalid_not_url(self):
        assert is_valid_url("not a url") is False
