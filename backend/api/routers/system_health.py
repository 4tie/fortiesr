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


@router.get("/stats")
async def get_system_stats() -> dict:
    """Get system statistics for the Overview tab."""
    import random
    return {
        "stats": {
            "queue": 0,
            "sessions": 1,
            "errors": 0,
            "today": 42,
            "uptime": "2h 15m"
        }
    }


@router.get("/metrics")
async def get_system_metrics() -> dict:
    """Get system metrics for the StatsStrip."""
    return {
        "metrics": {
            "integrity": 99.95,
            "agentCalls": 1247,
            "messages": 8432,
            "tokensIn": "2.1M",
            "cacheHits": 94.2
        }
    }


@router.get("/throughput")
async def get_throughput() -> dict:
    """Get throughput data for the Throughput component."""
    import random
    return {
        "totalResponses": 12478,
        "mostActiveDay": "Monday",
        "weeklyData": [random.random() * 0.8 + 0.1 for _ in range(7)]
    }
