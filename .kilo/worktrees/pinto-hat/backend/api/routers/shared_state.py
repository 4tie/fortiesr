"""Router: GET /api/shared-state  &  POST /api/shared-state

Simple JSON-backed shared state used by the frontend to persist the
Backtesting Tab form values between sessions.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, field_validator

from ...utils import atomic_write_json, read_json

router = APIRouter(prefix="/api/shared-state", tags=["Shared State"])

# ── Pydantic models ────────────────────────────────────────────────────────────


class SharedStatePayload(BaseModel):
    strategy_name: str | None = Field(default=None)
    timeframe: str | None = Field(default=None)
    timerange: str | None = Field(default=None)
    start_date: str | None = Field(default=None)
    end_date: str | None = Field(default=None)
    pairs: list[str] | None = Field(default=None)
    max_open_trades: int | None = Field(default=None)
    dry_run_wallet: float | None = Field(default=None)

    @field_validator("pairs", mode="before")
    @classmethod
    def validate_pairs(cls, v: Any) -> list[str] | None:
        if v is None:
            return None
        if isinstance(v, str):
            items = v.split(",")
        elif isinstance(v, list):
            items = v
        else:
            raise ValueError("pairs must be a list or comma-separated string.")
        cleaned = [str(item).strip().upper() for item in items if str(item).strip()]
        return cleaned or None


# ── Helpers ──────────────────────────────────────────────────────────────────


def _state_file_path(request: Request) -> Path:
    root_dir: Path = Path(request.app.state.services.root_dir)
    state_dir = root_dir / "user_data"
    state_dir.mkdir(parents=True, exist_ok=True)
    return state_dir / "frontend_shared_state.json"


def _load_state(path: Path) -> dict[str, Any]:
    raw = read_json(path)
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    return {}


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.get(
    "",
    summary="Get shared state",
    description="Returns the current persisted shared state for the Backtesting Tab.",
)
async def get_shared_state(request: Request) -> dict[str, Any]:
    path = _state_file_path(request)
    return _load_state(path)


@router.post(
    "",
    summary="Update shared state",
    description=(
        "Partially or fully replaces the persisted shared state. "
        "Any fields you supply overwrite existing values; omitted fields stay unchanged."
    ),
)
async def update_shared_state(
    body: SharedStatePayload,
    request: Request,
) -> dict[str, Any]:
    path = _state_file_path(request)
    state = _load_state(path)
    payload = body.model_dump(mode="json", exclude_none=True)
    state.update(payload)
    atomic_write_json(path, state)
    return state
