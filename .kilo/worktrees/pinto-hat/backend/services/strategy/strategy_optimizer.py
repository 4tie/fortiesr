"""Systematic strategy optimizer service.

This module runs many backtest trials with different parameter combinations,
tracks per-trial metrics, scores candidates, and stores optimizer session history.
"""

from __future__ import annotations
import asyncio
from datetime import datetime
from typing import Any, Callable

from ...core.errors import BackendError
from ...models import (
    OptimizerScoreMetric,
    OptimizerScoreWeights,
    OptimizerSession,
    OptimizerSessionConfig,
    OptimizerSessionPhase,
    OptimizerTrial,
    OptimizerTrialMetrics,
    OptimizerTrialStatus,
    ParameterSearchSpace,
    ParamsSchema,
    RunRequest,
    StartOptimizerRequest,
)
from ...utils import utc_now
from ..execution.backtest_runner import BacktestRunner
from ..storage.optimizer_store import OptimizerStore
from ..storage.run_repository import RunRepository
from .optimizer_search_spaces import OptimizerSearchSpaceBuilder
from .optimizer_session import OptimizerSessionManager
from .optimizer_trial import OptimizerTrialExecutor
from .strategy_optimizer_search import select_parameters_for_trial
from .strategy_registry import StrategyRegistry
from .strategy_source import StrategySourceParser


