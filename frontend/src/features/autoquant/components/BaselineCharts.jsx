import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Custom tooltip - defined outside component to prevent re-creation on each render
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-base-100 border border-base-300 rounded-lg p-3 shadow-lg">
      <p className="font-bold text-sm">{data.name}</p>
      <div className="mt-2 space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-base-content/60">Profit:</span>
          <span className={data.profitPct >= 0 ? "text-success" : "text-error"}>
            {data.profitPct.toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-base-content/60">Drawdown:</span>
          <span className="text-warning">{(data.drawdown * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-base-content/60">Trades:</span>
          <span>{data.trades}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-base-content/60">Win Rate:</span>
          <span>{data.winRate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-base-content/60">Avg Duration:</span>
          <span>{data.avgDuration.toFixed(1)}m</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-base-content/60">Profit Factor:</span>
          <span>{data.profitFactor.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

function BaselineCharts({ allPairsData, selectedPairsData }) {
  const [showAllPairs, setShowAllPairs] = useState(true);

  // Use refs to stabilize data references
  const allPairsDataRef = useRef(allPairsData);
  const selectedPairsDataRef = useRef(selectedPairsData);

  // Update refs only when data actually changes
  useEffect(() => {
    allPairsDataRef.current = allPairsData;
  }, [allPairsData]);

  useEffect(() => {
    selectedPairsDataRef.current = selectedPairsData;
  }, [selectedPairsData]);

  const currentData = useMemo(() => {
    return showAllPairs ? allPairsDataRef.current : selectedPairsDataRef.current;
  }, [showAllPairs]);

  // Prepare data for charts
  const chartData = useMemo(() => {
    return currentData
      .map((pair) => ({
        name: pair.key || pair.pair || "Unknown",
        profit: pair.profit_total_abs || 0,
        profitPct: pair.profit_total_pct || 0,
        drawdown: pair.max_drawdown || 0,
        trades: pair.total_trades || 0,
        winRate: pair.win_rate || 0,
        avgDuration: pair.avg_duration || 0,
        profitFactor: pair.profit_factor || 0,
      }))
      .sort((a, b) => b.profitPct - a.profitPct);
  }, [currentData]);

  // Performance tier for scatter plot coloring - memoized
  const getPerformanceTier = useCallback((profit, drawdown) => {
    if (profit > 0 && drawdown < 0.1) return { color: "#22c55e", label: "Excellent" };
    if (profit > 0 && drawdown < 0.2) return { color: "#84cc16", label: "Good" };
    if (profit > 0) return { color: "#eab308", label: "Moderate" };
    return { color: "#ef4444", label: "Poor" };
  }, []);

  const scatterData = useMemo(() => {
    return chartData.map((item) => ({
      ...item,
      tier: getPerformanceTier(item.profitPct, item.drawdown),
    }));
  }, [chartData, getPerformanceTier]);

  return (
    <div className="space-y-4">
      {/* Toggle Button */}
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
          Performance Visualization
        </h4>
        <div className="join">
          <button
            className={`btn btn-xs join-item ${showAllPairs ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setShowAllPairs(true)}
          >
            All Pairs
          </button>
          <button
            className={`btn btn-xs join-item ${!showAllPairs ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setShowAllPairs(false)}
          >
            Selected Pairs
          </button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profit Bar Chart */}
        <div className="card bg-base-200/50 border border-base-300">
          <div className="card-body p-3">
            <h5 className="text-xs font-semibold mb-2">Profit by Pair</h5>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 70, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis dataKey="name" type="category" width={65} tick={{ fontSize: 9 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(59, 130, 246, 0.1)" }} />
                <Bar dataKey="profitPct" radius={[0, 3, 3, 0]} maxBarSize={30}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.profitPct >= 0 ? "#22c55e" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profit vs Drawdown Scatter Plot */}
        <div className="card bg-base-200/50 border border-base-300">
          <div className="card-body p-3">
            <h5 className="text-xs font-semibold mb-2">Profit vs Drawdown</h5>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart data={scatterData} margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="drawdown"
                  name="Drawdown"
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  tick={{ fontSize: 9 }}
                />
                <YAxis
                  dataKey="profitPct"
                  name="Profit"
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  tick={{ fontSize: 9 }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter dataKey="profitPct" fill="#8884d8" r={6}>
                  {scatterData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.tier.color} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-2 text-[9px] flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span> Excellent
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#84cc16]"></span> Good
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#eab308]"></span> Moderate
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#ef4444]"></span> Poor
              </span>
            </div>
          </div>
        </div>

        {/* Trade Count Chart */}
        <div className="card bg-base-200/50 border border-base-300 lg:col-span-2">
          <div className="card-body p-3">
            <h5 className="text-xs font-semibold mb-2">Trade Count by Pair</h5>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(59, 130, 246, 0.1)" }} />
                <Bar dataKey="trades" radius={[3, 3, 0, 0]} maxBarSize={25} fill="#3b82f6">
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`rgba(59, 130, 246, ${0.3 + (entry.winRate / 100) * 0.7})`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BaselineCharts;
