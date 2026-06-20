"""services/execution/pair_sweep_runner.py contains backend logic for pair sweep runner.

This file is intentionally documented in plain English so readers can follow
what each section does even without deep Python experience.
"""

from __future__ import annotations
import asyncio
import random
import subprocess
import uuid
from pathlib import Path
from typing import Any

from ...core.errors import BackendError
from ...models import (
    DownloadDataRequest,
    RunRequest,
    RunStatus,
    StartPairSweepRequest,
    SweepIterationMetrics,
    SweepIterationRecord,
    SweepIterationStatus,
    SweepPhase,
    SweepSession,
    SweepSessionConfig,
)
from ...models.runs import PairResult, ParsedSummary, RunMetadata
from ...models.base import RunType
from ...utils import utc_now
from ...settings_store import SettingsStore
from .backtest_runner import BacktestRunner
from .backtest_gate import _apply_gate_rules
from .data_download_runner import DataDownloadRunner
from ..storage.pair_sweep_store import PairSweepStore
from ..storage.result_parser import ResultParser
from ..pairs.pair_selector import PairSelectorService
from ..storage.run_repository import RunRepository
from ..strategy.strategy_registry import StrategyRegistry
from ..strategy.version_manager import VersionManager


class PairSweepRunner:
    """Orchestrates sequential backtest iterations for a pair sweep session."""

    def __init__(
        self,
        sweep_store: PairSweepStore,
        backtest_runner: BacktestRunner,
        run_repository: RunRepository,
        registry: StrategyRegistry,
        settings_store: SettingsStore,
        version_manager: VersionManager,
        pair_selector: PairSelectorService,
        data_download_runner: DataDownloadRunner,
    ) -> None:
        """__init__ implements function-level backend logic."""
        self.sweep_store = sweep_store
        self.backtest_runner = backtest_runner
        self.run_repository = run_repository
        self.registry = registry
        self.settings_store = settings_store
        self.version_manager = version_manager
        self.pair_selector = pair_selector
        self.data_download_runner = data_download_runner
        self._active_task: asyncio.Task | None = None
        self._active_session_id: str | None = None
        self._cancel_requested: bool = False

    # ── Public API ────────────────────────────────────────────────────────────

    def is_running(self) -> bool:
        """is_running implements function-level backend logic."""
        return self._active_task is not None and not self._active_task.done()

    def get_active_session_id(self) -> str | None:
        """get_active_session_id implements function-level backend logic."""
        return self._active_session_id if self.is_running() else None

    async def start_session(self, request: StartPairSweepRequest) -> SweepSession:
        """start_session implements function-level backend logic."""
        if self.is_running():
            raise BackendError("A sweep session is already running.", status_code=409)
        if self.backtest_runner.is_busy():
            raise BackendError("Backtest runner is busy.", status_code=409)

        # Get current pair selector state for pair_pool and locked_pairs
        pair_state = self.pair_selector.get_state()

        # Ensure max_open_trades is at least the number of locked pairs
        effective_max_open_trades = max(request.max_open_trades, len(pair_state.locked_pairs))

        # Use selected pairs as pool if available, otherwise available pairs
        pair_pool = list(pair_state.selected_pairs) if pair_state.selected_pairs else list(pair_state.available_pairs)

        # Download data for all pairs in the pool if requested
        if request.download_data_first and pair_pool:
            await self._download_data_for_pairs(
                request.config_file,
                request.timerange,
                request.timeframe,
                pair_pool,
            )

        session_id = str(uuid.uuid4())
        config = SweepSessionConfig(
            strategy_name=request.strategy_name,
            config_file=request.config_file,
            timerange=request.timerange,
            timeframe=request.timeframe,
            fee_rate=request.fee_rate,
            max_open_trades=effective_max_open_trades,
            dry_run_wallet=request.dry_run_wallet,
            iteration_count=request.iteration_count,
            pair_pool=pair_pool,
            locked_pairs=list(pair_state.locked_pairs),
        )
        session = SweepSession(
            session_id=session_id,
            strategy_name=request.strategy_name,
            config=config,
            phase=SweepPhase.RUNNING,
            created_at=utc_now(),
            total_iterations=request.iteration_count,
        )
        self.sweep_store.save_session(session)
        self._cancel_requested = False
        self._active_session_id = session_id
        self._active_task = asyncio.create_task(self._run_sweep(session_id))
        return session

    async def cancel_session(self, session_id: str) -> SweepSession:
        """cancel_session implements function-level backend logic."""
        session = self.sweep_store.load_session(session_id)
        if session is None:
            raise BackendError(f"Sweep session '{session_id}' not found.", status_code=404)
        if session.phase not in {SweepPhase.RUNNING}:
            return session
        self._cancel_requested = True
        # Also cancel the active backtest if it's for this session
        if self._active_session_id == session_id and self.backtest_runner.is_busy():
            run_id = self.backtest_runner.active_run_id
            if run_id:
                await self.backtest_runner.cancel(run_id)
        # Wait briefly for the task to notice the cancellation
        if self._active_task and not self._active_task.done():
            try:
                await asyncio.wait_for(asyncio.shield(self._active_task), timeout=3.0)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                pass
        # Reload and mark cancelled if still running
        session = self.sweep_store.load_session(session_id)
        if session and session.phase == SweepPhase.RUNNING:
            session = session.model_copy(
                update={
                    "phase": SweepPhase.CANCELLED,
                    "completed_at": utc_now(),
                    "stop_reason": "Cancelled by user",
                }
            )
            self.sweep_store.save_session(session)
        return session

    def recover_interrupted_sessions(self) -> None:
        """recover_interrupted_sessions implements function-level backend logic."""
        for session in self.sweep_store.list_running_sessions():
            session = session.model_copy(
                update={
                    "phase": SweepPhase.FAILED,
                    "stop_reason": "Interrupted by server restart",
                    "completed_at": utc_now(),
                }
            )
            self.sweep_store.save_session(session)

    # ── Internal ──────────────────────────────────────────────────────────────

    async def _download_data_for_pairs(
        self,
        config_file: str,
        timerange: str,
        timeframe: str,
        pairs: list[str],
    ) -> None:
        """Download data for all pairs in the pool before starting the sweep."""
        download_request = DownloadDataRequest(
            config_file=config_file,
            timerange=timerange,
            timeframes=[timeframe],
            pairs=pairs,
            prepend=False,
        )
        try:
            download_id = await self.data_download_runner.queue_download(download_request)
            # Wait for download to complete
            while self.data_download_runner.is_busy():
                await asyncio.sleep(1.0)
            status = self.data_download_runner.current_status()
            if status.get("status") == "failed":
                raise BackendError(
                    f"Data download failed: {status.get('error', 'Unknown error')}",
                    status_code=500,
                )
        except Exception as exc:
            raise BackendError(
                f"Failed to download data for pairs: {exc}",
                status_code=500,
            )

    async def _run_sweep(self, session_id: str) -> None:
        """_run_sweep implements function-level backend logic."""
        session = self.sweep_store.load_session(session_id)
        if session is None:
            return
        try:
            config = session.config
            pool = list(config.pair_pool)
            locked_set = set(config.locked_pairs)
            max_open_trades = config.max_open_trades
            total_iterations = session.total_iterations

            # Resolve strategy and version once — they don't change across iterations
            strategy = self.registry.get_strategy(config.strategy_name)
            pointer = self.version_manager.get_current_pointer(config.strategy_name)
            if pointer is None:
                raise BackendError(
                    f"Strategy '{config.strategy_name}' has no accepted version.",
                    status_code=400,
                )
            version_id = pointer.accepted_version_id

            # Use default config file if none provided
            config_file = config.config_file
            if not config_file:
                settings = self.settings_store.load()
                config_file = settings.default_config_file_path

            previous_pairs: list[str] | None = None

            for i in range(1, total_iterations + 1):
                # ── Cancel check ──────────────────────────────────────────
                if self._cancel_requested:
                    session = self.sweep_store.load_session(session_id)
                    session = session.model_copy(
                        update={
                            "phase": SweepPhase.CANCELLED,
                            "completed_at": utc_now(),
                            "stop_reason": "Cancelled by user",
                        }
                    )
                    self.sweep_store.save_session(session)
                    return

                # ── Wait for runner to be free ────────────────────────────
                while self.backtest_runner.is_busy():
                    if self._cancel_requested:
                        session = self.sweep_store.load_session(session_id)
                        session = session.model_copy(
                            update={
                                "phase": SweepPhase.CANCELLED,
                                "completed_at": utc_now(),
                                "stop_reason": "Cancelled by user",
                            }
                        )
                        self.sweep_store.save_session(session)
                        return
                    await asyncio.sleep(1.0)

                # ── Sample pairs ──────────────────────────────────────────
                sampled_pairs, warning = self._sample_pairs(
                    pool, locked_set, max_open_trades, previous_pairs
                )
                previous_pairs = sampled_pairs

                # ── Build RunRequest ──────────────────────────────────────
                run_request = RunRequest(
                    strategy_name=config.strategy_name,
                    version_id=version_id,
                    config_file=config_file,
                    timerange=config.timerange,
                    timeframe=config.timeframe,
                    pairs=sampled_pairs,
                    fee_rate=config.fee_rate,
                    max_open_trades=config.max_open_trades,
                    dry_run_wallet=config.dry_run_wallet,
                )

                # ── Queue backtest ────────────────────────────────────────
                run_id: str | None = None
                error: str | None = None
                started_at = utc_now()
                try:
                    run_id = await self.backtest_runner.queue_strategy_backtest(
                        strategy, version_id, run_request
                    )
                except Exception as exc:
                    error = str(exc)

                # ── Create iteration record ───────────────────────────────
                record = SweepIterationRecord(
                    iteration_number=i,
                    status=SweepIterationStatus.RUNNING if run_id else SweepIterationStatus.FAILED,
                    pairs=sampled_pairs,
                    run_id=run_id,
                    started_at=started_at,
                    warning=warning,
                    error=error,
                )
                session = self.sweep_store.load_session(session_id)
                session = session.model_copy(
                    update={"iterations": list(session.iterations) + [record]}
                )
                self.sweep_store.save_session(session)

                if run_id is None:
                    # Queue failed — count as failed iteration
                    session = self.sweep_store.load_session(session_id)
                    session = session.model_copy(
                        update={"failed_iterations": session.failed_iterations + 1}
                    )
                    session = self._update_timing(session)
                    self.sweep_store.save_session(session)
                    continue

                # ── Poll until terminal ───────────────────────────────────
                terminal_status: str | None = None
                poll_error: str | None = None
                poll_started_at = utc_now()
                missing_metadata_count = 0
                while True:
                    await asyncio.sleep(2.0)
                    if self._cancel_requested:
                        # Cancel the active backtest and mark session cancelled
                        try:
                            await self.backtest_runner.cancel(run_id)
                        except Exception:
                            pass
                        session = self.sweep_store.load_session(session_id)
                        # Update the in-progress record to cancelled
                        updated_iterations = [
                            rec.model_copy(
                                update={
                                    "status": SweepIterationStatus.CANCELLED,
                                    "completed_at": utc_now(),
                                }
                            )
                            if rec.iteration_number == i
                            else rec
                            for rec in session.iterations
                        ]
                        session = session.model_copy(
                            update={
                                "phase": SweepPhase.CANCELLED,
                                "completed_at": utc_now(),
                                "stop_reason": "Cancelled by user",
                                "iterations": updated_iterations,
                            }
                        )
                        self.sweep_store.save_session(session)
                        return
                    try:
                        metadata = self.run_repository.load_metadata(run_id)
                        missing_metadata_count = 0
                    except Exception as exc:
                        # Avoid hanging forever if the run metadata never materializes.
                        missing_metadata_count += 1
                        elapsed = (utc_now() - poll_started_at).total_seconds()
                        runner_idle = not self.backtest_runner.is_busy()
                        if elapsed > 45 or (runner_idle and missing_metadata_count >= 3):
                            terminal_status = "failed"
                            poll_error = f"Unable to read run metadata for '{run_id}': {exc}"
                            break
                        continue
                    if metadata.run_status in {"completed", "failed", "cancelled"}:
                        terminal_status = metadata.run_status
                        break
                    # Guard against indefinite non-terminal states.
                    elapsed = (utc_now() - poll_started_at).total_seconds()
                    if elapsed > 45:
                        terminal_status = "failed"
                        poll_error = (
                            f"Run '{run_id}' stayed non-terminal for {int(elapsed)}s "
                            f"(latest status: {metadata.run_status})."
                        )
                        break

                completed_at = utc_now()

                # ── Process result ────────────────────────────────────────
                session = self.sweep_store.load_session(session_id)
                if terminal_status == "completed":
                    metrics = self._extract_iteration_metrics(run_id)
                    updated_record = record.model_copy(
                        update={
                            "status": SweepIterationStatus.COMPLETED,
                            "completed_at": completed_at,
                            "metrics": metrics,
                        }
                    )
                    updated_iterations = [
                        updated_record if rec.iteration_number == i else rec
                        for rec in session.iterations
                    ]
                    session = session.model_copy(
                        update={
                            "iterations": updated_iterations,
                            "completed_iterations": session.completed_iterations + 1,
                        }
                    )
                else:
                    if poll_error is None:
                        poll_error = f"Backtest {terminal_status}"
                    updated_record = record.model_copy(
                        update={
                            "status": SweepIterationStatus.FAILED,
                            "completed_at": completed_at,
                            "error": poll_error,
                        }
                    )
                    updated_iterations = [
                        updated_record if rec.iteration_number == i else rec
                        for rec in session.iterations
                    ]
                    session = session.model_copy(
                        update={
                            "iterations": updated_iterations,
                            "failed_iterations": session.failed_iterations + 1,
                        }
                    )

                session = self._update_timing(session)
                self.sweep_store.save_session(session)

            # ── All iterations done ───────────────────────────────────────
            session = self.sweep_store.load_session(session_id)
            session = session.model_copy(
                update={
                    "phase": SweepPhase.COMPLETED,
                    "completed_at": utc_now(),
                }
            )
            self.sweep_store.save_session(session)

        except Exception as exc:
            session = self.sweep_store.load_session(session_id)
            if session:
                session = session.model_copy(
                    update={
                        "phase": SweepPhase.FAILED,
                        "completed_at": utc_now(),
                        "stop_reason": str(exc),
                    }
                )
                self.sweep_store.save_session(session)
        finally:
            self._active_task = None
            self._active_session_id = None
            self._cancel_requested = False

    def _update_timing(self, session: SweepSession) -> SweepSession:
        """_update_timing implements function-level backend logic."""
        if session.started_at is None:
            return session
        now = utc_now()
        elapsed = (now - session.started_at).total_seconds()
        completed = session.completed_iterations
        total = session.total_iterations
        eta: float | None = None
        if completed > 0 and total > completed:
            avg_per_iter = elapsed / completed
            eta = avg_per_iter * (total - completed)
        return session.model_copy(update={"elapsed_seconds": elapsed, "eta_seconds": eta})

    def _sample_pairs(
        self,
        pool: list[str],
        locked: set[str],
        max_open_trades: int,
        previous_subset: list[str] | None,
    ) -> tuple[list[str], str | None]:
        """_sample_pairs implements function-level backend logic."""
        warning: str | None = None

        # If pool is smaller than max_open_trades, use all pairs and warn
        if len(pool) < max_open_trades:
            result = list(dict.fromkeys(pool))  # deduplicated, preserving order
            warning = (
                f"Pair pool ({len(pool)}) is smaller than max_open_trades "
                f"({max_open_trades}); using all available pairs."
            )
            return result, warning

        def _do_sample() -> list[str]:
            # Start with locked pairs (deduplicated, preserving insertion order)
            """_do_sample implements function-level backend logic."""
            locked_in_pool = list(dict.fromkeys(p for p in pool if p in locked))
            remaining_slots = max_open_trades - len(locked_in_pool)

            if remaining_slots <= 0:
                # More locked pairs than slots — just return the first max_open_trades locked pairs
                return locked_in_pool[:max_open_trades]

            unlocked_pool = [p for p in pool if p not in locked]
            sampled_unlocked = random.sample(unlocked_pool, min(remaining_slots, len(unlocked_pool)))
            return locked_in_pool + sampled_unlocked

        result = _do_sample()

        # If result equals previous_subset, make one re-sample attempt
        if previous_subset is not None and sorted(result) == sorted(previous_subset):
            result = _do_sample()

        return result, warning

    def _extract_iteration_metrics(self, run_id: str) -> SweepIterationMetrics | None:
        """_extract_iteration_metrics implements function-level backend logic."""
        try:
            detail = self.run_repository.load_detail(run_id)
            summary = detail.parsed_summary
            if summary is None:
                return None
            return SweepIterationMetrics(
                net_profit_pct=summary.net_profit_pct,
                total_trades=summary.total_trades,
                win_rate_pct=summary.win_rate_pct,
                max_drawdown_pct=summary.max_drawdown_pct,
                profit_factor=summary.profit_factor,
            )
        except Exception:
            return None

    async def run_individual_pair_sweep(
        self,
        pairs: list[str],
        strategy_name: str,
        config_file: str,
        timerange: str,
        timeframe: str,
        fee_rate: float = 0.001,
        dry_run_wallet: float = 1000.0,
    ) -> list[dict]:
        """Test one strategy against each pair individually with max_open_trades=1.

        Runs a separate backtest for each pair with max_open_trades=1,
        collects per-pair metrics, scores, and returns results sorted descending.

        Returns a list of dicts, each with:
            pair, status, rejection_reason, score,
            total_trades, profit_factor, win_rate, max_drawdown, expectancy, profit_total
        """
        pool = list(dict.fromkeys(pairs))
        if not pool:
            return []

        strategy = self.registry.get_strategy(strategy_name)
        pointer = self.version_manager.get_current_pointer(strategy_name)
        if pointer is None:
            raise BackendError(
                f"Strategy '{strategy_name}' has no accepted version.",
                status_code=400,
            )
        version_id = pointer.accepted_version_id

        effective_config = config_file
        if not effective_config:
            settings = self.settings_store.load()
            effective_config = settings.default_config_file_path

        results: list[dict] = []

        for pair in pool:
            entry: dict = {
                "pair": pair,
                "status": "failed",
                "rejection_reason": None,
                "score": 0.0,
                "total_trades": None,
                "profit_factor": None,
                "win_rate": None,
                "max_drawdown": None,
                "expectancy": None,
                "profit_total": None,
            }

            run_request = RunRequest(
                strategy_name=strategy_name,
                version_id=version_id,
                config_file=effective_config,
                timerange=timerange,
                timeframe=timeframe,
                pairs=[pair],
                fee_rate=fee_rate,
                max_open_trades=1,
                dry_run_wallet=dry_run_wallet,
            )

            try:
                run_id = await self.backtest_runner.queue_strategy_backtest(
                    strategy, version_id, run_request
                )
            except Exception as exc:
                entry["status"] = "backtest_failed"
                entry["rejection_reason"] = str(exc)
                results.append(entry)
                continue

            # Poll until terminal
            terminal_status: str | None = None
            poll_start = utc_now()
            while True:
                await asyncio.sleep(1.0)
                try:
                    metadata = self.run_repository.load_metadata(run_id)
                except Exception:
                    if (utc_now() - poll_start).total_seconds() > 30:
                        terminal_status = "failed"
                        entry["rejection_reason"] = "Could not load metadata within 30s"
                    else:
                        continue
                    break

                if metadata.run_status == RunStatus.COMPLETED:
                    terminal_status = "completed"
                    break
                if metadata.run_status in (RunStatus.FAILED, RunStatus.CANCELLED):
                    terminal_status = str(metadata.run_status)
                    break

                if (utc_now() - poll_start).total_seconds() > 60:
                    terminal_status = "failed"
                    entry["rejection_reason"] = "Backtest timed out after 60s"
                    break

            if terminal_status != "completed":
                entry["status"] = "backtest_failed"
                entry["rejection_reason"] = (
                    entry.get("rejection_reason") or f"Backtest {terminal_status}"
                )
                results.append(entry)
                continue

            # Extract metrics from completed backtest
            try:
                detail = self.run_repository.load_detail(run_id)
            except Exception:
                entry["status"] = "data_quality_failed"
                entry["rejection_reason"] = "Could not load backtest detail"
                results.append(entry)
                continue

            summary = detail.parsed_summary
            if summary is None:
                entry["status"] = "data_quality_failed"
                entry["rejection_reason"] = "No parsed summary — data may be missing"
                results.append(entry)
                continue

            total_trades = summary.total_trades or 0
            profit_factor = summary.profit_factor
            win_rate = summary.win_rate_pct
            max_drawdown = summary.max_drawdown_pct
            expectancy = summary.expectancy
            profit_total = summary.net_profit_pct

            entry["total_trades"] = total_trades
            entry["profit_factor"] = profit_factor
            entry["win_rate"] = win_rate
            entry["max_drawdown"] = max_drawdown
            entry["expectancy"] = expectancy
            entry["profit_total"] = profit_total

            if total_trades == 0:
                entry["status"] = "data_quality_failed"
                entry["rejection_reason"] = "No trades generated for this pair"
                results.append(entry)
                continue

            if profit_factor is None:
                entry["status"] = "data_quality_failed"
                entry["rejection_reason"] = "Profit factor is missing"
                results.append(entry)
                continue

            if profit_factor < 1.0:
                entry["status"] = "failed"
                entry["rejection_reason"] = f"Profit factor {profit_factor:.2f} below 1.0"
                results.append(entry)
                continue

            # Score: profit_factor * win_rate / max(0.01, max_drawdown)
            # win_rate and max_drawdown are already in percentage points (e.g. 50.0, 25.0)
            safe_dd = max(0.01, max_drawdown or 0.01)
            pf = profit_factor or 0.0
            wr = win_rate or 0.0
            score = pf * wr / safe_dd

            entry["status"] = "passed"
            entry["score"] = round(score, 6)
            results.append(entry)

        results.sort(key=lambda r: r["score"], reverse=True)
        return results


