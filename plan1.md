# plan1.md

## 1. Project Overview

**Strategy Lab** — a Freqtrade-based trading strategy discovery, validation, optimization, and export platform. The workflow is: AI suggests → Backend validates → Freqtrade tests → AutoQuant decides. It provides a React frontend (10 tabs) backed by a FastAPI Python backend. The primary user-facing feature is the **Auto-Quant Factory** pipeline, which takes a strategy through 7 stages of validation before delivery.

**Repository root:** `/home/mohs/Desktop/fictional-octo-guide/`

## 2. Backend Structure

```
server.py                                  # ASGI entrypoint (uvicorn server:app)
backend/
  __init__.py
  main.py                                  # Alternate entry point
  paths.py                                 # build_local_paths() — all path resolution
  settings_store.py                        # SettingsStore — load/save strategy_lab_settings.json
  app_services.py                          # AppServices — wires all stores/runners/registries
  runtime.py                               # create_services() — service graph factory
  utils.py                                 # Shared I/O helpers (atomic_write_json, read_json, etc.)
  quality_gate_runner.py                   # Quality gate checks
  core/
    config.py                              # Core configuration
    errors.py                              # BackendError exception class
  api/
    app.py                                 # FastAPI factory (CORS, rate limiter, lifespan, router includes)
    session_store.py                       # SessionStore for backtest job tracking
    log_broadcaster.py                     # SSE log streaming
    routers/
      auto_quant.py                        # 15+ endpoints for Auto-Quant pipeline
      backtest.py                          # POST /api/backtest/run (rate limited 10/min)
      ai_assistant.py                      # AI chat endpoints
      ai_agent.py                          # AI agent session manager
      settings.py, data.py, logs.py, ...   # Other domain routers
  models/
    contracts.py                           # SettingsModel, RunRequest, all request/response models
    base.py                                # Base model classes (StrictModel, StrategyRecord, etc.)
    domain/strategy.py                     # Strategy domain model
    results.py, runs.py, optimizer.py      # Domain-specific models
  services/
    auto_quant/                            # Main Auto-Quant pipeline (detailed below)
    execution/
      backtest_runner.py                   # Synchronous Freqtrade subprocess wrapper (642 lines)
      data_download_runner.py              # Freqtrade data download
      pair_sweep_runner.py                 # Multi-pair backtest sweeps
      run_progress.py                      # Run progress tracking
    strategy/
      strategy_registry.py                 # Strategy file scanning
      version_manager.py                   # Versioned strategy management
      strategy_git.py                      # Git integration for strategies
      comparison.py                        # Run comparison engine
      strategy_optimizer.py                # Parameter optimizer
      optimizer_auto_safe.py               # Auto-safe optimizer
      optimizer_search_spaces.py           # Search space definitions
      optimizer_session.py                 # Optimizer sessions
      optimizer_trial.py                   # Optimizer trials
      strategy_source.py                   # Strategy source parsing
      snapshot_service.py                  # Backup snapshots
    storage/
      run_repository.py                    # Run metadata persistence
      result_parser.py                     # Freqtrade result parsing
      optimizer_store.py                   # Optimizer state persistence
      pair_sweep_store.py                  # Pair sweep results
      exported_trial_store.py              # Exported trial data
    pairs/pair_selector.py                 # Pair selection logic
    maintenance/maintenance.py             # System maintenance
  validators/
    strategy_validator.py                  # Strategy input validation
    backtest_validator.py                  # Backtest result validation
  executors/
    backtest_executor.py                   # Synchronous subprocess executor
    ai_executor.py                         # AI task executor
  repositories/
    strategy_repository.py                 # Strategy storage
    run_repository.py                      # Pipeline run persistence
    result_repository.py                   # Backtest result storage
  engine/                                  # Strategy generation engines (older pattern)
    strategy_generator.py
    discovery_engine.py
    validation_engine.py
    elite_validation_engine.py
    elite_ranking_engine.py
    backtest_engine.py
    oos_walkforward_engine.py
    multi_tier_validation_engine.py
    robustness_engine.py
    report_generator.py
    strategy_scorer.py
  tests/                                   # Backend test suite
    test_api.py, test_auto_quant_pipeline.py, ...
    auto_quant/                            # Auto-Quant-specific tests
  stubs/talib/                             # TA-Lib stubs for testing
```

