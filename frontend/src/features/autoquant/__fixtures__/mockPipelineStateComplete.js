/**
 * Mock PipelineState for a fully completed AutoQuant run
 * Used for testing the premium pipeline UI with all stages passed
 */
export const mockPipelineStateComplete = {
  status: "completed",
  run_id: "test-run-123",
  started_at: "2024-01-01T10:00:00Z",
  completed_at: "2024-01-01T10:15:30Z",
  current_stage: 5,
  progress: 100,
  progress_percent: 100,
  stages: [
    {
      index: 0,
      name: "Pre-Flight Filtering",
      status: "passed",
      message: "Strategy validation completed successfully",
      data: {
        validation_time: 2.3,
        error_count: 0,
        warnings_found: 0,
      },
      started_at: "2024-01-01T10:00:00Z",
      duration_s: 2.3,
    },
    {
      index: 1,
      name: "Portfolio Baseline Backtest",
      status: "passed",
      message: "Baseline backtest completed",
      data: {
        total_profit: 0.15,
        max_drawdown_pct: 12.5,
        trade_count: 245,
        win_rate: 52.3,
      },
      started_at: "2024-01-01T10:00:05Z",
      duration_s: 45.2,
    },
    {
      index: 2,
      name: "WFA Hyperopt",
      status: "passed",
      message: "Hyperopt optimization completed",
      data: {
        best_parameters: { roi: "0.02", stoploss: "-0.05" },
        improvement_pct: 23.5,
        optimization_epochs: 150,
        wfo_windows: 5,
      },
      started_at: "2024-01-01T10:01:00Z",
      duration_s: 180.5,
    },
    {
      index: 3,
      name: "Robustness & Feature Injection",
      status: "passed",
      message: "Robustness checks passed",
      data: {
        robustness_score: 0.85,
        features_added: 3,
        stability_score: 0.78,
      },
      started_at: "2024-01-01T10:04:00Z",
      duration_s: 60.3,
    },
    {
      index: 4,
      name: "Portfolio Competition",
      status: "passed",
      message: "Competition analysis completed",
      data: {
        competition_score: 0.92,
        rank_position: 1,
        advantage_margin: 0.15,
      },
      started_at: "2024-01-01T10:05:00Z",
      duration_s: 120.8,
    },
    {
      index: 5,
      name: "Delivery",
      status: "passed",
      message: "Strategy files exported successfully",
      data: {
        files_created: 3,
        report_pages: 12,
        export_time: 3.2,
      },
      started_at: "2024-01-01T10:07:00Z",
      duration_s: 3.2,
    },
  ],
  wfo_windows: [],
  recent_events: [],
  generalization_failure: null,
  retry_history: [],
};
