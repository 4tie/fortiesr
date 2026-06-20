# Task 12: Candidate Workflow Audit and Hardening

## Goal
Audit the completed candidate evaluation orchestrator, identify small hardening gaps, and fix them before exposing the workflow through API/UI endpoints.

## Why This Task Comes Next
The orchestrator (7 gates + repair loop) is implemented and fully tested (28/28 pass). Before wiring it into the AutoQuant pipeline or creating a REST endpoint, we need a focused hardening pass to catch edge cases, naming inconsistencies, and missing cleanup that would cause subtle bugs in production.

## What Already Works
- 7-gate pipeline (render → save → data quality → backtest → pair sweep → portfolio → final decision)
- Repair loop with bounded iterations, AI proposal, application, re-test cycl
- All 12 dependencies injectable via `deps` dict — tests use mocks, no real backtests or AI calls
- 28 tests covering happy path, early exits, repair loop scenarios, and pair workflow

## Risks to Check
1. **Duplicate `backtest_gate` entries** — repair loop appends a new `CandidateGateResult(gate_name="backtest_gate", passed=True)` while the original `passed=False` entry is already in `gate_results`. Consumers reading by `gate_name` will see multiple entries.
2. **Working copy leak** — `save_rendered_strategy` creates files at `{user_data_dir}/strategies/rendered/` each repair iteration. No cleanup of previous copies.
3. **`failure_reason` fallback** — when `can_repair=False` and `classification.primary_class` is `None`, the fallback string `"backtest_gate_failed"` is generic and indistinguishable from a direct backtest failure without repair.
4. **Loop exit + attempt count** — `iteration` is incremented after `applied_and_retested` but `can_repair=False` breaks before incrementing, yet the attempt was already recorded. The final iteration's attempt entry has the retested outcome even though the loop didn't fully cycle.

## Files to Inspect
- `backend/services/candidate/orchestrator.py`
- `backend/services/candidate/models.py`
- `backend/services/execution/backtest_gate.py`
- `backend/services/execution/repair_applier.py`
- `backend/services/execution/ai_repair_proposer.py`
- `backend/services/execution/pair_sweep_runner.py`
- `backend/tests/candidate/test_orchestrator.py`

## Tests to Run
```
pytest backend/tests/candidate/test_orchestrator.py -xvs --no-header -q
```
Expected: 28 passed.

## Hardening Items
1. Deduplicate or last-wins gate results by `gate_name` in `CandidateVerdict` before returning
2. Add working copy cleanup call at the start of each repair iteration (remove previous `save_result.path`)
3. Improve fallback failure_reason when repair is impossible — differentiate `"backtest_gate_failed"` with a suffix or use a dedicated value
4. Ensure `max_iter` never goes below 1 when `max_iterations - iteration_count` is 0 or negative
5. Verify `repair_attempts` last entry accurately reflects whether the next loop iteration actually started
6. Confirm `_run_post_backtest_gates` does not silently swallow deps lookup failures (no bare `deps.get()` without fallback on critical paths like `render_strategy` / `save_strategy`)
7. Check `apply_repair_proposal` copies `backtest_id` or other identity fields from old spec to new spec

## What Not to Touch
- AutoQuant pipeline files (`backend/services/auto_quant/`)
- Frontend code
- API routers
- Freqtrade subprocess execution
- Settings or config models
- Live trading behavior
- Gate threshold values

## First Implementation Task Only
- Start with item 1 (deduplicate gate results by `gate_name` keeping the latest entry) and item 4 (clamp `max_iter` minimum to 1). These are the highest-risk items for production. Re-run tests after each change.
