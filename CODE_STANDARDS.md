# Code Standards

## File Size Limits

### Line Count Rules

- **Target**: Every file should be under 500-700 lines
- **Hard limit**: No file should exceed 800 lines
- **Temporary exception**: 1000 lines only if the file is legacy and hasn't been refactored yet

### Rationale

Smaller files are easier to:

- Read and understand
- Test and debug
- Maintain and refactor
- Review in pull requests

### Enforcement

- Automated line limit checker script: `scripts/check_line_limits.py`
- Pre-commit hook to enforce limits on new files
- CI pipeline check for all files

### Current Violations

As of the rule establishment date, the following files need refactoring:

#### Backend Files (> 800 lines)

- `backend/api/routers/auto_quant.py` (1899 lines)
- `backend/api/routers/ai_agent.py` (1863 lines)
- `backend/tests/candidate/test_orchestrator.py` (1695 lines)
- `backend/services/auto_quant/ollama_service.py` (1624 lines)
- `backend/services/auto_quant/pipeline_modules/stages_validation.py` (1295 lines)
- `backend/tests/auto_quant/test_pipeline_validation.py` (1239 lines)
- `backend/services/auto_quant/pipeline_modules/helpers.py` (1222 lines)
- `backend/services/auto_quant/pipeline_modules/stages_assessment.py` (1174 lines)
- `backend/services/auto_quant/generator.py` (1174 lines)
- `backend/services/execution/pair_sweep_runner.py` (1084 lines)
- `backend/services/candidate/orchestrator.py` (1056 lines)
- `backend/services/auto_quant/pipeline_modules/stage_runtime.py` (972 lines)
- `backend/tests/test_candidate_api.py` (924 lines)
- `backend/services/auto_quant/pipeline_modules/state.py` (896 lines)
- `backend/services/auto_quant/pipeline_modules/scoring.py` (854 lines)
- `backend/services/assistant_service.py` (825 lines)
- `backend/services/auto_quant/policy/__init__.py` (812 lines)

#### Backend Files (700-800 lines)

- `backend/services/strategy/version_manager.py` (791 lines)
- `backend/tests/test_backtest_gate.py` (773 lines)
- `backend/services/auto_quant/pipeline_modules/data_healer.py` (708 lines)
- `backend/services/execution/backtest_runner.py` (702 lines)

#### Frontend Files (> 800 lines)

- `frontend/src/components/StrategyLabTab.jsx` (1758 lines)
- `frontend/src/components/OptimizerTab.jsx` (1518 lines)
- `frontend/src/features/autoquant/components/AutoQuantRunDashboard.jsx` (966 lines)
- `frontend/src/features/autoquant/components/AutoQuantConfigPanel.jsx` (860 lines)
- `frontend/src/components/PerformanceTab.jsx` (855 lines)
- `frontend/src/components/SettingsTab.jsx` (853 lines)
- `frontend/src/components/StrategyEditorTab.jsx` (781 lines)
- `frontend/src/components/StressTestTab.jsx` (774 lines)

#### Frontend Files (500-800 lines)

- `frontend/src/components/AssistantChatPanel.jsx` (761 lines)
- `frontend/src/components/BacktestForm.jsx` (742 lines)
- `frontend/src/components/autoquant/AutoQuantPipelineCard.jsx` (666 lines)
- `frontend/src/features/autoquant/hooks/useAutoQuantPipeline.js` (586 lines)
- `frontend/src/components/StrategyLabTab.test.jsx` (565 lines)
- `frontend/src/services/api.js` (551 lines)
- `frontend/src/components/AutoQuantOverview.jsx` (516 lines)
- `frontend/src/components/autoquant/AutoQuantFailureReport.jsx` (501 lines)

### Refactoring Strategy

When refactoring large files:

1. Identify logical sections/modules within the file
2. Extract related functions/classes into separate modules
3. Use composition over inheritance where appropriate
4. Maintain clear import/export structure
5. Update tests accordingly
6. Document the refactoring in commit messages
