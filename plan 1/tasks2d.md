# tasks2d.md — StrategySpec Design Flow

## 1. Goal

Create one small backend helper that combines Strategy Designer, StrategySpec validation, and StrategySpec dedup into a single flow. The helper should return one clear result: ready spec, validation errors, duplicate spec, or AI/JSON errors.

## 2. Why this task comes next

Task 2A created the `StrategySpec` schema and validator. Task 2B created the AI Strategy Designer helper. Task 2C created the spec hash registry. Task 2D connects these pieces into the first complete "AI suggests → Backend validates → dedup checks" backend flow before any strategy code generation, pipeline run, or backtest.

## 3. Existing files to reuse

| File | What it provides |
|------|-----------------|
| `backend/services/auto_quant/strategy_designer.py` | `generate_strategy_spec(...)` returns spec or AI/schema/validation errors |
| `backend/models/strategy_spec.py` | `StrategySpec`, `validate_spec(...)`, `spec.spec_hash()` |
| `backend/services/strategy/strategy_spec_registry.py` | `load_spec_registry`, `save_spec_registry`, `is_duplicate_spec`, `record_spec` |
| `backend/tests/test_strategy_designer.py` | Mocked Ollama response patterns |
| `backend/tests/test_strategy_spec_registry.py` | Temporary registry file patterns |

## 4. Files likely to change

| File | Change |
|------|--------|
| `backend/services/strategy/strategy_spec_flow.py` | New helper module for the combined flow |
| `backend/tests/test_strategy_spec_flow.py` | New tests for ready, error, and duplicate outcomes |

## 5. Proposed helper function name and location

Location:
`backend/services/strategy/strategy_spec_flow.py`

Function:
```python
async def design_validate_register_spec(
    client,
    registry_path,
    *,
    trading_style: str,
    timeframe: str,
    direction: str | None = None,
    risk_profile: str | None = None,
    name: str | None = None,
    description: str | None = None,
) -> dict:
```

## 6. Flow steps

1. Call `generate_strategy_spec(...)` with the existing Ollama client and user inputs.
2. If the designer returns errors or no spec, return `status="error"` with those errors.
3. Load the registry with `load_spec_registry(registry_path)`.
4. Check duplicate with `is_duplicate_spec(spec, registry)`.
5. If duplicate, return `status="duplicate"` with `spec_hash` and existing registry entry.
6. If new, call `record_spec(spec, registry, name=name or spec.name)`.
7. Save with `save_spec_registry(registry_path, registry)`.
8. Return `status="ready"` with the valid spec and spec hash.

## 7. Return shape

```python
{
    "status": "ready" | "validation_error" | "duplicate" | "ai_error",
    "spec": StrategySpec | None,
    "errors": list[str],
    "spec_hash": str | None,
    "registry_entry": dict | None,
    "raw_response": str | None,
}
```

Status mapping:
- `ready`: valid non-duplicate spec recorded successfully.
- `validation_error`: `generate_strategy_spec(...)` returned deterministic spec validation errors.
- `duplicate`: spec hash already exists in registry.
- `ai_error`: empty Ollama response, invalid JSON, or invalid StrategySpec schema.

## 8. Tests needed

Create `backend/tests/test_strategy_spec_flow.py`:

1. `test_flow_ready_records_spec` — valid AI JSON returns `ready` and writes hash to temp registry.
2. `test_flow_duplicate_spec` — existing hash returns `duplicate` and does not overwrite entry.
3. `test_flow_ai_error` — invalid JSON returns `ai_error`.
4. `test_flow_schema_error` — invalid StrategySpec schema returns `ai_error`.
5. `test_flow_validation_error` — valid schema but invalid spec returns `validation_error`.
6. `test_flow_iteration_count_duplicate` — same spec with different `iteration_count` is duplicate.

Run:
`.venv/bin/pytest backend/tests/test_strategy_spec.py backend/tests/test_strategy_designer.py backend/tests/test_strategy_spec_registry.py backend/tests/test_strategy_spec_flow.py -xvs`

## 9. What not to touch

- Do not modify frontend.
- Do not modify pipeline files.
- Do not create API endpoints.
- Do not touch Ollama files.
- Do not generate strategy code.
- Do not run backtests.
- Do not write to `user_data/` in tests; use `tmp_path`.

## 10. First implementation task only

Create `backend/services/strategy/strategy_spec_flow.py` and `backend/tests/test_strategy_spec_flow.py`.

