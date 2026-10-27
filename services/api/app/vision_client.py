from __future__ import annotations

import sys
from pathlib import Path

import httpx

from app.settings import Settings

_VISION_ROOT = Path(__file__).resolve().parents[2] / "vision"
if str(_VISION_ROOT) not in sys.path:
    sys.path.insert(0, str(_VISION_ROOT))


def analyze(settings: Settings, data: bytes) -> dict:
    if settings.vision_url:
        response = httpx.post(
            f"{settings.vision_url}/analyze",
            files={"file": ("cloth.jpg", data, "image/jpeg")},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    from sutra_vision.fabric import analyze_image

    return analyze_image(data)


def tryon(settings: Settings, **kwargs) -> dict:
    if settings.vision_url and kwargs.get("photo") is None:
        fabric = kwargs["fabric"]
        response = httpx.post(
            f"{settings.vision_url}/tryon/twin",
            json={
                "silhouette": kwargs["silhouette"],
                "color_hex": kwargs["color_hex"],
                "fabric": fabric,
                "height_cm": kwargs["measurements"]["height_cm"],
                "chest_cm": kwargs["measurements"]["chest_cm"],
                "waist_cm": kwargs["measurements"]["waist_cm"],
                "hips_cm": kwargs["measurements"]["hips_cm"],
                "consent": True,
            },
            timeout=30,
        )
        response.raise_for_status()
        body = response.json()
        import base64

        body["image_bytes"] = base64.b64decode(body.pop("image_base64"))
        return body
    from sutra_vision.tryon import render_tryon

    return render_tryon(**kwargs)
