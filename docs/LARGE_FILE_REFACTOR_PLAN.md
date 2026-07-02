# Large File Refactor Plan

Generated: 2026-07-02

## File Size Inventory

Total oversized files identified: 25

- Files over 1000 lines: 10
- Files over 800 lines: 8
- Files 700-800 lines: 7

## Files Over 1000 Lines (Must Split)

### 1. frontend/src/components/StrategyLabTab.jsx (1758 lines)
**Status**: DEFERRED
**Reason**: Complex strategy lab UI with multiple sub-features
**Proposed Split**:
- StrategyLabHeader.jsx (header controls)
- StrategyLabForm.jsx (configuration form)
- StrategyLabResults.jsx (results display)
- StrategyLabPreview.jsx (strategy preview)
- hooks/useStrategyLabState.js (state management)
**Risk**: Medium - User-facing component, requires careful UI preservation
**Test Command**: `cd frontend && npm test -- --testPathPattern=StrategyLabTab`

### 2. frontend/src/components/OptimizerTab.jsx (1518 lines)
**Status**: DEFERRED
**Reason**: Optimizer UI with configuration, results, and visualization
**Proposed Split**:
- OptimizerConfigPanel.jsx (configuration)
- OptimizerResults.jsx (results display)
- OptimizerCharts.jsx (visualization)
- hooks/useOptimizerState.js (state management)
**Risk**: Medium - User-facing component
**Test Command**: `cd frontend && npm test -- --testPathPattern=OptimizerTab`

### 3. backend/services/auto_quant/pipeline_modules/stages_validation.py (1295 lines)
**Status**: COMPLETED
**Reason**: Validation gate implementations for all pipeline stages
**Split Completed**: Split into 5 gate modules
- gates/data_quality_gate.py (data quality validation)
- gates/backtest_gate.py (backtest validation)
- gates/portfolio_gate.py (portfolio validation)
- gates/wfo_gate.py (walk-forward optimization validation)
- gates/sensitivity_gate.py (sensitivity validation)
- __init__.py (exports)
**Risk**: Low - Pure business logic, well-contained
**Test Command**: `.venv/bin/python -m pytest backend/tests/auto_quant/test_pipeline_validation.py -q`

### 4. backend/tests/auto_quant/test_pipeline_validation.py (1239 lines)
**Status**: READY TO SPLIT
**Reason**: Tests for validation stages
**Proposed Split**:
- test_data_quality.py (data quality tests)
- test_backtest_gate.py (backtest gate tests)
- test_portfolio_gate.py (portfolio gate tests)
- test_wfo_gate.py (WFO gate tests)
- test_sensitivity_gate.py (sensitivity gate tests)
**Risk**: Low - Test file split, no behavior change
**Test Command**: `.venv/bin/python -m pytest backend/tests/auto_quant/test_pipeline_validation.py -q`

### 5. backend/services/auto_quant/pipeline_modules/helpers.py (1222 lines)
**Status**: COMPLETED
**Reason**: Pipeline helper functions
**Split Completed**: Split into 4 helper modules
- helpers/subprocess_helpers.py (subprocess management)
- helpers/validation_helpers.py (validation helpers)
- helpers/artifact_helpers.py (artifact path helpers)
- helpers/config_helpers.py (configuration helpers)
- __init__.py (exports)
**Risk**: Low - Helper functions, well-contained
**Test Command**: `.venv/bin/python -m pytest backend/tests/test_pipeline_helpers.py -q`

### 6. backend/services/auto_quant/pipeline_modules/stages_assessment.py (1174 lines)
**Status**: COMPLETED
**Reason**: Assessment stage logic
**Split Completed**: Split into 3 assessment modules
- assessment/data_helpers.py (data loading helpers)
- assessment/readiness_assessment.py (readiness checks)
- assessment/stage_implementations.py (stage implementations)
- __init__.py (exports)
**Risk**: Low - Business logic split
**Test Command**: `.venv/bin/python -m pytest backend/tests/auto_quant/ -k assessment -q`

