# Hermes Integration Plan

## Summary of Gaps Identified

1. **Frontend API client**: `api.autoquant.generateStrategySpec` is missing from `frontend/src/services/api.js`
2. **Hermes UI integration**: AutoQuantConfigPanel uses direct fetch instead of API client; doesn't pass spec to candidate workflow on Confirm
3. **Simple Mode spec**: `buildStrategySpecFromSimpleMode` omits `direction` field in returned spec
4. **Template direction support**: Only `enter_long` implemented; no `can_short`, `enter_short`, `exit_short`
5. **Strategy renderer**: `render_strategy_from_spec` ignores most spec fields (timeframe partially applied, but not direction, stoploss, roi, trailing, indicators, conditions)
6. **Missing tests**: No coverage for Hermes spec generation flow, direction handling, or candidate workflow integration

## Implementation Tasks

### Task 1: Add `generateStrategySpec` to frontend API client
- Add method to `frontend/src/services/api.js` in the `autoquant` namespace
- Add wrapper to `frontend/src/features/autoquant/api.js`
- File: `frontend/src/services/api.js:68` (after `generateTemplate`)

### Task 2: Refactor AutoQuantConfigPanel to use API client and candidate workflow
- Replace direct fetch in `handleGenerateStrategySpec` with `api.autoquant.generateStrategySpec`
- Modify `handleConfirmAndStart` to pass the Hermes-generated spec to `api.candidate.startRun`
- Need to build a `CandidateConfig` from form values and the generated spec
- File: `frontend/src/features/autoquant/components/AutoQuantConfigPanel.jsx:259-315`

### Task 3: Add `direction` to Simple Mode spec generation
- `buildStrategySpecFromSimpleMode` in `StrategyLabTab.jsx:260-282` needs to include `direction` field
- Update validation error message to distinguish short vs both directions (both could work if templates support it)
- File: `frontend/src/components/StrategyLabTab.jsx:260-282`

### Task 4: Implement short/both direction in strategy templates
- Update `generate_strategy_source_momentum`, `generate_strategy_source_adaptive`, `generate_strategy_source_ensemble`, `generate_strategy_source_omni`
- Add `can_short = True` and `enter_short`/`exit_short` column assignments
- File: `backend/services/auto_quant/generator.py`

### Task 5: Enhance `render_strategy_from_spec` to apply spec fields
- Apply `timeframe` (already partially done for omni, extend to all templates)
- Apply `stoploss` value replacement
- Apply `roi` replacements
- Apply `trailing` stop settings
- Apply `direction` to generate appropriate entry columns (`enter_long`, `enter_short` for both)
- For indicators and conditions in spec, use them if template supports, otherwise warn
- File: `backend/services/strategy/strategy_code_writer.py:23-182`

### Task 6: Add tests
- Test `api.autoquant.generateStrategySpec` endpoint call
- Test Hermes spec generation and candidate run start from UI
- Test `buildStrategySpecFromSimpleMode` includes direction
- Test `render_strategy_from_spec` respects direction field
- Test short direction is rejected if unsupported by current templates
- Test `/api/candidate/runs` can run from generated spec
- Files: `frontend/src/features/autoquant/api.integration.test.jsx`, `backend/tests/test_strategy_code_writer.py`

## Decisions

### Direction Support Strategy
- **Short**: Mark with error warning in Simple Mode since templates don't support it yet (per existing check at line 320-322)
- **Both**: Could generate both `enter_long` and `enter_short` with inverted entry conditions, but requires template changes
- For now: Hide short/both options in UI or show warning that only long is supported

### Hermes → Candidate Integration
Two options considered:
1. **Option A**: Generate strategy file via template endpoint, then start AutoQuant pipeline (current approach in `handleConfirmAndStart`)
2. **Option B**: Pass spec directly to candidate workflow which handles rendering internally

**Recommended**: Option A is simpler and aligns with existing AutoQuant flow. The generated spec is used to create an Omni strategy file, then AutoQuant pipeline runs.

### Spec Field Application Priority
1. `direction` - Determines entry columns (`enter_long` vs `enter_short` vs both)
2. `timeframe` - Affects ROI/stoploss calibration and template variable
3. `stoploss` - Direct value replacement in template
4. `roi` - ROI table replacement in template
5. `trailing` - Trailing stop configuration
6. `indicators` + `entry_conditions` + `exit_conditions` - Only for custom spec, not template-generated

## Validation Approach

1. Run existing tests: `npm test frontend/src/features/autoquant/api.integration.test.jsx` and `pytest backend/tests/test_strategy_code_writer.py`
2. Add new tests alongside code changes
3. Verify lint passes: Check project for lint commands in package.json or AGENTS.md