import React from "react";
import { CheckCircleIcon, XCircleIcon, ClockIcon } from "@heroicons/react/24/outline";

const RunDetailStages = ({ run }) => {
  const stages = run.stages || [];

  const getStageIcon = (status) => {
    if (status === "passed") return <CheckCircleIcon className="w-6 h-6 text-success" />;
    if (status === "failed") return <XCircleIcon className="w-6 h-6 text-error" />;
    return <ClockIcon className="w-6 h-6 text-base-content/40" />;
  };

  const getStatusColor = (status) => {
    if (status === "passed") return "border-success/30 bg-success/10";
    if (status === "failed") return "border-error/30 bg-error/10";
    return "border-base-300 bg-base-200";
  };

  const fmt = (n, decimals = 2) => {
    if (typeof n !== "number") return "N/A";
    return n.toFixed(decimals);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "N/A";
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  return (
    <div className="space-y-4">
      {stages.map((stage, idx) => (
        <div key={idx} className={`border rounded-lg p-5 ${getStatusColor(stage.status)}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {getStageIcon(stage.status)}
              <div>
                <h3 className="font-bold text-base-content text-lg">
                  Stage {stage.index}: {stage.name}
                </h3>
                <p className="text-xs text-base-content/50">
                  Status: <span className="capitalize font-semibold">{stage.status}</span>
                </p>
              </div>
            </div>
            {stage.duration_s && (
              <div className="text-right">
                <div className="text-sm text-base-content/70">Duration</div>
                <div className="font-semibold text-base-content">
                  {formatDuration(stage.duration_s)}
                </div>
              </div>
            )}
          </div>

          {stage.message && (
            <p className="text-sm text-base-content/70 mb-3 bg-black/10 p-2 rounded border border-base-300">
              {stage.message}
            </p>
          )}

          {stage.data && Object.keys(stage.data).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-base-300">
              {stage.index === 1 && (
                <>
                  <div>
                    <div className="text-xs text-base-content/50">Data Healed</div>
                    <div className="font-bold text-base-content">{stage.data.pairs_healed || 0} pairs</div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/50">Baseline Profit</div>
                    <div className="font-bold text-base-content">
                      ${fmt(stage.data.baseline_profit || 0, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/50">Selected Pairs</div>
                    <div className="font-bold text-base-content">{stage.data.pairs_selected || 0}</div>
                  </div>
                </>
              )}

              {stage.index === 2 && (
                <>
                  <div>
                    <div className="text-xs text-base-content/50">Epochs Completed</div>
                    <div className="font-bold text-base-content">
                      {stage.data.epochs_completed || 0} / {stage.data.epochs_total || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/50">Best Fitness</div>
                    <div className="font-bold text-base-content">
                      {fmt(stage.data.best_fitness || 0, 4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/50">Robustness</div>
                    <div className="font-bold text-base-content">
                      {stage.data.robustness_score || "N/A"}
                    </div>
                  </div>
                </>
              )}

              {stage.index === 4 && (
                <>
                  <div>
                    <div className="text-xs text-base-content/50">OOS Profit</div>
                    <div className={`font-bold ${stage.data.oos_profit > 0 ? "text-success" : "text-error"}`}>
                      {fmt(stage.data.oos_profit * 100 || 0, 1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/50">OOS Max DD</div>
                    <div className="font-bold text-base-content">
                      {fmt(stage.data.oos_drawdown * 100 || 0, 1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/50">OOS Win Rate</div>
                    <div className="font-bold text-base-content">
                      {fmt(stage.data.oos_win_rate * 100 || 0, 1)}%
                    </div>
                  </div>
                </>
              )}

              {stage.index === 5 && (
                <>
                  <div>
                    <div className="text-xs text-base-content/50">Portfolio Profit</div>
                    <div className={`font-bold ${stage.data.portfolio_profit > 0 ? "text-success" : "text-error"}`}>
                      ${fmt(stage.data.portfolio_profit || 0, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/50">Portfolio Max DD</div>
                    <div className="font-bold text-base-content">
                      {fmt(stage.data.portfolio_max_dd * 100 || 0, 1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/50">Pairs Used</div>
                    <div className="font-bold text-base-content">{stage.data.pairs_count || 0}</div>
                  </div>
                </>
              )}

              {stage.index === 6 && (
                <>
                  <div>
                    <div className="text-xs text-base-content/50">Final Profit Factor</div>
                    <div className="font-bold text-base-content">
                      {fmt(stage.data.profit_factor || 0, 2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/50">Final Win Rate</div>
                    <div className="font-bold text-base-content">
                      {fmt(stage.data.win_rate * 100 || 0, 1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/50">MC p95 Drawdown</div>
                    <div className="font-bold text-base-content">
                      {fmt(stage.data.mc_p95_dd * 100 || 0, 1)}%
                    </div>
                  </div>
                </>
              )}

              {stage.index === 7 && (
                <>
                  <div>
                    <div className="text-xs text-base-content/50">Files Generated</div>
                    <div className="font-bold text-base-content">
                      {stage.data.files_count || 0} files
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-base-content/50">Strategy Size</div>
                    <div className="font-bold text-base-content">
                      {stage.data.strategy_size || "N/A"} KB
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg p-5 mt-6">
        <h3 className="font-bold text-primary text-sm mb-2">📊 Pipeline Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-primary">Total Stages</div>
            <div className="font-bold text-base-content">{stages.length}</div>
          </div>
          <div>
            <div className="text-primary">Passed</div>
            <div className="font-bold text-success">
              {stages.filter((s) => s.status === "passed").length}
            </div>
          </div>
          <div>
            <div className="text-primary">Failed</div>
            <div className="font-bold text-error">
              {stages.filter((s) => s.status === "failed").length}
            </div>
          </div>
          <div>
            <div className="text-primary">Total Duration</div>
            <div className="font-bold text-base-content">
              {formatDuration(
                stages.reduce((sum, s) => sum + (s.duration_s || 0), 0)
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-base-200 border border-base-300 rounded-lg p-5 text-xs text-base-content/50">
        <div className="font-semibold text-base-content mb-2">Stage Descriptions:</div>
        <div className="space-y-1">
          <div>
            <span className="font-mono">Stage 1: Sanity Backtest</span> - Data healing and pair
            pre-selection
          </div>
          <div>
            <span className="font-mono">Stage 2: Hyperopt Execution</span> - Parameter
            optimization with Walk-Forward Analysis
          </div>
          <div>
            <span className="font-mono">Stage 3: Auto-Patching</span> - Best parameters injected
            into strategy
          </div>
          <div>
            <span className="font-mono">Stage 4: OOS Validation</span> - Out-of-sample backtest on
            held-out data
          </div>
          <div>
            <span className="font-mono">Stage 5: Multi-Pair Stress Test</span> - Portfolio
            testing with capital constraints
          </div>
          <div>
            <span className="font-mono">Stage 6: Risk Assessment</span> - Hard gates applied
            (profitability validation)
          </div>
          <div>
            <span className="font-mono">Stage 7: Delivery</span> - Final strategy, config, and
            report generation
          </div>
        </div>
      </div>
    </div>
  );
};

export default RunDetailStages;
