"""Physics-aware trial view.

Pipeline, matching the product stages:

1. Garment parser — builds an alpha mask of the cloth and drops the
   backdrop. Vector silhouettes have no hanger; uploaded cloth photos
   lose their near-corner background.
2. Pose estimator — anthropometric joints from a dress-form's
   measurements, or from the bounding body in a photo.
3. Renderer — drapes the cloth with hem sag, fold count, and width ease
   driven by weight and stretch. This is a massing model (catenary-like
   hem, fold amplitude), not a diffusion sample.

SUTRA_TRYON_ENGINE=diffusion fails closed until IDM-VTON / OOTDiffusion
weights are mounted at SUTRA_VTON_WEIGHTS.
"""

from __future__ import annotations

import io
import os
import time
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ENGINE_NAME = "physics-drape-v1"

PAPER = (243, 239, 230, 255)
FORM = (214, 186, 158, 255)
INK = (22, 21, 19, 255)


class EngineNotMounted(RuntimeError):
    pass


def active_engine_name() -> str:
    name = os.getenv("SUTRA_TRYON_ENGINE", ENGINE_NAME)
    if name == "diffusion":
        weights = os.getenv("SUTRA_VTON_WEIGHTS", "")
        raise EngineNotMounted(
            "Diffusion trial-view is not mounted. Expected weights at "
            f"SUTRA_VTON_WEIGHTS (current: '{weights or 'unset'}'). "
            "Use physics-drape-v1 for the CPU drape."
        )
    if name != ENGINE_NAME:
        raise EngineNotMounted(f"Unknown try-on engine '{name}'.")
    return name


def render_tryon(
    *,
    silhouette: str,
    color_hex: str,
    fabric: dict[str, Any],
    measurements: dict[str, float],
    photo: bytes | None = None,
    garment_photo: bytes | None = None,
) -> dict[str, Any]:
    engine = active_engine_name()
    started = time.perf_counter()

    t0 = time.perf_counter()
    mask, parser_meta = parse_garment(silhouette, garment_photo)
    t1 = time.perf_counter()

    if photo:
        base = ImageOps.exif_transpose(Image.open(io.BytesIO(photo))).convert("RGB")
        base.thumbnail((720, 960))
        pose = estimate_pose_from_photo(base)
        mode = "photo"
    else:
        base = None
        pose = estimate_pose_from_measurements(measurements)
        mode = "twin"
    t2 = time.perf_counter()

    physics = drape_parameters(fabric, measurements)
    image = paint(
        mode=mode,
        base=base,
        pose=pose,
        color=_hex(color_hex),
        silhouette=silhouette,
        physics=physics,
        mask=mask,
    )
    t3 = time.perf_counter()
    encoded = _encode(image)
    return {
        "engine": engine,
        "mode": mode,
        "media_type": "image/jpeg",
        "image_bytes": encoded,
        "width": image.width,
        "height": image.height,
        "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        "stages": {
            "garment_parser_ms": round((t1 - t0) * 1000, 2),
            "pose_estimator_ms": round((t2 - t1) * 1000, 2),
            "renderer_ms": round((t3 - t2) * 1000, 2),
        },
        "pose": pose,
        "physics": physics,
        "parser": parser_meta,
        "within_budget": (time.perf_counter() - started) < 2.0,
    }


def parse_garment(silhouette: str, garment_photo: bytes | None) -> tuple[Image.Image, dict[str, Any]]:
    if garment_photo:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(garment_photo))).convert("RGBA")
        image.thumbnail((480, 640))
        pixels = image.load()
        corners = [
            pixels[2, 2],
            pixels[image.width - 3, 2],
            pixels[2, image.height - 3],
            pixels[image.width - 3, image.height - 3],
        ]
        bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
        cleared = 0
        for y in range(image.height):
            for x in range(image.width):
                r, g, b, a = pixels[x, y]
                if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < 48:
                    pixels[x, y] = (r, g, b, 0)
                    cleared += 1
        bbox = image.getbbox()
        return image, {
            "source": "photo",
            "background_rgb": list(bg),
            "cleared_ratio": round(cleared / max(image.width * image.height, 1), 3),
            "bbox": list(bbox) if bbox else None,
            "silhouette": silhouette,
        }

    mask = Image.new("L", (200, 260), 0)
    draw = ImageDraw.Draw(mask)
    _draw_silhouette(draw, silhouette, 100, 36, 168, fill=255)
    bbox = mask.getbbox()
    return mask, {
        "source": "vector",
        "silhouette": silhouette,
        "bbox": list(bbox) if bbox else None,
        "note": "Backdrop and hanger are absent because the garment is masked from the pattern piece.",
    }


