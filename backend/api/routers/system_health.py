"""Router: GET /api/system/health

Performs an active, multi-point diagnostic of the runtime environment:
  1. freqtrade CLI — is it reachable and does `--version` succeed?
  2. Critical directories — data/, data/backups/, user_data/strategies/
     all exist AND are writable.

Returns a structured JSON payload and a terminal-style log block.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from ...app_services import AppServices
from ...services.system import api_service as system_api
from ..dependencies import get_services

router = APIRouter(prefix="/api/system", tags=["System"])

_check_freqtrade = system_api.check_freqtrade
_check_directory = system_api.check_directory
_build_log = system_api.build_log
_collect_health = system_api.collect_health


@router.get(
    "/health",
    summary="Active system diagnostic",
    description=(
        "Checks freqtrade CLI availability and critical directory writability. "
        "Returns a structured JSON payload and a terminal-style log block."
    ),
)
async def system_health(
    services: AppServices = Depends(get_services),
) -> JSONResponse:
    settings = services.settings_store.load()
    root_dir = Path(services.root_dir)
    payload = await _collect_health(settings, root_dir)

    return JSONResponse(
        status_code=200 if payload["ok"] else 207,
        content=payload,
    )
