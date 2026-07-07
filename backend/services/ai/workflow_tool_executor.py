"""Workflow tool executor - explicit dispatch for validated tool calls.

This executor:
- Receives validated WorkflowToolCall
- Resolves tool spec from registry
- Enforces server-side policy
- Executes only allowlisted handlers
- Uses existing application workflows
- Normalizes results
- Produces context patches
- Records tool execution
- Returns structured failures instead of hiding them
"""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable

from ...core.errors import BackendError
from .copilot_session_store import CopilotSessionStore
from .workflow_tool_models import (
    EditStrategySectionArgs,
    InspectAppStructureArgs,
    JobReference,
    ListStrategiesArgs,
    ReadStrategyFileArgs,
    RunBacktestArgs,
    RunOptimizerArgs,
    RunPairExplorerArgs,
    ToolRunStatus,
    ToolSafety,
    ValidateStrategySyntaxArgs,
    ViewBestParamsArgs,
    ViewTrialParamsArgs,
    WorkflowToolCall,
    WorkflowToolResult,
)
from .workflow_tool_registry import (
    calculate_arguments_hash,
    get_handler_name,
    get_tool_safety,
    is_long_running,
    validate_tool_arguments,
)

if TYPE_CHECKING:
    from ...api.session_store import SessionStore


# Progress callback type
ProgressCallback = Callable[[str, dict[str, Any]], None]


