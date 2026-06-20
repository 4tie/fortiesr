export const POLL_MS = 1500;

export const TIMEFRAMES = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
];

export const TERMINAL_STATUSES = new Set(["completed", "failed"]);

export const SORT_KEYS = {
  group: (row) => row.group ?? row.pair ?? "",
  total_profit_pct: (row) => row.total_profit_pct ?? -Infinity,
  win_rate: (row) => row.win_rate ?? -Infinity,
  sharpe_ratio: (row) => row.sharpe_ratio ?? -Infinity,
  max_drawdown: (row) => row.max_drawdown ?? -Infinity,
  total_trades: (row) => row.total_trades ?? -Infinity,
  status: (row) => row.status ?? "",
};

export const DEFAULT_SORT = {
  column: "total_profit_pct",
  direction: "desc",
};

export const PAIR_PRESETS = [
  {
    id: "configured-top-12",
    label: "Configured 12 pairs",
    pairCount: 12,
    maxTrades: 3,
  },
  {
    id: "configured-top-24",
    label: "Configured 24 pairs",
    pairCount: 24,
    maxTrades: 4,
  },
  {
    id: "configured-top-50",
    label: "Configured 50 pairs",
    pairCount: 50,
    maxTrades: 4,
  },
  {
    id: "configured-all",
    label: "All configured pairs",
    pairCount: null,
    maxTrades: 4,
  },
];

export const LAST_USED_PAIR_PRESET_ID = "last-used";
export const LAST_USED_PAIR_PRESET_STORAGE_KEY = "sl-pair-explorer-last-used";
export const LAST_USED_PAIR_PRESET_EVENT = "pair-explorer-last-used-updated";