## 3. Frontend Structure

```
frontend/
  vite.config.js                           # Vite config, proxies /api/* → localhost:8000, ws support
  package.json                             # React 19, Vite 8, Tailwind 4, daisyUI 5, Recharts
  eslint.config.js, jest.config.js, babel.config.js
  src/
    App.jsx                                # Tab routing (10 tabs), health check polling every 15s
    index.css, main.jsx
    services/api.js                        # Central API service (api.autoquant namespace)
    hooks/
      useTheme.js                          # Theme persistence to localStorage "sl-theme"
      useStrategies.js                     # Strategy listing hook
      usePairs.js                          # Pair search hook
      useSharedState.js                    # Shared state between tabs
      useAgentUiState.js                   # AI assistant context sync
    components/
      AutoQuantTab.jsx                     # **3615 lines** — monolithic Auto-Quant pipeline UI
      RunHistoryDashboard.jsx              # Pipeline run history list
      RunDetailPanel.jsx                   # Run detail overlay (Summary, Parameters, Pairs, Stages tabs)
      RunDetailSummary/                    # Sub-components for run detail tabs
      SettingsTab.jsx                      # Settings page (local useState, GET/POST /api/settings)
      BacktestForm.jsx, ResultsView.jsx, OptimizerTab.jsx, ...
    features/autoquant/                    # Legacy/alternative AutoQuant components (NOT used by main tab)
      services/autoQuantAPI.js             # Separate API client (has bugs — references api.autoquant.baseURL which doesn't exist)
      hooks/useAutoQuantState.js           # Reusable hook (NOT used by AutoQuantTab.jsx)
      components/                          # StrategyGenerator, PipelineStages, charts, etc. (all unused by main tab)
```

## 4. Existing AutoQuant Flow

The Auto-Quant pipeline is the core feature. It lives in `backend/services/auto_quant/` and is orchestrated through `pipeline_modules/orchestrator.py:run_pipeline()`.

**Pipeline stages** (as defined in `pipeline_modules/config.py:STAGE_NAMES` — currently 5 stages in config, but the orchestrator implements 7 with discovery phases):

1. **Pre-Flight Filtering** (`stages_validation.py:_stage_pre_flight_filtering`) — Data healing + baseline backtest + pair filtering. Produces a pair universe and sanity baseline. Has a **user approval checkpoint** before proceeding.
2. **Portfolio Baseline** (`stages_validation.py:_stage_portfolio_baseline`) — Joint backtest with capital constraints. **Second user approval checkpoint**.
3. **WFA Hyperopt** (`stages_optimization.py:_stage_hyperopt`) — Walk-Forward Optimization or standard hyperopt + sensitivity robustness check. Self-healing retry with optional Ollama AI suggestions.
4. **Robustness & Feature Injection** (`stages_validation.py:_stage_robustness_feature_injection`) — Slippage/fee stress testing (1x/2x/3x fees) + stability scores + custom_stoploss injection + trading window analysis.
5. **Portfolio Competition** (`stages_assessment.py:_stage_joint_portfolio_backtest`) — Joint portfolio backtest with dual-factor ATR/stability position sizing + capital starvation detection + Monte Carlo + profit giveback.
6. **Delivery** (`stages_assessment.py:_stage_delivery`) — Generates config.json + report.json + sidecar params JSON. Final score computed by `pipeline_modules/scoring.py:compute_score()`.

**Pipeline state machine** (`pipeline_modules/state.py`):
- `PipelineState` — dataclass with run_id, strategy, thresholds, hyperopt settings, retry count, WFO settings, ensemble flags
- `StageState` — dataclass per stage: index, name, status, message, data, timing
- States: `pending → running → completed|failed|cancelled|interrupted`, plus `awaiting_user_approval` pause point
- Persistence: state saved as JSON in `user_data/auto_quant/<run_id>/state.json`
- Versioned artifacts: `state_v1.json`, `config_v1.json`, `report_v1.json`, `latest` symlinks

