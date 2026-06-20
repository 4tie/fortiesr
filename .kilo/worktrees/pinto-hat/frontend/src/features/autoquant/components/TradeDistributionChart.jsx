/**
 * TradeDistributionChart Component
 * Displays trade distribution (winners vs losers)
 */

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import ChartWrapper from './ChartWrapper';

const COLORS = ['#00C49F', '#FF8042'];

export default function TradeDistributionChart({ data, loading, error }) {
  if (!data) {
    return <ChartWrapper title="Trade Distribution" empty />;
  }

  const chartData = [
    { name: 'Winners', value: data.winners || 0 },
    { name: 'Losers', value: data.losers || 0 },
  ];

  return (
    <ChartWrapper title="Trade Distribution" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
