import base64
import io
import logging

from PIL import Image

logger = logging.getLogger(__name__)


class SvgConverter:
    def convert(
        self,
        input_bytes: bytes,
        img_format: str = "png",
    ) -> str:
        img = Image.open(io.BytesIO(input_bytes)).convert("RGBA")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        png_bytes = buf.getvalue()

        w, h = img.size
        b64 = base64.b64encode(png_bytes).decode("ascii")

        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n'
            f'  <image href="data:image/png;base64,{b64}" width="{w}" height="{h}"/>\n'
            f'</svg>\n'
        )