**Pipeline start** — router at `auto_quant.py:_start_pipeline_from_body()`:
1. Loads settings and normalizes run config via `build_run_config()`
2. Validates config file and strategy file exist
3. Builds a `run_config_snapshot` dict
4. Calls `pipeline.create_run()` to instantiate PipelineState
5. Launches `asyncio.create_task(pipeline.run_pipeline(run_id))`
6. Returns 202 with run_id

**Strategy generation** (`generator.py`) — 5 template types:
- `generate_strategy_source(class_name)` — basic CategoricalParameter with 3 entry logics
- `generate_strategy_source_adaptive()` — ATR-based regime detection (trending/ranging)
- `generate_strategy_source_momentum()` — EMA crossover + ATR volatility gate
- `generate_strategy_source_omni()` — Omni-Strategy with Boolean switches for RSI, MACD, BB, EMA, ADX, ATR + profit lock-in tiers + ATR sizing + trading window filter
- `generate_strategy_source_ensemble()` — Weighted Alpha Consensus Voting across 3 signals

**Frontend flow** (`AutoQuantTab.jsx`):
- Form collects: strategy name, timeframe, date ranges, exchange, thresholds, hyperopt settings, WFO, ensemble, pair override
- POSTs to `/api/auto-quant/start` with full form as body
- Opens WebSocket at `/api/auto-quant/ws/{runId}` for real-time updates
- WebSocket carries 8 message types: `snapshot`, `final`, `wfo_window`, `sensitivity_result`, `hyperopt_epoch`, `data_healing_start`, `data_pair_status`, `data_healing_summary`
- Reconnect with exponential backoff (3s→6s→12s… capped 30s, max 10 attempts)
- Form state persisted via `/api/auto-quant/options` (GET on mount, POST on change with 500ms debounce)

## 5. Existing Freqtrade Integration

**Backtest runner** (`backend/services/execution/backtest_runner.py:BacktestRunner`, 642 lines):
- Synchronous subprocess wrapper — runs `freqtrade backtesting` as a subprocess
- Methods: `run_backtest()`, `run_backtest_with_version()`, `queue_strategy_backtest()` (async wrapper for optimizer)
- Manages: active process tracking, cancellation, log streaming via callback
- Preflight checks: data existence, timerange coverage, strategy syntax validation
- Result parsing: reads Freqtrade output JSON, parses trades, pairs, metrics
- Run persistence: writes metadata JSON, progress JSON, logs

**Data download runner** (`data_download_runner.py:DataDownloadRunner`):
- Runs `freqtrade download-data` as subprocess
- Skips existing data by checking file existence

**Strategies directory**: `user_data/strategies/` — holds `.py` strategy files in Freqtrade-compatible format
**Config**: `user_data/config.json` — base Freqtrade configuration
**Freqtrade executable**: configurable in settings, defaults to `.venv/bin/freqtrade` or `freqtrade` in PATH

## 6. Existing AI / Ollama Integration

**OllamaClient** (`ollama_service.py`, 1165 lines):
- `OllamaClient` — aiohttp-based async client with:
  - `generate()` — text generation with `format="json"` support
  - `chat_with_tools()` — chat with function calling
  - `check_health()` — pings `/api/tags`
- **Circuit breaker** (5 consecutive failures → 300s cooldown) in `CircuitBreaker` dataclass
- **Retry with backoff**: 4 retries at [10s, 30s, 40s, 50s]
- `create_ollama_client_from_settings()` — factory reading from `strategy_lab_settings.json`
- `clean_json_response()` — strips markdown/prefix/suffix from AI output
- `validate_ollama_suggestions()` — validates stoploss sign, ROI monotonicity, hyperopt spaces, safe ranges

**AI-powered features**:
- `ask_ollama_for_sensitivity_fix()` — suggests parameter adjustments when sensitivity check fails (sharp peak detected)
- `ask_ollama_for_wfa_fix()` — suggests WFO config changes when walk-forward fails
- Both functions: check circuit breaker → health check → build context (market conditions, historical success rates, strategy type) → call AI → validate response

