/**
 * Mock report.json with validation_status for testing FinalResultCard
 * Used for testing backend-driven status determination
 */
export const mockReportJson = {
  validation_status: "Production Ready",
  readiness_label: "Elite",
  score: 0.82,
  score_explanation: [
    "Strategy meets all validation criteria with strong performance metrics",
    "Robustness score above threshold",
    "Out-of-sample performance consistent with in-sample results",
  ],
  thresholds: {
    max_drawdown: 20,
    min_win_rate: 45,
    min_profit_factor: 1.2,
    min_sharpe: 0.6,
    min_oos_profit: 0.02,
  },
  risk: {
    profit_factor: 1.85,
    expectancy: 0.023,
    max_drawdown_pct: 14.2,
    trade_count: 312,
    sharpe_ratio: 0.78,
  },
  stress_test: {
    winning_pairs: ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"],
    total_pairs_tested: 12,
  },
  sensitivity: {
    robustness_score: 0.88,
    sensitivity_analysis: "passed",
  },
  selected_timeframe: "4h",
  timeframe: "4h",
  exchange: "binance",
  trading_style: "trend_following",
  risk_profile: "moderate",
  files: {
    strategy: "AIStrategy_Production.py",
    config: "strategy_config.json",
    report: "strategy_report.pdf",
  },
};
