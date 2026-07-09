/* global beforeEach, describe, expect, jest, test */
import { fireEvent, render, screen } from "@testing-library/react";
import TabContentRenderer from "./TabContentRenderer.jsx";

const mockBacktestComponent = jest.fn((props) => (
  <div data-testid="backtest-tab">
    {JSON.stringify({
      strategies: props.strategies,
      strategiesLoading: props.strategiesLoading,
      availablePairs: props.availablePairs,
      sharedState: props.sharedState,
      sharedLoading: props.sharedLoading,
      hasSearchPairs: typeof props.searchPairs === "function",
      hasSyncSharedState: typeof props.syncSharedState === "function",
      hasActiveResult: Object.prototype.hasOwnProperty.call(props, "activeResult"),
    })}
  </div>
));

const mockOptimizerComponent = jest.fn((props) => (
  <div data-testid="optimizer-tab">
    {JSON.stringify({
      strategies: props.strategies,
      hasOnAgentContextChange: typeof props.onAgentContextChange === "function",
      hasOnDirtyChange: typeof props.onDirtyChange === "function",
      deepNavigationTarget: props.deepNavigationTarget,
    })}
  </div>
));

const mockAutoQuantComponent = jest.fn((props) => (
  <button
    data-testid="auto-quant-tab"
    type="button"
    onClick={() => props.onAgentContextChange?.({
      active_tab: "auto-quant",
      active_panel: "stage-2",
      strategy_name: "AQStrategy",
      auto_quant_run_id: "aq-1",
      pipeline_status: "running",
      candidate_run_id: "candidate-1",
      api_session_id: "api-1",
      optimizer_session_id: null,
      backtest_run_id: null,
    })}
  >
    {JSON.stringify({
      deepNavigationTarget: props.deepNavigationTarget,
      hasOnAgentContextChange: typeof props.onAgentContextChange === "function",
    })}
  </button>
));

jest.mock("../ErrorBoundary.jsx", () => ({ children, tabName }) => (
  <section data-testid={`boundary-${tabName}`}>{children}</section>
));

jest.mock("../BacktestResults.jsx", () => ({ results, runId }) => (
  <div data-testid="backtest-results">
    {runId}:{results?.profit_total}
  </div>
));

jest.mock("../ResultsView.jsx", () => ({ onLoadResult }) => (
  <button type="button" onClick={() => onLoadResult({ run_id: "loaded-run", results: {} })}>
    Load result
  </button>
));

jest.mock("../tabs/registry.js", () => ({
  getTabConfig: jest.fn((tabId) => {
    const tabs = {
      backtest: {
        id: "backtest",
        label: "Backtest",
        component: mockBacktestComponent,
      },
      optimizer: {
        id: "optimizer",
        label: "Optimizer",
        component: mockOptimizerComponent,
      },
      "auto-quant": {
        id: "auto-quant",
        label: "AutoQuant",
        component: mockAutoQuantComponent,
      },
      results: {
        id: "results",
        label: "Results",
        component: () => <div>Unused registry results component</div>,
      },
    };
    return tabs[tabId] || null;
  }),
}));

describe("TabContentRenderer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders nothing for unknown tabs", () => {
    const { container } = render(
      <TabContentRenderer activeTab="missing" tabProps={{}} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("renders the results list when no result is selected", () => {
    const handleLoadResult = jest.fn();

    render(
      <TabContentRenderer
        activeTab="results"
        tabProps={{
          activeResult: null,
          clearActiveResult: jest.fn(),
          handleLoadResult,
        }}
      />
    );

    expect(screen.getByTestId("boundary-Results")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Load result"));
    expect(handleLoadResult).toHaveBeenCalledWith({ run_id: "loaded-run", results: {} });
  });

  test("renders selected result details and back navigation", () => {
    const clearActiveResult = jest.fn();

    render(
      <TabContentRenderer
        activeTab="results"
        tabProps={{
          activeResult: { run_id: "run-123", results: { profit_total: 12.5 } },
          clearActiveResult,
          handleLoadResult: jest.fn(),
        }}
      />
    );

    expect(screen.getByText("Result Details")).toBeInTheDocument();
    expect(screen.getByTestId("backtest-results")).toHaveTextContent("run-123:12.5");

    fireEvent.click(screen.getByText(/back to list/i));
    expect(clearActiveResult).toHaveBeenCalled();
  });

  test("passes only backtest dependencies to the backtest tab", () => {
    const searchPairs = jest.fn();
    const syncSharedState = jest.fn();

    render(
      <TabContentRenderer
        activeTab="backtest"
        tabProps={{
          strategies: [{ strategy_name: "SampleStrategy" }],
          strategiesLoading: true,
          availablePairs: ["BTC/USDT"],
          searchPairs,
          sharedState: { max_open_trades: 3 },
          sharedLoading: false,
          syncSharedState,
          activeResult: { run_id: "ignored" },
          onAgentContextChange: jest.fn(),
        }}
      />
    );

    expect(screen.getByTestId("boundary-Backtest")).toBeInTheDocument();
    expect(mockBacktestComponent).toHaveBeenCalledTimes(1);
    expect(JSON.parse(screen.getByTestId("backtest-tab").textContent)).toEqual({
      strategies: [{ strategy_name: "SampleStrategy" }],
      strategiesLoading: true,
      availablePairs: ["BTC/USDT"],
      sharedState: { max_open_trades: 3 },
      sharedLoading: false,
      hasSearchPairs: true,
      hasSyncSharedState: true,
      hasActiveResult: false,
    });
  });

  test("passes full tab props to standard tabs", () => {
    const onAgentContextChange = jest.fn();
    const onDirtyChange = jest.fn();

    render(
      <TabContentRenderer
        activeTab="optimizer"
        tabProps={{
          strategies: [{ strategy_name: "OptStrategy" }],
          onAgentContextChange,
          onDirtyChange,
          deepNavigationTarget: { tab: "optimizer", optimizer_session_id: "opt-1" },
        }}
      />
    );

    expect(screen.getByTestId("boundary-Optimizer")).toBeInTheDocument();
    expect(mockOptimizerComponent).toHaveBeenCalledTimes(1);
    expect(JSON.parse(screen.getByTestId("optimizer-tab").textContent)).toEqual({
      strategies: [{ strategy_name: "OptStrategy" }],
      hasOnAgentContextChange: true,
      hasOnDirtyChange: true,
      deepNavigationTarget: { tab: "optimizer", optimizer_session_id: "opt-1" },
    });
  });

  test("passes AutoQuant context callback and deep navigation target through wrapper", () => {
    const onAgentContextChange = jest.fn();

    render(
      <TabContentRenderer
        activeTab="auto-quant"
        tabProps={{
          strategies: [{ strategy_name: "AQStrategy" }],
          onAgentContextChange,
          deepNavigationTarget: { tab: "auto-quant", auto_quant_run_id: "aq-1" },
        }}
      />
    );

    expect(screen.getByTestId("boundary-AutoQuant")).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId("auto-quant-tab").textContent)).toEqual({
      deepNavigationTarget: { tab: "auto-quant", auto_quant_run_id: "aq-1" },
      hasOnAgentContextChange: true,
    });

    fireEvent.click(screen.getByTestId("auto-quant-tab"));
    expect(onAgentContextChange).toHaveBeenCalledWith(expect.objectContaining({
      active_tab: "auto-quant",
      active_panel: "stage-2",
      auto_quant_run_id: "aq-1",
      candidate_run_id: "candidate-1",
      api_session_id: "api-1",
      optimizer_session_id: null,
      backtest_run_id: null,
    }));
  });
});