**Scoring & validation helpers**:
- `summarize_hyperopt_trials()` — trial statistics + correlation with loss
- `summarize_market_conditions()` — volatility, ATR, regime, trend detection
- `summarize_failure_metrics()` — formats failed metrics for AI input
- `_analyze_market_conditions()` — timeframe_type, volatility_regime, duration_days
- `_analyze_historical_success_rates()` — success rates per loss function/spaces/epochs

**Settings** (`SettingsModel` in `contracts.py`):
- `ollama_provider: str = "local"` — toggle between local and ollama_cloud
- `ollama_api_url: str = "http://localhost:11434"`
- `ollama_api_key: str = ""` — required for cloud provider
- `ollama_model: str = ""`
- `ollama_timeout: int = 30`
- `ollama_self_healing_enabled: bool = False`
- Uses `extra="ignore"` for backward compatibility

## 7. Existing Data Models / Repositories

**Key models** (`backend/models/contracts.py`):
- `SettingsModel` — all configuration fields, `extra="ignore"`
- `RunRequest` — backtest run request with validation
- `VersionBacktestRequest` — version comparison backtest
- `AcceptVersionRequest`, `RejectVersionRequest`, `RollbackVersionRequest` — version lifecycle
- `StrategyDetail`, `StrategyFiles` — strategy + version info
- `RunDetail`, `RunListItem`, `RunStatusPayload` — run data
- `ComparisonResult`, `ComparisonMetric`, `PairComparison` — run comparison
- `LocalPaths` — all resolved paths
- `GitLogEntry`, `StrategyGitCommitRow`, `StrategyGitHistory` — git integration

**Pipeline state** (`pipeline_modules/state.py`):
- `PipelineState` — 40+ fields: run_id, strategy, timeframes, thresholds, hyperopt settings, retry state, WFO settings, ensemble flags, discovery results, validation notes, advanced overrides
- `StageState` — per-stage status tracking

**Repositories** (`backend/services/storage/run_repository.py`):
- `RunRepository` — list/load/save RunMetadata, progress, parsed results
- `ResultParser` — parses Freqtrade backtest result JSON into structured models
- `OptimizerStore` — optimizer sessions (load/save/list with conflict resolution)
- `PairSweepStore` — pair sweep results
- `ExportedTrialStore` — exported optimizer trial data

**Domain models** (`models/domain/strategy.py`):
- `Strategy` — strategy domain object
- Strategy registry scans `user_data/strategies/` directory

## 8. Existing Progress / WebSocket Flow

**WebSocket endpoint**: `GET /api/auto-quant/ws/{run_id}` — defined in `auto_quant.py` router

**WebSocket message types** (frontend `AutoQuantTab.jsx` handler):
| Type | Source | Purpose |
|------|--------|---------|
| `snapshot` | Pipeline state | Full state update (merge into pipelineState) |
| `final` | Pipeline completion | State + report together |
| `wfo_window` | WFO stage | Per-window result (profit, trades, sharpe) |
| `sensitivity_result` | Sensitivity check | Perturbation results (p_best, p_minus, p_plus) |
| `hyperopt_epoch` | Hyperopt stage | Epoch telemetry (epoch, loss, params) |
| `data_healing_start` | Data healing | Total pairs, timerange |
| `data_pair_status` | Data healing | Per-pair progress |
| `data_healing_summary` | Data healing | Final counts |

**Log streaming**: Via `LogBroadcaster` (`api/log_broadcaster.py`) — SSE-based, max 500 entries. Callbacks wired in `app.py:_lifespan()`.

**Progress tracking**: `RunProgressService` (`services/execution/run_progress.py`) — loads/saves progress JSON per run directory. Orphaned run recovery on startup.

**Frontend reconnection**: Exponential backoff 3s→30s, max 10 attempts. On final close, polls `GET /api/auto-quant/status/{runId}` then `GET /api/auto-quant/report/{runId}`.

## 9. Reusable Files and Services

**High-value reusable modules:**

