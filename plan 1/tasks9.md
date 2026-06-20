# tasks9.md — AI Repair Agent Proposal

## 1. Goal

Given a `RepairPlan` with `can_repair=True`, ask the AI (via `OllamaClient`) to propose exactly one change matching the plan's scope. Output is a JSON repair proposal. The repair is **not** applied — only proposed.

## 2. Why this task comes next

Task 8 (`repair_plan_gate.py`) decides *what* AI may touch. Task 9 actually calls the AI to propose *how* to change it. Without this layer, there is no AI-generated suggestion to validate or apply. This is the bridge between "permission to repair" and "executing the repair."

## 3. Existing files to reuse

| File | What it provides |
|------|------------------|
| `backend/services/execution/repair_plan_gate.py` | `RepairPlan` (scope, can_repair, reason), `RepairScope` literal, `build_repair_plan()` |
| `backend/services/execution/failure_analyzer.py` | `FailureClassification` — context for the AI prompt |
| `backend/models/strategy_spec.py` | `StrategySpec` — the fields that proposals target (stoploss, roi, entry_conditions, etc.) |
| `backend/services/auto_quant/ollama_service.py` | `OllamaClient.generate()`, `clean_json_response()`, `create_ollama_client_from_settings()`, circuit breaker, retry logic |

## 4. Files likely to change

| File | Change |
|------|--------|
| `backend/services/execution/ai_repair_proposer.py` | **New** — `ask_ai_for_repair_proposal()` function |
| `backend/tests/test_ai_repair_proposer.py` | **New** — unit tests covering every scope |

## 5. Proposed helper function name and location

**Location:** `backend/services/execution/ai_repair_proposer.py`

**Function:**
```python
async def ask_ai_for_repair_proposal(
    repair_plan: RepairPlan,
    spec: StrategySpec,
    classification: FailureClassification,
    settings_dir: str,
) -> dict[str, Any] | None:
```

Takes the `RepairPlan` (already validated by Task 8), the current `StrategySpec`, the `FailureClassification` (for prompt context), and a path to settings (for `create_ollama_client_from_settings`). Returns a JSON dict or `None` on failure.

## 6. Repair proposal JSON shape

AI response is constrained to a single JSON object with `format="json"`. Per-scope shapes:

**stoploss:**
```json
{
  "repair_scope": "stoploss",
  "change": {"stoploss": -0.12},
  "reasoning": "Tightening stoploss from -0.10 to -0.12 to reduce drawdown."
}
```

**entry_logic:**
```json
{
  "repair_scope": "entry_logic",
  "change": {"index": 0, "field": "operator", "new_value": "crosses_above"},
  "reasoning": "Changing first entry condition operator to crosses_above for stricter entry."
}
```

**exit_logic:**
```json
{
  "repair_scope": "exit_logic",
  "change": {"index": 0, "field": "value_or_indicator_b", "new_value": 70},
  "reasoning": "Raising exit threshold from 50 to 70 to let winners run longer."
}
```

**entry_parameter:**
```json
{
  "repair_scope": "entry_parameter",
  "change": {"indicator": "rsi", "parameter": "period", "new_value": 10},
  "reasoning": "Lowering RSI period from 14 to 10 to generate more signals."
}
```

**roi:**
```json
{
  "repair_scope": "roi",
  "change": {"action": "modify", "index": 1, "minutes": 60, "ratio": 0.05},
  "reasoning": "Reducing second ROI tier from 0.08 to 0.05 to exit sooner."
}
```

**position_sizing:**
```json
{
  "repair_scope": "position_sizing",
  "change": {"field": "max_open_trades", "new_value": 5},
  "reasoning": "Increasing max_open_trades from 3 to 5 for better capital utilization."
}
```

All shapes share three fixed keys: `repair_scope` (string matching `RepairScope`), `change` (one-field-only object), `reasoning` (string, max 200 chars).

## 7. Prompt constraints

- System prompt instructs **JSON-only output** (use `format="json"` on Ollama).
- Must include `repair_scope` exactly matching the `RepairPlan.scope`.
- Must include exactly one key inside `change`.
- Must include a brief `reasoning` field (max 200 characters).
- Must not reference backtest results or future performance.
- Must not suggest changing anything outside the given scope.
- Must not propose multiple changes in one response.
- Prompt includes the current `StrategySpec` serialized (relevant fields only: stoploss, roi, entry_conditions, exit_conditions, indicators, etc.), the `RepairPlan.reason` for context, and the `FailureClassification.primary_class` and `Failed_metrics`.

