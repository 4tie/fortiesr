# Strategy Lab — Application Reference Guide

## Overview
Strategy Lab is a full-stack Freqtrade algorithmic trading platform with an integrated
AI agent/planner system. It enables backtesting, hyperparameter optimisation, and
AI-assisted strategy development through a React + FastAPI architecture.

---

## Architecture

```
frontend/           React + Vite (DaisyUI / Tailwind)
backend/
  api/
    app.py          FastAPI factory, CORS, rate-limit middleware
    routers/        One file per feature domain:
      ai_chat.py      AI chat endpoint + plan-checkpoint + evaluate-plan
      backtest.py     Non-blocking backtest runner
      hyperopt.py     Hyperopt runner + cancel kill-switch + apply-results
      results_list.py Run history with 30-second TTL cache
      user_profile.py Meta-learning profile recorder
      ...
  services/
    ai/
      agent_tools.py  All AI tool definitions (AGENT_TOOLS schema + AgentToolExecutor)
      agent_loop.py   Dual-model agentic loop (execution model + thinking model)
    snapshot_service.py  .py/.json snapshot/restore
    backtest_runner.py   Subprocess wrapper for freqtrade backtest
  models.py           Shared Pydantic models
user_data/
  strategies/         Strategy .py + companion .json files
  frontend_shared_state.json  Active pairs / timeframe / strategy shared between FE and BE
  sessions.json       Hyperopt session registry
```

---

## AI Agent System

### Chat Modes
| Mode | Router | Description |
|------|--------|-------------|
| `agent` | dual-model loop | Tool-calling agent; can rewrite files, run hyperopt, trigger backtests |
| `planner` | thinking model only | Outputs structured improvement plans with `### APPROVED PLAN SPECIFICATION` marker |

### Tool Registry (`AGENT_TOOLS`)
All tools are defined as JSON schemas in `backend/services/ai/agent_tools.py` and
executed by `AgentToolExecutor`. Tools:

| Tool | Purpose |
|------|---------|
| `run_hyperopt_optimization` | Launch freqtrade hyperopt as a background daemon thread |
| `rewrite_strategy_file` | Write a new strategy .py (3-stage guard: string → py_compile → AST inheritance) |
| `generate_autonomous_strategy` | Build a complete strategy .py + .json from a description and trading_style |
| `read_latest_results` | Parse the most recent backtest result JSON for a strategy |
| `read_strategy_code` | Read a strategy .py source file |
| `update_strategy_parameters` | Patch a strategy companion .json with new parameter values |
| `trigger_data_download` | Start a freqtrade data download for specified pairs |
| `remove_pair_from_shared_state` | Remove a pair from the active whitelist |
| `rollback_strategy` | Restore strategy to the most recent snapshot |
| `read_execution_logs` | Read `user_data/logs/last_error.log` |
| `read_hyperopt_results` | Read and summarise hyperopt session results |

### Autonomous Strategy Generator (`generate_autonomous_strategy`)
Generates a complete, hyperopt-ready Freqtrade strategy from a plain-language description.

**Trading styles and their indicator stacks:**
- `scalping` → Bollinger Bands (BB) + RSI + ATR trailing stop — default timeframe `5m`
- `swing` → EMA crossover + MACD + volume SMA filter — default timeframe `1h`
- `trend_following` → ADX + EMA(50/200) + Donchian channel breakout — default `4h`
- `mean_reversion` → RSI + BB squeeze detection (bb_width) — default `15m`

All threshold parameters are offloaded to a companion `.json` file as
`IntParameter`/`DecimalParameter` values with `load=True`, ready for
`freqtrade hyperopt` without touching the Python source.

The tool auto-reads `user_profile.json` (then `frontend_shared_state.json`) to
populate `preferred_pairs` and `preferred_timeframes` context.

---

## Plan Lifecycle

```
Planner chat → produces "### APPROVED PLAN SPECIFICATION" block
   ↓
User clicks "Implement Plan"
   ↓ handleImplementPlan (AIChatPanel.jsx)
   → POST /api/ai/plan-checkpoint  — snapshot + baseline metrics
   → setChatMode("agent")
   → send() — agent executes the plan (tool calls)
   → runPlanEvaluation() — POST /api/ai/evaluate-plan
       → runs validation backtest (asyncio.to_thread)
       → compares current_metrics vs baseline_metrics
       → PLAN_PASSED → success banner
       → PLAN_DEGRADED → rollback + PlanDegradedBanner + post-mortem planner turn
```

---

## Key Data Files

| File | Purpose |
|------|---------|
| `user_data/frontend_shared_state.json` | Active pairs, timeframe, strategy, wallet settings |
| `user_data/sessions.json` | Hyperopt session store |
| `backend/data/user_profile.json` | Meta-learning profile (preferred pairs, timeframes, performance history) |
| `user_data/strategies/{name}.py` | Strategy source (Freqtrade IStrategy subclass) |
| `user_data/strategies/{name}.json` | Companion parameter file (hyperoptable values, minimal_roi, stoploss) |
| `user_data/logs/last_error.log` | Last subprocess stderr for debugging |

---

## API Endpoints (key routes)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/chat` | Run one AI chat turn (agent or planner mode) |
| POST | `/api/ai/plan-checkpoint` | Create pre-plan snapshot + capture baseline metrics |
| POST | `/api/ai/evaluate-plan` | Run validation backtest + compare metrics + auto-rollback |
| POST | `/api/backtest/run` | Start a non-blocking backtest job |
| POST | `/api/hyperopt/run` | Launch hyperopt as a background thread |
| POST | `/api/hyperopt/cancel/{session_id}` | SIGTERM the active hyperopt subprocess |
| POST | `/api/hyperopt/apply` | Write best hyperopt result to strategy .json |
| GET  | `/api/results` | List completed backtest runs (30s TTL cache) |
| POST | `/api/user-profile/record` | Record a backtest outcome for meta-learning |

---

## Rate Limits (middleware in app.py)
| Route | Limit |
|-------|-------|
| `/api/ai/chat` | 30 POST / min |
| `/api/backtest/run` | 10 POST / min |
| `/api/hyperopt/run` | 5 POST / min |

Exceeded requests return HTTP 429 with a `detail` message.

---

## Frontend State Management

Key state in `AIChatPanel.jsx`:
- `chatMode` — `"agent"` or `"planner"`
- `lockedTimeframes` — `Set<string>` persisted to `localStorage["strategylab:lockedTimeframes"]`
- `checkpointing` — boolean spinner shown while `/api/ai/plan-checkpoint` is in-flight
- `activeStrategy` — strategy currently open in the editor (passed as prop)
- `activeSessionId` — current AI chat session

---

## Guard Rails for Strategy Files
`rewrite_strategy_file` performs three sequential validation gates before writing:
1. **String guard** — `"IStrategy"` and `"populate_entry_trend"` must appear in the code
2. **Syntax guard** — `py_compile.compile()` validates Python syntax (no SyntaxError)
3. **AST guard** — `ast.walk()` verifies a class definition explicitly inherits from `IStrategy`

If any gate fails, the file is NOT written and the agent receives an error string to self-correct.