| File | Key Exports | Lines |
|------|-------------|-------|
| `services/auto_quant/pipeline_modules/config.py` | Thresholds, stage names, WFO helpers, timeframe profiles | 226 |
| `services/auto_quant/pipeline_modules/state.py` | PipelineState, StageState, save/load/cancel | 802 |
| `services/auto_quant/ollama_service.py` | OllamaClient, circuit breaker, retry, validation | 1165 |
| `services/auto_quant/monte_carlo.py` | `run_monte_carlo()` — 1000 shuffles, p5/p95 drawdown | 93 |
| `services/auto_quant/sensitivity.py` | `run_sensitivity_check()` — ±5% param perturbation | 498 |
| `services/auto_quant/profit_lockin.py` | Profit lock-in tiers, giveback metrics, custom HyperoptLoss | 295 |
| `services/auto_quant/pipeline_modules/scoring.py` | `compute_score()` — 7-component weighted score 0-100 | 196 |
| `services/auto_quant/generator.py` | 5 strategy template generators | 704 |
| `services/auto_quant/policy/__init__.py` | Policy dataclass, threshold normalization, depth settings | 467 |
| `services/auto_quant/variants.py` | Strategy variant management, working copies | ~500 |
| `services/execution/backtest_runner.py` | Synchronous Freqtrade subprocess wrapper | 642 |
| `services/storage/run_repository.py` | Run metadata persistence | ~500 |
| `services/storage/result_parser.py` | Freqtrade result JSON parser | ~400 |
| `services/strategy/strategy_registry.py` | Strategy file scanner | ~200 |
| `settings_store.py` | Settings JSON load/save with validation | 71 |
| `app_services.py` | Service graph wiring (all dependencies) | 193 |
| `paths.py` | `build_local_paths()` — all project paths | ~80 |
| `utils.py` | JSON I/O, run ID generation, atomic writes | ~200 |

**Helper modules in pipeline:**
| File | Purpose |
|------|---------|
| `pipeline_modules/helpers.py` | Subprocess runner, backtest command builder, extractors, emit/start/pass/fail stage |
| `pipeline_modules/logging.py` | Pipeline-specific logger, async queue handler |
| `pipeline_modules/oos_guard.py` | OOS contamination prevention |
| `pipeline_modules/data_healer.py` | Data validation and auto-download |
| `pipeline_modules/filters.py` | Losing windows analysis for trading window optimization |
| `pipeline_modules/discovery.py` | Timeframe/pair universe discovery |

## 10. Missing Pieces

Based on inspection, the following capabilities are **absent or incomplete**:

1. **No strategy export for Freqtrade live trading** — The Delivery stage generates config.json + report.json but does not produce a ready-to-deploy Freqtrade strategy file that can be dropped into a live bot's strategies directory. The `copy_to_output()` in `variants.py` copies strategy files but there's no formal export workflow.

2. **No formal strategy comparison dashboard** — `ComparisonEngine` exists in `services/strategy/comparison.py` and is wired in `AppServices.compare_runs()`, but there's no UI endpoint that surfaces cross-run comparisons in a structured way beyond the RunDetail panel.

3. **No persistent strategy catalog** — Strategies are discovered by scanning the filesystem (`strategies_dir`). There is no database index or catalog of strategy metadata beyond what's in the version manager and git history.

4. **No backtesting schedule/cron** — All backtests and pipeline runs are user-initiated. No scheduled/automated re-validation.

5. **No multi-user support** — Single-user application. Settings, runs, strategies are all file-system based with no auth.

6. **No unit tests for `ollama_service.py`** — The AI service has no dedicated test file despite being 1165 lines with complex logic (circuit breaker, retry, JSON cleaning, validation).

7. **Two auto-quant API layers coexist** — `frontend/src/components/AutoQuantTab.jsx` uses raw `fetch()` directly, while `frontend/src/services/api.js` + `useAutoQuantState.js` provide a cleaner abstraction that is NOT used by the main tab. Also `features/autoquant/services/autoQuantAPI.js` references `api.autoquant.baseURL` which doesn't exist (bug).

8. **No `useWebSocket.js` hook** — WebSocket logic is duplicated inline in both `AutoQuantTab.jsx` and `useAutoQuantState.js`. No shared WebSocket abstraction.

