"""Router: /api/strategy/pair-explorer  &  /api/strategy/add-pair

POST /api/strategy/pair-explorer       — kick off a parallel multi-pair exploration
GET  /api/strategy/pair-explorer       — list all past exploration sessions
GET  /api/strategy/pair-explorer/{id}  — poll progress + results for a session
POST /api/strategy/add-pair            — append a pair to the strategy's config
"""

from __future__ import annotations

import asyncio
import json
import tempfile
import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field

from ...models import DownloadDataRequest
from ...services.execution.data_download_runner import DataDownloadRunner

router = APIRouter(prefix="/api/strategy", tags=["Pair Explorer"])

# ── in-memory session store ────────────────────────────────────────────────────
_SESSIONS: dict[str, dict[str, Any]] = {}

# ── one download at a time across all concurrent pair tasks ───────────────────
_DOWNLOAD_LOCK = asyncio.Lock()


# ── Pydantic models ─────────────────────────────────────────────────────────────

class PairExplorerRequest(BaseModel):
    strategy_name: str = Field(..., description="Strategy to backtest")
    pairs: list[str] = Field(..., min_length=1, description="Pairs to explore")
    timeframe: str = Field("1h")
    timerange: str = Field(..., description="Freqtrade timerange string e.g. 20230101-20240101")
    dry_run_wallet: float = Field(default=1000.0)
    max_open_trades: int = Field(default=1, ge=1, description="Group size: pairs run together in one backtest")


class AddPairRequest(BaseModel):
    strategy_name: str = Field(..., description="Strategy whose config to update")
    pair: str = Field(..., description="Pair to add to pair_whitelist")


# ── disk persistence ───────────────────────────────────────────────────────────

def _sessions_dir(user_data_dir: str) -> Path:
    d = Path(user_data_dir) / "pair_explorer_sessions"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _save_session(session: dict[str, Any], user_data_dir: str) -> None:
    try:
        target = _sessions_dir(user_data_dir) / f"{session['session_id']}.json"
        tmp = target.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(session, indent=2), encoding="utf-8")
        tmp.replace(target)
    except Exception:
        pass


