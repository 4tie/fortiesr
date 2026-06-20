import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

/* ── Brand colours (never rely on CSS vars inside SVG defs) ─────────────── */
const C_EMERALD   = "#059669";
const C_EMERALD_2 = "#064e3b";
const C_RED       = "#ef4444";
const C_GRID      = "#27272a";
const C_MUTED     = "#52525b";
const C_BG        = "#09090b";

/* ── Build cumulative-profit-% series ──────────────────────────────────── */
function buildSeries(trades, startingBalance) {
  if (!trades || trades.length === 0) return [];

  const sorted = [...trades].sort((a, b) => {
    const da = a.close_date || a.open_date || "";
    const db = b.close_date || b.open_date || "";
    return da < db ? -1 : da > db ? 1 : 0;
  });

  const base   = startingBalance && startingBalance > 0 ? startingBalance : 100;
  let balance  = base;
  let cumPct   = 0;

  return sorted.map((t, idx) => {
    const profitRatio = t.profit_ratio != null ? Number(t.profit_ratio) : null;
    const profitAbs   = t.profit_abs   != null ? Number(t.profit_abs)   : null;

    if (profitAbs != null) {
      balance += profitAbs;
    } else if (profitRatio != null) {
      balance += base * profitRatio;
    }

    const tradePct = profitRatio != null ? profitRatio * 100 : null;
    if (tradePct != null) cumPct += tradePct;

    const rawDate = t.close_date || t.open_date || "";
    const dateObj = rawDate ? new Date(rawDate) : null;
    const validDate = dateObj && !isNaN(dateObj.getTime());

    return {
      idx,
      /* X-axis tick label */
      tickLabel: validDate
        ? dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
        : `T${idx + 1}`,
      /* Full date for tooltip */
      fullDate: validDate
        ? dateObj.toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })
        : null,
      pair:      t.pair || "—",
      tradePct,
      cumPct:    parseFloat(cumPct.toFixed(4)),
    };
  });
}

/* ── Custom rich tooltip ────────────────────────────────────────────────── */
function CurveTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const cumPos   = d.cumPct >= 0;
  const tradePos = d.tradePct == null ? null : d.tradePct >= 0;

  return (
    <div
      style={{
        background: "#18181b",
        border: "1px solid #3f3f46",
        borderRadius: 8,
        padding: "10px 14px",
        minWidth: 188,
        boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
      }}
    >
      {/* Date row */}
      <div style={{ color: "#a1a1aa", marginBottom: 8, paddingBottom: 7, borderBottom: "1px solid #27272a" }}>
        {d.fullDate || d.tickLabel}
      </div>

      {/* Pair */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
        <span style={{ color: "#71717a" }}>Pair</span>
        <span style={{ color: "#fafafa", fontWeight: 700 }}>{d.pair}</span>
      </div>

      {/* Individual trade P&L */}
      {d.tradePct != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <span style={{ color: "#71717a" }}>Trade P&L</span>
          <span style={{ color: tradePos ? C_EMERALD : C_RED, fontWeight: 700 }}>
            {tradePos ? "+" : ""}{d.tradePct.toFixed(3)}%
          </span>
        </div>
      )}

      {/* Cumulative — most prominent */}
      <div style={{
        display: "flex", justifyContent: "space-between", gap: 16,
        marginTop: 6, paddingTop: 7, borderTop: "1px solid #27272a",
      }}>
        <span style={{ color: "#e4e4e7", fontWeight: 600 }}>Cumulative</span>
        <span style={{ color: cumPos ? C_EMERALD : C_RED, fontWeight: 800, fontSize: 13 }}>
          {cumPos ? "+" : ""}{d.cumPct.toFixed(3)}%
        </span>
      </div>
    </div>
  );
}

/* ── Main chart component ────────────────────────────────────────────────── */
export default function EquityCurveChart({ trades, startingBalance }) {
  const data = useMemo(
    () => buildSeries(trades, startingBalance),
    [trades, startingBalance],
  );

  if (data.length < 2) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 180, color: C_MUTED, fontSize: 13,
      }}>
        Not enough trade data to render equity curve.
      </div>
    );
  }

  const finalCum  = data[data.length - 1].cumPct;
  const isProfit  = finalCum >= 0;
  const lineColor = isProfit ? C_EMERALD : C_RED;
  const gradId    = isProfit ? "egGreen" : "egRed";
  const gradStop  = isProfit ? C_EMERALD_2 : "#7f1d1d";

  /* Y-axis domain with generous padding so gradient fill has room */
  const allPcts = data.map((d) => d.cumPct);
  const minP    = Math.min(0, ...allPcts);
  const maxP    = Math.max(0, ...allPcts);
  const pad     = Math.max(Math.abs(maxP - minP) * 0.15, 0.5);
  const yDomain = [
    parseFloat((minP - pad).toFixed(2)),
    parseFloat((maxP + pad).toFixed(2)),
  ];

  /* X-axis — show ~7 evenly-spaced labels */
  const xInterval = Math.max(1, Math.floor(data.length / 7));

  return (
    <div style={{ width: "100%", minWidth: 0, height: 230 }}>
      <ResponsiveContainer width="100%" height="100%" debounce={60}>
        <AreaChart
          data={data}
          margin={{ top: 6, right: 12, left: 4, bottom: 0 }}
        >
          <defs>
            {/* Green gradient */}
            <linearGradient id="egGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={C_EMERALD}   stopOpacity={0.28} />
              <stop offset="60%"  stopColor={C_EMERALD_2} stopOpacity={0.06} />
              <stop offset="100%" stopColor={C_BG}        stopOpacity={0.00} />
            </linearGradient>
            {/* Red gradient */}
            <linearGradient id="egRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={C_RED}  stopOpacity={0.24} />
              <stop offset="60%"  stopColor="#7f1d1d" stopOpacity={0.06} />
              <stop offset="100%" stopColor={C_BG}   stopOpacity={0.00} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={C_GRID}
            strokeOpacity={0.6}
            vertical={false}
          />

          <XAxis
            dataKey="idx"
            interval={xInterval - 1}
            tickFormatter={(_, i) => data[i]?.tickLabel ?? ""}
            tick={{ fill: C_MUTED, fontSize: 10 }}
            axisLine={{ stroke: C_GRID }}
            tickLine={false}
            height={22}
          />

          <YAxis
            domain={yDomain}
            tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
            tick={{ fill: C_MUTED, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={58}
          />

          <Tooltip
            content={<CurveTooltip />}
            cursor={{
              stroke: lineColor,
              strokeWidth: 1,
              strokeOpacity: 0.35,
              strokeDasharray: "4 3",
            }}
          />

          {/* Zero baseline */}
          <ReferenceLine
            y={0}
            stroke="#3f3f46"
            strokeWidth={1}
            strokeDasharray="5 4"
          />

          <Area
            type="monotone"
            dataKey="cumPct"
            stroke={lineColor}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{
              r: 4,
              fill: lineColor,
              stroke: C_BG,
              strokeWidth: 2,
            }}
            animationDuration={700}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
