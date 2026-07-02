import { describe, it, expect } from "@jest/globals";
import {
  mapEventToStageIndex,
  describeEventMapping,
  getEventsForStage,
  EVENT_TYPE_TO_STAGE_INDEX,
} from "./eventToStepMapper";

describe("eventToStepMapper", () => {
  // --- Index scheme ---
  it("all mapped indices are 1-based (>= 1)", () => {
    const indices = Object.values(EVENT_TYPE_TO_STAGE_INDEX);
    expect(indices.every((i) => i >= 1)).toBe(true);
  });

  it("covers exactly 6 unique stage indices (1–6)", () => {
    const unique = new Set(Object.values(EVENT_TYPE_TO_STAGE_INDEX));
    expect(unique.size).toBe(6);
    for (let i = 1; i <= 6; i++) expect(unique.has(i)).toBe(true);
  });

  // --- Stage 1: Pre-flight Filtering (includes pair_status, data_healing_status) ---
  it("pair_status → Stage 1 (Pre-flight Filtering)", () => {
    expect(mapEventToStageIndex("pair_status")).toBe(1);
  });

  it("data_healing_status → Stage 1 (Pre-flight Filtering)", () => {
    expect(mapEventToStageIndex("data_healing_status")).toBe(1);
  });

  // --- Stage 2: Portfolio Baseline Backtest ---
  it("portfolio_baseline_review → Stage 2 (Portfolio Baseline Backtest)", () => {
    expect(mapEventToStageIndex("portfolio_baseline_review")).toBe(2);
  });

  // --- Stage 3: WFA Hyperopt ---
  it("hyperopt_epoch → Stage 3 (WFA Hyperopt)", () => {
    expect(mapEventToStageIndex("hyperopt_epoch")).toBe(3);
  });

  it("sensitivity_result → Stage 3 (WFA Hyperopt)", () => {
    expect(mapEventToStageIndex("sensitivity_result")).toBe(3);
  });

  it("wfa_segment_result → Stage 3 (WFA Hyperopt)", () => {
    expect(mapEventToStageIndex("wfa_segment_result")).toBe(3);
  });

  // --- Stage 6: Delivery / Export ---
  it("delivery_complete → Stage 6 (Delivery / Export)", () => {
    expect(mapEventToStageIndex("delivery_complete")).toBe(6);
  });

  // --- Stage 1: Pre-flight Filtering ---
  it("pair_selection_request → Stage 1 (Pre-flight Filtering)", () => {
    expect(mapEventToStageIndex("pair_selection_request")).toBe(1);
  });

  it("regime_detected → Stage 1 (Pre-flight Filtering)", () => {
    expect(mapEventToStageIndex("regime_detected")).toBe(1);
  });

  // --- Stage 4: Robustness ---
  it("stability_score_result → Stage 4 (Robustness)", () => {
    expect(mapEventToStageIndex("stability_score_result")).toBe(4);
  });

  // --- Stage 5: Portfolio Competition ---
  it("portfolio_backtest_result → Stage 5 (Portfolio Competition)", () => {
    expect(mapEventToStageIndex("portfolio_backtest_result")).toBe(5);
  });

  it("portfolio_drawdown_warning → Stage 5 (Portfolio Competition)", () => {
    expect(mapEventToStageIndex("portfolio_drawdown_warning")).toBe(5);
  });

  // --- Unknown / safe fallback ---
  it("unknown event type → -1", () => {
    expect(mapEventToStageIndex("unknown_event")).toBe(-1);
  });

  it("null event type → -1", () => {
    expect(mapEventToStageIndex(null)).toBe(-1);
  });

  it("undefined event type → -1", () => {
    expect(mapEventToStageIndex(undefined)).toBe(-1);
  });

  it("empty string → -1", () => {
    expect(mapEventToStageIndex("")).toBe(-1);
  });

  // --- hyperopt_progress is NOT in the map (handled separately in pipeline hook) ---
  it("hyperopt_progress → -1 (handled by dedicated pipeline hook branch)", () => {
    expect(mapEventToStageIndex("hyperopt_progress")).toBe(-1);
  });

  // --- describeEventMapping ---
  it("describeEventMapping returns Stage N for known event", () => {
    expect(describeEventMapping("portfolio_baseline_review")).toBe("Stage 2");
  });

  it("describeEventMapping returns global message for unknown event", () => {
    expect(describeEventMapping("unknown")).toBe("Global event (no specific stage)");
  });

  // --- getEventsForStage ---
  it("getEventsForStage(1) returns pair_status and data_healing_status", () => {
    const events = getEventsForStage(1);
    expect(events).toContain("pair_status");
    expect(events).toContain("data_healing_status");
  });

  it("getEventsForStage(6) returns delivery_complete", () => {
    const events = getEventsForStage(6);
    expect(events).toContain("delivery_complete");
  });

  it("getEventsForStage(99) returns empty array", () => {
    expect(getEventsForStage(99)).toEqual([]);
  });
});
