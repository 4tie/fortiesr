import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../services/api.js";
import StrategySpecPreview from "./StrategySpecPreview.jsx";

const GATE_NAMES = [
  "strategy_spec",
  "render_strategy",
  "save_working_copy",
  "data_quality",
  "data_download",
  "backtest_gate",
  "failure_analyzer",
  "repair_plan",
  "repair_attempts",
  "individual_pair_sweep",
  "portfolio_backtest",
  "final_pair_decision",
];

const GATE_LABELS = {
  strategy_spec: "Strategy Spec",
  render_strategy: "Render Strategy",
  save_working_copy: "Save Working Copy",
  data_quality: "Data Quality",
  data_download: "Data Download",
  backtest_gate: "Backtest Gate",
  failure_analyzer: "Failure Analyzer",
  repair_plan: "Repair Plan",
  repair_attempts: "Repair Attempts",
  individual_pair_sweep: "Individual Pair Sweep",
  portfolio_backtest: "Portfolio Backtest",
  final_pair_decision: "Final Pair Decision",
};

const VALID_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];
const HORIZON_TIMEFRAMES = {
  scalping: ["1m", "5m", "15m"],
  intraday: ["15m", "30m", "1h"],
  swing: ["1h", "4h", "1d"],
};
const STRATEGY_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const DEFAULT_MANUAL_PAIRS = "BTC/USDT, ETH/USDT";

const AUTO_PAIR_UNIVERSES = {
  scalping: ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "DOGE/USDT", "ADA/USDT", "AVAX/USDT", "LINK/USDT", "LTC/USDT", "TRX/USDT", "DOT/USDT"],
  intraday: ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "ADA/USDT", "AVAX/USDT", "LINK/USDT", "LTC/USDT", "DOT/USDT"],
  swing: ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT", "ADA/USDT"],
};

const AUTO_PAIR_COUNTS = {
  scalping: { low: 8, balanced: 10, aggressive: 12 },
  intraday: { low: 6, balanced: 8, aggressive: 10 },
  swing: { low: 3, balanced: 5, aggressive: 6 },
};

const STYLE_DEFAULT_NAMES = {
  trend_following: "TrendFollowingStrategy",
  mean_reversion: "MeanReversionStrategy",
  momentum: "MomentumStrategy",
  breakout: "BreakoutStrategy",
};

const RISK_RULES = {
  low: {
    stoploss: -0.05,
    maxOpenTrades: 2,
    maxIterations: (requested) => Math.min(requested, 2),
    adxEntry: 30,
    rsiLowEntry: 25,
    rsiExit: 65,
  },
  balanced: {
    stoploss: -0.10,
    maxOpenTrades: 3,
    maxIterations: (requested) => requested,
    adxEntry: 25,
    rsiLowEntry: 30,
    rsiExit: 70,
  },
  aggressive: {
    stoploss: -0.15,
    maxOpenTrades: 5,
    maxIterations: (requested) => Math.min(Math.max(requested, 5), 10),
    adxEntry: 20,
    rsiLowEntry: 35,
    rsiExit: 78,
  },
};

const DEFAULT_SIMPLE_FORM = {
  strategyName: STYLE_DEFAULT_NAMES.trend_following,
  tradingStyle: "trend_following",
  tradingHorizon: "scalping",
  direction: "long",
  riskProfile: "balanced",
  timeframe: "5m",
  maxIterations: "3",
  pairUniverseMode: "auto",
  pairs: DEFAULT_MANUAL_PAIRS,
};

const DEFAULT_CANDIDATE_CONFIG = {
  timerange: "20240101-20240401",
  timeframe: "5m",
  pairs: ["BTC/USDT", "ETH/USDT"],
  user_data_dir: "user_data",
  config_file: "config.json",
  exchange: "binance",
  max_repair_iterations: 3,
  auto_download_data: true,
  max_data_download_attempts: 1,
};

function clampMaxIterations(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return 3;
  return Math.min(Math.max(parsed, 1), 10);
}

function parsePairUniverse(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((pair) => pair.trim())
    .filter(Boolean);
}

function getAutoPairsForSimpleMode(form) {
  const horizon = form.tradingHorizon || "scalping";
  const risk = form.riskProfile || "balanced";
  const universe = AUTO_PAIR_UNIVERSES[horizon] || AUTO_PAIR_UNIVERSES.scalping;
  const count = AUTO_PAIR_COUNTS[horizon]?.[risk] || AUTO_PAIR_COUNTS.scalping.balanced;
  return universe.slice(0, count);
}

function getSimpleModePairs(form) {
  if (form.pairUniverseMode === "manual") {
    return parsePairUniverse(form.pairs);
  }
  return getAutoPairsForSimpleMode(form);
}

function getTimeframeCompatibilityError(form) {
  const horizon = form.tradingHorizon || "scalping";
  const allowed = HORIZON_TIMEFRAMES[horizon] || [];
  if (!allowed.length || allowed.includes(form.timeframe)) {
    return null;
  }
  return `${horizon} supports ${allowed.join(", ")} timeframes. Current timeframe ${form.timeframe} is incompatible.`;
}

function getPresetForm(tradingStyle = "trend_following") {
  return {
    ...DEFAULT_SIMPLE_FORM,
    tradingStyle,
    strategyName: STYLE_DEFAULT_NAMES[tradingStyle] || STYLE_DEFAULT_NAMES.trend_following,
  };
}

