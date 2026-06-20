# tasks3.md — Template-Based Code Writer

## 1. Goal

Create a deterministic backend helper that converts a validated `StrategySpec` into Freqtrade strategy source code using existing templates or safe backend rendering. AI must not freely write strategy code.

## 2. Why this task comes next

Tasks 2A–2D now produce a ready, validated, non-duplicate `StrategySpec`. Task 3 turns that structured design into code while preserving the core rule: AI suggests, backend validates, backend renders safely, then later Freqtrade tests.

## 3. Existing files to reuse

| File | What it provides |
|------|-----------------|
| `backend/models/strategy_spec.py` | `StrategySpec`, `validate_spec(...)`, allowed fields |
| `backend/services/auto_quant/generator.py` | Existing deterministic strategy templates |
| `backend/validators/strategy_validator.py` | `StrategyValidator.validate_code(...)` |
| `backend/services/strategy/strategy_spec_flow.py` | Ready `StrategySpec` flow output |
| `backend/tests/test_strategy_spec_flow.py` | Test patterns for ready specs |

## 4. Files likely to change

| File | Change |
|------|--------|
| `backend/services/strategy/strategy_code_writer.py` | New helper module for spec-to-source rendering |
| `backend/tests/test_strategy_code_writer.py` | New tests for mapping, rendering, and validation |

## 5. Proposed helper function name and location

Location:
`backend/services/strategy/strategy_code_writer.py`

Function:
```python
def render_strategy_from_spec(spec: StrategySpec) -> dict:
```

## 6. How StrategySpec maps to template/code

Use deterministic template selection:

- `trading_style == "momentum"` → `generate_strategy_source_momentum(...)`
- `trading_style == "adaptive"` → `generate_strategy_source_adaptive(...)`
- `trading_style == "ensemble"` → `generate_strategy_source_ensemble(...)`
- `trading_style in {"trend_following", "mean_reversion", "breakout"}` → `generate_strategy_source_omni(...)`

Apply safe substitutions only after template generation:
- strategy class name from `spec.name`
- timeframe from `spec.timeframe` where template supports it
- ROI, stoploss, and trailing values from spec only if substitution can be done deterministically and safely

Do not ask AI to write or patch Python code.

## 7. Code validation step

After rendering:

1. Run `StrategyValidator().validate_code(source)`.
2. Run Python syntax validation with `py_compile` on a temporary `.py` file.
3. Return errors if either validation fails.
4. Return source only when validation passes.

Return shape:
```python
{
    "source": str | None,
    "errors": list[str],
    "warnings": list[str],
    "template": str | None,
}
```

## 8. Tests needed

Create `backend/tests/test_strategy_code_writer.py`:

1. `test_render_momentum_spec` — momentum spec selects momentum template.
2. `test_render_adaptive_spec` — adaptive spec selects adaptive template.
3. `test_render_ensemble_spec` — ensemble spec selects ensemble template.
4. `test_render_mean_reversion_spec_uses_omni` — mean reversion uses omni template.
5. `test_render_applies_class_name` — source contains `class {spec.name}`.
6. `test_render_applies_timeframe_when_supported` — source contains expected timeframe.
7. `test_render_validates_code` — returned source passes validator and syntax compile.
8. `test_render_invalid_spec_returns_errors` — invalid spec does not render source.

Run:
`.venv/bin/pytest backend/tests/test_strategy_spec.py backend/tests/test_strategy_code_writer.py -xvs`

## 9. What not to touch

- Do not modify frontend.
- Do not modify pipeline files.
- Do not create API endpoints.
- Do not touch Ollama files.
- Do not run backtests.
- Do not write generated strategies to `user_data/`.
- Do not let AI generate Python code.

## 10. First implementation task only

Create `backend/services/strategy/strategy_code_writer.py` and `backend/tests/test_strategy_code_writer.py`.

Implement only `render_strategy_from_spec(spec)`. It should return source in memory and validation results. Do not save files, register strategies, start AutoQuant, or call Freqtrade.