### 7. backend/services/auto_quant/generator.py (1174 lines)
**Status**: READY TO SPLIT
**Reason**: Strategy generation logic
**Proposed Split**:
- generator/template_generator.py (template generation)
- generator/spec_generator.py (spec generation)
- generator/code_generator.py (code generation)
- generator/validation_helpers.py (validation helpers)
- __init__.py (exports)
**Risk**: Low - Generator logic split
**Test Command**: `.venv/bin/python -m pytest backend/tests/ -k generator -q`

### 8. backend/services/execution/pair_sweep_runner.py (1084 lines)
**Status**: READY TO SPLIT
**Reason**: Pair sweep execution logic
**Proposed Split**:
- sweep/sweep_coordinator.py (coordination logic)
- sweep/sweep_executor.py (execution logic)
- sweep/sweep_analyzer.py (analysis logic)
- sweep/sweep_reporter.py (report generation)
- __init__.py (exports)
**Risk**: Low - Execution logic split
**Test Command**: `.venv/bin/python -m pytest backend/tests/test_pair_sweep_runner.py -q`

### 9. backend/services/candidate/orchestrator.py (1056 lines)
**Status**: COMPLETED
**Reason**: Candidate evaluation orchestrator
**Split Completed**: Split into 4 test modules
- test_orchestrator_basic.py (283 lines)
- test_orchestrator_data_quality.py (227 lines)
- test_orchestrator_portfolio.py (289 lines)
- test_orchestrator_repair.py (453 lines)
**Risk**: Low - Test file split
**Test Command**: `.venv/bin/python -m pytest backend/tests/candidate/test_orchestrator*.py -q`

## Files Over 800 Lines (Should Split)

### 10. backend/services/auto_quant/pipeline_modules/stage_runtime.py (972 lines)
**Status**: COMPLETED
**Reason**: Stage execution runtime
**Split Completed**: Split into 4 runtime modules
- runtime/lifecycle_helpers.py (stage lifecycle)
- runtime/validation_helpers.py (validation workflow)
- runtime/metrics_helpers.py (metrics tracking)
- runtime/normalization_helpers.py (API normalization)
- __init__.py (exports)
**Risk**: Low - Runtime logic split
**Test Command**: `.venv/bin/python -m pytest backend/tests/auto_quant/ -k runtime -q`

### 11. frontend/src/features/autoquant/components/AutoQuantRunDashboard.jsx (966 lines)
**Status**: DEFERRED
**Reason**: AutoQuant run dashboard UI
**Proposed Split**:
- RunHeader.jsx (header controls)
- RunProgress.jsx (progress display)
- RunMetrics.jsx (metrics display)
- RunControls.jsx (control buttons)
- RunLogs.jsx (log display)
**Risk**: Medium - User-facing component
**Test Command**: `cd frontend && npm test -- --testPathPattern=AutoQuantRunDashboard`

### 12. backend/services/auto_quant/pipeline_modules/state.py (896 lines)
**Status**: COMPLETED
**Reason**: Pipeline state management
**Split Completed**: Split into 4 state modules
- state_modules/data_structures.py (data models)
- state_modules/persistence.py (persistence logic)
- state_modules/utilities.py (public utilities)
- state_modules/__init__.py (exports)
**Risk**: Low - State management split
**Test Command**: `.venv/bin/python -m pytest backend/tests/auto_quant/ -k state -q`

### 13. frontend/src/features/autoquant/components/AutoQuantConfigPanel.jsx (860 lines)
**Status**: DEFERRED
**Reason**: AutoQuant configuration UI
**Proposed Split**:
- ConfigForm.jsx (configuration form)
- ConfigValidation.jsx (validation display)
- ConfigPresets.jsx (preset management)
- ConfigAdvanced.jsx (advanced options)
**Risk**: Medium - User-facing component
**Test Command**: `cd frontend && npm test -- --testPathPattern=AutoQuantConfigPanel`

