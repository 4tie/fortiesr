/**
 * TimeframeComparisonChart Component
 * Displays performance across different timeframes
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

export default function TimeframeComparisonChart({ data, loading, error }) {
  if (!data || data.length === 0) {
    return <ChartWrapper title="Timeframe Comparison" empty />;
  }

  return (
    <ChartWrapper title="Timeframe Comparison" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timeframe" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="profitFactor" fill="#8884d8" name="Profit Factor" />
          <Bar dataKey="sharpeRatio" fill="#82ca9d" name="Sharpe Ratio" />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
