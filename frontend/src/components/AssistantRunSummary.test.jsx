import { fireEvent, render, screen } from "@testing-library/react";
import AssistantRunSummary from "./AssistantRunSummary.jsx";

describe("AssistantRunSummary deep navigation", () => {
  test("optimizer Open carries optimizer session id", () => {
    const onNavigate = jest.fn();
    render(
      <AssistantRunSummary
        contextOverrides={{ strategy_name: "Demo", optimizer_session_id: "opt-1" }}
        cards={{}}
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByText("Open Optimizer"));
    expect(onNavigate).toHaveBeenCalledWith({ tab: "optimizer", optimizer_session_id: "opt-1" });
  });

  test("backtest Open carries run id", () => {
    const onNavigate = jest.fn();
    render(
      <AssistantRunSummary
        contextOverrides={{ strategy_name: "Demo", backtest_run_id: "bt-1" }}
        cards={{}}
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByText("Open Results"));
    expect(onNavigate).toHaveBeenCalledWith({ tab: "results", run_id: "bt-1" });
  });

  test("AutoQuant Open carries run id", () => {
    const onNavigate = jest.fn();
    render(
      <AssistantRunSummary
        contextOverrides={{ strategy_name: "Demo", auto_quant_run_id: "aq-1" }}
        cards={{}}
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByText("Open AutoQuant"));
    expect(onNavigate).toHaveBeenCalledWith({ tab: "auto-quant", auto_quant_run_id: "aq-1" });
  });
});
