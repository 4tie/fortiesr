import {
  LAST_USED_PAIR_PRESET_EVENT,
  LAST_USED_PAIR_PRESET_STORAGE_KEY,
  SORT_KEYS,
} from "./constants";
import { fromTimerangeDate, toTimerange } from "./formatters";

export function normalizeStrategy(strategy) {
  if (!strategy) return null;
  if (typeof strategy === "string") {
    return { strategy_name: strategy, name: strategy };
  }
  const strategyName = strategy.strategy_name || strategy.name || strategy.file || "";
  if (!strategyName) return null;
  return {
    ...strategy,
    strategy_name: strategyName,
    name: strategy.name || strategyName,
  };
}

export function normalizeStrategies(strategies = []) {
  const seen = new Set();
  return strategies
    .map(normalizeStrategy)
    .filter(Boolean)
    .filter((strategy) => {
      if (seen.has(strategy.strategy_name)) return false;
      seen.add(strategy.strategy_name);
      return true;
    });
}

export function sortResults(results = [], sortCol, sortDir) {
  const sortFn = SORT_KEYS[sortCol] || SORT_KEYS.group;
  return [...results].sort((a, b) => {
    const av = sortFn(a);
    const bv = sortFn(b);
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

export function rowPairs(row) {
  return row?.pairs ?? (row?.pair ? [row.pair] : []);
}

export function completedPairsFromResults(results = []) {
  return results
    .filter((row) => row.status === "completed")
    .flatMap(rowPairs);
}

export function hydrateFormFromSharedState(sharedState) {
  const patch = {};
  if (!sharedState) return patch;
  if (sharedState.strategy_name) patch.strategyName = sharedState.strategy_name;
  if (sharedState.timeframe) patch.timeframe = sharedState.timeframe;
  if (sharedState.pairs?.length) patch.pairs = sharedState.pairs;
  if (sharedState.dry_run_wallet != null) patch.wallet = String(sharedState.dry_run_wallet);
  if (sharedState.max_open_trades != null) patch.maxTrades = String(sharedState.max_open_trades);
  if (sharedState.start_date && sharedState.end_date) {
    patch.dateStart = sharedState.start_date;
    patch.dateEnd = sharedState.end_date;
  } else if (sharedState.timerange) {
    const [rawStart, rawEnd] = sharedState.timerange.split("-");
    const start = fromTimerangeDate(rawStart);
    const end = fromTimerangeDate(rawEnd);
    if (start) patch.dateStart = start;
    if (end) patch.dateEnd = end;
  }
  return patch;
}

export function sharedStatePatchFromForm(form) {
  const walletNum = parseFloat(form.wallet);
  const tradesNum = parseInt(form.maxTrades, 10);
  const patch = {};
  if (form.strategyName) patch.strategy_name = form.strategyName;
  if (form.timeframe) patch.timeframe = form.timeframe;
  if (form.dateStart) patch.start_date = form.dateStart;
  if (form.dateEnd) patch.end_date = form.dateEnd;
  if (form.dateStart && form.dateEnd) patch.timerange = toTimerange(form.dateStart, form.dateEnd);
  if (form.pairs.length) patch.pairs = form.pairs;
  if (!Number.isNaN(walletNum) && walletNum > 0) patch.dry_run_wallet = walletNum;
  if (!Number.isNaN(tradesNum) && tradesNum > 0) patch.max_open_trades = tradesNum;
  return patch;
}

export function buildStartPayload({ strategyName, pairs, timeframe, dateStart, dateEnd, wallet, maxTrades }) {
  return {
    strategy_name: strategyName,
    pairs,
    timeframe,
    timerange: toTimerange(dateStart, dateEnd),
    dry_run_wallet: parseFloat(wallet) || 1000,
    max_open_trades: parseInt(maxTrades, 10) || 1,
  };
}

function getPairPresetStorage(storage) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage || null;
}

export function normalizePresetPairs(pairs = []) {
  return [...new Set(
    pairs
      .map((pair) => String(pair || "").trim().toUpperCase())
      .filter(Boolean)
  )];
}

export function loadLastUsedPairPreset(storage) {
  try {
    const target = getPairPresetStorage(storage);
    if (!target) return null;
    const raw = target.getItem(LAST_USED_PAIR_PRESET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const pairs = normalizePresetPairs(parsed.pairs || []);
    const maxTrades = parseInt(parsed.maxTrades, 10);
    if (!pairs.length || Number.isNaN(maxTrades) || maxTrades < 1) return null;
    return {
      pairs,
      maxTrades,
      savedAt: parsed.savedAt || null,
    };
  } catch (err) {
    console.debug("Failed to load last used Pair Explorer preset:", err);
    return null;
  }
}

export function saveLastUsedPairPreset(form, storage) {
  const pairs = normalizePresetPairs(form.pairs || []);
  const maxTrades = parseInt(form.maxTrades, 10);
  if (!pairs.length || Number.isNaN(maxTrades) || maxTrades < 1) return;

  try {
    const target = getPairPresetStorage(storage);
    if (!target) return;
    target.setItem(
      LAST_USED_PAIR_PRESET_STORAGE_KEY,
      JSON.stringify({
        pairs,
        maxTrades,
        savedAt: new Date().toISOString(),
      })
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(LAST_USED_PAIR_PRESET_EVENT));
    }
  } catch (err) {
    console.debug("Failed to save last used Pair Explorer preset:", err);
  }
}
