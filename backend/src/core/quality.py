from .models import Quality

QUALITY_FORMATS = {
    Quality.BEST: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    Quality.WORST: "worstvideo[ext=mp4]+worstaudio[ext=m4a]/worst[ext=mp4]/worst",
    Quality.Q1080P: "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
    Quality.Q720P: "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
    Quality.Q480P: "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best",
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
    if "+" not in key:
        return f"{key}+bestaudio[ext=m4a]/best"
    return key


get_format_string = resolve_format_string


def parse_quality(value: str) -> Quality:
    """Parse a string into a Quality enum. Raises ValueError if invalid."""
    for q in Quality:
        if q.value == value.lower().strip():
            return q
    raise ValueError(f"Invalid quality: {value}")
