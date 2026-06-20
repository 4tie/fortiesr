const RunDetailParameters = ({ run }) => {
  const report = run.report || {};
  const bestParams = report.best_params?.params_dict || {};
  const thresholds = report.thresholds || {};
  const ensemble = report.ensemble_weights || {};

  return (
    <div className="space-y-6">
      <div className="bg-base-200 border border-base-300 rounded-lg p-6">
        <h3 className="text-xl font-bold text-base-content mb-4 flex items-center gap-2">
          <span>🎯</span> Strategy Best Parameters
        </h3>
        {Object.keys(bestParams).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(bestParams).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between bg-base-300 p-4 rounded border border-base-300"
              >
                <span className="font-mono text-sm text-base-content/70">{key}</span>
                <span className="font-bold text-primary text-lg">{String(value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-base-content/40 italic">No parameters available</div>
        )}
      </div>

      <div className="bg-base-200 border border-base-300 rounded-lg p-6">
        <h3 className="text-xl font-bold text-base-content mb-4 flex items-center gap-2">
          <span>⚙️</span> Hyperopt Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-base-300 p-5 rounded border border-base-300">
            <div className="text-sm text-base-content/50 mb-1">Loss Function</div>
            <div className="text-base-content font-semibold text-lg">
              {report.hyperopt_loss || "N/A"}
            </div>
          </div>
          <div className="bg-base-300 p-5 rounded border border-base-300">
            <div className="text-sm text-base-content/50 mb-1">Epochs Completed</div>
            <div className="text-base-content font-semibold text-lg">
              {report.hyperopt_epochs || 0}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm text-base-content/50 mb-2">Search Spaces</div>
          <div className="flex flex-wrap gap-2">
            {(report.hyperopt_spaces || []).map((space) => (
              <div
                key={space}
                className="bg-primary/10 text-primary px-3 py-1 rounded text-sm font-mono border border-primary/30"
              >
                {space}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-base-200 border border-base-300 rounded-lg p-6">
        <h3 className="text-xl font-bold text-base-content mb-4 flex items-center gap-2">
          <span>🚪</span> Risk Thresholds Applied
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-base-300 p-5 rounded border border-base-300">
            <div className="text-sm text-base-content/50 mb-2">Max Drawdown</div>
            <div className="text-base-content font-bold text-2xl">
              &lt;{thresholds.max_drawdown?.toFixed(1) || 30}%
            </div>
          </div>
          <div className="bg-base-300 p-5 rounded border border-base-300">
            <div className="text-sm text-base-content/50 mb-2">Min Win Rate</div>
            <div className="text-base-content font-bold text-2xl">
              ≥{thresholds.min_win_rate?.toFixed(0) || 40}%
            </div>
          </div>
          <div className="bg-base-300 p-5 rounded border border-base-300">
            <div className="text-sm text-base-content/50 mb-2">Min Profit Factor</div>
            <div className="text-base-content font-bold text-2xl">
              ≥{thresholds.min_profit_factor?.toFixed(1) || 1.3}
            </div>
          </div>
          <div className="bg-base-300 p-5 rounded border border-base-300">
            <div className="text-sm text-base-content/50 mb-2">Min Sharpe Ratio</div>
            <div className="text-base-content font-bold text-2xl">
              ≥{thresholds.min_sharpe?.toFixed(1) || 0.5}
            </div>
          </div>
          <div className="bg-base-300 p-5 rounded border border-base-300">
            <div className="text-sm text-base-content/50 mb-2">Min OOS Profit</div>
            <div className="text-base-content font-bold text-2xl">
              ≥{(thresholds.min_oos_profit * 100).toFixed(0) || 0}%
            </div>
          </div>
          <div className="bg-base-300 p-5 rounded border border-base-300">
            <div className="text-sm text-base-content/50 mb-2">Monte Carlo Threshold</div>
            <div className="text-base-content font-bold text-2xl">
              &lt;{(thresholds.monte_carlo_threshold * 100).toFixed(0) || 35}%
            </div>
          </div>
        </div>
      </div>

      {Object.keys(ensemble).length > 0 && (
        <div className="bg-base-200 border border-base-300 rounded-lg p-6">
          <h3 className="text-xl font-bold text-base-content mb-4 flex items-center gap-2">
            <span>🔀</span> Ensemble Voting Configuration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: "rsi_weight", label: "RSI Signal Weight" },
              { key: "macd_weight", label: "MACD Signal Weight" },
              { key: "bb_weight", label: "Bollinger Bands Weight" },
              { key: "consensus_threshold", label: "Consensus Threshold" },
            ].map(({ key, label }) => (
              ensemble[key] !== undefined && (
                <div key={key} className="bg-base-300 p-5 rounded border border-base-300">
                  <div className="text-sm text-base-content/50 mb-2">{label}</div>
                  <div className="text-base-content font-bold text-xl">
                    {typeof ensemble[key] === "number"
                      ? ensemble[key].toFixed(3)
                      : ensemble[key]}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {report.sensitivity && (
        <div className="bg-base-200 border border-base-300 rounded-lg p-6">
          <h3 className="text-xl font-bold text-base-content mb-4 flex items-center gap-2">
            <span>📊</span> Robustness / Sensitivity Analysis
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-base-300 p-4 rounded">
              <span className="text-base-content/70">Tested Parameter</span>
              <span className="font-mono text-base-content">{report.sensitivity.param}</span>
            </div>
            <div className="flex items-center justify-between bg-base-300 p-4 rounded">
              <span className="text-base-content/70">Robustness Score</span>
              <span
                className={`font-bold text-lg ${
                  report.sensitivity.score === "HIGH"
                    ? "text-success"
                    : report.sensitivity.score === "MEDIUM"
                      ? "text-warning"
                      : "text-error"
                }`}
              >
                {report.sensitivity.score}
              </span>
            </div>
            <div className="flex items-center justify-between bg-base-300 p-4 rounded">
              <span className="text-base-content/70">Profile Shape</span>
              <span className="text-base-content">{report.sensitivity.label}</span>
            </div>
            <div className="text-xs text-base-content/50 mt-2 p-3 bg-base-300 rounded italic">
              Parameters were tested at ±5% of best value to assess stability.
              HIGH = stable plateau (good), MEDIUM = moderate sensitivity, LOW = sharp peak
              (overfitting).
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RunDetailParameters;
