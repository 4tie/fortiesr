"""Strategy file I/O with original-file safety.

AeRo never writes into the uploaded original.  All edits happen on a
working copy under `aero/uploads/<name>.working.py`.
"""

from __future__ import annotations

import difflib
import hashlib
import shutil
from pathlib import Path

from config import AERO_UPLOADS_DIR

# One trailing newline guards against diff noise.
_STOP = object()


def _original_path(name: str) -> Path:
    safe = Path(name).name.replace("/", "_")
    return AERO_UPLOADS_DIR / f"{safe}.orig.py"


def _working_path(name: str) -> Path:
    safe = Path(name).name.replace("/", "_")
    return AERO_UPLOADS_DIR / f"{safe}.working.py"


def init_strategy(name: str, source: str) -> dict[str, Any]:
    orig = _original_path(name)
    work = _working_path(name)
    text = source.rstrip("\n") + "\n"
    orig.write_text(text, encoding="utf-8")
    work.write_text(text, encoding="utf-8")
    return {"status": "ok", "original": str(orig), "working": str(work)}


def read_strategy(name: str) -> str:
    path = _working_path(name)
    if not path.exists():
        raise FileNotFoundError(f"Strategy {name!r} not found in {AERO_UPLOADS_DIR}")
    return path.read_text(encoding="utf-8")


def write_strategy(name: str, source: str) -> dict[str, str]:
    path = _working_path(name)
    if not path.exists():
        raise FileNotFoundError(f"Strategy {name!r} not found. Call aero.apply_edit or init first.")
    path.write_text(source.rstrip("\n") + "\n", encoding="utf-8")
    return {"status": "ok", "path": str(path)}


def preview_edit(name: str, old_text: str, new_text: str) -> dict[str, Any]:
    current = read_strategy(name)
    if old_text not in current:
        raise ValueError("old_text not found in strategy – check exact indentation/spaces.")
    diff = list(
        difflib.unified_diff(
            current.splitlines(),
            (current.replace(old_text, new_text)).splitlines(),
            fromfile="current",
            tofile="proposed",
            lineterm="",
        )
    )
    return {"status": "preview", "diff": "\n".join(diff)}


def apply_edit(name: str, old_text: str, new_text: str) -> dict[str, Any]:
    current = read_strategy(name)
    if old_text not in current:
        raise ValueError("old_text not found in strategy – check exact indentation/spaces.")
    updated = current.replace(old_text, new_text, 1)

    before_hash = hashlib.sha256(current.encode("utf-8")).hexdigest()[:12]
    after_hash = hashlib.sha256(updated.encode("utf-8")).hexdigest()[:12]

    diff = list(
        difflib.unified_diff(
            current.splitlines(),
            updated.splitlines(),
            fromfile="before",
            tofile="after",
            lineterm="",
        )
    )
    write_strategy(name, updated)
    return {"status": "applied", "diff": "\n".join(diff), "before_hash": before_hash, "after_hash": after_hash}


def diff_strategies(name: str) -> dict[str, Any]:
    orig = _original_path(name)
    work = _working_path(name)
    if not orig.exists() or not work.exists():
        return {"error": f"No saved original/working copy for {name}"}
    before = orig.read_text(encoding="utf-8").splitlines()
    after = work.read_text(encoding="utf-8").splitlines()
    diff = list(difflib.unified_diff(before, after, fromfile=f"{name}.orig", tofile=f"{name}.working", lineterm=""))
    return {"status": "diff", "diff": "\n".join(diff)}