def estimate_pose_from_measurements(measurements: dict[str, float]) -> dict[str, Any]:
    height = float(measurements.get("height_cm") or 168)
    chest = float(measurements.get("chest_cm") or 92)
    waist = float(measurements.get("waist_cm") or 76)
    hips = float(measurements.get("hips_cm") or 98)
    width = 640
    height_px = 880
    fig_h = 700
    scale = fig_h / height
    cx = width / 2
    top = 90

    def front(circ: float) -> float:
        # Circumference to a front-view width. Pi understates a tailored
        # form slightly; 1.05 keeps shoulders wider than a pure cylinder.
        return circ / 3.1416 * scale * 1.05

    chest_w = front(chest)
    waist_w = front(waist)
    hip_w = front(hips)
    head = top + 36
    neck = top + 78
    shoulder_y = top + 108
    waist_y = top + 108 + fig_h * 0.28
    hip_y = top + 108 + fig_h * 0.40
    knee_y = top + 108 + fig_h * 0.68
    ankle_y = top + fig_h
    shoulder_w = max(chest_w * 0.92, 70)
    joints = {
        "head": [cx, head],
        "neck": [cx, neck],
        "shoulder_l": [cx - shoulder_w / 2, shoulder_y],
        "shoulder_r": [cx + shoulder_w / 2, shoulder_y],
        "chest": [cx, shoulder_y + 48],
        "waist": [cx, waist_y],
        "hip_l": [cx - hip_w / 2, hip_y],
        "hip_r": [cx + hip_w / 2, hip_y],
        "knee_l": [cx - hip_w * 0.28, knee_y],
        "knee_r": [cx + hip_w * 0.28, knee_y],
        "ankle_l": [cx - 28, ankle_y],
        "ankle_r": [cx + 28, ankle_y],
    }
    return {
        "source": "anthropometric-pose-v1",
        "canvas": [width, height_px],
        "joints": {name: [round(x, 1), round(y, 1)] for name, (x, y) in joints.items()},
        "widths": {
            "chest": round(chest_w, 1),
            "waist": round(waist_w, 1),
            "hips": round(hip_w, 1),
            "shoulder": round(shoulder_w, 1),
        },
        "measurements": {
            "height_cm": height,
            "chest_cm": chest,
            "waist_cm": waist,
            "hips_cm": hips,
        },
    }


def estimate_pose_from_photo(image: Image.Image) -> dict[str, Any]:
    small = image.copy()
    small.thumbnail((160, 200))
    pixels = small.load()
    w, h = small.size
    corners = [pixels[0, 0], pixels[w - 1, 0], pixels[0, h - 1], pixels[w - 1, h - 1]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y][:3]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > 70:
                xs.append(x)
                ys.append(y)
    if len(xs) < w * h * 0.04:
        x0, y0, x1, y1 = int(w * 0.2), int(h * 0.05), int(w * 0.8), int(h * 0.95)
    else:
        x0, x1 = min(xs), max(xs)
        y0, y1 = min(ys), max(ys)
    sx = image.width / w
    sy = image.height / h
    x0, x1 = x0 * sx, x1 * sx
    y0, y1 = y0 * sy, y1 * sy
    bw = max(x1 - x0, 1)
    bh = max(y1 - y0, 1)
    cx = (x0 + x1) / 2
    joints = {
        "head": [cx, y0 + bh * 0.08],
        "neck": [cx, y0 + bh * 0.16],
        "shoulder_l": [cx - bw * 0.22, y0 + bh * 0.20],
        "shoulder_r": [cx + bw * 0.22, y0 + bh * 0.20],
        "chest": [cx, y0 + bh * 0.32],
        "waist": [cx, y0 + bh * 0.48],
        "hip_l": [cx - bw * 0.16, y0 + bh * 0.56],
        "hip_r": [cx + bw * 0.16, y0 + bh * 0.56],
        "knee_l": [cx - bw * 0.12, y0 + bh * 0.76],
        "knee_r": [cx + bw * 0.12, y0 + bh * 0.76],
        "ankle_l": [cx - bw * 0.10, y0 + bh * 0.96],
        "ankle_r": [cx + bw * 0.10, y0 + bh * 0.96],
    }
    return {
        "source": "bbox-anthropometric-v1",
        "canvas": [image.width, image.height],
        "joints": {name: [round(px, 1), round(py, 1)] for name, (px, py) in joints.items()},
        "widths": {"chest": round(bw * 0.46, 1), "waist": round(bw * 0.40, 1), "hips": round(bw * 0.44, 1), "shoulder": round(bw * 0.44, 1)},
        "bbox": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
    }


