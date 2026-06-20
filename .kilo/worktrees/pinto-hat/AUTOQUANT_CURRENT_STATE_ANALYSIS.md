# AutoQuant System Analysis - Current State
**Date:** 2026-06-14  
**Analysis Type:** Deep System Audit  
**Scope:** End-to-End Flow from User Input to Export

---

## A. Quick Summary (10 Lines)

AutoQuant is a 7-stage automated strategy optimization pipeline that takes user-configured trading parameters, runs backtests across multiple pairs, performs hyperparameter optimization, validates results with out-of-sample testing, stress tests across different market conditions, assesses risk metrics, and delivers a final strategy with a comprehensive report. The system uses a policy-driven configuration system that maps trading styles (scalping, intraday, swing, position) to appropriate timeframes and thresholds, supports multiple strategy generation templates (Omni, CatFactory, Adaptive, Ensemble, Momentum), and provides real-time WebSocket updates during pipeline execution. The backend is built on FastAPI with modular pipeline stages, while the frontend uses React with DaisyUI for the interface. The system currently has some configuration duplications between frontend and backend, and the pipeline stages have been recently refactored from a 7-stage model to a 5-stage model with some naming inconsistencies remaining in the codebase.

---

## B. End-to-End Flow Map

```
User Input (AutoQuantTab.jsx)
    ↓
Frontend Form State (trading_style, risk_profile, analysis_depth, strategy, etc.)
    ↓
POST /api/auto-quant/start (auto_quant.py)
    ↓
build_run_config() - Normalizes input using policy system (policy/__init__.py)
    ↓
PipelineState Creation (pipeline_modules/state.py)
    ↓
run_pipeline() - Main orchestrator (pipeline_modules/orchestrator.py)
    ↓
Stage 1: Pre-Flight Filtering (stages_validation.py)
    - Data healing (data_healer.py)
    - Baseline backtest on pair universe
    - Filter winning pairs using timeframe-specific thresholds
    - Select top N pairs (TOP_PAIRS_SELECTION_COUNT = 4)
    ↓
Stage 2: Portfolio Baseline Backtest (stages_validation.py)
    - Backtest on selected pairs
    - Establish baseline performance metrics
    ↓
Stage 3: WFA Hyperopt (stages_optimization.py)
    - Standard hyperopt OR Walk-Forward Optimization (WFO)
    - Parameter optimization using ProfitLockinHyperOptLoss
    - Extract best parameters
    ↓
Stage 4: Robustness & Feature Injection (stages_optimization.py)
    - Inject best parameters into strategy
    - Create optimized strategy variant
    ↓
Stage 5: Portfolio Competition (stages_validation.py)
    - Stress test on DEFAULT_STRESS_PAIRS
    - Multi-pair performance comparison
    ↓
Stage 6: Risk Assessment (stages_assessment.py)
    - Monte Carlo simulation
    - Sensitivity analysis
    - Compute final score using policy weights
    ↓
Stage 7: Delivery (stages_assessment.py)
    - Generate final report
    - Save strategy files
    - Export results
    ↓
WebSocket Updates → Frontend Display
    ↓
Final Report → User Export Options
```

---

## C. UI Options Table

