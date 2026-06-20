/**
 * WalkForwardChart Component
 * Displays walk-forward analysis results
 */

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

export default function WalkForwardChart({ data, loading, error }) {
  if (!data || data.length === 0) {
    return <ChartWrapper title="Walk-Forward Analysis" empty />;
  }

  return (
    <ChartWrapper title="Walk-Forward Analysis" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="window" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="trainProfit" fill="#8884d8" name="Train Profit" />
          <Bar dataKey="testProfit" fill="#82ca9d" name="Test Profit" />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
