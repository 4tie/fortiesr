# PROJECT AUDIT REPORT
Generated: 2026-06-10

---

## 1. FRAMEWORK & BUILD SYSTEM

### Frontend
- **Framework**: React 19.2.6
- **Build Tool**: Vite 8.0.14 (with React plugin)
- **Build Output**: `frontend/dist/` (SPA)
- **Dev Server**: Vite dev server on port 5173 (configurable)
- **Package Manager**: npm

### Backend
- **Framework**: FastAPI 0.136.3
- **Server**: Uvicorn 0.48.0 (async ASGI)
- **Language**: Python 3.x
- **Entry Point**: `server.py` (production), `backend/api/app.py` (development)
- **Package Manager**: pip / pyproject.toml

---

## 2. ROUTING & STATE MANAGEMENT

### Frontend Routing
**System**: React Router (implicit in tabs)
**Implementation**: App.jsx manages 8 tabs:
1. OptimizerTab - Strategy optimization
2. BacktestTab - Backtesting execution
3. StrategyEditorTab - Strategy code editing
4. PerformanceTab - Performance analytics
5. PairExplorerTab - Pair analysis
6. StressTestTab - Stress testing
7. AutoQuantTab - Auto-quant pipeline
8. SettingsTab - Application settings

**Navigation**: Tab switching via state in App.jsx (no React Router)

### Frontend State Management
- **Global**: useSharedState hook (implicit context)
- **Custom Hooks**: 
  - `useSharedState.js` - Shared global state
  - `useStrategies.js` - Strategy API calls
  - `usePairs.js` - Pair API calls
  - `useTheme.js` - Theme management
- **Pattern**: useState + context, no Redux/Zustand
- **Issue**: State contracts are implicit, not typed

### Backend Routing
- **Framework**: FastAPI routers
- **Endpoint Structure**: `/api/` prefix
- **Routers**: 19 endpoint files in `backend/api/routers/`:
  - auto_quant.py, backtest.py, stress_lab.py, temporal_stress_lab.py
  - optimizer.py, pair_explorer.py, performance.py
  - strategies.py, pairs.py, results.py, results_list.py
  - shared_state.py, session.py, settings.py
  - data.py, logs.py, system_health.py, ai_assistant.py

---

## 3. UI FRAMEWORK & STYLING

- **UI Library**: React (no Next.js, no additional framework)
- **Styling**: Tailwind CSS 4.3.0
- **Component Library**: DaisyUI 5.5.20 (Tailwind components)
- **Icons**: Likely using Heroicons or similar (imported via DaisyUI)

---

## 4. EXISTING PAGES & FEATURES

### Tab Components (7 main pages)
1. **OptimizerTab** - Strategy optimization interface
2. **BacktestTab** - Backtest execution + results
3. **StrategyEditorTab** - Code editor for strategies
4. **PerformanceTab** - Performance metrics + analytics
5. **PairExplorerTab** - Pair selection + analysis
6. **StressTestTab** - Stress testing configuration
7. **AutoQuantTab** - Auto-quant pipeline control
8. **SettingsTab** - App configuration

### Supporting Pages/Components
- **RunHistoryDashboard** - Display historical run results
- **ResultsView** - Results listing + filtering

---

## 5. EXISTING COMPONENTS

### Component Categories

**Tab/Page Components (8)**:
- OptimizerTab.jsx (tabs)
- BacktestTab.jsx (tabs)
- StrategyEditorTab.jsx (tabs)
- PerformanceTab.jsx (tabs)
- PairExplorerTab.jsx (tabs)
- StressTestTab.jsx (tabs)
- AutoQuantTab.jsx (tabs)
- SettingsTab.jsx (tabs)

**Result/Detail Components (6)**:
- RunDetailPanel.jsx - Main details container
- RunDetailSummary.jsx - Summary metrics
- RunDetailParameters.jsx - Parameter display
- RunDetailStages.jsx - Stage progress display
- RunDetailPairs.jsx - Pair breakdown
- ExportCards.jsx - Export options

**UI/Layout Components (4)**:
- NavPanel.jsx - Navigation sidebar/header
- ThemeSwitcher.jsx - Dark/light mode toggle
- Toast.jsx - Toast notification provider
- ErrorBoundary.jsx - Error boundary for error handling

