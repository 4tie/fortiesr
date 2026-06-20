/**
 * OOSRetentionChart Component
 * Displays out-of-sample retention metrics
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

export default function OOSRetentionChart({ data, loading, error }) {
  if (!data) {
    return <ChartWrapper title="Out-of-Sample Retention" empty />;
  }

  const chartData = [
    { name: 'In-Sample', value: data.inSampleProfit || 0 },
    { name: 'Out-of-Sample', value: data.outOfSampleProfit || 0 },
  ];

  return (
    <ChartWrapper title="Out-of-Sample Retention" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#8884d8" name="Profit" />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