function buildPresetSignals(tradingStyle, risk) {
  if (tradingStyle === "mean_reversion") {
    return {
      indicators: [
        { name: "rsi", params: { period: 14 } },
        { name: "bbands", params: { period: 20, stddev: 2 } },
      ],
      entry_conditions: [
        {
          type: "indicator_threshold",
          indicator_a: "rsi",
          operator: "<",
          value_or_indicator_b: risk.rsiLowEntry,
        },
      ],
      exit_conditions: [
        {
          type: "indicator_threshold",
          indicator_a: "rsi",
          operator: ">",
          value_or_indicator_b: risk.rsiExit,
        },
      ],
    };
  }

  if (tradingStyle === "momentum") {
    return {
      indicators: [
        { name: "macd", params: { fast: 12, slow: 26, signal: 9 } },
        { name: "rsi", params: { period: 14 } },
      ],
      entry_conditions: [
        {
          type: "indicator_threshold",
          indicator_a: "macd",
          operator: ">",
          value_or_indicator_b: 0,
        },
      ],
      exit_conditions: [
        {
          type: "indicator_threshold",
          indicator_a: "rsi",
          operator: ">",
          value_or_indicator_b: risk.rsiExit,
        },
      ],
    };
  }

  if (tradingStyle === "breakout") {
    return {
      indicators: [
        { name: "adx", params: { period: 14 } },
        { name: "atr", params: { period: 14 } },
        { name: "rsi", params: { period: 14 } },
      ],
      entry_conditions: [
        {
          type: "indicator_threshold",
          indicator_a: "adx",
          operator: ">",
          value_or_indicator_b: risk.adxEntry + 5,
        },
      ],
      exit_conditions: [
        {
          type: "indicator_threshold",
          indicator_a: "rsi",
          operator: ">",
          value_or_indicator_b: risk.rsiExit,
        },
      ],
    };
  }

  return {
    indicators: [
      { name: "adx", params: { period: 14 } },
      { name: "rsi", params: { period: 14 } },
    ],
    entry_conditions: [
      {
        type: "indicator_threshold",
        indicator_a: "adx",
        operator: ">",
        value_or_indicator_b: risk.adxEntry,
      },
    ],
    exit_conditions: [
      {
        type: "indicator_threshold",
        indicator_a: "rsi",
        operator: ">",
        value_or_indicator_b: risk.rsiExit,
      },
    ],
  };
}

function buildStrategySpecFromSimpleMode(form) {
  const risk = RISK_RULES[form.riskProfile] || RISK_RULES.balanced;
  const requestedMaxIterations = clampMaxIterations(form.maxIterations);
  const preset = buildPresetSignals(form.tradingStyle, risk);

  return {
    name: String(form.strategyName || "").trim(),
    description: `${form.tradingStyle} preset, ${form.tradingHorizon} horizon, ${form.riskProfile} risk, ${form.direction} direction.`,
    timeframe: form.timeframe,
    trading_style: form.tradingStyle,
    indicators: preset.indicators,
    entry_conditions: preset.entry_conditions,
    exit_conditions: preset.exit_conditions,
    stoploss: risk.stoploss,
    trailing: { trailing_stop: false },
    position_sizing: { method: "fixed" },
    max_open_trades: risk.maxOpenTrades,
    roi: [],
    max_iterations: risk.maxIterations(requestedMaxIterations),
    iteration_count: 0,
    parent_spec_hash: "",
  };
}

function validateIndicatorReferences(spec) {
  const errors = [];
  const indicatorSet = new Set((spec.indicators || []).map((indicator) => indicator.name));
  const conditions = [...(spec.entry_conditions || []), ...(spec.exit_conditions || [])];

  conditions.forEach((condition) => {
    if (!indicatorSet.has(condition.indicator_a)) {
      errors.push(`Unknown indicator reference: ${condition.indicator_a}`);
    }
    if (typeof condition.value_or_indicator_b === "string" && !indicatorSet.has(condition.value_or_indicator_b)) {
      errors.push(`Unknown indicator reference: ${condition.value_or_indicator_b}`);
    }
  });

  return errors;
}

function validateSimpleMode(form, spec) {
  const errors = [];
  const requestedMaxIterations = Number.parseInt(form.maxIterations, 10);
  const timeframeCompatibilityError = getTimeframeCompatibilityError(form);

  if (!STRATEGY_NAME_RE.test(String(form.strategyName || "").trim())) {
    errors.push("Strategy name must start with a letter and use only letters, numbers, or underscores.");
  }
  if (!VALID_TIMEFRAMES.includes(form.timeframe)) {
    errors.push("Select a valid timeframe.");
  } else if (timeframeCompatibilityError) {
    errors.push(timeframeCompatibilityError);
  }
  if (!Number.isInteger(requestedMaxIterations) || requestedMaxIterations < 1 || requestedMaxIterations > 10) {
    errors.push("Max iterations must be between 1 and 10.");
  }
  if (getSimpleModePairs(form).length === 0) {
    errors.push("At least one pair is required.");
  }
  if (form.direction !== "long") {
    errors.push("Only long direction is supported for now.");
  }
  if (!spec.indicators || spec.indicators.length === 0) {
    errors.push("Generated spec must include at least one indicator.");
  }
  if (!spec.entry_conditions || spec.entry_conditions.length === 0) {
    errors.push("Generated spec must include at least one entry condition.");
  }
  if (!spec.exit_conditions || spec.exit_conditions.length === 0) {
    errors.push("Generated spec must include at least one exit condition.");
  }

  return [...errors, ...validateIndicatorReferences(spec)];
}

