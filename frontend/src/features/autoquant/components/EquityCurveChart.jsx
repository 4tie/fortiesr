/**
 * EquityCurveChart Component
 * Displays equity curve over time
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ChartWrapper from './ChartWrapper';

export default function EquityCurveChart({ data, loading, error }) {
  if (!data || data.length === 0) {
    return <ChartWrapper title="Equity Curve" empty />;
  }

  return (
    <ChartWrapper title="Equity Curve" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="equity"
            stroke="#8884d8"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
