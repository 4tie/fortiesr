export const INITIAL_POLL_MS = 1000;
export const MAX_POLL_MS = 10000;
export const MAX_LOG = 250;
export const MIN_TRADE_THRESHOLD = 30;
export const AUTO_SAFE_PARAM_CAP = 6;

export const C_GREEN = "#059669";
export const C_RED = "#ef4444";
export const C_GRID = "#27272a";
export const C_MUTED = "#71717a";
export const C_BG = "#09090b";

export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w"];

export const SEARCH_STRATEGIES = [
  { value: "random", label: "Random" },
  { value: "grid", label: "Grid" },
  { value: "bayesian", label: "Bayesian" },
  { value: "evolutionary", label: "Evolutionary" },
];

export const SCORE_METRICS = [
  { value: "composite", label: "Composite" },
  { value: "total_profit_pct", label: "Total Profit %" },
  { value: "net_profit_abs", label: "Net Profit (abs)" },
  { value: "sharpe_ratio", label: "Sharpe Ratio" },
  { value: "profit_factor", label: "Profit Factor" },
  { value: "win_rate", label: "Win Rate" },
  { value: "max_drawdown_pct", label: "Max Drawdown %" },
  { value: "total_trades", label: "Total Trades" },
];

export const PARAMETER_MODES = [
  { value: "auto_safe", label: "Auto Safe" },
  { value: "manual", label: "Manual" },
];

export const DATE_PRESETS = [
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
  { label: "3Y", days: 1095 },
];

export const TABS = [
  { id: "setup", label: "Setup" },
  { id: "parameters", label: "Parameters" },
  { id: "live", label: "Live Results" },
  { id: "trials", label: "Trials" },
  { id: "candidate", label: "Candidate / Export" },
];

export const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);
export const EMPTY_TRIALS = [];
