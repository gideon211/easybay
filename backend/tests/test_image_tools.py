import io

from PIL import Image

from src.image_tools.svg import SvgConverter


def _png_bytes(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_svg_converter_emits_vector_paths_instead_of_embedded_raster():
    image = Image.new("RGBA", (6, 4), (220, 20, 60, 255))

    svg = SvgConverter().convert(_png_bytes(image))

    assert '<path fill="#dc143c"' in svg
    assert "data:image" not in svg
    assert "<image " not in svg
    assert 'width="6" height="4"' in svg


def test_svg_converter_preserves_transparency_without_drawing_hidden_pixels():
    image = Image.new("RGBA", (2, 1), (0, 0, 0, 0))
    image.putpixel((1, 0), (0, 128, 255, 128))

    svg = SvgConverter().convert(_png_bytes(image))

    path_data = svg.split(' d="', 1)[1].split('"', 1)[0]
    assert path_data.count("M") == 1
    assert 'fill="#0080ff"' in svg
    assert "fill-opacity=" in svg


def test_svg_converter_bounds_large_images_to_a_practical_trace_grid():
    image = Image.new("RGB", (1200, 800), "navy")

    svg = SvgConverter().convert(_png_bytes(image))

    view_box = svg.split('viewBox="', 1)[1].split('"', 1)[0]
    _, _, trace_width, trace_height = map(int, view_box.split())
    assert trace_width * trace_height <= SvgConverter.MAX_TRACE_PIXELS + trace_width
    assert 'width="1200" height="800"' in svg
