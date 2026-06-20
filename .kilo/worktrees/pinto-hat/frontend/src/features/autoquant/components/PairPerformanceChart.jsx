/**
 * PairPerformanceChart Component
 * Displays performance across different trading pairs
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ChartWrapper from './ChartWrapper';

export default function PairPerformanceChart({ data, loading, error }) {
  if (!data || data.length === 0) {
    return <ChartWrapper title="Pair Performance" empty />;
  }

  return (
    <ChartWrapper title="Pair Performance" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="pair" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="profitFactor" fill="#8884d8" name="Profit Factor" />
          <Bar dataKey="winRate" fill="#82ca9d" name="Win Rate (%)" />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