function buildCandidateConfigFromSimpleMode(form, configText, generatedSpec) {
  let baseConfig = DEFAULT_CANDIDATE_CONFIG;
  try {
    const parsedConfig = JSON.parse(configText);
    if (parsedConfig && typeof parsedConfig === "object" && !Array.isArray(parsedConfig)) {
      baseConfig = { ...DEFAULT_CANDIDATE_CONFIG, ...parsedConfig };
    }
  } catch {
    baseConfig = DEFAULT_CANDIDATE_CONFIG;
  }

  return {
    ...baseConfig,
    timeframe: form.timeframe,
    pairs: getSimpleModePairs(form),
    max_repair_iterations: generatedSpec.max_iterations,
    auto_download_data: true,
    max_data_download_attempts: 1,
    risk_profile: form.riskProfile,
  };
}

function formatElapsed(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function StatusBadge({ status }) {
  const config = {
    idle: { class: "badge-neutral", label: "Idle" },
    running: { class: "badge-primary", label: "Running" },
    completed: { class: "badge-success", label: "Completed" },
    failed: { class: "badge-error", label: "Failed" },
  };
  const { class: className, label } = config[status] || config.idle;
  return <span className={`badge ${className}`}>{label}</span>;
}

function GateIcon({ status }) {
  if (status === "running") {
    return <span className="loading loading-spinner loading-xs text-primary" />;
  }
  if (status === "passed") {
    return <span className="text-success text-sm font-bold">✓</span>;
  }
  if (status === "failed") {
    return <span className="text-error text-sm font-bold">✗</span>;
  }
  return <span className="text-base-content/25 text-sm">○</span>;
}

function GateCard({ gate, onDownloadPair, downloadingPairs, downloadErrors, strategyTimeframes, strategyEndDate }) {
  const statusColors = {
    pending: "border border-base-300/40 opacity-60",
    running: "bg-primary/15 border border-primary/30 shadow-sm shadow-primary/10",
    passed: "bg-success/8 border border-success/20",
    failed: "bg-error/10 border border-error/25",
    skipped: "border border-base-300/40 opacity-40",
  };

  const statusColor = statusColors[gate.status] || statusColors.pending;
  const insufficientHistoryErrors = parseInsufficientHistoryErrors(gate.errors || []);

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${statusColor}`}>
      <div className="flex flex-col items-center shrink-0 gap-0.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${
          gate.status === "running"
            ? "bg-primary/20"
            : gate.status === "passed"
            ? "bg-success/15"
            : gate.status === "failed"
            ? "bg-error/15"
            : "bg-base-300/50"
        }`}>
          <GateIcon status={gate.status} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${
            gate.status === "running" ? "text-primary" :
            gate.status === "passed" ? "text-success/90" :
            gate.status === "failed" ? "text-error" :
            "text-base-content/40"
          }`}>
            {GATE_LABELS[gate.gate_name] || gate.gate_name}
          </span>
          {gate.status === "running" && (
            <span className="badge badge-xs badge-primary animate-pulse">live</span>
          )}
          {gate.duration_s != null && gate.status !== "running" && (
            <span className="text-[10px] font-mono text-base-content/35 tabular-nums">{gate.duration_s}s</span>
          )}
        </div>
        {gate.message && (
          <p className="text-xs text-base-content/60 mt-1 leading-relaxed line-clamp-2">
            {gate.message}
          </p>
        )}
        {gate.errors && gate.errors.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {gate.errors.map((error, idx) => {
              const insufficientError = insufficientHistoryErrors.find(e => error.includes(e.pair));
              const isDownloading = insufficientError && downloadingPairs.has(insufficientError.pair);
              const downloadError = insufficientError && downloadErrors[insufficientError.pair];

              return (
                <div key={idx} className="flex items-center gap-1">
                  <span className="badge badge-xs badge-error badge-outline">
                    {error}
                  </span>
                  {insufficientError && onDownloadPair && (
                    <button
                      className="btn btn-xs btn-ghost btn-primary h-5 min-h-5 px-1.5 py-0 text-[10px]"
                      onClick={() => onDownloadPair(
                        insufficientError.pair,
                        insufficientError.requiredDate,
                        strategyTimeframes,
                        strategyEndDate
                      )}
                      disabled={isDownloading}
                      title={isDownloading ? "Downloading..." : "Download missing data"}
                    >
                      {isDownloading ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        "↓"
                      )}
                    </button>
                  )}
                  {downloadError && (
                    <span className="text-[9px] text-error ml-1">{downloadError}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {gate.metrics && Object.keys(gate.metrics).length > 0 && (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {Object.entries(gate.metrics).slice(0, 3).map(([key, value]) => (
              <span key={key} className="text-[10px] font-mono text-base-content/50">
                {key}: {typeof value === 'number' ? value.toFixed(2) : value}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GateTimeline({ gates, onDownloadPair, downloadingPairs, downloadErrors, strategyTimeframes, strategyEndDate }) {
  if (!gates || gates.length === 0) {
    return (
      <div className="text-center py-8 text-base-content/40 text-sm">
        No gate data available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {gates.map((gate, idx) => (
        <GateCard
          key={gate.gate_name || idx}
          gate={gate}
          onDownloadPair={onDownloadPair}
          downloadingPairs={downloadingPairs}
          downloadErrors={downloadErrors}
          strategyTimeframes={strategyTimeframes}
          strategyEndDate={strategyEndDate}
        />
      ))}
    </div>
  );
}

function BacktestMetricsCard({ metrics }) {
  if (!metrics || Object.keys(metrics).length === 0) {
    return null;
  }

  const metricLabels = {
    total_trades: "Total Trades",
    win_rate: "Win Rate",
    win_rate_pct: "Win Rate",
    profit_factor: "Profit Factor",
    max_drawdown: "Max Drawdown",
    max_drawdown_pct: "Max Drawdown",
    expectancy: "Expectancy",
    sharpe_ratio: "Sharpe Ratio",
  };

  return (
    <div className="card bg-base-200 border border-base-300">
      <div className="card-body p-4">
        <h3 className="font-semibold text-sm mb-3">Backtest Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="bg-base-100 rounded-lg p-2.5">
              <div className="text-xs text-base-content/60 mb-1">{metricLabels[key] || key}</div>
              <div className="text-sm font-semibold tabular-nums">
                {typeof value === 'number' ? value.toFixed(4) : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PairSweepTable({ pairResults }) {
  if (!pairResults || pairResults.length === 0) {
    return null;
  }

  return (
    <div className="card bg-base-200 border border-base-300">
      <div className="card-body p-4">
        <h3 className="font-semibold text-sm mb-3">Pair Sweep Results</h3>
        <div className="overflow-x-auto">
          <table className="table table-sm table-zebra">
            <thead>
              <tr>
                <th>Pair</th>
                <th>Status</th>
                <th>Profit Factor</th>
                <th>Drawdown</th>
                <th>Trades</th>
              </tr>
            </thead>
            <tbody>
              {pairResults.map((result, idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs">{result.pair}</td>
                  <td>
                    <span className={`badge badge-xs ${
                      result.status === 'approved' || result.status === 'passed'
                        ? 'badge-success'
                        : 'badge-error'
                    }`}>
                      {result.status}
                    </span>
                  </td>
                  <td className="font-mono text-xs">{result.profit_factor?.toFixed(2) || '-'}</td>
                  <td className="font-mono text-xs">{result.max_drawdown?.toFixed(2) || '-'}</td>
                  <td className="font-mono text-xs">{result.total_trades || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function findGateResult(verdict, gateName) {
  return (verdict?.gate_results || []).find((gate) => gate.gate_name === gateName);
}

function getBacktestMetrics(verdict) {
  return verdict?.backtest_metrics || findGateResult(verdict, "backtest_gate")?.metrics || null;
}

function getPairSweepResults(verdict) {
  return verdict?.pair_results || findGateResult(verdict, "individual_pair_sweep")?.details?.results || [];
}

function parseMissingPairsFromErrors(errors) {
  return (errors || [])
    .filter((error) => typeof error === "string" && error.startsWith("MISSING_DATA_FILE:"))
    .map((error) => error.split(":", 2)[1]?.split("-", 1)[0]?.trim())
    .filter(Boolean);
}

function parseInsufficientHistoryErrors(errors) {
  return (errors || [])
    .filter((error) => typeof error === "string" && error.startsWith("INSUFFICIENT_HISTORY:"))
    .map((error) => {
      const match = error.match(/INSUFFICIENT_HISTORY:\s*(\S+)\s*-\s*data starts at\s*(\d+),\s*required\s*(\d+)/);
      if (match) {
        return {
          pair: match[1],
          actualDate: match[2],
          requiredDate: match[3],
        };
      }
      return null;
    })
    .filter(Boolean);
}

function getDataQualityFailure(gates, verdict) {
  const liveGate = (gates || []).find((gate) => (
    gate.gate_name === "data_quality" && gate.status === "failed"
  ));
  const verdictGate = findGateResult(verdict, "data_quality");
  const source = liveGate || (verdictGate?.passed === false ? verdictGate : null);
  if (!source) return null;

  const details = source.details || {};
  const errors = source.errors || details.errors || [];
  const missingPairs = details.missing_pairs?.length
    ? details.missing_pairs
    : parseMissingPairsFromErrors(errors);

  return {
    errors,
    missingPairs,
    timeframe: details.timeframe,
    timerange: details.timerange,
    configFile: details.config_file,
    userDataDir: details.user_data_dir,
    downloadCommandHint: details.download_command_hint,
  };
}

function DataQualityFailurePanel({ failure }) {
  if (!failure) return null;

  return (
    <div className="alert alert-warning mb-6 items-start">
      <div className="space-y-2">
        <div className="font-semibold">Market data is missing or insufficient.</div>
        <div className="text-sm">
          Download the required data before running this Strategy Lab evaluation.
        </div>
        {failure.missingPairs.length > 0 && (
          <div className="text-sm">
            <span className="font-medium">Missing pairs: </span>
            <span className="font-mono">{failure.missingPairs.join(", ")}</span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {failure.timeframe && <div>Timeframe: <span className="font-mono">{failure.timeframe}</span></div>}
          {failure.timerange && <div>Timerange: <span className="font-mono">{failure.timerange}</span></div>}
          {failure.configFile && <div>Config: <span className="font-mono">{failure.configFile}</span></div>}
          {failure.userDataDir && <div>User data: <span className="font-mono">{failure.userDataDir}</span></div>}
        </div>
        {failure.downloadCommandHint && (
          <div className="mockup-code text-xs max-w-full overflow-x-auto">
            <pre data-prefix="$"><code>{failure.downloadCommandHint}</code></pre>
          </div>
        )}
        {failure.errors.length > 0 && (
          <div className="text-xs text-base-content/70">
            {failure.errors.join(" ")}
          </div>
        )}
      </div>
    </div>
  );
}

function RepairAttemptsList({ repairAttempts }) {
  if (!repairAttempts || repairAttempts.length === 0) {
    return null;
  }

  return (
    <div className="card bg-base-200 border border-base-300">
      <div className="card-body p-4">
        <h3 className="font-semibold text-sm mb-3">Repair Attempts</h3>
        <div className="space-y-2">
          {repairAttempts.map((attempt, idx) => (
            <div key={idx} className="bg-base-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Iteration {attempt.iteration}</span>
                <span className={`badge badge-xs ${
                  attempt.outcome === "success" ? "badge-success" : "badge-error"
                }`}>
                  {attempt.outcome}
                </span>
              </div>
              {attempt.scope && (
                <div className="text-xs text-base-content/60 mb-1">Scope: {attempt.scope}</div>
              )}
              {attempt.change_applied && (
                <div className="text-xs text-base-content/50 font-mono bg-base-200 rounded p-1.5">
                  {JSON.stringify(attempt.change_applied, null, 2)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StrategyLabTab() {
  const [status, setStatus] = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [runId, setRunId] = useState(null);
  const [error, setError] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [gates, setGates] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const [currentGateName, setCurrentGateName] = useState(null);
  const [inputMode, setInputMode] = useState("simple");
  const [simpleForm, setSimpleForm] = useState(DEFAULT_SIMPLE_FORM);
  const [spec, setSpec] = useState(JSON.stringify(
    buildStrategySpecFromSimpleMode(DEFAULT_SIMPLE_FORM),
    null,
    2
  ));

  const [config, setConfig] = useState(JSON.stringify(DEFAULT_CANDIDATE_CONFIG, null, 2));

  // Download state
  const [downloadingPairs, setDownloadingPairs] = useState(new Set());
  const [downloadErrors, setDownloadErrors] = useState({});

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const wsRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const runActiveRef = useRef(false);
  const downloadPollRef = useRef(null);

  // Timer effect
  useEffect(() => {
    if (status === "running") {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsedSecs = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsed(elapsedSecs);
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  // Cleanup WebSocket and polling on unmount
  useEffect(() => {
    return () => {
      runActiveRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Polling fallback for WebSocket
  const startPolling = useCallback((runId) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    const pollOnce = async () => {
      try {
        const runState = await api.candidate.getRun(runId);
        
        if (runState.status === "completed" || runState.status === "failed") {
          runActiveRef.current = false;
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setStatus(runState.status);
          if (runState.verdict) {
            setVerdict(runState.verdict);
          }
          if (runState.gates) {
            setGates(runState.gates);
          }
          if (runState.status === "failed" && runState.error) {
            setError(runState.error);
          }
        } else if (runState.gates) {
          setGates(runState.gates);
          const runningGate = runState.gates.find(g => g.status === "running");
          setCurrentGateName(runningGate?.gate_name || null);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    pollOnce();
    pollIntervalRef.current = setInterval(pollOnce, 2000);
  }, []);

  const simplePreviewSpec = buildStrategySpecFromSimpleMode(simpleForm);

  const handleSimpleFieldChange = (field, value) => {
    setSimpleForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTradingStyleChange = (value) => {
    setSimpleForm((prev) => ({
      ...prev,
      tradingStyle: value,
      strategyName:
        !prev.strategyName || prev.strategyName === STYLE_DEFAULT_NAMES[prev.tradingStyle]
          ? STYLE_DEFAULT_NAMES[value] || prev.strategyName
          : prev.strategyName,
    }));
  };

  const handleResetToPreset = () => {
    setSimpleForm(getPresetForm(simpleForm.tradingStyle));
    setValidationErrors([]);
    setParseError(null);
    setError(null);
  };

  const handleDownloadPair = async (pair, requiredDate, timeframes, endDate) => {
    setDownloadingPairs(prev => new Set([...prev, pair]));
    setDownloadErrors(prev => ({ ...prev, [pair]: null }));

    try {
      const response = await fetch("/api/data/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairs: [pair],
          timeframes: timeframes,
          timerange: `${requiredDate}-${endDate}`,
          prepend: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to start download");
      }

      const sessionId = data.session_id;

      // Poll for download completion
      if (downloadPollRef.current) {
        clearInterval(downloadPollRef.current);
      }

      downloadPollRef.current = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/session/status/${sessionId}`);
          const statusData = await statusResponse.json();

          if (statusData.status === "completed" || statusData.status === "failed") {
            clearInterval(downloadPollRef.current);
            downloadPollRef.current = null;
            setDownloadingPairs(prev => {
              const newSet = new Set(prev);
              newSet.delete(pair);
              return newSet;
            });

            if (statusData.status === "failed") {
              setDownloadErrors(prev => ({
                ...prev,
                [pair]: statusData.error || "Download failed",
              }));
            } else {
              // Auto-refresh data quality gate after successful download
              const dataQualityGate = gates.find(g => g.gate_name === "data_quality");
              if (dataQualityGate && dataQualityGate.status === "failed") {
                // Trigger a re-evaluation of the data quality gate
                // This will be done by re-running the data quality check
                // For now, just clear the error for this pair
                setDownloadErrors(prev => ({ ...prev, [pair]: null }));
              }
            }
          }
        } catch (err) {
          console.error("Download polling error:", err);
          clearInterval(downloadPollRef.current);
          downloadPollRef.current = null;
          setDownloadingPairs(prev => {
            const newSet = new Set(prev);
            newSet.delete(pair);
            return newSet;
          });
          setDownloadErrors(prev => ({
            ...prev,
            [pair]: "Lost connection to backend",
          }));
        }
      }, 2000);
    } catch (err) {
      setDownloadingPairs(prev => {
        const newSet = new Set(prev);
        newSet.delete(pair);
        return newSet;
      });
      setDownloadErrors(prev => ({
        ...prev,
        [pair]: err.message || "Failed to start download",
      }));
    }
  };

  const handleStartEvaluation = async () => {
    try {
      setParseError(null);
      setValidationErrors([]);
      setError(null);

      let parsedSpec;
      let parsedConfig;

      if (inputMode === "simple") {
        parsedSpec = buildStrategySpecFromSimpleMode(simpleForm);
        const errors = validateSimpleMode(simpleForm, parsedSpec);
        if (errors.length > 0) {
          setValidationErrors(errors);
          return;
        }
        parsedConfig = buildCandidateConfigFromSimpleMode(simpleForm, config, parsedSpec);
        setSpec(JSON.stringify(parsedSpec, null, 2));
        setConfig(JSON.stringify(parsedConfig, null, 2));
      } else {
        parsedSpec = JSON.parse(spec);
        parsedConfig = JSON.parse(config);
      }
      
      runActiveRef.current = true;
      setStatus("running");
      setElapsed(0);
      setVerdict(null);
      setGates([]);
      setCurrentGateName(null);
      
      // Initialize gates with pending status
      const initialGates = GATE_NAMES.map(gateName => ({
        gate_name: gateName,
        status: "pending",
        message: null,
        errors: [],
        metrics: {},
        duration_s: null,
      }));
      setGates(initialGates);

      const response = await api.candidate.startRun(parsedSpec, parsedConfig);
      setRunId(response.run_id);

      // Open WebSocket
      const wsUrl = api.candidate.getWebSocketUrl(response.run_id);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const payload = data.data || data;
          
          switch (data.type) {
            case "snapshot":
              if (payload.status) {
                setStatus(payload.status);
              }
              if (payload.gates) {
                setGates(payload.gates);
                const runningGate = payload.gates.find(g => g.status === "running");
                setCurrentGateName(runningGate?.gate_name || null);
              }
              if (payload.verdict) {
                setVerdict(payload.verdict);
              }
              break;
              
            case "gate_update":
              setGates(prevGates => {
                const idx = prevGates.findIndex(g => g.gate_name === payload.gate_name);
                if (idx >= 0) {
                  const newGates = [...prevGates];
                  newGates[idx] = { ...newGates[idx], ...payload };
                  if (payload.status === "running") {
                    setCurrentGateName(payload.gate_name);
                  }
                  return newGates;
                }
                if (payload.gate_name) {
                  return [...prevGates, payload];
                }
                return prevGates;
              });
              break;
              
            case "final":
              runActiveRef.current = false;
              setStatus(payload.status === "failed" ? "failed" : "completed");
              if (payload.verdict) {
                setVerdict(payload.verdict);
              }
              if (payload.gates) {
                setGates(payload.gates);
              }
              if (payload.error) {
                setError(payload.error);
              }
              setCurrentGateName(null);
              if (wsRef.current) {
                wsRef.current.close();
              }
              break;
              
            case "error":
              runActiveRef.current = false;
              setStatus("failed");
              setError(data.error || data.message || "Unknown error");
              setCurrentGateName(null);
              if (wsRef.current) {
                wsRef.current.close();
              }
              break;
              
            case "keepalive":
              // Ignore keepalive messages
              break;
              
            default:
              break;
          }
        } catch (err) {
          console.error("WebSocket message error:", err);
        }
      };

      wsRef.current.onerror = () => {
        setError("WebSocket connection error");
      };

      wsRef.current.onclose = () => {
        wsRef.current = null;
        
        // Start polling if run is not completed
        if (runActiveRef.current) {
          startPolling(response.run_id);
        }
      };

    } catch (err) {
      runActiveRef.current = false;
      setStatus("failed");
      if (err.message.includes("JSON")) {
        setParseError(err.message);
      } else {
        setError(err.message);
      }
    }
  };

  const handleReset = () => {
    runActiveRef.current = false;
    setStatus("idle");
    setElapsed(0);
    setRunId(null);
    setError(null);
    setParseError(null);
    setValidationErrors([]);
    setVerdict(null);
    setGates([]);
    setCurrentGateName(null);
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const runningGateLabel = currentGateName ? (GATE_LABELS[currentGateName] || currentGateName) : null;
  const backtestMetrics = getBacktestMetrics(verdict);
  const pairSweepResults = getPairSweepResults(verdict);
  const dataQualityFailure = getDataQualityFailure(gates, verdict);
  const pairTextareaValue = simpleForm.pairUniverseMode === "auto"
    ? getAutoPairsForSimpleMode(simpleForm).join(", ")
    : simpleForm.pairs;
  const timeframeWarning = getTimeframeCompatibilityError(simpleForm);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header Card */}
      <div className="card bg-base-200 border border-base-300 mb-6">
        <div className="card-body p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">Strategy Lab</h1>
              <p className="text-sm text-base-content/60">
                Candidate evaluation workflow with multi-gate validation
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={status} />
              {status === "running" && (
                <div className="text-sm font-mono tabular-nums">
                  {formatElapsed(elapsed)}
                </div>
              )}
            </div>
          </div>
          {runningGateLabel && (
            <div className="mt-3 pt-3 border-t border-base-300">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-base-content/60">Current gate:</span>
                <span className="font-medium text-primary">{runningGateLabel}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      {status !== "running" && (
        <div className="space-y-4 mb-6">
          <div className="tabs tabs-boxed bg-base-200 w-fit">
            <button
              type="button"
              className={`tab ${inputMode === "simple" ? "tab-active" : ""}`}
              onClick={() => setInputMode("simple")}
            >
              Simple Mode
            </button>
            <button
              type="button"
              className={`tab ${inputMode === "advanced" ? "tab-active" : ""}`}
              onClick={() => setInputMode("advanced")}
            >
              Advanced JSON
            </button>
          </div>

          {inputMode === "simple" ? (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] gap-4">
              <div className="card bg-base-200 border border-base-300">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <h3 className="font-semibold text-sm">Simple Mode</h3>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={handleResetToPreset}
                    >
                      Reset to preset
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="simple-strategy-name" className="block text-xs font-medium mb-1">
                        Strategy name
                      </label>
                      <input
                        id="simple-strategy-name"
                        className="input input-bordered input-sm w-full"
                        value={simpleForm.strategyName}
                        onChange={(e) => handleSimpleFieldChange("strategyName", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="simple-trading-style" className="block text-xs font-medium mb-1">
                        Trading style
                      </label>
                      <select
                        id="simple-trading-style"
                        className="select select-bordered select-sm w-full"
                        value={simpleForm.tradingStyle}
                        onChange={(e) => handleTradingStyleChange(e.target.value)}
                      >
                        <option value="trend_following">trend_following</option>
                        <option value="mean_reversion">mean_reversion</option>
                        <option value="momentum">momentum</option>
                        <option value="breakout">breakout</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="simple-trading-horizon" className="block text-xs font-medium mb-1">
                        Trading horizon
                      </label>
                      <select
                        id="simple-trading-horizon"
                        className="select select-bordered select-sm w-full"
                        value={simpleForm.tradingHorizon}
                        onChange={(e) => handleSimpleFieldChange("tradingHorizon", e.target.value)}
                      >
                        <option value="scalping">scalping</option>
                        <option value="intraday">intraday</option>
                        <option value="swing">swing</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="simple-direction" className="block text-xs font-medium mb-1">
                        Direction
                      </label>
                      <select
                        id="simple-direction"
                        className="select select-bordered select-sm w-full"
                        value={simpleForm.direction}
                        onChange={(e) => handleSimpleFieldChange("direction", e.target.value)}
                      >
                        <option value="long">long</option>
                        <option value="short">short</option>
                        <option value="both">both</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="simple-risk-profile" className="block text-xs font-medium mb-1">
                        Risk profile
                      </label>
                      <select
                        id="simple-risk-profile"
                        className="select select-bordered select-sm w-full"
                        value={simpleForm.riskProfile}
                        onChange={(e) => handleSimpleFieldChange("riskProfile", e.target.value)}
                      >
                        <option value="low">low</option>
                        <option value="balanced">balanced</option>
                        <option value="aggressive">aggressive</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="simple-timeframe" className="block text-xs font-medium mb-1">
                        Timeframe
                      </label>
                      <select
                        id="simple-timeframe"
                        className="select select-bordered select-sm w-full"
                        value={simpleForm.timeframe}
                        onChange={(e) => handleSimpleFieldChange("timeframe", e.target.value)}
                      >
                        {VALID_TIMEFRAMES.map((timeframe) => (
                          <option key={timeframe} value={timeframe}>{timeframe}</option>
                        ))}
                      </select>
                      {timeframeWarning && (
                        <p className="text-xs text-warning mt-1">{timeframeWarning}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="simple-max-iterations" className="block text-xs font-medium mb-1">
                        Max Repair Attempts
                      </label>
                      <input
                        id="simple-max-iterations"
                        type="number"
                        min="1"
                        max="10"
                        className="input input-bordered input-sm w-full"
                        value={simpleForm.maxIterations}
                        onChange={(e) => handleSimpleFieldChange("maxIterations", e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="simple-pair-mode" className="block text-xs font-medium mb-1">
                        Pair universe mode
                      </label>
                      <select
                        id="simple-pair-mode"
                        className="select select-bordered select-sm w-full"
                        value={simpleForm.pairUniverseMode}
                        onChange={(e) => handleSimpleFieldChange("pairUniverseMode", e.target.value)}
                      >
                        <option value="auto">auto</option>
                        <option value="manual">manual</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="simple-pairs" className="block text-xs font-medium mb-1">
                        Pairs / pair universe
                      </label>
                      <textarea
                        id="simple-pairs"
                        className="textarea textarea-bordered textarea-sm w-full h-20 font-mono text-xs"
                        value={pairTextareaValue}
                        readOnly={simpleForm.pairUniverseMode === "auto"}
                        onChange={(e) => handleSimpleFieldChange("pairs", e.target.value)}
                      />
                      {simpleForm.pairUniverseMode === "auto" && (
                        <p className="text-xs text-base-content/50 mt-1">
                          Auto universe uses {getAutoPairsForSimpleMode(simpleForm).length} pairs from the selected horizon and risk profile.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="card bg-base-200 border border-base-300">
                <div className="card-body p-4">
                  <h3 className="font-semibold text-sm mb-3">Preview JSON</h3>
                  <StrategySpecPreview 
                    spec={simplePreviewSpec} 
                    validationErrors={validationErrors}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card bg-base-200 border border-base-300">
                <div className="card-body p-4">
                  <h3 className="font-semibold text-sm mb-3">StrategySpec (JSON)</h3>
                  <textarea
                    className="textarea textarea-bordered textarea-sm w-full h-40 font-mono text-xs"
                    value={spec}
                    onChange={(e) => setSpec(e.target.value)}
                    disabled={status === "running"}
                  />
                </div>
              </div>
              <div className="card bg-base-200 border border-base-300">
                <div className="card-body p-4">
                  <h3 className="font-semibold text-sm mb-3">CandidateConfig (JSON)</h3>
                  <textarea
                    className="textarea textarea-bordered textarea-sm w-full h-40 font-mono text-xs"
                    value={config}
                    onChange={(e) => setConfig(e.target.value)}
                    disabled={status === "running"}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="alert alert-error mb-4">
          <div>
            {validationErrors.map((validationError) => (
              <div key={validationError}>{validationError}</div>
            ))}
          </div>
        </div>
      )}

      {/* Parse Error */}
      {parseError && (
        <div className="alert alert-error mb-4">
          <span>JSON Parse Error: {parseError}</span>
        </div>
      )}

      {/* Action Row */}
      <div className="flex items-center gap-3 mb-6">
        <button
          className="btn btn-primary btn-sm"
          onClick={handleStartEvaluation}
          disabled={status === "running"}
        >
          {status === "running" ? (
            <>
              <span className="loading loading-spinner loading-xs"></span>
              Running...
            </>
          ) : (
            "Start Evaluation"
          )}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleReset}
          disabled={status === "idle"}
        >
          Reset
        </button>
        {runId && (
          <span className="text-xs text-base-content/50 font-mono ml-auto">
            Run ID: {runId.slice(0, 8)}...
          </span>
        )}
      </div>

      {/* Error Panel */}
      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      <DataQualityFailurePanel failure={dataQualityFailure} />

      {/* Live Workflow Timeline */}
      {(status === "running" || gates.length > 0) && (
        <div className="card bg-base-200 border border-base-300 mb-6">
          <div className="card-body p-4">
            <h3 className="font-semibold text-sm mb-3">Workflow Timeline</h3>
            <GateTimeline
              gates={gates}
              onDownloadPair={handleDownloadPair}
              downloadingPairs={downloadingPairs}
              downloadErrors={downloadErrors}
              strategyTimeframes={simpleForm.timeframe ? [simpleForm.timeframe] : ["5m"]}
              strategyEndDate={(() => {
                const configObj = JSON.parse(config);
                return configObj.timerange?.split("-")[1] || new Date().toISOString().slice(0, 10).replace(/-/g, "");
              })()}
            />
          </div>
        </div>
      )}

      {/* Results Area */}
      {status === "completed" && verdict && (
        <div className="space-y-4">
          {/* Final Verdict Card */}
          <div className={`card border ${
            verdict.passed ? "border-success/30 bg-success/5" : "border-error/30 bg-error/5"
          }`}>
            <div className="card-body p-5">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-lg font-bold">Final Verdict</h2>
                <span className={`badge ${verdict.passed ? "badge-success" : "badge-error"}`}>
                  {verdict.passed ? "PASSED" : "FAILED"}
                </span>
              </div>
              {verdict.failure_reason && (
                <p className="text-sm text-error mb-2">{verdict.failure_reason}</p>
              )}
              {verdict.final_pair_set && verdict.final_pair_set.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Final Pair Set:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {verdict.final_pair_set.map((pair, idx) => (
                      <span key={idx} className="badge badge-neutral badge-sm">
                        {pair}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Backtest Metrics */}
          {backtestMetrics && (
            <BacktestMetricsCard metrics={backtestMetrics} />
          )}

          {/* Pair Sweep Results */}
          {pairSweepResults.length > 0 && (
            <PairSweepTable pairResults={pairSweepResults} />
          )}

          {/* Portfolio Metrics */}
          {verdict.portfolio_metrics && Object.keys(verdict.portfolio_metrics).length > 0 && (
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body p-4">
                <h3 className="font-semibold text-sm mb-3">Portfolio Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(verdict.portfolio_metrics).map(([key, value]) => (
                    <div key={key} className="bg-base-100 rounded-lg p-2.5">
                      <div className="text-xs text-base-content/60 mb-1">{key}</div>
                      <div className="text-sm font-semibold tabular-nums">
                        {typeof value === 'number' ? value.toFixed(4) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Repair Attempts */}
          <RepairAttemptsList repairAttempts={verdict.repair_attempts} />
        </div>
      )}
    </div>
  );
}
