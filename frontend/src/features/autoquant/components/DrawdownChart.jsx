/**
 * DrawdownChart Component
 * Displays drawdown over time
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ChartWrapper from './ChartWrapper';

export default function DrawdownChart({ data, loading, error }) {
  if (!data || data.length === 0) {
    return <ChartWrapper title="Drawdown Curve" empty />;
  }

  return (
    <ChartWrapper title="Drawdown Curve" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