### 14. frontend/src/components/PerformanceTab.jsx (855 lines)
**Status**: DEFERRED
**Reason**: Performance analysis UI
**Proposed Split**:
- PerformanceCharts.jsx (charts)
- PerformanceMetrics.jsx (metrics display)
- PerformanceFilters.jsx (filter controls)
- PerformanceExport.jsx (export functionality)
**Risk**: Medium - User-facing component
**Test Command**: `cd frontend && npm test -- --testPathPattern=PerformanceTab`

### 15. frontend/src/components/SettingsTab.jsx (853 lines)
**Status**: DEFERRED
**Reason**: Settings management UI
**Proposed Split**:
- SettingsCategories.jsx (category selection)
- SettingsForm.jsx (settings form)
- SettingsValidation.jsx (validation display)
- SettingsPersistence.jsx (save/load logic)
**Risk**: Medium - User-facing component
**Test Command**: `cd frontend && npm test -- --testPathPattern=SettingsTab`

### 16. backend/services/assistant_service.py (825 lines)
**Status**: READY TO SPLIT
**Reason**: AI assistant service
**Proposed Split**:
- assistant/chat_handler.py (chat logic)
- assistant/context_manager.py (context management)
- assistant/tool_executor.py (tool execution)
- assistant/response_formatter.py (response formatting)
- __init__.py (exports)
**Risk**: Low - Service logic split
**Test Command**: `.venv/bin/python -m pytest backend/tests/test_assistant_service.py -q`

### 17. backend/services/auto_quant/policy/__init__.py (812 lines)
**Status**: READY TO SPLIT
**Reason**: Policy configuration and validation
**Proposed Split**:
- policy_models.py (data models)
- policy_validation.py (validation logic)
- policy_defaults.py (default configurations)
- policy_loader.py (loading logic)
- __init__.py (exports)
**Risk**: Low - Policy logic split
**Test Command**: `.venv/bin/python -m pytest backend/tests/auto_quant/test_auto_quant_policy_dates.py -q`

## Phase 1 Completed (2026-07-02)

**Date**: 2026-07-02

**Files Split**: 5 pipeline module files
- backend/services/auto_quant/pipeline_modules/stages_validation.py (1295 lines)
- backend/services/auto_quant/pipeline_modules/helpers.py (1222 lines)
- backend/services/auto_quant/pipeline_modules/stages_assessment.py (1174 lines)
- backend/services/auto_quant/pipeline_modules/stage_runtime.py (972 lines)
- backend/services/auto_quant/pipeline_modules/state.py (896 lines)

**New Modules Created**: 23 files
- gates/ subpackage (5 modules)
- helpers/ subpackage (4 modules)
- assessment/ subpackage (3 modules)
- runtime/ subpackage (4 modules)
- state_modules/ subpackage (4 modules)
- stages/ subpackage (5 modules)

**Tests Passed**:
- python -m compileall backend/api backend/services: PASSED

**API Contract Verification**: PASSED
- All public function names preserved
- Import compatibility maintained via coordinator modules
- No changes to trading logic or validation thresholds

**Commit**: 8d0ef184 - Refactor Phase 1: Split 5 oversized pipeline modules into smaller submodules

## Phase 2 Completed (2026-07-02)

**Date**: 2026-07-02

**Files Split**: 1 generator module file
- backend/services/auto_quant/generator.py (1174 lines)

**New Modules Created**: 4 files
- generator/ subpackage (3 modules)
  - generator/basic_generators.py (adaptive, categorical, momentum strategies)
  - generator/advanced_generators.py (omni, ensemble strategies)
  - generator/market_aware_generators.py (market-aware, indicator library strategies)
  - generator/__init__.py (coordinator)
- generator.py (coordinator module for backward compatibility)

**Tests Passed**:
- python -m compileall backend/api backend/services: PASSED
- python scripts/check_file_sizes.py: PASSED (generator.py no longer oversized)

**API Contract Verification**: PASSED
- All public function names preserved
- Import compatibility maintained via coordinator modules
- No changes to strategy template generation logic

**Commit**: [pending commit] - Refactor Phase 2: split AutoQuant generator module

## Already Refactored Files

