# Candidate Workflow Orchestrator

## What & Why
Build a backend-only orchestration layer that connects the existing validation helpers (spec flow, code writer, data gate, backtest gate, failure analyzer, repair plan, pair sweep, portfolio backtest) into a single deterministic candidate evaluation flow — separate from the AutoQuant pipeline. The orchestrator should be a stateless async function that takes a strategy spec and runs it through the full gauntlet, returning a verdict and artifact set. This enables headless candidate validation for batch processing, CI-like grading, and repair iteration without involving the AutoQuant pipeline's 5-stage lifecycle.

## Done looks like
- A single async function `evaluate_candidate()` in `backend/services/candidate/` accepts a `StrategySpec`, run config, and optional `OllamaClient`
- The function returns a `CandidateVerdict` dataclass with: pass/fail, per-gate results, repair attempts used, final pair set, and portfolio metrics
- Internal flow: spec → code → safe copy → data gate → backtest gate → (failure? → analyze → repair loop) → individual pair sweep → portfolio backtest → final pair set decision
- Repair loop respects `RepairPlan` max_iterations and can invoke `ai_repair_proposer` for AI-guided fixes
- Unit tests exist for the orchestration logic, repair iteration control, and edge cases (gate failure at each step, max repair iterations, AI decline)

## Out of scope
- No new endpoints or API routes
- No frontend changes
- No AutoQuant pipeline modifications
- No real backtests (tests use mocks/fakes)
- No live trading consideration
- No state persistence or run history (caller manages state)
- No parallel candidate evaluation (sequential only for v1)
- No HTML report or delivery artifact generation

## Steps
1. **Create `backend/services/candidate/` package** — New package with `__init__.py`, `orchestrator.py`, and `models.py`. Keep it isolated from `auto_quant/` and `execution/`.
2. **Define `CandidateVerdict` and supporting models** — In `models.py`: `CandidateVerdict` (pass/fail, gate_results dict, repair_iterations, final_pair_set, portfolio_metrics, failure_reason), `CandidateGateResult` (gate_name, passed, details, metrics), `RepairAttempt` (iteration, scope, change_applied, outcome). Keep Pydantic or dataclass.
3. **Implement `evaluate_candidate()` core flow** — In `orchestrator.py` as a single async function. Signature: `async def evaluate_candidate(spec: StrategySpec, config: CandidateConfig, ollama_client: OllamaClient | None = None) -> CandidateVerdict`. `CandidateConfig` holds timerange, timeframe, pairs, user_data_dir, exchange, max_repair_iterations.
4. **Gate 1: Spec-to-Code** — Call `render_strategy_from_spec()` then `save_rendered_strategy()`. If rendering fails, return early with `fail`.
5. **Gate 2: Safe Working Copy** — Use `ensure_working_copy()` pattern (not the AutoQuant variants helper — implement a standalone safe-copy utility in the candidate package that copies the rendered file to a temp working dir and returns the path).
6. **Gate 3: Data Quality** — Call `check_data_quality()`. If fails, return early with `fail` and route `check_data`.
7. **Gate 4: Backtest Gate** — Call `run_backtest_gate()`. If passes, proceed. If fails, enter repair loop.
8. **Repair Loop** — On backtest failure: call `analyze_gate_failure()`, then `build_repair_plan()`. If `can_repair` and `ollama_client` is provided, call `ask_ai_for_repair_proposal()`. Apply the repair change to the spec, re-render code, re-run gates 2-4. Track iterations. Hard stop at `max_iterations`. If AI returns None or repair plan says `no_repair_possible`, exit loop with failure.
9. **Gate 5: Individual Pair Sweep** — Call `run_individual_pair_sweep()`. If zero pairs pass quality gate, return failure. Collect per-pair metrics.
10. **Gate 6: Portfolio Backtest** — Call `run_portfolio_backtest()`. Collect portfolio-level metrics.
11. **Gate 7: Final Pair Decision** — Call `decide_final_pair_set()` using individual sweep + portfolio results. Include final approved pair set in the verdict.
12. **Assembly** — Build `CandidateVerdict` with all gate results, repair attempts, final metrics, and return.
13. **Unit tests** — Test full happy path, each early-exit gate failure, repair loop iteration counting, AI decline mid-loop, and max-iteration cutoff.

## Relevant files
- `backend/services/strategy/strategy_spec_flow.py`
- `backend/services/strategy/strategy_code_writer.py`
- `backend/services/execution/data_quality_gate.py`
- `backend/services/execution/backtest_gate.py`
- `backend/services/execution/failure_analyzer.py`
- `backend/services/execution/repair_plan_gate.py`
- `backend/services/execution/ai_repair_proposer.py`
- `backend/services/execution/pair_sweep_runner.py`
- `backend/services/auto_quant/variants.py`
- `backend/models/strategy_spec.py`
- `backend/models/base.py`
- `backend/services/execution/backtest_runner.py`

## Tests needed
- `backend/tests/candidate/test_orchestrator.py`
- `backend/tests/candidate/test_models.py`

Test cases:
- Happy path: spec → code → data → backtest pass → pair sweep → portfolio → verdict pass
- Gate fail early exit at each gate (render fails, data quality fails, backtest fails with no repair possible)
- Repair loop: backtest fails → analyze → repair plan → AI proposal → re-render → re-run gates → passes on 2nd attempt
- Repair loop: AI returns None → exit with failure (no crash)
- Repair loop: max_iterations reached → exit with failure
- Repair loop: repair scope `no_repair_possible` → immediate exit
- Pair sweep returns zero valid pairs → verdict fail
- Portfolio backtest fails → verdict fail with portfolio metrics included

## What not to touch
- `backend/services/auto_quant/` — no modifications to any AutoQuant pipeline modules, variants, or stages
- `backend/api/` — no new routers or endpoint changes
- `frontend/` — no frontend work
- `server.py` — no entrypoint changes
- Any existing test file outside `backend/tests/candidate/`

## First implementation task only
Create `backend/services/candidate/` package with `__init__.py`, `models.py`, and `orchestrator.py`. Implement `CandidateConfig`, `CandidateVerdict`, `CandidateGateResult`, and `RepairAttempt` models in `models.py`. Implement the full `evaluate_candidate()` async function in `orchestrator.py` with all 7 gates and the repair loop as described above. Write `backend/tests/candidate/test_orchestrator.py` with the happy-path test and one early-exit gate failure test (data quality fails). Write `backend/tests/candidate/test_models.py` with model construction and serialization tests. Do not implement other test cases in this first task — leave them as pending for follow-up tasks.

## Relevant files
- `backend/services/strategy/strategy_spec_flow.py`
- `backend/services/strategy/strategy_code_writer.py`
- `backend/services/execution/data_quality_gate.py`
- `backend/services/execution/backtest_gate.py`
- `backend/services/execution/failure_analyzer.py`
- `backend/services/execution/repair_plan_gate.py`
- `backend/services/execution/ai_repair_proposer.py`
- `backend/services/execution/pair_sweep_runner.py`
- `backend/services/auto_quant/variants.py`
- `backend/models/strategy_spec.py`
- `backend/models/base.py`
- `backend/services/execution/backtest_runner.py`
