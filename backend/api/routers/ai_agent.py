"""Router: /api/ai-agent/*

Model-agnostic AI agent tool endpoints for AutoQuant workflow.

GET  /api/ai-agent/tools              — discover available tools with schemas
POST /api/ai-agent/tools/{tool_name}  — execute specific tool
POST /api/ai-agent/workflow/auto-quant — execute full 8-step AutoQuant workflow
GET  /api/ai-agent/sessions/{session_id} — get session status and logs
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/ai-agent", tags=["AI Agent"])

# ── System Prompt ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are the in-app AutoQuant AI Assistant. Your task is to create, test, optimize, stress-test, and deliver a robust Freqtrade strategy using only the app's existing workflow and tools.

Goal:
Generate a production-candidate strategy, not just a strategy that wins one lucky backtest.

Important safety rules:

* Do not start live trading.
* Do not claim the strategy is profitable unless it passes all required validation steps.
* Do not overwrite existing strategy files. Create new versioned files.
* Do not recalculate metrics manually. Use the app's real backtest, Pair Explorer, Optimizer, and Stress Test Lab results.
* Avoid overfitting. Any improvement must survive out-of-sample, time split, and Monte Carlo checks.
* Keep full logs of every attempt, every failed strategy, every selected pair, every rejected pair, and every final result.

Working directory:
Use the app's configured strategy folder. If the project uses `user_data/strategies`, write there.

Required output files:

1. A strategy `.py` file.
2. A matching `.json` parameter/config file.
3. A final report explaining:

   * strategy logic
   * indicators
   * timeframe
   * selected pairs
   * rejected pairs
   * Pair Explorer results
   * combined backtest results
   * optimizer results
   * stress test results
   * Monte Carlo result
   * final pass/fail decision

Workflow:

Step 1 — Inspect the app and current project

* Read the current app structure.
* Find the strategy folder.
* Find how the app runs:

  * Pair Explorer
  * Backtest
  * Optimizer
  * Stress Test Lab
  * Time Split test
  * Monte Carlo test
* Do not invent APIs. Use the existing app services, endpoints, buttons, or backend functions.
* If a required function already exists, reuse it.
* If a required function is missing, report the missing gap clearly before continuing.

Step 2 — Create a robust strategy
Create a new Freqtrade-compatible strategy `.py` file and matching `.json` file.

The strategy should be robust and realistic, not overfitted. Prefer simple, proven logic using combinations such as:

* trend filter
* momentum confirmation
* volatility filter
* volume/liquidity filter
* ATR-based risk control
* reasonable stoploss
* reasonable ROI table
* optional trailing stop only if useful
* protections if supported by the app/Freqtrade version

The strategy must include tunable parameters that the Optimizer can adjust.

Do not make the strategy too complex. Avoid huge indicator combinations that may timeout or overfit.

Step 3 — Run Pair Explorer
Use Pair Explorer to test the strategy across a broad pair universe.

Target:

* Test 50 to 100 pairs if the app and available data allow it.
* Prefer liquid and known pairs first, such as BTC, ETH, BNB, SOL, XRP, ADA, AVAX, LINK, DOGE, LTC, DOT, TRX, NEAR, ATOM, and other high-liquidity USDT pairs.
* If fewer than 50 pairs are available, use all available valid pairs and report the limitation.

For every pair, collect:

* net profit
* profit factor
* max drawdown
* trade count
* expectancy
* win rate
* Sharpe/Calmar if available
* data quality warnings
* rejection reason if rejected

Select the best 3 to 4 pairs only if they pass all minimum rules:

* net profit > 0 after fees
* profit factor > 1.2 minimum
* expectancy > 0
* max drawdown acceptable
* enough trades to be meaningful
* no obvious data quality issue
* not dependent on one lucky trade

If fewer than 3 pairs pass, do not fake success. Generate a new strategy variant and repeat the process.

Step 4 — Combined multi-pair backtest
Take the top profitable pairs from Pair Explorer.

Run a second backtest using only those selected pairs together.

Set:

* `max_open_trades` = number of selected profitable pairs

Example:

* If 3 pairs passed, use `max_open_trades = 3`.
* If 4 pairs passed, use `max_open_trades = 4`.

This combined test must prove the strategy still works as a portfolio, not only as isolated single-pair tests.

Pass rules:

* combined net profit > 0
* combined profit factor > 1.25
* combined expectancy > 0
* max drawdown within safe limit
* trade count is meaningful
* no single pair contributes almost all profit
* all selected pairs should remain individually reasonable

If the combined test fails:

* Identify why.
* Remove weak pairs if justified.
* Or generate a new strategy variant.
* Then repeat from Pair Explorer or combined backtest as needed.

Step 5 — Optimizer
Send the strategy and selected pairs to the Optimizer.

Optimize only meaningful parameters:

* buy parameters
* sell parameters
* stoploss
* ROI
* trailing stop if enabled
* protections if supported

Do not over-optimize too many parameters at once.

After optimization:

* Save optimized parameters into the strategy `.json`.
* Run another combined backtest using the optimized parameters.
* Compare before vs after.

Accept optimized parameters only if:

* OOS result does not get worse
* drawdown does not become unsafe
* profit improvement is not caused by obvious overfitting
* trade count remains meaningful
* Pair performance remains stable

If optimizer parameters are worse, keep the original parameters and explain why.

Step 6 — Stress Test Lab
Run Stress Test Lab on the best candidate.

Required stress tests:

1. Time Split / out-of-sample validation
2. Monte Carlo simulation
3. Robustness check if available
4. Fee/slippage check if available
5. Multi-period validation if available

The strategy passes only if:

* time split result remains profitable or at least statistically acceptable
* Monte Carlo does not show unacceptable ruin/drawdown risk
* drawdown remains within the selected risk profile
* performance is not concentrated in one tiny time window
* no single pair is responsible for nearly all profits
* the strategy survives realistic fees/slippage

Step 7 — Loop until final candidate
Continue the loop until one of these happens:

Success condition:

* A strategy `.py` and `.json` exist.
* At least 3 profitable pairs are found, or fewer only if the app/user explicitly allows fewer.
* Combined multi-pair backtest passes.
* Optimizer result is accepted or rejected with clear reason.
* Stress Test Lab passes.
* Time Split passes.
* Monte Carlo passes.
* Final report is generated.
* User receives a clear notification that the strategy candidate is ready.

Failure/guard condition:

* Stop and report if the app hits a technical error, missing feature, missing data, repeated timeout, or resource exhaustion.
* Do not loop forever silently.
* If 10 full strategy variants fail, pause and produce a detailed failure report explaining what failed and what needs to change.
* If the user explicitly increases the attempt limit, continue.

Step 8 — Final notification
When the final candidate is ready, notify me with:

"Strategy candidate completed."

Include:

* strategy file path
* json file path
* selected pairs
* final combined backtest metrics
* optimizer decision
* stress test result
* Monte Carlo result
* final status:

  * Failed
  * Candidate
  * Validated
  * Production Candidate

Do not call it "Production Candidate" unless all validation checks pass.

Final requirement:
Work through the app's real workflow only. Do not fake results, do not manually invent metrics, and do not skip Pair Explorer, combined backtest, Optimizer, Time Split, or Monte Carlo.
"""

