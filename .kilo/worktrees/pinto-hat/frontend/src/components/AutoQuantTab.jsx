import { useState, useEffect, useRef, useCallback } from "react";
import RunHistoryDashboard from "./RunHistoryDashboard";
import {
  BarChart,
  Bar,
  ComposedChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const STAGE_NAMES = [
  "Sanity Backtest",
  "Hyperopt Execution",
  "Auto-Patching",
  "Out-of-Sample Validation",
  "Multi-Pair Stress Test",
  "Risk Assessment",
  "Delivery",
];

const STAGE_ICONS = ["🔍", "⚡", "🔧", "📊", "🌐", "🛡️", "📦"];

const API_BASE = "";

function getWsUrl(runId) {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  return `${proto}://${host}/api/auto-quant/ws/${runId}`;
}

// Legal state transitions for pipeline status
const LEGAL_STATUS_TRANSITIONS = {
  pending: ["running", "cancelled", "interrupted"],
  running: ["completed", "failed", "cancelled", "interrupted"],
  completed: [], // Terminal state
  failed: [], // Terminal state
  cancelled: [], // Terminal state
  interrupted: ["running"], // Can resume from interrupted
};

function isValidStatusTransition(from, to) {
  if (!from || !to) return true; // Allow null/undefined for initialization
  if (from === to) return true; // No-op transition is valid
  const allowed = LEGAL_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

function StageIcon({ status }) {
  if (status === "running") {
    return (
      <span className="loading loading-spinner loading-xs text-primary" />
    );
  }
  if (status === "passed") {
    return <span className="text-success text-sm font-bold">✓</span>;
  }
  if (status === "failed") {
    return <span className="text-error text-sm font-bold">✗</span>;
  }
  return <span className="text-base-content/25 text-sm">○</span>;
}

function fmtMmSs(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function StageStepper({ stages, tick }) {
  return (
    <div className="flex flex-col gap-1.5">
      {stages.map((stage, i) => {
        let stageElapsed = null;
        if (stage.status === "running" && stage.started_at) {
          const secs = Math.floor((Date.now() - new Date(stage.started_at).getTime()) / 1000);
          stageElapsed = fmtMmSs(Math.max(0, secs));
        }
        return (
          <div key={stage.index}>
            <div
              className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                stage.status === "running"
                  ? "bg-primary/15 border border-primary/30 shadow-sm shadow-primary/10"
                  : stage.status === "passed"
                  ? "bg-success/8 border border-success/20"
                  : stage.status === "failed"
                  ? "bg-error/10 border border-error/25"
                  : "border border-base-300/40 opacity-60"
              }`}
            >
              <div className="flex flex-col items-center shrink-0 gap-0.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors ${
                  stage.status === "running"
                    ? "bg-primary/20"
                    : stage.status === "passed"
                    ? "bg-success/15"
                    : stage.status === "failed"
                    ? "bg-error/15"
                    : "bg-base-300/50"
                }`}>
                  {stage.status === "running" ? (
                    <span className="loading loading-spinner loading-xs text-primary" />
                  ) : (
                    <span className={stage.status === "passed" ? "text-success" : stage.status === "failed" ? "text-error" : "text-base-content/30"}>
                      {stage.status === "passed" ? "✓" : stage.status === "failed" ? "✗" : STAGE_ICONS[i] || "○"}
                    </span>
                  )}
                </div>
                {i < stages.length - 1 && (
                  <div className={`w-px h-2 mt-0.5 rounded-full transition-colors ${
                    stage.status === "passed" ? "bg-success/40" : "bg-base-300/40"
                  }`} />
                )}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${
                    stage.status === "running" ? "text-primary" :
                    stage.status === "passed" ? "text-success/90" :
                    stage.status === "failed" ? "text-error" :
                    "text-base-content/40"
                  }`}>
                    {STAGE_ICONS[i]} {stage.name}
                  </span>
                  {stage.status === "running" && stageElapsed && (
                    <span className="text-[10px] font-mono text-primary/70 tabular-nums">{stageElapsed}</span>
                  )}
                  {stage.status === "running" && (
                    <span className="badge badge-xs badge-primary animate-pulse">live</span>
                  )}
                  {stage.status === "passed" && stage.duration_s != null && (
                    <span className="text-[10px] font-mono text-base-content/35 tabular-nums">{stage.duration_s}s</span>
                  )}
                </div>
                {stage.message && stage.status === "passed" && (
                  <p className="text-[10px] text-base-content/50 mt-0.5 leading-relaxed truncate">
                    {stage.message}
                  </p>
                )}
                {stage.status === "passed" && stage.data && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {stage.data.profit_total_abs != null && (
                      <span className={`text-[9px] font-mono ${stage.data.profit_total_abs >= 0 ? "text-success/70" : "text-error/70"}`}>
                        P: {stage.data.profit_total_abs >= 0 ? "+" : ""}{stage.data.profit_total_abs.toFixed(3)}
                      </span>
                    )}
                    {stage.data.max_drawdown_account != null && (
                      <span className="text-[9px] font-mono text-base-content/50">
                        DD: {(stage.data.max_drawdown_account * 100).toFixed(1)}%
                      </span>
                    )}
                    {stage.data.trade_count != null && (
                      <span className="text-[9px] font-mono text-base-content/50">
                        T: {stage.data.trade_count}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {stage.status === "failed" && stage.message && (
              <details className="mt-1 ml-10">
                <summary className="text-[10px] text-error/70 cursor-pointer select-none hover:text-error transition-colors">
                  Error details
                </summary>
                <pre className="mt-1 text-[10px] text-error/80 bg-error/5 border border-error/15 rounded-lg p-2 whitespace-pre-wrap break-words leading-relaxed">
                  {stage.message}
                </pre>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LiveFitnessCurve({ data, hyperoptProgress }) {
  const hasData = data && data.length > 0;
  const bestPoint = hasData ? data.reduce((best, p) => p.objective < best.objective ? p : best, data[0]) : null;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-base-300 border border-base-content/10 rounded px-2.5 py-2 text-xs shadow-lg space-y-0.5">
        <div className="text-base-content/50 font-medium">Epoch {d.epoch}{hyperoptProgress?.total ? `/${hyperoptProgress.total}` : ""}</div>
        <div className="text-emerald-400 font-bold">Profit: {d.profit_usdt >= 0 ? "+" : ""}{d.profit_usdt?.toFixed(4)} USDT</div>
        <div className="text-blue-400">Objective: {d.objective?.toFixed(4)}</div>
        <div className="text-base-content/50">{d.trades} trades</div>
      </div>
    );
  };

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-36 rounded-xl bg-base-300/30 border border-base-300/50 gap-2">
        <div className="text-2xl opacity-30">⚡</div>
        <span className="text-xs text-base-content/35 italic">
          {hyperoptProgress ? `Running hyperopt...` : "Waiting for Stage 2 — Hyperopt..."}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {bestPoint && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-base-content/50">Best profit: <span className="text-emerald-400 font-bold">{bestPoint.profit_usdt >= 0 ? "+" : ""}{bestPoint.profit_usdt?.toFixed(4)} USDT</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-[10px] text-base-content/50">Epoch <span className="text-blue-400 font-bold">{bestPoint.epoch}</span></span>
            </div>
          </div>
        )}
        {hyperoptProgress && (
          <span className="text-[10px] text-base-content/40 font-mono">
            {data.length}/{hyperoptProgress.total || "?"} epochs
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={150} debounce={30}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4ade80" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#4ade80" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="epoch"
            tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
            label={{ value: "Epoch", position: "insideBottom", offset: -2, fontSize: 9, fill: "rgba(255,255,255,0.25)" }}
          />
          <YAxis
            yAxisId="profit"
            tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
            width={42}
            tickFormatter={(v) => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine yAxisId="profit" y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" strokeWidth={1} />
          <Line
            yAxisId="profit"
            type="monotone"
            dataKey="profit_usdt"
            stroke="#4ade80"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#4ade80" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CandidateLeaderboard({ candidates, bestParams }) {
  const [expandedEpoch, setExpandedEpoch] = useState(null);
  
  if (!candidates || candidates.length === 0) return null;
  
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-7 gap-1 px-2 pb-1 border-b border-base-300/50">
        <span className="text-[9px] text-base-content/40 uppercase tracking-wider">Rank</span>
        <span className="text-[9px] text-base-content/40 uppercase tracking-wider text-right">Epoch</span>
        <span className="text-[9px] text-base-content/40 uppercase tracking-wider text-right">Profit</span>
        <span className="text-[9px] text-base-content/40 uppercase tracking-wider text-right">Score</span>
        <span className="text-[9px] text-base-content/40 uppercase tracking-wider text-right">Drawdown</span>
        <span className="text-[9px] text-base-content/40 uppercase tracking-wider text-right">Win Rate</span>
        <span className="text-[9px] text-base-content/40 uppercase tracking-wider text-right">Trades</span>
      </div>
      {candidates.map((c, i) => (
        <div key={c.epoch}>
          <div 
            className={`grid grid-cols-7 gap-1 px-2 py-1.5 rounded-lg transition-colors cursor-pointer ${
              i === 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-base-300/40"
            }`}
            onClick={() => setExpandedEpoch(expandedEpoch === c.epoch ? null : c.epoch)}
          >
            <span className="text-xs font-bold text-base-content/60">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
            </span>
            <span className="text-xs font-mono text-right text-base-content/70">{c.epoch}</span>
            <span className={`text-xs font-bold text-right ${c.profit_usdt >= 0 ? "text-emerald-400" : "text-error"}`}>
              {c.profit_usdt >= 0 ? "+" : ""}{c.profit_usdt?.toFixed(3)}
            </span>
            <span className="text-xs font-mono text-right text-blue-400/80">{c.objective?.toFixed(3)}</span>
            <span className={`text-xs font-mono text-right ${
              c.drawdown_pct != null ? (c.drawdown_pct > 20 ? "text-error" : c.drawdown_pct > 10 ? "text-warning" : "text-success") : "text-base-content/40"
            }`}>
              {c.drawdown_pct != null ? `${c.drawdown_pct.toFixed(1)}%` : "—"}
            </span>
            <span className={`text-xs font-mono text-right ${
              c.win_rate_pct != null ? (c.win_rate_pct >= 50 ? "text-success" : "text-error") : "text-base-content/40"
            }`}>
              {c.win_rate_pct != null ? `${c.win_rate_pct.toFixed(1)}%` : "—"}
            </span>
            <span className="text-xs font-mono text-right text-base-content/70">{c.trades ?? "—"}</span>
          </div>
          {expandedEpoch === c.epoch && bestParams?.params_dict && (
            <div className="ml-2 mt-1 p-2 bg-base-300/50 rounded-lg border border-base-300/30">
              <div className="text-[9px] text-base-content/40 uppercase tracking-wider mb-1.5">Parameters</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(bestParams.params_dict).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[10px] text-base-content/60 font-mono">{key}</span>
                    <span className="text-[10px] text-primary font-mono font-semibold">
                      {typeof value === 'number' ? value.toFixed(4) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TradeDistributionChart({ tradeDistribution }) {
  if (!tradeDistribution || !tradeDistribution.profit_buckets || tradeDistribution.profit_buckets.length === 0) {
    return null;
  }

  const buckets = tradeDistribution.profit_buckets;
  const totalTrades = tradeDistribution.total_trades || 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-base-content/50">Trade Distribution ({totalTrades} trades)</span>
      </div>
      <ResponsiveContainer width="100%" height={120} debounce={30}>
        <BarChart data={buckets} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 8, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 8, fill: "rgba(255,255,255,0.3)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              const pct = totalTrades > 0 ? ((d.count / totalTrades) * 100).toFixed(1) : 0;
              return (
                <div className="bg-base-300 border border-base-content/10 rounded px-2.5 py-2 text-xs shadow-lg">
                  <div className="text-base-content/50 font-medium">{d.label}</div>
                  <div className="text-base-content">{d.count} trades ({pct}%)</div>
                </div>
              );
            }}
          />
          <Bar dataKey="count" fill="#4ade80" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LogTerminal({ lines, filter }) {
  const bottomRef = useRef(null);
  const filterLower = filter ? filter.toLowerCase() : "";
  const displayed = filterLower
    ? lines.filter((l) => l.toLowerCase().includes(filterLower))
    : lines;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="bg-base-300 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed">
      {displayed.length === 0 ? (
        <span className="text-base-content/30">
          {filterLower ? "No lines match filter." : "Waiting for pipeline output..."}
        </span>
      ) : (
        displayed.slice(-1000).map((line, i) => (
          <div
            key={i}
            className={`${
              line.includes("ERROR") || line.includes("error") || line.includes("✗")
                ? "text-error"
                : line.includes("✓") || line.includes("passed") || line.includes("complete")
                ? "text-success"
                : line.includes("WARNING") || line.includes("warning")
                ? "text-warning"
                : "text-base-content/70"
            }`}
          >
            {line}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function MetricCard({ label, value, unit = "", good = null, threshold = null }) {
  const colorClass =
    good === true
      ? "text-success"
      : good === false
      ? "text-error"
      : "text-base-content";
  return (
    <div className="bg-base-200 rounded-lg p-3 flex flex-col gap-1">
      <span className="text-[10px] text-base-content/50 uppercase tracking-wider">{label}</span>
      <span className={`text-lg font-bold ${colorClass}`}>
        {value != null ? `${value}${unit}` : "—"}
      </span>
      {threshold != null && (
        <span className="text-[10px] text-base-content/40">
          threshold: {threshold}
        </span>
      )}
    </div>
  );
}

function RiskChecks({ checks }) {
  if (!checks) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(checks).map(([key, check]) => (
        <div
          key={key}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
            check.passed
              ? "border-success/30 bg-success/5 text-success"
              : "border-error/30 bg-error/10 text-error"
          }`}
        >
          <span>{check.passed ? "✓" : "✗"}</span>
          <span className="font-medium capitalize">{key.replace(/_/g, " ")}</span>
          <span className="ml-auto text-base-content/60">{check.value}</span>
        </div>
      ))}
    </div>
  );
}

function PerPairProfitChart({ perPair }) {
  if (!perPair || perPair.length === 0) return null;

  const data = [...perPair]
    .map((p) => ({
      pair: p.key.replace("/USDT", ""),
      profit: parseFloat((p.profit_total * 100).toFixed(2)),
    }))
    .sort((a, b) => b.profit - a.profit);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { pair, profit } = payload[0].payload;
    return (
      <div className="bg-base-300 border border-base-content/10 rounded px-2 py-1 text-xs shadow">
        <span className="font-medium">{pair}/USDT</span>
        <span className={`ml-2 font-bold ${profit >= 0 ? "text-success" : "text-error"}`}>
          {profit >= 0 ? "+" : ""}{profit}%
        </span>
      </div>
    );
  };

  const barHeight = 26;
  const chartHeight = Math.max(180, data.length * barHeight + 40);

  return (
    <div>
      <h4 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
        Per-Pair Profit
      </h4>
      <ResponsiveContainer width="100%" height={chartHeight} debounce={50}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            type="number"
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="pair"
            width={56}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
          <Bar dataKey="profit" radius={[0, 3, 3, 0]} maxBarSize={18}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.profit >= 0 ? "oklch(var(--su))" : "oklch(var(--er))"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EquityCurveChart({ data, mcFan }) {
  if (!data || data.length < 5) {
    return (
      <div className="flex items-center justify-center h-28 rounded-lg bg-base-300/40 border border-base-300">
        <span className="text-xs text-base-content/40 italic">
          Not enough trades to render curve (need ≥ 5)
        </span>
      </div>
    );
  }

  const hasFan =
    mcFan &&
    Array.isArray(mcFan.p5) &&
    mcFan.p5.length >= 2 &&
    Array.isArray(mcFan.p95) &&
    mcFan.p95.length >= 2;

  const chartData = data.map((value, i) => {
    const point = { trade: i, value };
    if (hasFan && i < mcFan.p5.length) {
      point.p5 = mcFan.p5[i];
      point.spread = Math.max(0, mcFan.p95[i] - mcFan.p5[i]);
      point.p50 = mcFan.p50?.[i] ?? null;
    }
    return point;
  });

  const allValues = [
    ...data,
    ...(hasFan ? mcFan.p5 : []),
    ...(hasFan ? mcFan.p95 : []),
  ];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const pad = (maxVal - minVal) * 0.08 || 0.02;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const pt = payload[0].payload;
    const tradeLabel = pt.trade === 0 ? "Start" : `Trade ${pt.trade}`;
    return (
      <div className="bg-base-300 border border-base-content/10 rounded px-2 py-1.5 text-xs shadow space-y-0.5">
        <div className="text-base-content/50">{tradeLabel}</div>
        {pt.value != null && (
          <div className={`font-bold ${pt.value >= 1 ? "text-success" : "text-error"}`}>
            Actual: {pt.value.toFixed(4)}×
          </div>
        )}
        {hasFan && pt.p50 != null && (
          <div className="text-amber-400/80">Median: {pt.p50.toFixed(4)}×</div>
        )}
        {hasFan && pt.p5 != null && (
          <div className="text-base-content/45">
            Fan: {pt.p5.toFixed(4)}× – {(pt.p5 + pt.spread).toFixed(4)}×
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <ResponsiveContainer width="100%" height={180} debounce={50}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 14 }}>
          <defs>
            <linearGradient id="fanGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="trade"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
            axisLine={false}
            tickLine={false}
            label={{ value: "Trade #", position: "insideBottom", offset: -2, fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
          />
          <YAxis
            domain={[minVal - pad, maxVal + pad]}
            tickFormatter={(v) => `${v.toFixed(2)}×`}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }}
            axisLine={false}
            tickLine={false}
            width={46}
          />
          <ReferenceLine y={1} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 2" strokeWidth={1} />
          <Tooltip content={<CustomTooltip />} />

          {hasFan && (
            <>
              <Area
                type="monotone"
                dataKey="p5"
                stroke="none"
                fill="transparent"
                stackId="fan"
                dot={false}
                activeDot={false}
                legendType="none"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="spread"
                stroke="none"
                fill="url(#fanGradient)"
                stackId="fan"
                dot={false}
                activeDot={false}
                legendType="none"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="p50"
                stroke="rgba(245,158,11,0.55)"
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                activeDot={false}
                legendType="none"
                isAnimationActive={false}
              />
            </>
          )}

          <Line
            type="monotone"
            dataKey="value"
            stroke="#4ade80"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#4ade80" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {hasFan && (
        <div className="flex items-center gap-4 px-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-green-400" />
            <span className="text-[10px] text-base-content/50">Actual OOS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-2 rounded-sm" style={{ background: "rgba(245,158,11,0.25)" }} />
            <span className="text-[10px] text-base-content/50">p5–p95 fan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0 border-t border-dashed border-amber-400/55" />
            <span className="text-[10px] text-base-content/50">Median (p50)</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MonteCarloBadge({ mc, threshold = 0.35 }) {
  if (!mc) return null;
  const p95Pct = (mc.p95_drawdown * 100).toFixed(1);
  const p5Pct = (mc.p5_drawdown * 100).toFixed(1);
  const medPct = (mc.median_final_return * 100).toFixed(1);
  const thresholdPct = (threshold * 100).toFixed(1);
  const passed = mc.passed;
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
      passed ? "border-success/30 bg-success/5" : "border-error/30 bg-error/10"
    }`}>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <span className="text-[10px] uppercase tracking-wider text-base-content/50 font-medium">
          Monte Carlo ({mc.simulations?.toLocaleString() ?? "1 000"} shuffles)
        </span>
        <div className="flex flex-wrap gap-3 items-center">
          <span className={`font-bold text-base ${passed ? "text-success" : "text-error"}`}>
            p95 DD: {p95Pct}%
          </span>
          <span className="text-xs text-base-content/60">p5 DD: {p5Pct}%</span>
          <span className="text-xs text-base-content/60">Median return: {medPct}%</span>
        </div>
        <span className="text-[10px] text-base-content/40">threshold: p95 DD &lt; {thresholdPct}%</span>
      </div>
      <span className={`badge badge-sm shrink-0 ${passed ? "badge-success" : "badge-error"}`}>
        {passed ? "Passed" : "Failed"}
      </span>
    </div>
  );
}

function RobustnessBadge({ sensitivity }) {
  if (!sensitivity) return null;
  const { passed, score, label, p_best, p_minus, p_plus, param } = sensitivity;

  const isStable = passed !== false;
  const scoreColor =
    score === "High" ? "text-success" :
    score === "Medium" ? "text-warning" :
    "text-error";

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs flex-wrap ${
      isStable
        ? "border-success/30 bg-success/5"
        : "border-warning/40 bg-warning/8"
    }`}>
      <span className={`text-base ${isStable ? "text-success" : "text-warning"}`}>
        {isStable ? "📈" : "⚠️"}
      </span>
      <span className={`font-semibold ${isStable ? "text-success" : "text-warning"}`}>
        {isStable ? "Stable Plateau Detected" : "Warning: Sharp Peak"}
      </span>
      <span className={`badge badge-xs ${
        isStable ? "badge-success" : "badge-warning"
      }`}>
        {label}
      </span>
      <span className="text-base-content/50">·</span>
      <span className="text-base-content/60 uppercase tracking-wider text-[10px]">Robustness</span>
      <span className={`font-bold text-sm ${scoreColor}`}>{score}</span>
      {param && (
        <>
          <span className="text-base-content/30">·</span>
          <span className="text-[10px] text-base-content/40 font-mono">{param}</span>
        </>
      )}
      {p_best != null && p_minus != null && p_plus != null && (
        <div className="w-full flex gap-3 mt-0.5 text-[10px] font-mono text-base-content/50">
          <span>Best: <span className={p_best >= 0 ? "text-success" : "text-error"}>{p_best >= 0 ? "+" : ""}{(p_best * 100).toFixed(2)}%</span></span>
          <span>−5%: <span className={p_minus >= 0 ? "text-success" : "text-error"}>{p_minus >= 0 ? "+" : ""}{(p_minus * 100).toFixed(2)}%</span></span>
          <span>+5%: <span className={p_plus >= 0 ? "text-success" : "text-error"}>{p_plus >= 0 ? "+" : ""}{(p_plus * 100).toFixed(2)}%</span></span>
        </div>
      )}
    </div>
  );
}

function FinalReport({ report, runId, strategy }) {
  const risk = report?.risk || {};
  const oos = report?.oos_validation || {};
  const sanity = report?.sanity_backtest || {};
  const stressTest = report?.stress_test || {};
  const files = report?.files || {};
  const thresholds = report?.thresholds || {};
  const monteCarlo = report?.monte_carlo ?? risk?.monte_carlo ?? null;
  const equityCurveOos = report?.equity_curves?.oos ?? null;
  const ensembleWeights = report?.ensemble_weights ?? null;
  const sensitivity = report?.sensitivity ?? null;
  const isEnsemble = report?.ensemble_enabled === true || (ensembleWeights && Object.keys(ensembleWeights).length > 0);

  // Use dynamic thresholds from the report; fall back to defaults
  const maxDrawdownThreshold = thresholds.max_drawdown ?? 30;
  const minWinRateThreshold = thresholds.min_win_rate ?? 40;
  const minProfitFactorThreshold = thresholds.min_profit_factor ?? 1.0;
  const minSharpeThreshold = thresholds.min_sharpe ?? 0.5;
  const minOosProfitThreshold = thresholds.min_oos_profit ?? 0;
  const mcThreshold = thresholds.monte_carlo_threshold ?? 0.35;

  const downloadFile = (filename) => {
    const url = `${API_BASE}/api/auto-quant/download/${runId}/${filename}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadHtmlReport = () => {
    const url = `${API_BASE}/api/auto-quant/report/${runId}/html`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${runId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success text-lg">
          ✓
        </div>
        <div>
          <h3 className="font-semibold text-sm">Pipeline Complete</h3>
          <p className="text-xs text-base-content/50">
            Optimized strategy ready for download
          </p>
        </div>
      </div>

      {/* Active thresholds badge */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] text-base-content/50 uppercase tracking-wider font-medium self-center mr-1">Active thresholds:</span>
        <span className="badge badge-xs badge-outline">DD &lt; {maxDrawdownThreshold}%</span>
        <span className="badge badge-xs badge-outline">Win ≥ {minWinRateThreshold}%</span>
        <span className="badge badge-xs badge-outline">PF ≥ {minProfitFactorThreshold}</span>
        <span className="badge badge-xs badge-outline">Sharpe ≥ {minSharpeThreshold}</span>
        <span className="badge badge-xs badge-outline">OOS ≥ {minOosProfitThreshold}</span>
        <span className="badge badge-xs badge-outline">MC p95 &lt; {(mcThreshold * 100).toFixed(1)}%</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="In-Sample Profit"
          value={sanity.profit_total_abs != null ? sanity.profit_total_abs.toFixed(2) : null}
          unit=" USDT"
        />
        <MetricCard
          label="OOS Profit"
          value={oos.profit_total != null ? (oos.profit_total * 100).toFixed(2) : null}
          unit="%"
          good={oos.profit_total != null ? oos.profit_total >= minOosProfitThreshold : null}
          threshold={`≥ ${minOosProfitThreshold}%`}
        />
        <MetricCard
          label="Max Drawdown"
          value={risk.max_drawdown_pct != null ? risk.max_drawdown_pct.toFixed(1) : null}
          unit="%"
          good={risk.max_drawdown_pct != null ? risk.max_drawdown_pct < maxDrawdownThreshold : null}
          threshold={`< ${maxDrawdownThreshold}%`}
        />
        <MetricCard
          label="Win Rate"
          value={risk.win_rate_pct != null ? risk.win_rate_pct.toFixed(1) : null}
          unit="%"
          good={risk.win_rate_pct != null ? risk.win_rate_pct >= minWinRateThreshold : null}
          threshold={`≥ ${minWinRateThreshold}%`}
        />
      </div>

      {sensitivity && (
        <div>
          <h4 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2">
            Robustness Check
          </h4>
          <RobustnessBadge sensitivity={sensitivity} />
        </div>
      )}

      {risk.checks && (
        <div>
          <h4 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2">
            Risk Checks
          </h4>
          <RiskChecks checks={risk.checks} />
        </div>
      )}

      {isEnsemble && ensembleWeights && Object.keys(ensembleWeights).length > 0 && (
        <div className="rounded-xl bg-secondary/8 border border-secondary/20 px-4 py-4">
          <SignalStrengthViz weights={ensembleWeights} />
        </div>
      )}

      {monteCarlo && (
        <div>
          <h4 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2">
            Monte Carlo Stress Test
          </h4>
          <MonteCarloBadge mc={monteCarlo} threshold={mcThreshold} />
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2">
          Equity Curve (OOS)
        </h4>
        <EquityCurveChart data={equityCurveOos} mcFan={monteCarlo?.equity_fan ?? null} />
      </div>

      {(stressTest.winning_pairs?.length > 0 || stressTest.failing_pairs?.length > 0 || stressTest.per_pair?.length > 0) && (
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
            Stress Test Results
          </h4>

          {stressTest.per_pair?.length > 0 && (
            <PerPairProfitChart perPair={stressTest.per_pair} />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-success mb-2">
                Winning Pairs ({stressTest.winning_pairs?.length ?? 0})
              </h4>
              <div className="flex flex-wrap gap-1">
                {(stressTest.winning_pairs || []).map((p) => (
                  <span key={p.key || p} className="badge badge-xs badge-success badge-outline gap-1">
                    ✓ {p.key || p}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-error mb-2">
                Filtered Pairs ({stressTest.failing_pairs?.length ?? 0})
              </h4>
              <div className="flex flex-wrap gap-1">
                {(stressTest.failing_pairs || []).map((p) => (
                  <span key={p} className="badge badge-xs badge-error badge-outline">{p}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trading Window Filters */}
      {report?.excluded_time_windows && (
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
            Trading Window Filters
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-warning mb-2">
                Blocked Hours
              </h4>
              <div className="flex flex-wrap gap-1">
                {report.excluded_time_windows.excluded_hours?.length > 0 ? (
                  report.excluded_time_windows.excluded_hours.map((h) => (
                    <span key={h} className="badge badge-xs badge-warning badge-outline">
                      {h}:00 UTC
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-base-content/40 italic">No hours blocked</span>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-warning mb-2">
                Blocked Days
              </h4>
              <div className="flex flex-wrap gap-1">
                {report.excluded_time_windows.excluded_days?.length > 0 ? (
                  report.excluded_time_windows.excluded_days.map((d) => {
                    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    return (
                      <span key={d} className="badge badge-xs badge-warning badge-outline">
                        {dayNames[d]}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-base-content/40 italic">No days blocked</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Metrics */}
      {report?.ai_metrics && Object.keys(report.ai_metrics).length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
            AI Performance Metrics
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-base-300/30 border border-base-300 rounded-lg px-3 py-2">
              <div className="text-[10px] text-base-content/50 uppercase tracking-wider">Total Calls</div>
              <div className="text-lg font-mono font-semibold text-base-content">
                {report.ai_metrics.total_calls ?? 0}
              </div>
            </div>
            <div className="bg-base-300/30 border border-base-300 rounded-lg px-3 py-2">
              <div className="text-[10px] text-base-content/50 uppercase tracking-wider">JSON Success Rate</div>
              <div className="text-lg font-mono font-semibold text-base-content">
                {report.ai_metrics.total_calls > 0
                  ? ((report.ai_metrics.json_parse_success ?? 0) / report.ai_metrics.total_calls * 100).toFixed(1)
                  : "0.0"}%
              </div>
            </div>
            <div className="bg-base-300/30 border border-base-300 rounded-lg px-3 py-2">
              <div className="text-[10px] text-base-content/50 uppercase tracking-wider">Timeout Count</div>
              <div className="text-lg font-mono font-semibold text-base-content">
                {report.ai_metrics.timeout_count ?? 0}
              </div>
            </div>
            <div className="bg-base-300/30 border border-base-300 rounded-lg px-3 py-2">
              <div className="text-[10px] text-base-content/50 uppercase tracking-wider">Suggestions Applied</div>
              <div className="text-lg font-mono font-semibold text-base-content">
                {report.ai_metrics.suggestion_applied_count ?? 0}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {files.optimized_strategy && (
          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={() => downloadFile(files.optimized_strategy)}
          >
            ⬇ Download Optimized Strategy (.py)
          </button>
        )}
        {files.config && (
          <button
            className="btn btn-outline btn-sm gap-2"
            onClick={() => downloadFile(files.config)}
          >
            ⬇ Download Config (.json)
          </button>
        )}
        <button
          className="btn btn-outline btn-sm gap-2"
          onClick={downloadHtmlReport}
        >
          ⬇ Download Report (.html)
        </button>
      </div>
    </div>
  );
}

function RetryHistoryTable({ history }) {
  if (!history || history.length === 0) return null;
  const [expandedReasoning, setExpandedReasoning] = useState({});
  
  const toggleReasoning = (attempt) => {
    setExpandedReasoning(prev => ({
      ...prev,
      [attempt]: !prev[attempt]
    }));
  };
  
  return (
    <div className="overflow-x-auto mt-2">
      <table className="table table-xs w-full">
        <thead>
          <tr className="text-base-content/40 text-[9px] uppercase tracking-wider">
            <th className="font-semibold">Attempt</th>
            <th className="font-semibold">Loss Function</th>
            <th className="font-semibold">Spaces</th>
            <th className="font-semibold text-right">OOS Profit</th>
            <th className="font-semibold text-right">Max DD</th>
            <th className="font-semibold text-right">Trades</th>
            <th className="font-semibold text-center">Fail Reason</th>
            <th className="font-semibold text-center">AI</th>
          </tr>
        </thead>
        <tbody>
          {history.map((a) => (
            <React.Fragment key={a.attempt}>
              <tr className="text-xs border-b border-base-300/30">
                <td className="font-medium text-base-content/80">{a.label}</td>
                <td className="font-mono text-[10px] text-primary/80">{a.loss}</td>
                <td className="font-mono text-[10px] text-base-content/50">{(a.spaces || []).join(", ")}</td>
                <td className={`text-right font-mono font-semibold ${
                  a.profit == null ? "text-base-content/30" :
                  a.profit >= 0 ? "text-success" : "text-error"
                }`}>
                  {a.profit == null ? "—" : `${a.profit >= 0 ? "+" : ""}${(a.profit * 100).toFixed(2)}%`}
                </td>
                <td className={`text-right font-mono ${
                  a.drawdown == null ? "text-base-content/30" :
                  a.drawdown > 20 ? "text-error" : a.drawdown > 10 ? "text-warning" : "text-base-content/60"
                }`}>
                  {a.drawdown == null ? "—" : `${a.drawdown.toFixed(1)}%`}
                </td>
                <td className="text-right font-mono text-base-content/60">{a.trades ?? "—"}</td>
                <td className="text-center">
                  <span className={`badge badge-xs ${
                    a.reason === "sharp_peak" ? "badge-secondary" :
                    "badge-error"
                  }`}>
                    {a.reason === "drawdown" ? "High DD" :
                     a.reason === "sharp_peak" ? "Sharp Peak" :
                     a.reason === "both" ? "Profit+DD" :
                     a.reason === "no_trades" ? "No Trades" :
                     "Low Profit"}
                  </span>
                </td>
                <td className="text-center">
                  {a.ollama_suggestions ? (
                    <div className="flex items-center justify-center gap-1">
                      <span className="badge badge-xs badge-info gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                          <path d="M2 17l10 5 10-5"/>
                          <path d="M2 12l10 5 10-5"/>
                        </svg>
                        AI
                      </span>
                      {a.ollama_suggestions.reasoning && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs p-0 h-5 min-h-0 w-5"
                          onClick={() => toggleReasoning(a.attempt)}
                          title="View AI reasoning"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform duration-200 ${expandedReasoning[a.attempt] ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-base-content/20">—</span>
                  )}
                </td>
              </tr>
              {a.ollama_suggestions?.reasoning && expandedReasoning[a.attempt] && (
                <tr>
                  <td colSpan="8" className="p-2 bg-base-200/30">
                    <div className="text-[10px] text-base-content/70">
                      <span className="font-semibold text-info">AI Reasoning:</span>
                      <p className="mt-1 italic">{a.ollama_suggestions.reasoning}</p>
                      {a.ollama_suggestions.hyperopt_loss && (
                        <div className="mt-1 font-mono text-[9px] text-base-content/50">
                          Suggested: loss={a.ollama_suggestions.hyperopt_loss}, spaces={a.ollama_suggestions.hyperopt_spaces?.join(",")}, epochs={a.ollama_suggestions.hyperopt_epochs}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GeneralizationFailurePanel({ gf, onRetryRelaxed }) {
  const [open, setOpen] = useState(false);
  if (!gf) return null;
  const { thresholds, attempts, best_attempt, best_attempt_file, best_attempt_strategy_name, suggestions } = gf;

  // Detect whether this is a Sharp Peak exhaustion vs. OOS overfitting
  const isSharpPeak = attempts?.length > 0 && attempts.every((a) => a.reason === "sharp_peak");

  return (
    <div className="space-y-3 mt-3">
      {/* Structured diagnostics block */}
      <div className={`rounded-xl border p-4 space-y-3 ${gf.reason === "sharp_peak" ? "border-secondary/25 bg-secondary/5" : "border-error/25 bg-error/5"}`}>
        <div className="flex items-start gap-2">
          <span className={gf.reason === "sharp_peak" ? "text-secondary text-base mt-0.5" : "text-error text-base mt-0.5"}>
            {gf.reason === "sharp_peak" ? "🏔️" : "🔬"}
          </span>
            <div>
              <p className={`text-xs font-semibold ${gf.reason === "sharp_peak" ? "text-secondary" : "text-error"}`}>
                {gf.reason === "sharp_peak" ? "Robustness Check Failure (Sharp Peak)" : "Generalization Failure Diagnostics"}
              </p>
              <p className="text-[10px] text-base-content/50 mt-0.5">
                {gf.reason === "sharp_peak"
                  ? "Strategy params are too sensitive. Small variations cause massive performance drops."
                  : `Active gates — OOS profit ≥ ${thresholds?.min_oos_profit ?? 0} · Max drawdown < ${thresholds?.max_drawdown_threshold ?? 30}%`
                }
              </p>
            </div>
          </div>

          {/* Active thresholds summary */}
          <div className="flex flex-wrap gap-1.5">
            {gf.reason === "sharp_peak" ? (
              <span className="badge badge-xs badge-outline badge-secondary">
                Sensitivity {'>'} 25% (Robustness Gate)
              </span>
            ) : (
              <>
                <span className="badge badge-xs badge-outline badge-error">
                  Min OOS Profit: {thresholds?.min_oos_profit ?? 0}
                </span>
                <span className="badge badge-xs badge-outline badge-error">
                  Max DD: {thresholds?.max_drawdown_threshold ?? 30}%
                </span>
              </>
            )}
            {best_attempt && best_attempt.profit != null && (
              <span className={`badge badge-xs badge-outline ${gf.reason === "sharp_peak" ? "badge-secondary" : "badge-warning"}`}>
                Best profit: {best_attempt.profit >= 0 ? "+" : ""}{(best_attempt.profit * 100).toFixed(2)}%
                ({best_attempt.label})
              </span>
            )}
          </div>

        {/* Retry history table (collapsible) */}
        <div>
          <button
            type="button"
            className="flex items-center gap-1.5 text-[10px] text-error/70 hover:text-error cursor-pointer select-none transition-colors"
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}>▶</span>
            {open ? "Hide" : "Show"} attempt history ({attempts?.length ?? 0} attempts)
          </button>
          {open && <RetryHistoryTable history={attempts} />}
        </div>

        {/* Best attempt artifact */}
        {best_attempt_file && (
          <div className="rounded-lg bg-base-300/50 border border-base-300 px-3 py-2 flex items-center gap-2">
            <span className="text-warning">📄</span>
            <span className="text-[10px] text-base-content/70">
              Best attempt saved as <span className="font-mono text-base-content/90">{best_attempt_file}</span>
              {best_attempt_strategy_name && (
                <span> and added to your strategy list as <span className="font-mono text-success/80">{best_attempt_strategy_name}</span></span>
              )}
            </span>
          </div>
        )}

        {/* Actionable suggestions */}
        {suggestions && suggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wider">Suggestions</p>
            <ul className="space-y-1">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-base-content/70">
                  <span className="text-warning shrink-0 mt-0.5">→</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Retry with relaxed thresholds button — not applicable for Sharp Peak failures */}
      {onRetryRelaxed && best_attempt && gf.reason !== "sharp_peak" && (() => {
        const relaxedProfit = best_attempt.profit != null
          ? parseFloat((best_attempt.profit - 0.01).toFixed(4))
          : null;
        const relaxedDd = Math.min(35, parseFloat(((best_attempt.drawdown ?? thresholds?.max_drawdown_threshold ?? 30) + 5).toFixed(1)));
        return (
          <button
            type="button"
            className="btn btn-sm btn-outline btn-warning gap-2 w-full"
            onClick={() => onRetryRelaxed(best_attempt, thresholds, best_attempt_strategy_name)}
          >
            🔄 Retry with Relaxed Thresholds
            {relaxedProfit != null && (
              <span className="text-[10px] opacity-70 normal-case">
                (OOS gate → {relaxedProfit.toFixed(4)}, DD → {relaxedDd}%
                {best_attempt_strategy_name ? `, strategy → ${best_attempt_strategy_name}` : ""})
              </span>
            )}
          </button>
        );
      })()}
    </div>
  );
}

function FailureReport({ state, onRetryRelaxed }) {
  const failedStage = state.stages?.find((s) => s.status === "failed");
  const gf = state.generalization_failure
    ?? (failedStage?.data?.attempts ? failedStage.data : null);
  // Stage 4 = OOS overfitting exhaustion; Stage 2 = Sharp Peak sensitivity exhaustion
  const isGeneralizationFailure = (failedStage?.index === 4 || failedStage?.index === 2) && gf;

  return (
    <div className={`rounded-xl border p-4 ${isGeneralizationFailure ? (gf.reason === "sharp_peak" ? "border-secondary/30 bg-secondary/5" : "border-error/30 bg-error/5") : "border-error/40 bg-error/10"}`}>
      <div className="flex items-start gap-2">
        <span className={gf?.reason === "sharp_peak" ? "text-secondary text-lg shrink-0" : "text-error text-lg shrink-0"}>
          {gf?.reason === "sharp_peak" ? "🏔️" : "✗"}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className={`font-bold text-sm ${gf?.reason === "sharp_peak" ? "text-secondary" : "text-error"}`}>
            {gf?.reason === "sharp_peak" ? "Robustness Gate Failed" : "Pipeline Failed"}
          </h4>
          {failedStage && (
            <p className="text-xs mt-1 text-base-content/70">
              Stage {failedStage.index} — {failedStage.name}
              {isGeneralizationFailure ? "" : `: ${failedStage.message}`}
            </p>
          )}
          {!failedStage && state.error && (
            <p className="text-xs mt-1 text-base-content/70">{state.error}</p>
          )}
          {isGeneralizationFailure && (
            <GeneralizationFailurePanel gf={gf} onRetryRelaxed={onRetryRelaxed} />
          )}
        </div>
      </div>
    </div>
  );
}

function InterruptedReport({ state }) {
  const lastStage = state.stages?.filter((s) => s.status !== "pending").slice(-1)[0];
  const interruptedAt = state.completed_at || state.created_at;
  return (
    <div className="alert border border-warning/40 bg-warning/10 text-warning">
      <div className="flex flex-col gap-1">
        <h4 className="font-bold text-sm flex items-center gap-2">
          ⚠ Pipeline was interrupted (backend restarted)
        </h4>
        {lastStage && (
          <p className="text-xs opacity-80">
            Last active stage: {lastStage.index} — {lastStage.name}
            {lastStage.message ? `: ${lastStage.message}` : ""}
          </p>
        )}
        {interruptedAt && (
          <p className="text-xs opacity-60">
            Detected at: {new Date(interruptedAt).toLocaleString(undefined, {
              month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        )}
        <p className="text-xs opacity-60 mt-0.5">
          The run could not complete because the server restarted mid-execution. You may start a new run.
        </p>
      </div>
    </div>
  );
}

function WfoWindowsTable({ windows = [] }) {
  if (windows.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-base-content/40 py-4 justify-center">
        <span className="loading loading-dots loading-xs" />
        Waiting for first window…
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="table table-xs w-full">
        <thead>
          <tr className="text-base-content/40 text-[9px] uppercase tracking-wider">
            <th className="font-semibold">Win</th>
            <th className="font-semibold">IS Period</th>
            <th className="font-semibold">OOS Period</th>
            <th className="font-semibold text-right">Profit</th>
            <th className="font-semibold text-right">Max DD</th>
            <th className="font-semibold text-right">Trades</th>
            <th className="font-semibold text-right">Weight</th>
            <th className="font-semibold text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {windows.map((w) => {
            const isLast = w.window === windows[windows.length - 1]?.window;
            const profit = w.profit != null ? w.profit : null;
            return (
              <tr
                key={w.window}
                className={`text-xs ${isLast ? "bg-primary/5 font-medium" : ""}`}
              >
                <td>
                  <span className="font-mono text-base-content/60">W{w.window}</span>
                  {isLast && (
                    <span className="ml-1 badge badge-primary badge-xs">latest</span>
                  )}
                </td>
                <td className="font-mono text-[10px] text-base-content/50">{w.is_range?.replace("-", " → ")}</td>
                <td className="font-mono text-[10px] text-base-content/50">{w.oos_range?.replace("-", " → ")}</td>
                <td className={`text-right font-mono font-semibold ${
                  profit == null ? "text-base-content/30" :
                  profit >= 0 ? "text-success" : "text-error"
                }`}>
                  {profit == null ? "—" : `${profit >= 0 ? "+" : ""}${profit.toFixed(2)}%`}
                </td>
                <td className={`text-right font-mono ${
                  w.max_dd == null ? "text-base-content/30" :
                  w.max_dd > 20 ? "text-error" : w.max_dd > 10 ? "text-warning" : "text-base-content/60"
                }`}>
                  {w.max_dd == null ? "—" : `${w.max_dd.toFixed(1)}%`}
                </td>
                <td className="text-right font-mono text-base-content/60">
                  {w.trades ?? "—"}
                </td>
                <td className="text-right font-mono text-base-content/40 text-[10px]">
                  {w.recency_weight?.toFixed(2) ?? "—"}×
                </td>
                <td className="text-center">
                  {w.status === "passed" && <span className="badge badge-success badge-xs">✓</span>}
                  {w.status === "warning" && <span className="badge badge-warning badge-xs">⚠</span>}
                  {w.status === "failed" && <span className="badge badge-error badge-xs">✗</span>}
                  {!w.status && <span className="badge badge-ghost badge-xs">…</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function SignalStrengthViz({ weights }) {
  if (!weights || Object.keys(weights).length === 0) return null;

  const rsi  = parseFloat(weights.rsi_weight  ?? 0);
  const macd = parseFloat(weights.macd_weight ?? 0);
  const bb   = parseFloat(weights.bb_weight   ?? 0);
  const threshold = parseFloat(weights.consensus_threshold ?? 0.5);
  const total = rsi + macd + bb;

  const signals = [
    { label: "RSI Oversold",  key: "rsi",  weight: rsi,  color: "bg-blue-400" },
    { label: "MACD Cross",    key: "macd", weight: macd, color: "bg-violet-400" },
    { label: "BB Breakout",   key: "bb",   weight: bb,   color: "bg-amber-400" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
          Alpha Signal Composition
        </h4>
        <span className="badge badge-xs badge-outline">
          Threshold: {(threshold * 100).toFixed(0)}%
        </span>
      </div>

      <div className="space-y-2">
        {signals.map(({ label, key, weight, color }) => {
          const pct = total > 0 ? (weight / total) * 100 : 0;
          const isActive = weight > 0.01;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${isActive ? color : "bg-base-content/20"}`} />
                  <span className={isActive ? "text-base-content/80 font-medium" : "text-base-content/35 line-through"}>
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[10px] ${isActive ? "text-base-content/60" : "text-base-content/25"}`}>
                    w={weight.toFixed(2)}
                  </span>
                  <span className={`font-bold text-xs ${isActive ? "text-base-content/80" : "text-base-content/25"}`}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-base-300 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isActive ? color : "bg-base-content/10"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-base-300/50">
        <div className="text-[10px] text-base-content/45 leading-relaxed">
          Hyperopt set signals with weight ≈ 0 to <span className="text-base-content/60 font-medium">off</span>.
          The normalized score reaches <span className="text-base-content/60 font-medium">1.0</span> only when
          all active signals vote buy simultaneously.
        </div>
      </div>
    </div>
  );
}

function playChime(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
  } catch {}
}

function statusBadgeClass(status) {
  switch (status) {
    case "completed":    return "badge-success";
    case "failed":       return "badge-error";
    case "cancelled":    return "badge-warning";
    case "interrupted":  return "badge-warning";
    case "running":      return "badge-primary";
    default:             return "badge-ghost";
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}


export default function AutoQuantTab({ strategies = [], strategiesLoading = false }) {
  const [form, setForm] = useState({
    strategy: "",
    // Robustness-first workflow fields
    trading_style: "swing",
    risk_profile: "balanced",
    analysis_depth: "standard",
    // Legacy fields (hidden in advanced settings)
    timeframe: "5m",
    in_sample_range: "20230101-20240101",
    out_sample_range: "20240101-20241201",
    exchange: "binance",
    pair_universe: "",  // Custom pair list for multi-pair backtesting
    max_drawdown_threshold: 30,
    min_win_rate: 40,
    min_profit_factor: 1.0,
    min_sharpe: 0.5,
    min_oos_profit: 0.0,
    monte_carlo_threshold: 0.35,
    hyperopt_loss: "ProfitLockinHyperOptLoss",
    hyperopt_spaces: ["buy", "stoploss", "roi"],
    hyperopt_epochs: 100,
    wfo_enabled: false,
    wfo_is_months: 3,
    wfo_oos_months: 1,
    wfo_recency_weight: 1.0,
    ensemble_enabled: false,
  });

  const [strategyList, setStrategyList] = useState(strategies);
  const [generateStatus, setGenerateStatus] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [templateType, setTemplateType] = useState("omni");
  const [timeframeProfile, setTimeframeProfile] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setStrategyList(strategies);
  }, [strategies]);

  // Load saved options on mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auto-quant/options`);
        if (res.ok) {
          const data = await res.json();
          setForm((prev) => ({
            ...prev,
            ...data,
          }));
        }
      } catch (err) {
        console.error("Failed to load saved options:", err);
      }
    };
    loadOptions();
  }, []);

  // Save options on form change with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auto-quant/options`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          console.error("Failed to save options");
        }
      } catch (err) {
        console.error("Failed to save options:", err);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [form]);

  const applyTimeframeThresholds = useCallback(async (tf) => {
    try {
      const res = await fetch(`${API_BASE}/api/auto-quant/timeframe-thresholds/${tf}`);
      if (!res.ok) return;
      const data = await res.json();
      setTimeframeProfile(data);
      setForm((prev) => ({
        ...prev,
        min_oos_profit: data.min_oos_profit,
        max_drawdown_threshold: data.max_drawdown_threshold,
        min_win_rate: data.min_win_rate,
        min_profit_factor: data.min_profit_factor,
        min_sharpe: data.min_sharpe,
      }));
    } catch {}
  }, []);

  useEffect(() => {
    applyTimeframeThresholds(form.timeframe);
  }, [form.timeframe, applyTimeframeThresholds]);

  const handleGenerateTemplate = async () => {
    setIsGenerating(true);
    setGenerateStatus(null);
    const nameMap = {
      catfactory: "CatFactory",
      adaptive: "AdaptiveFactory",
      ensemble: "EnsembleFactory",
      momentum: "MomentumFactory",
      omni: "OmniFactory",
    };
    const name = nameMap[templateType] ?? "OmniFactory";
    const payload = {
      strategy_name: name,
      adaptive: templateType === "adaptive",
      ensemble: templateType === "ensemble",
      momentum: templateType === "momentum",
      omni: templateType === "omni",
      timeframe: form.timeframe,
    };
    try {
      const res = await fetch(`${API_BASE}/api/auto-quant/generate-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateStatus({ ok: false, message: data.detail || "Failed to generate template." });
        return;
      }
      const newEntry = { strategy_name: data.strategy_name };
      setStrategyList((prev) =>
        prev.some((s) => s.strategy_name === data.strategy_name)
          ? prev
          : [...prev, newEntry]
      );
      updateField("strategy", data.strategy_name);
      setGenerateStatus({ ok: true, message: `Strategy "${data.strategy_name}" created and selected.` });
    } catch (err) {
      setGenerateStatus({ ok: false, message: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const [logFilter, setLogFilter] = useState("");

  const handleScreenPairs = async () => {
    if (!form.strategy || !screenPairs.trim()) return;
    setScreening(true);
    setScreenResults([]);
    setScreenError(null);
    const pairList = screenPairs
      .split(/[,\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const payload = {
      strategy: form.strategy,
      timeframe: form.timeframe,
      date_range: form.in_sample_range,
      pairs: pairList,
      exchange: form.exchange,
      config_file: null,
    };
    try {
      const res = await fetch(`${API_BASE}/api/auto-quant/screen-pairs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setScreenError(data.detail || "Screening failed.");
        return;
      }
      setScreenResults(data.results || []);
      if (data.errors?.length > 0) {
        setScreenError(
          `${data.errors.length} pair(s) had errors: ${data.errors.slice(0, 3).join("; ")}`
        );
      }
    } catch (err) {
      setScreenError(err.message);
    } finally {
      setScreening(false);
    }
  };

  const [showHyperopt, setShowHyperopt] = useState(false);
  const [showWfo, setShowWfo] = useState(false);
  const [showEnsemble, setShowEnsemble] = useState(false);
  const [showScreener, setShowScreener] = useState(false);
  const [screenPairs, setScreenPairs] = useState("BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT,ADA/USDT");
  const [screening, setScreening] = useState(false);
  const [screenResults, setScreenResults] = useState([]);
  const [screenError, setScreenError] = useState(null);
  const [selectedPair, setSelectedPair] = useState(null);

  const toggleSpace = (space) => {
    updateField(
      "hyperopt_spaces",
      form.hyperopt_spaces.includes(space)
        ? form.hyperopt_spaces.filter((s) => s !== space)
        : [...form.hyperopt_spaces, space]
    );
  };

  const [runId, setRunId] = useState(null);
  const [pipelineState, setPipelineState] = useState(null);
  const [logLines, setLogLines] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [report, setReport] = useState(null);
  const [fitnessCurve, setFitnessCurve] = useState([]);
  const [hyperoptProgress, setHyperoptProgress] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
  const [wfoWindows, setWfoWindows] = useState([]);
  const elapsedRef = useRef(null);
  const startTimeRef = useRef(null);
  const wsRef = useRef(null);
  const runHistoryRef = useRef(null);
  const prevStatusRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const [dataHealingStatus, setDataHealingStatus] = useState(null);
  const [pairStatusMap, setPairStatusMap] = useState({});

  const [notifEnabled, setNotifEnabled] = useState(() => {
    try { return localStorage.getItem("aq_notif_enabled") === "true"; } catch { return false; }
  });

  const updateField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleToggleNotif = useCallback(async () => {
    if (!notifEnabled) {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission().catch(() => {});
      }
      setNotifEnabled(true);
      try { localStorage.setItem("aq_notif_enabled", "true"); } catch {}
    } else {
      setNotifEnabled(false);
      try { localStorage.setItem("aq_notif_enabled", "false"); } catch {}
    }
  }, [notifEnabled]);

  useEffect(() => {
    const status = pipelineState?.status;
    const prev = prevStatusRef.current;
    if (status === prev || !status) { prevStatusRef.current = status; return; }
    prevStatusRef.current = status;

    if (status === "completed" || status === "failed") {
      if (notifEnabled) {
        playChime(status === "completed" ? "success" : "failure");
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(status === "completed" ? "✅ Run complete" : "❌ Run failed", {
              body: status === "completed"
                ? "Auto-Quant pipeline finished successfully."
                : "Auto-Quant pipeline encountered an error.",
              icon: "/favicon.ico",
            });
          } catch {}
        }
      }
    }
  }, [pipelineState?.status, notifEnabled]);

  const appendLog = useCallback((line) => {
    setLogLines((prev) => {
      const next = [...prev, line];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  const connectWs = useCallback(
    (id) => {
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(getWsUrl(id));
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);

          if (msg.type === "keepalive") return;

          if (msg.type === "snapshot" || msg.type === "final") {
            if (msg.data) {
              setPipelineState(msg.data);
            }
            if (msg.type === "final" && msg.data?.status === "completed" && msg.data?.report) {
              setReport(msg.data.report);
            }
            if (msg.type === "final") {
              runHistoryRef.current?.refresh();
              if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
            }
            if (msg.message && msg.message !== "Connected to pipeline stream.") {
              appendLog(`[${msg.status?.toUpperCase()}] ${msg.message}`);
            }
            return;
          }

          // WFO window result — update rolling windows table
          if (msg.type === "wfo_window" && msg.data?.window != null) {
            setWfoWindows((prev) => {
              const next = prev.filter((w) => w.window !== msg.data.window);
              return [...next, msg.data].sort((a, b) => a.window - b.window);
            });
            return;
          }

          // Sensitivity / robustness check result
          if (msg.type === "sensitivity_result" && msg.data?.sensitivity != null) {
            setPipelineState((prev) => prev ? { ...prev, sensitivity: msg.data.sensitivity } : prev);
            return;
          }

          // Hyperopt epoch telemetry — update fitness curve + candidate list
          if (msg.type === "hyperopt_epoch" && msg.data?.epoch != null) {
            const ep = msg.data;
            setHyperoptProgress({ current: ep.epoch, total: ep.total_epochs });
            setFitnessCurve((prev) => {
              const next = [...prev, {
                epoch: ep.epoch,
                objective: ep.objective,
                profit_usdt: ep.profit_usdt,
                avg_profit_pct: ep.avg_profit_pct,
                trades: ep.trades,
              }];
              return next.length > 500 ? next.slice(-500) : next;
            });
            return;
          }

          // Data healing events
          if (msg.type === "data_healing_start" && msg.data) {
            setDataHealingStatus({
              total_pairs: msg.data.pairs?.length || 0,
              timerange: msg.data.timerange,
              timeframe: msg.data.timeframe,
              warmup_candles: msg.data.warmup_candles,
              in_progress: true,
            });
            setPairStatusMap({});
            return;
          }

          if (msg.type === "data_pair_status" && msg.data) {
            setPairStatusMap((prev) => ({
              ...prev,
              [msg.data.pair]: {
                status: msg.data.status,
                reason: msg.data.reason,
                candles_before: msg.data.candles_before,
                candles_after: msg.data.candles_after,
              },
            }));
            return;
          }

          if (msg.type === "data_healing_summary" && msg.data) {
            setDataHealingStatus((prev) => ({
              ...prev,
              ...msg.data,
              in_progress: false,
            }));
            return;
          }

          // Regular stage update
          if (msg.message) {
            const prefix = msg.stage > 0 && msg.stage <= 7 ? `[Stage ${msg.stage}] ` : "";
            appendLog(`${prefix}${msg.message}`);
          }

          // Merge stage update into pipeline state
          setPipelineState((prev) => {
            if (!prev) return prev;
            const stages = prev.stages.map((s) => {
              if (s.index === msg.stage) {
                const updated = {
                  ...s,
                  status:
                    msg.status === "passed" || msg.status === "failed"
                      ? msg.status
                      : msg.status === "running"
                      ? "running"
                      : s.status,
                  message: msg.message || s.message,
                  data: msg.data && typeof msg.data === "object" && Object.keys(msg.data).length > 0 ? msg.data : s.data,
                };
                if (msg.started_at != null) updated.started_at = msg.started_at;
                if (msg.duration_s != null) updated.duration_s = msg.duration_s;
                return updated;
              }
              return s;
            });

            const newStatus =
              msg.status === "failed"
                ? "failed"
                : msg.progress === 100
                ? "completed"
                : prev.status;

            // Validate status transition
            if (!isValidStatusTransition(prev.status, newStatus)) {
              console.warn(`[State Transition] Invalid transition: ${prev.status} → ${newStatus}. Keeping current status.`);
              return prev;
            }

            // Log valid state transitions
            if (newStatus !== prev.status) {
              console.log(`[State Transition] ${prev.status} → ${newStatus}`);
            }

            return {
              ...prev,
              stages,
              status: newStatus,
              current_stage:
                msg.stage > 0 && msg.stage <= 7 ? msg.stage : prev.current_stage,
            };
          });

          if (msg.data?.report) {
            setReport(msg.data.report);
          }
        } catch {
          // non-JSON line — append raw
          appendLog(evt.data);
        }
      };

      ws.onerror = () => {
        appendLog("[WebSocket error — will attempt reconnect if pipeline is still running...]");
      };

      ws.onclose = () => {
        if (!id) return;
        fetch(`${API_BASE}/api/auto-quant/status/${id}`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            if (!data) return;
            setPipelineState(data);
            if (data.status === "running" || data.status === "pending") {
              if (data.created_at && !elapsedRef.current) {
                const origin = new Date(data.created_at).getTime();
                if (!isNaN(origin)) {
                  startTimeRef.current = origin;
                  elapsedRef.current = setInterval(() => {
                    setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
                  }, 1000);
                }
              }
              
              // Exponential backoff: 3s, 6s, 12s, 24s, 30s (capped)
              const delay = Math.min(3000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
              reconnectAttemptsRef.current += 1;
              
              if (reconnectAttemptsRef.current > maxReconnectAttempts) {
                appendLog(`[ERROR] Max reconnection attempts (${maxReconnectAttempts}) reached. Giving up.`);
                return;
              }
              
              appendLog(`[WebSocket disconnected — reconnecting in ${delay / 1000}s... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
              setTimeout(() => connectWs(id), delay);
              return;
            }
            if (data.status === "completed") {
              return fetch(`${API_BASE}/api/auto-quant/report/${id}`)
                .then((r) => r.ok ? r.json() : null)
                .then((r) => { if (r) setReport(r); });
            }
          })
          .catch(() => {});
      };
    },
    [appendLog]
  );

  const handleStart = async () => {
    if (!form.strategy) return;
    setIsConnecting(true);
    setLogLines([]);
    setPipelineState(null);
    setReport(null);
    setFitnessCurve([]);
    setHyperoptProgress(null);
    setElapsedSeconds(0);
    setWfoWindows([]);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    startTimeRef.current = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // Parse pair_universe from comma-separated string to list
    const pairUniverseList = form.pair_universe
      ? form.pair_universe.split(',').map(p => p.trim()).filter(Boolean)
      : null;

    try {
      const res = await fetch(`${API_BASE}/api/auto-quant/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pair_universe: pairUniverseList,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        appendLog(`[ERROR] Failed to start pipeline: ${err.detail || res.statusText}`);
        setIsConnecting(false);
        return;
      }

      const data = await res.json();
      const id = data.run_id;
      setRunId(id);

      // Initialize pipeline state
      setPipelineState({
        run_id: id,
        strategy: form.strategy,
        status: "running",
        current_stage: 0,
        stages: STAGE_NAMES.map((name, i) => ({
          index: i + 1,
          name,
          status: "pending",
          message: "",
          data: {},
        })),
      });

      appendLog(`[INFO] Pipeline started — run_id: ${id}`);
      appendLog(`[INFO] Connecting to live stream...`);
      connectWs(id);
    } catch (err) {
      appendLog(`[ERROR] ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCancel = async () => {
    if (!runId) return;
    try {
      await fetch(`${API_BASE}/api/auto-quant/cancel/${runId}`, { method: "POST" });
      appendLog("[INFO] Cancellation requested.");
    } catch {
      appendLog("[ERROR] Failed to send cancellation request.");
    }
  };

  const handleReset = () => {
    if (wsRef.current) wsRef.current.close();
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    setRunId(null);
    setPipelineState(null);
    setLogLines([]);
    setReport(null);
    setFitnessCurve([]);
    setHyperoptProgress(null);
    setElapsedSeconds(0);
    setWfoWindows([]);
    setDataHealingStatus(null);
    setPairStatusMap({});
  };

  const handleRetryRelaxed = useCallback((bestAttempt, thresholds, bestStrategyName) => {
    const bestProfit = bestAttempt?.profit ?? null;
    const bestDd = bestAttempt?.drawdown ?? thresholds?.max_drawdown_threshold ?? 30;
    const relaxedProfit = bestProfit != null ? parseFloat((bestProfit - 0.01).toFixed(4)) : 0;
    const relaxedDd = Math.min(35, parseFloat((bestDd + 5).toFixed(1)));
    setForm((prev) => ({
      ...prev,
      min_oos_profit: relaxedProfit,
      max_drawdown_threshold: relaxedDd,
      ...(bestStrategyName ? { strategy: bestStrategyName } : {}),
    }));
    handleReset();
  }, []);

  const handleLoadRun = useCallback(
    (run) => {
      if (wsRef.current) wsRef.current.close();
      setRunId(run.run_id);
      setLogLines([]);
      setReport(run.report || null);
      setWfoWindows(run.wfo_windows || []);
      setPipelineState({
        run_id: run.run_id,
        strategy: run.strategy,
        timeframe: run.timeframe,
        in_sample_range: run.in_sample_range,
        out_sample_range: run.out_sample_range,
        exchange: run.exchange,
        status: run.status,
        current_stage: run.current_stage || 0,
        stages: run.stages || STAGE_NAMES.map((name, i) => ({
          index: i + 1, name, status: "pending", message: "", data: {},
        })),
        error: run.error || null,
        created_at: run.created_at,
        completed_at: run.completed_at,
        retry_history: run.retry_history || [],
        generalization_failure: run.generalization_failure || null,
        sensitivity: run.sensitivity || null,
        thresholds: run.thresholds || null,
      });
      appendLog(`[INFO] Loaded run ${run.run_id} (${run.status})`);

      if (run.status === "completed" && !run.report) {
        fetch(`${API_BASE}/api/auto-quant/report/${run.run_id}`)
          .then((r) => r.json())
          .then(setReport)
          .catch(() => {});
      }
    },
    [appendLog]
  );

  const handleReconnect = useCallback(
    (id) => {
      if (wsRef.current) wsRef.current.close();
      setRunId(id);
      setLogLines([]);
      setReport(null);

      fetch(`${API_BASE}/api/auto-quant/status/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setPipelineState(data);
          setWfoWindows(data.wfo_windows || []);
          if (data.status === "completed" && data.report) {
            setReport(data.report);
          } else if (data.status === "completed") {
            return fetch(`${API_BASE}/api/auto-quant/report/${id}`)
              .then((r) => r.json())
              .then(setReport);
          } else if (data.status === "running" || data.status === "pending") {
            appendLog(`[INFO] Reconnecting to live stream for run ${id}...`);
            connectWs(id);
          }
        })
        .catch(() => {
          appendLog(`[ERROR] Failed to load run ${id}`);
        });
    },
    [appendLog, connectWs]
  );

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  const formatElapsed = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const isRunning =
    pipelineState?.status === "running" || pipelineState?.status === "pending";

  // Calculate estimated time remaining based on current stage progress
  useEffect(() => {
    if (!isRunning || elapsedSeconds === 0) {
      setEstimatedTimeRemaining(null);
      return;
    }
    
    const currentStage = pipelineState?.current_stage || 0;
    if (currentStage === 0) {
      setEstimatedTimeRemaining(null);
      return;
    }
    
    // Estimate based on: elapsed time / current stage * total stages (7)
    const totalStages = 7;
    const avgTimePerStage = elapsedSeconds / currentStage;
    const remainingStages = totalStages - currentStage;
    const estimatedRemaining = Math.round(avgTimePerStage * remainingStages);
    
    setEstimatedTimeRemaining(estimatedRemaining);
  }, [elapsedSeconds, pipelineState?.current_stage, isRunning]);
  const isCompleted = pipelineState?.status === "completed";
  const isFailed = pipelineState?.status === "failed";
  const isCancelled = pipelineState?.status === "cancelled";
  const isInterrupted = pipelineState?.status === "interrupted";
  const isDone = isCompleted || isFailed || isCancelled || isInterrupted;

  const progress =
    pipelineState?.current_stage > 0
      ? Math.round((pipelineState.current_stage / 7) * 100)
      : 0;

  return (
    <div className="py-6 px-4 sm:px-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Auto-Quant Factory</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Fully automated 7-stage strategy optimization — sanity check, hyperopt,
            parameter injection, OOS validation, stress test, risk assessment, and delivery.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleNotif}
          title={notifEnabled ? "Notifications on — click to disable" : "Enable run notifications"}
          className={`btn btn-sm btn-circle shrink-0 mt-0.5 transition-all ${
            notifEnabled
              ? "btn-primary shadow-sm shadow-primary/30"
              : "btn-ghost text-base-content/40 hover:text-base-content/70"
          }`}
        >
          🔔
        </button>
      </div>

      {/* Config form + Recent Runs */}
      {!pipelineState && (
        <>
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-5 space-y-5">
            <h2 className="text-sm font-semibold">Pipeline Configuration</h2>

            {/* ── Section: Robustness-First Settings (NEW) ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
                Robustness-First Settings
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Trading Style */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs font-medium">Trading Style</span>
                  </label>
                  <select
                    className="select select-bordered select-sm"
                    value={form.trading_style}
                    onChange={(e) => updateField("trading_style", e.target.value)}
                  >
                    <option value="scalping">Scalping (1m-5m)</option>
                    <option value="intraday">Intraday (5m-30m)</option>
                    <option value="swing">Swing (1h-4h)</option>
                    <option value="position">Position (1d+)</option>
                  </select>
                  <label className="label py-0.5">
                    <span className="label-text-alt text-base-content/40">
                      Auto-selects timeframe & thresholds
                    </span>
                  </label>
                </div>

                {/* Risk Profile */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs font-medium">Risk Profile</span>
                  </label>
                  <select
                    className="select select-bordered select-sm"
                    value={form.risk_profile}
                    onChange={(e) => updateField("risk_profile", e.target.value)}
                  >
                    <option value="conservative">Conservative (low risk)</option>
                    <option value="balanced">Balanced (moderate risk)</option>
                    <option value="aggressive">Aggressive (high risk)</option>
                  </select>
                  <label className="label py-0.5">
                    <span className="label-text-alt text-base-content/40">
                      Adjusts drawdown & profit factor gates
                    </span>
                  </label>
                </div>

                {/* Analysis Depth */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs font-medium">Analysis Depth</span>
                  </label>
                  <select
                    className="select select-bordered select-sm"
                    value={form.analysis_depth}
                    onChange={(e) => updateField("analysis_depth", e.target.value)}
                  >
                    <option value="quick">Quick (3 months IS)</option>
                    <option value="standard">Standard (6 months IS)</option>
                    <option value="deep">Deep (12 months IS)</option>
                  </select>
                  <label className="label py-0.5">
                    <span className="label-text-alt text-base-content/40">
                      Sets date ranges & hyperopt epochs
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* ── Section: Strategy ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
                Strategy
              </p>
              <div className="form-control">
                <div className="flex gap-2 items-start flex-wrap">
                  {strategiesLoading ? (
                    <div className="skeleton h-9 flex-1 rounded-lg" />
                  ) : (
                    <select
                      className="select select-bordered select-sm flex-1"
                      value={form.strategy}
                      onChange={(e) => updateField("strategy", e.target.value)}
                    >
                      <option value="">Select strategy...</option>
                      {strategyList.map((s) => (
                        <option key={s.strategy_name} value={s.strategy_name}>
                          {s.strategy_name}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    className="select select-bordered select-sm shrink-0"
                    value={templateType}
                    onChange={(e) => setTemplateType(e.target.value)}
                    disabled={isGenerating}
                    title="Choose which strategy template to generate"
                  >
                    <option value="omni">⚡ Omni-Strategy (Boolean Switches)</option>
                    <option value="catfactory">CatFactory (MACD/RSI/BB)</option>
                    <option value="adaptive">Adaptive Regime (ATR)</option>
                    <option value="ensemble">Ensemble (Weighted Voting)</option>
                    <option value="momentum">Momentum (EMA + ATR)</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-1.5 shrink-0"
                    onClick={handleGenerateTemplate}
                    disabled={isGenerating}
                    title="Generate the selected strategy template"
                  >
                    {isGenerating ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      "✦"
                    )}
                    Generate
                  </button>
                </div>
                {generateStatus && (
                  <div
                    className={`mt-1.5 text-xs px-2 py-1 rounded ${
                      generateStatus.ok
                        ? "text-success bg-success/10"
                        : "text-error bg-error/10"
                    }`}
                  >
                    {generateStatus.message}
                  </div>
                )}
              </div>
            </div>

            {/* ── Section: Advanced Settings (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <span>Advanced Settings</span>
                <span className="text-base-content/40 text-[10px]">
                  {showAdvanced ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showAdvanced && (
                <div className="px-4 pb-4 pt-3 bg-base-300/30 space-y-5">
                  {/* ── Subsection: Time Ranges & Exchange ── */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
                      Time Ranges &amp; Exchange
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Timeframe */}
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Timeframe</span>
                          {timeframeProfile && (
                            <span className={`label-text-alt badge badge-xs font-semibold ${
                              timeframeProfile.profile === "Scalping" ? "badge-warning" :
                              timeframeProfile.profile === "Intraday" ? "badge-info" :
                              timeframeProfile.profile === "Swing"    ? "badge-primary" :
                              timeframeProfile.profile === "Position" ? "badge-secondary" :
                              "badge-ghost"
                            }`}>
                              {timeframeProfile.profile}
                            </span>
                          )}
                        </label>
                        <select
                          className="select select-bordered select-sm"
                          value={form.timeframe}
                          onChange={(e) => updateField("timeframe", e.target.value)}
                        >
                          {["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"].map((tf) => (
                            <option key={tf} value={tf}>{tf}</option>
                          ))}
                        </select>
                        {timeframeProfile && (
                          <label className="label py-0.5">
                            <span className="label-text-alt text-base-content/40">
                              {timeframeProfile.description} — thresholds auto-applied
                            </span>
                          </label>
                        )}
                      </div>

                      {/* Exchange */}
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Exchange</span>
                        </label>
                        <select
                          className="select select-bordered select-sm"
                          value={form.exchange}
                          onChange={(e) => updateField("exchange", e.target.value)}
                        >
                          {["binance", "bybit", "kraken", "kucoin", "okx", "gate"].map((ex) => (
                            <option key={ex} value={ex}>{ex}</option>
                          ))}
                        </select>
                      </div>

                      {/* In-sample range */}
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">In-Sample Timerange</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered input-sm font-mono"
                          placeholder="20230101-20240101"
                          value={form.in_sample_range}
                          onChange={(e) => updateField("in_sample_range", e.target.value)}
                        />
                        <label className="label py-0.5">
                          {(() => {
                            try {
                              const [s, e] = form.in_sample_range.split("-");
                              if (s?.length === 8 && e?.length === 8) {
                                const d1 = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`);
                                const d2 = new Date(`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`);
                                const days = Math.round((d2 - d1) / 86400000);
                                const months = (days / 30).toFixed(0);
                                if (days < 90) return <span className="label-text-alt text-error">⚠ {days} days — too short, expect overfitting</span>;
                                if (days < 180) return <span className="label-text-alt text-warning">⚠ {days} days ({months} mo) — recommend 6+ months</span>;
                                return <span className="label-text-alt text-success">✓ {days} days (~{months} months)</span>;
                              }
                            } catch {}
                            return <span className="label-text-alt text-base-content/40">Used for sanity backtest &amp; hyperopt</span>;
                          })()}
                        </label>
                      </div>

                      {/* OOS range */}
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Out-of-Sample Timerange</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered input-sm font-mono"
                          placeholder="20240101-20241201"
                          value={form.out_sample_range}
                          onChange={(e) => updateField("out_sample_range", e.target.value)}
                        />
                        <label className="label py-0.5">
                          <span className="label-text-alt text-base-content/40">
                            Never seen by hyperopt — tests for overfitting
                          </span>
                        </label>
                      </div>

                      {/* Pair Universe (for Omni-Strategy multi-pair backtesting) */}
                      <div className="form-control sm:col-span-2">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Pair Universe</span>
                          <span className="label-text-alt text-[10px] text-base-content/40">for multi-pair filtering</span>
                        </label>
                        <textarea
                          className="textarea textarea-bordered textarea-sm font-mono text-xs leading-relaxed"
                          rows={2}
                          placeholder="BTC/USDT, ETH/USDT, SOL/USDT, ... (leave blank for default Top 50)"
                          value={form.pair_universe}
                          onChange={(e) => updateField("pair_universe", e.target.value)}
                        />
                        <label className="label py-0.5">
                          <div className="flex items-center justify-between w-full">
                            <span className="label-text-alt text-base-content/40">
                              {form.pair_universe
                                ? `${form.pair_universe.split(',').length} custom pairs configured`
                                : "Using default Top 50 USDT pairs by volume"}
                            </span>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost text-[10px] gap-1"
                              onClick={() => {
                                const defaultPairs = "BTC/USDT,ETH/USDT,BNB/USDT,SOL/USDT,XRP/USDT,ADA/USDT,DOGE/USDT,AVAX/USDT,DOT/USDT,MATIC/USDT,LINK/USDT,UNI/USDT,ATOM/USDT,LTC/USDT,ETC/USDT,FIL/USDT,NEAR/USDT,ALGO/USDT,VET/USDT,ICP/USDT,OP/USDT,ARB/USDT,PEPE/USDT,SHIB/USDT,RNDR/USDT,INJ/USDT,APT/USDT,QNT/USDT,AAVE/USDT,MKR/USDT,CRV/USDT,COMP/USDT,YFI/USDT,SNX/USDT,KAVA/USDT,ROSE/USDT,FTM/USDT,GLM/USDT,GRT/USDT,LDO/USDT,FXS/USDT,PENDLE/USDT,GMX/USDT,GALA/USDT,SAND/USDT,MANA/USDT,AXS/USDT,ENJ/USDT,IMX/USDT,SUI/USDT";
                                updateField("pair_universe", defaultPairs);
                              }}
                            >
                              📋 Load Default Top 50
                            </button>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Section: Screen Pairs (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowScreener((v) => !v)}
              >
                <span className="flex items-center gap-2">
                  🔬 Screen Pairs
                  {selectedPair && (
                    <span className="badge badge-xs badge-primary">{selectedPair}</span>
                  )}
                </span>
                <span className="text-base-content/40 text-[10px]">
                  {showScreener ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showScreener && (
                <div className="px-4 pb-4 pt-3 bg-base-300/30 space-y-3">
                  <p className="text-[10px] text-base-content/50 leading-relaxed">
                    Run quick backtests across a list of pairs to find the most profitable for your strategy. Uses the In-Sample timerange. Click any result row to select that pair.
                  </p>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Pairs to Screen</span>
                      <span className="label-text-alt text-[10px] text-base-content/40">comma-separated</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered textarea-sm font-mono text-xs leading-relaxed"
                      rows={2}
                      placeholder="BTC/USDT, ETH/USDT, SOL/USDT, ..."
                      value={screenPairs}
                      onChange={(e) => setScreenPairs(e.target.value)}
                      disabled={screening}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline gap-2 w-full"
                    onClick={handleScreenPairs}
                    disabled={screening || !form.strategy || !screenPairs.trim()}
                    title={!form.strategy ? "Select a strategy first" : ""}
                  >
                    {screening ? (
                      <>
                        <span className="loading loading-spinner loading-xs" />
                        Screening pairs…
                      </>
                    ) : (
                      <>🔬 Screen Pairs</>
                    )}
                  </button>

                  {screenError && (
                    <div className="text-xs text-warning bg-warning/10 border border-warning/20 rounded px-3 py-2">
                      ⚠ {screenError}
                    </div>
                  )}

                  {screenResults.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-base-300">
                      <table className="table table-xs w-full">
                        <thead>
                          <tr className="text-base-content/40 text-[9px] uppercase tracking-wider">
                            <th className="font-semibold">#</th>
                            <th className="font-semibold">Pair</th>
                            <th className="font-semibold text-right">Profit %</th>
                            <th className="font-semibold text-right">Trades</th>
                            <th className="font-semibold text-right">Win Rate</th>
                            <th className="font-semibold text-right">Max DD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {screenResults.map((row, i) => (
                            <tr
                              key={row.pair}
                              className={`cursor-pointer hover:bg-primary/10 transition-colors text-xs ${
                                selectedPair === row.pair
                                  ? "bg-primary/15 border-l-2 border-l-primary"
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedPair(row.pair);
                                updateField("pair_universe", row.pair);
                              }}
                              title="Click to select this pair and populate the Pair Universe field"
                            >
                              <td className="font-mono text-base-content/40 text-[10px]">{i + 1}</td>
                              <td className="font-semibold">
                                {selectedPair === row.pair && (
                                  <span className="mr-1 text-primary text-[10px]">▶</span>
                                )}
                                {row.pair}
                              </td>
                              <td className={`text-right font-mono font-bold ${
                                row.profit_pct == null
                                  ? "text-base-content/30"
                                  : row.profit_pct >= 0
                                  ? "text-success"
                                  : "text-error"
                              }`}>
                                {row.profit_pct == null
                                  ? "—"
                                  : `${row.profit_pct >= 0 ? "+" : ""}${row.profit_pct}%`}
                              </td>
                              <td className="text-right font-mono text-base-content/60">
                                {row.trade_count ?? "—"}
                              </td>
                              <td className={`text-right font-mono ${
                                row.win_rate == null
                                  ? "text-base-content/30"
                                  : row.win_rate >= 50
                                  ? "text-success"
                                  : "text-error"
                              }`}>
                                {row.win_rate == null ? "—" : `${row.win_rate}%`}
                              </td>
                              <td className={`text-right font-mono ${
                                row.max_dd == null
                                  ? "text-base-content/30"
                                  : row.max_dd > 20
                                  ? "text-error"
                                  : row.max_dd > 10
                                  ? "text-warning"
                                  : "text-base-content/60"
                              }`}>
                                {row.max_dd == null ? "—" : `${row.max_dd}%`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {screenResults.length === 0 && !screening && !screenError && (
                    <div className="text-center py-3 text-xs text-base-content/35 italic">
                      Results appear here after screening runs.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Section: Hyperopt Settings (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowHyperopt((v) => !v)}
              >
                <span>Hyperopt Settings</span>
                <span className="text-base-content/40 text-[10px]">
                  {showHyperopt ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showHyperopt && (
                <div className="px-4 pb-4 pt-3 bg-base-300/30 space-y-4">
                  {/* Loss Function */}
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Loss Function</span>
                    </label>
                    <select
                      className="select select-bordered select-sm"
                      value={form.hyperopt_loss}
                      onChange={(e) => updateField("hyperopt_loss", e.target.value)}
                    >
                      <option value="ProfitLockinHyperOptLoss">ProfitLockinHyperOptLoss — locks in high-profit trades (recommended)</option>
                      <option value="SharpeHyperOptLoss">SharpeHyperOptLoss — stable returns, low risk</option>
                      <option value="SortinoHyperOptLoss">SortinoHyperOptLoss — penalises downside volatility only</option>
                      <option value="CalmarHyperOptLoss">CalmarHyperOptLoss — return / max drawdown ratio</option>
                      <option value="MaxDrawDownRelativeHyperOptLoss">MaxDrawDownRelativeHyperOptLoss — minimise drawdown first</option>
                      <option value="OnlyProfitHyperOptLoss">OnlyProfitHyperOptLoss — maximise profit (overfits easily)</option>
                    </select>
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">
                        Sharpe / Sortino / Calmar reduce overfitting vs pure profit optimisation
                      </span>
                    </label>
                  </div>

                  {/* Search Spaces */}
                  {(() => {
                    const SPACE_META = {
                      buy:        { description: "Entry signal thresholds — indicator levels that trigger a buy", costMultiplier: "2×" },
                      sell:       { description: "Exit signal thresholds — indicator levels that trigger a sell", costMultiplier: "2×" },
                      roi:        { description: "Minimum return targets per time bucket", costMultiplier: "1×" },
                      stoploss:   { description: "Fixed stop-loss percentage below entry price", costMultiplier: "1×" },
                      trailing:   { description: "Trailing stop offset that follows price upward", costMultiplier: "1×" },
                      protection: { description: "Cooldown & stoploss-guard rules after losing trades", costMultiplier: "3×" },
                    };
                    const PRESETS = [
                      { label: "Fast",      spaces: ["stoploss", "roi"],               epochs: 50,  title: "Stoploss + ROI — quick result, low overfit risk" },
                      { label: "Balanced",  spaces: ["buy", "roi", "stoploss"],         epochs: 100, title: "Buy + ROI + Stoploss — good starting point" },
                      { label: "Thorough",  spaces: Object.keys(SPACE_META),            epochs: 200, title: "All spaces — best results but takes longest" },
                    ];
                    return (
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Search Spaces</span>
                        </label>

                        {/* Preset buttons */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {PRESETS.map((preset) => {
                            const active =
                              preset.spaces.length === form.hyperopt_spaces.length &&
                              preset.spaces.every((s) => form.hyperopt_spaces.includes(s)) &&
                              form.hyperopt_epochs === preset.epochs;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                title={preset.title}
                                className={`btn btn-xs gap-1 ${active ? "btn-primary" : "btn-outline"}`}
                                onClick={() => {
                                  updateField("hyperopt_spaces", preset.spaces);
                                  updateField("hyperopt_epochs", preset.epochs);
                                }}
                              >
                                {preset.label}
                                <span className="opacity-60 font-normal">{preset.epochs} ep</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Card grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(SPACE_META).map(([space, meta]) => {
                            const active = form.hyperopt_spaces.includes(space);
                            return (
                              <button
                                key={space}
                                type="button"
                                onClick={() => toggleSpace(space)}
                                className={`text-left rounded-lg border px-3 py-2.5 transition-all cursor-pointer select-none ${
                                  active
                                    ? "border-primary bg-primary/10 shadow-sm"
                                    : "border-base-300 bg-base-200/50 hover:border-base-content/30"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs font-mono font-semibold ${active ? "text-primary" : "text-base-content/70"}`}>
                                    {space}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    active ? "bg-primary/20 text-primary" : "bg-base-300 text-base-content/50"
                                  }`}>
                                    {meta.costMultiplier}
                                  </span>
                                </div>
                                <p className="text-[10px] leading-snug text-base-content/50">
                                  {meta.description}
                                </p>
                              </button>
                            );
                          })}
                        </div>

                        <label className="label py-0.5 mt-1">
                          {form.hyperopt_spaces.length === 0 ? (
                            <span className="label-text-alt text-error">Select at least one space</span>
                          ) : form.hyperopt_spaces.length <= 2 ? (
                            <span className="label-text-alt text-success">✓ Fewer spaces = less overfitting</span>
                          ) : form.hyperopt_spaces.length >= 4 ? (
                            <span className="label-text-alt text-warning">⚠ Many spaces increases overfitting risk</span>
                          ) : (
                            <span className="label-text-alt text-base-content/40">More spaces = more parameters to optimise</span>
                          )}
                        </label>
                      </div>
                    );
                  })()}

                  {/* Epochs */}
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Epochs</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-32"
                      min={10}
                      max={1000}
                      step={10}
                      value={form.hyperopt_epochs}
                      onChange={(e) => updateField("hyperopt_epochs", parseInt(e.target.value, 10) || 100)}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">
                        More epochs find better parameters but take longer. 100–200 is a good balance.
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* ── Section: Walk-Forward Optimization (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowWfo((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <span>Walk-Forward Optimization</span>
                  {form.wfo_enabled && (
                    <span className="badge badge-primary badge-xs">ON</span>
                  )}
                </div>
                <span className="text-base-content/40 text-[10px]">
                  {showWfo ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showWfo && (
                <div className="px-4 pb-4 pt-3 bg-base-300/30 space-y-4">
                  <p className="text-[10px] text-base-content/40 leading-relaxed">
                    Instead of a single hyperopt pass, WFO rolls (IS, OOS) windows over the in-sample
                    range — fitting on each IS period and validating on the matching OOS period.
                    Final strategy parameters come from the most recent successful window.
                  </p>

                  {/* Toggle */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="toggle toggle-sm toggle-primary"
                      checked={form.wfo_enabled}
                      onChange={(e) => updateField("wfo_enabled", e.target.checked)}
                      id="wfo-toggle"
                    />
                    <label htmlFor="wfo-toggle" className="text-xs font-medium cursor-pointer">
                      {form.wfo_enabled ? "Walk-Forward enabled" : "Walk-Forward disabled (standard hyperopt)"}
                    </label>
                  </div>

                  {form.wfo_enabled && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">IS Window (months)</span>
                        </label>
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          min={1}
                          max={24}
                          step={1}
                          value={form.wfo_is_months}
                          onChange={(e) => updateField("wfo_is_months", parseInt(e.target.value, 10) || 3)}
                        />
                        <label className="label py-0.5">
                          <span className="label-text-alt text-base-content/40">Training window size</span>
                        </label>
                      </div>

                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">OOS Window (months)</span>
                        </label>
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          min={1}
                          max={6}
                          step={1}
                          value={form.wfo_oos_months}
                          onChange={(e) => updateField("wfo_oos_months", parseInt(e.target.value, 10) || 1)}
                        />
                        <label className="label py-0.5">
                          <span className="label-text-alt text-base-content/40">Validation step size</span>
                        </label>
                      </div>

                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Recency Weight</span>
                        </label>
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          min={1.0}
                          max={3.0}
                          step={0.1}
                          value={form.wfo_recency_weight}
                          onChange={(e) => updateField("wfo_recency_weight", parseFloat(e.target.value) || 1.0)}
                        />
                        <label className="label py-0.5">
                          <span className="label-text-alt text-base-content/40">1.0 = equal weight, &gt;1 favours recent</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {form.wfo_enabled && form.in_sample_range && (() => {
                    const parts = form.in_sample_range.split("-");
                    if (parts.length !== 2) return null;
                    const start = new Date(parts[0].replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));
                    const end   = new Date(parts[1].replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));
                    const totalMonths = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30));
                    const windowSize = form.wfo_is_months + form.wfo_oos_months;
                    const approxWindows = totalMonths >= windowSize
                      ? Math.floor((totalMonths - form.wfo_is_months) / form.wfo_oos_months)
                      : 0;
                    return (
                      <div className={`text-[10px] px-3 py-2 rounded ${
                        approxWindows >= 2
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }`}>
                        {approxWindows >= 2
                          ? `≈ ${approxWindows} rolling windows from your IS range (${totalMonths}m total)`
                          : `⚠ Too few windows (≈${approxWindows}) — increase IS range or reduce window sizes. Need ≥2 windows.`}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── Section: Alpha Consensus Voting (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowEnsemble((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <span>Alpha Consensus Voting</span>
                  {form.ensemble_enabled && (
                    <span className="badge badge-secondary badge-xs">ON</span>
                  )}
                </div>
                <span className="text-base-content/40 text-[10px]">
                  {showEnsemble ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showEnsemble && (
                <div className="px-4 pb-4 pt-3 bg-base-300/30 space-y-4">
                  <p className="text-[10px] text-base-content/40 leading-relaxed">
                    Instead of a single entry signal, the Ensemble strategy computes RSI, MACD, and BB
                    signals simultaneously. Each signal is assigned a weight; the normalized weighted
                    score must exceed a tunable consensus threshold to trigger an entry. Hyperopt
                    discovers the best weights — including setting a weight to 0 to switch a signal off.
                    Weights can also be updated live via <span className="font-mono">user_data/ensemble_weights.json</span>.
                  </p>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="toggle toggle-sm toggle-secondary"
                      checked={form.ensemble_enabled}
                      onChange={(e) => updateField("ensemble_enabled", e.target.checked)}
                      id="ensemble-toggle"
                    />
                    <label htmlFor="ensemble-toggle" className="text-xs font-medium cursor-pointer">
                      {form.ensemble_enabled
                        ? "Alpha Consensus Voting enabled — generates EnsembleFactory"
                        : "Alpha Consensus Voting disabled (single-signal CatFactory)"}
                    </label>
                  </div>

                  {form.ensemble_enabled && (
                    <div className="rounded-lg bg-secondary/10 border border-secondary/25 px-3 py-3 space-y-2">
                      <p className="text-[10px] font-semibold text-secondary/80 uppercase tracking-wider">
                        Default alpha weights (hyperopt will optimise these)
                      </p>
                      <div className="grid grid-cols-3 gap-3 text-[11px]">
                        {[
                          { label: "RSI Oversold", color: "bg-blue-400", default: "0.40" },
                          { label: "MACD Cross",   color: "bg-violet-400", default: "0.30" },
                          { label: "BB Breakout",  color: "bg-amber-400", default: "0.30" },
                        ].map(({ label, color, default: def }) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                            <span className="text-base-content/60">{label}</span>
                            <span className="ml-auto font-mono text-base-content/50">{def}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-base-content/35">
                        Consensus threshold: 0.50 (default) — score = Σ(vote × weight) / Σ(weight)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Section: Risk Thresholds (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <span>Risk Thresholds</span>
                <span className="text-base-content/40 text-[10px]">
                  {showAdvanced ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showAdvanced && (
                <div className="px-4 pb-4 pt-2 bg-base-300/30 grid grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Max Drawdown (%)</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      min={1}
                      max={100}
                      step={1}
                      value={form.max_drawdown_threshold}
                      onChange={(e) => updateField("max_drawdown_threshold", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">Default: 30%</span>
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Min Win Rate (%)</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      min={0}
                      max={100}
                      step={1}
                      value={form.min_win_rate}
                      onChange={(e) => updateField("min_win_rate", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">Default: 40%</span>
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Min Profit Factor</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      min={0}
                      step={0.1}
                      value={form.min_profit_factor}
                      onChange={(e) => updateField("min_profit_factor", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">Default: 1.0</span>
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Min Sharpe Ratio</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      min={0}
                      step={0.1}
                      value={form.min_sharpe}
                      onChange={(e) => updateField("min_sharpe", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">Default: 0.5</span>
                    </label>
                  </div>

                  <div className="form-control col-span-2">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Min OOS Profit (fraction)</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-40"
                      min={-1}
                      step={0.01}
                      value={form.min_oos_profit}
                      onChange={(e) => updateField("min_oos_profit", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">
                        Stage 4 gate — strategy retries if OOS profit falls below this value. Default: 0.0 (break-even). Use 0.02 to require ≥2% profit.
                      </span>
                    </label>
                  </div>

                  <div className="form-control col-span-2">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">MC p95 Drawdown Limit (fraction)</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-40"
                      min={0.01}
                      max={1}
                      step={0.01}
                      value={form.monte_carlo_threshold}
                      onChange={(e) => updateField("monte_carlo_threshold", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">
                        Stage 6 Monte Carlo gate — pipeline fails if the p95 worst-case drawdown exceeds this fraction. Default: 0.35 (35%). Use 0.20 for a tighter conservative limit.
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                className="btn btn-primary btn-sm gap-2"
                onClick={handleStart}
                disabled={!form.strategy || isConnecting}
              >
                {isConnecting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "▶"
                )}
                Start Auto-Quant
              </button>
            </div>
          </div>
        </div>

        {/* Run History Dashboard */}
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-5">
            <h2 className="text-sm font-semibold mb-3">Run History</h2>
            <RunHistoryDashboard
              ref={runHistoryRef}
              onLoad={handleLoadRun}
              onReconnect={handleReconnect}
            />
          </div>
        </div>
        </>
      )}

      {/* Real-Time Optimization Dashboard */}
      {pipelineState && (
        <div className="space-y-4">

          {/* ── Dashboard header bar ── */}
          <div className="card bg-base-200 border border-base-300">
            <div className="card-body p-4">
              <div className="flex items-center gap-4">
                {/* Status indicator */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isRunning ? "bg-primary animate-pulse" :
                  isCompleted ? "bg-success" :
                  isFailed ? "bg-error" :
                  isInterrupted ? "bg-warning" :
                  isCancelled ? "bg-warning" :
                  "bg-base-content/30"
                }`} />

                {/* Run info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold truncate">{pipelineState.strategy}</span>
                    {pipelineState.timeframe && (
                      <span className="badge badge-xs badge-ghost font-mono">{pipelineState.timeframe}</span>
                    )}
                    {pipelineState.exchange && (
                      <span className="badge badge-xs badge-ghost">{pipelineState.exchange}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-base-content/50">
                      {isRunning
                        ? `Stage ${pipelineState.current_stage}/7 — ${STAGE_NAMES[pipelineState.current_stage - 1] || "Starting..."}`
                        : isCompleted ? "✓ Pipeline Completed"
                        : isFailed ? "✗ Pipeline Failed"
                        : isInterrupted ? "⚠ Pipeline Interrupted"
                        : isCancelled ? "⚠ Pipeline Cancelled"
                        : "Starting..."}
                    </span>
                    {isRunning && elapsedSeconds > 0 && (
                      <span className="text-sm font-bold text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">
                        ⏱ {formatElapsed(elapsedSeconds)}
                      </span>
                    )}
                    {isRunning && estimatedTimeRemaining != null && estimatedTimeRemaining > 0 && (
                      <span className="text-xs text-base-content/60 font-mono">
                        ≈ {formatElapsed(estimatedTimeRemaining)} remaining
                      </span>
                    )}
                    {hyperoptProgress && isRunning && (
                      <span className="text-xs text-primary/70 font-mono">
                        ⚡ Epoch {hyperoptProgress.current}/{hyperoptProgress.total || "?"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress % */}
                <span className={`text-lg font-bold shrink-0 ${
                  isCompleted ? "text-success" :
                  isFailed ? "text-error" :
                  isInterrupted ? "text-warning" :
                  isCancelled ? "text-warning" :
                  "text-primary"
                }`}>{isCompleted ? 100 : progress}%</span>

                {/* Action buttons */}
                <div className="flex gap-2 shrink-0">
                  {isRunning && (
                    <button
                      className="btn btn-error btn-sm gap-1.5"
                      onClick={handleCancel}
                    >
                      ■ Stop
                    </button>
                  )}
                  {isDone && (
                    <button className="btn btn-outline btn-sm gap-1.5" onClick={handleReset}>
                      ↩ New Run
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <progress
                  className={`progress w-full h-1.5 ${
                    isCompleted ? "progress-success" :
                    isFailed ? "progress-error" :
                    isInterrupted ? "progress-warning" :
                    isCancelled ? "progress-warning" :
                    "progress-primary"
                  }`}
                  value={isCompleted ? 100 : progress}
                  max={100}
                />
              </div>
            </div>
          </div>

          {/* ── Main dashboard grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Left: Stage Pipeline Tracker */}
            <div className="lg:col-span-1">
              <div className="card bg-base-200 border border-base-300 h-full">
                <div className="card-body p-4">
                  <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>Pipeline Stages</span>
                    {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                  </h3>
                  
                  {/* Pre-Flight Filtering (Data Healing) Status */}
                  {dataHealingStatus && (
                    <div className="mb-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider flex items-center gap-1.5">
                          🔬 Pre-Flight Filtering
                          {dataHealingStatus.in_progress && (
                            <span className="loading loading-spinner loading-xs text-primary" />
                          )}
                        </span>
                        <span className="text-[10px] text-base-content/50 font-mono">
                          {dataHealingStatus.surviving_pairs != null
                            ? `${dataHealingStatus.surviving_pairs}/${dataHealingStatus.total_pairs} pairs`
                            : `${dataHealingStatus.total_pairs} pairs`}
                        </span>
                      </div>
                      
                      {/* Real-time pair status table */}
                      {Object.keys(pairStatusMap).length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {Object.entries(pairStatusMap).slice(-10).map(([pair, status]) => (
                            <div key={pair} className="flex items-center justify-between text-[10px]">
                              <span className="font-mono text-base-content/70">{pair}</span>
                              <span className={`font-medium ${
                                status.status === "downloading" ? "text-primary animate-pulse" :
                                status.status === "healed" ? "text-success" :
                                status.status === "evicted" ? "text-error" :
                                "text-base-content/50"
                              }`}>
                                {status.status === "downloading" && "⬇ "}
                                {status.status === "healed" && "✓ "}
                                {status.status === "evicted" && "✗ "}
                                {status.status}
                                {status.reason && status.status === "evicted" && ` (${status.reason})`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Summary when complete */}
                      {!dataHealingStatus.in_progress && dataHealingStatus.surviving_pairs != null && (
                        <div className="mt-2 pt-2 border-t border-primary/10">
                          <span className="text-[10px] text-success/80">
                            ✓ Complete: {dataHealingStatus.surviving_pairs} pairs passed, {dataHealingStatus.evicted_pairs} evicted
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <StageStepper stages={pipelineState.stages || []} tick={elapsedSeconds} />
                </div>
              </div>
            </div>

            {/* Right: Live charts panel */}
            <div className="lg:col-span-2 flex flex-col gap-4">

              {/* Live Fitness Curve */}
              <div className="card bg-base-200 border border-base-300">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest flex items-center gap-2">
                      ⚡ Live Fitness Curve
                      {fitnessCurve.length > 0 && (
                        <span className="text-primary/60 normal-case tracking-normal font-normal">
                          ({fitnessCurve.length} epochs)
                        </span>
                      )}
                    </h3>
                    {hyperoptProgress && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-base-content/40 font-mono">
                          {hyperoptProgress.current}/{hyperoptProgress.total || "?"} epochs
                        </span>
                        {isRunning && pipelineState.current_stage === 2 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                      </div>
                    )}
                  </div>
                  <LiveFitnessCurve
                    data={fitnessCurve}
                    hyperoptProgress={hyperoptProgress}
                  />
                </div>
              </div>

              {/* Trade Distribution Chart */}
              {(pipelineState?.stages?.[0]?.data?.trade_distribution || pipelineState?.stages?.[3]?.data?.trade_distribution) && (
                <div className="card bg-base-200 border border-base-300">
                  <div className="card-body p-4">
                    <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest mb-3">
                      📊 Trade Distribution
                    </h3>
                    <TradeDistributionChart 
                      tradeDistribution={pipelineState?.stages?.[3]?.data?.trade_distribution || pipelineState?.stages?.[0]?.data?.trade_distribution}
                    />
                  </div>
                </div>
              )}

              {/* Candidate Leaderboard */}
              {fitnessCurve.length > 0 && (() => {
                const sorted = [...fitnessCurve]
                  .sort((a, b) => b.profit_usdt - a.profit_usdt)
                  .slice(0, 5);
                return (
                  <div className="card bg-base-200 border border-base-300">
                    <div className="card-body p-4">
                      <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest mb-3">
                        🏆 Top Candidates
                      </h3>
                      <CandidateLeaderboard candidates={sorted} bestParams={pipelineState?.stages?.[1]?.data?.best_params} />
                    </div>
                  </div>
                );
              })()}

              {/* Robustness Badge (live — shown once sensitivity check completes) */}
              {pipelineState?.sensitivity && (
                <div className="card bg-base-200 border border-base-300">
                  <div className="card-body p-4">
                    <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest mb-2 flex items-center gap-2">
                      📈 Robustness Check
                    </h3>
                    <RobustnessBadge sensitivity={pipelineState.sensitivity} />
                  </div>
                </div>
              )}

              {/* WFO Windows Table */}
              {(pipelineState?.wfo_enabled || wfoWindows.length > 0) && (
                <div className="card bg-base-200 border border-base-300">
                  <div className="card-body p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest flex items-center gap-2">
                        📊 Walk-Forward Windows
                        {wfoWindows.length > 0 && (
                          <span className="text-primary/60 normal-case tracking-normal font-normal">
                            ({wfoWindows.length}/{pipelineState?.wfo_windows?.length || wfoWindows[0]?.total_windows || "?"} complete)
                          </span>
                        )}
                      </h3>
                      {wfoWindows.length > 0 && (() => {
                        const valid = wfoWindows.filter(w => w.profit != null);
                        const avg = valid.length > 0
                          ? (valid.reduce((s, w) => s + w.profit, 0) / valid.length).toFixed(2)
                          : null;
                        return avg != null ? (
                          <span className={`text-xs font-mono font-semibold ${parseFloat(avg) >= 0 ? "text-success" : "text-error"}`}>
                            avg {parseFloat(avg) >= 0 ? "+" : ""}{avg}%
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <WfoWindowsTable windows={wfoWindows} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Log Terminal ── */}
          <div className="card bg-base-200 border border-base-300">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest flex items-center gap-2">
                  ▶ Live Output
                  {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                </h3>
                <span className="text-[10px] text-base-content/30">{logLines.length} lines</span>
              </div>
              <div className="mb-2">
                <input
                  type="text"
                  className="input input-xs input-bordered w-full font-mono text-[11px] bg-base-300 border-base-content/15 placeholder:text-base-content/25"
                  placeholder="Filter log lines…"
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                />
              </div>
              <LogTerminal lines={logLines} filter={logFilter} />
            </div>
          </div>

          {/* ── Failure / interrupted / cancelled ── */}
          {isFailed && <FailureReport state={pipelineState} onRetryRelaxed={handleRetryRelaxed} />}

          {isInterrupted && <InterruptedReport state={pipelineState} />}

          {isCancelled && (
            <div className="alert alert-warning">
              <span className="text-sm">Pipeline was cancelled by user.</span>
            </div>
          )}

          {/* ── Final report ── */}
          {isCompleted && report && (
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body p-5">
                <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest mb-4">
                  ✓ Results &amp; Downloads
                </h3>
                <FinalReport report={report} runId={runId} strategy={pipelineState?.strategy || form.strategy} />
              </div>
            </div>
          )}

          {isCompleted && !report && (
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body p-5 flex items-center gap-3">
                <span className="loading loading-spinner loading-sm" />
                <span className="text-sm text-base-content/60">Loading report...</span>
                <button
                  className="btn btn-xs btn-ghost ml-auto"
                  onClick={() =>
                    fetch(`${API_BASE}/api/auto-quant/report/${runId}`)
                      .then((r) => r.json())
                      .then(setReport)
                      .catch(() => {})
                  }
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
