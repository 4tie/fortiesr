import React from "react";
import {
  DocumentArrowDownIcon,
  Cog6ToothIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

const ExportCards = ({ run, API_BASE }) => {
  if (!run) return null;

  const runId = run.run_id;

  const downloadFile = (filename) => {
    const url = `${API_BASE}/api/auto-quant/download/${runId}/${filename}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadReport = () => {
    const url = `${API_BASE}/api/auto-quant/report/${runId}/html`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${run.strategy}_report.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-base-300 border border-base-300 rounded-lg p-5 hover:border-primary transition">
        <div className="flex items-start gap-3 mb-3">
          <DocumentArrowDownIcon className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-base-content text-sm">Strategy File (.py)</h4>
            <p className="text-xs text-base-content/50 mt-1">
              Optimized trading strategy with all hyperopt parameters, profit lock rules, and
              position sizing logic injected.
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="text-xs text-base-content/70 bg-black/10 p-2 rounded border border-base-300 font-mono">
            <div>📝 Contains:</div>
            <div className="ml-2 mt-1">• {run.strategy} strategy class</div>
            <div className="ml-2">• Best hyperopt parameters</div>
            <div className="ml-2">• Profit lock rules (3-tier)</div>
            <div className="ml-2">• Blocked hours & days</div>
            <div className="ml-2">• Position sizing method</div>
          </div>
        </div>

        <button
          onClick={() => downloadFile(`${run.strategy}_optimized.py`)}
          className="w-full bg-primary hover:bg-primary/80 text-primary-content py-2 px-3 rounded font-medium text-sm transition flex items-center justify-center gap-2"
        >
          <DocumentArrowDownIcon className="w-4 h-4" />
          Download Strategy
        </button>
      </div>

      <div className="bg-base-300 border border-base-300 rounded-lg p-5 hover:border-success transition">
        <div className="flex items-start gap-3 mb-3">
          <Cog6ToothIcon className="w-6 h-6 text-success flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-base-content text-sm">Config File (.json)</h4>
            <p className="text-xs text-base-content/50 mt-1">
              Ready-to-use configuration with winning pairs, stake settings, and position sizing
              rules for live trading.
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="text-xs text-base-content/70 bg-black/10 p-2 rounded border border-base-300 font-mono">
            <div>⚙️ Contains:</div>
            <div className="ml-2 mt-1">• Winning pairs list</div>
            <div className="ml-2">• Position sizing per pair</div>
            <div className="ml-2">• Exchange & stake settings</div>
            <div className="ml-2">• Risk parameters</div>
            <div className="ml-2">• Max open trades config</div>
          </div>
        </div>

        <button
          onClick={() => downloadFile("config.json")}
          className="w-full bg-success hover:bg-success/80 text-success-content py-2 px-3 rounded font-medium text-sm transition flex items-center justify-center gap-2"
        >
          <Cog6ToothIcon className="w-4 h-4" />
          Download Config
        </button>
      </div>

      <div className="bg-base-300 border border-base-300 rounded-lg p-5 hover:border-secondary transition">
        <div className="flex items-start gap-3 mb-3">
          <ChartBarIcon className="w-6 h-6 text-secondary flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-base-content text-sm">Report (.html)</h4>
            <p className="text-xs text-base-content/50 mt-1">
              Comprehensive self-contained HTML report with charts, stage results, and complete
              audit trail. Open in any browser.
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="text-xs text-base-content/70 bg-black/10 p-2 rounded border border-base-300 font-mono">
            <div>📊 Includes:</div>
            <div className="ml-2 mt-1">• All 7 stage results</div>
            <div className="ml-2">• Performance metrics</div>
            <div className="ml-2">• Equity curve chart</div>
            <div className="ml-2">• Per-pair breakdown</div>
            <div className="ml-2">• Risk assessment details</div>
          </div>
        </div>

        <button
          onClick={downloadReport}
          className="w-full bg-secondary hover:bg-secondary/80 text-secondary-content py-2 px-3 rounded font-medium text-sm transition flex items-center justify-center gap-2"
        >
          <ChartBarIcon className="w-4 h-4" />
          Download Report
        </button>
      </div>
    </div>
  );
};

export default ExportCards;