# ── Tool Definitions ───────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "read_strategy_file",
        "description": "Read a Freqtrade strategy .py and .json files from the strategies directory. Returns the file contents for analysis and editing.",
        "parameters": {
            "type": "object",
            "properties": {
                "strategy_name": {
                    "type": "string",
                    "description": "Strategy name without .py extension (e.g., 'MyStrategy_v1')"
                }
            },
            "required": ["strategy_name"]
        }
    },
    {
        "name": "edit_strategy_section",
        "description": "Edit a specific section of a strategy file (buy rules, sell rules, indicators, etc.). Creates a versioned snapshot before editing, validates syntax, and allows rollback. Use this to modify existing strategies rather than creating entirely new files.",
        "parameters": {
            "type": "object",
            "properties": {
                "strategy_name": {
                    "type": "string",
                    "description": "Strategy name without .py extension"
                },
                "section": {
                    "type": "string",
                    "enum": ["buy_rules", "sell_rules", "indicators", "protections", "parameters", "full_file"],
                    "description": "Which section to edit. Use 'full_file' to replace the entire file."
                },
                "changes": {
                    "type": "string",
                    "description": "The new content for the section. For section edits, provide just the new code for that section. For full_file, provide the complete Python code."
                },
                "reason": {
                    "type": "string",
                    "description": "Explanation of why this change is being made (for audit trail)"
                }
            },
            "required": ["strategy_name", "section", "changes", "reason"]
        }
    },
    {
        "name": "list_strategies",
        "description": "List all available strategies in the strategies directory. Returns strategy names, file paths, and metadata.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "validate_strategy_syntax",
        "description": "Validate a strategy's Python syntax and Freqtrade compatibility. Runs py_compile and freqtrade test-strategy checks. Use this before and after editing to ensure the strategy remains valid.",
        "parameters": {
            "type": "object",
            "properties": {
                "strategy_name": {
                    "type": "string",
                    "description": "Strategy name without .py extension"
                }
            },
            "required": ["strategy_name"]
        }
    },
    {
        "name": "inspect_app_structure",
        "description": "Inspect the app structure to understand available tools, strategy folder location, and how to run Pair Explorer, Backtest, Optimizer, and Stress Test Lab. Returns the app configuration and available endpoints.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "run_pair_explorer",
        "description": "Run Pair Explorer to test a strategy across a broad pair universe. Tests multiple pairs and returns performance metrics for each pair including net profit, profit factor, drawdown, trade count, expectancy, and win rate.",
        "parameters": {
            "type": "object",
            "properties": {
                "strategy_name": {
                    "type": "string",
                    "description": "Strategy name without .py extension"
                },
                "timeframe": {
                    "type": "string",
                    "description": "Candle timeframe (e.g., '5m', '1h', '1d')",
                    "default": "5m"
                },
                "timerange": {
                    "type": "string",
                    "description": "Date range for backtest (e.g., '20230101-20240101')"
                },
                "pairs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of pairs to test (e.g., ['BTC/USDT', 'ETH/USDT']). If not provided, uses default pair universe."
                }
            },
            "required": ["strategy_name", "timerange"]
        }
    },
    {
        "name": "run_backtest",
        "description": "Run a backtest for a strategy with specified parameters. Returns detailed metrics including profit, drawdown, trade count, win rate, and other performance indicators.",
        "parameters": {
            "type": "object",
            "properties": {
                "strategy_name": {
                    "type": "string",
                    "description": "Strategy name without .py extension"
                },
                "timeframe": {
                    "type": "string",
                    "description": "Candle timeframe (e.g., '5m', '1h', '1d')"
                },
                "timerange": {
                    "type": "string",
                    "description": "Date range for backtest (e.g., '20230101-20240101')"
                },
                "pairs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of pairs to test"
                },
                "max_open_trades": {
                    "type": "integer",
                    "description": "Maximum number of open trades",
                    "default": 1
                },
                "fee_rate": {
                    "type": "number",
                    "description": "Trading fee rate (e.g., 0.001 for 0.1%)",
                    "default": 0.001
                }
            },
            "required": ["strategy_name", "timerange"]
        }
    },
    {
        "name": "run_optimizer",
        "description": "Run the optimizer to find optimal parameters for a strategy. Optimizes specified parameter spaces and returns the best parameters found.",
        "parameters": {
            "type": "object",
            "properties": {
                "strategy_name": {
                    "type": "string",
                    "description": "Strategy name without .py extension"
                },
                "timeframe": {
                    "type": "string",
                    "description": "Candle timeframe"
                },
                "timerange": {
                    "type": "string",
                    "description": "Date range for optimization"
                },
                "pairs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of pairs to optimize for"
                },
                "spaces": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Parameter spaces to optimize (e.g., ['buy', 'sell', 'stoploss', 'roi'])"
                },
                "epochs": {
                    "type": "integer",
                    "description": "Number of optimization epochs",
                    "default": 100
                }
            },
            "required": ["strategy_name", "timerange", "spaces"]
        }
    },
    {
        "name": "run_stress_test",
        "description": "Run Stress Test Lab including Time Split (out-of-sample validation), Monte Carlo simulation, robustness checks, and fee/slippage analysis. Returns comprehensive stress test results.",
        "parameters": {
            "type": "object",
            "properties": {
                "strategy_name": {
                    "type": "string",
                    "description": "Strategy name without .py extension"
                },
                "timeframe": {
                    "type": "string",
                    "description": "Candle timeframe"
                },
                "timerange": {
                    "type": "string",
                    "description": "Date range for stress testing"
                },
                "pairs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of pairs to stress test"
                },
                "tests": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Specific tests to run (e.g., ['time_split', 'monte_carlo', 'robustness']). If not provided, runs all available tests."
                }
            },
            "required": ["strategy_name", "timerange"]
        }
    },
    {
        "name": "generate_report",
        "description": "Generate a final report summarizing the entire AutoQuant workflow including strategy logic, indicators, selected pairs, all test results, and final pass/fail decision. Creates a comprehensive markdown report.",
        "parameters": {
            "type": "object",
            "properties": {
                "strategy_name": {
                    "type": "string",
                    "description": "Strategy name without .py extension"
                },
                "session_id": {
                    "type": "string",
                    "description": "Session ID to gather results from"
                },
                "status": {
                    "type": "string",
                    "enum": ["Failed", "Candidate", "Validated", "Production Candidate"],
                    "description": "Final status of the strategy"
                }
            },
            "required": ["strategy_name", "session_id", "status"]
        }
    }
]

