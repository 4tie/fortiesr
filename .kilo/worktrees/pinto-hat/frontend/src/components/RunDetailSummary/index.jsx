import React, { useState } from "react";
import { ClockIcon, SignalIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import SummaryTabs from "./SummaryTabs";
import OverviewTab from "./OverviewTab";
import ChartsTab from "./ChartsTab";
import DataTableTab from "./DataTableTab";
import ComparisonTab from "./ComparisonTab";
import ExportButton from "./ExportButton";
import useRealTimeUpdates from "./useRealTimeUpdates";

/**
 * RunDetailSummary: Modern dashboard with tabbed navigation
 * Shows Overview, Charts, Data Table, and Comparison tabs
 * Supports real-time updates for active runs
 */
const RunDetailSummary = ({ run }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [realTimeEnabled, setRealTimeEnabled] = useState(run?.status === "running");
  
  const { 
    liveData, 
    isConnected, 
    lastUpdate, 
    error,
    refresh,
    toggleUpdates,
    isLive 
  } = useRealTimeUpdates(run, realTimeEnabled, 5000);

  const currentRun = liveData || run;

  if (!run) return null;

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "charts", label: "Charts", icon: "📈" },
    { id: "datatable", label: "Data Table", icon: "📋" },
    { id: "comparison", label: "Comparison", icon: "⚖️" },
  ];

  const handleExport = (format) => {
    switch (format) {
      case 'current-view':
        // Export current tab as PNG
        const element = document.getElementById(`tab-${activeTab}`);
        if (element) {
          // In a real implementation, you'd use html2canvas or similar
          console.log('Exporting current view as PNG');
        }
        break;
      case 'all-data':
        // Export all data as CSV
        const csvContent = generateCSV(currentRun);
        downloadFile(csvContent, `${run.strategy}_full_data.csv`, 'text/csv');
        break;
      case 'report':
        // Export full report as HTML
        window.open(`/api/auto-quant/report/${run.run_id}/html`, '_blank');
        break;
      case 'charts':
        // Export charts as PNG
        console.log('Exporting charts as PNG');
        break;
    }
  };

  const generateCSV = (data) => {
    const report = data.report || {};
    const risk = report.risk_assessment || {};
    
    const headers = ['Metric', 'Value', 'Format'];
    const rows = [
      ['In-Sample Profit', report.sanity_backtest?.profit_total_abs || 0, 'currency'],
      ['OOS Profit %', (report.oos_validation?.profit_total || 0) * 100, 'percentage'],
      ['Max Drawdown', risk.max_drawdown_pct || 0, 'percentage'],
      ['Win Rate', risk.win_rate_pct || 0, 'percentage'],
      ['Sharpe Ratio', risk.sharpe_ratio || 0, 'ratio'],
      ['Profit Factor', risk.profit_factor || 0, 'ratio'],
      ['Total Trades', risk.total_trades || 0, 'number'],
    ];
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-base-content">Run Summary</h2>
        <ExportButton run={currentRun} activeTab={activeTab} onExport={handleExport} />
      </div>

      {/* Real-time Status Bar */}
      {run.status === "running" && (
        <div className={`bg-base-200 border rounded-lg p-3 flex items-center justify-between ${
          error ? 'border-error/30' : isConnected ? 'border-success/30' : 'border-warning/30'
        }`}>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <SignalIcon className="w-5 h-5 text-success animate-pulse" />
            ) : isLive ? (
              <ClockIcon className="w-5 h-5 text-warning" />
            ) : (
              <SignalIcon className="w-5 h-5 text-base-content/30" />
            )}
            <div>
              <span className="text-sm font-medium text-base-content">
                {isConnected ? 'Live Updates Connected' : isLive ? 'Polling for Updates' : 'Updates Paused'}
              </span>
              {lastUpdate && (
                <span className="text-xs text-base-content/50 ml-2">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="btn btn-sm btn-ghost"
              title="Refresh now"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setRealTimeEnabled(!realTimeEnabled);
                toggleUpdates();
              }}
              className={`btn btn-sm ${realTimeEnabled ? 'btn-primary' : 'btn-ghost'}`}
            >
              {realTimeEnabled ? 'Live' : 'Paused'}
            </button>
          </div>
        </div>
      )}

      <SummaryTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div id={`tab-${activeTab}`}>
        {activeTab === "overview" && <OverviewTab run={currentRun} />}
        {activeTab === "charts" && <ChartsTab run={currentRun} />}
        {activeTab === "datatable" && <DataTableTab run={currentRun} />}
        {activeTab === "comparison" && <ComparisonTab run={currentRun} />}
      </div>
    </div>
  );
};

export default RunDetailSummary;
