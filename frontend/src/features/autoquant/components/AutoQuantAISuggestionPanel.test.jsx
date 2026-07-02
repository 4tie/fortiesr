import { describe, expect, jest, test, beforeEach } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AutoQuantAISuggestionPanel from "./AutoQuantAISuggestionPanel";
import { approveAISuggestion, rejectAISuggestion } from "../api";

jest.mock("../api", () => ({
  approveAISuggestion: jest.fn(),
  rejectAISuggestion: jest.fn(),
}));

const suggestion = {
  id: "sug-1",
  summary: "Review safer retry",
  explanation: "Sharp peak detected.",
  risk_notes: ["Approval runs validation again."],
  failure_reason: "sensitivity",
  retry_attempt: 1,
  source: "deterministic",
  status: "pending",
  original_config: {
    hyperopt_loss: "ProfitLockinHyperOptLoss",
    hyperopt_spaces: ["stoploss", "roi"],
  },
  proposed_changes: {
    hyperopt_loss: "OnlyProfitHyperOptLoss",
    hyperopt_spaces: ["roi", "stoploss"],
  },
};

function renderPanel(props = {}) {
  return render(
    <AutoQuantAISuggestionPanel
      runId="run-1"
      pipelineState={{
        pending_ai_suggestion_id: "sug-1",
        ai_suggestions: [suggestion],
      }}
      onCancel={jest.fn()}
      onReset={jest.fn()}
      {...props}
    />
  );
}

describe("AutoQuantAISuggestionPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders proposed changes and risk notes", () => {
    renderPanel();

    expect(screen.getByText("Review safer retry")).toBeInTheDocument();
    expect(screen.getByText("ProfitLockinHyperOptLoss")).toBeInTheDocument();
    expect(screen.getByText("OnlyProfitHyperOptLoss")).toBeInTheDocument();
    expect(screen.getByText("Approval runs validation again.")).toBeInTheDocument();
  });

  test("approve button calls approve endpoint", async () => {
    approveAISuggestion.mockResolvedValueOnce({
      message: "Approved",
      suggestion: { ...suggestion, status: "approved" },
    });
    renderPanel();

    fireEvent.click(screen.getByText("Approve & Retry"));

    await waitFor(() => expect(approveAISuggestion).toHaveBeenCalledWith("run-1", "sug-1"));
    expect(await screen.findByText("Approved")).toBeInTheDocument();
  });

  test("reject button shows manual next actions", async () => {
    rejectAISuggestion.mockResolvedValueOnce({
      message: "Rejected",
      suggestion: {
        ...suggestion,
        status: "rejected",
        decision: {
          manual_next_actions: [
            { id: "new_run", label: "Start a new run", description: "Choose manual settings." },
          ],
        },
      },
    });
    renderPanel();

    fireEvent.click(screen.getByText("Reject Suggestion"));

    await waitFor(() => expect(rejectAISuggestion).toHaveBeenCalledWith("run-1", "sug-1"));
    expect(await screen.findByText("Start a new run")).toBeInTheDocument();
  });
});
