import subprocess  # nosec
from pathlib import Path

WATERMARK_PRESETS = {
    "tiktok": {
        "label": "TikTok (bottom-right)",
        "filter": "delogo=x=W-w-10:y=H-h-10:w=200:h=60",
    },
    "instagram": {
        "label": "Instagram (bottom-right)",
        "filter": "delogo=x=W-w-10:y=H-h-10:w=250:h=60",
    },
}


class WatermarkRemover:
    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        self.ffmpeg_path = ffmpeg_path

    @staticmethod
    def has_watermark(video_type: str) -> bool:
        return video_type.lower() in WATERMARK_PRESETS

    def remove(
        self,
        input_path: Path,
        video_type: str,
        output_suffix: str = ".clean",
    ) -> Path | None:
        if not self.has_watermark(video_type):
            return None

        preset = WATERMARK_PRESETS[video_type.lower()]
        stem = input_path.stem
        ext = input_path.suffix
        temp_path = input_path.with_name(f"{stem}{output_suffix}{ext}")

        cmd = [
            self.ffmpeg_path,
            "-i", str(input_path),
            "-vf", preset["filter"],
            "-c:a", "copy",
            "-y",
            str(temp_path),
        ]

        try:
            subprocess.run(  # nosec
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=300,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            if temp_path.exists():
                temp_path.unlink()
            return None

        if temp_path.exists():
            input_path.unlink()
            temp_path.rename(input_path)
            return input_path

        return None
