/**
 * MonthlyReturnsChart Component
 * Displays monthly returns bar chart
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

export default function MonthlyReturnsChart({ data, loading, error }) {
  if (!data || data.length === 0) {
    return <ChartWrapper title="Monthly Returns" empty />;
  }

  return (
    <ChartWrapper title="Monthly Returns" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="return" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