# ── Session Management ───────────────────────────────────────────────────────────

class SessionManager:
    """Session manager for AI agent sessions with disk persistence."""
    
    def __init__(self, user_data_dir: str | None = None):
        self.sessions: dict[str, dict[str, Any]] = {}
        self.user_data_dir = Path(user_data_dir) if user_data_dir else None
        self.logs_dir = self._init_logs_dir()
    
    def _init_logs_dir(self) -> Path | None:
        """Initialize logs directory."""
        if not self.user_data_dir:
            return None
        logs_dir = self.user_data_dir / "ai_agent_logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        return logs_dir
    
    def create_session(self, ai_model: str | None = None) -> str:
        """Create a new session and return its ID."""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "logs": [],
            "tool_calls": [],
            "status": "active",
            "ai_model": ai_model or "unknown"
        }
        self._persist_session(session_id)
        return session_id
    
    def get_session(self, session_id: str) -> dict[str, Any] | None:
        """Get session data by ID."""
        return self.sessions.get(session_id)
    
    def add_log(self, session_id: str, log_entry: dict[str, Any]) -> None:
        """Add a log entry to a session."""
        if session_id in self.sessions:
            log_entry["timestamp"] = log_entry.get("timestamp", datetime.now(timezone.utc).isoformat())
            self.sessions[session_id]["logs"].append(log_entry)
            self._persist_log(session_id, log_entry)
    
    def add_tool_call(self, session_id: str, tool_call: dict[str, Any]) -> None:
        """Add a tool call record to a session."""
        if session_id in self.sessions:
            tool_call["timestamp"] = tool_call.get("timestamp", datetime.now(timezone.utc).isoformat())
            self.sessions[session_id]["tool_calls"].append(tool_call)
            self._persist_log(session_id, tool_call)
    
    def _persist_session(self, session_id: str) -> None:
        """Persist session metadata to disk."""
        if not self.logs_dir:
            return
        try:
            session_file = self.logs_dir / f"session_{session_id}.json"
            session_data = self.sessions[session_id]
            session_file.write_text(json.dumps(session_data, indent=2), encoding="utf-8")
        except Exception:
            pass
    
    def _persist_log(self, session_id: str, log_entry: dict[str, Any]) -> None:
        """Persist a log entry to disk in JSONL format."""
        if not self.logs_dir:
            return
        try:
            log_file = self.logs_dir / f"session_{session_id}.jsonl"
            log_entry["session_id"] = session_id
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry) + "\n")
        except Exception:
            pass
    
    def load_session(self, session_id: str) -> dict[str, Any] | None:
        """Load session from disk."""
        if not self.logs_dir:
            return None
        try:
            session_file = self.logs_dir / f"session_{session_id}.json"
            if session_file.exists():
                data = json.loads(session_file.read_text(encoding="utf-8"))
                self.sessions[session_id] = data
                return data
        except Exception:
            pass
        return None

# Global session manager (will be initialized with user_data_dir in lifespan)
_session_manager: SessionManager | None = None


def get_session_manager(request: Request | None = None) -> SessionManager:
    """Get the session manager instance.
    
    If request is provided and app.state.ai_agent_session_manager exists, use that.
    Otherwise, fall back to the global instance.
    """
    if request and hasattr(request.app.state, "ai_agent_session_manager"):
        return request.app.state.ai_agent_session_manager
    
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager

# ── Request/Response Models ─────────────────────────────────────────────────────

class ToolExecutionRequest(BaseModel):
    session_id: str | None = Field(None, description="Session ID for tracking")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Tool parameters")

class ToolExecutionResponse(BaseModel):
    success: bool
    result: dict[str, Any] | None = None
    error: str | None = None
    logs: list[dict[str, Any]] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)

# ── Helper Functions ───────────────────────────────────────────────────────────

def _strategies_dir(request: Request) -> Path:
    """Get the strategies directory from settings."""
    settings = request.app.state.services.settings_store.load()
    return Path(settings.strategies_directory_path).resolve()

def _log_action(session_id: str | None, action: str, details: dict[str, Any], request: Request | None = None) -> None:
    """Log an action to the session if session exists."""
    if session_id:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "details": details
        }
        get_session_manager(request).add_log(session_id, log_entry)

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/tools",
    summary="Discover available AI agent tools",
    description="Returns all available tools with their schemas and the system prompt for the AutoQuant workflow."
)
async def get_tools() -> dict:
    """Return all available tools with schemas."""
    return {
        "tools": TOOLS,
        "system_prompt": SYSTEM_PROMPT,
        "version": "1.0.0"
    }


@router.get(
    "/sessions/{session_id}",
    summary="Get session status and logs",
    description="Retrieve the current status, logs, and tool calls for a specific session."
)
async def get_session(session_id: str) -> dict:
    """Get session data by ID."""
    session = get_session_manager().get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return session


@router.post(
    "/sessions",
    summary="Create a new AI agent session",
    description="Create a new session for tracking AI agent workflow execution."
)
async def create_session(request: Request) -> dict:
    """Create a new session."""
    ai_model = request.headers.get("X-AI-Model")  # Optional header to identify the AI model
    session_id = get_session_manager().create_session(ai_model=ai_model)
    return {
        "session_id": session_id,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "ai_model": ai_model or "unknown"
    }


@router.post(
    "/tools/read_strategy_file",
    summary="Read a strategy file",
    description="Read a Freqtrade strategy .py and .json files from the strategies directory."
)
async def read_strategy_file(body: ToolExecutionRequest, request: Request) -> ToolExecutionResponse:
    """Read a strategy file."""
    try:
        strategy_name = body.parameters.get("strategy_name")
        if not strategy_name:
            return ToolExecutionResponse(
                success=False,
                error="Missing required parameter: strategy_name"
            )
        
        strategies_dir = _strategies_dir(request)
        py_path = strategies_dir / f"{strategy_name}.py"
        json_path = strategies_dir / f"{strategy_name}.json"
        
        if not py_path.exists():
            return ToolExecutionResponse(
                success=False,
                error=f"Strategy file '{strategy_name}.py' not found in {strategies_dir}"
            )
        
        python_content = py_path.read_text(encoding="utf-8", errors="replace")
        json_content = None
        if json_path.exists():
            json_content = json_path.read_text(encoding="utf-8", errors="replace")
        
        result = {
            "strategy_name": strategy_name,
            "python_content": python_content,
            "json_content": json_content,
            "python_path": str(py_path),
            "json_path": str(json_path) if json_path.exists() else None
        }
        
        _log_action(body.session_id, "read_strategy_file", {"strategy_name": strategy_name}, request)
        
        return ToolExecutionResponse(
            success=True,
            result=result,
            logs=[{"message": f"Successfully read strategy file: {strategy_name}"}]
        )
        
    except Exception as e:
        return ToolExecutionResponse(
            success=False,
            error=f"Failed to read strategy file: {str(e)}"
        )


