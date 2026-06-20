import React, { useState } from "react";
import { PlusIcon, XMarkIcon, ArrowUpIcon, ArrowDownIcon, MinusIcon } from "@heroicons/react/24/outline";

const ComparisonTab = ({ run }) => {
  const [selectedRuns, setSelectedRuns] = useState([]);
  const [showAddRun, setShowAddRun] = useState(false);

  // Mock data for comparison - in real implementation, this would fetch from API
  const mockRuns = React.useMemo(() => [
    {
      run_id: "current",
      strategy: run?.strategy || "Unknown",
      isCurrent: true,
      metrics: {
        inSampleProfit: run?.report?.sanity_backtest?.profit_total_abs || 0,
        oosProfit: (run?.report?.oos_validation?.profit_total || 0) * 100,
        maxDD: run?.report?.risk_assessment?.max_drawdown_pct || 0,
        winRate: run?.report?.risk_assessment?.win_rate_pct || 0,
        sharpe: run?.report?.risk_assessment?.sharpe_ratio || 0,
        profitFactor: run?.report?.risk_assessment?.profit_factor || 0,
      }
    },
    {
      run_id: "prev-1",
      strategy: run?.strategy || "Unknown",
      isCurrent: false,
      metrics: {
        inSampleProfit: (run?.report?.sanity_backtest?.profit_total_abs || 0) * 0.85,
        oosProfit: (run?.report?.oos_validation?.profit_total || 0) * 100 * 0.9,
        maxDD: (run?.report?.risk_assessment?.max_drawdown_pct || 0) * 1.1,
        winRate: (run?.report?.risk_assessment?.win_rate_pct || 0) * 0.95,
        sharpe: (run?.report?.risk_assessment?.sharpe_ratio || 0) * 0.9,
        profitFactor: (run?.report?.risk_assessment?.profit_factor || 0) * 0.88,
      }
    },
    {
      run_id: "prev-2",
      strategy: run?.strategy || "Unknown",
      isCurrent: false,
      metrics: {
        inSampleProfit: (run?.report?.sanity_backtest?.profit_total_abs || 0) * 0.7,
        oosProfit: (run?.report?.oos_validation?.profit_total || 0) * 100 * 0.8,
        maxDD: (run?.report?.risk_assessment?.max_drawdown_pct || 0) * 1.2,
        winRate: (run?.report?.risk_assessment?.win_rate_pct || 0) * 0.9,
        sharpe: (run?.report?.risk_assessment?.sharpe_ratio || 0) * 0.85,
        profitFactor: (run?.report?.risk_assessment?.profit_factor || 0) * 0.82,
      }
    },
  ], [run]);
  const currentRun = mockRuns[0];
  const comparisonRuns = selectedRuns.length > 0 ? selectedRuns : [currentRun];

  // Initialize selected runs with the normalized current run if not already set
  React.useEffect(() => {
    if (!run) return;
    setSelectedRuns((prev) => {
      const previousComparisons = prev.filter((r) => !r.isCurrent);
      return [currentRun, ...previousComparisons];
    });
  }, [currentRun, run]);

  // Handle case where run is not available yet
  if (!run) {
    return (
      <div className="bg-base-200 border border-base-300 rounded-lg p-8 text-center">
        <p className="text-base-content/70">No run data available for comparison</p>
      </div>
    );
  }

  const comparisonMetrics = [
    { key: 'inSampleProfit', label: 'In-Sample Profit', format: 'currency', isHigherBetter: true },
    { key: 'oosProfit', label: 'OOS Profit %', format: 'percentage', isHigherBetter: true },
    { key: 'maxDD', label: 'Max Drawdown', format: 'percentage', isHigherBetter: false },
    { key: 'winRate', label: 'Win Rate', format: 'percentage', isHigherBetter: true },
    { key: 'sharpe', label: 'Sharpe Ratio', format: 'ratio', isHigherBetter: true },
    { key: 'profitFactor', label: 'Profit Factor', format: 'ratio', isHigherBetter: true },
  ];

  const formatValue = (value, format) => {
    if (typeof value !== 'number') return 'N/A';
    switch (format) {
      case 'currency': return `$${value.toFixed(2)}`;
      case 'percentage': return `${value.toFixed(2)}%`;
      case 'ratio': return value.toFixed(2);
      default: return value.toFixed(0);
    }
  };

  const getComparisonIcon = (current, compare, isHigherBetter) => {
    if (current === compare) return <MinusIcon className="w-4 h-4 text-base-content/50" />;
    if (isHigherBetter) {
      return current > compare ? <ArrowUpIcon className="w-4 h-4 text-success" /> : <ArrowDownIcon className="w-4 h-4 text-error" />;
    } else {
      return current < compare ? <ArrowUpIcon className="w-4 h-4 text-success" /> : <ArrowDownIcon className="w-4 h-4 text-error" />;
    }
  };

  const getComparisonColor = (current, compare, isHigherBetter) => {
    if (current === compare) return 'text-base-content';
    if (isHigherBetter) {
      return current > compare ? 'text-success' : 'text-error';
    } else {
      return current < compare ? 'text-success' : 'text-error';
    }
  };

  const addRun = (runId) => {
    const runToAdd = mockRuns.find(r => r.run_id === runId);
    if (runToAdd && !comparisonRuns.find(r => r.run_id === runId)) {
      setSelectedRuns([...comparisonRuns, runToAdd]);
    }
    setShowAddRun(false);
  };

  const removeRun = (runId) => {
    setSelectedRuns(selectedRuns.filter(r => r.run_id !== runId));
  };

  const exportComparison = () => {
    if (comparisonRuns.length === 0) return;
    
    const headers = ['Metric', ...comparisonRuns.map(r => r.isCurrent ? 'Current Run' : `Run ${r.run_id}`)];
    const rows = comparisonMetrics.map(metric => [
      metric.label,
      ...comparisonRuns.map(run => formatValue(run.metrics[metric.key], metric.format))
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${run.strategy || 'strategy'}_comparison.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-base-200 border border-base-300 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-base-content">Comparing {comparisonRuns.length} Runs</h3>
            <div className="flex flex-wrap gap-2">
              {comparisonRuns.map((r) => (
                <div key={r.run_id} className="flex items-center gap-2 bg-base-300 px-3 py-1 rounded-full">
                  <span className="text-sm font-medium">
                    {r.isCurrent ? 'Current' : r.run_id}
                  </span>
                  {!r.isCurrent && (
                    <button
                      onClick={() => removeRun(r.run_id)}
                      className="text-base-content/50 hover:text-error"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!showAddRun ? (
              <button
                onClick={() => setShowAddRun(true)}
                className="btn btn-sm btn-primary gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Add Run
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  className="select select-bordered select-sm"
                  onChange={(e) => addRun(e.target.value)}
                  defaultValue=""
                >
                  <option value="">Select run...</option>
                  {mockRuns
                    .filter(r => !comparisonRuns.find(s => s.run_id === r.run_id))
                    .map(r => (
                      <option key={r.run_id} value={r.run_id}>
                        {r.run_id}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => setShowAddRun(false)}
                  className="btn btn-sm btn-ghost"
                >
                  Cancel
                </button>
              </div>
            )}
            
            <button
              onClick={exportComparison}
              className="btn btn-sm btn-ghost"
            >
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-base-200 border border-base-300 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-base-300">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Metric</th>
                {comparisonRuns.map((r) => (
                  <th key={r.run_id} className="px-4 py-3 text-right font-semibold">
                    {r.isCurrent ? 'Current Run' : r.run_id}
                    {r.isCurrent && <span className="ml-2 text-xs text-primary">(This)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {comparisonMetrics.map((metric) => (
                <tr key={metric.key} className="hover:bg-base-300 transition">
                  <td className="px-4 py-3 font-medium text-base-content">
                    {metric.label}
                  </td>
                  {comparisonRuns.map((run, runIdx) => {
                    const currentValue = run.metrics[metric.key];
                    const previousValue = runIdx > 0 ? comparisonRuns[runIdx - 1].metrics[metric.key] : null;
                    
                    return (
                      <td key={`${metric.key}-${run.run_id}`} className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {previousValue !== null && (
                            <span className={getComparisonColor(currentValue, previousValue, metric.isHigherBetter)}>
                              {formatValue(currentValue, metric.format)}
                            </span>
                          )}
                          {previousValue !== null && (
                            getComparisonIcon(currentValue, previousValue, metric.isHigherBetter)
                          )}
                          {previousValue === null && (
                            <span className="font-semibold text-primary">
                              {formatValue(currentValue, metric.format)}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-base-200 border border-base-300 rounded-lg p-5">
          <h4 className="text-sm text-base-content/50 mb-2">Best Performing Run</h4>
          <div className="text-lg font-bold text-success">
            {comparisonRuns.reduce((best, current) => 
              current.metrics.oosProfit > best.metrics.oosProfit ? current : best
            ).run_id}
          </div>
          <div className="text-xs text-base-content/40 mt-1">
            Based on OOS Profit
          </div>
        </div>

        <div className="bg-base-200 border border-base-300 rounded-lg p-5">
          <h4 className="text-sm text-base-content/50 mb-2">Lowest Risk Run</h4>
          <div className="text-lg font-bold text-success">
            {comparisonRuns.reduce((best, current) => 
              current.metrics.maxDD < best.metrics.maxDD ? current : best
            ).run_id}
          </div>
          <div className="text-xs text-base-content/40 mt-1">
            Based on Max Drawdown
          </div>
        </div>

        <div className="bg-base-200 border border-base-300 rounded-lg p-5">
          <h4 className="text-sm text-base-content/50 mb-2">Most Consistent Run</h4>
          <div className="text-lg font-bold text-success">
            {comparisonRuns.reduce((best, current) => 
              current.metrics.sharpe > best.metrics.sharpe ? current : best
            ).run_id}
          </div>
          <div className="text-xs text-base-content/40 mt-1">
            Based on Sharpe Ratio
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonTab;
