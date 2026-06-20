import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { C_BG, C_GRID, C_GREEN, C_MUTED, C_RED, MIN_TRADE_THRESHOLD } from "../constants";
import { fmtMoney, fmtNum, fmtPct, fmtScore } from "../formatters";
import { statusClass } from "../utils";

export function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${statusClass(status)}`}>
      {status}
    </span>
  );
}

export function MetricTile({ label, value, tone = "neutral", sub = null }) {
  const tones = {
    neutral: "text-base-content/80",
    good: "text-success",
    bad: "text-error",
    warn: "text-warning",
    primary: "text-primary",
  };
  return (
    <div className="rounded-lg border border-base-300 bg-base-200/45 px-4 py-3 min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/35 mb-1">{label}</div>
      <div className={`font-mono text-lg font-bold tabular-nums truncate ${tones[tone] || tones.neutral}`}>{value}</div>
      {sub && <div className="text-[10px] text-base-content/35 mt-1 truncate">{sub}</div>}
    </div>
  );
}

export function Panel({ title, children, action = null, className = "" }) {
  return (
    <section className={`rounded-lg border border-base-300 bg-base-200/35 overflow-hidden ${className}`}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-200/45">
        <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/55">{title}</h3>
        <div className="flex-1" />
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-200/25 min-h-[220px] flex items-center justify-center text-sm text-base-content/35">
      {children}
    </div>
  );
}

export function ParamValue({ value }) {
  if (value == null) return <span className="text-base-content/25">-</span>;
  if (typeof value === "number") return <span>{Number(value).toString()}</span>;
  return <span>{String(value)}</span>;
}

function MiniTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div
      style={{
        background: "#18181b",
        border: "1px solid #3f3f46",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: 11,
        fontFamily: "ui-monospace,monospace",
        boxShadow: "0 4px 16px rgba(0,0,0,.7)",
      }}
    >
      <span style={{ color: C_MUTED }}>Trial {label}: </span>
      <span style={{ color: Number(val) >= 0 ? C_GREEN : C_RED, fontWeight: 700 }}>
        {val != null ? fmtPct(val) : "-"}
      </span>
    </div>
  );
}

export function TrialChart({ data, dataKey, color, title, abs = false }) {
  return (
    <div className="h-full min-h-[260px] flex flex-col rounded-lg border border-base-300 bg-base-200/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/45">{title}</div>
        <div className="text-[10px] font-mono text-base-content/25">{data.length} points</div>
      </div>
      {data.length < 2 ? (
        <div className="flex-1 min-h-[200px] flex items-center justify-center text-xs text-base-content/30">
          Awaiting completed trials
        </div>
      ) : (
        <div className="flex-1 min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%" debounce={80}>
            <LineChart data={data} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} strokeOpacity={0.55} />
              <XAxis dataKey="trial" tick={{ fill: C_MUTED, fontSize: 10 }} axisLine={{ stroke: C_GRID }} tickLine={false} height={22} />
              <YAxis
                tickFormatter={(v) => `${abs ? "" : Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(1)}%`}
                tick={{ fill: C_MUTED, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="4 3" strokeWidth={1} />
              <Tooltip content={<MiniTip />} cursor={{ stroke: color, strokeWidth: 1, strokeOpacity: 0.3, strokeDasharray: "3 3" }} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: C_BG, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function BestSummary({ trial, compact = false }) {
  if (!trial) return null;
  const metrics = trial.metrics || {};
  const lowTrades = metrics.total_trades != null && metrics.total_trades < MIN_TRADE_THRESHOLD;
  return (
    <>
      {lowTrades && (
        <div className="mb-3 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
          Low trade count ({metrics.total_trades} trades &lt; {MIN_TRADE_THRESHOLD}) - metrics may not be statistically
          meaningful.
        </div>
      )}
      <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4 xl:grid-cols-7"} gap-3`}>
        <MetricTile label="Score" value={fmtScore(metrics.score)} tone="primary" />
        <MetricTile label="Profit %" value={fmtPct(metrics.net_profit_pct)} tone={metrics.net_profit_pct > 0 ? "good" : metrics.net_profit_pct < 0 ? "bad" : "neutral"} />
        <MetricTile label="Profit Abs" value={fmtMoney(metrics.net_profit_abs)} tone={metrics.net_profit_abs > 0 ? "good" : metrics.net_profit_abs < 0 ? "bad" : "neutral"} />
        <MetricTile label="Drawdown" value={metrics.max_drawdown_pct != null ? fmtPct(Math.abs(metrics.max_drawdown_pct), 2, false) : "-"} tone="warn" />
        <MetricTile label="Trades" value={metrics.total_trades ?? "-"} />
        <MetricTile label="Win Rate" value={metrics.win_rate_pct != null ? fmtPct(metrics.win_rate_pct, 1, false) : "-"} />
        <MetricTile label="Sharpe / PF" value={`${fmtNum(metrics.sharpe_ratio, 2)} / ${fmtNum(metrics.profit_factor, 2)}`} />
      </div>
    </>
  );
}

export function ParamPreview({ trial, spaces }) {
  const entries = Object.entries(trial?.parameters || {});
  if (!entries.length) return <EmptyState>No parameter overrides found for this trial.</EmptyState>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
      {entries.map(([key, value]) => {
        const sp = spaces.find((s) => s.name === key);
        const changed = sp == null || String(value) !== String(sp.default);
        return (
          <div key={key} className={`rounded border px-3 py-2 bg-base-300/20 ${changed ? "border-primary/30" : "border-base-300"}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-base-content/55 truncate" title={key}>{key}</span>
              <span className={`font-mono text-xs font-semibold shrink-0 ${changed ? "text-primary" : "text-base-content/55"}`}>{String(value)}</span>
            </div>
            {sp && <div className="mt-1 text-[10px] font-mono text-base-content/25">default {String(sp.default ?? "-")}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function AutoSafeEvents({ events = [] }) {
  if (!events.length) return null;
  return (
    <Panel title="Auto Safe Events">
      <div className="space-y-2">
        {events.map((event, idx) => {
          const gridText = event.grid_epoch_before != null && event.grid_epoch_after != null
            ? `Grid epoch ${event.grid_epoch_before}->${event.grid_epoch_after}`
            : null;
          return (
            <div key={`${event.trial_number}-${idx}`} className="rounded border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-warning">Before trial #{event.trial_number}</span>
                <span className="font-mono text-warning/80">{`${event.before_enabled_count}->${event.after_enabled_count} enabled`}</span>
              </div>
              <div className="mt-1 text-base-content/55">
                {String(event.reason || "").replaceAll("_", " ")}
                {gridText ? ` - ${gridText}` : ""}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(event.locked_params || []).map((name) => (
                  <span key={name} className="badge badge-sm badge-warning badge-outline font-mono">{name}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
