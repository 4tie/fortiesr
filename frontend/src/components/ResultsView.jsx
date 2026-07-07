import { useState, useEffect } from "react";
import { api } from "../services/api.js";
import ErrorDisplay from "./shared/ErrorDisplay";
import PageContainer from "./shared/PageContainer.jsx";
import PageHeader from "./shared/PageHeader.jsx";

export default function ResultsView({ onLoadResult }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      try {
        const r = await fetch("/api/results");
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          setError(err.detail || "Failed to load results.");
          setResults([]);
          return;
        }
        const data = await r.json();
        setResults(data.results || []);
        setError(null);
      } catch {
        setError("Network error. Is the backend running?");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, []);

  async function handleView(resultRow) {
    const runId = resultRow?.run_id || resultRow;
    try {
      const data = await api.backtest.getResults(runId);
      onLoadResult({
        run_id: runId,
        strategy_name: resultRow?.strategy_name || data?.metadata?.strategy_name || data?.strategy_name || null,
        results: data,
      });
    } catch (e) {
      setError(e.message || "Network error loading result details.");
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <div className="skeleton h-12 w-full rounded-box" />
          <div className="skeleton h-12 w-full rounded-box" />
          <div className="skeleton h-12 w-full rounded-box" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ErrorDisplay
          errorCode="config_error"
          title="Results Error"
          reason={error}
          severity="high"
          canAutoFix={false}
          suggestedAction="Check the backend connection and try again"
        />
      </PageContainer>
    );
  }

  if (results.length === 0) {
    return (
      <PageContainer>
        <div className="text-center py-20">
          <div className="text-5xl mb-4 opacity-20">📊</div>
          <h3 className="text-lg font-semibold mb-1">No results yet</h3>
          <p className="text-sm text-base-content/50">
            Run a backtest and your results will appear here.
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Backtest Results" />
      <div className="overflow-x-auto rounded-lg border border-base-300">
        <table className="table table-sm w-full">
          <thead>
            <tr className="text-xs text-base-content/50 bg-base-200">
              <th>Run ID</th>
              <th>Strategy</th>
              <th>Date Range</th>
              <th className="text-right">Trades</th>
              <th className="text-right">Net Profit %</th>
              <th className="text-right">Win Rate</th>
              <th className="text-right">Duration</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map((res) => {
              const s = res.parsed_summary || {};
              const profit = s.net_profit_pct;
              const isProfit = profit != null && profit >= 0;
              return (
                <tr key={res.run_id} className="hover:bg-base-200/50 transition-colors">
                  <td className="font-mono text-xs text-base-content/40">{res.run_id.slice(0, 8)}…</td>
                  <td className="text-sm font-medium">{res.strategy_name || "—"}</td>
                  <td className="text-xs text-base-content/60">{res.timerange || "—"}</td>
                  <td className="text-right text-sm">{s.total_trades ?? "—"}</td>
                  <td className={`text-right text-sm font-mono font-semibold ${isProfit ? "text-success" : "text-error"}`}>
                    {profit != null ? `${profit >= 0 ? "+" : ""}${profit.toFixed(2)}%` : "—"}
                  </td>
                  <td className="text-right text-sm">
                    {s.win_rate_pct != null ? `${s.win_rate_pct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="text-right text-xs text-base-content/50">
                    {res.duration_ms != null
                      ? `${(res.duration_ms / 1000).toFixed(1)}s`
                      : "—"}
                  </td>
                  <td className="text-right">
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={() => handleView(res)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
