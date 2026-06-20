"""Router: GET /api/system/health

Performs an active, multi-point diagnostic of the runtime environment:
  1. freqtrade CLI — is it reachable and does `--version` succeed?
  2. Critical directories — data/, data/backups/, user_data/strategies/
     all exist AND are writable.

Returns a structured JSON payload and a terminal-style log block.
"""

from __future__ import annotations

import asyncio
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/system", tags=["System"])


def _check_freqtrade(executable: str) -> dict[str, Any]:
    """Run `freqtrade --version` and report the result."""
    import subprocess

    resolved = shutil.which(executable) or executable
    entry: dict[str, Any] = {
        "check": "freqtrade_cli",
        "label": "Freqtrade CLI",
        "executable": resolved,
        "ok": False,
        "detail": "",
    }
    if not (shutil.which(executable) or Path(executable).is_file()):
        entry["detail"] = f"Executable not found: '{executable}'"
        return entry
    try:
        proc = subprocess.run(
            [executable, "--version"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if proc.returncode == 0:
            version_line = (proc.stdout + proc.stderr).strip().splitlines()[0]
            entry["ok"] = True
            entry["detail"] = version_line
        else:
            entry["detail"] = (
                f"Exit code {proc.returncode}: "
                + (proc.stderr or proc.stdout).strip()[:200]
            )
    except FileNotFoundError:
        entry["detail"] = f"Executable not found at path '{executable}'"
    except subprocess.TimeoutExpired:
        entry["detail"] = "Timed out after 15 s"
    except Exception as exc:
        entry["detail"] = f"Unexpected error: {exc}"
    return entry


def _check_directory(label: str, path: Path) -> dict[str, Any]:
    """Verify a directory exists and is writable."""
    entry: dict[str, Any] = {
        "check": "directory",
        "label": label,
        "path": str(path),
        "ok": False,
        "detail": "",
    }
    if not path.exists():
        entry["detail"] = "Does not exist"
        return entry
    if not path.is_dir():
        entry["detail"] = "Path exists but is not a directory"
        return entry
    try:
        with tempfile.NamedTemporaryFile(dir=path, delete=True):
            pass
        entry["ok"] = True
        entry["detail"] = "Exists and writable"
    except OSError as exc:
        entry["detail"] = f"Not writable: {exc}"
    return entry


def _build_log(results: list[dict[str, Any]], elapsed_ms: int) -> str:
    """Render a terminal-style log string from check results."""
    lines = [
        "── Strategy Lab System Health Check ──────────────────────────────────",
        "",
    ]
    for r in results:
        icon = "✓" if r["ok"] else "✗"
        label = r["label"]
        detail = r.get("detail", "")
        path_or_exe = r.get("path") or r.get("executable") or ""
        if path_or_exe:
            lines.append(f"  {icon}  {label}  [{path_or_exe}]")
        else:
            lines.append(f"  {icon}  {label}")
        if detail:
            lines.append(f"       {detail}")
        lines.append("")
    overall = all(r["ok"] for r in results)
    status_word = "PASS" if overall else "FAIL"
    lines += [
        "──────────────────────────────────────────────────────────────────────",
        f"  Overall: {status_word}  (completed in {elapsed_ms} ms)",
        "──────────────────────────────────────────────────────────────────────",
    ]
    return "\n".join(lines)


@router.get(
    "/health",
    summary="Active system diagnostic",
    description=(
        "Checks freqtrade CLI availability and critical directory writability. "
        "Returns a structured JSON payload and a terminal-style log block."
    ),
)
async def system_health(request: Request) -> JSONResponse:
    t_start = time.monotonic()
    services = request.app.state.services
    settings = services.settings_store.load()

    root_dir = Path(services.root_dir)

    checks: list[dict[str, Any]] = []

    ft_result = await asyncio.to_thread(
        _check_freqtrade, settings.freqtrade_executable_path
    )
    checks.append(ft_result)

    dir_checks = [
        ("data/", root_dir / "data"),
        ("data/backups/", root_dir / "data" / "backups"),
        ("user_data/strategies/", Path(settings.strategies_directory_path)),
        ("user_data/", Path(settings.user_data_directory_path)),
    ]
    for label, path in dir_checks:
        checks.append(await asyncio.to_thread(_check_directory, label, path))

    elapsed_ms = round((time.monotonic() - t_start) * 1000)
    overall_ok = all(c["ok"] for c in checks)
    log_output = _build_log(checks, elapsed_ms)

    return JSONResponse(
        status_code=200 if overall_ok else 207,
        content={
            "ok": overall_ok,
            "elapsed_ms": elapsed_ms,
            "checks": checks,
            "log": log_output,
        },
    )
