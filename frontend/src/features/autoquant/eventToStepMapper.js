/**
 * Event-to-Step Mapper
 * Canonical mapping of WebSocket event types to pipeline stage indices
 * Used by useAutoQuantPipeline to correctly route events to stage updates
 */

// Stage indices are 1-based to match pipelineState.stages[].index values.
// Stages are built as: { index: i + 1, name, ... } so index 1 = Pre-flight Filtering,
// index 2 = Pair Screening, index 3 = Portfolio Baseline Backtest, etc.
export const EVENT_TYPE_TO_STAGE_INDEX = {
  // Stage 1 (Pre-flight Filtering) — index 1
  "pair_selection_request": 1,
  "regime_detected": 1,
  "phase1_self_heal": 1,

  // Stage 2 (Pair Screening) — index 2
  "pair_status": 2,
  "data_healing_status": 2,

  // Stage 3 (Portfolio Baseline Backtest) — index 3
  "portfolio_baseline_review": 3,

  // Stage 4 (WFA Hyperopt) — index 4
  "hyperopt_epoch": 4,
  "sensitivity_result": 4,
  "wfa_segment_result": 4,
  "self_heal_retry": 4,

  // Stage 5 (Robustness & Feature Injection) — index 5
  "stability_score_result": 5,

  // Stage 6 (Portfolio Competition) — index 6
  "portfolio_backtest_result": 6,
  "portfolio_drawdown_warning": 6,

  // Stage 7 (Delivery / Export) — index 7
  "delivery_complete": 7,

  // Optional substages (not mapped to user-facing steps, but for reference)
  // ga_complete: genetic algorithm (substage of 4.5)
  // rl_training_complete: RL training (substage of 5.5)
  // rl_deployment_complete: RL deployment (substage of 6.5)
};

/**
 * Map an event type to a stage index
 * Returns -1 if event is global or not stage-specific
 */
export function mapEventToStageIndex(eventType) {
  if (!eventType) return -1;
  return EVENT_TYPE_TO_STAGE_INDEX[eventType] ?? -1;
}

/**
 * Human-readable description of which stage an event updates
 */
export function describeEventMapping(eventType) {
  const stageIndex = mapEventToStageIndex(eventType);
  if (stageIndex < 0) return "Global event (no specific stage)";
  return `Stage ${stageIndex}`;
}

/**
 * Get all event types that map to a specific stage index
 */
export function getEventsForStage(stageIndex) {
  return Object.entries(EVENT_TYPE_TO_STAGE_INDEX)
    .filter(([, idx]) => idx === stageIndex)
    .map(([type]) => type);
}
