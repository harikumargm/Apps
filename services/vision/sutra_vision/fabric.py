"""Heuristic fabric reading.

A photograph cannot see a mill's blend ratio. This adapter measures what
the image does contain: thread direction, texture energy, and sheen.
Fibre percentages are a scored hypothesis, returned with a confidence so
the shop can keep mill specifications as the composition of record.

Set SUTRA_FABRIC_ENGINE=tensorrt to require the GPU classifier. This
build fails closed in that mode instead of pretending the heuristic is
TensorRT.
"""

from __future__ import annotations

import io
import os
from typing import Any

import numpy as np
from PIL import Image, ImageOps

ENGINE_NAME = "heuristic-cv-v1"


class EngineNotMounted(RuntimeError):
    pass


def active_engine_name() -> str:
    name = os.getenv("SUTRA_FABRIC_ENGINE", ENGINE_NAME)
    if name == "tensorrt":
        raise EngineNotMounted(
            "TensorRT fabric classifier is not mounted on this host. "
            "Install the GPU runtime and weights, or use heuristic-cv-v1."
        )
    if name != ENGINE_NAME:
        raise EngineNotMounted(f"Unknown fabric engine '{name}'.")
    return name


def analyze_image(data: bytes) -> dict[str, Any]:
    engine = active_engine_name()
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    image.thumbnail((256, 256))
    arr = np.asarray(image).astype(np.float32) / 255.0
    gray = arr.mean(axis=2)
    gx, gy, diag, antidiag = _gradients(gray)
    texture = float(gray.std())
    ortho = (gx + gy) / 2
    diagonal = max(diag, antidiag)
    sheen = _sheen(arr, gray)
    weave = _weave(gx, gy, diag, antidiag, texture)
    weight = _weight(texture, weave)
    fibers = _fibers(weave, texture, sheen)
    stretch = _stretch(weave, texture, fibers)
    confidence = _confidence(fibers, texture)
    primary = fibers[0]["fiber"]
    return {
        "engine": engine,
        "fabric_type": _fabric_type(fibers),
        "composition": fibers,
        "weave": weave,
        "weight": weight,
        "gsm_range": _gsm_range(weight),
        "stretch_index": stretch,
        "elasticity": _elasticity_word(stretch),
        "care": _care(primary, weight),
        "confidence": round(confidence, 3),
        "signals": {
            "texture_std": round(texture, 4),
            "gradient_x": round(gx, 4),
            "gradient_y": round(gy, 4),
            "diagonal": round(diagonal, 4),
            "orthogonal": round(ortho, 4),
            "sheen": round(sheen, 4),
        },
        "disclaimer": (
            "Heuristic computer-vision reading of weave, texture, and sheen. "
            "Fibre percentages are an estimate, not a lab assay. "
            "A TensorRT classifier can replace this adapter without an API change."
        ),
    }


def _gradients(gray: np.ndarray) -> tuple[float, float, float, float]:
    gx = float(np.abs(np.diff(gray, axis=1)).mean())
    gy = float(np.abs(np.diff(gray, axis=0)).mean())
    diag = float(np.abs(gray[1:, 1:] - gray[:-1, :-1]).mean())
    antidiag = float(np.abs(gray[1:, :-1] - gray[:-1, 1:]).mean())
    return gx, gy, diag, antidiag


def _sheen(arr: np.ndarray, gray: np.ndarray) -> float:
    # Highlights that depart from the local mean read as satin shine.
    blur = _box_mean(gray)
    peaks = np.clip(gray - blur, 0, None)
    saturation = arr.max(axis=2) - arr.min(axis=2)
    return float(peaks.mean() * 4 + (1 - saturation.mean()) * 0.15)


def _box_mean(gray: np.ndarray) -> np.ndarray:
    # 5-tap separable box, edges repeated.
    pad = np.pad(gray, 2, mode="edge")
    acc = np.zeros_like(gray)
    for dy in range(5):
        for dx in range(5):
            acc += pad[dy : dy + gray.shape[0], dx : dx + gray.shape[1]]
    return acc / 25.0


