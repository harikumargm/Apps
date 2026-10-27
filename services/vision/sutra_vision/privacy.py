"""Scratch space for inference uploads.

Body photos are written only when a stage must spill to disk. Each file is
removed when the request finishes. A sweeper deletes anything older than
24 hours so a crash cannot leave imagery on the inference host.
"""

from __future__ import annotations

import os
import time
import uuid
from pathlib import Path

RETENTION_HOURS = 24


class InferenceScratch:
    def __init__(self, root: Path | None = None) -> None:
        env = os.getenv("SUTRA_INFERENCE_TMP")
        self.root = Path(root or env or "/tmp/sutra-inference")
        self.root.mkdir(parents=True, exist_ok=True)

    def spill(self, data: bytes, suffix: str = ".bin") -> Path:
        path = self.root / f"{uuid.uuid4().hex}{suffix}"
        path.write_bytes(data)
        return path

    def release(self, path: Path | None) -> None:
        if path is None:
            return
        try:
            path.unlink(missing_ok=True)
        except OSError:
            return

    def purge(self, max_age_hours: float = RETENTION_HOURS, now: float | None = None) -> int:
        stamp = time.time() if now is None else now
        removed = 0
        if not self.root.exists():
            return 0
        for path in self.root.iterdir():
            if not path.is_file():
                continue
            age_hours = (stamp - path.stat().st_mtime) / 3600
            if age_hours >= max_age_hours:
                path.unlink(missing_ok=True)
                removed += 1
        return removed