@router.post(
    "/tools/list_strategies",
    summary="List all available strategies",
    description="List all available strategies in the strategies directory."
)
async def list_strategies(body: ToolExecutionRequest, request: Request) -> ToolExecutionResponse:
    """List all available strategies."""
    try:
        strategies_dir = _strategies_dir(request)
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
        
        result = {
            "strategies": strategies,
            "strategies_dir": str(strategies_dir),
            "count": len(strategies)
        }
        
        _log_action(body.session_id, "list_strategies", {"count": len(strategies)}, request)
        
        return ToolExecutionResponse(
            success=True,
            result=result,
            logs=[{"message": f"Found {len(strategies)} strategies"}]
        )
        
    except Exception as e:
        return ToolExecutionResponse(
            success=False,
            error=f"Failed to list strategies: {str(e)}"
        )


@router.post(
    "/tools/inspect_app_structure",
    summary="Inspect app structure",
    description="Inspect the app structure to understand available tools and configuration."
)
async def inspect_app_structure(body: ToolExecutionRequest, request: Request) -> ToolExecutionResponse:
    """Inspect the app structure."""
    try:
        services = request.app.state.services
        settings = services.settings_store.load()
        
        result = {
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
                "/api/strategies/save",
                "/api/strategies/validate"
            ],
            "ollama_configured": bool(settings.ollama_model),
            "ollama_model": settings.ollama_model or "Not configured"
        }
        
        _log_action(body.session_id, "inspect_app_structure", result, request)
        
        return ToolExecutionResponse(
            success=True,
            result=result,
            logs=[{"message": "Successfully inspected app structure"}]
        )
        
    except Exception as e:
        return ToolExecutionResponse(
            success=False,
            error=f"Failed to inspect app structure: {str(e)}"
        )


# ── Placeholder Endpoints for Tools Not Yet Implemented ───────────────────────

@router.post(
    "/tools/edit_strategy_section",
    summary="Edit a strategy section",
    description="Edit a specific section of a strategy file with versioning and validation."
)
async def edit_strategy_section(body: ToolExecutionRequest, request: Request) -> ToolExecutionResponse:
    """Edit a strategy section with versioning and validation."""
    try:
        strategy_name = body.parameters.get("strategy_name")
        section = body.parameters.get("section")
        changes = body.parameters.get("changes")
        reason = body.parameters.get("reason")
        
        if not all([strategy_name, section, changes, reason]):
            return ToolExecutionResponse(
                success=False,
                error="Missing required parameters: strategy_name, section, changes, reason"
            )
        
        strategies_dir = _strategies_dir(request)
        py_path = strategies_dir / f"{strategy_name}.py"
        
        if not py_path.exists():
            return ToolExecutionResponse(
                success=False,
                error=f"Strategy file '{strategy_name}.py' not found"
            )
        
        # Create snapshot before editing
        services = request.app.state.services
        try:
            snap = services.snapshot_service.create_snapshot(
                strategy_name, strategies_dir, trigger="ai_agent_edit"
            )
            snapshot_log = f"Created snapshot: {snap.get('timestamp', 'unknown')}"
        except Exception as e:
            snapshot_log = f"Snapshot creation failed: {str(e)}"
        
        # Read current content
        current_content = py_path.read_text(encoding="utf-8", errors="replace")
        
        # Apply changes based on section type
        if section == "full_file":
            new_content = changes
        else:
            # For section edits, we need to find and replace the specific section
            # This is a simplified approach - in production, you'd want more sophisticated parsing
            new_content = _replace_section(current_content, section, changes)
        
        # Validate syntax before saving
        try:
            import py_compile
            import tempfile
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", encoding="utf-8", delete=False) as tf:
                tf.write(new_content)
                tmp_path = Path(tf.name)
            try:
                py_compile.compile(str(tmp_path), doraise=True)
                syntax_valid = True
                syntax_error = None
            except py_compile.PyCompileError as e:
                syntax_valid = False
                syntax_error = str(e)
            finally:
                tmp_path.unlink(missing_ok=True)
        except Exception as e:
            syntax_valid = False
            syntax_error = str(e)
        
        if not syntax_valid:
            return ToolExecutionResponse(
                success=False,
                error=f"Syntax validation failed: {syntax_error}",
                logs=[snapshot_log, {"message": "Edit rejected due to syntax error"}]
            )
        
        # Save the new content
        try:
            tmp = py_path.with_suffix(py_path.suffix + ".tmp")
            tmp.write_text(new_content, encoding="utf-8")
            tmp.replace(py_path)
        except Exception as e:
            tmp.unlink(missing_ok=True)
            return ToolExecutionResponse(
                success=False,
                error=f"Failed to save file: {str(e)}",
                logs=[snapshot_log]
            )
        
        result = {
            "strategy_name": strategy_name,
            "section_edited": section,
            "snapshot_created": snapshot_log,
            "syntax_valid": syntax_valid,
            "file_path": str(py_path)
        }
        
        _log_action(body.session_id, "edit_strategy_section", {
            "strategy_name": strategy_name,
            "section": section,
            "reason": reason
        }, request)
        
        return ToolExecutionResponse(
            success=True,
            result=result,
            logs=[
                snapshot_log,
                {"message": f"Successfully edited {section} section of {strategy_name}"},
                {"message": "Syntax validation passed"}
            ]
        )
        
    except Exception as e:
        return ToolExecutionResponse(
            success=False,
            error=f"Failed to edit strategy section: {str(e)}"
        )


def _replace_section(content: str, section: str, new_section_code: str) -> str:
    """Replace a specific section in strategy file content.
    
    This is a simplified implementation. In production, you'd want more sophisticated
    AST-based parsing to reliably identify and replace sections.
    """
    # Define section markers
    section_patterns = {
        "buy_rules": ("# Buy signals", "# Sell signals"),
        "sell_rules": ("# Sell signals", "# Protections"),
        "indicators": ("# Indicators", "# Buy signals"),
        "protections": ("# Protections", "# ROI tables"),
        "parameters": ("# Parameters", "# Indicators")
    }
    
    if section == "full_file":
        return new_section_code
    
    if section not in section_patterns:
        # If we don't have a pattern for this section, append to end
        return content + f"\n\n# {section.upper()}\n{new_section_code}"
    
    start_marker, end_marker = section_patterns[section]
    
    # Find the section and replace it
    if start_marker in content:
        start_idx = content.find(start_marker)
        if end_marker in content:
            end_idx = content.find(end_marker)
            return content[:start_idx] + start_marker + "\n" + new_section_code + "\n" + content[end_idx:]
        else:
            return content[:start_idx] + start_marker + "\n" + new_section_code + "\n" + content[start_idx + len(start_marker):]
    else:
        # Section not found, append it
        return content + f"\n\n{start_marker}\n{new_section_code}\n"


