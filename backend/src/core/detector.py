import re
from .models import VideoType


YOUTUBE_PATTERNS = [
    r'(?:https?://)?(?:www\.|m\.)?youtube\.com/watch\?v=([\w-]+)',
    r'(?:https?://)?(?:www\.|m\.)?youtube\.com/shorts/([\w-]+)',
    r'(?:https?://)?youtu\.be/([\w-]+)',
    r'(?:https?://)?(?:www\.|m\.)?youtube\.com/embed/([\w-]+)',
]

TIKTOK_PATTERNS = [
    r'(?:https?://)?(?:www\.)?tiktok\.com/@[\w.]+/video/(\d+)',
    r'(?:https?://)?(?:vm|vt)\.tiktok\.com/[\w]+',
    r'(?:https?://)?(?:www\.)?tiktok\.com/t/[\w]+',
]

INSTAGRAM_PATTERNS = [
    r'(?:https?://)?(?:www\.)?instagram\.com/p/([\w-]+)',
    r'(?:https?://)?(?:www\.)?instagram\.com/reel/([\w-]+)',
    r'(?:https?://)?(?:www\.)?instagram\.com/tv/([\w-]+)',
]

TWITTER_PATTERNS = [
    r'(?:https?://)?(?:www\.)?(?:twitter\.com|x\.com)/\w+/status/(\d+)',
    r'(?:https?://)?t\.co/[\w]+',
]


def detect_video_type(url: str) -> VideoType:
    url = url.strip().lower()

    for pattern in YOUTUBE_PATTERNS:
        if re.match(pattern, url):
            return VideoType.YOUTUBE

    for pattern in TIKTOK_PATTERNS:
        if re.match(pattern, url):
            return VideoType.TIKTOK

    for pattern in INSTAGRAM_PATTERNS:
        if re.match(pattern, url):
            return VideoType.INSTAGRAM

    for pattern in TWITTER_PATTERNS:
        if re.match(pattern, url):
            return VideoType.TWITTER

    return VideoType.UNKNOWN


def is_valid_url(url: str) -> bool:
    url_pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+'  # domain...
        r'(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'  # host...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return url_pattern.match(url) is not None
