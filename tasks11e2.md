# Task 11E-2: Candidate Repair Loop Integration

## What & Why
Integrate the four existing repair components (`analyze_gate_failure`, `build_repair_plan`, `ask_ai_for_repair_proposal`, `apply_repair_proposal`) into `evaluate_candidate()` so that when the backtest gate fails and a repair is possible, the pipeline automatically attempts AI-driven repairs.

Currently `evaluate_candidate()` runs `failure_analyzer` and `repair_plan` gates but always returns a `passed=False` verdict — no repair is executed. This task wires the loop.

## Done looks like
- When `repair_plan.can_repair` is True, the orchestrator enters a repair loop (max 3 iterations)
- Each iteration: AI proposes a change → proposal is applied to a spec copy → strategy is re-rendered/re-saved/re-backtested
- If the backtest passes after repair, the pipeline proceeds to pair sweep (no early exit)
- If AI returns None, application fails, or `can_repair` becomes False, the loop stops with a failure verdict
- `RepairAttempt` entries are recorded on `CandidateVerdict.repair_attempts`
- All external calls are injectable via the `deps` dict for testability

## Out of scope
- Pair sweep changes (pair sweep runs unchanged when backtest passes)
- Modifications to `ai_repair_proposer.py`, `repair_applier.py`, `repair_plan_gate.py`, or `failure_analyzer.py`
- Any frontend or AutoQuant pipeline changes
- Calling real Ollama or running real backtests
- New endpoints or API routes

## Steps
1. **Extract the backtest-passed path** — refactor the pair-sweep → portfolio → final-decision block (lines 172–257 in orchestrator.py) into a local async helper so the repair loop can jump into it on success
2. **Add repair loop after `build_repair_plan`** — insert a `while` loop that fires only when `repair_plan.can_repair` is True and `iteration < config.max_repair_iterations`. Each iteration: call `ask_ai_for_repair_proposal(client, repair_plan, spec, classification)` → `apply_repair_proposal(spec, proposal)` → if both succeed, call render/save/data-quality/backtest helpers for the new spec
3. **Increment spec iteration** — `apply_repair_proposal` already sets `iteration_count + 1` and `parent_spec_hash` on the returned copy; use that copy for the next loop iteration
4. **Route success/failure** — if the re-run backtest passes, call the extracted success-path helper. If it fails, re-run `analyze_gate_failure` and `build_repair_plan` on the new result and `break` if `can_repair` is False
5. **Record repair attempts** — append `RepairAttempt(iteration, scope, change_applied, outcome)` to verdict after each iteration
6. **Wire deps** — add `ollama_client`, `ask_ai_for_repair_proposal`, and `apply_repair_proposal` to the `deps` injection pattern (same as render/save/backtest)

## Relevant files
- `backend/services/candidate/orchestrator.py:28-305`
- `backend/services/candidate/models.py:27-40`
- `backend/services/execution/failure_analyzer.py:90-174`
- `backend/services/execution/repair_plan_gate.py:48-140`
- `backend/services/execution/ai_repair_proposer.py:176-236`
- `backend/services/execution/repair_applier.py:28-77`
- `backend/services/candidate/__init__.py:1-12`
- `backend/tests/candidate/test_orchestrator.py:1-651`

## Repair loop flow (pseudocode)

```
if repair_plan.can_repair:
    iteration = 0
    current_spec = spec
    while iteration < config.max_repair_iterations:
        proposal = await ask_ai(ollama_client, repair_plan, current_spec, classification)
        if proposal is None: break

        new_spec, errors = apply_repair(current_spec, proposal)
        if errors: break

        # re-run gates 1-4 for new_spec
        render_result = render_strategy(new_spec)
        save_result = save_strategy(...)
        quality_result = check_quality(...)
        bt_result = run_backtest(...)

        record RepairAttempt(iteration, scope, change, outcome)

        if bt_result.gate_status == "passed":
            return await _run_post_backtest_gates(bt_result, save_result, ...)
        else:
            classification = analyze_failure(bt_result)
            repair_plan = build_repair(classification, spec=new_spec)
            if not repair_plan.can_repair: break
            current_spec = new_spec
            iteration += 1

    # all repair attempts exhausted — final failure
```

## Iteration rules
- Enter repair loop only after backtest_gate fails
- `analyse_gate_failure` → `build_repair_plan` → if `can_repair` is False, stop immediately
- If AI returns None, stop
- If `apply_repair_proposal` returns errors, stop
- Re-run render → save → data quality → backtest for the repaired spec
- If re-run backtest passes, proceed to pair sweep (do not re-analyze)
- Hard stop at `config.max_repair_iterations` (default 3)

## Return shape updates
- `CandidateVerdict.repair_attempts` populated with one `RepairAttempt` per loop iteration
- `RepairAttempt.outcome` values: `"applied_and_retested"`, `"ai_returned_none"`, `"apply_failed"`, `"max_iterations_reached"`, `"can_repair_became_false"`
- `failure_reason` updated for loop exits: e.g. `"repair_ai_returned_none"`, `"repair_apply_failed"`, `"repair_max_iterations"`

## Tests needed
- Happy path: backtest fails, repair succeeds, flow proceeds to pair sweep (verify all gates rendered)
- AI returns None → stops with appropriate `RepairAttempt`
- Application fails → stops with appropriate `RepairAttempt`
- Repair succeeds but re-run backtest still fails → re-enters loop
- Max iterations exhausted → final failure with all attempts recorded
- `can_repair` becomes False mid-loop → stops
- Verify `RepairAttempt` entries: iteration count, scope, change, outcome
- Verify all deps are injectable (`ollama_client`, `ask_ai_for_repair_proposal`, `apply_repair_proposal`)
- Confirm no real Ollama/backtest calls when deps are injected

## What not to touch
- `ai_repair_proposer.py` — do not change
- `repair_applier.py` — do not change
- `repair_plan_gate.py` — do not change
- `failure_analyzer.py` — do not change
- `CandidateConfig` / `CandidateVerdict` / `CandidateGateResult` / `RepairAttempt` models — do not change
- No frontend or API endpoint files
- No AutoQuant pipeline files
- `__init__.py` — no changes (already exports all needed symbols)

## First implementation task only
This task covers only the `evaluate_candidate()` body changes in `orchestrator.py` and corresponding test additions in `test_orchestrator.py`. No new files, no model changes, no new services.
