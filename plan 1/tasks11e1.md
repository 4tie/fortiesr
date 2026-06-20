# tasks11e1.md — Repair Proposal Applier

## 1. Goal

Safely apply a validated AI repair proposal (dict) to a **copy** of `StrategySpec`, producing a new spec with the single change applied, `iteration_count` incremented, and `parent_spec_hash` set.

## 2. Why this task comes next

Task 8 (`repair_plan_gate.py`) determines *what* AI may touch. Task 9 (`ai_repair_proposer.py`) calls AI to get a *proposal* dict. This task actually **applies** that proposal to produce a concrete new `StrategySpec` ready for re-evaluation. Without it, the pipeline can detect failures and propose fixes but never materialize them.

## 3. Existing files to reuse

| File | What it provides |
|------|------------------|
| `backend/models/strategy_spec.py` | `StrategySpec`, `validate_spec()`, `spec_hash()`, all field types |
| `backend/services/execution/ai_repair_proposer.py` | Proposal dict shape per scope (`repair_scope`, `change`, `reasoning`) |
| `backend/services/execution/repair_plan_gate.py` | `RepairScope` literal — the 6 actionable scopes |
| `backend/services/candidate/models.py` | `RepairAttempt` model for recording what was applied |

## 4. Files likely to change

| File | Change |
|------|--------|
| `backend/services/execution/repair_applier.py` | **New** — `apply_repair_proposal()` function |
| `backend/tests/test_repair_applier.py` | **New** — unit tests for every scope |

## 5. Proposed helper function name and location

**Location:** `backend/services/execution/repair_applier.py`

**Function:**
```python
def apply_repair_proposal(
    spec: StrategySpec,
    proposal: dict,
) -> tuple[StrategySpec | None, list[str]]:
```

Takes the current `StrategySpec` and a proposal dict (output of `ask_ai_for_repair_proposal()`). Returns `(new_spec, errors)` where `errors` is empty on success.

## 6. Supported repair scopes

| Scope | `change` keys | Apply logic |
|-------|---------------|-------------|
| `stoploss` | `{"stoploss": float}` | `copy.stoploss = change["stoploss"]` |
| `entry_logic` | `{"index": int, "field": str, "new_value": ...}` | `copy.entry_conditions[index].field = new_value` |
| `exit_logic` | `{"index": int, "field": str, "new_value": ...}` | `copy.exit_conditions[index].field = new_value` |
| `entry_parameter` | `{"indicator": str, "parameter": str, "new_value": int\|float}` | Find indicator by name, set `params[parameter] = new_value` |
| `roi` | `{"action": str, "index": int, ...}` | `add` → insert, `remove` → pop, `modify` → replace at index |
| `position_sizing` | `{"field": str, "new_value": ...}` | `copy.max_open_trades = val` or `copy.position_sizing.field = val` |

## 7. Validation rules before applying

1. `proposal` must be a `dict` with keys `repair_scope` (str), `change` (dict), `reasoning` (str).
2. `repair_scope` must be one of the 6 actionable scopes (not `no_repair_possible`, `final_reject`).
3. `change` must be a non-empty dict.
4. Scope-specific field presence checks (e.g., stoploss must have `"stoploss"` key, entry_logic must have `"index"`, `"field"`, `"new_value"`).
5. Index bounds: `entry_logic`/`exit_logic` index must be `< len(conditions)`. `roi` index must be `< len(roi)` (or `== len(roi)` for `add`).
6. Indicator existence: `entry_parameter`'s `indicator` name must match an existing indicator.

These are **pre-apply** sanity checks, not the deep semantic checks that `validate_spec()` handles.

## 8. Iteration update rule

After applying the change:

```python
copy.iteration_count = spec.iteration_count + 1
copy.parent_spec_hash = spec.spec_hash()
```

Then call `errors = validate_spec(copy)`. If errors non-empty, return `(None, errors)` — do not return a broken spec.

## 9. Return shape

```python
# Success
(None, [])  # errors empty — caller checks: if not errors: use new_spec

# Failure
(None, ["INVALID_STOPLOSS", ...])  # validation errors
```

The caller receives `(spec_or_None, error_list)`.

## 10. Tests needed

Create `backend/tests/test_repair_applier.py`:

| Test | What it covers |
|------|---------------|
| `test_applies_stoploss` | Stoploss proposal → new spec has updated stoploss, iteration_count+1, parent_spec_hash set |
| `test_applies_entry_logic` | entry_logic proposal → condition field changed correctly |
| `test_applies_exit_logic` | exit_logic proposal → exit condition changed |
| `test_applies_entry_parameter` | entry_parameter proposal → indicator param changed |
| `test_roi_add` | ROI add action → new entry inserted |
| `test_roi_remove` | ROI remove action → entry popped |
| `test_roi_modify` | ROI modify action → entry updated |
| `test_position_sizing_field` | position_sizing with `max_open_trades` → spec updated |
| `test_original_spec_unchanged` | Deep copy assertion — original spec fields are original values |
| `test_iteration_count_incremented` | `iteration_count` goes from N to N+1 |
| `test_parent_spec_hash_set` | `parent_spec_hash == original.spec_hash()` |
| `test_validate_spec_called` | Invalidate the spec after apply → returns errors |
| `test_invalid_scope_rejected` | `no_repair_possible` scope → returns error |
| `test_missing_change_key_rejected` | Missing required change field → returns error |
| `test_index_out_of_bounds` | entry_logic index >= len(conditions) → error |

## 11. What not to touch

- Do not modify `strategy_spec.py`, `ai_repair_proposer.py`, `repair_plan_gate.py`, `failure_analyzer.py`, `backtest_gate.py`.
- Do not call Ollama or any AI service.
- Do not run backtests.
- Do not modify `orchestrator.py`, `candidate/models.py`, or any pipeline files.
- Do not create API endpoints.
- Do not modify frontend.
- Do not mutate the original `StrategySpec` — use `model_copy(deep=True)`.

## 12. First implementation task only

1. Create `backend/services/execution/repair_applier.py` with:
   - `apply_repair_proposal(spec, proposal) -> tuple[StrategySpec | None, list[str]]`
   - Deep copy of `StrategySpec` (use `model_copy(deep=True)`)
   - Per-scope apply branches for all 6 actionable scopes
   - Pre-apply field/index validation
   - Post-apply `validate_spec()` call
   - Returns `(None, errors)` on any failure
2. Create `backend/tests/test_repair_applier.py` with tests from §10.
3. Run: `.venv/bin/pytest backend/tests/test_repair_applier.py -xvs`