def _load_all_sessions(user_data_dir: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    try:
        for f in sorted(_sessions_dir(user_data_dir).glob("*.json")):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                sid = data.get("session_id")
                if sid:
                    result[sid] = data
            except Exception:
                pass
    except Exception:
        pass
    return result


# ── data helpers ───────────────────────────────────────────────────────────────

def _data_file_exists(user_data_dir: str, exchange: str, pair: str, timeframe: str) -> bool:
    pair_file = pair.replace("/", "_")
    data_dir = Path(user_data_dir) / "data" / exchange.lower()
    for ext in ("feather", "json", "jsongz", "parquet"):
        if (data_dir / f"{pair_file}-{timeframe}.{ext}").exists():
            return True
    return False


async def _ensure_data(
    runner: DataDownloadRunner,
    pair: str,
    timeframe: str,
    timerange: str,
    config_file: str,
    user_data_dir: str,
    exchange: str,
) -> str | None:
    """Download data for *pair* if not already present. Returns None on success, error string on failure."""
    if _data_file_exists(user_data_dir, exchange, pair, timeframe):
        return None

    async with _DOWNLOAD_LOCK:
        if _data_file_exists(user_data_dir, exchange, pair, timeframe):
            return None
        request = DownloadDataRequest(
            config_file=config_file,
            timerange=timerange,
            timeframes=[timeframe],
            pairs=[pair],
        )
        try:
            await asyncio.to_thread(runner.run_download, request)
            return None
        except Exception as exc:
            return str(exc)


# ── result parsing ─────────────────────────────────────────────────────────────

def _snapshot_zips(backtest_results_dir: Path) -> set[Path]:
    if not backtest_results_dir.exists():
        return set()
    return set(backtest_results_dir.glob("*.zip"))


def _find_new_zip(before: set[Path], backtest_results_dir: Path) -> Path | None:
    after = _snapshot_zips(backtest_results_dir)
    new = after - before
    if not new:
        return None
    return max(new, key=lambda p: p.stat().st_mtime)


def _parse_zip_result(zip_path: Path, strategy_name: str) -> dict[str, Any]:
    try:
        with zipfile.ZipFile(zip_path) as zf:
            candidates = [
                n for n in zf.namelist()
                if n.endswith(".json") and "_config" not in n and not n.startswith(".")
            ]
            if not candidates:
                return {}
            candidates.sort(key=len)
            with zf.open(candidates[0]) as f:
                payload = json.load(f)
    except Exception:
        return {}
    return _extract_metrics(payload, strategy_name)


def _extract_metrics(payload: dict, strategy_name: str) -> dict[str, Any]:
    strategy_block = payload.get("strategy", {})
    block: dict = {}
    if isinstance(strategy_block, dict):
        block = strategy_block.get(strategy_name) or next(iter(strategy_block.values()), {})
    if not block:
        return {}

    def _num(d: dict, *keys) -> float | None:
        for k in keys:
            v = d.get(k)
            if v is not None:
                try:
                    return float(v)
                except (TypeError, ValueError):
                    pass
        return None

    def _int(d: dict, *keys) -> int | None:
        for k in keys:
            v = d.get(k)
            if v is not None:
                try:
                    return int(v)
                except (TypeError, ValueError):
                    pass
        return None

    total_trades = _int(block, "total_trades") or 0

    profit_pct = _num(block, "profit_total_pct")
    if profit_pct is None:
        profit_ratio = _num(block, "profit_total", "profit_total_long")
        profit_pct = round(profit_ratio * 100, 4) if profit_ratio is not None else None
    else:
        profit_pct = round(profit_pct, 4)

    wins = sum(int(rp.get("wins", 0)) for rp in block.get("results_per_pair", []))
    win_rate = round(wins / total_trades * 100, 2) if total_trades > 0 else None

    sharpe: float | None = None
    for comp in payload.get("strategy_comparison", []):
        if isinstance(comp, dict):
            s = _num(comp, "sharpe")
            if s is not None:
                sharpe = round(s, 4)
                break
    if sharpe is None:
        raw = _num(block, "sharpe", "sharpe_ratio")
        if raw is not None:
            sharpe = round(raw, 4)

    max_dd = _num(block, "max_drawdown", "max_drawdown_abs", "max_drawdown_account")
    if max_dd is not None and abs(max_dd) < 2:
        max_dd = round(max_dd * 100, 4)
    elif max_dd is not None:
        max_dd = round(max_dd, 4)

    return {
        "total_profit_pct": profit_pct,
        "win_rate": win_rate,
        "sharpe_ratio": sharpe,
        "max_drawdown": max_dd,
        "total_trades": total_trades,
    }


# ── helpers ────────────────────────────────────────────────────────────────────

def _load_settings(request: Request):
    return request.app.state.services.settings_store.load()


def _group_key(chunk: list[str]) -> str:
    return " + ".join(chunk)


# ── background tasks ───────────────────────────────────────────────────────────

async def _run_pair_group(
    semaphore: asyncio.Semaphore,
    session_id: str,
    chunk: list[str],
    strategy_name: str,
    timeframe: str,
    timerange: str,
    freqtrade_exe: str,
    config_file: str,
    strategies_dir: str,
    user_data_dir: str,
    exchange: str,
    data_download_runner: DataDownloadRunner,
    dry_run_wallet: float = 1000.0,
    max_open_trades: int = 1,
) -> None:
    """Auto-download data for each pair in the chunk, then run one backtest for the group."""
    gkey = _group_key(chunk)

    async with semaphore:
        session = _SESSIONS.get(session_id)
        if session is None:
            return

        # ── 1. Auto-download data for every pair in the group ─────────────────
        session["results"][gkey] = {"group": gkey, "pairs": chunk, "status": "downloading"}

        download_warnings: list[str] = []
        for pair in chunk:
            err = await _ensure_data(
                data_download_runner, pair, timeframe, timerange,
                config_file, user_data_dir, exchange,
            )
            if err:
                download_warnings.append(f"{pair}: {err}")

        # ── 2. Write a per-group temp config ──────────────────────────────────
        # Sets pair_whitelist to exactly this group so freqtrade accepts them all
        session["results"][gkey]["status"] = "running"

        try:
            base_cfg: dict = json.loads(Path(config_file).read_text(encoding="utf-8"))
        except Exception as exc:
            session["results"][gkey] = {
                "group": gkey, "pairs": chunk, "status": "failed",
                "error": f"Could not read config: {exc}",
            }
            session["completed"] += 1
            return

        group_cfg = base_cfg.copy()
        group_cfg.setdefault("exchange", {})["pair_whitelist"] = chunk

        backtest_results_dir = Path(user_data_dir) / "backtest_results"
        backtest_results_dir.mkdir(parents=True, exist_ok=True)
        zips_before = _snapshot_zips(backtest_results_dir)

        with tempfile.TemporaryDirectory(prefix="pe_") as tmp_dir:
            tmp_config = Path(tmp_dir) / "pe_config.json"
            tmp_config.write_text(json.dumps(group_cfg, indent=2), encoding="utf-8")

            cmd = [
                freqtrade_exe,
                "backtesting",
                "--user-data-dir", user_data_dir,
                "--config", str(tmp_config),
                "--strategy-path", strategies_dir,
                "--strategy", strategy_name,
                "--timerange", timerange,
                "--timeframe", timeframe,
                "--export", "trades",
                "--pairs", *chunk,
                "--dry-run-wallet", str(dry_run_wallet),
                "--max-open-trades", str(max_open_trades),
            ]

            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=str(Path(user_data_dir).parent),
                )
                try:
                    stdout_bytes, stderr_bytes = await asyncio.wait_for(
                        proc.communicate(), timeout=300
                    )
                except asyncio.TimeoutError:
                    try:
                        proc.kill()
                        await proc.wait()
                    except Exception:
                        pass
                    session["results"][gkey] = {
                        "group": gkey, "pairs": chunk, "status": "failed",
                        "error": "Timed out after 5 minutes",
                    }
                    session["completed"] += 1
                    return

                exit_code = proc.returncode
                stderr_text = ""
                if stderr_bytes:
                    raw = stderr_bytes.decode("utf-8", errors="replace").strip()
                    lines = raw.splitlines()
                    important = [
                        l for l in lines
                        if any(kw in l for kw in (
                            "ERROR", "error", "No data", "No candle",
                            "not found", "KeyError", "Exception", "Traceback", "No pair",
                        ))
                    ]
                    stderr_text = " | ".join(important[-3:]) if important else (lines[-1] if lines else raw[:300])

            except Exception as exc:
                session["results"][gkey] = {
                    "group": gkey, "pairs": chunk, "status": "failed", "error": str(exc),
                }
                session["completed"] += 1
                return

        if exit_code != 0:
            session["results"][gkey] = {
                "group": gkey, "pairs": chunk, "status": "failed",
                "error": stderr_text or f"freqtrade exited with code {exit_code}",
            }
            session["completed"] += 1
            return

        # ── 3. Find and parse the result zip ──────────────────────────────────
        result_zip = _find_new_zip(zips_before, backtest_results_dir)
        if result_zip is None:
            session["results"][gkey] = {
                "group": gkey, "pairs": chunk, "status": "failed",
                "error": stderr_text or "No result file produced by freqtrade",
            }
            session["completed"] += 1
            return

        metrics = _parse_zip_result(result_zip, strategy_name)
        result = {"group": gkey, "pairs": chunk, "status": "completed", **metrics}
        if download_warnings:
            result["download_warning"] = "; ".join(download_warnings)
        session["results"][gkey] = result
        session["completed"] += 1


