# AutoQuant System - Complete Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend Architecture](#backend-architecture)
4. [Pipeline Stages](#pipeline-stages)
5. [Validation & Profitability Logic](#validation--profitability-logic)
6. [API Endpoints](#api-endpoints)
7. [UI Components & Buttons](#ui-components--buttons)
8. [AI Integration Opportunities](#ai-integration-opportunities)

---

## System Overview

AutoQuant is a 7-stage automated strategy validation pipeline that:
- Takes a trading strategy configuration
- Runs it through rigorous backtesting and optimization
- Validates profitability across multiple dimensions
- Exports production-ready strategy files

The system uses a **policy-driven approach** where all thresholds, scoring weights, and validation rules are loaded from configuration files in `backend/config/`.

**Key Design Principles:**
- **OOS Isolation**: Out-of-sample data never contaminates in-sample validation
- **Robustness-First**: Strategies must pass sensitivity checks (±5% parameter perturbation)
- **Self-Healing**: Automatic retry logic with AI suggestions when optimization fails
- **Multi-Pair Validation**: Tests strategies across multiple trading pairs simultaneously

---

## Frontend Architecture

### Main Components

#### 1. AutoQuantTab (`frontend/src/components/AutoQuantTab.jsx`)
**Purpose**: Main container for the AutoQuant interface

**Key State Management:**
- `formState`: Strategy configuration (timeframe, pairs, thresholds, etc.)
- `pipeline`: Pipeline execution state (current stage, progress, logs)
- `strategyGen`: Strategy generation hooks
- `screening`: Pair screening functionality
- `uiState`: UI preferences (notifications, filters)

**Key Functions:**
- `handleStart()`: Initiates pipeline by calling `startPipeline()` with form data
- `handleCancel()`: Requests pipeline cancellation
- `handleRetryRelaxed()`: Relaxes thresholds and retries failed runs
- `handleLoadRun()`: Loads historical run data for review

#### 2. AutoQuantConfigPanel (`frontend/src/features/autoquant/components/AutoQuantConfigPanel.jsx`)
**Purpose**: Configuration form for pipeline parameters

**Sections:**

##### Pipeline Configuration Card
- **Start Auto-Quant Button**: Launches the pipeline
  - Disabled until a strategy is selected
  - Calls `onStart()` which triggers `POST /api/auto-quant/start`

##### Strategy Source Section
- **Strategy Dropdown**: Selects from available strategies
  - Populated from `GET /api/strategies` endpoint
  - Required field - pipeline won't start without selection

##### Style/Risk/Depth Dropdowns
- **Trading Style**: scalping, intraday, swing, position
  - Affects default timeframes and thresholds
- **Risk Profile**: conservative, balanced, aggressive
  - Adjusts validation gate strictness
- **Analysis Depth**: quick, standard, deep
  - Controls hyperopt epochs and date ranges

##### Advanced Settings Section
- **Timeframe**: 1m, 3m, 5m, 15m, 30m, 1h, 4h, 1d
- **Exchange**: binance, bybit, kraken, kucoin, okx, gate
- **In-Sample Timerange**: Training data period (e.g., "20230101-20240101")
- **Out-of-Sample Timerange**: Validation data period (e.g., "20240101-20241201")
- **Pair Universe**: Comma-separated list of trading pairs
- **Load Default Top 50 Button**: Loads default high-volume pairs

##### Screen Pairs Section
- **Pairs to Screen**: Textarea for candidate pairs
- **Screen Pairs Button**: Runs quick backtests
  - Calls `POST /api/auto-quant/screen-pairs`
  - Returns ranked results with profit %, trades, win rate, max DD
- **Screening Results Table**: Shows results with checkboxes
  - **Copy Selected Pairs Button**: Copies selected pairs to Pair Universe field

##### Hyperopt Settings Section
- **Loss Function Dropdown**: 
  - ProfitLockinHyperOptLoss: Locks in high-profit trades
  - SharpeHyperOptLoss: Stable returns, low risk
  - SortinoHyperOptLoss: Penalizes downside volatility only
  - CalmarHyperOptLoss: Return / max drawdown ratio
  - MaxDrawDownRelativeHyperOptLoss: Minimize drawdown first
  - OnlyProfitHyperOptLoss: Maximize profit

- **Search Space Presets**:
  - Fast: stoploss, roi (50 epochs)
  - Balanced: buy, roi, stoploss (100 epochs)
  - Thorough: all spaces (200 epochs)

- **Search Space Toggles**:
  - buy: Entry signal thresholds (2x cost)
  - sell: Exit signal thresholds (2x cost)
  - roi: Return targets by time bucket (1x cost)
  - stoploss: Fixed downside guard (1x cost)
  - trailing: Price-following stop offset (1x cost)
  - protection: Cooldown and guard rules (3x cost)

- **Epochs Input**: Number of optimization iterations (10-1000)

##### Risk Thresholds Section
- **Max Drawdown (%)**: Maximum allowed drawdown (default: 30%)
- **Min Win Rate (%)**: Minimum required win rate (default: 40%)
- **Min Profit Factor**: Minimum profit factor (default: 1.0)
- **Min Sharpe Ratio**: Minimum Sharpe ratio (default: 0.5)
- **Min OOS Profit (fraction)**: Minimum out-of-sample profit (default: 0.0)
- **MC p95 Drawdown Limit (fraction)**: Monte Carlo threshold (default:  ̃0.35)

##### Walk-Forward Optimization Section
- **Enable Toggle**: Turns WFO on/off
- **IS Window**: In-sample window size in months (default: 3)
- **OOS Window**: Out-of-sample window size in months (default: 1)
- **Recency Weight**: Weight multiplier for recent windows (default: 1.0)

##### Alpha Consensus Voting Section
- **Enable Toggle**: Turns ensemble strategy on/off

#### 3. AutoQuantRunDashboard (`frontend/src/features/autoquant/components/AutoQuantRunDashboard.jsx`)
**Purpose**: Real-time pipeline monitoring during execution

**Key Components:**

##### Status Header
- **Strategy Name**: Current strategy being tested
- **Timeframe Badge**: Active timeframe
- **Exchange Badge**: Active exchange
- **Progress Bar**: Overall pipeline progress (0-100%)
- **Stage Counter**: Current stage (1-7)
- **Status Badge**: running, completed, failed, awaiting_user_approval
- **Elapsed Time**: Time since pipeline start
- **ETA**: Estimated time remaining
- **Epoch Counter**: Current hyperopt epoch (during Stage 3)
- **Stop Button**: Cancels running pipeline
- **New Run Button**: Resets for new pipeline

##### Pipeline View Toggle
- **Compact**: Shows stage stepper only
- **Detailed**: Shows full stage cards with data

##### Approval Review Panel
Appears when pipeline pauses for user approval (Stages 1 & 2)

**Stage 1 Approval (Pair Selection)**:
- Shows tested pairs with metrics (profit, PF, trades, win rate)
- Recommended pairs pre-selected (based on profitability)
- User can select/deselect pairs
- **Approve X Pairs & Continue Button**: Resumes pipeline with selected pairs

**Stage 2 Approval (Portfolio Baseline)**:
- Shows portfolio-level metrics (profit, max DD, trades, max open trades)
- Per-pair contribution breakdown
- Capital pressure signals
- Dominance warning if one pair >70% contribution
- **Approve Portfolio & Continue Button**: Resumes pipeline

##### Pipeline Stages Panel
- **Pre-Flight Filtering**: Data healing + baseline backtest
- **Pair Screening**: Multi-pair profitability testing
- **Portfolio Baseline**: Portfolio-level backtest
- **WFA Hyperopt**: Parameter optimization
- **Robustness & Feature Injection**: Sensitivity checks
- **Portfolio Competition**: Joint portfolio backtest
- **Delivery**: Export and final report

##### Live Fitness Curve
- Real-time hyperopt optimization progress
- Shows best epochs by profit
- Updates via WebSocket during Stage 3

##### Trade Distribution Chart
- Shows trade distribution by time
- Appears after Stage 1 or Stage 4

##### Top Candidates Table
- Shows top 5 hyperopt epochs
- Ranked by profit USDT

##### Robustness Badge
- Shows sensitivity check result
- Displays score and pass/fail status

##### Log Terminal
- Live pipeline logs
- Filterable by text
- Auto-scrolls to latest

---

## Backend Architecture

### API Router (`backend/api/routers/auto_quant.py`)

#### Key Endpoints

##### POST /api/auto-quant/start
**Purpose**: Launch a new pipeline run

**Request Body**:
```json
{
  "strategy": "StrategyName",
  "timeframe": "5m",
  "in_sample_range": "20230101-20240101",
  "out_sample_range": "20240101-20241201",
  "exchange": "binance",
  "pair_universe": ["BTC/USDT", "ETH/USDT"],
  "trading_style": "swing",
  "risk_profile": "balanced",
  "analysis_depth": "deep",
  "hyperopt_loss": "ProfitLockinHyperOptLoss",
  "hyperopt_spaces": ["buy", "stoploss", "roi"],
  "hyperopt_epochs": 100,
  "wfo_enabled": true,
  "wfo_is_months": 3,
  "wfo_oos_months": 1,
  "max_drawdown_threshold": 30,
  "min_win_rate": 40,
  "min_profit_factor": 1.0,
  "min_sharpe": 0.5,
  "min_oos_profit": 0.0,
  "monte_carlo_threshold": 0.35
}
```

**Response**:
```json
{
  "run_id": "uuid-string",
  "status": "running",
  "message": "Auto-Quant Factory started for 'StrategyName'"
}
```

**Process**:
1. Validates strategy file exists
2. Calls `build_run_config()` to normalize parameters
3. Creates pipeline state via `create_run()`
4. Launches async `run_pipeline()` task
5. Returns run_id for WebSocket connection

##### POST /api/auto-quant/screen-pairs
**Purpose**: Quick backtests to rank pairs by profitability

**Request Body**:
```json
{
  "strategy": "StrategyName",
  "timeframe": "5m",
  "date_range": "20230101-20240101",
  "pairs": ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
  "exchange": "binance"
}
```

**Response**:
```json
{
  "results": [
    {
      "pair": "BTC/USDT",
      "profit_pct": 15.5,
      "trade_count": 120,
      "win_rate": 52.5,
      "max_dd": 8.2
    }
  ],
  "screened": 3,
  "errors": []
}
```

**Process**:
1. Runs sequential backtests for each pair
2. Extracts profit, trades, win rate, max drawdown
3. Sorts by profit descending
4. Returns ranked results

##### POST /api/auto-quant/resume/{run_id}
**Purpose**: Resume pipeline after user approval

**Request Body**:
```json
{
  "approved_pairs": ["BTC/USDT", "ETH/USDT"]
}
```

**Process**:
1. Updates state with approved pairs
2. Advances current_stage
3. Resumes `run_pipeline()` task

##### GET /api/auto-quant/status/{run_id}
**Purpose**: Get current pipeline state

**Response**:
```json
{
  "run_id": "uuid",
  "status": "running",
  "current_stage": 3,
  "stages": [...],
  "progress_percent": 45,
  "eta_seconds": 1800
}
```

##### GET /api/auto-quant/report/{run_id}
**Purpose**: Get final pipeline report

**Response**: Full report with all stage results, metrics, and recommendations

##### POST /api/auto-quant/generate-strategy-spec
**Purpose**: Generate strategy specification using AI (Hermes)

**Request Body**:
```json
{
  "trading_style": "swing",
  "direction": "both",
  "risk_profile": "balanced",
  "timeframe_preference": "5m",
  "user_notes": "Optional notes"
}
```

**Response**:
```json
{
  "spec": { /* StrategySpec JSON */ },
  "errors": [],
  "raw_response": "AI response text"
}
```

### Policy Layer (`backend/services/auto_quant/policy/__init__.py`)

**Purpose**: Single source of truth for all validation thresholds and scoring

**Key Functions**:

##### load_policy()
Loads configuration from JSON files:
- `backend/config/timeframes/styles.json`: Timeframe mappings per trading style
- `backend/config/risk_profiles/profiles.json`: Risk profile adjustments
- `backend/config/pair_universes/core.json`: Default pair universes
- `backend/config/score_weights/robustness_v1.json`: Scoring weights
- `backend/config/readiness_labels/v1.json`: Readiness criteria
- `backend/config/thresholds/{style}.json`: Validation thresholds per style

##### build_run_config(payload, settings)
Normalizes user input into internal run configuration:
1. Extracts trading_style, risk_profile, analysis_depth
2. Gets depth-specific defaults (epochs, WFO settings)
3. Normalizes thresholds with user overrides
4. Calculates dynamic date ranges
5. Generates planned WFO windows if enabled
6. Returns normalized config for pipeline

##### thresholds_for(style, risk_profile, tier)
Returns validation thresholds for a given style/risk profile:
- **tier**: "validation" (strict) or "discovery" (permissive)
- Applies risk profile multipliers to base thresholds
- Returns dict with: max_drawdown, min_win_rate, min_profit_factor, min_sharpe, min_oos_profit

##### compute_readiness_score(...)
Computes overall strategy readiness score (0-100):
- **Components**: expectancy, profit_factor, drawdown, robustness, oos, walk_forward, pair_consistency, trade_quality
- **Weights**: Loaded from score_weights config
- **Returns**: Overall score + component breakdown

### Pipeline Orchestrator (`backend/services/auto_quant/pipeline_modules/orchestrator.py`)

**Purpose**: Main pipeline execution controller

**Flow**:
```
run_pipeline(run_id)
├── Stage 1: Pre-Flight Filtering (Data Healing + Baseline Backtest)
│   ├── Data Healing: Validate/download historical data
│   ├── Baseline Backtest: Test all pairs with strict filters
│   ├── Filter winning pairs based on timeframe thresholds
│   └── Pause for user approval (pair selection)
├── Stage 1.5: Regime Detection (optional)
│   └── Detect market regime (trending/ranging/volatile)
├── Stage 2: Portfolio Baseline Backtest
│   ├── Backtest selected pairs with capital constraints
│   └── Pause for user approval (portfolio review)
├── Stage 2.5: Genetic Algorithm Evolution (optional)
│   └── Evolve strategy parameters using genetic algorithms
├── Stage 3.5: RL Training (optional)
│   └── Train reinforcement learning agent
├── Stage 3: WFA Hyperopt (with self-healing retry loop)
│   ├── Standard Hyperopt or Walk-Forward Hyperopt
│   ├── Sensitivity Check (±5% parameter perturbation)
│   ├── If failed: Self-healing retry with AI suggestions
│   ├── Auto-Patching: Inject best parameters into strategy
│   └── Retry up to max_retries times
├── Stage 4: Robustness & Feature Injection
│   ├── OOS Validation: Test on unseen data
│   ├── Monte Carlo Simulation: p95 drawdown check
│   ├── Stress Test: Test on adverse market conditions
│   └── Risk Assessment: Validate against thresholds
├── Stage 4.5: RL Deployment (optional)
│   └── Deploy RL-trained agent
├── Stage 5: Portfolio Competition
│   └── Joint portfolio backtest with capital constraints
└── Stage 6: Delivery
    ├── Export optimized strategy file
    ├── Generate final report
    └── Create downloadable bundle
```

---

## Pipeline Stages

### Stage 1: Pre-Flight Filtering
**File**: `stages_validation.py` → `_stage_pre_flight_filtering()`

**Purpose**: Validate data and filter profitable pairs

**Sub-steps**:

1. **Data Healing** (`data_healer.py`):
   - Validates historical data availability for all pairs
   - Auto-downloads missing data via Freqtrade
   - Filters out pairs with insufficient data
   - Returns surviving pairs for backtest

2. **Baseline Backtest**:
   - Runs backtest across all surviving pairs
   - Uses strict filters: profit_factor >= 1.0, total_trades >= 30
   - Applies timeframe-specific thresholds from `get_timeframe_thresholds()`

3. **Pair Filtering** (`filters.py` → `_filter_winning_pairs()`):
   - Filters pairs based on:
     - `min_profit`: From timeframe thresholds (e.g., 0.05 for 5m)
     - `max_drawdown`: From timeframe thresholds (e.g., 30% for swing)
   - Sorts winning pairs by profit_total descending
   - Selects top N pairs (TOP_PAIRS_SELECTION_COUNT)

4. **User Approval**:
   - Pauses pipeline with status "awaiting_user_approval"
   - Shows winning pairs in UI for selection
   - User can approve/reject pairs
   - Resumes via `POST /api/auto-quant/resume/{run_id}`

**Success Criteria**:
- At least TOP_PAIRS_SELECTION_COUNT profitable pairs
- Each pair passes profit and drawdown thresholds

**Failure Modes**:
- Insufficient profitable pairs → suggests different timeframe/pairs
- Data healing failure → suggests data availability issues

### Stage 2: Portfolio Baseline Backtest
**File**: `stages_validation.py` → `_stage_portfolio_baseline()`

**Purpose**: Validate portfolio-level performance before optimization

**Process**:
1. Runs backtest with selected pairs from Stage 1
2. Applies capital constraints (max_open_trades)
3. Calculates portfolio-level metrics:
   - Total profit % across all pairs
   - Portfolio max drawdown
   - Total trades
   - Per-pair contribution

4. **User Approval**:
   - Shows portfolio summary
   - Displays per-pair contribution breakdown
   - Checks for dominance (one pair >70% contribution)
   - Validates capital pressure (no starvation)
   - Pauses for user approval

**Success Criteria**:
- Portfolio profit >= 0
- No severe capital starvation
- Reasonable pair balance (no extreme dominance)

### Stage 3: WFA Hyperopt
**File**: `stages_optimization.py` → `_stage_hyperopt()`

**Purpose**: Optimize strategy parameters

**Two Modes**:

#### Standard Hyperopt (`_stage_hyperopt_standard()`)
- Optimizes over full in-sample range
- Uses selected pairs from Stage 1
- Applies pure IS range (OOS isolation)
- Runs for configured epochs
- Returns best parameters

#### Walk-Forward Hyperopt (`_stage_hyperopt_wfo()`)
- Divides IS range into rolling windows
- Optimizes on each window separately
- Aggregates parameters across windows
- Tests on OOS windows
- More robust but slower

**Self-Healing Retry Loop**:

After hyperopt, runs **Sensitivity Check** (`sensitivity.py`):
- Perturbs best parameters by ±5%
- Tests perturbed versions
- Calculates sensitivity score
- **Pass**: If perturbed versions maintain profitability
- **Fail**: If sharp peak detected (large performance drop)

**On Failure**:
1. **AI Suggestions** (if enabled):
   - Calls `ask_ollama_for_sensitivity_fix()`
   - AI analyzes failure and suggests:
     - Different hyperopt_loss function
     - Different hyperopt_spaces
     - Different hyperopt_epochs
     - Parameter overrides
   - Applies suggestions if available

2. **Hard Mutation** (if FAIL_NEGATIVE_BASELINE):
   - Forces Boolean indicators to True (use_ema_cross, use_atr, use_adx)
   - Widens hyperopt_spaces to ["buy", "stoploss", "roi"]
   - Doubles hyperopt_epochs

3. **Soft Mutation** (fallback):
   - Changes hyperopt_loss based on failure reason
   - Broadens spaces on retry 2
   - Boosts epochs on retry 3+

4. **Retry**:
   - Resets Stage 2 & 3 status to pending
   - Continues loop up to max_retries
   - If all retries fail → pipeline fails with suggestions

**Auto-Patching** (`_stage_patch()`):
- Injects best parameters into strategy file
- Creates variant strategy with optimized params
- Saves to output directory

### Stage 4: Robustness & Feature Injection
**File**: `stages_validation.py` → `_stage_robustness_feature_injection()`

**Purpose**: Validate on unseen data and add robustness features

**Sub-steps**:

1. **OOS Validation**:
   - Backtests optimized strategy on OOS range
   - Validates OOS isolation (no IS contamination)
   - Checks OOS profit >= min_oos_profit threshold

2. **Monte Carlo Simulation** (`monte_carlo.py`):
   - Resamples OOS trades with replacement
   - Runs 1000 simulations
   - Calculates p95 drawdown
   - Validates p95 DD <= monte_carlo_threshold

3. **Stress Test**:
   - Tests on adverse market conditions
   - Uses DEFAULT_STRESS_PAIRS
   - Validates performance under stress

4. **Risk Assessment** (`_stage_risk_assessment()`):
   - Validates against all thresholds:
     - max_drawdown_threshold
     - min_win_rate
     - min_profit_factor
     - min_sharpe
   - Returns pass/fail for each check

**Success Criteria**:
- All risk checks pass
- OOS profit >= threshold
- Monte Carlo p95 DD <= threshold

### Stage 5: Portfolio Competition
**File**: `stages_assessment.py` → `_stage_joint_portfolio_backtest()`

**Purpose**: Final portfolio-level validation

**Process**:
1. Runs backtest with optimized strategy
2. Uses all selected pairs
3. Applies capital constraints
4. Calculates portfolio metrics
5. Validates against thresholds

**Success Criteria**:
- Portfolio passes all risk gates
- Sufficient trade count
- Reasonable capital utilization

### Stage 6: Delivery
**File**: `stages_assessment.py` → `_stage_delivery()`

**Purpose**: Export production-ready artifacts

**Process**:
1. Copies optimized strategy to output directory
2. Generates final report JSON
3. Creates HTML summary report
4. Prepares downloadable bundle

**Deliverables**:
- Optimized strategy file (.py)
- Configuration file (.json)
- Backtest results
- Hyperopt trials
- Final report

---

## Validation & Profitability Logic

### Threshold System

**Location**: `backend/config/thresholds/{style}.json`

**Structure**:
```json
{
  "version": "v1",
  "validation": {
    "max_drawdown": 0.30,
    "min_win_rate": 40.0,
    "min_profit_factor": 1.0,
    "min_sharpe": 0.5,
    "min_oos_profit": 0.0,
    "min_expectancy": 0.05
  },
  "discovery": {
    "max_drawdown": 0.50,
    "min_win_rate": 35.0,
    "min_profit_factor": 0.8,
    "min_sharpe": 0.3,
    "min_oos_profit": -0.05,
    "min_expectancy": 0.0
  }
}
```

**Styles**: scalping, intraday, swing, position
- Each style has its own threshold file
- Scalping has tighter thresholds (higher win rate, lower DD)
- Position has looser thresholds (lower win rate, higher DD allowed)

### Timeframe-Specific Thresholds

**Location**: `pipeline_modules/config.py` → `get_timeframe_thresholds()`

**Logic**:
```python
def get_timeframe_thresholds(timeframe: str) -> dict:
    if timeframe in ["1m", "3m", "5m", "15m"]:
        return {
            "min_oos_profit": 0.05,  # 5% profit required
            "max_drawdown_threshold": 25.0,  # 25% max DD
        }
    elif timeframe in ["30m", "1h"]:
        return {
            "min_oos_profit": 0.03,  # 3% profit required
            "max_drawdown_threshold": 30.0,  # 30% max DD
        }
    elif timeframe == "4h":
        return {
            "min_oos_profit": 0.02,  # 2% profit required
            "max_drawdown_threshold": 35.0,  # 35% max DD
        }
    else:  # 1d
        return {
            "min_oos_profit": 0.01,  # 1% profit required
            "max_drawdown_threshold": 40.0,  # 40% max DD
        }
```

**Rationale**:
- Shorter timeframes require higher profit (more trades)
- Longer timeframes allow lower profit (fewer trades)
- Drawdown limits scale with timeframe

### Pair Filtering Logic

**Location**: `pipeline_modules/filters.py` → `_filter_winning_pairs()`

**Algorithm**:
```python
def _filter_winning_pairs(per_pair_results, timeframe):
    thresholds = get_timeframe_thresholds(timeframe)
    min_profit = thresholds["min_oos_profit"]
    max_dd = thresholds["max_drawdown_threshold"]
    
    winning_pairs = []
    for pair_result in per_pair_results:
        profit = pair_result.get("profit_total", 0)
        drawdown = pair_result.get("max_drawdown_pct", 100)
        
        if profit >= min_profit and drawdown < max_dd:
            winning_pairs.append(pair_result)
    
    return sorted(winning_pairs, key=lambda p: p["profit_total"], reverse=True)
```

**Criteria**:
- Profit >= timeframe-specific minimum
- Max drawdown < timeframe-specific maximum
- Sorted by profit (descending)
- Top N pairs selected

### Sensitivity Check

**Location**: `backend/services/auto_quant/sensitivity.py`

**Purpose**: Detect sharp optimization peaks

**Algorithm**:
1. Take best parameters from hyperopt
2. Create perturbed versions:
   - p_minus: best * 0.95 (5% decrease)
   - p_plus: best * 1.05 (5% increase)
3. Run backtests with perturbed parameters
4. Compare results:
   - p_best: profit with best params
   - p_minus: profit with decreased params
   - p_plus: profit with increased params
5. Calculate sensitivity score:
   - If both perturbations maintain profitability → PASS
   - If either causes significant drop → FAIL (sharp peak)

**Failure Reasons**:
- **FAIL_NEGATIVE_BASELINE**: p_best < 0 (strategy unprofitable)
- **FAIL_SHARP_PEAK**: Large performance gap between best and perturbed

**Self-Healing**:
- On FAIL_NEGATIVE_BASELINE: Hard mutation (force indicators, widen spaces)
- On FAIL_SHARP_PEAK: AI suggestions or soft mutation

### Scoring System

**Location**: `backend/services/auto_quant/policy/__init__.py` → `compute_readiness_score()`

**Components**:
1. **Expectancy**: Average profit per trade
2. **Profit Factor**: Gross profit / gross loss
3. **Drawdown Quality**: Inverse of max drawdown
4. **Robustness**: Sensitivity check score
5. **OOS Performance**: Out-of-sample profit ratio
6. **Walk-Forward**: WFO window consistency
7. **Pair Consistency**: Performance across pairs
8. **Trade Quality**: Trade count vs timeframe

**Weights**: Loaded from `backend/config/score_weights/robustness_v1.json`

**Score Calculation**:
- Each component scored 0-100
- Weighted average of components
- Overall score 0-100

**Readiness Labels**:
- 90-100: Production Ready
- 75-89: Good
- 60-74: Fair
- 0-59: Poor

---

## API Endpoints

### Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/auto-quant/default-ranges | Get dynamic date ranges |
| POST | /api/auto-quant/start | Launch pipeline |
| POST | /api/auto-quant/runs | Alias for start |
| POST | /api/auto-quant/generate-template | Generate strategy template |
| POST | /api/auto-quant/generate-strategy-spec | Generate AI strategy spec |
| GET | /api/auto-quant/timeframe-thresholds/{tf} | Get timeframe thresholds |
| POST | /api/auto-quant/screen-pairs | Quick pair screening |
| GET | /api/auto-quant/status/{run_id} | Get pipeline status |
| POST | /api/auto-quant/cancel/{run_id} | Cancel pipeline |
| POST | /api/auto-quant/resume/{run_id} | Resume after approval |
| GET | /api/auto-quant/report/{run_id} | Get final report |
| GET | /api/auto-quant/report/{run_id}/html | Download HTML report |
| GET | /api/auto-quant/download/{run_id}/{file} | Download file |
| POST | /api/auto-quant/export/{run_id} | Export bundle |
| GET | /api/auto-quant/ws/{run_id} | WebSocket stream |
| GET | /api/auto-quant/runs | List all runs |

### WebSocket Events

**Endpoint**: `ws://localhost:8000/api/auto-quant/ws/{run_id}`

**Event Types**:
- `stage_start`: Stage started
- `stage_progress`: Stage progress update
- `stage_complete`: Stage completed
- `stage_failed`: Stage failed
- `log`: Log line
- `fitness_update`: Hyperopt fitness curve point
- `sensitivity_result`: Sensitivity check result
- `data_healing_status`: Data healing progress

---

## UI Components & Buttons

### Configuration Panel Buttons

#### Start Auto-Quant Button
**Location**: Pipeline Configuration card
**Action**: Launches pipeline
**API Call**: `POST /api/auto-quant/start`
**Disabled When**: No strategy selected

#### Load Default Top 50 Button
**Location**: Advanced Settings → Pair Universe
**Action**: Loads DEFAULT_PAIR_UNIVERSE constant
**API Call**: None (client-side)

#### Screen Pairs Button
**Location**: Screen Pairs section
**Action**: Runs quick backtests for candidate pairs
**API Call**: `POST /api/auto-quant/screen-pairs`
**Disabled When**: No strategy selected or no pairs entered

#### Copy Selected Pairs Button
**Location**: Screening Results Table
**Action**: Copies selected pairs to Pair Universe field
**API Call**: None (client-side)
**Visible When**: At least one pair selected

#### Hyperopt Preset Buttons
**Location**: Hyperopt Settings
**Options**: Fast, Balanced, Thorough
**Action**: Sets hyperopt_spaces and hyperopt_epochs
**API Call**: None (client-side)

#### Search Space Toggle Buttons
**Location**: Hyperopt Settings
**Options**: buy, sell, roi, stoploss, trailing, protection
**Action**: Toggles space in hyperopt_spaces array
**API Call**: None (client-side)

### Dashboard Buttons

#### Stop Button
**Location**: Status header
**Action**: Cancels running pipeline
**API Call**: `POST /api/auto-quant/cancel/{run_id}`
**Visible When**: Status is running or awaiting_user_approval

#### New Run Button
**Location**: Status header
**Action**: Resets dashboard for new pipeline
**API Call**: None (client-side)
**Visible When**: Status is completed, failed, or interrupted

#### Approve Pairs & Continue Button
**Location**: Approval Review Panel (Stage 1)
**Action**: Resumes pipeline with selected pairs
**API Call**: `POST /api/auto-quant/resume/{run_id}`
**Disabled When**: No pairs selected

#### Approve Portfolio & Continue Button
**Location**: Portfolio Baseline Review (Stage 2)
**Action**: Resumes pipeline after portfolio review
**API Call**: `POST /api/auto-quant/resume/{run_id}`

#### Recommended Button
**Location**: Approval Review Panel
**Action**: Selects all recommended pairs
**API Call**: None (client-side)

#### All Button
**Location**: Approval Review Panel
**Action**: Selects all tested pairs
**API Call**: None (client-side)

#### Clear Button
**Location**: Approval Review Panel
**Action**: Deselects all pairs
**API Call**: None (client-side)

### View Mode Toggles

#### Compact Button
**Location**: Pipeline View toggle
**Action**: Shows compact stage stepper
**API Call**: None (client-side)

#### Detailed Button
**Location**: Pipeline View toggle
**Action**: Shows detailed stage cards
**API Call**: None (client-side)

### Notification Toggle

#### Alerts On/Off Button
**Location**: Status header
**Action**: Enables/disables browser notifications
**API Call**: None (client-side)

---

## AI Integration Opportunities

### Current AI Integration

#### 1. Strategy Spec Generation (Hermes)
**Location**: `backend/services/auto_quant/ollama_service.py`

**Endpoint**: `POST /api/auto-quant/generate-strategy-spec`

**Current Use**:
- Generates structured strategy specifications
- Uses Ollama with strategy lab model
- Provides trading style, direction, risk profile inputs
- Returns StrategySpec JSON

**Integration Point**: AutoQuant Config Panel
**Status**: Implemented but not exposed in UI (removed in refactoring)

#### 2. Self-Healing Suggestions
**Location**: `backend/services/auto_quant/ollama_service.py` → `ask_ollama_for_sensitivity_fix()`

**Current Use**:
- Triggered when sensitivity check fails
- Analyzes failure reason and retry history
- Suggests parameter adjustments:
  - hyperopt_loss function
  - hyperopt_spaces
  - hyperopt_epochs
  - param_overrides
- Applied automatically if enabled

**Integration Point**: Stage 3 (WFA Hyperopt) retry loop
**Status**: Implemented, controlled by `ollama_self_healing_enabled` setting

### Recommended AI Integrations

#### 1. Strategy Fixing Assistant (AutoQuant Tab)
**Purpose**: AI analyzes failed strategies and suggests fixes

**Where to Add**: AutoQuantRunDashboard → Failure Report component

**Implementation**:
```jsx
// Add button in AutoQuantFailureReport.jsx
<button onClick={handleAIFix}>
  <SparklesIcon className="h-4 w-4" />
  Ask AI to Fix Strategy
</button>
```

**Backend Endpoint**:
```python
@router.post("/ai/fix策略/{run_id}")
async def ai_fix_strategy(run_id: str, request: Request):
    state = get_state(run_id)
    failure_data = {
        "stage": state.current_stage,
        "error": state.stages[state.current_stage-1].message,
        "metrics": state.stages[state.current_stage-1].data,
        "retry_history": state.retry_history,
    }
    
    client = create_strategy_lab_client(settings.user_data_directory_path)
    suggestions = await ask_ollama_for_strategy_fix(failure_data, state)
    
    return {"suggestions": suggestions}
```

**AI Prompt**:
```
Analyze this failed strategy backtest:
- Stage: {stage}
- Error: {error}
- Metrics: {metrics}
- Retry History: {retry_history}

Suggest specific fixes:
1. Parameter adjustments (which params, what values)
2. Indicator changes (add/remove/modify indicators)
3. Timeframe recommendations
4. Pair selection suggestions
5. Risk threshold adjustments

Return JSON with actionable suggestions.
```

#### 2. Real-Time Optimization Guidance (Optimizer Tab)
**Purpose**: AI provides guidance during hyperopt optimization

**Where to Add**: OptimizerTab → Live Progress section

**Implementation**:
```jsx
// Add AI guidance panel in OptimizerTab
<div className="ai-guidance-panel">
  <h3>AI Optimization Guidance</h3>
  <p>{aiGuidance.suggestion}</p>
  <button onClick={applyAISuggestion}>
    Apply AI Suggestion
  </button>
</div>
```

**Backend Endpoint**:
```python
@router.post("/ai/hyperopt-guidance/{session_id}")
async def hyperopt_guidance(session_id: str, trials: list):
    # Analyze current hyperopt trials
    summary = summarize_hyperopt_trials(trials)
    
    client = create_strategy_lab_client(settings.user_data_directory_path)
    guidance = await ask_ollama_for_hyperopt_guidance(summary)
    
    return {"guidance": guidance}
```

**AI Prompt**:
```
Current hyperopt progress:
- Best loss: {best_loss}
- Epoch: {current}/{total}
- Search spaces: {spaces}
- Trial summary: {summary}

Provide guidance:
1. Should we continue or stop?
2. Should we change search spaces?
3. Should we adjust epochs?
4. Are we converging or stuck?
5. Specific parameter recommendations

Return JSON with actionable guidance.
```

#### 3. Pair Selection AI (AutoQuant Tab)
**Purpose**: AI analyzes pair correlations and suggests optimal combinations

**Where to Add**: AutoQuantConfigPanel → Screen Pairs section

**Implementation**:
```jsx
// Add AI button in ScreeningResultsTable
<button onClick={handleAIPairSelection}>
  <SparklesIcon className="h-4 w-4" />
  AI Suggest Pairs
</button>
```

**Backend Endpoint**:
```python
@router.post("/ai/suggest-pair-combination")
async def suggest_pair_combination(pairs: list[str], timeframe: str):
    # Analyze pair correlations
    correlations = calculate_pair_correlations(pairs, timeframe)
    
    client = create_strategy_lab_client(settings.user_data_directory_path)
    suggestions = await ask_ollama_for_pair_selection(correlations, pairs)
    
    return {"suggested_combinations": suggestions}
```

**AI Prompt**:
```
Available pairs: {pairs}
Timeframe: {timeframe}
Pair correlations: {correlations}

Suggest optimal pair combinations:
1. Maximize diversification (low correlation)
2. Balance volatility
3. Consider liquidity
4. Group by sector/asset class

Return top 3 combinations with reasoning.
```

#### 4. Threshold Optimization AI (AutoQuant Tab)
**Purpose**: AI suggests optimal risk thresholds based on strategy characteristics

**Where to Add**: AutoQuantConfigPanel → Risk Thresholds section

**Implementation**:
```jsx
// Add AI button in Risk Thresholds
<button onClick={handleAIThresholdOptimization}>
  <SparklesIcon className="h-4 w-4" />
  AI Optimize Thresholds
</button>
```

**Backend Endpoint**:
```python
@router.post("/ai/optimize-thresholds")
async def optimize_thresholds(strategy: str, timeframe: str, style: str):
    # Get strategy characteristics
    strategy_metrics = analyze_strategy_characteristics(strategy, timeframe)
    
    client = create_strategy_lab_client(settings.user_data_directory_path)
    optimized = await ask_ollama_for_threshold_optimization(
        strategy_metrics, style, timeframe
    )
    
    return {"optimized_thresholds": optimized}
```

**AI Prompt**:
```
Strategy: {strategy}
Timeframe: {timeframe}
Style: {style}
Strategy metrics: {metrics}

Suggest optimal risk thresholds:
- Max drawdown (balance risk vs opportunity)
- Min win rate (realistic for this timeframe)
- Min profit factor (based on strategy type)
- Min Sharpe (considering volatility)
- Min OOS profit (ensure generalization)

Return thresholds with reasoning.
```

#### 5. Regime Detection AI (AutoQuant Tab)
**Purpose**: AI detects current market regime and adjusts strategy parameters

**Where to Add**: AutoQuantConfigPanel → Advanced Settings (new section)

**Implementation**:
```jsx
// Add Regime Detection section
<Section title="Regime Detection" icon={TrendingUpIcon}>
  <button onClick={handleRegimeDetection}>
    Detect Current Regime
  </button>
  {regime && <RegimeDisplay regime={regime} />}
</Section>
```

**Backend Endpoint**:
```python
@router.post("/ai/detect-regime")
async def detect_regime(pairs: list[str], timeframe: str):
    # Get recent market data
    market_data = fetch_recent_market_data(pairs, timeframe)
    
    client = create_strategy_lab_client(settings.user_data_directory_path)
    regime = await ask_ollama_for_regime_detection(market_data)
    
    return {"regime": regime, "suggested_adjustments": regime.adjustments}
```

**AI Prompt**:
```
Recent market data:
- Pairs: {pairs}
- Timeframe: {timeframe}
- Price data: {price_data}
- Volume data: {volume_data}
- Volatility: {volatility}

Detect current market regime:
1. Trending (up/down/sideways)
2. Volatility level (low/medium/high)
3. Volume profile
4. Momentum

Suggest strategy parameter adjustments for this regime.
```

### Integration Architecture

#### Recommended Pattern

**1. AI Service Layer** (`backend/services/auto_quant/ai_service.py`):
```python
class AutoQuantAIService:
    def __init__(self, user_data_dir: Path):
        self.client = create_strategy_lab_client(user_data_dir)
    
    async def suggest_strategy_fix(self, failure_data: dict) -> dict:
        """Analyze failure and suggest fixes"""
        prompt = self._build_fix_prompt(failure_data)
        response = await self.client.generate(prompt)
        return self._parse_fix_response(response)
    
    async def optimize_thresholds(self, strategy_data: dict) -> dict:
        """Suggest optimal risk thresholds"""
        prompt = self._build_threshold_prompt(strategy_data)
        response = await self.client.generate(prompt)
        return self._parse_threshold_response(response)
```

**2. API Endpoints** (`backend/api/routers/auto_quant_ai.py`):
```python
router = APIRouter(prefix="/api/auto-quant/ai", tags=["AutoQuant AI"])

@router.post("/fix-strategy/{run_id}")
async def fix_strategy(run_id: str, request: Request):
    ai_service = AutoQuantAIService(settings.user_data_directory_path)
    suggestions = await ai_service.suggest_strategy_fix(run_id)
    return {"suggestions": suggestions}
```

**3. Frontend Hooks** (`frontend/src/features/autoquant/hooks/useAutoQuantAI.js`):
```javascript
export function useAutoQuantAI() {
  const suggestStrategyFix = async (runId) => {
    const response = await fetch(`/api/auto-quant/ai/fix-strategy/${runId}`);
    return response.json();
  };
  
  const optimizeThresholds = async (strategy, timeframe) => {
    const response = await fetch('/api/auto-quant/ai/optimize-thresholds', {
      method: 'POST',
      body: JSON.stringify({ strategy, timeframe }),
    });
    return response.json();
  };
  
  return { suggestStrategyFix, optimizeThresholds };
}
```

**4. UI Components**:
```jsx
// In AutoQuantRunDashboard.jsx
const ai = useAutoQuantAI();

const handleAIFix = async () => {
  const suggestions = await ai.suggestStrategyFix(runId);
  setAISuggestions(suggestions);
};

// Render AI suggestions panel
{aiSuggestions && (
  <AISuggestionsPanel 
    suggestions={aiSuggestions}
    onApply={applySuggestion}
  />
)}
```

### Where to Add AI: AutoQuant vs Optimizer

#### AutoQuant Tab - Recommended For:
1. **Strategy Fixing**: After pipeline failure, suggest fixes
2. **Pair Selection**: Optimize pair combinations
3. **Threshold Optimization**: Suggest risk thresholds
4. **Regime Detection**: Adjust for current market conditions
5. **Strategy Generation**: Generate new strategies from scratch

**Rationale**: AutoQuant is about strategy validation and deployment. AI helps users understand failures and improve strategies before deployment.

#### Optimizer Tab - Recommended For:
1. **Real-Time Guidance**: During hyperopt, suggest parameter adjustments
2. **Convergence Detection**: Detect when optimization is stuck
3. **Search Space Optimization**: Suggest which spaces to explore
4. **Early Stopping**: Recommend when to stop optimization

**Rationale**: Optimizer is about parameter tuning. AI provides real-time guidance during the optimization process.

### Implementation Priority

**High Priority** (Most Value):
1. Strategy Fixing Assistant (AutoQuant) - Helps users recover from failures
2. Real-Time Optimization Guidance (Optimizer) - Improves optimization efficiency

**Medium Priority**:
3. Pair Selection AI (AutoQuant) - Improves portfolio construction
4. Threshold Optimization AI (AutoQuant) - Helps users set realistic thresholds

**Low Priority**:
5. Regime Detection AI (AutoQuant) - Advanced feature, requires market data

### Configuration

**Settings File**: `user_data/strategy_lab_settings.json`
```json
{
  "ollama_model_strategylab": "llama3:8b",
  "ollama_self_healing_enabled": true,
  "ollama_strategy_fix_enabled": true,
  "ollama_hyperopt_guidance_enabled": true,
  "ollama_pair_selection_enabled": true,
  "ollama_threshold_optimization_enabled": true
}
```

**Enable/Disable**: Each AI feature can be toggled independently via settings.

---

## Summary

The AutoQuant system is a sophisticated 7-stage pipeline that validates trading strategies through rigorous backtesting, optimization, and risk assessment. Key features include:

- **Policy-Driven**: All thresholds and rules loaded from config
- **OOS Isolation**: Strict separation of training and validation data
- **Self-Healing**: Automatic retry with AI suggestions on failure
- **Multi-Pair**: Validates across multiple trading pairs
- **Robustness-First**: Sensitivity checks prevent overfitting
- **AI-Ready**: Multiple integration points for AI enhancements

The system is designed to be extended with AI capabilities at multiple points:
- **AutoQuant Tab**: Strategy fixing, pair selection, threshold optimization
- **Optimizer Tab**: Real-time optimization guidance, convergence detection

Current AI integration includes strategy spec generation and self-healing suggestions, with significant room for expansion in both tabs.
