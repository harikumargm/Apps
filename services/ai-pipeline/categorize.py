"""AI vision pipeline: garment type, colors, SEO copy, category routing (heuristic v1)."""

from __future__ import annotations

import colorsys
import io
import re
from typing import Any

# Fine-grained silhouettes for cotton storefront taxonomy.
SILHOUETTE_KEYWORDS = {
    "palazzo": ("palazzo", "wide leg pant", "flowing pant"),
    "culotte": ("culotte", "cropped wide"),
    "cargo": ("cargo", "utility pocket"),
    "jogger": ("jogger", "cuffed ankle", "tapered track"),
    "kurta": ("kurta", "ethnic top"),
    "saree": ("saree", "drape"),
    "shirt": ("shirt", "collar", "button front"),
    "tshirt": ("tee", "t-shirt", "crew neck"),
    "dress": ("dress", "frock"),
    "coord": ("co-ord", "coord set", "matching set"),
}


def _dominant_hex(image) -> str:
    thumb = image.resize((48, 48))
    pixels = list(thumb.getdata())
    rs = [p[0] for p in pixels]
    gs = [p[1] for p in pixels]
    bs = [p[2] for p in pixels]
    r, g, b = sum(rs) // len(rs), sum(gs) // len(gs), sum(bs) // len(bs)
    return f"#{r:02x}{g:02x}{b:02x}"


def _guess_silhouette(aspect: float, filename: str) -> str:
    name = filename.lower()
    for silhouette, hints in SILHOUETTE_KEYWORDS.items():
        if any(h in name for h in hints):
            return silhouette
    if aspect > 1.25:
        return "tshirt"
    if aspect < 0.75:
        return "dress"
    return "jogger"


def categorize_product_image(
    image_bytes: bytes,
    *,
    audience_hint: str | None = None,
    filename: str = "",
) -> dict[str, Any]:
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = image.size
    aspect = w / max(h, 1)
    silhouette = _guess_silhouette(aspect, filename)
    hex_color = _dominant_hex(image)

    audience = audience_hint or ("women" if silhouette in {"palazzo", "culotte", "saree", "dress"} else "men")
    name_bits = silhouette.replace("_", " ").title()
    color_name = "Cotton " + name_bits
    slug = re.sub(r"[^a-z0-9]+", "-", f"{audience}-{silhouette}-{hex_color[1:]}".lower()).strip("-")

    return {
        "silhouette": silhouette,
        "audience": audience,
        "departments": [audience, silhouette, "cotton"],
        "dominant_color": {"name": color_name, "hex": hex_color},
        "seo_title": f"{color_name} — {audience.title()} · Vastram",
        "seo_description": (
            f"Shop {color_name.lower()} with measured cotton drape. "
            f"Auto-tagged as {silhouette} for {audience}'s catalog."
        ),
        "suggested_slug": slug,
        "confidence": 0.78,
        "engine": "heuristic-cv-v1",
    }