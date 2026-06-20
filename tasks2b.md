# Task 2B Plan: Strategy Designer Prompt And Helper

## Summary
Implement a backend-only Strategy Designer helper that uses an injected existing `OllamaClient` to request a `StrategySpec` JSON, cleans/parses the response, constructs `StrategySpec`, validates it with `validate_spec`, and returns a simple dict. No frontend, pipeline, endpoint, code generation, backtest, `user_data`, or new AI-client changes.

## Key Changes
- Create `backend/services/auto_quant/prompts/strategy_designer.md`.
  - Prompt Ollama to return JSON only.
  - Include allowed StrategySpec fields, indicators, trading styles, timeframes, operators, and risk constraints.
  - Explicitly forbid markdown, prose, strategy code, profitability claims, and backtest assumptions.

- Create `backend/services/auto_quant/strategy_designer.py`.
  - Add async helper:
    `generate_strategy_spec(client, *, trading_style, timeframe, direction=None, risk_profile=None, name=None, description=None)`.
  - Load the prompt file with `Path(__file__).parent / "prompts" / "strategy_designer.md"`.
  - Build a user prompt from provided inputs.
  - Call `await client.generate(user_prompt, system_prompt=prompt_text, feature="strategy_designer")`.
  - Clean with `clean_json_response` from `ollama_service.py`.
  - Parse with `json.loads`.
  - Construct `StrategySpec`.
  - Run `validate_spec`.
  - Return exactly:
    `{"spec": spec_or_none, "errors": errors, "raw_response": raw_response}`.

## Error Behavior
- Empty response: `{"spec": None, "errors": ["EMPTY_OLLAMA_RESPONSE"], "raw_response": raw_response}`.
- Invalid JSON: `errors=["INVALID_JSON"]`.
- Pydantic validation failure: `errors=["INVALID_STRATEGY_SPEC_SCHEMA"]`.
- Deterministic validation failure: return the `validate_spec` errors.
- Valid spec: return the `StrategySpec` instance with `errors=[]`.

## Tests
- Create `backend/tests/test_strategy_designer.py` with a mocked Ollama client.
- Cover:
  - valid JSON works
  - markdown-wrapped JSON works
  - invalid JSON returns `INVALID_JSON`
  - schema-invalid JSON returns `INVALID_STRATEGY_SPEC_SCHEMA`
  - valid schema but invalid spec returns validator errors
  - helper passes `feature="strategy_designer"`

## Verification
Run:
`.venv/bin/pytest backend/tests/test_strategy_spec.py backend/tests/test_strategy_designer.py -xvs`

Expected result:
- Existing StrategySpec tests pass.
- New Strategy Designer tests pass.

================================================================================

## Validation Review — 2026-06-15 17:26

### Overall Status

Status: PASS

Short summary:
- Prompt file created at `backend/services/auto_quant/prompts/strategy_designer.md` (28 lines, all constraints specified).
- `generate_strategy_spec(...)` implemented with correct error handling for all 5 cases.
- All 6 required tests present and passing.
- No disallowed files modified.