## 8. Validation rules (post-AI, before accepting proposal)

1. **Parse**: `clean_json_response()` then `json.loads()`.
2. **Scope check**: `proposal["repair_scope"]` must match `RepairPlan.scope`.
3. **Single change**: `proposal["change"]` must have exactly 1 key.
4. **No backtest claims**: `proposal["reasoning"]` must not contain words like "profitable", "backtest", "sharpe", "win rate", "drawdown", "returns".
5. **Range constraints per scope**:
   - `stoploss`: new value in `[-0.50, -0.01]`.
   - `entry_parameter`: `period` must be int 2-200, `threshold` must be float 0-100.
   - `roi`: `ratio` must be float ≥ 0.0, `minutes` must be int ≥ 0.
   - `position_sizing`: `max_open_trades` must be int 1-50.
6. **Schema validation**: `repair_scope` is string, `reasoning` is string ≤ 200 chars, `change` is dict with 1 key.
7. **Reject & return None** if any validation fails. Log warning with reason.

## 9. Error behavior

| Scenario | Behavior |
|----------|----------|
| AI returns None / empty | Return None, log warning |
| JSON parse fails | Return None, log warning |
| `repair_scope` mismatch | Return None, log "scope mismatch" |
| `change` has 0 or 2+ keys | Return None, log "expected 1 change" |
| Value out of range | Return None, log "value out of range" |
| Reasoning contains banned words | Return None, log "backtest claim detected" |
| Circuit breaker open | Return None immediately (no call) |
| Health check fails | Return None, record failure on circuit breaker |
| `can_repair` is False | Return None immediately (no call) |

## 10. Tests needed

Create `backend/tests/test_ai_repair_proposer.py`:

| Test | What it covers |
|------|---------------|
| `test_can_repair_false_skips_ai` | `RepairPlan(can_repair=False)` → returns None without calling Ollama |
| `test_stoploss_proposal_accepted` | Valid stoploss proposal passes validation |
| `test_entry_logic_proposal_accepted` | Valid entry_logic change passes validation |
| `test_exit_logic_proposal_accepted` | Valid exit_logic change passes validation |
| `test_entry_parameter_proposal_accepted` | Valid entry_parameter change passes validation |
| `test_roi_proposal_accepted` | Valid roi change passes validation |
| `test_position_sizing_proposal_accepted` | Valid position_sizing change passes validation |
| `test_scope_mismatch_rejected` | `repair_scope != RepairPlan.scope` → rejected |
| `test_multiple_changes_rejected` | `change` with 2+ keys → rejected |
| `test_backtest_claim_rejected` | Reasoning containing "profitable" → rejected |
| `test_stoploss_out_of_range_rejected` | stoploss = -0.60 → rejected |
| `test_json_parse_failure` | Garbled AI response → rejected |
| `test_empty_ai_response` | AI returns None → returns None |
| `test_entry_parameter_period_too_low` | period = 1 → rejected |
| `test_roi_negative_minutes` | minutes = -1 → rejected |

## 11. What not to touch

- Do not call `build_repair_plan()` — the plan is already built.
- Do not modify `repair_plan_gate.py`, `failure_analyzer.py`, `backtest_gate.py`, `backtest_runner.py`.
- Do not modify `StrategySpec` or `strategy_spec.py`.
- Do not modify `OllamaClient` or `ollama_service.py` (reuse existing methods).
- Do not modify `backend/models/contracts.py`.
- Do not create API endpoints.
- Do not modify frontend.
- Do not modify pipeline files (`backend/services/auto_quant/pipeline_modules/`).
- Do not execute repairs — proposals are for review only.
- Do not call any backtest or validation engine.

## 12. First implementation task only

1. Create `backend/services/execution/ai_repair_proposer.py` with:
   - `ask_ai_for_repair_proposal()` async function
   - Prompt builder per scope (builds system + user prompt from `RepairPlan`, `StrategySpec`, `FailureClassification`)
   - Post-AI validation (scope match, single change, range constraints, backtest-claim ban)
   - Error handling (circuit breaker skip, health check, parse failure, validation rejection)
   - Returns `dict` (proposal JSON) or `None`

2. Create `backend/tests/test_ai_repair_proposer.py` with tests from §10.

3. Run: `.venv/bin/pytest backend/tests/test_ai_repair_proposer.py -xvs`
