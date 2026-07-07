from .models import Quality


QUALITY_FORMATS = {
    Quality.BEST: "bestvideo+bestaudio/best",
    Quality.WORST: "worstvideo+worstaudio/worst",
    Quality.Q1080P: "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    Quality.Q720P: "bestvideo[height<=720]+bestaudio/best[height<=720]",
    Quality.Q480P: "bestvideo[height<=480]+bestaudio/best[height<=480]",
    Quality.AUDIO: "bestaudio/best",
}

QUALITY_VALUES = {q.value for q in Quality}


def resolve_format_string(quality: str | Quality) -> str:
    """Return a yt-dlp format string for a quality value.
    Accepts Quality enum, enum name string (best, 1080p…), or raw format ID (137+140).
    """
    if isinstance(quality, Quality):
        return QUALITY_FORMATS[quality]
    key = quality.lower().strip()
    for q in Quality:
        if q.value == key:
            return QUALITY_FORMATS[q]
    return quality


get_format_string = resolve_format_string


def parse_quality(value: str) -> Quality:
    """Parse a string into a Quality enum. Raises ValueError if invalid."""
    for q in Quality:
        if q.value == value.lower().strip():
            return q
    raise ValueError(f"Invalid quality: {value}")