| Option Name | Location in UI | Sent to Backend? | Used in Code | Real Impact | Basic/Advanced | Duplicates/Ambiguities |
|-------------|----------------|------------------|--------------|-------------|----------------|------------------------|
| **trading_style** | AutoQuantTab.jsx line 2307-2326 | Yes (form.trading_style) | policy/__init__.py line 263-267 | Selects timeframe list from timeframes/styles.json, affects thresholds | Basic | None - clear mapping |
| **risk_profile** | AutoQuantTab.jsx line 2329-2347 | Yes (form.risk_profile) | policy/__init__.py line 268-272 | Adjusts drawdown multiplier and profit factor delta | Basic | None - clear mapping |
| **analysis_depth** | AutoQuantTab.jsx line 2350-2368 | Yes (form.analysis_depth) | policy/__init__.py line 273-277 | Sets date ranges and hyperopt epochs (quick=30, standard=100, deep=150) | Basic | None - clear mapping |
| **strategy** | AutoQuantTab.jsx line 2382-2393 | Yes (form.strategy) | auto_quant.py line 186-192 | Strategy filename to run backtests on | Basic | None - required field |
| **template_type** | AutoQuantTab.jsx line 2395-2407 | Yes (templateType) | generator.py | Selects strategy generation template | Basic | None - clear mapping |
| **timeframe** | AutoQuantTab.jsx line 2474-2482 | Yes (form.timeframe) | policy/__init__.py line 282-296 | Candle timeframe for backtests, can be overridden by trading_style | Advanced | DUPLICATE: Also determined by trading_style, explicit selection takes precedence |
| **exchange** | AutoQuantTab.jsx line 2493-2506 | Yes (form.exchange) | policy/__init__.py line 353 | Exchange for data download (binance, bybit, kraken, kucoin, okx, gate) | Basic | None - clear mapping |
| **in_sample_range** | AutoQuantTab.jsx line 2509-2537 | Yes (form.in_sample_range) | policy/__init__.py line 351 | Date range for training/backtesting (YYYYMMDD-YYYYMMDD) | Advanced | DUPLICATE: Also set by analysis_depth, manual override takes precedence |
| **out_sample_range** | AutoQuantTab.jsx line 2540-2556 | Yes (form.out_sample_range) | policy/__init__.py line 352 | Date range for validation testing (never seen by hyperopt) | Advanced | DUPLICATE: Also set by analysis_depth, manual override takes precedence |
| **pair_universe** | AutoQuantTab.jsx line 2558-2590 | Yes (form.pair_universe) | policy/__init__.py line 301-308 | Custom list of pairs for multi-pair backtesting | Advanced | DUPLICATE: Also "pair" field exists for single-pair override, pair_universe is for multi-pair |
| **max_drawdown_threshold** | Advanced Settings | Yes (form.max_drawdown_threshold) | policy/__init__.py line 311-314 | Maximum allowed drawdown % | Advanced | DUPLICATE: Also set by risk_profile, manual override takes precedence |
| **min_win_rate** | Advanced Settings | Yes (form.min_win_rate) | policy/__init__.py line 315-318 | Minimum required win rate % | Advanced | DUPLICATE: Also set by risk_profile, manual override takes precedence |
| **min_profit_factor** | Advanced Settings | Yes (form.min_profit_factor) | policy/__init__.py line 319-321 | Minimum required profit factor | Advanced | DUPLICATE: Also set by risk_profile, manual override takes precedence |
| **min_sharpe** | Advanced Settings | Yes (form.min_sharpe) | policy/__init__.py line 322-324 | Minimum required Sharpe ratio | Advanced | None - only in advanced |
| **min_oos_profit** | Advanced Settings | Yes (form.min_oos_profit) | policy/__init__.py line 325-328 | Minimum required OOS total profit fraction | Advanced | DUPLICATE: Also set by trading_style/timeframe, manual override takes precedence |
| **monte_carlo_threshold** | Advanced Settings | Yes (form.monte_carlo_threshold) | policy/__init__.py line 329-332 | Max allowed Monte Carlo p95 drawdown | Advanced | None - only in advanced |
| **hyperopt_loss** | Advanced Settings | Yes (form.hyperopt_loss) | policy/__init__.py line 359 | Hyperopt loss function name | Advanced | None - only in advanced |
| **hyperopt_spaces** | Advanced Settings | Yes (form.hyperopt_spaces) | policy/__init__.py line 335-337 | Hyperopt search spaces (buy, stoploss, roi) | Advanced | None - only in advanced |
| **hyperopt_epochs** | Advanced Settings | Yes (form.hyperopt_epochs) | policy/__init__.py line 361-363 | Number of hyperopt epochs | Advanced | DUPLICATE: Also set by analysis_depth, manual override takes precedence |
| **wfo_enabled** | Advanced Settings | Yes (form.wfo_enabled) | policy/__init__.py line 364 | Enable Walk-Forward Optimization | Advanced | DUPLICATE: Also set by analysis_depth (deep enables WFO), manual override takes precedence |
| **wfo_is_months** | Advanced Settings | Yes (form.wfo_is_months) | policy/__init__.py line 365 | IS window size in months for WFO | Advanced | None - only in advanced |
| **wfo_oos_months** | Advanced Settings | Yes (form.wfo_oos_months) | policy/__init__.py line 366 | OOS window size in months for WFO | Advanced | None - only in advanced |
| **wfo_recency_weight** | Advanced Settings | Yes (form.wfo_recency_weight) | policy/__init__.py line 367 | Recency weight multiplier for WFO | Advanced | None - only in advanced |
| **ensemble_enabled** | Advanced Settings | Yes (form.ensemble_enabled) | policy/__init__.py line 368 | Enable Alpha Consensus Voting (ensemble) | Advanced | None - only in advanced |
| **pair** | Advanced Settings (hidden) | Yes (form.pair) | policy/__init__.py line 355 | Single-pair override for targeted backtesting | Advanced | DUPLICATE: Conflicts with pair_universe, pair takes precedence if set |
| **strategy_source** | Not visible in UI | Yes (form.strategy_source) | policy/__init__.py line 342 | Source mode: existing, uploaded, generated, template | Advanced | None - internal field |
| **uploaded_strategy_id** | Not visible in UI | Yes (form.uploaded_strategy_id) | policy/__init__.py line 346 | Uploaded/generated strategy identifier | Advanced | None - internal field |
| **advanced_overrides** | Not visible in UI | Yes (form.advanced_overrides) | policy/__init__.py line 262, 347 | Dictionary for advanced compatibility overrides | Advanced | None - internal field |

