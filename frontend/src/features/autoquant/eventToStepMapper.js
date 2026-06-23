/**
 * Event-to-Step Mapper
 * Canonical mapping of WebSocket event types to pipeline stage indices
 * Used by useAutoQuantPipeline to correctly route events to stage updates
 */

export const EVENT_TYPE_TO_STAGE_INDEX = {
  // Stage 1 (Pre-flight Filtering) — index 0
  "pair_selection_request": 0,
  "regime_detected": 0,
  "phase1_self_heal": 0,

  // Stage 2 (Portfolio Baseline Backtest) — index 1
  "portfolio_baseline_review": 1,

  // Stage 3 (WFA Hyperopt) — index 2
  "hyperopt_epoch": 2,
  "sensitivity_result": 2,
  "wfa_segment_result": 2,
  "self_heal_retry": 2,

  // Stage 4 (Robustness & Feature Injection) — index 3
  "stability_score_result": 3,

  // Stage 5 (Portfolio Competition) — index 4
  "portfolio_backtest_result": 4,
  "portfolio_drawdown_warning": 4,

  // Stage 6 (Delivery / Export) — index 5
  "delivery_complete": 5,

  // Optional substages (not mapped to user-facing steps, but for reference)
  // ga_complete: genetic algorithm (substage of 2.5)
  // rl_training_complete: RL training (substage of 3.5)
  // rl_deployment_complete: RL deployment (substage of 4.5)
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
  return `Stage ${stageIndex + 1}`;
}

/**
 * Get all event types that map to a specific stage index
 */
export function getEventsForStage(stageIndex) {
  return Object.entries(EVENT_TYPE_TO_STAGE_INDEX)
    .filter(([, idx]) => idx === stageIndex)
    .map(([type]) => type);
}
