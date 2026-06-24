# Hermes Integration Smoke Test Report

**Date:** 2026-06-24  
**Model:** hermes3:3b  
**Test Plan:** /home/mohs/.windsurf/plans/hermes-smoke-test-plan-112fd5.md

## Executive Summary

The Hermes Strategy Designer integration smoke test revealed a critical limitation with the `hermes3:3b` model: it consistently truncates JSON responses mid-generation, making it unsuitable for generating complete StrategySpec objects.

## Test Results

### ✅ Completed Tasks

1. **Prompt Enhancement** - Updated `backend/services/auto_quant/prompts/strategy_designer.md` with:
   - Explicit requirements for non-empty indicators, entry_conditions, and exit_conditions arrays
   - Correct indicator parameter names for each indicator type
   - Simplified template structure to guide the AI

2. **Post-Processing Layer** - Added `_fix_common_spec_errors()` function in `backend/services/auto_quant/strategy_designer.py` to:
   - Fix empty indicators array (adds default RSI indicator)
   - Fix empty entry_conditions array (adds default RSI threshold condition)
   - Fix empty exit_conditions array (adds default RSI threshold condition)
   - Fix invalid position_sizing.method (changes "balanced" to "fixed")
   - Fix invalid stoploss (must be negative)
   - Add missing required fields with sensible defaults

3. **JSON Recovery Logic** - Enhanced JSON parsing to handle truncated responses by:
   - Counting braces to find the last complete JSON object
   - Truncating at the last complete closing brace
   - Providing detailed error messages for debugging

### ❌ Critical Issue: Model Truncation

**Problem:** The hermes3:3b model consistently truncates JSON responses mid-generation, even with:
- Simplified prompts
- Post-processing corrections
- JSON recovery logic

**Evidence:**
```
Raw response: {
  "name": "test_smoke_test_strategy",
  "description": "Test smoke test strategy",
  "timeframe": "5m",
  "trading_style": "swing",
  "direction": "long",
  "indicators": [
    {"name": "rsi", "params": {"period": 14}}
  ],
  "entry_conditions": [
    {
      "type": "indicator_threshold",
      "indicator_a": "rsi",
      "operator": "<",
      "value_or_indicator_b": 30
    }
  ],
  "exit_conditions": [
    {
      "type": "indicator_threshold",
      "indicator  <-- TRUNCATED HERE
```

**Root Cause:** The 3B parameter model has limited output token capacity and cannot reliably generate complete JSON objects for the StrategySpec structure (~500-800 tokens required).

## Recommendations

### Immediate Actions

1. **Switch to a Larger Model** - Use a model with at least 7B parameters for StrategySpec generation:
   - `hermes3:7b` (if available)
   - `llama3:8b`
   - `mistral:7b`
   - Or any model with proven JSON generation capabilities

2. **Update Configuration** - Modify `user_data/strategy_lab_settings.json`:
   ```json
   {
     "ollama_model_strategylab": "hermes3:7b",
     "ollama_timeout": 120
   }
   ```

### Alternative Approaches

If a larger model is not available:

1. **Incremental Generation** - Generate the spec in parts:
   - First call: Generate indicators only
   - Second call: Generate entry_conditions using indicators
   - Third call: Generate exit_conditions using indicators
   - Combine results in post-processing

2. **Template-Based Approach** - Use a simpler template-based generation:
   - Pre-define valid indicator combinations
   - AI only selects from predefined options
   - Reduces output complexity

3. **Fine-Tuning** - Fine-tune a model specifically for StrategySpec generation with:
   - Training data of valid StrategySpec examples
   - Reinforcement learning for JSON completeness
   - Output token limit optimization

## Code Changes Summary

### Files Modified

1. **backend/services/auto_quant/prompts/strategy_designer.md**
   - Added mandatory rules section
   - Simplified template structure
   - Added indicator parameter documentation

2. **backend/services/auto_quant/strategy_designer.py**
   - Added `_fix_common_spec_errors()` function
   - Enhanced JSON recovery logic with brace counting
   - Improved error reporting with detailed messages

3. **test_hermes_smoke.py** (new file)
   - Comprehensive smoke test script
   - Tests endpoint, validation, code generation, and workflow

## Success Criteria Status

- [❌] Ollama hermes3:3b generates valid StrategySpec with non-empty conditions
- [❌] Backend endpoint returns valid spec without errors
- [❌] Spec validates successfully with all required fields
- [❌] render_strategy_from_spec generates valid Python strategy code
- [❌] Core StrategySpec fields are applied
- [❌] Candidate workflow accepts spec and executes all gates
- [❌] Run reaches backtest stage
- [❌] Final result provides clear pass/fail verdict with metrics

## Conclusion

The hermes3:3b model is **not suitable** for StrategySpec generation due to consistent JSON truncation. The post-processing layer and prompt improvements are valuable and should be retained, but a larger model is required for production use.

**Next Steps:**
1. Install or configure a larger model (7B+ parameters)
2. Re-run smoke tests with the new model
3. Validate end-to-end workflow with complete specs
