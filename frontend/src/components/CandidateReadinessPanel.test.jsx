/* global jest, describe, test, expect */
import { fireEvent, render, screen } from "@testing-library/react";
import CandidateReadinessPanel from "./CandidateReadinessPanel.jsx";

function report(overrides = {}) {
  return {
    schema_version: "candidate_readiness_v1",
    generated_at: "2026-07-07T00:00:00Z",
    inputs: {
      strategy_name: "AIStrategy",
      optimizer_session_id: "opt-1",
      trial_number: 7,
      backtest_run_id: "bt-1",
      candidate_run_id: "candidate-1",
      stress_session_id: "stress-1",
      temporal_stress_session_id: "temporal-1",
      profile: "intraday",
    },
    overall_score: 82,
    readiness_label: "Ready",
    status: "ready",
    gates: [
      {
        key: "backtest.net_profit",
        group: "Backtest",
        label: "Net Profit",
        status: "pass",
        reason: "Net profit: 12%",
        observed: 12,
        threshold: "> 0%",
        blocking: false,
      },
      {
        key: "validation.oos_wfo_evidence",
        group: "Validation",
        label: "OOS / WFO Evidence",
        status: "pass",
        reason: "profitable_window_pass_rate=0.8",
        observed: { profitable_window_pass_rate: 0.8 },
        threshold: "required for Ready",
        blocking: false,
      },
    ],
    blocking_failures: [],
    warnings: [],
    missing_sources: [],
    draft_next_actions: [],
    ...overrides,
  };
}

describe("CandidateReadinessPanel", () => {
  test.each([
    ["ready", "Ready", 82],
    ["watch", "Watch", 61],
    ["not_ready", "Not Ready", 34],
  ])("renders %s state", (status, label, score) => {
    render(
      <CandidateReadinessPanel
        readinessOverride={report({ status, readiness_label: label, overall_score: score })}
      />
    );

    expect(screen.getByText("Candidate Readiness")).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(String(score))).toBeInTheDocument();
  });

  test("shows missing evidence", () => {
    render(
      <CandidateReadinessPanel
        readinessOverride={report({
          status: "watch",
          readiness_label: "Watch",
          gates: [
            {
              key: "validation.oos_wfo_evidence",
              group: "Validation",
              label: "OOS / WFO Evidence",
              status: "missing",
              reason: "No OOS or walk-forward evidence is attached.",
              blocking: false,
            },
          ],
          missing_sources: [{ source: "temporal_stress_session", id: "missing", detail: "Not found." }],
        })}
      />
    );

    expect(screen.getByText("Missing Evidence")).toBeInTheDocument();
    expect(screen.getByText("Validation: OOS / WFO Evidence")).toBeInTheDocument();
    expect(screen.getByText("temporal_stress_session")).toBeInTheDocument();
  });

  test("Analyze Readiness passes exact IDs and readiness context", () => {
    const onAnalyzeReadiness = jest.fn();
    render(
      <CandidateReadinessPanel
        readinessOverride={report()}
        onAnalyzeReadiness={onAnalyzeReadiness}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Analyze Readiness/i }));

    expect(onAnalyzeReadiness).toHaveBeenCalledWith(
      expect.objectContaining({
        report: expect.objectContaining({ schema_version: "candidate_readiness_v1" }),
        message: expect.stringContaining("CandidateReadiness report"),
        context: expect.objectContaining({
          active_panel: "candidate_readiness",
          strategy_name: "AIStrategy",
          optimizer_session_id: "opt-1",
          optimizer_trial_number: 7,
          backtest_run_id: "bt-1",
          candidate_run_id: "candidate-1",
          stress_session_id: "stress-1",
          temporal_stress_session_id: "temporal-1",
          readiness_profile: "intraday",
        }),
      })
    );
  });
});