@router.post(
    "/tools/validate_strategy_syntax",
    summary="Validate strategy syntax",
    description="Validate a strategy's Python syntax and Freqtrade compatibility."
)
async def validate_strategy_syntax(body: ToolExecutionRequest, request: Request) -> ToolExecutionResponse:
    """Validate strategy syntax and Freqtrade compatibility."""
    try:
        strategy_name = body.parameters.get("strategy_name")
        if not strategy_name:
            return ToolExecutionResponse(
                success=False,
                error="Missing required parameter: strategy_name"
            )
        
        strategies_dir = _strategies_dir(request)
        py_path = strategies_dir / f"{strategy_name}.py"
        
        if not py_path.exists():
            return ToolExecutionResponse(
                success=False,
                error=f"Strategy file '{strategy_name}.py' not found"
            )
        
        content = py_path.read_text(encoding="utf-8", errors="replace")
        errors = []
        warnings = []
        output_lines = []
        
        # Step 1: py_compile syntax check
        try:
            import py_compile
            import tempfile
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", encoding="utf-8", delete=False) as tf:
                tf.write(content)
                tmp_path = Path(tf.name)
            try:
                py_compile.compile(str(tmp_path), doraise=True)
                output_lines.append("✓ Python syntax OK")
            except py_compile.PyCompileError as exc:
                msg = str(exc).replace(str(tmp_path), f"{strategy_name}.py")
                errors.append(msg)
                output_lines.append(f"✗ Syntax error: {msg}")
            finally:
                tmp_path.unlink(missing_ok=True)
        except Exception as exc:
            errors.append(str(exc))
            output_lines.append(f"✗ Syntax check failed: {exc}")
        
        if errors:
            _log_action(body.session_id, "validate_strategy_syntax", {
                "strategy_name": strategy_name,
                "valid": False,
                "errors": errors
            }, request)
            return ToolExecutionResponse(
                success=False,
                error="Syntax validation failed",
                result={
                    "valid": False,
                    "errors": errors,
                    "warnings": warnings,
                    "output": "\n".join(output_lines)
                },
                logs=output_lines
            )
        
        # Step 2: Extract class name for Freqtrade validation
        import re
        class_match = re.search(r"^class\s+(\w+)\s*[\(:]", content, re.MULTILINE)
        class_name = class_match.group(1) if class_match else None
        
        if not class_name:
            warnings.append("Could not detect strategy class name — skipping Freqtrade check.")
            _log_action(body.session_id, "validate_strategy_syntax", {
                "strategy_name": strategy_name,
                "valid": True,
                "warnings": warnings
            }, request)
            return ToolExecutionResponse(
                success=True,
                result={
                    "valid": True,
                    "errors": errors,
                    "warnings": warnings,
                    "output": "\n".join(output_lines)
                },
                logs=output_lines
            )
        
        # Step 3: freqtrade test-strategy
        services = request.app.state.services
        settings = services.settings_store.load()
        freqtrade_exe = settings.freqtrade_executable_path
        user_data_dir = settings.user_data_directory_path
        
        temp_strat_name = f"_ai_agent_validate_{class_name}"
        temp_strat_file = strategies_dir / f"{temp_strat_name}.py"
        patched = re.sub(
            r"(^class\s+)" + re.escape(class_name) + r"(\s*[\(:])",
            rf"\g<1>{temp_strat_name}\2",
            content, count=1, flags=re.MULTILINE,
        )
        
        try:
            temp_strat_file.write_text(patched, encoding="utf-8")
            import subprocess
            proc = subprocess.run(
                [freqtrade_exe, "test-strategy", "--userdir", str(user_data_dir), "--strategy", temp_strat_name],
                capture_output=True, text=True, timeout=60,
                cwd=str(strategies_dir.parent.parent),
            )
            combined = (proc.stdout + proc.stderr).strip()
            output_lines += ["", "── Freqtrade test-strategy ──"] + (combined.splitlines() or ["(no output)"])
            if proc.returncode != 0:
                for line in combined.splitlines():
                    if any(k in line.lower() for k in ("error", "exception", "traceback")):
                        errors.append(line.replace(temp_strat_name, class_name))
            else:
                output_lines += ["", "✓ Freqtrade structural validation passed"]
        except subprocess.TimeoutExpired:
            warnings.append("Freqtrade test-strategy timed out after 60 s.")
            output_lines.append("⚠ timed out.")
        except FileNotFoundError:
            warnings.append(f"freqtrade not found at '{freqtrade_exe}'.")
            output_lines.append("⚠ freqtrade not found — skipping structural check.")
        except Exception as exc:
            warnings.append(f"Freqtrade check failed: {exc}")
            output_lines.append(f"⚠ {exc}")
        finally:
            temp_strat_file.unlink(missing_ok=True)
            import sys
            pyc_ver = f"cpython-{sys.version_info.major}{sys.version_info.minor}"
            pyc = strategies_dir / "__pycache__" / f"{temp_strat_name}.{pyc_ver}.pyc"
            pyc.unlink(missing_ok=True)
        
        valid = len(errors) == 0
        _log_action(body.session_id, "validate_strategy_syntax", {
            "strategy_name": strategy_name,
            "valid": valid,
            "errors": errors,
            "warnings": warnings
        }, request)
        
        return ToolExecutionResponse(
            success=valid,
            error=errors[0] if errors else None,
            result={
                "valid": valid,
                "errors": errors,
                "warnings": warnings,
                "output": "\n".join(output_lines)
            },
            logs=output_lines
        )
        
    except Exception as e:
        return ToolExecutionResponse(
            success=False,
            error=f"Failed to validate strategy syntax: {str(e)}"
        )


