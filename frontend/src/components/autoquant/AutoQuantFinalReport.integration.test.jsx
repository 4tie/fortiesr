/* global describe, expect, jest, test, beforeEach */
import { render, screen } from "@testing-library/react";
import AutoQuantFinalReport from "./AutoQuantFinalReport";

describe("AutoQuantFinalReport Integration Tests", () => {
  const mockReport = {
    run_id: "test-run-1",
    status: "completed",
    profit: 150.5,
    sharpe: 1.8,
    max_drawdown: 0.12,
    win_rate: 0.65,
    profit_factor: 2.1,
    total_trades: 42,
    wfo_windows: [
      { is_range: "20230101-20231201", oos_range: "20240101-20240601", profit: 50.2 },
      { is_range: "20230701-20240601", oos_range: "20240701-20241201", profit: 100.3 },
    ],
    monte_carlo: {
      confidence_95: 120.0,
      confidence_99: 80.0,
    },
    robustness: {
      oos_profit_ratio: 0.85,
      wfo_consistency: 0.9,
    },
    signal_strength: {
      buy_signal: 0.75,
      sell_signal: 0.68,
    },
    per_pair_profit: [
      { pair: "BTC/USDT", profit: 80.5 },
      { pair: "ETH/USDT", profit: 70.0 },
    ],
    equity_curve: [
      { timestamp: "2023-01-01", equity: 1000 },
      { timestamp: "2023-01-02", equity: 1050 },
      { timestamp: "2023-01-03", equity: 1150 },
    ],
    trade_distribution: [
      { profit_range: "0-10%", count: 15 },
      { profit_range: "10-20%", count: 20 },
      { profit_range: "20%+", count: 7 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders final report with all sections", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that main report sections are rendered
    expect(screen.getByText(/final report/i)).toBeInTheDocument();
    expect(screen.getByText(/profit/i)).toBeInTheDocument();
    expect(screen.getByText(/sharpe/i)).toBeInTheDocument();
  });

  test("integrates metric cards with report data", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that profit is displayed
    expect(screen.getByText(/150\.5/)).toBeInTheDocument();
    expect(screen.getByText(/1\.8/)).toBeInTheDocument();
  });

  test("integrates WFO windows table with report data", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that WFO windows are displayed
    expect(screen.getByText(/20230101-20231201/i)).toBeInTheDocument();
    expect(screen.getByText(/20240101-20240601/i)).toBeInTheDocument();
  });

  test("integrates Monte Carlo badge with report data", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that Monte Carlo data is displayed
    expect(screen.getByText(/monte carlo/i)).toBeInTheDocument();
  });

  test("integrates robustness badge with report data", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that robustness data is displayed
    expect(screen.getByText(/robustness/i)).toBeInTheDocument();
  });

  test("integrates signal strength visualization with report data", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that signal strength is displayed
    expect(screen.getByText(/signal strength/i)).toBeInTheDocument();
  });

  test("integrates per-pair profit chart with report data", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that per-pair profit data is displayed
    expect(screen.getByText(/BTC\/USDT/i)).toBeInTheDocument();
    expect(screen.getByText(/ETH\/USDT/i)).toBeInTheDocument();
  });

  test("integrates equity curve chart with report data", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that equity curve is displayed
    expect(screen.getByText(/equity curve/i)).toBeInTheDocument();
  });

  test("integrates trade distribution chart with report data", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that trade distribution is displayed
    expect(screen.getByText(/trade distribution/i)).toBeInTheDocument();
  });

  test("handles missing report data gracefully", () => {
    const incompleteReport = {
      run_id: "test-run-1",
      status: "completed",
      profit: null,
      sharpe: null,
    };

    render(<AutoQuantFinalReport report={incompleteReport} />);

    // Should still render without crashing
    expect(screen.getByText(/final report/i)).toBeInTheDocument();
  });

  test("displays download buttons for report files", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that download buttons are present
    const downloadButtons = screen.queryAllByText(/download/i);
    expect(downloadButtons.length).toBeGreaterThan(0);
  });

  test("formats profit values correctly", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that profit is formatted with appropriate precision
    expect(screen.getByText(/150\.5/)).toBeInTheDocument();
  });

  test("displays risk checks with report data", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Check that risk checks are displayed
    expect(screen.getByText(/risk checks/i)).toBeInTheDocument();
  });

  test("integrates all extracted components in final report", () => {
    render(<AutoQuantFinalReport report={mockReport} />);

    // Verify that key components are present
    expect(screen.getByText(/profit/i)).toBeInTheDocument();
    expect(screen.getByText(/drawdown/i)).toBeInTheDocument();
    expect(screen.getByText(/win rate/i)).toBeInTheDocument();
  });
});
