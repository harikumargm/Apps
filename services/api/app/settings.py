from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _find_catalog() -> Path:
    override = os.getenv("CATALOG_PATH")
    if override:
        return Path(override)
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "data" / "catalog.json"
        if candidate.exists():
            return candidate
    raise FileNotFoundError("data/catalog.json was not found")


@dataclass(frozen=True)
class Settings:
    db_url: str
    redis_url: str
    vision_url: str
    secret: str
    demo: bool
    admin_token: str
    google_client_id: str
    apple_client_id: str
    catalog_path: Path
    media_dir: Path
    inference_tmp: Path

    @classmethod
    def load(cls) -> "Settings":
        root = Path(__file__).resolve().parents[1]
        media = Path(os.getenv("SCV_MEDIA_DIR", str(root / "var" / "profile_media")))
        inference = Path(os.getenv("SCV_INFERENCE_TMP", "/tmp/scv-inference"))
        return cls(
            db_url=os.getenv("DATABASE_URL", f"sqlite:///{root / 'var' / 'scv.db'}"),
            redis_url=os.getenv("REDIS_URL", ""),
            vision_url=os.getenv("VISION_URL", "").rstrip("/"),
            secret=os.getenv("SCV_SECRET", "scv-dev-secret-change-me"),
            demo=os.getenv("SCV_DEMO", "1") == "1",
            admin_token=os.getenv("SCV_ADMIN_TOKEN", "scv-admin-dev"),
            google_client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
            apple_client_id=os.getenv("APPLE_CLIENT_ID", ""),
            catalog_path=_find_catalog(),
            media_dir=media,
            inference_tmp=inference,
        )
