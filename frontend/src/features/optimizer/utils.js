import { AUTO_SAFE_PARAM_CAP } from "./constants";
import { toTimerange } from "./formatters";

export function parsePairs(text) {
  return String(text || "").split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
}

export function inferSpace(sp) {
  if (sp.space) return sp.space;
  if (sp.name?.startsWith("roi__")) return "roi";
  if (sp.name?.startsWith("trailing__")) return "trailing";
  if (sp.name?.startsWith("stoploss__")) return "stoploss";
  return "custom";
}

export function groupLabel(space) {
  const labels = {
    buy: "Buy",
    sell: "Sell",
    protection: "Protection",
    roi: "ROI",
    stoploss: "Stoploss",
    trailing: "Trailing",
    custom: "Custom",
    other: "Other",
  };
  return labels[space] || space;
}

export function autoSafeSpaces(spaces) {
  let enabledCount = 0;
  return spaces.map((sp) => {
    const group = inferSpace(sp);
    const shouldEnable = (
      (group === "buy" || group === "sell") &&
      sp.optimizable !== false &&
      enabledCount < AUTO_SAFE_PARAM_CAP
    );
    if (shouldEnable) enabledCount += 1;
    return { ...sp, enabled: shouldEnable };
  });
}

export function gridEstimate(spaces) {
  const enabled = spaces.filter((s) => s.enabled);
  if (!enabled.length) return 0;
  let total = 1;
  for (const sp of enabled) {
    let count = 1;
    if (sp.param_type === "boolean") count = sp.choices?.length || 2;
    else if (sp.param_type === "categorical") count = sp.choices?.length || 1;
    else if (sp.min_value != null && sp.max_value != null) {
      const step = Number(sp.step || (sp.param_type === "int" ? 1 : 0.01));
      count = Math.max(1, Math.floor((Number(sp.max_value) - Number(sp.min_value)) / Math.max(step, 0.000001)) + 1);
    }
    total *= count;
    if (total > 1000000) return total;
  }
  return total;
}

export function groupedSearchSpaces(searchSpaces) {
  const order = ["buy", "sell", "protection", "roi", "stoploss", "trailing", "custom", "other"];
  const groups = new Map(order.map((key) => [key, []]));
  for (const sp of searchSpaces) {
    const key = groups.has(inferSpace(sp)) ? inferSpace(sp) : "other";
    groups.get(key).push(sp);
  }
  return order.map((key) => ({ key, label: groupLabel(key), items: groups.get(key) })).filter((g) => g.items.length);
}

export function buildOptimizerRunPayload({
  strategyName,
  dateStart,
  dateEnd,
  timeframe,
  pairList,
  totalTrials,
  searchStrategy,
  parameterMode,
  scoreMetric,
  maxOpenTrades,
  wallet,
  searchSpaces,
}) {
  return {
    strategy_name: strategyName,
    timerange: toTimerange(dateStart, dateEnd),
    timeframe,
    pairs: pairList,
    total_trials: totalTrials,
    search_strategy: searchStrategy,
    parameter_mode: parameterMode,
    score_metric: scoreMetric,
    max_open_trades: maxOpenTrades,
    dry_run_wallet: wallet,
    fee_rate: 0.001,
    search_spaces: searchSpaces,
  };
}

export function statusClass(status) {
  const map = {
    completed: "bg-success/15 text-success border-success/30",
    running: "bg-primary/15 text-primary border-primary/30",
    failed: "bg-error/15 text-error border-error/30",
    cancelled: "bg-warning/15 text-warning border-warning/30",
    pruned: "bg-warning/15 text-warning border-warning/30",
    pending: "bg-base-300/40 text-base-content/40 border-base-300/50",
  };
  return map[status] || map.pending;
}
