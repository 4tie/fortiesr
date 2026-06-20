import React, { useState } from "react";
import PerformanceChart from "./chartComponents/PerformanceChart";
import DrawdownChart from "./chartComponents/DrawdownChart";
import WinRateChart from "./chartComponents/WinRateChart";
import MetricsRadarChart from "./chartComponents/MetricsRadarChart";

const ChartsTab = ({ run }) => {
  const [timeRange, setTimeRange] = useState("all");
  const [chartType, setChartType] = useState("line");

  if (!run) return null;

  const report = run.report || {};
  const risk = report.risk_assessment || {};

  return (
    <div className="space-y-6">
      {/* Chart Controls */}
      <div className="bg-base-200 border border-base-300 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/70">Time Range:</span>
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="select select-bordered select-sm"
            >
              <option value="all">All Time</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/70">Chart Type:</span>
            <select 
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="select select-bordered select-sm"
            >
              <option value="line">Line</option>
              <option value="area">Area</option>
              <option value="bar">Bar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-base-200 border border-base-300 rounded-lg p-5 hover:shadow-md transition-shadow duration-300">
          <h3 className="text-lg font-semibold text-base-content mb-4">Performance Over Time</h3>
          <PerformanceChart run={run} timeRange={timeRange} chartType={chartType} />
        </div>

        <div className="bg-base-200 border border-base-300 rounded-lg p-5 hover:shadow-md transition-shadow duration-300">
          <h3 className="text-lg font-semibold text-base-content mb-4">Drawdown Analysis</h3>
          <DrawdownChart run={run} timeRange={timeRange} />
        </div>

        <div className="bg-base-200 border border-base-300 rounded-lg p-5 hover:shadow-md transition-shadow duration-300">
          <h3 className="text-lg font-semibold text-base-content mb-4">Win Rate Distribution</h3>
          <WinRateChart run={run} />
        </div>

        <div className="bg-base-200 border border-base-300 rounded-lg p-5 hover:shadow-md transition-shadow duration-300">
          <h3 className="text-lg font-semibold text-base-content mb-4">Metrics Overview</h3>
          <MetricsRadarChart run={run} />
        </div>
      </div>
    </div>
  );
};

export default ChartsTab;
