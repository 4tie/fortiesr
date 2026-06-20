# Task 5: Safe Working Copy for Rendered Strategies

## Goal
Add a helper that saves the in-memory strategy source from `render_strategy_from_spec(...)` to a run/candidate-specific working file that Freqtrade can later backtest — without ever touching the original strategy file.

## Why this comes next
Task 3 (`render_strategy_from_spec`) produces `{source, errors, warnings, template}` but keeps it in memory. Task 4 added data quality gates that validate spec inputs before rendering. Task 5 closes the gap: the rendered source must be materialized to disk so that `backtest_runner.py` can point `--strategy-path` at it. Without this, there is no file for Freqtrade to import.

## Existing files to reuse

| File | What to reuse |
|------|---------------|
| `backend/utils.py` | `atomic_write_text()`, `atomic_write_json()` — existing atomic I/O helpers |
| `backend/paths.py` | `build_local_paths()` — path resolution pattern |
| `backend/services/auto_quant/variants.py` | `variant_dir()`, `strategy_path_args()`, `active_strategy_path()` — run-local working copy conventions |
| `backend/services/strategy/strategy_code_writer.py` | `render_strategy_from_spec()` — the source producer to extend |
| `backend/services/strategy/version_manager.py` | `materialize_strategy_source()` — AST-based param injection pattern |
| `backend/services/execution/backtest_runner.py` | `_build_command()` — consumes `--strategy-path` arg, writes `strategy_snapshot.py` |

## Files likely to change

| File | Change |
|------|--------|
| `backend/services/strategy/strategy_code_writer.py` | Add `save_rendered_strategy()` or similar public function |
| _Possibly_ `backend/services/strategy/__init__.py` | Re-export new function (if pattern exists) |
| `backend/utils.py` | No change needed unless new I/O utility is missing |
| `backend/services/auto_quant/variants.py` | No change — conventions exist, just follow them in strategy_code_writer |

## Proposed helper function

**Location:** `backend/services/strategy/strategy_code_writer.py`

**Signature:**
```python
def save_rendered_strategy(
    *,
    source: str,
    strategy_name: str,
    run_id: str,
    candidate_label: str = "",
    base_path: str | Path = "user_data/strategies/rendered",
) -> SaveResult
```

**Why here:** The render function already lives in `strategy_code_writer.py`. Keeping save co-located avoids circular imports and keeps the render→save workflow callable from one import.

## Working copy path and naming rules

```
{base_path}/{run_id}/{strategy_name}{candidate_suffix}.py
```

- `base_path` defaults to `user_data/strategies/rendered` (ignored by Freqtrade unless `--strategy-path` is set)
- `run_id` prevents collisions across AutoQuant runs
- `candidate_label` is optional — when provided, appended as `_{candidate_label}` before `.py` (e.g. `MyStrategy_v2.py`)
- The full directory (`base_path / run_id`) is created via `Path.mkdir(parents=True, exist_ok=True)`
- Example: `user_data/strategies/rendered/run_abc123/MyStrategy_v2.py`

## Safety rules

1. **Never write to `user_data/strategies/<name>.py`** — that is the original/live strategy directory. The helper must reject any path resolving inside `user_data/strategies/` directly (not under a `rendered/` subdirectory).
2. **Never overwrite an existing file** — check `Path.exists()` before writing; if the target exists, auto-increment `_v1`, `_v2`, etc. (or return an error state).
3. **Validate source before saving** — run `compile(source, '<string>', 'exec')` to reject syntax errors; return the error in `SaveResult.errors`.
4. **Use atomic writes** — delegate to `atomic_write_text()` from `utils.py`.
5. **Cleanup/rollback** — caller's responsibility to delete working copies. Offer a companion `delete_rendered_strategy(path)` that unlinks the file and removes empty parent dirs.
6. **Return clear errors on failure** — never raise bare `Exception`; return typed error messages in `SaveResult`.

## Return shape

```python
@dataclass
class SaveResult:
    path: Path | None        # resolved save path, None on failure
    errors: list[str]        # empty on success
    warnings: list[str]      # e.g. "file overwrite avoided, auto-incremented to _v2"
```

## Tests needed

All new tests go into `backend/tests/strategy/`.

| Test | What it covers |
|------|----------------|
| `test_save_rendered_strategy_new_file` | Clean save to nonexistent path, verify file content, verify `SaveResult.path` is correct |
| `test_save_rendered_strategy_no_overwrite` | Save twice — second call must auto-increment or error, never overwrite |
| `test_save_rendered_strategy_rejects_original_dir` | Path resolving to `user_data/strategies/<name>.py` is rejected with clear error |
| `test_save_rendered_strategy_rejects_bad_syntax` | Source with syntax error returns error in `SaveResult.errors`, no file written |
| `test_save_rendered_strategy_candidate_label` | `candidate_label="v2"` produces filename like `MyStrategy_v2.py` |
| `test_delete_rendered_strategy_cleanup` | Delete file + empty parent dirs |
| `test_save_rendered_strategy_rejects_empty_source` | Empty or whitespace-only source returns error |