def _weave(gx: float, gy: float, diag: float, antidiag: float, texture: float) -> str:
    ortho = (gx + gy) / 2 + 1e-6
    diagonal = max(diag, antidiag)
    diagonal_bias = abs(diag - antidiag) / ortho
    if diagonal > ortho * 1.08 and diagonal_bias > 0.18:
        return "twill"
    if ortho < 0.035 and texture < 0.09:
        return "satin"
    if gx > 0.04 and gy > 0.04 and abs(gx - gy) / max(gx, gy) < 0.45:
        return "plain"
    if texture < 0.07:
        return "satin"
    return "plain"


def _weight(texture: float, weave: str) -> str:
    if texture > 0.2:
        return "heavy"
    if texture < 0.07 or (weave == "satin" and texture < 0.12):
        return "lightweight"
    return "medium"


def _fibers(weave: str, texture: float, sheen: float) -> list[dict[str, int | str]]:
    silk = sheen * (1.4 if weave == "satin" else 0.35) + (0.15 if weave == "satin" else 0)
    linen = texture * (1.6 if weave != "satin" else 0.4)
    cotton = 1 - min(abs(texture - 0.12) * 4, 0.95)
    synthetic = max(0.0, 0.55 - texture) + (0.2 if weave == "plain" and texture < 0.08 else 0)
    scores = {
        "Silk": max(silk, 0.01),
        "Linen": max(linen, 0.01),
        "Cotton": max(cotton, 0.01),
        "Synthetic": max(synthetic, 0.01),
    }
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    top = ranked[:2] if ranked[1][1] > ranked[0][1] * 0.45 else ranked[:1]
    total = sum(score for _, score in top)
    raw = [(name, score / total * 100) for name, score in top]
    percents = [int(round(value)) for _, value in raw]
    drift = 100 - sum(percents)
    percents[0] += drift
    rows: list[dict[str, int | str]] = []
    for (name, _), percent in zip(top, percents):
        if percent <= 0:
            continue
        fiber = "Polyester" if name == "Synthetic" else name
        rows.append({"fiber": fiber, "percent": int(percent)})
    if not rows:
        rows = [{"fiber": "Cotton", "percent": 100}]
    return rows


def _fabric_type(fibers: list[dict[str, Any]]) -> str:
    names = {row["fiber"] for row in fibers}
    if len(fibers) > 1 and ("Polyester" in names or "Viscose" in names):
        return "Synthetic blend"
    primary = str(fibers[0]["fiber"])
    if primary == "Polyester":
        return "Synthetic blend"
    return primary


def _stretch(weave: str, texture: float, fibers: list[dict[str, Any]]) -> int:
    synthetic = 0
    for row in fibers:
        if row["fiber"] in {"Polyester", "Viscose"}:
            synthetic = int(row["percent"])
    base = 8 if weave == "satin" else 5
    value = base + synthetic * 0.35 + max(0.0, 0.12 - texture) * 40
    return int(max(0, min(100, round(value))))


def _confidence(fibers: list[dict[str, Any]], texture: float) -> float:
    lead = int(fibers[0]["percent"]) / 100
    # Peaked scores and a mid texture are easier to read than flat noise.
    texture_term = 1 - min(abs(texture - 0.1) * 3, 0.4)
    return max(0.35, min(0.86, 0.42 + lead * 0.35 + texture_term * 0.1))


def _gsm_range(weight: str) -> list[int]:
    return {"lightweight": [80, 140], "medium": [140, 220], "heavy": [220, 340]}[weight]


def _elasticity_word(stretch: int) -> str:
    if stretch < 12:
        return "low"
    if stretch < 28:
        return "moderate"
    return "high"


def _care(primary: str, weight: str) -> list[str]:
    table = {
        "Silk": ["Dry clean", "Cool iron on the reverse", "Store out of direct sun"],
        "Linen": ["Gentle machine wash", "Expect a soft crease", "Iron while damp"],
        "Cotton": ["Machine wash cold", "Hang dry", "Warm iron"],
        "Polyester": ["Machine wash cold", "Low tumble", "Skip high heat"],
        "Viscose": ["Gentle machine wash", "Hang dry", "Low iron on the reverse"],
    }
    care = list(table.get(primary, table["Cotton"]))
    if weight == "heavy":
        care.append("Dry flat if the garment is heavy when wet")
    return care
