"""Standalone vision microservice.

The API gateway calls this over HTTP when VISION_URL is set. Without that
variable the gateway imports these modules in-process.
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sutra_vision.fabric import EngineNotMounted as FabricMissing
from sutra_vision.fabric import analyze_image
from sutra_vision.privacy import InferenceScratch
from sutra_vision.tryon import EngineNotMounted as TryOnMissing
from sutra_vision.tryon import render_tryon

app = FastAPI(title="Sutra Vision", version="1.0.0")
scratch = InferenceScratch()


class TwinBody(BaseModel):
    silhouette: str = "shirt"
    color_hex: str = "#1d3557"
    fabric: dict = Field(default_factory=dict)
    height_cm: float = 168
    chest_cm: float = 92
    waist_cm: float = 76
    hips_cm: float = 98
    consent: bool = False


def _public(result: dict) -> dict:
    encoded = base64.b64encode(result.pop("image_bytes")).decode()
    result["image_base64"] = encoded
    result["privacy"] = {
        "inference_retained": False,
        "purge_within_hours": 24,
        "used_for_training": False,
    }
    return result


@app.get("/health")
def health() -> dict:
    removed = scratch.purge()
    return {"status": "ok", "service": "vision", "purged": removed}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> dict:
    scratch.purge()
    data = await file.read()
    if not data:
        raise HTTPException(400, "Upload a cloth photograph.")
    spilled = scratch.spill(data, ".img")
    try:
        return analyze_image(data)
    except FabricMissing as exc:
        raise HTTPException(503, str(exc)) from exc
    finally:
        scratch.release(spilled)


@app.post("/tryon/twin")
def tryon_twin(body: TwinBody) -> dict:
    scratch.purge()
    if not body.consent:
        raise HTTPException(400, "Body imagery needs explicit consent before processing.")
    try:
        result = render_tryon(
            silhouette=body.silhouette,
            color_hex=body.color_hex,
            fabric=body.fabric,
            measurements={
                "height_cm": body.height_cm,
                "chest_cm": body.chest_cm,
                "waist_cm": body.waist_cm,
                "hips_cm": body.hips_cm,
            },
        )
    except TryOnMissing as exc:
        raise HTTPException(503, str(exc)) from exc
    return _public(result)


@app.post("/tryon/photo")
async def tryon_photo(
    photo: UploadFile = File(...),
    silhouette: str = Form("shirt"),
    color_hex: str = Form("#1d3557"),
    height_cm: float = Form(168),
    chest_cm: float = Form(92),
    waist_cm: float = Form(76),
    hips_cm: float = Form(98),
    consent: bool = Form(False),
    weight: str = Form("medium"),
    stretch_index: float = Form(5),
    weave: str = Form("plain"),
) -> dict:
    scratch.purge()
    if not consent:
        raise HTTPException(400, "Body imagery needs explicit consent before processing.")
    data = await photo.read()
    spilled = scratch.spill(data, ".img")
    try:
        result = render_tryon(
            silhouette=silhouette,
            color_hex=color_hex,
            fabric={"weight": weight, "stretch_index": stretch_index, "weave": weave},
            measurements={
                "height_cm": height_cm,
                "chest_cm": chest_cm,
                "waist_cm": waist_cm,
                "hips_cm": hips_cm,
            },
            photo=data,
        )
    except TryOnMissing as exc:
        raise HTTPException(503, str(exc)) from exc
    finally:
        scratch.release(spilled)
    return _public(result)
