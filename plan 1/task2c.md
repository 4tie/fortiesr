# Task 2C Plan: StrategySpec Dedup Registry

## Summary
Task 2C is already present in the workspace as backend-only, untracked files. The implementation matches the requested scope: no frontend, pipeline, endpoints, Ollama, code generation, backtests, or `user_data` writes.

## Key Changes
- Use `backend/services/strategy/strategy_spec_registry.py` as the registry helper module.
- Keep these functions as the public helper surface:
  - `load_spec_registry(path)`
  - `save_spec_registry(path, data)`
  - `is_duplicate_spec(spec, registry)`
  - `record_spec(spec, registry, name=None)`
- Registry shape remains:
  - top-level `{"hashes": {...}}`
  - each entry stores `hash`, `name`, and UTC `created` timestamp.
- Duplicate checks use `spec.spec_hash()`, so `iteration_count` and `parent_spec_hash` remain ignored through the existing hash behavior.

## Tests
- Use `backend/tests/test_strategy_spec_registry.py`.
- Covered scenarios:
  - new spec is not duplicate
  - recorded spec becomes duplicate
  - same spec with different `iteration_count` is duplicate
  - changed spec has different hash
  - missing registry file loads safely
  - corrupted registry file loads safely
  - invalid/empty registry structure loads safely
  - save and reload preserves recorded hash and name

## Verification
Ran:
`.venv/bin/pytest backend/tests/test_strategy_spec.py backend/tests/test_strategy_designer.py backend/tests/test_strategy_spec_registry.py -xvs`

Result:
`26 passed in 0.06s`

## Assumptions
- The existing untracked files are the intended Task 2C implementation and should be kept.
- No additional integration into APIs, pipeline, Strategy Designer, or `user_data` persistence is part of Task 2C.

================================================================================

## Validation Review — 2026-06-15 17:45

### Overall Status

Status: PASS

Short summary:
- All 4 public helper functions are implemented.
- Registry shape matches spec (`{"hashes": {...}}` with `hash`, `name`, `created`).
- Duplicate checks correctly ignore `iteration_count` and `parent_spec_hash`.
- All 10 tests pass, including edge cases (missing/corrupted/invalid registry files).

### Task Requirements Checked

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| `load_spec_registry(path)` | PASS | `strategy_spec_registry.py:11` | Returns `{"hashes": {}}` for missing/corrupt/invalid |
| `save_spec_registry(path, data)` | PASS | `strategy_spec_registry.py:24` | Creates parent dirs, writes sorted JSON |
| `is_duplicate_spec(spec, registry)` | PASS | `strategy_spec_registry.py:29` | Uses `spec.spec_hash()` against `hashes` dict |
| `record_spec(spec, registry, name=None)` | PASS | `strategy_spec_registry.py:34` | Creates `hashes` key if missing, stores hash+name+created |
| Registry shape `{"hashes": {...}}` | PASS | `strategy_spec_registry.py:43-47` | Each entry: `hash`, `name`, UTC `created` |
| Duplicate check ignores `iteration_count` | PASS | `spec_hash()` in `strategy_spec.py` | Hash excludes `iteration_count` and `parent_spec_hash` |
| Duplicate check ignores `parent_spec_hash` | PASS | `spec_hash()` in `strategy_spec.py` | Same exclusion |
| No frontend/pipeline/endpoint/Ollama/codegen/backtest changes | PASS | — | All changes in `services/strategy/` and `tests/` |

### Files Reviewed

Connected to task:
- `backend/services/strategy/strategy_spec_registry.py` — 48 lines, 4 public functions
- `backend/tests/test_strategy_spec_registry.py` — 122 lines, 10 tests

Possibly connected:
- `backend/models/strategy_spec.py` — `StrategySpec` and `spec_hash()` dependency

Unrelated changed files:
- (none)

### Tests / Commands Run

| Command | Result | Notes |
|---|---|---|
| `.venv/bin/pytest backend/tests/test_strategy_spec_registry.py -xvs` | PASS (10/10) | All tests pass |

### What Is Working

- New specs are correctly identified as non-duplicate
- Recorded specs become duplicates on subsequent checks
- Different `iteration_count` values produce the same hash → duplicate detection works
- Changed spec fields (e.g. stoploss) produce different hashes → not duplicate
- Missing registry file → loads safely as empty `{"hashes": {}}`
- Corrupted JSON → loads safely as empty `{"hashes": {}}`
- Invalid structure (e.g. `{"not_hashes": []}`) → loads safely as empty `{"hashes": {}}`
- Empty JSON object `{}` → loads safely as empty `{"hashes": {}}`
- Save and reload preserves recorded hash and name
- `record_spec` creates `hashes` key when registry starts empty

### What Did Not Work

- Nothing — all tests pass

### Errors Found

- None

### Gaps / Missing Work

- None within the stated scope. The registry is not wired to any API, pipeline, or persistence path (by design).

### Risk Notes

- The registry file path is a parameter — no default/stable path is configured yet.
- No locking mechanism for concurrent writes (acceptable at this stage).
- `created` timestamp uses `datetime.now(timezone.utc)` — consistent but no TZ awareness beyond UTC.

### Recommended Next Steps

1. Integrate registry into `strategy_spec_flow.py` (already done in Task 2D)
2. Configure a stable registry path in settings
3. Add a `list_registry()` function for browsing recorded specs

### Final Decision

Decision: ACCEPT

Reason:
- All 4 public functions implemented and tested.
- All edge cases for file I/O covered.
- Hash-based dedup correctly ignores iteration fields.
- No disallowed modifications.