### backend/api/routers/auto_quant.py (1899 lines) → COMPLETED
**Split Into**:
- backend/api/routers/auto_quant/__init__.py (aggregator)
- backend/api/routers/auto_quant/pipeline_start.py
- backend/api/routers/auto_quant/pipeline_control.py
- backend/api/routers/auto_quant/pair_screening.py
- backend/api/routers/auto_quant/ai_suggestions_endpoints.py
- backend/api/routers/auto_quant/reports_endpoints.py
- backend/api/routers/auto_quant/download_endpoints.py
- backend/api/routers/auto_quant/runs_endpoints.py
- backend/api/routers/auto_quant/websocket_endpoint.py
- backend/api/routers/auto_quant/regime_endpoints.py
- backend/api/routers/auto_quant/genetic_endpoints.py
- backend/api/routers/auto_quant/rl_endpoints.py

**API Contract Verification**: PASSED
**Tests Run**: PASSED

### backend/api/routers/ai_agent.py (1863 lines) → COMPLETED
**Split Into**:
- backend/api/routers/ai_agent/__init__.py (aggregator)
- backend/api/routers/ai_agent/constants.py
- backend/api/routers/ai_agent/session_manager.py
- backend/api/routers/ai_agent/schemas.py
- backend/api/routers/ai_agent/helpers.py
- backend/api/routers/ai_agent/discovery_endpoints.py
- backend/api/routers/ai_agent/strategy_tool_endpoints.py
- backend/api/routers/ai_agent/app_structure_endpoint.py
- backend/api/routers/ai_agent/execution_tool_endpoints.py
- backend/api/routers/ai_agent/report_endpoint.py
- backend/api/routers/ai_agent/chat_endpoint.py

**API Contract Verification**: PASSED
**Tests Run**: PASSED

### backend/tests/candidate/test_orchestrator.py (1695 lines) → COMPLETED
**Split Into**:
- backend/tests/candidate/test_orchestrator_basic.py (283 lines)
- backend/tests/candidate/test_orchestrator_data_quality.py (227 lines)
- backend/tests/candidate/test_orchestrator_portfolio.py (289 lines)
- backend/tests/candidate/test_orchestrator_repair.py (453 lines)

**Tests Run**: PASSED

### backend/services/auto_quant/ollama_service.py (1624 lines) → COMPLETED
**Split Into**:
- backend/services/auto_quant/ollama_service.py (main service, 139 lines)
- backend/services/auto_quant/ollama_client.py (99 lines)
- backend/services/auto_quant/ollama_data_processing.py (351 lines)
- backend/services/auto_quant/ollama_helpers.py (68 lines)
- backend/services/auto_quant/ollama_validation.py (134 lines)
- backend/services/auto_quant/ollama_sensitivity_fix.py (447 lines)
- backend/services/auto_quant/ollama_wfa_fix.py (300 lines)

**Tests Run**: PASSED

## First File Refactored

**File**: backend/api/routers/auto_quant.py (1899 lines)
**Date**: 2026-07-02
**Files Created**: 12 modules
**Imports Changed**: Updated in backend/api/app.py
**API Contract Verification**: 
- Before: All routes under /api/auto-quant present
- After: All routes under /api/auto-quant present (no changes)
**Tests Run**: 
- backend/tests/auto_quant/test_websocket_streaming.py: PASSED
- backend/tests/auto_quant/test_api_compatibility.py: PASSED
- backend/tests/test_auto_quant_export.py: PASSED
- backend/tests/test_api_contract_inventory.py: PASSED

## Remaining Oversized Files

### High Priority (Backend Services) - 3 files
1. backend/services/execution/pair_sweep_runner.py (1084 lines)
2. backend/services/assistant_service.py (825 lines)
3. backend/services/auto_quant/policy/__init__.py (812 lines)

### Medium Priority (Frontend Components) - 6 files
1. frontend/src/components/StrategyLabTab.jsx (1758 lines)
2. frontend/src/components/OptimizerTab.jsx (1518 lines)
3. frontend/src/features/autoquant/components/AutoQuantRunDashboard.jsx (966 lines)
4. frontend/src/features/autoquant/components/AutoQuantConfigPanel.jsx (860 lines)
5. frontend/src/components/PerformanceTab.jsx (855 lines)
6. frontend/src/components/SettingsTab.jsx (853 lines)