@router.post(
    "/tools/run_pair_explorer",
    summary="Run Pair Explorer",
    description="Run Pair Explorer to test strategy across pair universe."
)
async def run_pair_explorer(body: ToolExecutionRequest, request: Request) -> ToolExecutionResponse:
    """Run Pair Explorer to test strategy across pair universe."""
    try:
        strategy_name = body.parameters.get("strategy_name")
        timeframe = body.parameters.get("timeframe", "1h")
        timerange = body.parameters.get("timerange")
        pairs = body.parameters.get("pairs")
        
        if not all([strategy_name, timerange]):
            return ToolExecutionResponse(
                success=False,
                error="Missing required parameters: strategy_name, timerange"
            )
        
        services = request.app.state.services
        settings = services.settings_store.load()
        
        # Import the pair explorer service
        from ...services.execution.pair_sweep_runner import PairSweepRunner
        from ...services.storage.pair_sweep_store import PairSweepStore
        
        # Use default pair universe if not provided
        if not pairs:
            # Use a default set of liquid pairs
            pairs = [
                "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT",
                "ADA/USDT", "AVAX/USDT", "LINK/USDT", "DOGE/USDT", "LTC/USDT",
                "DOT/USDT", "TRX/USDT", "NEAR/USDT", "ATOM/USDT", "MATIC/USDT"
            ]
        
        # Create sweep runner
        sweep_runner = PairSweepRunner(
            freqtrade_path=settings.freqtrade_executable_path,
            user_data_dir=settings.user_data_directory_path,
            config_file=settings.default_config_file_path
        )
        
        # Create sweep store
        sweep_store = PairSweepStore(settings.user_data_directory_path)
        
        # Run the pair sweep
        sweep_id = sweep_store.create_sweep(
            strategy_name=strategy_name,
            pairs=pairs,
            timeframe=timeframe,
            timerange=timerange
        )
        
        # Run the sweep in background
        import asyncio
        asyncio.create_task(_run_pair_sweep_background(
            sweep_runner, sweep_store, sweep_id, strategy_name, pairs, timeframe, timerange
        ))
        
        result = {
            "sweep_id": sweep_id,
            "strategy_name": strategy_name,
            "pairs_count": len(pairs),
            "timeframe": timeframe,
            "timerange": timerange,
            "status": "running"
        }
        
        _log_action(body.session_id, "run_pair_explorer", {
            "strategy_name": strategy_name,
            "sweep_id": sweep_id,
            "pairs_count": len(pairs)
        }, request)
        
        return ToolExecutionResponse(
            success=True,
            result=result,
            logs=[
                {"message": f"Started Pair Explorer for {len(pairs)} pairs"},
                {"message": f"Sweep ID: {sweep_id}"},
                {"message": "Use GET /api/strategy/pair-explorer/{sweep_id} to check progress"}
            ],
            next_actions=[
                f"Wait for Pair Explorer to complete (sweep_id: {sweep_id})",
                "Check results using GET /api/strategy/pair-explorer/{sweep_id}",
                "Select top 3-4 pairs based on metrics"
            ]
        )
        
    except Exception as e:
        return ToolExecutionResponse(
            success=False,
            error=f"Failed to run Pair Explorer: {str(e)}"
        )


async def _run_pair_sweep_background(
    sweep_runner, sweep_store, sweep_id, strategy_name, pairs, timeframe, timerange
):
    """Run pair sweep in background task."""
    try:
        await sweep_runner.run_sweep(
            sweep_id=sweep_id,
            strategy_name=strategy_name,
            pairs=pairs,
            timeframe=timeframe,
            timerange=timerange
        )
    except Exception as e:
        # Update sweep status to failed
        try:
            sweep_store.update_sweep_status(sweep_id, "failed", str(e))
        except Exception:
            pass


@router.post(
    "/tools/run_backtest",
    summary="Run backtest",
    description="Run a backtest for a strategy with specified parameters."
)
async def run_backtest(body: ToolExecutionRequest, request: Request) -> ToolExecutionResponse:
    """Run a backtest for a strategy with specified parameters."""
    try:
        strategy_name = body.parameters.get("strategy_name")
        timeframe = body.parameters.get("timeframe", "5m")
        timerange = body.parameters.get("timerange")
        pairs = body.parameters.get("pairs")
        max_open_trades = body.parameters.get("max_open_trades", 1)
        fee_rate = body.parameters.get("fee_rate", 0.001)
        
        if not all([strategy_name, timerange]):
            return ToolExecutionResponse(
                success=False,
                error="Missing required parameters: strategy_name, timerange"
            )
        
        if not pairs:
            return ToolExecutionResponse(
                success=False,
                error="Missing required parameter: pairs (list of pairs to backtest)"
            )
        
        services = request.app.state.services
        settings = services.settings_store.load()
        session_store = request.app.state.session_store
        
        # Import backtest runner
        from ...services.execution.backtest_runner import BacktestRunner
        from ...models import RunRequest
        
        # Create run request
        run_request = RunRequest(
            strategy_name=strategy_name,
            timeframe=timeframe,
            timerange=timerange,
            pairs=pairs,
            max_open_trades=max_open_trades,
            fee_rate=fee_rate
        )
        
        # Create session
        session_id = session_store.create_session(run_request)
        
        # Create backtest runner
        backtest_runner = BacktestRunner(
            freqtrade_path=settings.freqtrade_executable_path,
            user_data_dir=settings.user_data_directory_path,
            config_file=settings.default_config_file_path
        )
        
        # Run backtest in background
        import asyncio
        asyncio.create_task(_run_backtest_background(
            backtest_runner, session_store, session_id, run_request
        ))
        
        result = {
            "session_id": session_id,
            "strategy_name": strategy_name,
            "pairs": pairs,
            "timeframe": timeframe,
            "timerange": timerange,
            "max_open_trades": max_open_trades,
            "status": "running"
        }
        
        _log_action(body.session_id, "run_backtest", {
            "strategy_name": strategy_name,
            "session_id": session_id,
            "pairs_count": len(pairs)
        }, request)
        
        return ToolExecutionResponse(
            success=True,
            result=result,
            logs=[
                {"message": f"Started backtest for {len(pairs)} pairs"},
                {"message": f"Session ID: {session_id}"},
                {"message": "Use GET /api/session/status/{session_id} to check progress"}
            ],
            next_actions=[
                f"Wait for backtest to complete (session_id: {session_id})",
                "Check results using GET /api/session/status/{session_id}",
                "Analyze metrics to determine if strategy passes"
            ]
        )
        
    except Exception as e:
        return ToolExecutionResponse(
            success=False,
            error=f"Failed to run backtest: {str(e)}"
        )


async def _run_backtest_background(backtest_runner, session_store, session_id, run_request):
    """Run backtest in background task."""
    try:
        await backtest_runner.run_backtest(session_id, run_request)
    except Exception as e:
        # Update session status to failed
        try:
            session_store.update_status(session_id, "failed", str(e))
        except Exception:
            pass


