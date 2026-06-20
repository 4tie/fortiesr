# Task 13: Candidate Evaluation API

Plan to expose the candidate evaluation workflow through a backend endpoint that accepts a StrategySpec + CandidateConfig and returns CandidateVerdict.

## 1. Goal
Create a backend-only API endpoint that exposes the candidate evaluation workflow by accepting a StrategySpec and CandidateConfig, calling `evaluate_candidate()`, and returning a CandidateVerdict.

## 2. Why this task comes next
The candidate evaluation orchestrator (`backend/services/candidate/orchestrator.py`) exists with a complete `evaluate_candidate()` function but has no API exposure. This task provides programmatic access to the candidate workflow before integrating it into the AutoQuant pipeline.

## 3. Existing files to reuse
- `backend/services/candidate/orchestrator.py` - contains `evaluate_candidate()` function
- `backend/services/candidate/models.py` - contains `CandidateConfig`, `CandidateVerdict`, `CandidateGateResult`, `RepairAttempt`
- `backend/models/strategy_spec.py` - contains `StrategySpec` and `validate_spec()`
- `backend/api/routers/backtest.py` - reference pattern for router structure and dependency injection via `request.app.state.services`

## 4. Files likely to change
- `backend/api/routers/candidate.py` - **new file** for candidate evaluation endpoint
- `backend/api/app.py` - add import and include candidate router
- `backend/models/contracts.py` - add request/response models for the endpoint (or define in router file)

## 5. Proposed endpoint path
`POST /api/candidate/evaluate`

## 6. Request shape
```python
class CandidateEvaluateRequest(BaseModel):
    spec: StrategySpec
    config: CandidateConfig
```

## 7. Response shape
```python
class CandidateEvaluateResponse(BaseModel):
    verdict: CandidateVerdict
```

## 8. Dependency wiring
The endpoint will:
- Access services via `request.app.state.services` (following backtest.py pattern)
- Call `evaluate_candidate(spec, config, deps=...)` with mocked dependencies for testing
- For production, pass real dependencies via `deps` dict or wire through AppServices

## 9. Safety rules
- Do not enable live trading
- Do not integrate with AutoQuant pipeline yet
- Keep endpoint backend-only (no frontend UI)
- Validate StrategySpec using `validate_spec()` before calling `evaluate_candidate()`
- Rate limit endpoint (similar to `/api/backtest/run` at 10 req/min)

## 10. Tests needed
- Unit test in `backend/tests/test_candidate_api.py`:
  - Mock all gate dependencies (render_strategy, save_strategy, check_data_quality, run_backtest_gate, etc.)
  - Mock Ollama client to avoid real AI calls
  - Test successful evaluation path
  - Test failure at each gate (render, save, data quality, backtest)
  - Test repair loop with mocked AI responses
  - Test validation errors for invalid StrategySpec

## 11. What not to touch
- Do not modify frontend code
- Do not modify AutoQuant pipeline files
- Do not modify `backend/services/candidate/orchestrator.py`
- Do not modify `backend/services/candidate/models.py`
- Do not enable live trading
- Do not run real backtests in tests
- Do not call real Ollama in tests

## 12. First implementation task only
Create the candidate router file with a single endpoint that:
1. Accepts `CandidateEvaluateRequest` with StrategySpec + CandidateConfig
2. Validates StrategySpec using `validate_spec()`
3. Calls `evaluate_candidate(spec, config)` with empty deps dict
4. Returns `CandidateEvaluateResponse` with the verdict
5. Handles BackendError exceptions appropriately
