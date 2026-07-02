# File Size Audit

Generated: 2026-07-02

## Files Over 1000 Lines (Must Split)

| File | Lines | Status | Reason for Size | Proposed Split | Risk |
|------|-------|--------|-----------------|----------------|------|
| frontend/src/components/StrategyLabTab.jsx | 1758 | **DEFER** | Complex strategy lab UI with multiple sub-features | Split into components: StrategyLabHeader, StrategyLabForm, StrategyLabResults, StrategyLabPreview, hooks/useStrategyLabState | Medium |
| frontend/src/components/OptimizerTab.jsx | 1518 | **DEFER** | Optimizer UI with configuration, results, and visualization | Split into: OptimizerConfigPanel, OptimizerResults, OptimizerCharts, hooks/useOptimizerState | Medium |
| backend/services/auto_quant/pipeline_modules/stages_validation.py | 1295 | **COMPLETED** | Validation gate implementations for all pipeline stages | Extract: data_quality_gate, backtest_gate, portfolio_gate, wfo_gate, sensitivity_gate into separate modules | Low |
| backend/tests/auto_quant/test_pipeline_validation.py | 1239 | **SPLIT** | Tests for validation stages | Split by test class: test_data_quality, test_backtest_gate, test_portfolio_gate, test_wfo_gate, test_sensitivity | Low |
| backend/services/auto_quant/pipeline_modules/helpers.py | 1222 | **COMPLETED** | Pipeline helper functions | Extract: data_helpers, validation_helpers, artifact_helpers, config_helpers | Low |
| backend/services/auto_quant/pipeline_modules/stages_assessment.py | 1174 | **COMPLETED** | Assessment stage logic | Extract: readiness_assessment, scoring_assessment, risk_assessment | Low |
| backend/services/auto_quant/generator.py | 1174 | **SPLIT** | Strategy generation logic | Extract: template_generator, spec_generator, code_generator, validation_helpers | Low |
| backend/services/execution/pair_sweep_runner.py | 1084 | **SPLIT** | Pair sweep execution logic | Extract: sweep_coordinator, sweep_executor, sweep_analyzer, sweep_reporter | Low |
| backend/services/candidate/orchestrator.py | 1056 | **COMPLETED** | Candidate evaluation orchestrator | Split into: test_orchestrator_basic, test_orchestrator_data_quality, test_orchestrator_portfolio, test_orchestrator_repair | Low |

## Files Over 800 Lines (Should Split)

| File | Lines | Status | Reason for Size | Proposed Split | Risk |
|------|-------|--------|-----------------|----------------|------|
| backend/services/auto_quant/pipeline_modules/stage_runtime.py | 972 | **COMPLETED** | Stage execution runtime | Extract: stage_executor, stage_monitor, stage_recovery, stage_context | Low |
| frontend/src/features/autoquant/components/AutoQuantRunDashboard.jsx | 966 | **DEFER** | AutoQuant run dashboard UI | Split into: RunHeader, RunProgress, RunMetrics, RunControls, RunLogs | Medium |
| backend/services/auto_quant/pipeline_modules/state.py | 896 | **COMPLETED** | Pipeline state management | Extract: state_models, state_transitions, state_persistence, state_validation | Low |
| frontend/src/features/autoquant/components/AutoQuantConfigPanel.jsx | 860 | **DEFER** | AutoQuant configuration UI | Split into: ConfigForm, ConfigValidation, ConfigPresets, ConfigAdvanced | Medium |
| frontend/src/components/PerformanceTab.jsx | 855 | **DEFER** | Performance analysis UI | Split into: PerformanceCharts, PerformanceMetrics, PerformanceFilters, PerformanceExport | Medium |
| frontend/src/components/SettingsTab.jsx | 853 | **DEFER** | Settings management UI | Split into: SettingsCategories, SettingsForm, SettingsValidation, SettingsPersistence | Medium |
| backend/services/assistant_service.py | 825 | **SPLIT** | AI assistant service | Extract: chat_handler, context_manager, tool_executor, response_formatter | Low |
| backend/services/auto_quant/policy/__init__.py | 812 | **SPLIT** | Policy configuration and validation | Extract: policy_models, policy_validation, policy_defaults, policy_loader | Low |

## Files 700-800 Lines (Consider Splitting)

