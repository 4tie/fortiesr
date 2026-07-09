import { useState } from "react";
import {
  ArchiveBoxArrowDownIcon,
  ArrowPathIcon,
  ClockIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";
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
const RunDetailSummary = ({ run, API_BASE = "" }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [realTimeEnabled, setRealTimeEnabled] = useState(run?.status === "running");
  const [freqtradeExporting, setFreqtradeExporting] = useState(false);
  const [freqtradeExportError, setFreqtradeExportError] = useState("");
  
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
      case 'current-view': {
        // Export current tab as PNG
        const element = document.getElementById(`tab-${activeTab}`);
        if (element) {
          // In a real implementation, you'd use html2canvas or similar
          console.log('Exporting current view as PNG');
        }
        break;
      }
      case 'all-data': {
        // Export all data as CSV
        const csvContent = generateCSV(currentRun);
        downloadFile(csvContent, `${run.strategy}_full_data.csv`, 'text/csv');
        break;
      }
      case 'report': {
        // Export full report as HTML
        window.open(`/api/auto-quant/report/${run.run_id}/html`, '_blank');
        break;
      }
      case 'charts': {
        // Export charts as PNG
        console.log('Exporting charts as PNG');
        break;
      }
      default:
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

  const filenameFromDisposition = (header) => {
    if (!header) return null;
    const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch) return decodeURIComponent(utfMatch[1].replace(/"/g, ""));
    const plainMatch = header.match(/filename="?([^";]+)"?/i);
    return plainMatch ? plainMatch[1] : null;
  };

  const handleFreqtradeExport = async () => {
    if (!currentRun?.run_id || currentRun.status !== "completed" || freqtradeExporting) return;

    setFreqtradeExporting(true);
    setFreqtradeExportError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/auto-quant/export/${encodeURIComponent(currentRun.run_id)}`,
        { method: "POST" }
      );

      if (!response.ok) {
        let message = "Export failed.";
        try {
          const payload = await response.json();
          message = payload.detail || message;
        } catch {
          message = response.statusText || message;
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const filename =
        filenameFromDisposition(response.headers.get("content-disposition")) ||
        `${currentRun.strategy || "strategy"}_freqtrade_export.zip`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setFreqtradeExportError(err.message || "Export failed.");
    } finally {
      setFreqtradeExporting(false);
    }
  };

  const canExportFreqtrade = currentRun?.status === "completed";

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-base-content">Run Summary</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className={`btn btn-sm btn-outline gap-2 ${freqtradeExporting ? "loading" : ""}`}
            onClick={handleFreqtradeExport}
            disabled={!canExportFreqtrade || freqtradeExporting}
            title={canExportFreqtrade ? "Download Freqtrade deployment bundle" : "Export is available after completion"}
          >
            {!freqtradeExporting && <ArchiveBoxArrowDownIcon className="w-4 h-4" />}
            Export for Freqtrade
          </button>
          <ExportButton run={currentRun} activeTab={activeTab} onExport={handleExport} />
        </div>
      </div>

      {freqtradeExportError && (
        <div className="alert alert-error py-2 text-sm">
          <span>{freqtradeExportError}</span>
        </div>
      )}

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