def run_portfolio_backtest(
    *,
    strategy_path: str,
    strategy_name: str,
    config_file: str,
    timerange: str,
    timeframe: str,
    pairs: list[str],
    max_open_trades: int = 5,
    dry_run_wallet: float = 1000.0,
    user_data_dir: str,
    exchange: str = "binance",
    freqtrade_executable_path: str = "freqtrade",
) -> dict:
    """Run a single joint portfolio backtest on all provided pairs with capital constraints.

    Parameters
    ----------
    pairs : list[str]
        Top-N ranked pairs to test together (must not be empty).
    strategy_path : str
        Path to the strategy .py file on disk.
    strategy_name : str
        Strategy class name (for --strategy flag).
    config_file : str
        Path to Freqtrade config JSON.
    timerange : str
        Backtest timerange (e.g. ``"20240101-20240131"``).
    timeframe : str
        Candle timeframe (e.g. ``"5m"``).
    max_open_trades : int
        Capital constraint — max simultaneous open trades.
    dry_run_wallet : float
        Starting wallet balance.
    user_data_dir : str
        Resolved user_data directory path.
    exchange : str
        Exchange name (default "binance").
    freqtrade_executable_path : str
        Path to the freqtrade binary.

    Returns
    -------
    dict
        ``{
            "status": "passed" | "failed" | "backtest_failed",
            "failure_reasons": list[str],
            "run_id": str | None,
            "portfolio_summary": dict,
            "per_pair_metrics": list[dict],
            "config_used": dict,
        }``
    """
    if not pairs:
        raise ValueError("pairs must not be empty")
    if max_open_trades < 1:
        raise ValueError("max_open_trades must be >= 1")

    strategy_file = Path(strategy_path)
    if not strategy_file.exists():
        return {
            "status": "backtest_failed",
            "failure_reasons": [f"Strategy file not found: {strategy_path}"],
            "run_id": None,
            "portfolio_summary": {},
            "per_pair_metrics": [],
            "config_used": {
                "pairs_count": len(pairs),
                "max_open_trades": max_open_trades,
                "timerange": timerange,
                "timeframe": timeframe,
            },
        }

    strategy_source = strategy_file.read_text(encoding="utf-8")
    now = utc_now()
    run_id = f"portfolio_{now.strftime('%Y%m%d_%H%M%S')}_{strategy_name}"
    run_dir = Path(user_data_dir) / "portfolio_backtest" / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    (run_dir / "strategy_snapshot.py").write_text(strategy_source, encoding="utf-8")

    unique_pairs = list(dict.fromkeys(pairs))
    command = [
        freqtrade_executable_path, "backtesting",
        "--user-data-dir", user_data_dir,
        "--config", config_file,
        "--strategy-path", str(run_dir),
        "--strategy", strategy_name,
        "--timerange", timerange,
        "--timeframe", timeframe,
        "--dry-run-wallet", str(dry_run_wallet),
        "--max-open-trades", str(max_open_trades),
        "--export", "trades",
        "--export-filename", str(run_dir / "raw_result.json"),
        "--pairs", *unique_pairs,
    ]

    try:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()
        return_code = process.returncode
        if stdout:
            (run_dir / "stdout.log").write_text(stdout.decode(errors="replace"), encoding="utf-8")
        if stderr:
            (run_dir / "stderr.log").write_text(stderr.decode(errors="replace"), encoding="utf-8")
    except Exception as exc:
        return {
            "status": "backtest_failed",
            "failure_reasons": [f"Subprocess execution failed: {exc}"],
            "run_id": None,
            "portfolio_summary": {},
            "per_pair_metrics": [],
            "config_used": {
                "pairs_count": len(pairs),
                "max_open_trades": max_open_trades,
                "timerange": timerange,
                "timeframe": timeframe,
            },
        }

    if return_code != 0:
        return {
            "status": "backtest_failed",
            "failure_reasons": [f"Freqtrade exited with code {return_code}"],
            "run_id": None,
            "portfolio_summary": {},
            "per_pair_metrics": [],
            "config_used": {
                "pairs_count": len(pairs),
                "max_open_trades": max_open_trades,
                "timerange": timerange,
                "timeframe": timeframe,
            },
        }

    raw_result_path = run_dir / "raw_result.json"
    if not raw_result_path.exists():
        return {
            "status": "backtest_failed",
            "failure_reasons": ["raw_result.json not produced by Freqtrade"],
            "run_id": None,
            "portfolio_summary": {},
            "per_pair_metrics": [],
            "config_used": {
                "pairs_count": len(pairs),
                "max_open_trades": max_open_trades,
                "timerange": timerange,
                "timeframe": timeframe,
            },
        }

    metadata = RunMetadata(
        run_id=run_id,
        strategy_name=strategy_name,
        strategy_version_id="portfolio",
        parent_version_id=None,
        baseline_run_id=None,
        run_type=RunType.BASELINE,
        run_status=RunStatus.COMPLETED,
        created_at=now,
        completed_at=utc_now(),
        freqtrade_exit_code=return_code,
        config_file=config_file,
        timerange=timerange,
        timeframe=timeframe,
        pairs=unique_pairs,
        max_open_trades=max_open_trades,
        dry_run_wallet=dry_run_wallet,
    )

    parser = ResultParser()
    try:
        summary, pair_results = parser.parse_run_artifacts(run_dir, metadata)
    except Exception as exc:
        return {
            "status": "backtest_failed",
            "failure_reasons": [f"Failed to parse backtest results: {exc}"],
            "run_id": run_id,
            "portfolio_summary": {},
            "per_pair_metrics": [],
            "config_used": {
                "pairs_count": len(pairs),
                "max_open_trades": max_open_trades,
                "timerange": timerange,
                "timeframe": timeframe,
            },
        }

    portfolio_summary = {
        "total_trades": summary.total_trades,
        "profit_factor": summary.profit_factor,
        "win_rate_pct": summary.win_rate_pct,
        "max_drawdown_pct": summary.max_drawdown_pct,
        "sharpe_ratio": summary.sharpe_ratio,
        "expectancy": summary.expectancy,
        "profit_total_pct": summary.net_profit_pct,
        "profit_total_abs": summary.net_profit_currency,
    }

    per_pair_metrics = [
        {
            "pair": pr.pair,
            "trades": pr.total_trades,
            "profit_factor": pr.net_profit_pct,
            "win_rate_pct": pr.win_rate_pct,
        }
        for pr in pair_results
    ]

    metrics_for_rules = {
        "total_trades": summary.total_trades,
        "profit_factor": summary.profit_factor,
        "win_rate_pct": summary.win_rate_pct,
        "max_drawdown_pct": summary.max_drawdown_pct,
        "sharpe_ratio": summary.sharpe_ratio,
        "expectancy": summary.expectancy,
    }
    failure_reasons = _apply_gate_rules(metrics_for_rules)
    status = "passed" if not failure_reasons else "failed"

    return {
        "status": status,
        "failure_reasons": failure_reasons,
        "run_id": run_id,
        "portfolio_summary": portfolio_summary,
        "per_pair_metrics": per_pair_metrics,
        "config_used": {
            "pairs_count": len(pairs),
            "max_open_trades": max_open_trades,
            "timerange": timerange,
            "timeframe": timeframe,
        },
    }