9. **Dual backtest execution paths** — `BacktestRunner` in `services/execution/` and `backtest_executor.py` in `executors/` serve similar purposes with different interfaces.

10. **No formal API documentation** for Auto-Quant endpoints beyond the OpenAPI auto-generated docs at `/docs`.

## 11. Minimal Next Step

The highest-impact minimal next step would be to **create an automated strategy export workflow** that takes a fully validated Auto-Quant pipeline result (state.json + config.json + report.json) and produces a Freqtrade-ready deployment package:

1. Extract the optimized strategy file from the pipeline output directory (`user_data/auto_quant/<run_id>/`)
2. Merge the generated config.json with the base Freqtrade config
3. Write both to a timestamped export directory (e.g., `user_data/exports/StrategyName_YYYYMMDD_HHMMSS/`)
4. Add a `POST /api/auto-quant/export/{run_id}` endpoint
5. Add a "Export for Freqtrade" button in the frontend RunDetail panel

This would close the loop between strategy validation and deployment without modifying any existing code paths.

## 12. Risks / Constraints

- **Freqtrade dependency** must remain at the currently vendored version — the pipeline constructs Freqtrade CLI commands with specific flag combinations
- **TA-Lib** is stubbed in `backend/stubs/talib/` — real TA-Lib may not be available in all environments
- **File system locking** — concurrent access to `state.json` and run directories could cause corruption (no file-level locking)
- **No database** — all state is file-system based (JSON files). No atomicity guarantees for multi-file writes
- **Rate limiter** on `POST /api/backtest/run` is 10 req/min per client IP — applies to all backtest triggers
- **Monte Carlo** uses NumPy with 1000 shuffles — could be slow for large trade sets
- **Ollama API key** is stored in plaintext in `strategy_lab_settings.json` — security concern
- **Frontend AutoQuantTab.jsx is 3615 lines** — extremely monolithic, any UI change carries high risk
- **Pipeline state machine has no timeout** — a stuck Freqtrade subprocess holds the state in "running" indefinitely
- **SettingsModel uses `extra="ignore"`** — adding new fields is safe, but removing or renaming fields can leave stale data in persisted JSON

## 13. What Must Not Be Rebuilt

The following components already exist and are functional. Do not rebuild them:

1. **Freqtrade subprocess execution** — `BacktestRunner` in `services/execution/backtest_runner.py` (642 lines). Do not create a new subprocess wrapper.

2. **Auto-Quant pipeline orchestration** — `pipeline_modules/orchestrator.py:run_pipeline()` (477 lines) plus all stage implementations. Do not create a new pipeline system.

3. **Strategy generation templates** — `generator.py` has 5 complete strategy generators. Do not create new template generators.

4. **Ollama AI integration** — `ollama_service.py` (1165 lines) with circuit breaker, retry, validation, market analysis. Do not create a new AI client.

5. **Monte Carlo simulation** — `monte_carlo.py` (93 lines) with NumPy-based shuffling. Do not create a new MC engine.

6. **Sensitivity / robustness check** — `sensitivity.py` (498 lines) doing ±5% param perturbation. Do not create a new robustness check.

7. **Profit lock-in / giveback metrics** — `profit_lockin.py` (295 lines). Do not create new profit analysis.

8. **Scoring engine** — `pipeline_modules/scoring.py:compute_score()` (196 lines) with 7 policy-weighted components. Do not create a new scoring system.

9. **Policy engine** — `policy/__init__.py` (467 lines) with threshold normalization, depth settings, date ranges. Do not create a new policy system.

10. **WebSocket event streaming** — Built into `auto_quant.py` router and consumed by frontend `AutoQuantTab.jsx`. Do not create a new streaming mechanism.

11. **Strategy version management** — `services/strategy/version_manager.py` + `services/strategy/strategy_git.py`. Do not create a new versioning system.

12. **Run history and persistence** — `services/storage/run_repository.py`, `services/storage/result_parser.py`. Do not create new storage backends.

13. **Settings persistence** — `settings_store.py` (71 lines) with load/save/defaults. Do not create a new settings system.

14. **Backtest rate limiting** — In-memory rate limiter in `api/app.py` (26-30 lines). Do not create a new rate limiter.