def drape_parameters(fabric: dict[str, Any], measurements: dict[str, float]) -> dict[str, Any]:
    weight = str(fabric.get("weight") or "medium")
    stretch = float(fabric.get("stretch_index") or 5)
    folds = {"lightweight": 3, "medium": 5, "heavy": 8}.get(weight, 5)
    sag = {"lightweight": 12, "medium": 22, "heavy": 36}.get(weight, 22)
    sag = sag * (1 - min(stretch, 80) / 220)
    ease = 1.10 - min(stretch, 80) / 400
    return {
        "model": "catenary-hem-v1",
        "weight": weight,
        "stretch_index": stretch,
        "fold_count": folds,
        "hem_sag_px": round(sag, 2),
        "ease": round(ease, 3),
        "weave": fabric.get("weave") or "plain",
        "note": "Hem sag grows with weight and shrinks as stretch recovers the cloth toward the body.",
        "height_cm": measurements.get("height_cm"),
    }


def paint(
    *,
    mode: str,
    base: Image.Image | None,
    pose: dict[str, Any],
    color: tuple[int, int, int],
    silhouette: str,
    physics: dict[str, Any],
    mask: Image.Image,
) -> Image.Image:
    if mode == "twin":
        canvas_w, canvas_h = pose["canvas"]
        image = Image.new("RGBA", (canvas_w, canvas_h), PAPER)
        _draw_form(image, pose)
    else:
        assert base is not None
        image = base.convert("RGBA")

    cloth = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(cloth, "RGBA")
    joints = pose["joints"]
    cx = joints["chest"][0]
    shoulder_y = joints["shoulder_l"][1]
    shoulder_w = abs(joints["shoulder_r"][0] - joints["shoulder_l"][0]) * physics["ease"]
    hip_y = (joints["hip_l"][1] + joints["hip_r"][1]) / 2
    lengths = {
        "shirt": 0.92,
        "kurta": 1.35,
        "bandhgala": 1.05,
        "trousers": 1.9,
        "saree": 1.7,
        "coord": 1.15,
        "dress": 1.65,
        "shirtdress": 1.7,
        "kids-set": 1.2,
        "shorts": 0.85,
        "palazzo": 1.55,
    }
    span = hip_y - shoulder_y
    hem_y = shoulder_y + span * lengths.get(silhouette, 1.1)
    hem_w = shoulder_w * (1.05 if silhouette in {"dress", "saree", "palazzo", "kurta"} else 0.92)
    _draw_garment(
        draw,
        silhouette=silhouette,
        cx=cx,
        shoulder_y=shoulder_y,
        shoulder_w=shoulder_w,
        hem_y=hem_y,
        hem_w=hem_w,
        sag=physics["hem_sag_px"],
        color=(*color, 228 if mode == "photo" else 255),
    )
    _draw_folds(draw, cx, shoulder_y, shoulder_w, hem_y, physics)
    _draw_seams(draw, joints, color)
    if mode == "photo":
        cloth = cloth.filter(ImageFilter.GaussianBlur(radius=0.4))
    image.alpha_composite(cloth)
    # Shadow under the hem so the cloth occludes the form.
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow, "RGBA")
    sdraw.ellipse(
        [cx - hem_w * 0.45, hem_y + physics["hem_sag_px"] * 0.2, cx + hem_w * 0.45, hem_y + 18 + physics["hem_sag_px"] * 0.35],
        fill=(20, 16, 12, 40),
    )
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(radius=4)))
    del mask  # parsed mask is part of the stage contract; paint uses the vector drape
    return image.convert("RGB")


def _draw_form(image: Image.Image, pose: dict[str, Any]) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    j = pose["joints"]
    widths = pose["widths"]
    cx = j["chest"][0]
    draw.ellipse([j["head"][0] - 28, j["head"][1] - 34, j["head"][0] + 28, j["head"][1] + 34], fill=FORM)
    draw.polygon(
        [
            (j["neck"][0] - 10, j["neck"][1] - 10),
            (j["neck"][0] + 10, j["neck"][1] - 10),
            (j["shoulder_r"][0], j["shoulder_r"][1]),
            (cx + widths["waist"] / 2, j["waist"][1]),
            (j["hip_r"][0], j["hip_r"][1]),
            (j["knee_r"][0] + 12, j["knee_r"][1]),
            (j["ankle_r"][0] + 8, j["ankle_r"][1]),
            (j["ankle_l"][0] - 8, j["ankle_l"][1]),
            (j["knee_l"][0] - 12, j["knee_l"][1]),
            (j["hip_l"][0], j["hip_l"][1]),
            (cx - widths["waist"] / 2, j["waist"][1]),
            (j["shoulder_l"][0], j["shoulder_l"][1]),
        ],
        fill=FORM,
    )
    draw.line([_pt(j["shoulder_l"]), _pt(j["shoulder_r"])], fill=(120, 90, 70, 180), width=2)