def decide_final_pair_set(
    individual_results: list[dict],
    portfolio_result: dict,
    risk_profile: str = "balanced",
    min_approved_pairs: int = 3,
    max_approved_pairs: int = 5,
) -> dict:
    """Decide the final approved pair set from individual + portfolio results.

    Pure rule-based decision helper. No AI, no side effects, no backtests.
    """
    valid_profiles = {"low", "balanced", "aggressive"}
    if risk_profile not in valid_profiles:
        risk_profile = "balanced"

    empty_result = {
        "verdict": "rejected",
        "approved_pairs": [],
        "approved_count": 0,
        "min_approved_pairs": min_approved_pairs,
        "max_approved_pairs": max_approved_pairs,
        "risk_profile": risk_profile,
        "rejection_reason": None,
        "combined_scores": [],
        "portfolio_verdict": portfolio_result.get("status", "unknown"),
        "portfolio_failure_reasons": portfolio_result.get("failure_reasons", []),
    }

    # Quick reject: portfolio backtest failed to execute
    if portfolio_result.get("status") == "backtest_failed":
        return {**empty_result, "rejection_reason": "Portfolio backtest failed to execute"}

    # Portfolio-level override: specific failures reject the whole set
    portfolio_failures = set(portfolio_result.get("failure_reasons", []))
    if portfolio_result.get("status") == "failed" and (
        "MIN_PROFIT_FACTOR" in portfolio_failures or "MAX_DRAWDOWN" in portfolio_failures
    ):
        return {**empty_result, "rejection_reason": "Portfolio backtest failed critical thresholds"}

    # Filter individual results to passed only
    passed = [r for r in individual_results if r.get("status") == "passed"]
    if not passed:
        return {**empty_result, "rejection_reason": "No individual pairs passed screening"}

    # Build portfolio lookup by pair
    portfolio_lookup: dict[str, dict] = {}
    for ppm in portfolio_result.get("per_pair_metrics", []):
        pair_name = ppm.get("pair", "")
        if pair_name:
            portfolio_lookup[pair_name] = ppm

    # Define risk-profile filter rules
    def _risk_filter_rule(ind: dict) -> bool:
        dd = ind.get("max_drawdown")
        safe_dd = dd if dd is not None else float("inf")
        ind_trades = ind.get("total_trades", 0) or 0
        pair = ind.get("pair", "")
        port_data = portfolio_lookup.get(pair, {})

        if risk_profile == "low":
            if safe_dd >= 15:
                return False
            port_trades = port_data.get("trades", 0) or 0
            port_profit = port_data.get("profit_factor")
            if port_trades == 0:
                return False
            if port_profit is not None and port_profit <= 0:
                return False
            return True

        if risk_profile == "aggressive":
            if safe_dd >= 35:
                return False
            if ind_trades == 0:
                return False
            return True

        # balanced (default)
        if safe_dd >= 25:
            return False
        port_trades = port_data.get("trades", 0) or 0
        port_profit = port_data.get("profit_factor")
        if port_trades == 0 and (port_profit is not None and port_profit < 0):
            return False
        return True

    def _portfolio_penalty(ind: dict) -> float:
        pair = ind.get("pair", "")
        port_data = portfolio_lookup.get(pair, {})
        if not port_data:
            return 0.8
        port_trades = port_data.get("trades", 0) or 0
        port_profit = port_data.get("profit_factor")
        if port_trades > 0 and port_profit is not None and port_profit > 0:
            return 1.0
        if port_trades > 0 and port_profit is not None and port_profit <= 0:
            return 0.5
        if port_trades == 0:
            return 0.3
        return 0.8

    combined_scores: list[dict] = []
    for ind in passed:
        indiv_score = ind.get("score", 0.0) or 0.0
        penalty = _portfolio_penalty(ind)
        combined = indiv_score * penalty
        dd = ind.get("max_drawdown")
        pair = ind.get("pair", "")
        port_data = portfolio_lookup.get(pair, {})
        survived = _risk_filter_rule(ind)

        combined_scores.append({
            "pair": pair,
            "individual_score": round(indiv_score, 6),
            "portfolio_penalty": penalty,
            "combined_score": round(combined, 6),
            "individual_max_drawdown": dd,
            "portfolio_trades": port_data.get("trades") if port_data else None,
            "portfolio_profit_factor": port_data.get("profit_factor") if port_data else None,
            "survived_risk_filter": survived,
        })

    # Filter survivors and rank by combined score descending
    survivors = [s for s in combined_scores if s["survived_risk_filter"]]
    survivors.sort(key=lambda s: s["combined_score"], reverse=True)

    if len(survivors) < min_approved_pairs:
        return {
            **empty_result,
            "combined_scores": combined_scores,
            "rejection_reason": (
                f"Only {len(survivors)} pair(s) qualified (minimum {min_approved_pairs})"
            ),
        }

    approved = survivors[:max_approved_pairs]
    return {
        **empty_result,
        "verdict": "approved",
        "approved_pairs": [s["pair"] for s in approved],
        "approved_count": len(approved),
        "combined_scores": combined_scores,
        "rejection_reason": None,
    }