### Task Requirements Checked

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Create `backend/services/auto_quant/prompts/strategy_designer.md` | PASS | `prompts/strategy_designer.md` | 28 lines, forbids markdown/prose/code/profitability claims |
| Create `backend/services/auto_quant/strategy_designer.py` | PASS | `strategy_designer.py` | Module exists |
| `generate_strategy_spec(client, *, trading_style, timeframe, direction, risk_profile, name, description)` | PASS | `strategy_designer.py:18` | Async function with correct params |
| Load prompt file via `Path(__file__).parent / "prompts" / "strategy_designer.md"` | PASS | `strategy_designer.py:15` | Correct path resolution |
| Build user prompt from inputs | PASS | `strategy_designer.py:68-91` | `_build_user_prompt()` includes all provided inputs |
| Call `client.generate()` with `feature="strategy_designer"` | PASS | `strategy_designer.py:39-43` | `feature="strategy_designer"` passed |
| Clean with `clean_json_response` | PASS | `strategy_designer.py:47` | Uses imported `clean_json_response` |
| Parse with `json.loads` | PASS | `strategy_designer.py:49` | Handles `json.JSONDecodeError` |
| Construct `StrategySpec` via Pydantic | PASS | `strategy_designer.py:57` | Catches `ValidationError`, `TypeError`, `ValueError` |
| Run `validate_spec` | PASS | `strategy_designer.py:61` | Returns spec only if validation passes |
| Return shape `{"spec": ..., "errors": ..., "raw_response": ...}` | PASS | `strategy_designer.py:45,51,59,63,65` | All paths return correct shape |
| Empty response → `EMPTY_OLLAMA_RESPONSE` | PASS | `strategy_designer.py:45` | Early return for falsy response |
| Invalid JSON → `INVALID_JSON` | PASS | `strategy_designer.py:51` | json.JSONDecodeError caught |
| Pydantic validation failure → `INVALID_STRATEGY_SPEC_SCHEMA` | PASS | `strategy_designer.py:59` | Pydantic `ValidationError` caught |
| Deterministic validation failure → returns validate_spec errors | PASS | `strategy_designer.py:63` | Returns spec-validation errors directly |
| Valid spec → `StrategySpec` instance with `errors=[]` | PASS | `strategy_designer.py:65` | Returns spec + empty errors |
| No frontend/pipeline/endpoint/Ollama changes | PASS | — | All changes confined to `services/auto_quant/` and `tests/` |

### Files Reviewed

Connected to task:
- `backend/services/auto_quant/prompts/strategy_designer.md` — system prompt for Ollama
- `backend/services/auto_quant/strategy_designer.py` — main implementation (91 lines)
- `backend/tests/test_strategy_designer.py` — 6 tests (135 lines)

Possibly connected:
- `backend/services/auto_quant/ollama_service.py` — `clean_json_response` dependency
- `backend/models/strategy_spec.py` — `StrategySpec` and `validate_spec` dependency

Unrelated changed files:
- (none)

### Tests / Commands Run

| Command | Result | Notes |
|---|---|---|
| `.venv/bin/pytest backend/tests/test_strategy_spec.py backend/tests/test_strategy_designer.py -xvs` | PASS (16/16) | 10 StrategySpec + 6 Designer tests all pass |

### What Is Working

- Valid JSON response → `StrategySpec` instance returned with no errors
- Markdown-wrapped JSON (```json ... ```) → correctly cleaned and parsed
- Invalid JSON string → `INVALID_JSON` error
- Schema-invalid payload (bad trading_style) → `INVALID_STRATEGY_SPEC_SCHEMA` error
- Valid schema but invalid spec (empty indicators) → validator errors returned
- `feature="strategy_designer"` passed to client.generate correctly
- Empty Ollama response → `EMPTY_OLLAMA_RESPONSE` error
- Non-dict JSON payload → `INVALID_STRATEGY_SPEC_SCHEMA` error

### What Did Not Work

- Nothing — all tests pass

### Errors Found

- None

### Gaps / Missing Work

- None within the stated scope. The designer is not wired to any API, pipeline, or frontend (by design).

### Risk Notes

- The prompt file (`strategy_designer.md`) is read at every call — no caching. This is acceptable but could be optimized.
- The `_AI_ERROR_CODES` set in `strategy_spec_flow.py` must stay in sync with the error codes defined here.
- The designer depends on `ollama_service.clean_json_response` — changes to that function could affect JSON parsing.

### Recommended Next Steps

1. Wire `generate_strategy_spec` into `strategy_spec_flow.py` (already done in Task 2D)
2. Add prompt caching for repeated calls
3. Add user-facing validation error display in the frontend

### Final Decision

Decision: ACCEPT

Reason:
- All requirements implemented and tested.
- All 5 error paths covered.
- Prompt follows all constraints (JSON-only, no code, no profitability claims).
- No disallowed modifications.
