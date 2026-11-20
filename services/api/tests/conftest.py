import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VISION = ROOT.parent / "vision"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(VISION))
os.environ["SCV_EAGER"] = "0"
os.environ["SCV_DEMO"] = "1"
os.environ.setdefault("SCV_SECRET", "test-secret")
