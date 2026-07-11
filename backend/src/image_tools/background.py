import io
import logging
from pathlib import Path
from typing import Callable

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, int, str], None]


class BackgroundRemover:
    def __init__(self, model: str = "birefnet-general"):
        self.model = model
        self._session = None

    def _get_session(self):
        if self._session is None:
            from rembg import new_session
            self._session = new_session(self.model)
        return self._session

    def remove(
        self,
        input_bytes: bytes,
        output_format: str = "PNG",
        progress_callback: ProgressCallback | None = None,
    ) -> bytes:
        from rembg import remove as rembg_remove

        if progress_callback:
            progress_callback("loading_model", 10, "Loading AI model...")

        session = self._get_session()

        if progress_callback:
            progress_callback("processing", 60, "Removing background...")

        result = rembg_remove(
            input_bytes,
            session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=245,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=5,
            post_process_mask=True,
        )

        # Alpha matting can leave a nearly transparent fringe around hair and clothing. Those
        # pixels are invisible on a checkerboard but create a gray/white halo on a real colored
        # background. Snapping only the extreme confidence values preserves soft hair detail
        # while removing the low-confidence residue that makes the filter look dirty.
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(result))).convert("RGBA")
        alpha = img.getchannel("A").point(lambda value: 0 if value <= 8 else (255 if value >= 247 else value))
        img.putalpha(alpha)
        cleaned = io.BytesIO()
        img.save(cleaned, format="PNG", optimize=True)
        result = cleaned.getvalue()

        if progress_callback:
            progress_callback("saving", 90, "Saving result...")

        if output_format.upper() == "WEBP":
            img = Image.open(io.BytesIO(result))
            buf = io.BytesIO()
            # Lossless WebP keeps the cleaned alpha edge intact. A lossy alpha-adjacent RGB
            # channel can reintroduce visible halos when the image is composited elsewhere.
            img.save(buf, format="WEBP", lossless=True, method=6)
            result = buf.getvalue()

        if progress_callback:
            progress_callback("done", 100, "Complete")

        return result

    def remove_file(
        self,
        input_path: Path,
        output_path: Path | None = None,
        progress_callback: ProgressCallback | None = None,
    ) -> Path:
        output_path = output_path or input_path.with_stem(input_path.stem + "_nobg").with_suffix(".png")
        with open(input_path, "rb") as f:
            result = self.remove(f.read(), progress_callback=progress_callback)
        output_path.write_bytes(result)
        if progress_callback:
            progress_callback("done", 100, "Complete")
        logger.info("Background removed: %s -> %s", input_path, output_path)
        return output_path
