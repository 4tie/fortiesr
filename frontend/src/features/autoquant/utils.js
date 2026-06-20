import { LEGAL_STATUS_TRANSITIONS } from "./constants";

export function getWsUrl(runId) {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  return `${proto}://${host}/api/auto-quant/ws/${runId}`;
}

export function isValidStatusTransition(from, to) {
  if (!from || !to) return true;
  if (from === to) return true;
  const allowed = LEGAL_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function fmtMmSs(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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

export function parsePairUniverse(pairUniverse) {
  if (!pairUniverse) return null;
  const pairs = pairUniverse
    .split(/[,\n]+/)
    .map((pair) => pair.trim())
    .filter(Boolean);
  return pairs.length > 0 ? pairs : null;
}

export function playChime(type) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = type === "success"
      ? [{ freq: 523.25, start: 0 }, { freq: 659.25, start: 0.18 }]
      : [{ freq: 493.88, start: 0 }, { freq: 440.00, start: 0.18 }];
    notes.forEach(({ freq, start }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.45);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.5);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch (err) {
    console.debug("AutoQuant notification chime failed:", err);
  }
}
