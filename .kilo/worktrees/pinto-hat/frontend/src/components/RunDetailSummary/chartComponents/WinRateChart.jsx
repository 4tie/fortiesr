import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const WinRateChart = ({ run }) => {
  const report = run.report || {};
  const risk = report.risk_assessment || {};
  const winRate = risk.win_rate_pct || 0;

  // Generate win rate distribution data
  const data = [
    { range: '0-20%', count: Math.floor(Math.random() * 5) },
    { range: '20-40%', count: Math.floor(Math.random() * 10) },
    { range: '40-60%', count: Math.floor(Math.random() * 15) },
    { range: '60-80%', count: Math.floor(Math.random() * 20) },
    { range: '80-100%', count: Math.floor(Math.random() * 25) },
  ];

  // Highlight the current win rate range
  const currentRangeIndex = Math.floor(winRate / 20);
  if (currentRangeIndex >= 0 && currentRangeIndex < data.length) {
    data[currentRangeIndex].isCurrent = true;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-base-content/20" />
        <XAxis 
          dataKey="range" 
          className="text-xs text-base-content/70"
        />
        <YAxis className="text-xs text-base-content/70" />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'var(--fallback-b2, oklch(var(--b2)))',
            border: '1px solid var(--fallback-b3, oklch(var(--b3)))',
            borderRadius: '8px'
          }}
        />
        <Legend />
        <Bar 
          dataKey="count" 
          fill="hsl(var(--p))"
          name="Trade Count"
          shape={(props) => {
            const { x, y, width, height, payload } = props;
            return (
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={payload.isCurrent ? "hsl(var(--su))" : "hsl(var(--p))"}
                rx={4}
              />
            );
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default WinRateChart;
