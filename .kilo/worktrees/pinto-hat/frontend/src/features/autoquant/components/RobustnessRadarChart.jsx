/**
 * RobustnessRadarChart Component
 * Displays robustness metrics as radar chart
 */

import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import ChartWrapper from './ChartWrapper';

export default function RobustnessRadarChart({ data, loading, error }) {
  if (!data) {
    return <ChartWrapper title="Robustness Metrics" empty />;
  }

  const chartData = [
    { metric: 'Parameter Stability', value: data.parameterStability * 100 },
    { metric: 'Slippage Tolerance', value: data.slippageTolerance * 100 },
    { metric: 'Spread Tolerance', value: data.spreadTolerance * 100 },
    { metric: 'Volatility Tolerance', value: data.volatilityTolerance * 100 },
  ];

  return (
    <ChartWrapper title="Robustness Metrics" loading={loading} error={error}>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={chartData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="metric" />
          <PolarRadiusAxis angle={90} domain={[0, 100]} />
          <Radar
            name="Robustness"
            dataKey="value"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
