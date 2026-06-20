/**
 * Shared Chart Components
 * Reusable chart components for visualizing strategy metrics
 */

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

/**
 * EquityCurveChart - Visualize equity growth over time
 */
export const EquityCurveChart = ({ data, loading, error }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-base-200/50 rounded-lg">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-error/10 border border-error/30 rounded-lg">
        <span className="text-error text-sm">{error}</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-base-200/50 rounded-lg">
        <span className="text-base-content/40 text-sm">No equity curve data</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
        <YAxis stroke="rgba(255,255,255,0.5)" />
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="#10b981"
          fillOpacity={1}
          fill="url(#colorEquity)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

/**
 * DrawdownChart - Visualize drawdown over time
 */
export const DrawdownChart = ({ data, loading, error }) => {
  if (loading || error || !data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-base-200/50 rounded-lg">
        <span className="text-base-content/40 text-sm">
          {error || 'No drawdown data'}
        </span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
        <YAxis stroke="rgba(255,255,255,0.5)" />
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
        <Area
          type="monotone"
          dataKey="drawdown"
          stroke="#ef4444"
          fill="#ef4444"
          fillOpacity={0.3}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

/**
 * ProfitDistributionChart - Histogram of trade profits
 */
export const ProfitDistributionChart = ({ data, loading, error }) => {
  if (loading || error || !data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-base-200/50 rounded-lg">
        <span className="text-base-content/40 text-sm">
          {error || 'No profit distribution data'}
        </span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="bin" stroke="rgba(255,255,255,0.5)" />
        <YAxis stroke="rgba(255,255,255,0.5)" />
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
        <Bar dataKey="count" fill="#3b82f6">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#10b981' : '#ef4444'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/**
 * WalkForwardChart - Visualize walk-forward test results
 */
export const WalkForwardChart = ({ data, loading, error }) => {
  if (loading || error || !data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-base-200/50 rounded-lg">
        <span className="text-base-content/40 text-sm">
          {error || 'No walk-forward data'}
        </span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="window" stroke="rgba(255,255,255,0.5)" />
        <YAxis stroke="rgba(255,255,255,0.5)" />
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
        <Legend />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

/**
 * PairPerformanceChart - Visualize performance across pairs
 */
export const PairPerformanceChart = ({ data, loading, error }) => {
  if (loading || error || !data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-base-200/50 rounded-lg">
        <span className="text-base-content/40 text-sm">
          {error || 'No pair performance data'}
        </span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis type="number" stroke="rgba(255,255,255,0.5)" />
        <YAxis dataKey="pair" type="category" stroke="rgba(255,255,255,0.5)" />
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
        <Bar dataKey="profit" fill="#3b82f6">
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.profit >= 0 ? '#10b981' : '#ef4444'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/**
 * MetricsGrid - Display key metrics in cards
 */
export const MetricsGrid = ({ metrics = {} }) => {
  const metricCards = [
    { label: 'Profit Factor', value: metrics.profitFactor, format: (v) => v?.toFixed(2) },
    { label: 'Sharpe Ratio', value: metrics.sharpeRatio, format: (v) => v?.toFixed(2) },
    { label: 'Win Rate', value: metrics.winRate, format: (v) => `${(v * 100)?.toFixed(1)}%` },
    { label: 'Drawdown', value: metrics.drawdown, format: (v) => `${(v * 100)?.toFixed(1)}%` },
    { label: 'Trades', value: metrics.trades, format: (v) => v?.toString() },
    { label: 'Expectancy', value: metrics.expectancy, format: (v) => v?.toFixed(4) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      {metricCards.map((card) => (
        <div key={card.label} className="bg-base-200 rounded-lg p-3">
          <div className="text-xs text-base-content/60 uppercase tracking-wider mb-1">
            {card.label}
          </div>
          <div className="text-lg font-bold text-primary">
            {card.value != null ? card.format(card.value) : '—'}
          </div>
        </div>
      ))}
    </div>
  );
};
