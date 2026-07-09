"""Thin HTTP client to talk to the running FortiesR backend.

AeRo MCP tools should call these helpers instead of importing
FortiesR internals.  That keeps AeRo isolated and lets FortiesR
evolve without breaking AeRo.
"""

from __future__ import annotations

import httpx
from config import FORTIESR_API_URL


def _url(path: str) -> str:
    return f"{FORTIESR_API_URL}{path}"


async def get_strategies() -> list[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(_url("/api/strategies"), timeout=15)
        r.raise_for_status()
        data = r.json()
        return data.get("strategies", data) if isinstance(data, dict) else data


async def get_strategy_content(name: str) -> str:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            _url("/api/strategies") + f"/{name}/content",
            timeout=15,
        )
        r.raise_for_status()
        return r.json().get("content", "")


async def run_backtest(
    strategy_name: str,
    timerange: str,
    pairs: list[str] | None = None,
    **kwargs,
) -> dict:
    payload = {
        "strategy_name": strategy_name,
        "timerange": timerange,
        "pairs": pairs or [],
        **kwargs,
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(
            _url("/api/backtest/run"),
            json=payload,
            timeout=15,
        )
        if r.status_code == 429:
            return {"error": "Rate limited — wait a minute and retry."}
        r.raise_for_status()
        return r.json()


async def get_run_status(run_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(_url("/api/backtest/status") + f"/{run_id}", timeout=15)
        r.raise_for_status()
        return r.json()


async def get_run_results(run_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(_url("/api/backtest/results") + f"/{run_id}", timeout=15)
        r.raise_for_status()
        return r.json()


async def get_run_detail(run_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(_url("/api/results") + f"/{run_id}", timeout=15)
        if r.status_code == 404:
            r = await client.get(_url("/api/backtest/results") + f"/{run_id}", timeout=15)
        r.raise_for_status()
        return r.json()


async def get_candidate_evaluation(run_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            _url("/api/candidate/evaluate") + f"/{run_id}",
            timeout=15,
        )
        if r.status_code == 404:
            return {}
        r.raise_for_status()
        return r.json()
