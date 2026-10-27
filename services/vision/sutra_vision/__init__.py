"""Sutra vision adapters.

Default engines run on CPU. GPU classifiers and diffusion try-on mount
through SUTRA_FABRIC_ENGINE and SUTRA_TRYON_ENGINE and fail closed until
their weights are present.
"""

from sutra_vision.fabric import analyze_image
from sutra_vision.tryon import render_tryon

__all__ = ["analyze_image", "render_tryon"]