**Chart Components (1)**:
- EquityCurveChart.jsx - Recharts-based equity curve visualization

**Form/Selection Components (3)**:
- BacktestForm.jsx - Backtest input form
- SmartPairSelector.jsx - Pair multi-select
- StrategyUpload.jsx - Strategy file upload (inferred)

**Supporting Components (3)**:
- ResultsView.jsx - Results display container
- RunHistoryDashboard.jsx - Historical results dashboard
- SettingsTab.jsx - Settings interface

**Total**: 27 JSX files in `frontend/src/components/`

---

## 6. EXISTING SERVICES

### Frontend Services
- None formally structured (calls go directly via fetch to backend)
- API integration happens in components or hooks
- No API abstraction layer

### Backend Services (14+ specialized services)

**AutoQuant Service** (`backend/services/auto_quant/`)
- **pipeline.py** (279 lines) - Pipeline orchestration
- **ollama_service.py** (1,762 lines) - AI service + strategy generation (GIANT FILE)
- **generator.py** (704 lines) - Strategy template generation
- **sensitivity.py** - Sensitivity analysis
- **profit_lockin.py** - Profit locking logic
- **monte_carlo.py** - Monte Carlo simulation
- **pipeline_modules/** (6+ stage files) - Pipeline stages

**Execution Services** (`backend/services/execution/`)
- **backtest_runner.py** (641 lines) - Freqtrade integration + result parsing
- **pair_sweep_runner.py** (523 lines) - Multi-pair backtesting
- **data_download_runner.py** - Data acquisition
- **run_progress.py** (497 lines) - Progress tracking

**Strategy Services** (`backend/services/strategy/`)
- **strategy_registry.py** - Strategy registration + storage
- **version_manager.py** (759 lines) - Strategy versioning + git integration
- **strategy_optimizer.py** (484 lines) - Optuna optimization
- **comparison.py** - Strategy comparison
- **strategy_source.py** - Strategy source handling
- **strategy_git.py** - Git integration
- **snapshot_service.py** - Strategy snapshots

**Storage Services** (`backend/services/storage/`)
- **result_parser.py** (581 lines) - Result aggregation + parsing
- **run_repository.py** - Run history storage
- **optimizer_store.py** - Optimization state storage
- **exported_trial_store.py** - Trial export storage
- **pair_sweep_store.py** - Pair sweep results storage

**Pairs Service** (`backend/services/pairs/`)
- SmartPairSelector logic

**Maintenance Service** (`backend/services/maintenance/`)
- Cleanup + health monitoring

---

## 7. EXISTING API INTEGRATIONS

### External Libraries & APIs
1. **Freqtrade** - Backtesting engine (integrated via import)
2. **Ollama** - Local LLM for strategy generation
3. **Pandas** (3.0.3) - Data manipulation + analysis
4. **scikit-learn** - Machine learning utilities
5. **Optuna** - Hyperparameter optimization
6. **Recharts** (3.8.1) - Data visualization (frontend)
7. **Pydantic** v2 - Request/response validation (backend)
8. **SQLAlchemy** - ORM (likely, via Freqtrade)

---

## 8. EXISTING CHART LIBRARIES

### Frontend
- **Recharts** 3.8.1 - Used for interactive charts
- **Charts Implemented**:
  - EquityCurveChart (equity growth over time)
  - Likely: drawdown, profit distribution, trade distribution (inferred)

### Missing Charts
- Pair performance heatmap
- Timeframe comparison
- Walk forward visualization
- Parameter sensitivity heatmap
- Score evolution tracking

---

## 9. STRATEGY-RELATED FILES

### Strategy Storage
- `backend/services/strategy/strategy_registry.py` - Registry of strategies
- `backend/services/strategy/strategy_source.py` - Strategy source handling
- `backend/services/strategy/strategy_git.py` - Git versioning

### Strategy Editor
- `frontend/src/components/StrategyEditorTab.jsx` - Code editor UI

### Strategy Generation
- `backend/services/auto_quant/generator.py` - Template generation (704 lines)
- `backend/services/auto_quant/ollama_service.py` - AI generation (1,762 lines)

### Strategy Optimization
- `backend/services/strategy/strategy_optimizer.py` (484 lines) - Optuna-based optimization

---

## 10. BACKTESTING FILES

### Execution
- `backend/services/execution/backtest_runner.py` (641 lines)
  - Integrates with Freqtrade
  - Handles backtest execution
  - Parses results
  - Tracks progress

- `backend/services/execution/pair_sweep_runner.py` (523 lines)
  - Multi-pair backtesting
  - Sweep across pairs and timeframes

- `backend/services/execution/data_download_runner.py`
  - Downloads market data

### Results Parsing
- `backend/services/storage/result_parser.py` (581 lines)
  - Aggregates backtest results
  - Calculates metrics
  - Formats for display

---

## 11. VALIDATION FILES

### Data Validation
- `backend/services/auto_quant/pipeline_modules/stages_validation.py`
  - Strategy validation rules
  - Threshold-based filtering

- `backend/services/auto_quant/pipeline_modules/data_healer.py`
  - Data quality checking
  - Missing data handling
  - Timestamp normalization (int64 feather support - recent fix)

### Validation Tests
- `backend/tests/test_data_healer.py` (542 lines) - 23 unit tests
- `backend/tests/test_pipeline_validation.py` (1,193 lines) - Exhaustive validation tests

---

## 12. UTILITY FILES

### Frontend Utilities
- `frontend/src/hooks/useSharedState.js` - State hook
- `frontend/src/hooks/useStrategies.js` - Strategy API hook
- `frontend/src/hooks/usePairs.js` - Pair API hook
- `frontend/src/hooks/useTheme.js` - Theme hook

### Backend Utilities
- `backend/utils.py` - Shared utilities
- `backend/paths.py` - Path resolution + data directory management
- `backend/settings_store.py` - Settings persistence (JSON-based)
- `backend/quality_gate_runner.py` - Validation runner
- `backend/core/errors.py` - Exception hierarchy

---

## 13. KEY ARCHITECTURE OBSERVATIONS

### Strengths
✅ Clear separation of frontend and backend  
✅ Modular service structure (14+ services)  
✅ Comprehensive test suite (19 test files, 4,500+ lines)  
✅ Real-time WebSocket streaming for long operations  
✅ Robust error handling in FastAPI  
✅ Rate limiting and CORS configured  
✅ JSON-based settings persistence (survives restarts)  

### Architectural Issues
❌ **Giant ollama_service.py** (1,762 lines) - Violates single responsibility  
❌ **AppServices God Object** (`app_services.py`) - Creates 20+ services with hard-wired dependencies  
❌ **Frontend App.jsx** (265 lines) - Router + state manager combined, tightly coupled to all tabs  
❌ **Router Logic Duplication** - Business logic scattered across 19 routers instead of services  
❌ **No API Abstraction Layer** - Frontend components fetch directly, no mock/test support  
❌ **Scattered Data Models** - Models in `backend/models/` AND `backend/api/models.py`  
❌ **No Type Safety** - Frontend has no TypeScript or JSDoc validation  
❌ **Implicit State Contracts** - useSharedState hook contracts are undocumented  

### Missing Abstractions
- Frontend API client (no centralized request/response handling)
- Backend repository pattern (direct file I/O in services)
- Backend dependency injection (tight coupling in AppServices)
- Backend validation rule extraction (validation mixed into stage logic)

---

## 14. SUMMARY

| Category | Status | Quality |
|----------|--------|---------|
| Framework | React 19 + FastAPI | Modern, Production-ready |
| Build System | Vite + Python modules | Clean, Fast builds |
| Routing | Tab-based (App.jsx) | Fragile, needs refactoring |
| State Management | Hooks + Context | Works, but implicit contracts |
| UI Components | 27 components | Well-structured, DaisyUI + Tailwind |
| Backend Services | 14+ services | Modular, but tight coupling |
| Tests | 19 backend tests | Good, but frontend lacking (11% coverage) |
| Documentation | Minimal | Missing setup, API, architecture docs |
| Type Safety | None (frontend) | Gap in safety |
| Testability | Good (backend), Poor (frontend) | Needs API abstraction layer |

---

## 15. READY FOR PHASE 2

This audit confirms:
- ✅ Project is mature with working features
- ✅ Architecture can be improved with refactoring
- ✅ No critical blockers preventing refactoring
- ✅ Clear path forward for Phase 2 architectural work

**Next Step**: Proceed with DEPENDENCY_REPORT.md
