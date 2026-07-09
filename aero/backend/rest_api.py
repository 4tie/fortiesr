"""Thin REST wrapper around AeRo MCP so the frontend can call HTTP.

Run:
    python rest_api.py

Then browse http://127.0.0.1:5177/  (or whatever PORT you set).
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

MCP_DIR = Path(__file__).resolve().parent
if str(MCP_DIR) not in sys.path:
    sys.path.insert(0, str(MCP_DIR))

from mcp_server import TOOLS, _HANDLERS  # noqa: E402
from config import AERO_PORT, FORTIESR_API_URL  # noqa: E402

app = FastAPI(title="AeRo REST Bridge", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_TOOL_NAMES = sorted(t["name"] for t in TOOLS)


class ToolCallRequest(BaseModel):
    tool: str = Field(description="One of: " + ", ".join(_TOOL_NAMES))
    arguments: dict[str, Any] = Field(default_factory=dict)


class RunStreamRequest(BaseModel):
    strategy_name: str
    timerange: str
    pairs: list[str] | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "fortiesr": FORTIESR_API_URL}


@app.get("/tools")
def list_tools() -> dict[str, Any]:
    return {"tools": TOOLS}


@app.post("/tools/call")
async def call_tool(req: ToolCallRequest) -> JSONResponse:
    if req.tool not in _HANDLERS:
        return JSONResponse({"error": f"Unknown tool: {req.tool}"}, status_code=404)
    try:
        text = await _HANDLERS[req.tool](req.arguments)
        payload = json.loads(text)
        return JSONResponse(payload)
    except Exception as exc:  # pylint: disable=broad-except
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.post("/run/stream")
async def run_stream(req: RunStreamRequest) -> JSONResponse:
    """Fire-and-forget wrapper that starts a backtest, then polls results."""

    # Import lazily to keep startup fast.
    from fortiesr_client import get_run_results, get_run_status, run_backtest  # noqa: E402

    if req.strategy_name:
        raise JSONResponse({"error": "strategy_name is required"}, status_code=400)

    launch = await run_backtest(req.strategy_name, req.timerange, req.pairs)
    run_id = launch.get("run_id") or launch.get("id")
    if not run_id:
        return JSONResponse(launch)

    steps: list[dict[str, Any]] = [{"step": "launch", "data": launch}]

    for _ in range(60):
        status = await get_run_status(run_id)
        steps.append({"step": "status", "data": status})
        state = (status.get("status") or "").lower() if isinstance(status, dict) else ""
        if state in {"done", "completed", "finished", "failed"}:
            results = await get_run_results(run_id)
            steps.append({"step": "results", "data": results})
            return JSONResponse({"run_id": run_id, "steps": steps})
        await asyncio.sleep(2)

    return JSONResponse({"run_id": run_id, "steps": steps, "timeout": True})
