import io
import logging
from pathlib import Path
from typing import Callable

from PIL import Image

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
        )

        if progress_callback:
            progress_callback("saving", 90, "Saving result...")

        if output_format.upper() == "WEBP":
            img = Image.open(io.BytesIO(result))
            buf = io.BytesIO()
            img.save(buf, format="WEBP", quality=95)
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