## What not to touch

- No changes to `backend/api/routers/` — no new endpoint
- No changes to `frontend/` — no UI for this yet
- No changes to `backend/services/auto_quant/pipeline_modules/` — upstream caller (AutoQuant pipeline) will integrate later
- No changes to `backend/services/execution/backtest_runner.py` — it already supports `--strategy-path`, no changes needed
- No changes to `backend/models/contracts.py` — `SaveResult` is internal, not an API model
- No changes to `SettingsModel` — path rules are function params, not settings
- No changes to `backend/pipeline.py` — not yet wired in

## First implementation task only

1. Add `@dataclass SaveResult` to `backend/services/strategy/strategy_code_writer.py`
2. Implement `save_rendered_strategy()` with path resolution, safety checks, syntax validation, `atomic_write_text()`, and return value
3. Implement `delete_rendered_strategy()` companion
4. Write all 7 tests above
5. Run with: `.venv/bin/pytest backend/tests/strategy/ -xvs`

================================================================================

## Validation Review — 2026-06-15 17:10

### Overall Status

Status: PASS

All task requirements are implemented, safety checks are in place, and 26/26 tests pass (15 existing + 11 new). No watched files were modified.

### Task Requirements Checked

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| `SaveResult` dataclass | PASS | `strategy_code_writer.py:190-196` | Fields: `path`, `errors`, `warnings` |
| `save_rendered_strategy()` | PASS | `strategy_code_writer.py:212-294` | All keyword-only args, defaults match spec |
| `delete_rendered_strategy()` companion | PASS | `strategy_code_writer.py:297-353` | Unlinks file, removes empty parent dir |
| Never write to original strategies dir | PASS | `strategy_code_writer.py:263-267` | base_path defaults to `rendered/` subdir; run_id creates sub-subdir; auto-increment avoids overwrites |
| Never overwrite existing file | PASS | `strategy_code_writer.py:271-278` | Auto-increment `_v1`, `_v2`, … via existence loop |
| Validate source before saving | PASS | `strategy_code_writer.py:240-244` | `compile(source, "<string>", "exec")` catches syntax errors |
| Atomic writes | PASS | `strategy_code_writer.py:281-285` | Delegates to `atomic_write_text()` from `utils.py` |
| Return typed errors, no bare exceptions | PASS | `strategy_code_writer.py` | All error paths return `SaveResult(errors=[...])` |
| Tests: 7+ scenarios | PASS | `test_strategy_code_writer_save.py` | 11 tests (7 planned + 4 extra safety tests) |

### Files Reviewed

Connected to task:
- `backend/services/strategy/strategy_code_writer.py` — added SaveResult, save_rendered_strategy, delete_rendered_strategy, _validate_name_component
- `backend/tests/test_strategy_code_writer_save.py` — 11 new tests

Unrelated changed files:
- `tasks5.md` — plan file (this report appended here)

### Tests / Commands Run

| Command | Result | Notes |
|---|---|---|
| `.venv/bin/pytest backend/tests/test_strategy_code_writer.py backend/tests/test_strategy_code_writer_save.py -xvs` | PASS | 26/26 pass |

### What Is Working

- Full save-render cycle: validates source → compiles syntax → builds safe path → atomic write → returns `SaveResult`
- Overwrite prevention: second save with same names auto-increments to `_v1`
- Safety boundary for delete: rejects paths outside `base_path`, rejects the base itself
- Candidate label naming: `MyStrategy_v2.py` when `candidate_label="v2"`
- Cleanup: `delete_rendered_strategy()` removes the file and the parent run dir if empty
- Name/path sanitization: rejects `/`, `\\`, `..`, null bytes, non-alphanumeric/underscore/hyphen chars in all three name components

### What Did Not Work

- Nothing — all requirements satisfied

### Gaps / Missing Work

- Test location differs from plan suggestion: plan said `backend/tests/strategy/`, actual is `backend/tests/test_strategy_code_writer_save.py` — this follows existing project convention (all other test files are in `backend/tests/` directly)
- Test names differ from plan suggestion — actual names are shorter but cover the 7 planned scenarios plus 4 additional safety checks

### Risk Notes

- The function is isolated (no API routes, no pipeline integration yet) — zero risk of regression
- `atomic_write_text` already calls `ensure_directory(path.parent)`, making the `run_dir.mkdir` call redundant but harmless
- All path operations use `Path.resolve()` to prevent symlink surprises

### Recommended Next Steps

1. Wire `save_rendered_strategy()` into an API endpoint or AutoQuant pipeline stage so rendered strategies are actually persisted during real runs
2. Consider adding a `render_and_save()` convenience that chains `render_strategy_from_spec()` → `save_rendered_strategy()` in one call

### Final Decision

Decision: ACCEPT

Reason: All task requirements are implemented, all 11 new tests pass, all 15 existing tests continue to pass, and no restricted files were touched.