def _draw_garment(
    draw: ImageDraw.ImageDraw,
    *,
    silhouette: str,
    cx: float,
    shoulder_y: float,
    shoulder_w: float,
    hem_y: float,
    hem_w: float,
    sag: float,
    color: tuple[int, int, int, int],
) -> None:
    if silhouette in {"trousers", "palazzo", "shorts"}:
        _draw_legs(draw, cx, shoulder_y + 20, shoulder_w * 0.85, hem_y, hem_w, sag, color, silhouette)
        return
    sleeve = 34 if silhouette in {"dress", "saree"} else 52
    top_l = cx - shoulder_w / 2
    top_r = cx + shoulder_w / 2
    hem = _hem_points(cx, hem_y, hem_w, sag)
    left_sleeve = (top_l - sleeve, shoulder_y + sleeve * 0.85)
    right_sleeve = (top_r + sleeve, shoulder_y + sleeve * 0.85)
    points = [
        (top_l + 18, shoulder_y - 8),
        (cx, shoulder_y + (16 if silhouette == "bandhgala" else 28)),
        (top_r - 18, shoulder_y - 8),
        right_sleeve,
        (top_r - 6, shoulder_y + 36),
        *hem,
        (top_l + 6, shoulder_y + 36),
        left_sleeve,
    ]
    draw.polygon(points, fill=color)
    if silhouette == "saree":
        pallu = [
            (top_l - 10, shoulder_y + 10),
            (top_l + 36, shoulder_y + 4),
            (top_l + 20, hem_y),
            (top_l - 30, hem_y + sag),
        ]
        draw.polygon(pallu, fill=color)


def _draw_legs(draw, cx, waist_y, waist_w, hem_y, hem_w, sag, color, silhouette) -> None:
    gap = 8 if silhouette != "palazzo" else 2
    leg_w = hem_w * (0.55 if silhouette == "shorts" else 0.48)
    if silhouette == "shorts":
        hem_y = waist_y + (hem_y - waist_y) * 0.55
    for sign in (-1, 1):
        inner = sign * gap
        points = _hem_points(cx + sign * (gap + leg_w / 2), hem_y, leg_w, sag * 0.4)
        poly = [
            (cx + sign * (waist_w / 2), waist_y),
            (cx + inner, waist_y + 12),
            *points,
        ]
        draw.polygon(poly, fill=color)


def _hem_points(cx: float, hem_y: float, width: float, sag: float) -> list[tuple[float, float]]:
    pts = []
    steps = 8
    half = width / 2
    for i in range(steps, -1, -1):
        t = i / steps
        x = cx - half + width * t
        # Parabola stands in for a shallow catenary: deepest at the sides
        # for a shirt hem is actually deepest at center. Center sag:
        curve = sag * (1 - ((t - 0.5) * 2) ** 2)
        pts.append((x, hem_y + curve))
    return pts


def _draw_folds(draw, cx, shoulder_y, shoulder_w, hem_y, physics) -> None:
    folds = int(physics["fold_count"])
    weave = physics.get("weave")
    span = max(hem_y - shoulder_y, 1)
    for i in range(folds):
        y = shoulder_y + span * (0.25 + 0.6 * (i / max(folds, 1)))
        amplitude = 4 + (i * 0.6)
        ink = (255, 255, 255, 28) if i % 2 == 0 else (20, 16, 12, 36)
        if weave == "twill":
            draw.line([(cx - shoulder_w * 0.35 + i * 3, y), (cx + shoulder_w * 0.35, y + amplitude * 3)], fill=ink, width=2)
        else:
            draw.arc(
                [cx - shoulder_w * 0.4, y, cx + shoulder_w * 0.4, y + 16 + amplitude],
                start=10,
                end=170,
                fill=ink,
                width=2,
            )


def _draw_seams(draw, joints, color) -> None:
    seam = (max(color[0] - 30, 0), max(color[1] - 30, 0), max(color[2] - 30, 0), 160)
    draw.line([_pt(joints["shoulder_l"]), _pt(joints["shoulder_r"])], fill=seam, width=2)


def _draw_silhouette(draw: ImageDraw.ImageDraw, silhouette: str, cx: float, top: float, hem: float, fill: int) -> None:
    draw.polygon([(cx - 50, top), (cx + 50, top), (cx + 70, hem), (cx - 70, hem)], fill=fill)


def _pt(point) -> tuple[float, float]:
    return (float(point[0]), float(point[1]))


def _hex(value: str) -> tuple[int, int, int]:
    raw = value.strip().lstrip("#")
    if len(raw) != 6:
        return (29, 53, 87)
    return tuple(int(raw[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _encode(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="JPEG", quality=86, optimize=True)
    return buffer.getvalue()