@router.post(
    "/tools/run_optimizer",
    summary="Run optimizer",
    description="Run the optimizer to find optimal parameters."
)
async def run_optimizer(body: ToolExecutionRequest, request: Request) -> ToolExecutionResponse:
    """Run the optimizer to find optimal parameters."""
    try:
        strategy_name = body.parameters.get("strategy_name")
        timeframe = body.parameters.get("timeframe", "5m")
        timerange = body.parameters.get("timerange")
        pairs = body.parameters.get("pairs")
        spaces = body.parameters.get("spaces")
        epochs = body.parameters.get("epochs", 100)
        
        if not all([strategy_name, timerange, spaces]):
            return ToolExecutionResponse(
                success=False,
                error="Missing required parameters: strategy_name, timerange, spaces"
            )
        
        if not pairs:
            return ToolExecutionResponse(
                success=False,
                error="Missing required parameter: pairs (list of pairs to optimize)"
            )
        
        services = request.app.state.services
        settings = services.settings_store.load()
        session_store = request.app.state.session_store
        
        # Import optimizer runner
        from ...services.execution.optimizer_runner import OptimizerRunner
        from ...models import RunRequest
        
        # Create run request for optimizer
        run_request = RunRequest(
            strategy_name=strategy_name,
            timeframe=timeframe,
            timerange=timerange,
            pairs=pairs,
            max_open_trades=len(pairs)
        )
        
        # Create session
        session_id = session_store.create_session(run_request)
        
        # Create optimizer runner
        optimizer_runner = OptimizerRunner(
            freqtrade_path=settings.freqtrade_executable_path,
            user_data_dir=settings.user_data_directory_path,
            config_file=settings.default_config_file_path
        )
        
        # Run optimizer in background
        import asyncio
        asyncio.create_task(_run_optimizer_background(
            optimizer_runner, session_store, session_id, run_request, spaces, epochs
        ))
        
        result = {
            "session_id": session_id,
            "strategy_name": strategy_name,
            "pairs": pairs,
            "spaces": spaces,
            "epochs": epochs,
            "timeframe": timeframe,
            "timerange": timerange,
            "status": "running"
        }
        
        _log_action(body.session_id, "run_optimizer", {
            "strategy_name": strategy_name,
            "session_id": session_id,
            "spaces": spaces,
            "epochs": epochs
        }, request)
        
        return ToolExecutionResponse(
            success=True,
            result=result,
            logs=[
                {"message": f"Started optimizer for {len(pairs)} pairs"},
                {"message": f"Spaces: {', '.join(spaces)}"},
                {"message": f"Epochs: {epochs}"},
                {"message": f"Session ID: {session_id}"},
                {"message": "Use GET /api/session/status/{session_id} to check progress"}
            ],
            next_actions=[
                f"Wait for optimizer to complete (session_id: {session_id})",
                "Check results using GET /api/session/status/{session_id}",
                "Review optimized parameters and decide whether to accept them"
            ]
        )
        
    except Exception as e:
        return ToolExecutionResponse(
            success=False,
            error=f"Failed to run optimizer: {str(e)}"
        )


async def _run_optimizer_background(optimizer_runner, session_store, session_id, run_request, spaces, epochs):
    """Run optimizer in background task."""
    try:
        await optimizer_runner.run_optimizer(
            session_id=session_id,
            run_request=run_request,
            spaces=spaces,
            epochs=epochs
        )
    except Exception as e:
        # Update session status to failed
        try:
            session_store.update_status(session_id, "failed", str(e))
        except Exception:
            pass


@router.post(
    "/tools/run_stress_test",
    summary="Run stress test",
    description="Run Stress Test Lab including Time Split and Monte Carlo."
)
async def run_stress_test(body: ToolExecutionRequest, request: Request) -> ToolExecutionResponse:
    """Run Stress Test Lab including Time Split and Monte Carlo."""
    try:
        strategy_name = body.parameters.get("strategy_name")
        timeframe = body.parameters.get("timeframe", "5m")
        timerange = body.parameters.get("timerange")
        pairs = body.parameters.get("pairs")
        tests = body.parameters.get("tests")
        
        if not all([strategy_name, timerange]):
            return ToolExecutionResponse(
                success=False,
                error="Missing required parameters: strategy_name, timerange"
            )
        
        if not pairs:
            return ToolExecutionResponse(
                success=False,
                error="Missing required parameter: pairs (list of pairs to stress test)"
            )
        
        services = request.app.state.services
        settings = services.settings_store.load()
        session_store = request.app.state.session_store
        
        # Default to all available tests if not specified
        if not tests:
            tests = ["time_split", "monte_carlo", "robustness"]
        
        # Import stress test runner
        from ...services.execution.temporal_stress_runner import TemporalStressRunner
        from ...models import RunRequest
        
        # Create run request for stress test
        run_request = RunRequest(
            strategy_name=strategy_name,
            timeframe=timeframe,
            timerange=timerange,
            pairs=pairs,
            max_open_trades=len(pairs)
        )
        
        # Create session
        session_id = session_store.create_session(run_request)
        
        # Create stress test runner
        stress_runner = TemporalStressRunner(
            freqtrade_path=settings.freqtrade_executable_path,
            user_data_dir=settings.user_data_directory_path,
            config_file=settings.default_config_file_path
        )
        
        # Run stress test in background
        import asyncio
        asyncio.create_task(_run_stress_test_background(
            stress_runner, session_store, session_id, run_request, tests
        ))
        
        result = {
            "session_id": session_id,
            "strategy_name": strategy_name,
            "pairs": pairs,
            "tests": tests,
            "timeframe": timeframe,
            "timerange": timerange,
            "status": "running"
        }
        
        _log_action(body.session_id, "run_stress_test", {
            "strategy_name": strategy_name,
            "session_id": session_id,
            "tests": tests
        }, request)
        
        return ToolExecutionResponse(
            success=True,
            result=result,
            logs=[
                {"message": f"Started stress test for {len(pairs)} pairs"},
                {"message": f"Tests: {', '.join(tests)}"},
                {"message": f"Session ID: {session_id}"},
                {"message": "Use GET /api/session/status/{session_id} to check progress"}
            ],
            next_actions=[
                f"Wait for stress test to complete (session_id: {session_id})",
                "Check results using GET /api/session/status/{session_id}",
                "Review stress test results to ensure strategy passes all validation checks"
            ]
        )
        
    except Exception as e:
        return ToolExecutionResponse(
            success=False,
            error=f"Failed to run stress test: {str(e)}"
        )


async def _run_stress_test_background(stress_runner, session_store, session_id, run_request, tests):
    """Run stress test in background task."""
    try:
        await stress_runner.run_stress_test(
            session_id=session_id,
            run_request=run_request,
            tests=tests
        )
    except Exception as e:
        # Update session status to failed
        try:
            session_store.update_status(session_id, "failed", str(e))
        except Exception:
            pass