async def _explore_task(
    session_id: str,
    chunks: list[list[str]],
    strategy_name: str,
    timeframe: str,
    timerange: str,
    freqtrade_exe: str,
    config_file: str,
    strategies_dir: str,
    user_data_dir: str,
    exchange: str,
    data_download_runner: DataDownloadRunner,
    dry_run_wallet: float = 1000.0,
    max_open_trades: int = 1,
) -> None:
    semaphore = asyncio.Semaphore(4)
    tasks = [
        _run_pair_group(
            semaphore, session_id, chunk,
            strategy_name, timeframe, timerange,
            freqtrade_exe, config_file, strategies_dir, user_data_dir,
            exchange, data_download_runner,
            dry_run_wallet=dry_run_wallet,
            max_open_trades=max_open_trades,
        )
        for chunk in chunks
    ]
    await asyncio.gather(*tasks)

    session = _SESSIONS.get(session_id)
    if session:
        session["status"] = "completed"
        session["completed_at"] = datetime.now(tz=UTC).isoformat()
        _save_session(session, user_data_dir)


# ── routes ─────────────────────────────────────────────────────────────────────

@router.get("/pair-explorer", summary="List all past pair-explorer sessions")
async def list_pair_explorer_sessions(request: Request) -> dict:
    settings = _load_settings(request)
    if not _SESSIONS:
        _SESSIONS.update(_load_all_sessions(settings.user_data_directory_path))
    sessions = sorted(_SESSIONS.values(), key=lambda s: s.get("created_at", ""), reverse=True)
    return {
        "sessions": [
            {
                "session_id": s["session_id"],
                "strategy_name": s.get("strategy_name", ""),
                "status": s.get("status", "unknown"),
                "total": s.get("total", 0),
                "completed": s.get("completed", 0),
                "created_at": s.get("created_at"),
                "completed_at": s.get("completed_at"),
                "timerange": s.get("timerange", ""),
                "timeframe": s.get("timeframe", ""),
                "max_open_trades": s.get("max_open_trades", 1),
            }
            for s in sessions
        ]
    }