Implement only `design_validate_register_spec(...)` and its tests. Do not wire it into routers, AI agent tools, AutoQuant pipeline, strategy generation, or persistence outside the provided `registry_path`.

================================================================================

## Validation Review — 2026-06-15 17:46

### Overall Status

Status: PASS

Short summary:
- All 8 flow steps are implemented in `design_validate_register_spec`.
- Return shape and all 4 status values match the spec exactly.
- All 6 required tests are present and pass.
- No disallowed files were modified.

### Task Requirements Checked

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Create `backend/services/strategy/strategy_spec_flow.py` | PASS | `strategy_spec_flow.py:1` | Module exists |
| `design_validate_register_spec(...)` function signature | PASS | `strategy_spec_flow.py:24-34` | Async, correct params |
| Step 1: Call `generate_strategy_spec(...)` | PASS | `strategy_spec_flow.py:36-44` | Delegates to designer |
| Step 2: Return error status if errors/no spec | PASS | `strategy_spec_flow.py:49-50` | `ai_error` or `validation_error` |
| Step 3: Load registry | PASS | `strategy_spec_flow.py:60-61` | Uses `load_spec_registry` |
| Step 4: Check duplicate | PASS | `strategy_spec_flow.py:65` | Uses `is_duplicate_spec` |
| Step 5: Return duplicate status | PASS | `strategy_spec_flow.py:66-73` | `status="duplicate"` with hash + entry |
| Step 6: Record new spec | PASS | `strategy_spec_flow.py:75` | `record_spec(spec, registry, ...)` |
| Step 7: Save registry | PASS | `strategy_spec_flow.py:77` | `save_spec_registry(registry_file, registry)` |
| Step 8: Return ready status | PASS | `strategy_spec_flow.py:79-86` | `status="ready"` with spec + hash |
| Return shape matches spec | PASS | `strategy_spec_flow.py:89-105` | `{status, spec, errors, spec_hash, registry_entry, raw_response}` |
| Status mapping (ready/validation_error/duplicate/ai_error) | PASS | `strategy_spec_flow.py:49-50,66,79` | All 4 states handled |
| Do not modify frontend/pipeline/endpoints/Ollama/user_data | PASS | — | No changes outside `services/strategy/` and `tests/` |

### Files Reviewed

Connected to task:
- `backend/services/strategy/strategy_spec_flow.py` — main implementation (105 lines)
- `backend/tests/test_strategy_spec_flow.py` — 6 tests (156 lines)

Possibly connected:
- `backend/services/auto_quant/strategy_designer.py` — dependency (generate_strategy_spec)
- `backend/services/strategy/strategy_spec_registry.py` — dependency (registry operations)

Unrelated changed files:
- (none)

### Tests / Commands Run

| Command | Result | Notes |
|---|---|---|
| `.venv/bin/pytest backend/tests/test_strategy_spec_flow.py -xvs` | PASS (6/6) | All task-specified tests pass |

### What Is Working

- Valid AI JSON response → status `"ready"`, spec recorded to registry, hash returned
- Same spec submitted twice → first `"ready"`, second `"duplicate"` with existing entry
- Invalid JSON → `"ai_error"` with `INVALID_JSON`
- Schema-invalid payload → `"ai_error"` with `INVALID_STRATEGY_SPEC_SCHEMA`
- Valid schema but invalid spec (no indicators) → `"validation_error"` with `NO_INDICATORS`
- Same spec with different `iteration_count` → duplicate (hash ignores iteration fields)
- Registry persisted correctly between calls

### What Did Not Work

- Nothing — all tests pass

### Errors Found

- None

### Gaps / Missing Work

- None. The task is fully implemented within its stated scope ("First implementation task only").

### Risk Notes

- The flow is not wired to any API endpoint or pipeline yet (by design).
- Uses temp `registry_path` in tests; production wiring will need a real path.
- Error classification between `ai_error` and `validation_error` depends on `_AI_ERROR_CODES` set — any new error code from the designer must be added to this set or it will be misclassified.

### Recommended Next Steps

1. Wire `design_validate_register_spec` into an API endpoint (`POST /api/strategy/design`)
2. Persist registry to a stable path (`user_data/strategy_spec_registry.json`)
3. Expose duplicate and validation errors to the frontend

### Final Decision

Decision: ACCEPT

Reason:
- All 8 flow steps implemented correctly.
- All 4 status values handled.
- All 6 tests pass.
- No disallowed modifications.
