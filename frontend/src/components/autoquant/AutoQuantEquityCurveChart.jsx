import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";

function EquityCurveTooltip({ active, payload, hasFan }) {
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
}

export default function AutoQuantEquityCurveChart({ data, mcFan }) {
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
          <Tooltip content={<EquityCurveTooltip hasFan={hasFan} />} />

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