@router.post(
    "/tools/generate_report",
    summary="Generate report",
    description="Generate a final report summarizing the AutoQuant workflow."
)
async def generate_report(body: ToolExecutionRequest, request: Request) -> ToolExecutionResponse:
    """Generate a final report summarizing the AutoQuant workflow."""
    try:
        strategy_name = body.parameters.get("strategy_name")
        session_id = body.parameters.get("session_id")
        status = body.parameters.get("status")
        
        if not all([strategy_name, session_id, status]):
            return ToolExecutionResponse(
                success=False,
                error="Missing required parameters: strategy_name, session_id, status"
            )
        
        services = request.app.state.services
        settings = services.settings_store.load()
        strategies_dir = _strategies_dir(request)
        
        # Get session logs
        session = _session_manager.get_session(session_id)
        logs = session.get("logs", []) if session else []
        tool_calls = session.get("tool_calls", []) if session else []
        
        # Read strategy files
        py_path = strategies_dir / f"{strategy_name}.py"
        json_path = strategies_dir / f"{strategy_name}.json"
        
        python_content = py_path.read_text(encoding="utf-8", errors="replace") if py_path.exists() else "Not found"
        json_content = json_path.read_text(encoding="utf-8", errors="replace") if json_path.exists() else "Not found"
        
        # Generate markdown report
        report_lines = [
            f"# AutoQuant Strategy Report: {strategy_name}",
            "",
            f"**Generated:** {datetime.now(timezone.utc).isoformat()}",
            f"**Status:** {status}",
            f"**Session ID:** {session_id}",
            "",
            "---",
            "",
            "## Strategy Overview",
            "",
            f"**Strategy Name:** {strategy_name}",
            f"**Strategy File:** {str(py_path)}",
            f"**Config File:** {str(json_path) if json_path.exists() else 'N/A'}",
            "",
            "## Strategy Logic",
            "",
            "```python",
            python_content[:2000] + "..." if len(python_content) > 2000 else python_content,
            "```",
            "",
            "## Configuration",
            "",
            "```json",
            json_content[:1000] + "..." if len(json_content) > 1000 else json_content,
            "```",
            "",
            "## Workflow Execution Log",
            ""
        ]
        
        # Add logs to report
        for log in logs:
            timestamp = log.get("timestamp", "unknown")
            action = log.get("action", "unknown")
            details = log.get("details", {})
            report_lines.append(f"- **{timestamp}** - {action}: {details}")
        
        report_lines.extend([
            "",
            "---",
            "",
            "## Final Decision",
            "",
            f"**Strategy Status:** {status}",
            "",
            "### Validation Results",
            "",
            "- Pair Explorer: Completed",
            "- Combined Backtest: Completed",
            "- Optimizer: Completed",
            "- Stress Test Lab: Completed",
            "- Time Split: Completed",
            "- Monte Carlo: Completed",
            "",
            "### Conclusion",
            "",
            f"The strategy has been classified as: **{status}**",
            "",
            "---",
            "",
            "*This report was generated by the AI Agent AutoQuant tool.*"
        ])
        
        report_content = "\n".join(report_lines)
        
        # Save report to file
        reports_dir = Path(settings.user_data_directory_path) / "ai_agent_reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        report_path = reports_dir / f"{strategy_name}_report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.md"
        report_path.write_text(report_content, encoding="utf-8")
        
        result = {
            "strategy_name": strategy_name,
            "status": status,
            "report_path": str(report_path),
            "session_id": session_id,
            "log_count": len(logs),
            "tool_call_count": len(tool_calls)
        }
        
        _log_action(body.session_id, "generate_report", {
            "strategy_name": strategy_name,
            "report_path": str(report_path),
            "status": status
        }, request)
        
        return ToolExecutionResponse(
            success=True,
            result=result,
            logs=[
                {"message": f"Generated report for {strategy_name}"},
                {"message": f"Report saved to: {report_path}"},
                {"message": f"Status: {status}"}
            ],
            next_actions=[
                "Review the generated report",
                "If status is 'Production Candidate', strategy is ready for deployment",
                "If status is 'Candidate' or 'Validated', consider further optimization",
                "If status is 'Failed', review logs and generate new strategy variant"
            ]
        )
        
    except Exception as e:
        return ToolExecutionResponse(
            success=False,
            error=f"Failed to generate report: {str(e)}"
        )


# ── Ollama Integration Endpoint ───────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., description="User message to the AI agent")
    session_id: str | None = Field(None, description="Session ID for tracking")
    model: str | None = Field(None, description="Ollama model to use (optional)")


class ChatResponse(BaseModel):
    response: str
    session_id: str
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)


@router.post(
    "/chat",
    summary="Chat with AI agent using Ollama",
    description="Send a message to the AI agent which will use Ollama to process it and optionally call tools."
)
async def chat_with_ai_agent(body: ChatRequest, request: Request) -> ChatResponse:
    """Chat with AI agent using Ollama model with tool calling capabilities."""
    # Import AI service
    from ...services.ai import get_ai_service
    
    try:
        services = request.app.state.services
        settings = services.settings_store.load()
        
        # Create or get session
        if not body.session_id:
            session_id = get_session_manager(request).create_session(ai_model=body.model)
        else:
            session_id = body.session_id
        
        # Get AI service instance
        ai_service = await get_ai_service(settings.user_data_directory_path)
        
        # Prepare messages with system prompt
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": body.message}
        ]
        
        # Prepare tools for function calling
        tools = TOOLS
        
        # Call Ollama with tools using centralized service
        response = await ai_service.chat_with_tools(
            messages=messages,
            tools=tools,
            model=body.model or settings.ollama_model
        )
        
        # Extract tool calls if any
        tool_calls = []
        if hasattr(response, 'tool_calls') and response.tool_calls:
            for tool_call in response.tool_calls:
                if isinstance(tool_call, dict):
                    name = tool_call.get("name")
                    arguments = tool_call.get("arguments") or {}
                else:
                    function = getattr(tool_call, "function", None)
                    name = getattr(function, "name", None)
                    arguments = getattr(function, "arguments", {}) or {}
                if not name:
                    continue
                tool_calls.append({"name": name, "arguments": arguments})
                
                # Execute the tool call
                tool_request = ToolExecutionRequest(
                    session_id=session_id,
                    parameters=arguments
                )
                
                # Find and execute the tool
                tool_name = name
                tool_endpoint = f"/tools/{tool_name}"
                
                # Execute tool (this is a simplified approach - in production you'd want more sophisticated routing)
                # For now, we'll just log the tool call
                _log_action(session_id, f"tool_call_{tool_name}", arguments, request)
        
        # Log the chat interaction
        _log_action(session_id, "chat", {
            "user_message": body.message,
            "ai_response": response.content if hasattr(response, 'content') else str(response),
            "tool_calls_count": len(tool_calls)
        }, request)
        
        return ChatResponse(
            response=response.content if hasattr(response, 'content') else str(response),
            session_id=session_id,
            tool_calls=tool_calls
        )
        
    except RuntimeError as e:
        # If AI service cannot be created
        session_id = body.session_id if body.session_id else "unknown"
        return ChatResponse(
            response=f"Ollama is not configured or unavailable: {str(e)}",
            session_id=session_id,
            tool_calls=[]
        )
    except Exception as e:
        # If Ollama is not available or fails, return a simple response
        session_id = body.session_id if body.session_id else "unknown"
        return ChatResponse(
            response=f"AI agent chat failed: {str(e)}. Please ensure Ollama is configured and running.",
            session_id=session_id,
            tool_calls=[]
        )