class StrategyOptimizerService:
    """Runs systematic multi-trial parameter optimization for a strategy."""

    def __init__(
        self,
        optimizer_store: OptimizerStore,
        backtest_runner: BacktestRunner,
        run_repository: RunRepository,
        registry: StrategyRegistry,
        settings_store: SettingsStore,
        version_manager: Any,
        source_parser: StrategySourceParser,
    ) -> None:
        """Store all optimizer dependencies and in-memory task state."""
        self.optimizer_store = optimizer_store
        self.backtest_runner = backtest_runner
        self.run_repository = run_repository
        self.registry = registry
        self.settings_store = settings_store
        self.version_manager = version_manager
        self._source_parser = source_parser
        self._active_task: asyncio.Task | None = None
        self._active_session_id: str | None = None
        self._cancel_requested: bool = False
        self._progress_callback: Callable[[dict], None] | None = None
        self._log_callback: Callable[[str], None] | None = None
         
        # Initialize helper modules
        self.session_manager = OptimizerSessionManager(
            optimizer_store, registry, version_manager
        )
        self.trial_executor = OptimizerTrialExecutor(
            backtest_runner, run_repository, version_manager
        )
        self.search_space_builder = OptimizerSearchSpaceBuilder(
            registry, source_parser
        )

    # ── Public API ────────────────────────────────────────────────────────────

    def set_log_callback(self, callback: Callable[[str], None] | None) -> None:
        """Register an external log sink (e.g. the SSE broadcaster)."""
        self._log_callback = callback

    def is_running(self) -> bool:
        """Tell callers whether an optimizer session worker is currently running."""
        return self._active_task is not None and not self._active_task.done()

    def get_active_session_id(self) -> str | None:
        """Return the active session id so callers can resume polling."""
        return self._active_session_id if self.is_running() else None

    def build_search_spaces_from_strategy(
        self, strategy_name: str
    ) -> list[ParameterSearchSpace]:
        """Extract parameter definitions from the strategy and build default search spaces."""
        return self.search_space_builder.build_search_spaces_from_strategy(strategy_name)

    async def start_session(self, request: StartOptimizerRequest) -> OptimizerSession:
        """Create a new optimizer session record and start its async execution loop."""
        if self.is_running():
            raise BackendError("An optimizer session is already running.", status_code=409)

        session = self.session_manager.create_session(request)
        self._cancel_requested = False
        self._active_session_id = session.session_id
        self._active_task = asyncio.create_task(self._run_session(session.session_id))
        return session

    async def cancel_session(self, session_id: str) -> OptimizerSession:
        """Request cancellation, stop active backtests when possible, and persist terminal state."""
        session = self.session_manager.load_session(session_id)
        if session is None:
            raise BackendError(f"Optimizer session '{session_id}' not found.", status_code=404)
        if session.phase not in {OptimizerSessionPhase.RUNNING, OptimizerSessionPhase.IDLE}:
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
        session = self.session_manager.load_session(session_id)
        if session and session.phase == OptimizerSessionPhase.RUNNING:
            session = self.session_manager.mark_session_cancelled(session_id)
        return session

    def start_session_sync(
        self,
        request: StartOptimizerRequest,
        progress_callback: Any | None = None,
        log_callback: Any | None = None,
    ) -> OptimizerSession:
        """Synchronous wrapper for start_session - runs async method in event loop.

        This method runs the session to completion synchronously, blocking until
        all trials are complete. It uses asyncio.run() to execute both the
        session startup and the full trial execution loop.
        """
        # Store callbacks for use in _emit_log and progress emission
        self._progress_callback = progress_callback
        self._log_callback = log_callback
        
        # Run the full session asynchronously - setup and execution
        async def run_full_session() -> OptimizerSession:
            session = await self.start_session(request)
            # Wait for the session execution task to complete
            if self._active_task:
                await self._active_task
            return session

        return asyncio.run(run_full_session())

    def cancel_session_sync(self, session_id: str) -> OptimizerSession:
        """Synchronous wrapper for cancel_session - runs async method in event loop."""
        return asyncio.run(self.cancel_session(session_id))

    def _emit_log(self, message: str) -> None:
        """Emit a log message via the session manager's callback if set."""
        if self._log_callback is not None:
            try:
                self._log_callback(message)
            except Exception:
                pass  # Ignore callback errors to avoid disrupting execution
        if self.session_manager.log_callback is not None:
            try:
                self.session_manager.log_callback(message)
            except Exception:
                pass  # Ignore callback errors to avoid disrupting execution

    # ── Internal execution loop ───────────────────────────────────────────────

    async def _run_session(self, session_id: str) -> None:
        """Execute trial-by-trial optimization until completion, failure, or cancellation."""
        session = self.session_manager.load_session(session_id)
        if session is None:
            return
        try:
            session = self.session_manager.mark_session_running(session_id)
            self._emit_log(f"[Session] Starting optimizer session {session_id}")

            enabled_spaces = [s for s in session.config.search_spaces if s.enabled]
            if not enabled_spaces:
                raise BackendError("No enabled parameter search spaces defined.", status_code=400)

            for trial_number in range(1, session.config.total_trials + 1):
                if self._cancel_requested:
                    session = self.session_manager.mark_session_cancelled(session_id)
                    self._emit_log(f"[Session] Session cancelled at trial {trial_number}")
                    return

                params = self._select_parameters_for_trial(session, enabled_spaces, trial_number)
                trial = OptimizerTrial(
                    trial_number=trial_number,
                    status=OptimizerTrialStatus.RUNNING,
                    parameters=params,
                    started_at=utc_now(),
                )
                session = self.session_manager.load_session(session_id)
                trials = list(session.trials) + [trial]
                session = session.model_copy(update={"trials": trials})
                self.session_manager.save_session(session)
                self._emit_log(f"[Trial #{trial_number}] Starting with parameters: {params}")

                # Run the backtest for this trial
                run_id, error = await self._run_trial_backtest(session, trial)
                session = self.session_manager.load_session(session_id)

                if error or run_id is None:
                    self._emit_log(f"[Trial #{trial_number}] Failed: {error or 'Backtest did not produce a run_id'}")
                    trial = trial.model_copy(
                        update={
                            "status": OptimizerTrialStatus.FAILED,
                            "completed_at": utc_now(),
                            "error": error or "Backtest did not produce a run_id",
                        }
                    )
                    session = self._update_trial(session, trial)
                    session = session.model_copy(
                        update={"failed_trials": session.failed_trials + 1}
                    )
                    self.session_manager.save_session(session)
                    continue

                # Parse metrics from the completed run
                metrics = self.trial_executor.extract_trial_metrics(run_id, session.config.score_metric, session.config.score_weights)
                if metrics is None:
                    self._emit_log(f"[Trial #{trial_number}] Failed: Metrics could not be extracted")
                    trial = trial.model_copy(
                        update={
                            "status": OptimizerTrialStatus.FAILED,
                            "completed_at": utc_now(),
                            "run_id": run_id,
                            "error": "Run completed but metrics could not be extracted.",
                        }
                    )
                    session = self._update_trial(session, trial)
                    session = session.model_copy(
                        update={"failed_trials": session.failed_trials + 1}
                    )
                    self.session_manager.save_session(session)
                    continue

                score = metrics.score
                trial = trial.model_copy(
                    update={
                        "status": OptimizerTrialStatus.COMPLETED,
                        "completed_at": utc_now(),
                        "run_id": run_id,
                        "metrics": metrics,
                    }
                )
                session = self._update_trial(session, trial)
                session = session.model_copy(
                    update={"completed_trials": session.completed_trials + 1}
                )
                self._emit_log(f"[Trial #{trial_number}] Completed - Score: {score:.2f}, Profit: {metrics.net_profit_pct:.2f}%, Trades: {metrics.total_trades}")

                # Update best trial
                if score is not None:
                    current_best = session.best_metrics
                    if current_best is None or (current_best.score is not None and score > current_best.score):
                        self._emit_log(f"[Trial #{trial_number}] ★ NEW BEST SCORE: {score:.2f}")
                        # Mark all previous best trials as not best
                        updated_trials = [
                            t.model_copy(update={"is_best": False}) for t in session.trials
                        ]
                        # Mark this trial as best
                        updated_trials = [
                            t.model_copy(update={"is_best": True}) if t.trial_number == trial_number else t
                            for t in updated_trials
                        ]
                        session = session.model_copy(
                            update={
                                "trials": updated_trials,
                                "best_trial_number": trial_number,
                                "best_metrics": metrics,
                            }
                        )

                # Update elapsed/ETA
                session = self._update_timing(session)
                self.session_manager.save_session(session)
                
                # Emit progress update
                if self._progress_callback is not None:
                    try:
                        progress_data = {
                            "trial_number": trial_number,
                            "total": session.config.total_trials,
                            "result": {
                                "status": "completed" if trial.status == OptimizerTrialStatus.COMPLETED else "failed",
                                "score": trial.metrics.score if trial.metrics else None,
                                "profit_pct": trial.metrics.net_profit_pct if trial.metrics else None,
                                "win_rate_pct": trial.metrics.win_rate_pct if trial.metrics else None,
                                "max_drawdown_pct": trial.metrics.max_drawdown_pct if trial.metrics else None,
                                "total_trades": trial.metrics.total_trades if trial.metrics else None,
                                "profit_factor": trial.metrics.profit_factor if trial.metrics else None,
                                "sharpe_ratio": trial.metrics.sharpe_ratio if trial.metrics else None,
                            }
                        }
                        self._progress_callback(progress_data)
                    except Exception:
                        pass  # Ignore callback errors to avoid disrupting execution

            # All trials done
            session = self.session_manager.mark_session_completed(session_id)
            self._emit_log(f"[Session] Completed - {session.completed_trials} trials successful, {session.failed_trials} failed")

        except Exception as exc:
            self._emit_log(f"[Session] Failed with error: {exc}")
            session = self.session_manager.mark_session_failed(session_id, str(exc))
        finally:
            self._active_task = None
            self._active_session_id = None
            self._cancel_requested = False

    async def _run_trial_backtest(
        self, session: OptimizerSession, trial: OptimizerTrial
    ) -> tuple[str | None, str | None]:
        """Run a single trial backtest with trial parameters injected. Returns (run_id, error_message)."""
        config = session.config
        trial_version_id: str | None = None
        try:
            # Wait for backtest runner to be free
            wait_attempts = 0
            while self.backtest_runner.is_busy() and wait_attempts < 120:
                if self._cancel_requested:
                    return None, "Cancelled"
                await asyncio.sleep(1.0)
                wait_attempts += 1
            if self.backtest_runner.is_busy():
                return None, "Backtest runner still busy after timeout"

            strategy = self.registry.get_strategy(config.strategy_name)
            
            # Get the version manager to create a temporary trial version
            version_manager = self.version_manager
            
            # Get current accepted version
            pointer = version_manager.get_current_pointer(config.strategy_name)
            if pointer is None:
                return None, "Strategy has no accepted version"
            
            parent_version_id = pointer.accepted_version_id
            
            # Load parent version source and params
            parent_source = version_manager.load_strategy_source(config.strategy_name, parent_version_id)
            parent_params = version_manager.load_params(config.strategy_name, parent_version_id)
            
            # Build trial-specific params by merging trial parameters into buy_params/sell_params
            trial_params = self.trial_executor.build_trial_params(parent_params, trial.parameters)
            if trial_params == parent_params:
                return None, "Trial parameters did not change any strategy values"
            
            # Create a temporary trial version with modified params
            trial_version = self.trial_executor.create_trial_version(
                config.strategy_name,
                parent_version_id,
                parent_source,
                trial_params,
                trial.trial_number,
            )
            trial_version_id = trial_version.version_id
            
            # Use default config file if none provided
            config_file = config.config_file
            if not config_file:
                settings = self.settings_store.load()
                config_file = settings.default_config_file_path
            
            # Run backtest with the trial version
            run_request = RunRequest(
                strategy_name=config.strategy_name,
                version_id=trial_version_id,
                config_file=config_file,
                timerange=config.timerange,
                timeframe=config.timeframe,
                pairs=config.pairs if config.pairs else None,
                fee_rate=config.fee_rate,
                max_open_trades=config.max_open_trades,
                dry_run_wallet=config.dry_run_wallet,
            )
            
            run_id = await self.backtest_runner.queue_strategy_backtest(
                strategy, trial_version_id, run_request
            )
            
            # Wait for it to complete with timeout and better error handling
            timeout_attempts = 180  # 6 minutes max (180 * 2 seconds)
            consecutive_failures = 0
            max_consecutive_failures = 5
            
            while timeout_attempts > 0:
                if self._cancel_requested:
                    await self.backtest_runner.cancel(run_id)
                    return None, "Cancelled"
                
                await asyncio.sleep(2.0)
                
                try:
                    metadata = self.run_repository.load_metadata(run_id)
                    consecutive_failures = 0  # Reset on successful load
                    
                    # Check if the backtest actually started
                    if metadata.run_status == "running" and not hasattr(metadata, 'freqtrade_exit_code'):
                        # Check if backtest runner is actually busy and run_id matches
                        current_run_id = self.backtest_runner.get_current_run_id()
                        if current_run_id != run_id:
                            # Backtest runner is running a different trial - this shouldn't happen
                            return None, f"Backtest runner ID mismatch: expected {run_id}, got {current_run_id}"
                        
                        if not self.backtest_runner.is_busy():
                            # Backtest runner is idle but metadata shows running - likely failed silently
                            return None, "Backtest failed to start - runner idle"
                    
                    if metadata.run_status in {"completed", "failed", "cancelled"}:
                        if metadata.run_status == "completed":
                            return run_id, None
                        reason = self.trial_executor.extract_run_failure_reason(run_id)
                        return None, f"Backtest {metadata.run_status}: {reason}"
                        
                except Exception as e:
                    consecutive_failures += 1
                    if consecutive_failures >= max_consecutive_failures:
                        return None, f"Failed to load metadata after {max_consecutive_failures} consecutive attempts: {e}"
                    timeout_attempts -= 1
                    if timeout_attempts <= 0:
                        return None, f"Failed to load metadata after timeout: {e}"
                    continue
                
                timeout_attempts -= 1
                
            # If we reach here, the trial timed out
            # Try to cancel the hanging backtest
            try:
                await self.backtest_runner.cancel(run_id)
            except Exception:
                pass  # Ignore cancellation errors
                
            return None, "Backtest timed out after 6 minutes"
        except Exception as exc:
            return None, str(exc)
        finally:
            # Clean up the temporary trial version
            if trial_version_id:
                try:
                    self.version_manager.reject_version(trial_version_id, "Trial completed")
                except Exception:
                    pass  # Ignore cleanup errors

    def _select_parameters_for_trial(
        self,
        session: OptimizerSession,
        spaces: list[ParameterSearchSpace],
        trial_number: int,
    ) -> dict[str, Any]:
        """Choose the next trial parameter set from the configured search strategy."""
        return select_parameters_for_trial(session, spaces, trial_number)

    def _update_trial(self, session: OptimizerSession, trial: OptimizerTrial) -> OptimizerSession:
        """Update one trial entry inside a session and persist the session."""
        trials = [t if t.trial_number != trial.trial_number else trial for t in session.trials]
        return session.model_copy(update={"trials": trials})

    def _update_timing(self, session: OptimizerSession) -> OptimizerSession:
        """Recalculate elapsed time and ETA shown in optimizer progress."""
        if session.started_at is None:
            return session
        now = utc_now()
        elapsed = (now - session.started_at).total_seconds()
        completed = session.completed_trials
        total = session.total_trials
        eta: float | None = None
        if completed > 0 and total > completed:
            avg_per_trial = elapsed / completed
            eta = avg_per_trial * (total - completed)
        return session.model_copy(update={"elapsed_seconds": elapsed, "eta_seconds": eta})

