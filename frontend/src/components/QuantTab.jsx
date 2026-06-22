import { useState, useEffect, useCallback } from "react";

export default function QuantTab() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/quant/reports");
      const data = await res.json();
      setReports(data.reports || []);
    } catch (e) {
      console.error("Failed to fetch reports:", e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      await fetchReports();
      if (isMounted) setLoading(false);
    };
    load();
    return () => { isMounted = false; };
  }, [fetchReports]);

  const viewReport = async (reportName) => {
    try {
      const res = await fetch(`/api/quant/reports/${reportName}`);
      const data = await res.json();
      setSelectedReport(data);
    } catch (e) {
      console.error("Failed to fetch report:", e);
    }
  };

  const runBacktest = async () => {
    try {
      const res = await fetch("/api/quant/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy: "SampleStrategy",
          timeframe: "1h",
          timerange: "20240101-20240601",
        }),
      });
      const data = await res.json();
      alert(`Backtest completed: Profit $${data.profit.toFixed(2)}`);
      fetchReports();
    } catch (e) {
      console.error("Failed to run backtest:", e);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📊 Quant Agent</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={runBacktest}
          disabled={loading}
        >
          {loading ? "Running..." : "Run Test Backtest"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reports List */}
        <div className="card bg-base-200 shadow-xl border border-base-300">
          <div className="card-body">
            <h2 className="card-title text-lg">Reports</h2>
            <div className="divider my-2" />
            {loading ? (
              <div className="skeleton h-32 w-full" />
            ) : reports.length === 0 ? (
              <p className="text-sm text-base-content/50">No reports available</p>
            ) : (
              <ul className="space-y-2">
                {reports.map((report) => (
                  <li key={report}>
                    <button
                      className="btn btn-ghost btn-sm w-full justify-start"
                      onClick={() => viewReport(report)}
                    >
                      📄 {report}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Report Content */}
        <div className="card bg-base-200 shadow-xl border border-base-300">
          <div className="card-body">
            <h2 className="card-title text-lg">Report Content</h2>
            <div className="divider my-2" />
            {selectedReport ? (
              <div className="prose prose-sm max-w-none overflow-auto max-h-96">
                <pre className="whitespace-pre-wrap text-xs">{selectedReport.content}</pre>
              </div>
            ) : (
              <p className="text-sm text-base-content/50">Select a report to view</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card bg-base-200 shadow-xl border border-base-300">
        <div className="card-body">
          <h2 className="card-title text-lg">Quick Actions</h2>
          <div className="divider my-2" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button className="btn btn-outline btn-sm">Download Data</button>
            <button className="btn btn-outline btn-sm">Run Hyperopt</button>
            <button className="btn btn-outline btn-sm">Compare Strategies</button>
            <button className="btn btn-outline btn-sm">Generate Report</button>
          </div>
        </div>
      </div>
    </div>
  );
}
