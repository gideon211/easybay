from .models import Quality


QUALITY_FORMATS = {
    Quality.BEST: "bestvideo+bestaudio/best",
    Quality.WORST: "worstvideo+worstaudio/worst",
    Quality.Q1080P: "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    Quality.Q720P: "bestvideo[height<=720]+bestaudio/best[height<=720]",
    Quality.Q480P: "bestvideo[height<=480]+bestaudio/best[height<=480]",
    Quality.AUDIO: "bestaudio/best",
}


def get_format_string(quality: Quality) -> str:
    return QUALITY_FORMATS[quality]


def parse_quality(value: str) -> Quality:
    value = value.lower().strip()
    for q in Quality:
        if q.value == value:
            return q
    valid = ", ".join(q.value for q in Quality)
    raise ValueError(f"Invalid quality '{value}'. Valid options: {valid}")