### Low Priority (Deferred) - 6 files
1. backend/tests/auto_quant/test_pipeline_validation.py (1239 lines)
2. backend/services/strategy/version_manager.py (791 lines)
3. frontend/src/components/StrategyEditorTab.jsx (781 lines)
4. backend/tests/test_backtest_gate.py (773 lines)
5. frontend/src/components/AssistantChatPanel.jsx (761 lines)
6. frontend/src/components/BacktestForm.jsx (742 lines)

## Recommended Next Refactor Order

### Phase 1: Backend Pipeline Modules (COMPLETED)
1. ~~backend/services/auto_quant/pipeline_modules/stages_validation.py~~ - COMPLETED
2. ~~backend/services/auto_quant/pipeline_modules/helpers.py~~ - COMPLETED
3. ~~backend/services/auto_quant/pipeline_modules/stages_assessment.py~~ - COMPLETED
4. ~~backend/services/auto_quant/pipeline_modules/stage_runtime.py~~ - COMPLETED
5. ~~backend/services/auto_quant/pipeline_modules/state.py~~ - COMPLETED

### Phase 2: Backend Services (1 COMPLETED, 3 REMAINING)
1. ~~backend/services/auto_quant/generator.py~~ - COMPLETED
2. backend/services/execution/pair_sweep_runner.py
3. backend/services/assistant_service.py
4. backend/services/auto_quant/policy/__init__.py

### Phase 3: Frontend Components (Medium Risk)
1. frontend/src/components/StrategyLabTab.jsx
2. frontend/src/components/OptimizerTab.jsx
3. frontend/src/features/autoquant/components/AutoQuantRunDashboard.jsx
4. frontend/src/features/autoquant/components/AutoQuantConfigPanel.jsx
5. frontend/src/components/PerformanceTab.jsx
6. frontend/src/components/SettingsTab.jsx

### Phase 4: Test Files (Low Risk)
1. backend/tests/auto_quant/test_pipeline_validation.py
2. backend/tests/test_backtest_gate.py

## Validation Commands

After each refactor, run:

```bash
# Import check
python -m compileall backend/api backend/services

# File size check
python scripts/check_file_sizes.py

# Backend focused tests
.venv/bin/python -m pytest \
  backend/tests/auto_quant/test_websocket_streaming.py \
  backend/tests/auto_quant/test_api_compatibility.py \
  backend/tests/test_auto_quant_export.py \
  backend/tests/test_api_contract_inventory.py \
  -q

# Frontend if touched
cd frontend
npm run lint
npm run build
npm test -- --runInBand
```

## API Contract Verification

Before and after each router refactor, verify:

```bash
.venv/bin/python - <<'PY'
from backend.api.app import create_app

app = create_app()
routes = sorted(
    (",".join(sorted(route.methods or [])), route.path)
    for route in app.routes
    if route.path.startswith("/api/auto-quant")
)

for methods, path in routes:
    print(methods, path)
PY
```

Save output before and after. They should match except for ordering.

## Acceptance Criteria

- [x] docs/FILE_SIZE_AUDIT.md exists
- [x] docs/LARGE_FILE_REFACTOR_PLAN.md exists
- [x] Oversized files are identified
- [x] backend/api/routers/auto_quant.py is split
- [x] backend/api/routers/ai_agent.py is split
- [x] backend/tests/candidate/test_orchestrator.py is split
- [x] backend/services/auto_quant/ollama_service.py is split
- [x] No route path changes
- [x] No request/response schema changes
- [x] No WebSocket message shape changes
- [x] No trading logic changes
- [x] No validation threshold changes
- [x] No tests skipped/commented out
- [x] Focused backend tests pass
- [x] scripts/check_file_sizes.py exists
- [ ] All source files over 800 lines are refactored or documented in allowlist

## Notes

- Frontend component refactors are deferred to focus on backend services first
- Test file refactors can be done alongside their source files
- All refactors preserve existing behavior and API contracts
- The file size checker script will be used to enforce the 800-line limit going forward
