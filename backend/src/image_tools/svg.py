import io
import logging
from collections import defaultdict

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)


class SvgConverter:
    MAX_TRACE_PIXELS = 180_000
    MAX_COLORS = 32

    def convert(
        self,
        input_bytes: bytes,
        img_format: str = "png",
    ) -> str:
        source = ImageOps.exif_transpose(Image.open(io.BytesIO(input_bytes))).convert("RGBA")
        original_width, original_height = source.size
        if original_width < 1 or original_height < 1:
            raise ValueError("Image has no drawable pixels")

        # A path for every source pixel would make a photograph-sized SVG enormous. I retain
        # the original view size but trace a bounded working image, which produces genuinely
        # scalable vector shapes while keeping conversion time and output size predictable.
        scale = min(1.0, (self.MAX_TRACE_PIXELS / (original_width * original_height)) ** 0.5)
        trace_size = (
            max(1, round(original_width * scale)),
            max(1, round(original_height * scale)),
        )
        traced = source.resize(trace_size, Image.Resampling.LANCZOS) if scale < 1 else source

        alpha = traced.getchannel("A")
        rgb = traced.convert("RGB").quantize(
            colors=self.MAX_COLORS,
            method=Image.Quantize.MEDIANCUT,
            dither=Image.Dither.FLOYDSTEINBERG,
        ).convert("RGB")
        width, height = traced.size
        pixels = rgb.load()
        alphas = alpha.load()
        runs: dict[tuple[int, int, int, int], list[str]] = defaultdict(list)

        # Adjacent pixels of the same quantized color become one horizontal path segment. This
        # is much smaller than emitting rectangles per pixel and, unlike the previous embedded
        # PNG, every visible part of the result is an editable SVG fill path.
        for y in range(height):
            x = 0
            while x < width:
                r, g, b = pixels[x, y]
                opacity = 0 if alphas[x, y] <= 8 else round(alphas[x, y] / 17) * 17
                start = x
                x += 1
                while x < width:
                    next_rgb = pixels[x, y]
                    next_alpha = 0 if alphas[x, y] <= 8 else round(alphas[x, y] / 17) * 17
                    if next_rgb != (r, g, b) or next_alpha != opacity:
                        break
                    x += 1
                if opacity:
                    runs[(r, g, b, min(opacity, 255))].append(f"M{start} {y}h{x - start}v1H{start}z")

        paths = []
        for (r, g, b, opacity), commands in runs.items():
            opacity_attr = "" if opacity == 255 else f' fill-opacity="{opacity / 255:.3f}"'
            paths.append(f'<path fill="#{r:02x}{g:02x}{b:02x}"{opacity_attr} d="{"".join(commands)}"/>')

        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{original_width}" height="{original_height}" '
            f'viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet">\n'
            f'  <g shape-rendering="geometricPrecision">\n    '
            + "\n    ".join(paths)
            + "\n  </g>\n</svg>\n"
        )
