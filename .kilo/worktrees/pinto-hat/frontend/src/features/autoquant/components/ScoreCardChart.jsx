/**
 * ScoreCardChart Component
 * Displays score breakdown as pie/bar chart
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function ScoreCardChart({ data, loading, error }) {
  if (!data) {
    return <ChartWrapper title="Score Breakdown" empty />;
  }

  const chartData = [
    { name: 'Expectancy', value: data.expectancyScore },
    { name: 'Profit Factor', value: data.profitFactorScore },
    { name: 'Drawdown', value: data.drawdownScore },
    { name: 'Walk Forward', value: data.walkForwardScore },
    { name: 'Robustness', value: data.robustnessScore },
    { name: 'Pair Consistency', value: data.pairConsistencyScore },
    { name: 'Trade Quality', value: data.tradeQualityScore },
  ];

  return (
    <ChartWrapper title="Score Breakdown" loading={loading} error={error}>
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
