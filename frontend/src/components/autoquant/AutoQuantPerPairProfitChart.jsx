import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts";

function PerPairProfitTooltip({ active, payload }) {
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
}

export default function AutoQuantPerPairProfitChart({ perPair }) {
  if (!perPair || perPair.length === 0) return null;

  const data = [...perPair]
    .map((p) => ({
      pair: p.key.replace("/USDT", ""),
      profit: parseFloat((p.profit_total * 100).toFixed(2)),
    }))
    .sort((a, b) => b.profit - a.profit);

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
          <Tooltip content={<PerPairProfitTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
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