================================================================================

## Validation Review — 2026-06-15 17:52

### Overall Status

Status: PASS

Short summary:
- All 8 specified requirements are implemented and connected.
- All 8 specified tests are present (plus 8 additional edge-case tests).
- 16/16 tests pass.
- No AI-generated Python code; purely deterministic template rendering.
- No disallowed files were touched.

### Task Requirements Checked

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Create `backend/services/strategy/strategy_code_writer.py` with `render_strategy_from_spec(spec)` | PASS | `strategy_code_writer.py:19` | Function signature matches spec |
| Template mapping (momentum/adaptive/ensemble/omni) | PASS | `strategy_code_writer.py:46-53` | All 6 trading_styles map correctly |
| Safe substitutions (class name, timeframe) | PASS | `strategy_code_writer.py:68-103` | Class name via template arg, timeframe via replacement |
| ROI/stoploss/trailing not applied (warnings only) | PASS | `strategy_code_writer.py:108-121` | Warnings emitted for unapplied fields |
| No AI-generated Python code | PASS | — | No AI calls in the module |
| Code validation via StrategyValidator | PASS | `strategy_code_writer.py:124-138` | Validates + filters v2/v3 method mismatch |
| Python syntax validation via py_compile | PASS | `strategy_code_writer.py:144-162` | Temp file compile with cleanup |
| Return shape matches spec | PASS | `strategy_code_writer.py:173-178` | `{source, errors, warnings, template}` |
| Do not modify frontend/pipeline/Ollama/user_data | PASS | — | No changes outside `services/strategy/` and `tests/` |

### Files Reviewed

Connected to task:
- `backend/services/strategy/strategy_code_writer.py` — main implementation
- `backend/tests/test_strategy_code_writer.py` — 16 tests

Possibly connected:
- `backend/services/auto_quant/generator.py` — template generators used as dependencies
- `backend/validators/strategy_validator.py` — code validation dependency

Unrelated changed files:
- (none — all untracked files are related to this task chain)

### Tests / Commands Run

| Command | Result | Notes |
|---|---|---|
| `.venv/bin/pytest backend/tests/test_strategy_code_writer.py -xvs` | PASS (16/16) | All task-specified tests pass |

### What Is Working

- All 6 trading_styles map to correct templates
- Class name injected into generated source
- Timeframe substituted for all 4 template types (momentum, adaptive, ensemble, omni)
- Spec validation gates rendering (invalid specs return errors without source)
- Rendered code passes both `StrategyValidator` and `py_compile` syntax check
- v3 method names (`populate_entry_trend`/`populate_exit_trend`) handled without false v2 errors
- Warnings emitted for unapplied spec fields (ROI, stoploss, trailing, indicators, conditions, position sizing)
- No files saved, no AI calls, no pipeline touched

### What Did Not Work

- Nothing — all tests pass and implementation is complete

### Errors Found

- None

### Gaps / Missing Work

- ROI, stoploss, trailing, and position_sizing values from spec are not applied to generated source (by design — warnings only). This is correct per §6 ("only if substitution can be done deterministically and safely").

### Risk Notes

- The timeframe substitution for non-omni templates relies on an exact string match (`timeframe = "5m"`). If a template changes its default timeframe, the substitution silently falls through to a warning instead of failing.
- v3 method compatibility filter masks `populate_buy_trend`/`populate_sell_trend` errors when v3 methods exist. This is safe but depends on source string inspection.

### Recommended Next Steps

1. Wire `render_strategy_from_spec` into an API endpoint so the frontend can trigger strategy generation
2. Add deterministic substitution for ROI, stoploss, trailing, and position_sizing fields in generated source
3. Move from warning-only to actual applied substitution for spec fields as template support grows

### Final Decision

Decision: ACCEPT

Reason:
- All task requirements are implemented and tested.
- All tests pass.
- No disallowed modifications.
- The implementation is purely backend, deterministic, and safely isolated.
