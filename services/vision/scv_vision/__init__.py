"""Sai Cotton Vastram Store vision adapters.

Default engines run on CPU. GPU classifiers and diffusion try-on mount
through SCV_FABRIC_ENGINE and SCV_TRYON_ENGINE and fail closed until
their weights are present.
"""

from scv_vision.fabric import analyze_image
from scv_vision.tryon import render_tryon

__all__ = ["analyze_image", "render_tryon"]