class WorkflowToolExecutor:
    """Explicit executor for workflow tools with server-side policy enforcement."""

    MAX_TOOL_RESULT_SIZE = 100_000  # Characters

    def __init__(
        self,
        services,
        session_store: SessionStore,
        copilot_store: CopilotSessionStore,
        root_dir: Path | None = None,
    ):
        self.services = services
        self.session_store = session_store
        self.copilot_store = copilot_store
        self.root_dir = root_dir or Path.cwd()

    async def execute(
        self,
        *,
        tool_call: WorkflowToolCall,
        copilot_session_id: str,
        confirmed: bool = False,
        progress_callback: ProgressCallback | None = None,
    ) -> WorkflowToolResult:
        """Execute a validated tool call.
        
        Args:
            tool_call: Validated tool call with name, arguments, safety
            copilot_session_id: Copilot session ID for context
            confirmed: Whether user has confirmed this action
            progress_callback: Optional callback for progress updates
        
        Returns:
            WorkflowToolResult with status, result_summary, context_patch, error
        """
        tool_run_id = tool_call.tool_call_id
        tool_name = tool_call.tool_name
        
        # Resolve tool spec
        spec = get_tool_spec(tool_name)
        if spec is None:
            return WorkflowToolResult(
                tool_run_id=tool_run_id,
                tool_call_id=tool_call.tool_call_id,
                tool_name=tool_name,
                status=ToolRunStatus.FAILED,
                error=f"Unknown tool: {tool_name}",
            )

        # Enforce safety policy
        safety = get_tool_safety(tool_name)
        if safety == ToolSafety.FORBIDDEN:
            return WorkflowToolResult(
                tool_run_id=tool_run_id,
                tool_call_id=tool_call.tool_call_id,
                tool_name=tool_name,
                status=ToolRunStatus.FAILED,
                error=f"Tool '{tool_name}' is forbidden from AI execution",
            )

        if safety == ToolSafety.CONFIRMATION_REQUIRED and not confirmed:
            return WorkflowToolResult(
                tool_run_id=tool_run_id,
                tool_call_id=tool_call.tool_call_id,
                tool_name=tool_name,
                status=ToolRunStatus.AWAITING_CONFIRMATION,
                error="Confirmation required for this action",
            )

        # Execute using explicit dispatch
        started_at = datetime.now(tz=UTC).isoformat()
        
        try:
            handler_name = get_handler_name(tool_name)
            result = await self._dispatch_handler(
                handler_name,
                tool_call.arguments,
                copilot_session_id,
                progress_callback,
            )
            
            completed_at = datetime.now(tz=UTC).isoformat()
            
            return WorkflowToolResult(
                tool_run_id=tool_run_id,
                tool_call_id=tool_call.tool_call_id,
                tool_name=tool_name,
                status=ToolRunStatus.COMPLETED,
                result_summary=result.get("summary"),
                context_patch=result.get("context_patch"),
                started_at=started_at,
                completed_at=completed_at,
            )
        except Exception as exc:
            completed_at = datetime.now(tz=UTC).isoformat()
            error_msg = f"Tool execution failed: {exc}"
            
            return WorkflowToolResult(
                tool_run_id=tool_run_id,
                tool_call_id=tool_call.tool_call_id,
                tool_name=tool_name,
                status=ToolRunStatus.FAILED,
                error=error_msg,
                started_at=started_at,
                completed_at=completed_at,
            )

    async def _dispatch_handler(
        self,
        handler_name: str,
        arguments: dict[str, Any],
        copilot_session_id: str,
        progress_callback: ProgressCallback | None,
    ) -> dict[str, Any]:
        """Explicit dispatch to handler functions."""
        
        # READ-ONLY handlers
        if handler_name == "inspect_app_structure":
            return await self._handle_inspect_app_structure(arguments)
        if handler_name == "list_strategies":
            return await self._handle_list_strategies(arguments)
        if handler_name == "read_strategy_file":
            return await self._handle_read_strategy_file(arguments)
        if handler_name == "validate_strategy_syntax":
            return await self._handle_validate_strategy_syntax(arguments)
        if handler_name == "view_best_params":
            return await self._handle_view_best_params(arguments)
        if handler_name == "view_trial_params":
            return await self._handle_view_trial_params(arguments)
        
        # CONFIRMATION-REQUIRED handlers
        if handler_name == "run_backtest":
            return await self._handle_run_backtest(arguments, copilot_session_id, progress_callback)
        if handler_name == "run_optimizer":
            return await self._handle_run_optimizer(arguments, copilot_session_id, progress_callback)
        if handler_name == "run_pair_explorer":
            return await self._handle_run_pair_explorer(arguments, copilot_session_id, progress_callback)
        if handler_name == "edit_strategy_section":
            return await self._handle_edit_strategy_section(arguments, copilot_session_id)
        
        # Unknown handler
        raise ValueError(f"Unknown handler: {handler_name}")

    # ── READ-ONLY handlers ───────────────────────────────────────────────────────

    async def _handle_inspect_app_structure(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Handle inspect_app_structure tool."""
        settings = self.services.settings_store.load()
        
        return {
            "summary": {
                "strategies_directory": settings.strategies_directory_path,
                "user_data_directory": settings.user_data_directory_path,
                "freqtrade_executable": settings.freqtrade_executable_path,
                "default_config": settings.default_config_file_path,
                "available_endpoints": [
                    "/api/pair-explorer/run",
                    "/api/backtest/run",
                    "/api/optimizer/run",
                    "/api/stress-lab/run",
                    "/api/temporal-stress-lab/run",
                ],
                "ollama_configured": bool(settings.ollama_model),
                "ollama_model": settings.ollama_model or "Not configured",
            }
        }

    async def _handle_list_strategies(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Handle list_strategies tool."""
        settings = self.services.settings_store.load()
        strategies_dir = Path(settings.strategies_directory_path)
        
        py_files = {p.stem: p.name for p in strategies_dir.glob("*.py")}
        json_files = {p.stem: p.name for p in strategies_dir.glob("*.json")}
        all_stems = sorted(set(py_files) | set(json_files))
        
        strategies = []
        for stem in all_stems:
            py_f = py_files.get(stem)
            json_f = json_files.get(stem)
            if py_f:
                strategies.append({
                    "name": stem,
                    "py_file": py_f,
                    "json_file": json_f,
                    "has_json": json_f is not None
                })
        
        return {
            "summary": {
                "strategies": strategies,
                "count": len(strategies)
            }
        }

    async def _handle_read_strategy_file(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Handle read_strategy_file tool."""
        args = ReadStrategyFileArgs(**arguments)
        settings = self.services.settings_store.load()
        strategies_dir = Path(settings.strategies_directory_path)
        
        py_path = strategies_dir / f"{args.strategy_name}.py"
        json_path = strategies_dir / f"{args.strategy_name}.json"
        
        if not py_path.exists():
            raise BackendError(f"Strategy file '{args.strategy_name}.py' not found", status_code=404)
        
        python_content = py_path.read_text(encoding="utf-8", errors="replace")
        json_content = None
        if json_path.exists():
            json_content = json_path.read_text(encoding="utf-8", errors="replace")
        
        # Truncate if too large
        if len(python_content) > self.MAX_TOOL_RESULT_SIZE:
            python_content = python_content[:self.MAX_TOOL_RESULT_SIZE] + "\n...[truncated]"
        
        return {
            "summary": {
                "strategy_name": args.strategy_name,
                "python_content": python_content,
                "json_content": json_content,
            }
        }

    async def _handle_validate_strategy_syntax(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Handle validate_strategy_syntax tool."""
        args = ValidateStrategySyntaxArgs(**arguments)
        
        # Import validation helpers
        import tempfile
        import py_compile
        
        settings = self.services.settings_store.load()
        strategies_dir = Path(settings.strategies_directory_path)
        py_path = strategies_dir / f"{args.strategy_name}.py"
        
        if not py_path.exists():
            raise BackendError(f"Strategy file '{args.strategy_name}.py' not found", status_code=404)
        
        content = py_path.read_text(encoding="utf-8", errors="replace")
        errors = []
        
        # py_compile check
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", encoding="utf-8", delete=False) as tf:
                tf.write(content)
                tmp_path = Path(tf.name)
            try:
                py_compile.compile(str(tmp_path), doraise=True)
            except py_compile.PyCompileError as exc:
                errors.append(str(exc).replace(str(tmp_path), f"{args.strategy_name}.py"))
            finally:
                tmp_path.unlink(missing_ok=True)
        except Exception as exc:
            errors.append(str(exc))
        
        return {
            "summary": {
                "strategy_name": args.strategy_name,
                "valid": len(errors) == 0,
                "errors": errors,
            }
        }

    async def _handle_view_best_params(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Handle view_best_params tool."""
        args = ViewBestParamsArgs(**arguments)
        
        # Load optimizer session
        session = self.services.optimizer_store.load_session(args.optimizer_session_id)
        if session is None:
            raise BackendError(f"Optimizer session not found: {args.optimizer_session_id}", status_code=404)
        
        # Use real OptimizerSession fields: best_trial_number, best_metrics, trials
        if session.best_trial_number is None:
            return {
                "summary": {
                    "optimizer_session_id": args.optimizer_session_id,
                    "best_trial_number": None,
                    "message": "No best trial found yet",
                }
            }
        
        # Get the best trial from trials list
        best_trial = None
        for trial in session.trials:
            if trial.trial_number == session.best_trial_number:
                best_trial = trial
                break
        
        if best_trial is None:
            return {
                "summary": {
                    "optimizer_session_id": args.optimizer_session_id,
                    "best_trial_number": session.best_trial_number,
                    "message": f"Best trial #{session.best_trial_number} not found in trials list",
                }
            }
        
        return {
            "summary": {
                "optimizer_session_id": args.optimizer_session_id,
                "best_trial_number": session.best_trial_number,
                "parameters": best_trial.parameters or {},
                "metrics": best_trial.metrics.model_dump() if best_trial.metrics else {},
            }
        }

    async def _handle_view_trial_params(self, arguments: dict[str, Any]) -> dict[str, Any]:
        """Handle view_trial_params tool."""
        args = ViewTrialParamsArgs(**arguments)
        
        # Load optimizer session
        session = self.services.optimizer_store.load_session(args.optimizer_session_id)
        if session is None:
            raise BackendError(f"Optimizer session not found: {args.optimizer_session_id}", status_code=404)
        
        trial = None
        for t in session.trials:
            if t.trial_number == args.trial_number:
                trial = t
                break
        
        if trial is None:
            raise BackendError(f"Trial {args.trial_number} not found in session", status_code=404)
        
        return {
            "summary": {
                "optimizer_session_id": args.optimizer_session_id,
                "trial_number": trial.trial_number,
                "parameters": trial.parameters or {},
                "metrics": trial.metrics.model_dump() if trial.metrics else {},
            }
        }

    # ── CONFIRMATION-REQUIRED handlers ─────────────────────────────────────────────

    async def _handle_run_backtest(
        self,
        arguments: dict[str, Any],
        copilot_session_id: str,
        progress_callback: ProgressCallback | None,
    ) -> dict[str, Any]:
        """Handle run_backtest tool using reusable job function and observe to completion."""
        from ..workflow_jobs import start_backtest_job
        from .job_observer import observe_job
        
        args = RunBacktestArgs(**arguments)
        
        if progress_callback:
            progress_callback("tool_started", {"tool_name": "run_backtest"})
        
        # Call reusable job start function
        api_session_id, initial_status = await start_backtest_job(
            services=self.services,
            store=self.session_store,
            strategy_name=args.strategy_name,
            version_id=args.version_id,
            timerange=args.timerange,
            timeframe=args.timeframe,
            pairs=args.pairs,
            max_open_trades=args.max_open_trades,
            dry_run_wallet=args.dry_run_wallet,
            config_file=args.config_file,
        )
        
        # Add job reference to copilot session (preserve api_session_id separately)
        job_ref = JobReference(
            job_type="backtest",
            api_session_id=api_session_id,
            status=initial_status,
        )
        
        copilot_session = self.copilot_store.load_session(copilot_session_id)
        self.copilot_store.add_active_job(copilot_session, job_ref.model_dump())
        self.copilot_store.save_session(copilot_session)
        
        # Observe job to terminal status
        final_status = initial_status
        final_result = {}
        run_id = None
        
        async for event in observe_job(
            session_store=self.session_store,
            api_session_id=api_session_id,
            job_type="backtest",
        ):
            if progress_callback:
                progress_callback("tool_progress", event)
            
            if event["type"] == "job_progress":
                backend_status = event["status"]
                final_result = event.get("result", {})
                
                # Map backend status to ToolRunStatus
                if backend_status == "completed":
                    final_status = "completed"
                elif backend_status == "failed":
                    final_status = "failed"
                elif backend_status == "cancelled":
                    final_status = "cancelled"
                else:
                    # queued, running, or timeout while still running
                    final_status = "running"
                
                # Extract run_id from result when available
                if "run_id" in final_result:
                    run_id = final_result["run_id"]
            
            if event["type"] == "error":
                return {
                    "summary": {
                        "api_session_id": api_session_id,
                        "strategy_name": args.strategy_name,
                        "status": "failed",
                        "error": event.get("error"),
                    },
                    "context_patch": {},
                }
        
        # Build context patch with real run_id if available
        context_patch = {}
        if run_id:
            context_patch["backtest_run_id"] = run_id
        
        return {
            "summary": {
                "api_session_id": api_session_id,
                "run_id": run_id,
                "strategy_name": args.strategy_name,
                "pairs": args.pairs,
                "timeframe": args.timeframe,
                "timerange": args.timerange,
                "status": final_status,
                "result": final_result,
            },
            "context_patch": context_patch,
        }

    async def _handle_run_optimizer(
        self,
        arguments: dict[str, Any],
        copilot_session_id: str,
        progress_callback: ProgressCallback | None,
    ) -> dict[str, Any]:
        """Handle run_optimizer tool using reusable job function and observe to completion."""
        from ..workflow_jobs import start_optimizer_job
        from .job_observer import observe_optimizer_job
        
        args = RunOptimizerArgs(**arguments)
        
        if progress_callback:
            progress_callback("tool_started", {"tool_name": "run_optimizer"})
        
        # Call reusable job start function
        api_session_id, optimizer_session_id, initial_status = await start_optimizer_job(
            services=self.services,
            store=self.session_store,
            strategy_name=args.strategy_name,
            timerange=args.timerange,
            timeframe=args.timeframe,
            pairs=args.pairs,
            search_spaces=args.search_spaces,
            total_trials=args.total_trials,
            search_strategy=args.search_strategy,
            parameter_mode=args.parameter_mode,
            score_metric=args.score_metric,
            max_open_trades=args.max_open_trades,
            dry_run_wallet=args.dry_run_wallet,
            fee_rate=args.fee_rate,
            enable_vectorbt_screening=args.enable_vectorbt_screening,
            vectorbt_candidate_count=args.vectorbt_candidate_count,
            vectorbt_keep_ratio=args.vectorbt_keep_ratio,
            vectorbt_timeout_seconds=args.vectorbt_timeout_seconds,
            config_file=args.config_file,
        )
        
        # Add job reference to copilot session
        job_ref = JobReference(
            job_type="optimizer",
            api_session_id=api_session_id,
            workflow_session_id=optimizer_session_id,
            status=initial_status,
        )
        
        copilot_session = self.copilot_store.load_session(copilot_session_id)
        self.copilot_store.add_active_job(copilot_session, job_ref.model_dump())
        self.copilot_store.save_session(copilot_session)
        
        # Observe optimizer to terminal status
        final_phase = initial_status
        final_metrics = {}
        
        async for event in observe_optimizer_job(
            services=self.services,
            api_session_id=api_session_id,
            optimizer_session_id=optimizer_session_id,
        ):
            if progress_callback:
                progress_callback("tool_progress", event)
            
            if event["type"] == "optimizer_progress":
                backend_phase = event["phase"]
                final_metrics = {
                    "total_trials": event["total_trials"],
                    "completed_trials": event["completed_trials"],
                    "failed_trials": event["failed_trials"],
                    "best_trial_number": event["best_trial_number"],
                    "best_metrics": event["best_metrics"],
                    "stop_reason": event["stop_reason"],
                }
                
                # Map optimizer phase to ToolRunStatus
                if backend_phase in ("completed", "stopped"):
                    final_phase = "completed"
                elif backend_phase == "failed":
                    final_phase = "failed"
                elif backend_phase == "cancelled":
                    final_phase = "cancelled"
                else:
                    # queued, running, or timeout while still running
                    final_phase = "running"
            
            if event["type"] == "error":
                return {
                    "summary": {
                        "api_session_id": api_session_id,
                        "optimizer_session_id": optimizer_session_id,
                        "strategy_name": args.strategy_name,
                        "status": "failed",
                        "error": event.get("error"),
                    },
                    "context_patch": {},
                }
        
        return {
            "summary": {
                "api_session_id": api_session_id,
                "optimizer_session_id": optimizer_session_id,
                "strategy_name": args.strategy_name,
                "pairs": args.pairs,
                "total_trials": args.total_trials,
                "status": final_phase,
                "metrics": final_metrics,
            },
            "context_patch": {
                "optimizer_session_id": optimizer_session_id,
            },
        }

    async def _handle_run_pair_explorer(
        self,
        arguments: dict[str, Any],
        copilot_session_id: str,
        progress_callback: ProgressCallback | None,
    ) -> dict[str, Any]:
        """Handle run_pair_explorer tool."""
        # Placeholder - implement based on pair_explorer router
        raise BackendError(
            "Pair Explorer tool execution not yet implemented. "
            "Extract from backend/api/routers/pair_explorer.py",
            status_code=501,
        )

    async def _handle_edit_strategy_section(
        self,
        arguments: dict[str, Any],
        copilot_session_id: str,
    ) -> dict[str, Any]:
        """Handle edit_strategy_section tool with preview + confirmation flow."""
        # This should implement the full edit flow:
        # 1. Resolve allowlisted strategy path
        # 2. Generate diff preview
        # 3. Store current SHA256
        # 4. Return preview for UI confirmation
        # 5. On confirmation: snapshot, atomic write, validate, rollback on failure
        
        # For now, placeholder
        raise BackendError(
            "Strategy edit tool execution not yet implemented. "
            "Implement with preview + confirmation flow.",
            status_code=501,
        )


def get_tool_spec(name: str):
    """Import get_tool_spec from registry."""
    from .workflow_tool_registry import get_tool_spec as _get_tool_spec
    return _get_tool_spec(name)