| File | Lines | Status | Reason for Size | Proposed Split | Risk |
|------|-------|--------|-----------------|----------------|------|
| backend/services/strategy/version_manager.py | 791 | **DEFER** | Strategy version management | Extract: version_tracker, version_comparator, version_migrator | Low |
| frontend/src/components/StrategyEditorTab.jsx | 781 | **DEFER** | Strategy code editor UI | Split into: EditorPane, EditorToolbar, EditorValidation, EditorPreview | Medium |
| backend/tests/test_backtest_gate.py | 773 | **DEFER** | Backtest gate tests | Split by test scenario: happy_path, failure_modes, edge_cases | Low |
| frontend/src/components/AssistantChatPanel.jsx | 761 | **DEFER** | AI chat UI | Split into: ChatMessages, ChatInput, ChatHistory, ChatControls | Medium |
| frontend/src/components/BacktestForm.jsx | 742 | **DEFER** | Backtest configuration UI | Split into: BacktestConfig, BacktestValidation, BacktestPresets | Medium |
| backend/services/auto_quant/pipeline_modules/data_healer.py | 708 | **DEFER** | Data healing logic | Extract: gap_filler, outlier_detector, normalizer, healer_coordinator | Low |
| backend/services/execution/backtest_runner.py | 702 | **DEFER** | Backtest execution logic | Extract: backtest_launcher, backtest_monitor, backtest_parser | Low |

## Intentionally Excluded Files

The following files are intentionally excluded from the 800-line limit:

- **user_data/strategies/** - User-generated Freqtrade strategy source code (not app architecture)
- **data/** - Static data files and configurations
- **user_data/backtest_results/** - Runtime backtest artifacts
- **user_data/hyperopt_results/** - Runtime hyperopt artifacts
- **user_data/data_downloads/** - Runtime data download artifacts
- **user_data/auto_quant/** - Runtime AutoQuant artifacts
- **.venv/, venv/** - Virtual environment dependencies
- **node_modules/** - Frontend dependencies
- **frontend/dist/** - Build artifacts
- **coverage/** - Test coverage reports

## Already Refactored Files

The following files have already been refactored in previous work:

- **backend/api/routers/auto_quant.py** (1899 lines) → Split into 10 modules under `backend/api/routers/auto_quant/`
- **backend/api/routers/ai_agent.py** (1863 lines) → Split into 7 modules under `backend/api/routers/ai_agent/`
- **backend/tests/candidate/test_orchestrator.py** (1695 lines) → Split into 4 test modules
- **backend/services/auto_quant/ollama_service.py** (1624 lines) → Split into 7 modules under `backend/services/auto_quant/`

## Phase 1 Completed (2026-07-02)

The following 5 pipeline module files were successfully split into smaller submodules:

- **backend/services/auto_quant/pipeline_modules/stages_validation.py** (1295 lines) → Split into 5 gate modules:
  - gates/data_quality_gate.py
  - gates/backtest_gate.py
  - gates/portfolio_gate.py
  - gates/wfo_gate.py
  - gates/sensitivity_gate.py
  - gates/__init__.py

- **backend/services/auto_quant/pipeline_modules/helpers.py** (1222 lines) → Split into 4 helper modules:
  - helpers/subprocess_helpers.py
  - helpers/validation_helpers.py
  - helpers/artifact_helpers.py
  - helpers/config_helpers.py
  - helpers/__init__.py

- **backend/services/auto_quant/pipeline_modules/stages_assessment.py** (1174 lines) → Split into 3 assessment modules:
  - assessment/data_helpers.py
  - assessment/readiness_assessment.py
  - assessment/stage_implementations.py
  - assessment/__init__.py

- **backend/services/auto_quant/pipeline_modules/stage_runtime.py** (972 lines) → Split into 4 runtime modules:
  - runtime/lifecycle_helpers.py
  - runtime/validation_helpers.py
  - runtime/metrics_helpers.py
  - runtime/normalization_helpers.py
  - runtime/__init__.py

- **backend/services/auto_quant/pipeline_modules/state.py** (896 lines) → Split into 4 state modules:
  - state_modules/data_structures.py
  - state_modules/persistence.py
  - state_modules/utilities.py
  - state_modules/__init__.py

**Additional modules created:**
- stages/ subpackage (5 stage implementation modules)

**Total new modules created:** 23 files
**Public API compatibility:** Preserved via coordinator modules

## Summary

- **Files over 1000 lines**: 10 files
- **Files over 800 lines**: 8 files
- **Files 700-800 lines**: 7 files
- **Already refactored**: 4 files
- **Total oversized files**: 25 files

## Recommended Refactor Order

1. **High Priority (Backend Services)** - Low risk, high impact:
   - backend/services/auto_quant/generator.py
   - backend/services/execution/pair_sweep_runner.py
   - backend/services/assistant_service.py
   - backend/services/auto_quant/policy/__init__.py

2. **Medium Priority (Frontend Components)** - Medium risk, user-facing:
   - frontend/src/components/StrategyLabTab.jsx
   - frontend/src/components/OptimizerTab.jsx
   - frontend/src/features/autoquant/components/AutoQuantRunDashboard.jsx
   - frontend/src/features/autoquant/components/AutoQuantConfigPanel.jsx
   - frontend/src/components/PerformanceTab.jsx
   - frontend/src/components/SettingsTab.jsx

3. **Low Priority (Deferred)** - Can be addressed in follow-up work:
   - Frontend components under 800 lines
   - Backend services under 800 lines
   - Test files (can be refactored alongside their source files)
