import io
import logging
import os
from typing import Optional

from PIL import Image

from .background import BackgroundRemover
from .passport_sizes import SPECS_BY_CODE, PassportSpec

logger = logging.getLogger(__name__)

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "models", "face_detection_full_range.tflite")


class NoFaceDetectedError(Exception):
    pass


class PassportConverter:
    def __init__(self):
        self._remover = BackgroundRemover()

    def _hex_to_rgba(self, hex_color: str) -> tuple[int, int, int, 255]:
        hex_color = hex_color.lstrip("#")
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return (r, g, b, 255)

    def _detect_face(self, img: Image.Image) -> Optional[dict]:
        import numpy as np
        import mediapipe as mp
        from mediapipe.tasks.python.vision.face_detector import FaceDetector, FaceDetectorOptions
        from mediapipe.tasks.python.core.base_options import BaseOptions
        from mediapipe.tasks.python.vision.core.image import Image as MpImage
        from mediapipe.tasks.python.vision.core.vision_task_running_mode import VisionTaskRunningMode

        np_img = np.array(img.convert("RGB"))
        mp_img = MpImage(image_format=mp.ImageFormat.SRGB, data=np_img)

        base_options = BaseOptions(model_asset_path=_MODEL_PATH)
        options = FaceDetectorOptions(
            base_options=base_options,
            running_mode=VisionTaskRunningMode.IMAGE,
            min_detection_confidence=0.5,
        )

        with FaceDetector.create_from_options(options) as detector:
            result = detector.detect(mp_img)
            if result.detections:
                detection = result.detections[0]
                bbox = detection.bounding_box
                h, w, _ = np_img.shape
                # Expand the tight facial bbox by 40% so it covers the full head
                pad = 0.4
                cx = bbox.origin_x + bbox.width / 2
                cy = bbox.origin_y + bbox.height / 2
                exp_w = bbox.width * (1 + pad)
                exp_h = bbox.height * (1 + pad)
                keypoints_abs = [{"x": kp.x * w, "y": kp.y * h} for kp in detection.keypoints]
                # keypoints: 0=right eye, 1=left eye, 2=nose tip, 3=mouth center,
                #            4=right ear tragion, 5=left ear tragion
                eye_mid_x = (keypoints_abs[0]["x"] + keypoints_abs[1]["x"]) / 2
                eye_mid_y = (keypoints_abs[0]["y"] + keypoints_abs[1]["y"]) / 2
                return {
                    "x": int(cx - exp_w / 2),
                    "y": int(cy - exp_h / 2),
                    "width": int(exp_w),
                    "height": int(exp_h),
                    "eye_mid_x": eye_mid_x,
                    "eye_mid_y": eye_mid_y,
                    "bbox_h": bbox.height,
                }
        return None

    def _downscale_image(self, img: Image.Image, max_pixels: int = 1200) -> Image.Image:
        w, h = img.size
        if max(w, h) <= max_pixels:
            return img
        ratio = max_pixels / max(w, h)
        return img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    def convert(
        self,
        input_bytes: bytes,
        country_code: str,
        bg_color: str,
        progress_callback: Optional[callable] = None,
    ) -> bytes:
        spec = SPECS_BY_CODE[country_code]

        if progress_callback:
            progress_callback("detecting_face", 10, "Detecting face...")

        img = Image.open(io.BytesIO(input_bytes))
        img_w, img_h = img.size
        face = self._detect_face(img)

        if not face:
            raise NoFaceDetectedError(
                "No face detected in the image. "
                "Please upload a clear, front-facing portrait photo."
            )

        if progress_callback:
            progress_callback("removing_bg", 35, "Removing background...")

        # Downscale for fast background removal, then upscale alpha back
        small_img = self._downscale_image(img)
        if small_img is not img:
            buf = io.BytesIO()
            small_img.save(buf, format="PNG")
            small_bytes = buf.getvalue()
        else:
            small_bytes = input_bytes

        no_bg_small = self._remover.remove(small_bytes)
        small_subject = Image.open(io.BytesIO(no_bg_small)).convert("RGBA")

        if small_img is not img:
            alpha = small_subject.getchannel("A")
            alpha_full = alpha.resize((img_w, img_h), Image.LANCZOS)
            subject = img.convert("RGBA")
            subject.putalpha(alpha_full)
        else:
            subject = small_subject

        if progress_callback:
            progress_callback("sizing", 65, "Adjusting to passport spec...")

        target_ratio = spec.width_px / spec.height_px

        # Use eye midpoint for centering (more accurate than face bbox center)
        face_cx = face["eye_mid_x"]
        face_cy = face["eye_mid_y"]

        # Face (eyes-to-chin) height should be ~40% of frame height
        face_to_frame_ratio = 0.40
        frame_height = int(face["bbox_h"] / face_to_frame_ratio)
        frame_width = int(frame_height * target_ratio)

        # Eyes positioned at ~42% from the top of the frame (ICAO standard)
        top = int(face_cy - frame_height * 0.42)
        left = int(face_cx - frame_width // 2)

        # Clamp to image bounds, padding if crop extends beyond
        pad_left = max(0, -left)
        pad_top = max(0, -top)
        pad_right = max(0, (left + frame_width) - subject.width)
        pad_bottom = max(0, (top + frame_height) - subject.height)

        crop_left = max(0, left)
        crop_top = max(0, top)
        crop_right = min(subject.width, left + frame_width)
        crop_bottom = min(subject.height, top + frame_height)

        cropped = subject.crop((crop_left, crop_top, crop_right, crop_bottom))

        if pad_left or pad_top or pad_right or pad_bottom:
            padded = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
            padded.paste(cropped, (pad_left, pad_top))
            cropped = padded

        sized = cropped.resize((spec.width_px, spec.height_px), Image.LANCZOS)

        if progress_callback:
            progress_callback("finalizing", 85, "Applying background...")

        bg_rgba = Image.new("RGBA", (spec.width_px, spec.height_px), self._hex_to_rgba(bg_color))
        bg_rgba.paste(sized, (0, 0), sized)

        result = bg_rgba.convert("RGB")

        if progress_callback:
            progress_callback("done", 100, "Complete")

        buf = io.BytesIO()
        result.save(buf, format="PNG")
        return buf.getvalue()
