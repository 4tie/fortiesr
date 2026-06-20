# Task 14: Strategy Lab Dashboard

Plan to create a live workflow dashboard for Candidate Evaluation that visualizes the multi-gate pipeline with real-time progress, gate statuses, backtest results, pair sweep data, and repair attempts.

## 1. Goal
Create a frontend dashboard tab that provides a live workflow visualization for the Candidate Evaluation pipeline, showing gate-by-gate progress, backtest metrics, pair sweep results, repair attempts, and final verdict with an elapsed timer during evaluation.

## 2. Why this task comes next
Task 13 created the backend API endpoint `POST /api/candidate/evaluate` but has no frontend exposure. This task provides the user interface for interacting with the candidate evaluation workflow, making it accessible through the Strategy Lab dashboard.

## 3. Existing frontend/backend files to reuse
- `frontend/src/App.jsx` - tab routing structure, add new tab "Strategy Lab"
- `frontend/src/services/api.js` - central API client, add `api.candidate.evaluate()` method
- `frontend/src/components/AutoQuantTab.jsx` - reference for WebSocket patterns, stage stepper UI, elapsed timer logic
- `frontend/src/components/RunDetailPanel.jsx` - reference for tabbed detail view layout
- `backend/api/routers/candidate.py` - existing endpoint to call
- `backend/services/candidate/models.py` - CandidateVerdict, CandidateGateResult, RepairAttempt models for response parsing

## 4. Whether existing progress/WebSocket can be reused
**Phase 1**: No - the existing WebSocket system is tightly coupled to AutoQuant pipeline state machine and queue-based messaging. The candidate endpoint is synchronous and returns final verdict only.
**Phase 2**: Limited reuse - would require extending candidate orchestrator to emit progress events or creating a new WebSocket endpoint. For now, Phase 1 uses elapsed timer with synchronous call.

## 5. Proposed tab name
"Strategy Lab" (to distinguish from "Auto-Quant Factory")

## 6. UI Layout

**Header Section:**
- Run status badge (idle/running/completed/failed)
- Elapsed timer (MM:SS format, updates every second during evaluation)
- Start/Stop buttons

**Input Section (collapsible when running):**
- StrategySpec form fields (name, description, timeframe, trading_style, indicators, entry/exit conditions, stoploss, position sizing, etc.)
- CandidateConfig form fields (timerange, pairs, exchange, max_repair_iterations)
- Validate and Start Evaluation button

**Workflow Timeline (vertical stepper):**
- 11 gate cards in sequence: StrategySpec → render_strategy → save_working_copy → data_quality → backtest_gate → failure_analyzer → repair_plan → repair_attempts → individual_pair_sweep → portfolio_backtest → final_pair_decision
- Each card shows: status icon (pending/running/passed/failed/skipped), gate name, duration, errors/warnings badges, metrics preview

**Results Panels (shown after completion):**
- Backtest Results: total trades, win rate, profit factor, drawdown, expectancy, sharpe
- Pair Sweep Table: pair, status, score, profit factor, drawdown, trades, rejection reason
- Portfolio Results: approved pairs list, portfolio metrics, max_open_trades, final verdict
- Repair Attempts: iteration number, scope, change applied, outcome

**Final Verdict Card:**
- Large passed/failed badge
- Failure reason (if failed)
- Final pair set (if passed)
- Export/Dry-run readiness placeholder

## 7. API client changes
Add to `frontend/src/services/api.js`:
```javascript
candidate: {
  async evaluate(spec, config) {
    const res = await fetch(`${API_BASE}/candidate/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec, config }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}
```

## 8. State model
```javascript
{
  // Evaluation state
  status: "idle" | "running" | "completed" | "failed",
  startTime: null | timestamp,
  elapsedSeconds: 0,
  
  // Input form state
  strategySpec: { ...default StrategySpec },
  candidateConfig: { ...default CandidateConfig },
  
  // Results state
  verdict: null | CandidateVerdict,
  gateResults: [],  // Computed from verdict.gate_results
  
  // UI state
  showInputForm: true,
  activePanel: "timeline" | "backtest" | "pairs" | "portfolio" | "repairs"
}
```

## 9. Loading/timer behavior
- On "Start Evaluation": set status="running", record startTime, hide input form, start setInterval timer (every 1s)
- Timer updates elapsedSeconds and formats as MM:SS
- Call `api.candidate.evaluate(spec, config)` 
- On response: set status="completed", stop timer, parse verdict, show results panels
- On error: set status="failed", stop timer, show error message
- Timer continues running during async call (no progress updates, just elapsed time)

## 10. Error handling
- StrategySpec validation errors (422 response): display field-specific error messages
- Network errors: show toast notification with retry option
- Backend errors (500): show error panel with details
- Timeout: show timeout error after 5 minutes (configurable)

## 11. Tests needed
- Frontend component tests in `frontend/src/components/__tests__/StrategyLabTab.test.jsx`:
  - Render form with default values
  - Form validation for required fields
  - Start evaluation button calls API
  - Timer updates during evaluation
  - Verdict renders correctly on success
  - Error states display appropriately
  - Gate timeline renders with correct statuses
  - Results panels show correct data

## 12. What not to touch
- Do not modify AutoQuantTab.jsx
- Do not modify RunDetailPanel.jsx
- Do not modify backend candidate orchestrator or models
- Do not modify AutoQuant pipeline files
- Do not create WebSocket endpoint in Phase 1
- Do not enable live trading
- Do not integrate with AutoQuant pipeline yet

## 13. First implementation task only
Create the StrategyLabTab.jsx component with:
1. Basic form layout for StrategySpec + CandidateConfig input
2. Start Evaluation button that calls `api.candidate.evaluate()`
3. Elapsed timer display during evaluation
4. Final verdict display showing passed/failed and gate results
5. Add tab to App.jsx routing with label "Strategy Lab"
