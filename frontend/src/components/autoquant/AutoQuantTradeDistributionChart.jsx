import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function AutoQuantTradeDistributionChart({ tradeDistribution }) {
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
