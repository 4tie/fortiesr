# Task 16: StrategySpec Auto Builder UI

## 1. Goal
Add a Simple Mode to `StrategyLabTab.jsx` that builds valid `StrategySpec` JSON from friendly inputs, while keeping the Advanced JSON editor available.

## 2. Why This Task Comes Next
Task 14 added the Strategy Lab UI and Task 15 added async/live Candidate progress. The remaining friction is input: users currently must hand-write full `StrategySpec` JSON before they can use the workflow.

Note: `tasks15.md` was not present in the repo during planning; current code/API inspection shows Candidate async run + WebSocket helpers already exist.

## 3. Existing Files To Reuse
- `frontend/src/components/StrategyLabTab.jsx`: current StrategySpec/CandidateConfig editors, submit flow, live progress UI.
- `frontend/src/services/api.js`: existing `candidate.startRun`, `candidate.getRun`, websocket URL helpers.
- `backend/models/strategy_spec.py`: source of valid fields, enums, timeframes, validation rules.
- `backend/services/auto_quant/strategy_designer.py`: reference only; do not call Ollama for Simple Mode.
- `backend/services/strategy/strategy_code_writer.py`: confirms supported styles and that custom conditions are validated but template-rendering mostly ignores them.

## 4. Files Likely To Change
- `frontend/src/components/StrategyLabTab.jsx`
- `frontend/src/components/StrategyLabTab.test.jsx`

No backend or API changes should be required.

## 5. Simple Mode Fields
- Strategy name: class-style name, starts with a letter, letters/numbers/underscore only.
- Trading style: `trend_following`, `mean_reversion`, `momentum`, `breakout`.
- Direction: default `long`; show validation warning for `short` or `both` because `StrategySpec` has no direction field and forbids extras.
- Risk profile: `conservative`, `balanced`, `aggressive`.
- Timeframe: one of `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`.
- Max iterations: integer `1..10`.
- Pairs / pair universe: comma/newline list used to update `CandidateConfig.pairs`, not `StrategySpec`.

## 6. Preset Mapping Rules
- `trend_following`: indicators `adx`, `rsi`; entry `adx > threshold`; exit `rsi > threshold`.
- `mean_reversion`: indicators `rsi`, `bbands`; entry `rsi < threshold`; exit `rsi > threshold`.
- `momentum`: indicators `macd`, `rsi`; entry `macd > 0`; exit `rsi > threshold`.
- `breakout`: indicators `adx`, `atr`, `rsi`; entry `adx > threshold`; exit `rsi > threshold`.

Risk profile:
- Conservative: stoploss `-0.05`, max open trades `2`, stricter entry thresholds, max iterations capped near `2`.
- Balanced: stoploss `-0.10`, max open trades `3`, default thresholds, user max iterations.
- Aggressive: stoploss `-0.15`, max open trades `5`, looser entry thresholds, user max iterations capped at `5` unless lower.

## 7. StrategySpec Generation Rules
- Build JSON deterministically in the frontend; no AI call.
- Do not add fields not defined by `StrategySpec`.
- `description` should include friendly choices like style/risk/direction because `direction` is not a model field.
- Every `indicator_a` and string `value_or_indicator_b` must exactly match an indicator `name`.
- Avoid `ema_fast` / `ema_slow` references for now. Current validator only sees declared indicator names such as `ema_cross`.
- Prefer `indicator_threshold` conditions with numeric thresholds to avoid unsupported internal indicator aliases.
- Keep `iteration_count: 0`, `parent_spec_hash: ""`, `position_sizing.method: "fixed"`, and `trailing.trailing_stop: false`.
- Keep Advanced JSON editable and use it as the final payload when Advanced Mode is active.
- Simple Mode should generate both preview JSON and the submitted JSON when Simple Mode is active.

## 8. Validation Rules
- Frontend validation before submit:
  - valid strategy name regex
  - valid timeframe
  - max iterations `1..10`
  - at least one clean pair
  - direction must be `long` for now
  - generated indicators and conditions are non-empty
  - no unknown indicator references in conditions
- Backend validation remains authoritative via `/api/candidate/runs`.
- Show frontend errors without starting a run.

## 9. Tests Needed
- Simple Mode renders required fields and Preview JSON.
- Each preset generates valid-looking JSON with no `ema_fast`/`ema_slow` references.
- Risk profile changes stoploss, max_open_trades, max_iterations, and thresholds.
- Reset to preset restores the selected preset defaults.
- Advanced JSON editor remains available and still submits manually edited JSON.
- Frontend validation blocks invalid name, invalid max iterations, empty pairs, and unsupported direction.
- Start Evaluation in Simple Mode calls `api.candidate.startRun` with generated spec and config pairs.
- Existing WebSocket/live progress tests still pass.

## 10. What Not To Touch
- Do not modify backend.
- Do not modify AutoQuant pipeline files.
- Do not call Ollama or `generate_strategy_spec()`.
- Do not run backtests.
- Do not enable live trading.
- Do not remove Advanced JSON mode.
- Do not add `direction` to backend `StrategySpec` in this task.

## 11. First Implementation Task Only
In `StrategyLabTab.jsx`, add a small deterministic preset builder:
- preset constants
- Simple/Advanced mode toggle
- Simple Mode form state
- `buildStrategySpecFromSimpleMode(form)` helper
- Preview JSON rendering
- Reset to preset button

Then update `StrategyLabTab.test.jsx` only for the builder/UI basics. Leave backend, API routes, AutoQuant, and live-progress code unchanged.