@router.post("/pair-explorer", status_code=202, summary="Start a multi-pair exploration")
async def start_pair_explorer(
    body: PairExplorerRequest,
    background_tasks: BackgroundTasks,
    request: Request,
) -> dict:
    settings = _load_settings(request)
    services = request.app.state.services

    if not _SESSIONS:
        _SESSIONS.update(_load_all_sessions(settings.user_data_directory_path))

    pairs = [p.strip().upper() for p in body.pairs if p.strip()]
    if not pairs:
        raise HTTPException(status_code=422, detail="At least one pair must be selected.")

    # Exchange name for data-file existence checks
    try:
        exchange = json.loads(
            Path(settings.default_config_file_path).read_text(encoding="utf-8")
        ).get("exchange", {}).get("name", "binance")
    except Exception:
        exchange = "binance"

    # Chunk pairs into groups of max_open_trades
    n = body.max_open_trades
    chunks: list[list[str]] = [pairs[i:i + n] for i in range(0, len(pairs), n)]

    session_id = str(uuid.uuid4())
    _SESSIONS[session_id] = {
        "session_id": session_id,
        "status": "running",
        "total": len(chunks),
        "completed": 0,
        "results": {},
        "strategy_name": body.strategy_name,
        "timeframe": body.timeframe,
        "timerange": body.timerange,
        "dry_run_wallet": body.dry_run_wallet,
        "max_open_trades": body.max_open_trades,
        "pairs": pairs,
        "created_at": datetime.now(tz=UTC).isoformat(),
        "completed_at": None,
    }

    background_tasks.add_task(
        _explore_task,
        session_id, chunks,
        body.strategy_name, body.timeframe, body.timerange,
        settings.freqtrade_executable_path,
        settings.default_config_file_path,
        settings.strategies_directory_path,
        settings.user_data_directory_path,
        exchange,
        services.data_download_runner,
        dry_run_wallet=body.dry_run_wallet,
        max_open_trades=body.max_open_trades,
    )

    return {
        "session_id": session_id,
        "status": "running",
        "total": len(chunks),
        "groups": [_group_key(c) for c in chunks],
        "message": (
            f"Exploration started: {len(pairs)} pair(s) in {len(chunks)} "
            f"group(s) of up to {n}. Data will be auto-downloaded as needed."
        ),
    }


@router.get("/pair-explorer/{session_id}", summary="Poll pair-explorer progress")
async def get_pair_explorer_status(session_id: str, request: Request) -> dict:
    session = _SESSIONS.get(session_id)
    if session is None:
        settings = _load_settings(request)
        disk_path = _sessions_dir(settings.user_data_directory_path) / f"{session_id}.json"
        if disk_path.exists():
            try:
                session = json.loads(disk_path.read_text(encoding="utf-8"))
                _SESSIONS[session_id] = session
            except Exception:
                pass

    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    return {
        "session_id": session["session_id"],
        "status": session["status"],
        "total": session["total"],
        "completed": session["completed"],
        "results": list(session["results"].values()),
        "strategy_name": session.get("strategy_name", ""),
        "timeframe": session.get("timeframe", ""),
        "timerange": session.get("timerange", ""),
        "max_open_trades": session.get("max_open_trades", 1),
        "created_at": session.get("created_at"),
        "completed_at": session.get("completed_at"),
    }


@router.post("/add-pair", summary="Add a pair to the config pair_whitelist")
async def add_pair_to_config(body: AddPairRequest, request: Request) -> dict:
    settings = _load_settings(request)
    config_path = Path(settings.default_config_file_path)
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="Config file not found.")
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read config: {exc}")

    pair = body.pair.strip().upper()
    whitelist: list = config.get("exchange", {}).get("pair_whitelist", [])
    if pair in whitelist:
        return {"ok": True, "pair": pair, "already_present": True, "whitelist": whitelist}

    whitelist.append(pair)
    config.setdefault("exchange", {})["pair_whitelist"] = whitelist
    tmp = config_path.with_suffix(".json.tmp")
    try:
        tmp.write_text(json.dumps(config, indent=2), encoding="utf-8")
        tmp.replace(config_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not write config: {exc}")

    return {"ok": True, "pair": pair, "already_present": False, "whitelist": whitelist}
