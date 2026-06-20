"""Subprocess helpers, result extraction, and backtest commands for the Auto-Quant pipeline."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .logging import _rlog, get_queues, logger
from .state import PipelineState, _Cancelled, _cancelled, _now, record_event

# Regex to parse freqtrade hyperopt epoch lines, e.g.:
#   42/100:    100 trades. ... Total profit  0.279 USDT ( 0.28%). ... Objective: -0.283.
_HYPEROPT_EPOCH_RE = re.compile(
    r"^\s*(\d+)/(\d+):\s+(\d+)\s+trades.*?Objective:\s*([-\d.]+)",
    re.IGNORECASE,
)
_HYPEROPT_PROFIT_RE = re.compile(
    r"Total profit\s+([-\d.]+)",
    re.IGNORECASE,
)
_HYPEROPT_AVG_PROFIT_RE = re.compile(
    r"Avg profit\s+([-\d.]+)%",
    re.IGNORECASE,
)
_HYPEROPT_DRAWDOWN_RE = re.compile(
    r"Max drawdown\s+([-\d.]+)%",
    re.IGNORECASE,
)
_HYPEROPT_WIN_RATE_RE = re.compile(
    r"Win rate\s+([-\d.]+)%",
    re.IGNORECASE,
)


async def _run_subprocess(
    run_id: str,
    cmd: list[str],
    *,
    stage: int,
    stream: bool = False,
    timeout: int | None = None,
) -> tuple[int, str, str]:
    """Run a subprocess, optionally streaming stdout to the WS queue.

    Every spawn and exit is logged at DEBUG level.  Lines that match
    ``_should_forward`` (errors, warnings, key metrics) are also emitted to
    the WebSocket queue even in non-stream mode.

    Args:
        timeout: Optional timeout in seconds. If provided, the subprocess will
                 be killed if it doesn't complete within the timeout.
    """
    stdout_lines: list[str] = []
    stderr_lines: list[str] = []

    _rlog(run_id, stage, logging.DEBUG,
          f"[subprocess] SPAWN pid=pending  cmd={cmd[0]} {' '.join(cmd[1:4])}{'…' if len(cmd) > 4 else ''}")

    # Set JOBLIB_IDLE_WORKER_TIMEOUT for Stage 2 (hyperopt) to prevent worker timeout warnings
    env = None
    if stage == 2:
        import os
        from pathlib import Path
        env = os.environ.copy()
        env["JOBLIB_IDLE_WORKER_TIMEOUT"] = "1800"  # 30 minutes instead of default 5 minutes
        # Set temp folder to prevent conflicts and potential memory issues
        temp_dir = Path(os.environ.get("USERPROFILE", os.environ.get("HOME", "/tmp"))) / ".freqtrade_joblib_temp"
        temp_dir.mkdir(parents=True, exist_ok=True)
        env["JOBLIB_TEMP_FOLDER"] = str(temp_dir)
        # Additional joblib settings to prevent worker issues
        env["JOBLIB_START_METHOD"] = "loky"
        # Suppress the specific joblib/loky worker timeout warning in the subprocess
        env["PYTHONWARNINGS"] = "ignore::UserWarning"

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,  # merge stderr into stdout
            env=env,
        )
    except Exception as exc:
        _rlog(run_id, stage, logging.ERROR,
              f"[subprocess] FAILED to spawn: {exc}", exc_info=True)
        raise

    _rlog(run_id, stage, logging.DEBUG, f"[subprocess] pid={proc.pid}  running…")

    assert proc.stdout is not None
    while True:
        if _cancelled(run_id):
            _rlog(run_id, stage, logging.WARNING,
                  f"[subprocess] pid={proc.pid} — cancellation requested, sending SIGKILL")
            proc.kill()
            await proc.wait()
            raise _Cancelled()

        try:
            line_bytes = await asyncio.wait_for(proc.stdout.readline(), timeout=2.0)
        except asyncio.TimeoutError:
            if proc.returncode is not None:
                break
            continue

        if not line_bytes:
            break

        line = line_bytes.decode(errors="replace").rstrip()
        # Filter out joblib/loky worker timeout warnings - comprehensive filtering
        if "worker stopped while some jobs were given to the executor" in line:
            continue
        if "warnings.warn(" in line and "process_executor.py:782" in line:
            continue
        if "process_executor.py:782" in line:
            continue
        if "joblib/externals/loky/process_executor.py" in line:
            continue
        if ".venv/lib/python3.12/site-packages/joblib/externals/loky" in line:
            continue
        if "site-packages/joblib/externals/loky" in line:
            continue
        # Filter any line containing joblib/externals/loky
        if "joblib/externals/loky" in line:
            continue
        # Filter any line containing loky/process_executor
        if "loky/process_executor" in line:
            continue
        stdout_lines.append(line)
        if stream or _should_forward(line):
            _emit(run_id, stage, "running", line, -1)
            _rlog(run_id, stage, logging.DEBUG, f"[subprocess][pid={proc.pid}] {line}")

        # ── Hyperopt epoch telemetry (Stage 2 only) ────────────────────────
        if stage == 2:
            m = _HYPEROPT_EPOCH_RE.match(line)
            if m:
                epoch_num = int(m.group(1))
                total_epochs = int(m.group(2))
                trade_count = int(m.group(3))
                objective = float(m.group(4))
                profit_m = _HYPEROPT_PROFIT_RE.search(line)
                profit_usdt = float(profit_m.group(1)) if profit_m else 0.0
                avg_profit_m = _HYPEROPT_AVG_PROFIT_RE.search(line)
                avg_profit_pct = float(avg_profit_m.group(1)) if avg_profit_m else 0.0
                # Extract additional metrics if available
                drawdown_m = _HYPEROPT_DRAWDOWN_RE.search(line)
                drawdown_pct = float(drawdown_m.group(1)) if drawdown_m else None
                win_rate_m = _HYPEROPT_WIN_RATE_RE.search(line)
                win_rate_pct = float(win_rate_m.group(1)) if win_rate_m else None
                _emit(
                    run_id, stage, "running",
                    f"Epoch {epoch_num}/{total_epochs}: {trade_count} trades, "
                    f"profit {profit_usdt:.4f} USDT, objective {objective:.4f}",
                    -1,
                    {
                        "epoch": epoch_num,
                        "total_epochs": total_epochs,
                        "trades": trade_count,
                        "profit_usdt": profit_usdt,
                        "avg_profit_pct": avg_profit_pct,
                        "objective": objective,
                        "drawdown_pct": drawdown_pct,
                        "win_rate_pct": win_rate_pct,
                    },
                    msg_type="hyperopt_epoch",
                )

    # Wait for process to complete, with optional timeout
    if timeout is not None:
        try:
            await asyncio.wait_for(proc.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            _rlog(run_id, stage, logging.WARNING,
                  f"[subprocess] pid={proc.pid} — timeout after {timeout}s, killing process")
            proc.kill()
            await proc.wait()
            raise
    else:
        await proc.wait()

    rc = proc.returncode or 0
    _rlog(run_id, stage, logging.INFO if rc == 0 else logging.ERROR,
          f"[subprocess] pid={proc.pid} exited rc={rc}  lines_captured={len(stdout_lines)}")
    return rc, "\n".join(stdout_lines), "\n".join(stderr_lines)


def _should_forward(line: str) -> bool:
    """Forward important lines even when not in stream mode."""
    keywords = ("ERROR", "WARNING", "error", "warning", "Epoch", "epoch",
                 "best", "loss", "profit", "trade", "Trade", "Backtesting")
    return any(k in line for k in keywords)


def _classify_subprocess_error(rc: int, stdout: str, stage_label: str) -> str:
    """Return an actionable error message by inspecting subprocess output.

    Freqtrade exits with rc=2 in several distinct situations that all look the
    same to the caller.  This function pattern-matches the captured stdout to
    surface the *real* root cause instead of the generic "may not compile"
    message.
    """
    text = stdout.lower()

    # ── Missing / not-downloaded data ─────────────────────────────────────
    if "no data found" in text or "no history for" in text:
        # Count how many pairs are missing so the message is precise
        missing = [
            line for line in stdout.splitlines()
            if "no history for" in line.lower() or "no data found" in line.lower()
        ]
        pairs_hint = ""
        if missing:
            # Extract the first few pair names from lines like
            # "No history for BTC/USDT, spot, 5m found."
            found_pairs = re.findall(r"No history for ([A-Z]+/[A-Z]+)", stdout)
            if found_pairs:
                sample = ", ".join(found_pairs[:5])
                suffix = f" (+{len(found_pairs)-5} more)" if len(found_pairs) > 5 else ""
                pairs_hint = f" Missing pairs: {sample}{suffix}."
        return (
            f"{stage_label} failed — no market data found for the configured "
            f"timeframe/timerange.{pairs_hint} "
            f"Run `freqtrade download-data --config <config> --timerange <range> "
            f"--timeframe <tf>` to download OHLCV data before running the pipeline."
        )

    # ── Strategy import / class-not-found errors ──────────────────────────
    if "importerror" in text or "modulenotfounderror" in text or "no module named" in text:
        return (
            f"{stage_label} failed (exit {rc}) — strategy file has an import error. "
            f"Check that all strategy dependencies are installed."
        )

    if "strategy class" in text or "cannot be resolved" in text:
        return (
            f"{stage_label} failed (exit {rc}) — strategy class could not be resolved. "
            f"Ensure the strategy file is in the strategies directory and the class name matches."
        )

    # ── Configuration errors ───────────────────────────────────────────────
    if "configuration error" in text or "config error" in text or "invalid configuration" in text:
        return (
            f"{stage_label} failed (exit {rc}) — configuration error in config.json. "
            f"Check exchange settings, stake_currency, and pair_whitelist."
        )

    # ── Buy-space hyperopt parameter mismatch ─────────────────────────────
    if "buy space is included into the hyperoptimization" in text or "no parameter for this space was found" in text:
        return (
            f"{stage_label} failed (exit {rc}) — hyperopt received 'buy' space, but the strategy defines no buy-space parameters. "
            f"Remove 'buy' from hyperopt_spaces or add buy-space parameters to the strategy."
        )

    # ── Exchange / API connectivity ────────────────────────────────────────
    if "exchange" in text and ("error" in text or "failed" in text):
        return (
            f"{stage_label} failed (exit {rc}) — exchange connection or configuration issue. "
            f"Verify your exchange credentials and config.json exchange block."
        )

    # ── Generic fallback with raw tail for debuggability ──────────────────
    tail_lines = [l for l in stdout.splitlines() if l.strip()][-6:]
    tail = " | ".join(tail_lines) if tail_lines else "(no output captured)"
    return (
        f"{stage_label} failed (exit {rc}). "
        f"Last output: {tail}"
    )


def _backtest_cmd(
    state: PipelineState,
    *,
    strategy: str,
    timerange: str,
    result_prefix: str,
    pairs: list[str] | None = None,
) -> list[str]:
    cmd = [
        state.freqtrade_path, "backtesting",
        "--config", state.config_file,
        "--strategy", strategy,
        "--timerange", timerange,
        "--timeframe", state.timeframe,
        "--user-data-dir", state.user_data_dir,
        "--export", "trades",
        "--export-filename", result_prefix + ".json",
        "--no-color",
        "--cache", "none",
    ]
    try:
        from ..variants import strategy_path_args

        cmd += strategy_path_args(state)
    except Exception:
        pass
    if pairs:
        cmd += ["--pairs"] + pairs
    return cmd


async def _extract_hyperopt_best(
    state: PipelineState, out_dir: Path
) -> dict | None:
    """Extract best hyperopt result using three methods in order of reliability."""

    def _save_and_return(obj: dict) -> dict:
        try:
            (out_dir / "hyperopt_best.json").write_text(
                json.dumps(obj, indent=2, default=str), encoding="utf-8"
            )
        except Exception as exc:
            logger.warning("Helpers | failed to save hyperopt_best.json: %s", exc)
        return obj

    logger.info("Helpers | Attempting to extract best hyperopt parameters")
    
    # ── Method 1: freqtrade hyperopt-show --print-json ─────────────────────
    # Scan for a valid JSON object rather than using a greedy regex that
    # captures everything from the first { to the last } in the full output.
    cmd = [
        state.freqtrade_path, "hyperopt-show",
        "--config", state.config_file,
        "--strategy", state.strategy,
        "--user-data-dir", state.user_data_dir,
        "--best",
        "--print-json",
        "--no-color",
    ]
    try:
        from ..variants import strategy_path_args

        cmd += strategy_path_args(state)
    except Exception:
        pass
    
    import shlex
    logger.info("Helpers | Method 1: Running hyperopt-show command: %s", shlex.join(cmd))
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        output = (result.stdout + result.stderr).strip()
        logger.info("Helpers | hyperopt-show stdout length: %d, stderr length: %d", len(result.stdout), len(result.stderr))
        logger.debug("Helpers | hyperopt-show stdout: %s", result.stdout[:500] if result.stdout else "empty")
        logger.debug("Helpers | hyperopt-show stderr: %s", result.stderr[:500] if result.stderr else "empty")
        
        if not output:
            logger.warning("Helpers | hyperopt-show produced no output")
        else:
            decoder = json.JSONDecoder()
            for i, ch in enumerate(output):
                if ch == "{":
                    try:
                        obj, _ = decoder.raw_decode(output, i)
                        # Check for various possible structures from freqtrade
                        if isinstance(obj, dict):
                            # Direct params_dict or loss
                            if "params_dict" in obj or "loss" in obj:
                                logger.info("Helpers | Method 1 succeeded: found direct params_dict or loss in output")
                                return _save_and_return(obj)
                            # Nested params structure (from hyperopt-show)
                            if "params" in obj:
                                params_dict: dict = {}
                                nested = obj["params"]
                                for space, vals in nested.items():
                                    if not isinstance(vals, dict):
                                        continue
                                    if space == "roi":
                                        params_dict["minimal_roi"] = {str(k): v for k, v in vals.items()}
                                    else:
                                        for k, v in vals.items():
                                            params_dict[k] = v
                                # Unwrap stoploss if nested
                                if "stoploss" in params_dict and isinstance(params_dict["stoploss"], dict):
                                    params_dict["stoploss"] = params_dict["stoploss"].get(
                                        "stoploss", next(iter(params_dict["stoploss"].values()), None)
                                    )
                                best = {
                                    "loss": obj.get("loss"),
                                    "params_dict": params_dict,
                                    "params_details": nested,
                                }
                                logger.info("Helpers | Method 1 succeeded: extracted nested params structure")
                                return _save_and_return(best)
                    except Exception as parse_exc:
                        logger.debug("Helpers | Failed to parse JSON at position %d: %s", i, parse_exc)
                        continue
            logger.warning("Helpers | Method 1 failed: no valid JSON object found in hyperopt-show output")
    except subprocess.TimeoutExpired:
        logger.error("Helpers | Method 1 failed: hyperopt-show command timed out after 60 seconds")
    except Exception as exc:
        logger.error("Helpers | Method 1 failed with exception: %s", exc, exc_info=True)

    # ── Method 2: strategy JSON file freqtrade writes after every hyperopt ──
    # freqtrade always dumps best params to strategies/{name}.json on success.
    # Its nested "params" structure needs to be flattened into params_dict.
    logger.info("Helpers | Method 2: Attempting to read strategy JSON files")
    strategy_json_candidates = []
    if getattr(state, "strategy_runtime_dir", None):
        strategy_json_candidates.append(Path(state.strategy_runtime_dir) / f"{state.strategy}.json")
        # Also check for variant JSON files in runtime dir
        runtime_dir = Path(state.strategy_runtime_dir)
        if runtime_dir.exists():
            import fnmatch
            # Escape special glob characters in strategy name
            escaped_strategy = fnmatch.translate(state.strategy).replace('.*', '').replace('?', '')
            for variant_json in runtime_dir.glob(f"{state.strategy}_*.json"):
                strategy_json_candidates.append(variant_json)
    strategy_json_candidates.append(Path(state.user_data_dir) / "strategies" / f"{state.strategy}.json")
    
    logger.info("Helpers | Method 2: Checking %d candidate strategy JSON files", len(strategy_json_candidates))
    for strategy_json in strategy_json_candidates:
        logger.debug("Helpers | Method 2: Checking file: %s (exists: %s)", strategy_json, strategy_json.exists())
        if not strategy_json.exists():
            continue
        try:
            raw = json.loads(strategy_json.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                logger.debug("Helpers | Method 2: File %s contains keys: %s", strategy_json, list(raw.keys()))
            else:
                logger.debug("Helpers | Method 2: File %s contains unexpected type: %s", strategy_json, type(raw).__name__)
            nested: dict = raw.get("params", {}) if isinstance(raw, dict) else {}
            if nested:
                params_dict: dict = {}
                for space, vals in nested.items():
                    if not isinstance(vals, dict):
                        continue
                    if space == "roi":
                        # freqtrade names the key "minimal_roi" in params_dict
                        params_dict["minimal_roi"] = {str(k): v for k, v in vals.items()}
                    else:
                        for k, v in vals.items():
                            params_dict[k] = v
                # stoploss is nested as {"stoploss": -0.038} — unwrap it
                if "stoploss" in params_dict and isinstance(params_dict["stoploss"], dict):
                    params_dict["stoploss"] = params_dict["stoploss"].get(
                        "stoploss", next(iter(params_dict["stoploss"].values()), None)
                    )
                best = {
                    "loss": None,
                    "params_dict": params_dict,
                    "params_details": nested,
                }
                logger.info("Helpers | Method 2 succeeded: extracted params from %s", strategy_json)
                return _save_and_return(best)
            else:
                logger.debug("Helpers | Method 2: File %s has no 'params' key", strategy_json)
        except Exception as exc:
            logger.warning("Helpers | Method 2: failed to read strategy JSON %s: %s", strategy_json, exc, exc_info=True)
    
    logger.warning("Helpers | Method 2 failed: no valid strategy JSON file found")

    # ── Method 3: .fthypt file (pickle or JSONL format) ─────────────────
    logger.info("Helpers | Method 3: Attempting to read .fthypt files")
    results_dir = Path(state.user_data_dir) / "hyperopt_results"
    logger.debug("Helpers | Method 3: Results directory: %s", results_dir)
    logger.debug("Helpers | Method 3: Results directory exists: %s", results_dir.exists())
    
    fthypt_files = []
    if results_dir.exists():
        import fnmatch
        # Escape special glob characters in strategy name
        escaped_strategy = fnmatch.translate(state.strategy).replace('.*', '').replace('?', '')
        fthypt_files = list(results_dir.glob(f"{state.strategy}*.fthypt"))
    logger.info("Helpers | Method 3: Found %d .fthypt files", len(fthypt_files))
    
    for fthypt in sorted(fthypt_files, reverse=True):
        logger.debug("Helpers | Method 3: Checking file: %s", fthypt)
        try:
            # Try pickle format first (older freqtrade versions)
            import pickle  # noqa: PLC0415
            logger.debug("Helpers | Method 3: Attempting pickle format for %s", fthypt)
            with open(fthypt, "rb") as f:
                data = pickle.load(f)  # noqa: S301
            logger.debug("Helpers | Method 3: Pickle load successful, data type: %s", type(data))
            if isinstance(data, list) and data:
                logger.debug("Helpers | Method 3: Found list with %d items", len(data))
                # Filter out items with loss=None to prevent TypeError
                valid_items = [item for item in data if item.get("loss") is not None]
                if not valid_items:
                    logger.warning("Helpers | Method 3: All items have loss=None, cannot determine best")
                    continue
                best = min(valid_items, key=lambda x: x.get("loss", float("inf")))
                logger.info("Helpers | Method 3 succeeded: extracted params from pickle file %s", fthypt)
                return _save_and_return(best)
            else:
                logger.debug("Helpers | Method 3: Pickle data is not a list or is empty")
        except Exception as pickle_exc:
            logger.debug("Helpers | Method 3: Pickle format failed for %s: %s", fthypt, pickle_exc)
            # If pickle fails, try JSONL format (newer freqtrade versions)
            try:
                logger.debug("Helpers | Method 3: Attempting JSONL format for %s", fthypt)
                data = []
                with open(fthypt, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                obj = json.loads(line)
                                data.append(obj)
                            except json.JSONDecodeError:
                                continue
                logger.debug("Helpers | Method 3: JSONL parsed %d items", len(data))
                if data:
                    # Filter out items with loss=None to prevent TypeError
                    valid_items = [item for item in data if item.get("loss") is not None]
                    if not valid_items:
                        logger.warning("Helpers | Method 3: All items have loss=None, cannot determine best")
                        continue
                    best = min(valid_items, key=lambda x: x.get("loss", float("inf")))
                    logger.info("Helpers | Method 3 succeeded: extracted params from JSONL file %s", fthypt)
                    return _save_and_return(best)
                else:
                    logger.debug("Helpers | Method 3: JSONL file is empty")
            except Exception as jsonl_exc:
                logger.debug("Helpers | Method 3: JSONL format failed for %s: %s", fthypt, jsonl_exc)
                logger.debug("Helpers | Method 3: Pickle error: %s, JSONL error: %s", pickle_exc, jsonl_exc)
                continue
    
    logger.error("Helpers | Method 3 failed: no valid .fthypt file found or all parse attempts failed")
    
    # ── All methods failed ─────────────────────────────────────────────────
    logger.error("Helpers | All three extraction methods failed - cannot extract best hyperopt parameters")
    logger.error("Helpers | strategy_runtime_dir: %s", getattr(state, "strategy_runtime_dir", "not set"))
    logger.error("Helpers | user_data_dir: %s", state.user_data_dir)
    logger.error("Helpers | strategy: %s", state.strategy)
    logger.error("Helpers | config_file: %s", state.config_file)
    
    return None


def _inject_params(source: str, new_class_name: str, best_params: dict, param_overrides: dict | None = None) -> str:
    """Clone strategy source, rename the class, and inject best hyperopt params.
    
    Args:
        source: Strategy source code
        new_class_name: Name for the cloned class
        best_params: Hyperopt best params dict
        param_overrides: Optional dict of forced parameter overrides (e.g., from hard mutation)
    """
    # Rename class
    source = re.sub(
        r'class\s+\w+\s*\(',
        f'class {new_class_name}(',
        source,
        count=1,
    )

    params_dict = best_params.get("params_dict", {})
    if not params_dict and "params_details" in best_params:
        # Some freqtrade versions nest params differently
        params_dict = {}
        for space_params in best_params["params_details"].values():
            if isinstance(space_params, dict):
                params_dict.update(space_params)
    
    # Apply param_overrides first (they take precedence)
    if param_overrides:
        params_dict = dict(params_dict)  # Make a copy
        params_dict.update(param_overrides)

    def _format_parameter_default(value: Any) -> str:
        if isinstance(value, bool):
            return "True" if value else "False"
        if isinstance(value, str):
            return json.dumps(value)
        if value is None:
            return "None"
        return str(value)

    def _inject_parameter_default(param_name: str, value: Any, current_source: str) -> str:
        parameter_classes = "DecimalParameter|IntParameter|CategoricalParameter"
        pattern = re.compile(
            rf'(\b{re.escape(param_name)}\s*=\s*(?:{parameter_classes})\s*\(.*?\bdefault\s*=\s*)'
            r'([^,\)]+)',
            flags=re.DOTALL,
        )
        return pattern.sub(
            lambda m: f"{m.group(1)}{_format_parameter_default(value)}",
            current_source,
            count=1,
        )

    # Inject stoploss
    if "stoploss" in params_dict:
        val = params_dict["stoploss"]
        source = re.sub(
            r'(stoploss\s*=\s*)[-\d.]+',
            f'\\g<1>{val}',
            source,
        )

    # Inject minimal_roi (may be nested)
    if "minimal_roi" in params_dict:
        roi = params_dict["minimal_roi"]
        roi_str = json.dumps(roi, indent=4)
        source = re.sub(
            r'(minimal_roi\s*=\s*)\{[^}]*\}',
            f'\\g<1>{roi_str}',
            source,
            flags=re.DOTALL,
        )

    # Inject trailing stop params
    for key, attr in [
        ("trailing_stop", "trailing_stop"),
        ("trailing_stop_positive", "trailing_stop_positive"),
        ("trailing_stop_positive_offset", "trailing_stop_positive_offset"),
        ("trailing_only_offset_is_reached", "trailing_only_offset_is_reached"),
    ]:
        if key in params_dict:
            val = params_dict[key]
            if isinstance(val, bool):
                val_str = "True" if val else "False"
            else:
                val_str = str(val)
            source = re.sub(
                rf'({re.escape(attr)}\s*=\s*)(\S+)',
                f'\\g<1>{val_str}',
                source,
            )

    special_keys = {
        "stoploss",
        "minimal_roi",
        "trailing_stop",
        "trailing_stop_positive",
        "trailing_stop_positive_offset",
        "trailing_only_offset_is_reached",
    }
    for key, val in params_dict.items():
        if key in special_keys:
            continue
        source = _inject_parameter_default(key, val, source)

    # Add a comment header
    header = (
        f"# AUTO-GENERATED by Auto-Quant Factory\n"
        f"# Source strategy: {new_class_name.replace('_Optimized', '')}\n"
        f"# Do not edit manually — re-run Auto-Quant to regenerate.\n\n"
    )
    source = header + source

    return source


def _aggregate_wfa_parameters(
    window_params: list[dict],
    recency_weights: list[float],
) -> dict:
    """Aggregate parameters from multiple WFA windows using Recency-Weighted Average.

    For each parameter:
    - Numeric values: Weighted average based on recency weights
    - Boolean values: Weighted majority vote (sum weights for True vs False)
    - Categorical strings: Weighted majority vote (sum weights per category)
    - Nested dicts (e.g., minimal_roi): Use most recent window's value (no averaging)

    Args:
        window_params: List of params_dict from each passing window
        recency_weights: Corresponding recency weights for each window

    Returns:
        Aggregated parameters dict. Falls back to most recent window on error.
    """
    if not window_params or not recency_weights:
        return {}

    if len(window_params) != len(recency_weights):
        logger.warning(
            f"Aggregate params: window_params length ({len(window_params)}) != "
            f"recency_weights length ({len(recency_weights)})"
        )
        # Fallback to most recent
        return window_params[-1] if window_params else {}

    try:
        # Collect all parameter keys across all windows
        all_keys = set()
        for params in window_params:
            all_keys.update(params.keys())

        aggregated: dict[str, Any] = {}

        for key in all_keys:
            # Collect values and weights for this parameter across windows
            values_with_weights = []
            for params, weight in zip(window_params, recency_weights):
                if key in params:
                    values_with_weights.append((params[key], weight))

            if not values_with_weights:
                continue

            # Determine parameter type and apply appropriate aggregation
            first_val = values_with_weights[0][0]

            # Nested dict - use most recent window's value
            if isinstance(first_val, dict):
                aggregated[key] = values_with_weights[-1][0]
                continue

            # Boolean - weighted majority vote
            elif isinstance(first_val, bool):
                true_weight = sum(w for v, w in values_with_weights if v is True)
                false_weight = sum(w for v, w in values_with_weights if v is False)
                aggregated[key] = true_weight >= false_weight
                continue

            # Numeric - weighted average
            elif isinstance(first_val, (int, float)):
                total_weight = sum(w for _, w in values_with_weights)
                weighted_sum = sum(v * w for v, w in values_with_weights)
                aggregated[key] = weighted_sum / total_weight if total_weight > 0 else first_val
                continue

            # Categorical string - weighted majority vote
            elif isinstance(first_val, str):
                # Sum weights for each unique value
                value_weights: dict[str, float] = {}
                for val, weight in values_with_weights:
                    value_weights[val] = value_weights.get(val, 0.0) + weight
                # Pick value with highest weight
                aggregated[key] = max(value_weights.items(), key=lambda x: x[1])[0]
                continue

            # Other types - use most recent
            else:
                aggregated[key] = values_with_weights[-1][0]

        return aggregated

    except Exception as exc:
        logger.warning(f"Aggregate params: failed to compute weighted average: {exc}")
        # Fallback to most recent window's parameters
        return window_params[-1] if window_params else {}


def _find_backtest_result(out_dir: Path, prefix: str, user_data_dir: str | None = None) -> dict:
    """Find and parse the freqtrade backtest result JSON for this stage.

    Freqtrade does not always honour the ``--export-filename`` absolute path —
    it may write to its default ``backtest_results/`` directory instead.  We
    try three locations in order:
      1. The direct ``{out_dir}/{prefix}.json`` path we passed to freqtrade.
      2. Any ``{prefix}*.json`` glob in ``out_dir`` (timestamped variants).
      3. The latest zip in ``user_data/backtest_results/`` via
         ``backtest_results/.last_result.json`` (freqtrade's own pointer file).
    """
    # 1. Direct export-filename path
    direct = out_dir / f"{prefix}.json"
    if direct.exists():
        try:
            logger.debug("Helpers | loading direct backtest result: %s", direct)
            return json.loads(direct.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Helpers | failed to read direct result %s: %s", direct, exc)

    # 2. Glob fallback inside out_dir
    candidates = sorted(
        out_dir.glob(f"{prefix}*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if candidates:
        try:
            logger.debug("Helpers | loading fallback backtest result: %s", candidates[0])
            return json.loads(candidates[0].read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Helpers | failed to read candidate result %s: %s", candidates[0], exc)

    # 3. Read from freqtrade's default backtest_results directory
    if user_data_dir:
        data = _read_latest_freqtrade_backtest(Path(user_data_dir), out_dir, prefix)
        if data:
            return data

    return {}


def _read_latest_freqtrade_backtest(
    user_data_dir: Path, out_dir: Path, prefix: str
) -> dict:
    """Extract the latest backtest result zip from freqtrade's default output dir.

    freqtrade writes ``backtest_results/.last_result.json`` pointing at the
    newest zip.  We open that zip, pull out the main JSON member, cache it to
    ``out_dir/{prefix}.json`` for subsequent calls, and return the parsed dict.
    """
    results_dir = user_data_dir / "backtest_results"
    last_ptr = results_dir / ".last_result.json"
    if not last_ptr.exists():
        return {}
    try:
        ptr_data = json.loads(last_ptr.read_text(encoding="utf-8"))
    except Exception:
        return {}

    latest_name = ptr_data.get("latest_backtest")
    if not latest_name:
        return {}

    latest_zip = results_dir / latest_name
    if not latest_zip.exists():
        logger.warning("Helpers | latest backtest zip missing: %s", latest_zip)
        return {}

    try:
        logger.debug("Helpers | loading latest backtest zip: %s", latest_zip)
        with zipfile.ZipFile(latest_zip) as archive:
            json_members = [
                name for name in archive.namelist()
                if name.endswith(".json") and not name.endswith("_config.json")
            ]
            if not json_members:
                return {}
            # Prefer the member whose name doesn't include "_result" (the trades file)
            preferred = next(
                (n for n in json_members if "_result" not in n), json_members[0]
            )
            with archive.open(preferred) as fh:
                data = json.loads(fh.read())
        # Cache to out_dir so the direct path works on any retry
        try:
            (out_dir / f"{prefix}.json").write_text(
                json.dumps(data), encoding="utf-8"
            )
        except Exception:
            pass
        return data
    except Exception:
        return {}


def _extract_backtest_summary(data: dict, strategy_name: str) -> dict:
    """Extract top-level summary metrics for a strategy from a backtest result."""
    strategy_data = data.get("strategy", {})
    if strategy_name in strategy_data:
        s = strategy_data[strategy_name]
    elif strategy_data:
        s = next(iter(strategy_data.values()))
    else:
        s = data  # older format

    return {
        "profit_total": s.get("profit_total", s.get("profit_total_abs", 0.0)),
        "profit_total_abs": s.get("profit_total_abs", 0.0),
        "profit_mean_pct": s.get("profit_mean", 0.0) * 100,
        "max_drawdown_account": s.get("max_drawdown_account", 0.0),
        "total_trades": s.get("total_trades", 0),
        "wins": s.get("wins", 0),
        "losses": s.get("losses", 0),
        "draws": s.get("draws", 0),
        "win_rate": s.get("win_rate", 0.0),
        "profit_factor": s.get("profit_factor", 0.0),
        "sharpe_ratio": s.get("sharpe_ratio", 0.0),
        "calmar_ratio": s.get("calmar_ratio", 0.0),
        "sortino_ratio": s.get("sortino_ratio", 0.0),
        "stake_currency": s.get("stake_currency", "USDT"),
    }


def _extract_trade_count(data: dict, strategy_name: str) -> int:
    summary = _extract_backtest_summary(data, strategy_name)
    return int(summary.get("total_trades", 0))


def _extract_per_pair_results(data: dict, strategy_name: str) -> list[dict]:
    """Extract per-pair profit data from backtest result."""
    strategy_data = data.get("strategy", {})
    if strategy_name in strategy_data:
        s = strategy_data[strategy_name]
    elif strategy_data:
        s = next(iter(strategy_data.values()))
    else:
        s = data

    per_pair = s.get("results_per_pair", [])
    result = []
    for p in per_pair:
        if p.get("key") == "TOTAL":
            continue
        profit_factor = p.get("profit_factor", 0.0)
        if "profit_factor" not in p:
            logger.debug(
                "Helpers | pair %s missing profit_factor, falling back to 0.0", p.get("key", "<unknown>"),
            )
        result.append({
            "key": p.get("key", ""),
            "profit_total": p.get("profit_total", p.get("profit_total_abs", 0.0)),
            "profit_mean_pct": p.get("profit_mean", 0.0) * 100,
            "trades": p.get("trades", 0),
            "wins": p.get("wins", 0),
            "losses": p.get("losses", 0),
            "profit_factor": profit_factor,
        })
    logger.debug(
        "Helpers | extracted %d per-pair results for strategy %s",
        len(result),
        strategy_name,
    )
    return result


def _extract_trade_distribution(data: dict, strategy_name: str) -> dict:
    """Extract trade distribution data for visualization."""
    from ..profit_lockin import extract_strategy_trades
    
    trades = extract_strategy_trades(data, strategy_name)
    if not trades:
        return {"profit_buckets": [], "total_trades": 0}
    
    # Calculate profit/loss distribution buckets
    profit_ratios = []
    for trade in trades:
        if "profit_ratio" in trade:
            try:
                profit_ratios.append(float(trade["profit_ratio"]))
            except (ValueError, TypeError):
                pass
    
    # Define buckets: <-5%, -5% to -2%, -2% to 0%, 0% to 2%, 2% to 5%, >5%
    buckets = {
        "< -5%": 0,
        "-5% to -2%": 0,
        "-2% to 0%": 0,
        "0% to 2%": 0,
        "2% to 5%": 0,
        "> 5%": 0,
    }
    
    for pr in profit_ratios:
        if pr < -0.05:
            buckets["< -5%"] += 1
        elif pr < -0.02:
            buckets["-5% to -2%"] += 1
        elif pr < 0:
            buckets["-2% to 0%"] += 1
        elif pr < 0.02:
            buckets["0% to 2%"] += 1
        elif pr < 0.05:
            buckets["2% to 5%"] += 1
        else:
            buckets["> 5%"] += 1
    
    return {
        "profit_buckets": [{"label": k, "count": v} for k, v in buckets.items()],
        "total_trades": len(profit_ratios),
    }


def _start_stage(run_id: str, state: PipelineState, stage_idx: int) -> None:
    state.current_stage = stage_idx
    total_stages = len(state.stages)
    state.progress_percent = int((stage_idx - 1) / total_stages * 100) if total_stages else 0
    s = state.stages[stage_idx - 1]
    s.status = "running"
    s.started_at = _now()
    s.duration_s = None
    logger.info("[%s] ▶ STAGE %d/%d STARTED: %s", run_id, stage_idx, total_stages, s.name)
    _emit(run_id, stage_idx, "running", "", -1, started_at=s.started_at)


def _pass_stage(
    run_id: str, state: PipelineState, stage_idx: int,
    message: str, data: dict | None = None,
) -> None:
    s = state.stages[stage_idx - 1]
    s.status = "passed"
    s.message = message
    s.data = data or {}
    if s.started_at:
        try:
            started = datetime.fromisoformat(s.started_at)
            s.duration_s = round((datetime.now(timezone.utc) - started).total_seconds(), 1)
        except Exception:
            s.duration_s = None
    total_stages = len(state.stages)
    progress = int(stage_idx / total_stages * 100)
    state.progress_percent = progress
    logger.info("[%s] ✔ STAGE %d/%d PASSED: %s  progress=%d%%",
                run_id, stage_idx, total_stages, s.name, progress)
    from .state import _save_state_to_disk
    _save_state_to_disk(state)
    _emit(run_id, stage_idx, "passed", message, progress, data, duration_s=s.duration_s)


def _fail_stage(
    run_id: str, state: PipelineState, stage_idx: int,
    message: str, data: dict | None = None,
) -> None:
    s = state.stages[stage_idx - 1]
    s.status = "failed"
    s.message = message
    s.data = data or {}
    if s.started_at:
        try:
            started = datetime.fromisoformat(s.started_at)
            s.duration_s = round((datetime.now(timezone.utc) - started).total_seconds(), 1)
        except Exception:
            s.duration_s = None
    state.status = "failed"
    state.error = message
    state.completed_at = _now()
    total_stages = len(state.stages)
    state.progress_percent = int((stage_idx - 1) / total_stages * 100) if total_stages else 0
    logger.error("[%s] ✘ STAGE %d/%d FAILED: %s | error=%r",
                 run_id, stage_idx, total_stages, s.name, message)
    from .state import _save_state_to_disk
    _save_state_to_disk(state)
    _emit(run_id, stage_idx, "failed", message, -1, data, duration_s=s.duration_s)
    # NOTE: the sentinel (None) that closes WebSocket connections is sent by
    # run_pipeline's finally block — do NOT duplicate it here.


def _emit(
    run_id: str,
    stage: int,
    status: str,
    message: str,
    progress: int,
    data: dict | None = None,
    msg_type: str | None = None,
    started_at: str | None = None,
    duration_s: float | None = None,
) -> None:
    payload: dict[str, Any] = {
        "stage": stage,
        "status": status,
        "message": message,
        "progress": progress,
        "data": data or {},
        "ts": _now(),
    }
    if msg_type is not None:
        payload["type"] = msg_type
    if started_at is not None:
        payload["started_at"] = started_at
    if duration_s is not None:
        payload["duration_s"] = duration_s
    record_event(run_id, {"run_id": run_id, **payload})
    for q in list(get_queues().get(run_id, [])):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass
        except Exception:
            pass


def _create_temp_config_with_fee_override(
    base_config_path: str | Path,
    fee_multiplier: float,
    out_dir: Path,
) -> Path:
    """Create a temporary config file with modified fee_rate for stress testing.

    Args:
        base_config_path: Path to the base config.json file
        fee_multiplier: Multiplier for fee_rate (e.g., 2.0 for 2x fees)
        out_dir: Directory where temp config will be created

    Returns:
        Path to the temporary config file

    Raises:
        Exception: If base config cannot be read or temp config cannot be written
    """
    import json
    from pathlib import Path

    base_path = Path(base_config_path)
    base_config = json.loads(base_path.read_text(encoding="utf-8"))

    # Get base fee_rate (default to 0.001 if not present)
    base_fee_rate = base_config.get("fee_rate", 0.001)

    # Apply multiplier
    modified_fee_rate = base_fee_rate * fee_multiplier
    base_config["fee_rate"] = modified_fee_rate

    # Create temp config file
    temp_config_name = f"temp_config_fee_{fee_multiplier}x.json"
    temp_config_path = out_dir / temp_config_name

    temp_config_path.write_text(json.dumps(base_config, indent=2), encoding="utf-8")

    logger.debug(
        "Created temp config: %s with fee_rate=%s (base=%s * %s)",
        temp_config_path, modified_fee_rate, base_fee_rate, fee_multiplier,
    )

    return temp_config_path


def _create_temp_config_with_max_open_trades(
    base_config_path: str | Path,
    max_open_trades: int,
    out_dir: Path,
) -> Path:
    """Create a temporary config file with max_open_trades parameter for portfolio competition.

    Args:
        base_config_path: Path to the base config.json file
        max_open_trades: Maximum number of concurrent open trades (capital constraint)
        out_dir: Directory where temp config will be created

    Returns:
        Path to the temporary config file

    Raises:
        Exception: If base config cannot be read or temp config cannot be written
    """
    import json
    from pathlib import Path

    base_path = Path(base_config_path)
    base_config = json.loads(base_path.read_text(encoding="utf-8"))

    # Set max_open_trades to enforce capital constraint
    base_config["max_open_trades"] = max_open_trades

    # Create temp config file
    temp_config_name = f"temp_config_max_trades_{max_open_trades}.json"
    temp_config_path = out_dir / temp_config_name

    temp_config_path.write_text(json.dumps(base_config, indent=2), encoding="utf-8")

    logger.debug(
        "Created temp config: %s with max_open_trades=%s",
        temp_config_path, max_open_trades,
    )

    return temp_config_path


def _extract_last_close_price(
    pair: str,
    user_data_dir: str,
    timerange: str | None = None,
) -> float:
    """Extract the last close price for a pair from historical data file.

    Args:
        pair: Trading pair symbol (e.g., "BTC/USDT")
        user_data_dir: Path to user_data directory
        timerange: Optional timerange to filter data (YYYYMMDD-YYYYMMDD format)

    Returns:
        Last close price as float, or 1.0 as fallback if unavailable
    """
    from pathlib import Path

    try:
        # Freqtrade stores data in user_data/data/<exchange>/<pair>/<timeframe>.json
        # We need to find the data file for this pair
        data_dir = Path(user_data_dir) / "data"
        
        # Try to find the pair data file (search common locations)
        pair_filename = pair.replace("/", "_")
        candidates = []
        
        # Search for the pair data file
        for json_file in data_dir.rglob(f"{pair_filename}*.json"):
            candidates.append(json_file)
        
        if not candidates:
            logger.warning("Helpers | No data file found for pair %s, using fallback price 1.0", pair)
            return 1.0
        
        # Use the most recently modified file
        data_file = max(candidates, key=lambda p: p.stat().st_mtime)
        
        # Read the JSON data
        import json
        data = json.loads(data_file.read_text(encoding="utf-8"))
        
        # Freqtrade data format: list of [timestamp, open, high, low, close, volume]
        if isinstance(data, list) and len(data) > 0:
            # Get the last close price (index 4 in each candle)
            last_candle = data[-1]
            if len(last_candle) >= 5:
                close_price = float(last_candle[4])
                logger.debug("Helpers | Extracted last close price for %s: %s", pair, close_price)
                return close_price
        
        logger.warning("Helpers | Invalid data format for pair %s, using fallback price 1.0", pair)
        return 1.0
        
    except Exception as exc:
        logger.warning("Helpers | Failed to extract last close price for %s: %s, using fallback 1.0", pair, exc)
        return 1.0