---

## D. Current Stages Table

| Stage Name (Frontend) | Stage Name (Backend) | What It Does | Inputs | Outputs | Issues/Mismatch |
|----------------------|---------------------|--------------|--------|---------|-----------------|
| **Sanity Backtest** | Pre-Flight Filtering | Data healing + baseline backtest on pair universe, filter winning pairs | strategy, timeframe, in_sample_range, pair_universe | selected_pairs (top 4), baseline metrics | NAME MISMATCH: Frontend says "Sanity Backtest", Backend says "Pre-Flight Filtering" |
| **Hyperopt Execution** | WFA Hyperopt | Parameter optimization using hyperopt or WFO | selected_pairs, hyperopt_spaces, hyperopt_epochs | best_params, optimized_strategy | NAME MISMATCH: Frontend says "Hyperopt Execution", Backend says "WFA Hyperopt" |
| **Auto-Patching** | Robustness & Feature Injection | Inject best parameters into strategy, create variant | best_params, original_strategy | optimized_strategy_path | NAME MISMATCH: Frontend says "Auto-Patching", Backend says "Robustness & Feature Injection" |
| **Out-of-Sample Validation** | Portfolio Competition | Stress test on DEFAULT_STRESS_PAIRS, multi-pair comparison | optimized_strategy, out_sample_range, stress_pairs | stress_test_results, per_pair_metrics | NAME MISMATCH: Frontend says "Out-of-Sample Validation", Backend says "Portfolio Competition" |
| **Multi-Pair Stress Test** | Risk Assessment | Monte Carlo simulation, sensitivity analysis, final scoring | stress_test_results, thresholds | monte_carlo_results, sensitivity_results, final_score | NAME MISMATCH: Frontend says "Multi-Pair Stress Test", Backend says "Risk Assessment" |
| **Risk Assessment** | Delivery | Generate final report, save files, export | all previous results, final_score | report.json, strategy files, HTML report | NAME MISMATCH: Frontend says "Risk Assessment", Backend says "Delivery" |
| **Delivery** | (None) | (This stage doesn't exist in new 5-stage model) | N/A | N/A | OBSOLETE: Frontend still shows 7 stages, backend now uses 5 stages |

**Critical Issue:** The frontend STAGE_NAMES array (AutoQuantTab.jsx line 19-27) still has 7 stages, but the backend config.py (line 74-80) now defines only 5 stages. This causes a mismatch in stage indexing and display.

---

## E. Current Scoring Logic

### Score Weights (from score_weights/robustness_v1.json)
```json
{
  "expectancy": 0.25,
  "profit_factor": 0.20,
  "drawdown": 0.15,
  "robustness": 0.15,
  "oos": 0.10,
  "walk_forward": 0.10,
  "pair_consistency": 0.05
}
```

### Scoring Formula (policy/__init__.py lines 190-239)
```python
def score_strategy(self, *, metrics, style, risk_profile, robustness_score, oos_score, walk_forward_score, pair_consistency_score):
    weights = self.score_weights.get("weights", {})
    gates = self.thresholds_for(style, risk_profile, "validation")
    
    # Extract metrics
    expectancy = metrics.get("expectancy", 0.0)
    profit_factor = metrics.get("profit_factor", 0.0)
    drawdown = metrics.get("max_drawdown_account", 0.0)
    trades = metrics.get("total_trades", 0)
    
    # Calculate component scores (0-100 scale)
    components = {
        "expectancy": _bounded_ratio(expectancy, min_expectancy),
        "profit_factor": _bounded_ratio(max(0.0, profit_factor - 1.0), max(0.01, min_pf - 1.0)),
        "drawdown": max(0.0, min(100.0, 100.0 * (1.0 - (drawdown / max(max_dd, 0.01)))),
        "robustness": _score_passthrough(robustness_score),
        "oos": _score_passthrough(oos_score),
        "walk_forward": _score_passthrough(walk_forward_score),
        "pair_consistency": _score_passthrough(pair_consistency_score),
        "trade_quality": min(100.0, trades / min_trades * 100.0),
    }
    
    # Weighted average
    weighted = sum(components[key] * weights[key] for key in weights)
    total_weight = sum(weights.values())
    overall = weighted / total_weight if total_weight else 0.0
    
    return {
        "overall": round(max(0.0, min(100.0, overall)), 2),
        "components": components,
        "status": label["status"],
        "readiness_label": label["readiness"],
        "explanation": _score_explanation(components),
    }
```

### Thresholds (from thresholds/swing.json)
```json
{
  "validation": {
    "min_profit_factor": 1.3,
    "max_drawdown": 30.0,
    "min_trades": 100,
    "min_expectancy": 0.0008,
    "min_win_rate": 48.0,
    "min_pair_pass_rate": 0.6,
    "min_oos_retention": 0.5
  },
  "elite_validation": {
    "min_profit_factor": 1.5,
    "max_drawdown": 25.0,
    "min_trades": 100,
    "min_expectancy": 0.001,
    "min_win_rate": 52.0,
    "min_pair_pass_rate": 0.7,
    "min_oos_retention": 0.6,
    "min_walk_forward_pass_rate": 0.6,
    "min_robustness_score": 0.7
  }
}
```

### Readiness Labels (from readiness_labels/v1.json)
```json
{
  "labels": [
    {"min_score": 85, "status": "Forward Test Ready", "readiness": "Live Candidate"},
    {"min_score": 70, "status": "Validated", "readiness": "Dry Run Recommended"},
    {"min_score": 50, "status": "Candidate", "readiness": "Candidate"},
    {"min_score": 0, "status": "Rejected", "readiness": "Not Ready"}
  ]
}
```

### Acceptance/Rejection Logic
- **Acceptance:** Overall score >= 50 AND all individual thresholds passed
- **Rejection Reasons:**
  - Overall score < 50
  - Profit factor < threshold
  - Drawdown > threshold
  - Win rate < threshold
  - OOS retention < threshold
  - Pair pass rate < threshold
  - Monte Carlo p95 drawdown > threshold
  - Insufficient trades (< 100)

---

## F. Problems and Gaps

### Critical Issues
1. **Stage Count Mismatch:** Frontend shows 7 stages (AutoQuantTab.jsx line 19-27), backend uses 5 stages (config.py line 74-80). This breaks stage indexing and progress display.
2. **Stage Name Mismatch:** Frontend stage names don't match backend stage names, causing confusion in logs and UI.
3. **Pair Universe vs Pair Confusion:** Two separate fields (`pair_universe` for multi-pair, `pair` for single-pair) can conflict, unclear which takes precedence.
4. **Missing Error Handling:** If strategy file doesn't exist, backend returns 404 but frontend doesn't handle this gracefully.
5. **WebSocket Reconnection Issues:** Exponential backoff is implemented but max attempts (5) may be too low for long-running pipelines.

### Important Issues
1. **Configuration Duplication:** Many options (timeframe, date ranges, thresholds, hyperopt_epochs, wfo_enabled) are set by both basic settings (trading_style, risk_profile, analysis_depth) and advanced overrides, with unclear precedence rules.
2. **Threshold Inconsistency:** Timeframe-specific thresholds in config.py (_TIMEFRAME_PROFILES) may conflict with style-specific thresholds in policy system.
3. **Missing Discovery Phase:** Code references `auto_discovery_enabled` and `run_discovery()` but this feature is not exposed in the UI.
4. **Incomplete WFO Support:** WFO is enabled for "deep" analysis depth but requires sufficient windows; if insufficient, it silently falls back to standard hyperopt without clear user notification.
5. **Monte Carlo Threshold Mismatch:** Config sets MONTE_CARLO_THRESHOLD = 0.20 (20%) but policy system defaults to 0.35 (35%).
6. **Missing Strategy Validation:** No validation that generated strategy files are syntactically correct before running backtests.

### Nice to Have
1. **Better User Guidance:** UI doesn't explain what each trading style/risk profile actually does to the configuration.
2. **Real-time Threshold Preview:** When user changes trading style, show what thresholds will be applied.
3. **Strategy Comparison:** No way to compare multiple runs side-by-side in the UI.
4. **Export Customization:** Limited export options (only CSV, PNG, HTML), missing JSON, PDF, or custom report formats.
5. **Pair Performance Visualization:** Per-pair results are available but not visualized in the main dashboard.
6. **Parameter History:** No tracking of which parameters were tried and rejected during hyperopt.
7. **Walk-Forward Visualization:** WFO windows are computed but not displayed to the user.
8. **Robustness Heatmap:** Sensitivity analysis results exist but are not visualized.

---

## G. Current System vs Strategy Factory Goal

### Strategy Factory Goal Components
1. **Strategy Templates** ✅ PRESENT
   - Omni-Strategy (Boolean Switches)
   - CatFactory (MACD/RSI/BB)
   - Adaptive Regime (ATR)
   - Ensemble (Weighted Voting)
   - Momentum (EMA + ATR)
   - Location: generator.py, AutoQuantTab.jsx line 2402-2406

2. **Rule Toggles** ⚠️ PARTIAL
   - Omni-Strategy has Boolean switches for entry/exit logic
   - No UI for toggling individual rules
   - Rules are hardcoded in generated templates

3. **Parameter Search** ✅ PRESENT
   - Hyperopt with configurable spaces (buy, stoploss, roi)
   - Walk-Forward Optimization support
   - ProfitLockinHyperOptLoss custom loss function
   - Location: stages_optimization.py

4. **Multi-Pair Testing** ✅ PRESENT
   - Pair universe selection (up to 50 pairs)
   - Top N pair selection (TOP_PAIRS_SELECTION_COUNT = 4)
   - Per-pair filtering and ranking
   - Location: stages_validation.py line 76-88

5. **OOS Validation** ✅ PRESENT
   - Separate out-of-sample date range
   - OOS isolation guard to prevent contamination
   - OOS retention threshold
   - Location: stages_validation.py, oos_guard.py

6. **Walk-Forward** ✅ PRESENT
   - WFO window generation
   - Configurable IS/OOS window sizes
   - Recency weighting
   - Location: config.py line 27-69, stages_optimization.py

7. **Robustness** ✅ PRESENT
   - Monte Carlo simulation
   - Sensitivity analysis
   - Parameter stability testing
   - Location: monte_carlo.py, sensitivity.py

8. **Confidence Score** ✅ PRESENT
   - Weighted scoring system
   - Readiness labels
   - Component breakdown
   - Location: policy/__init__.py line 190-239

9. **Full Export** ⚠️ PARTIAL
   - JSON report
   - HTML report
   - Strategy file download
   - CSV export
   - Missing: PDF, custom templates, parameter history

### What's Missing for Full Strategy Factory
1. **Interactive Rule Toggling:** No UI to enable/disable individual strategy rules
2. **Parameter Space Visualization:** No way to see what parameter ranges are being searched
3. **Live Hyperopt Monitoring:** Limited real-time visibility into hyperopt progress
4. **Strategy Versioning:** No tracking of strategy variants and their lineage
5. **A/B Testing:** No built-in capability to compare two strategies head-to-head
6. **Market Regime Detection:** Adaptive template has ATR-based regime detection but not exposed as a general feature
7. **Custom Loss Functions:** Limited to ProfitLockinHyperOptLoss, no UI for custom loss functions
8. **Parameter Importance:** No analysis of which parameters most affect performance
9. **Strategy Composition:** No way to combine multiple strategies into an ensemble
10. **Backtest Replay:** No way to replay specific trades or time periods

---

## H. Important Files and Functions

### Frontend Files
- **AutoQuantTab.jsx** (3600 lines)
  - Main AutoQuant interface component
  - Form state management
  - WebSocket connection handling
  - Stage display and progress tracking
  - Key functions: `handleStart()`, `connectWs()`, `handleGenerateTemplate()`

- **types/domain.js** (259 lines)
  - Domain type definitions
  - TradingStyle, RiskProfile, AnalysisDepth enums
  - Result classes (PairResult, TimeframeResult, BacktestResult, etc.)

- **features/autoquant/components/StrategyGenerator.jsx** (121 lines)
  - Strategy generation UI component
  - Template selection
  - Configuration for trading style, risk profile, exchange

- **features/autoquant/services/autoQuantAPI.js** (75 lines)
  - API service layer
  - Functions: generateStrategies(), uploadStrategy(), validateStrategy(), getThresholds()

### Backend Files
- **api/routers/auto_quant.py** (1077 lines)
  - FastAPI router for AutoQuant endpoints
  - Request/response models
  - Key endpoints: /start, /status, /report, /download, /ws
  - Key function: `_start_pipeline_from_body()`

- **services/auto_quant/policy/__init__.py** (468 lines)
  - Policy system single source of truth
  - Thresholds, score weights, timeframe mappings
  - Key functions: `load_policy()`, `build_run_config()`, `score_strategy()`

- **services/auto_quant/pipeline.py** (280 lines)
  - Pipeline facade
  - Exports pipeline functions for backward compatibility
  - Key functions: `run_pipeline()`, `create_run()`, `get_state()`

- **services/auto_quant/pipeline_modules/orchestrator.py** (478 lines)
  - Main pipeline orchestrator
  - Stage sequencing and error handling
  - Key function: `run_pipeline()`

- **services/auto_quant/pipeline_modules/stages_validation.py** (1042 lines)
  - Validation stage implementations
  - Pre-flight filtering, portfolio baseline, stress test
  - Key functions: `_stage_pre_flight_filtering()`, `_stage_portfolio_baseline()`, `_stage_stress_test()`

- **services/auto_quant/pipeline_modules/stages_optimization.py** (675 lines)
  - Optimization stage implementations
  - Hyperopt, WFO, parameter injection
  - Key functions: `_stage_hyperopt()`, `_stage_hyperopt_wfo()`, `_stage_patch()`

- **services/auto_quant/pipeline_modules/stages_assessment.py** (817 lines)
  - Assessment stage implementations
  - Risk assessment, Monte Carlo, delivery
  - Key functions: `_stage_risk_assessment()`, `_stage_delivery()`

- **services/auto_quant/generator.py** (705 lines)
  - Strategy template generators
  - Omni, CatFactory, Adaptive, Ensemble, Momentum templates
  - Key functions: `generate_strategy_source_omni()`, `generate_strategy_source_adaptive()`, etc.

- **services/auto_quant/pipeline_modules/config.py** (227 lines)
  - Pipeline configuration constants
  - Stage names, thresholds, pair universes
  - Key constants: `STAGE_NAMES`, `TOP_PAIRS_SELECTION_COUNT`, `BROAD_UNIVERSE_PAIRS`

### Configuration Files
- **config/timeframes/styles.json** - Trading style to timeframe mappings
- **config/risk_profiles/profiles.json** - Risk profile multipliers
- **config/thresholds/*.json** - Style-specific thresholds (scalping, intraday, swing, position)
- **config/pair_universes/core.json** - Pair tiers and target counts
- **config/score_weights/robustness_v1.json** - Scoring weight configuration
- **config/readiness_labels/v1.json** - Score to readiness label mapping

---

## I. Conclusion

The AutoQuant system is a sophisticated automated strategy optimization pipeline with a strong policy-driven configuration system. The core functionality is well-implemented with support for multiple strategy templates, parameter optimization, multi-pair testing, OOS validation, WFO, robustness testing, and comprehensive scoring.

However, there are several critical issues that need addressing:
1. **Stage count/name mismatch** between frontend and backend
2. **Configuration duplication** with unclear precedence rules
3. **Missing UI features** for discovery phase and rule toggling
4. **Incomplete error handling** and user feedback
5. **Limited export options** compared to Strategy Factory goals

The system is functional but would benefit from:
- Unifying stage definitions between frontend and backend
- Clarifying configuration precedence rules
- Exposing discovery phase in UI
- Adding interactive rule toggling
- Improving error handling and user feedback
- Expanding export capabilities

Overall, the system is approximately 70% of the way to the full Strategy Factory vision, with the core pipeline and scoring system solid, but missing some of the advanced interactive features and UI polish that would make it a complete strategy factory.
