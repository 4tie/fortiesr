import MetricCard from "./MetricCard";

const OverviewTab = ({ run }) => {
  const report = run.report || {};
  const risk = report.risk_assessment || {};
  const thresholds = report.thresholds || {};

  const metrics = {
    inProfit: report.sanity_backtest?.profit_total_abs || 0,
    oosProfit: report.oos_validation?.profit_total || 0,
    maxDD: risk.max_drawdown_pct || 0,
    winRate: risk.win_rate_pct || 0,
    sharpe: risk.sharpe_ratio || 0,
    profitFactor: risk.profit_factor || 0,
    trades: risk.total_trades || 0,
  };

  const checks = risk.checks || {};
  const mc = risk.monte_carlo || {};

  // Calculate overall health score
  const passedChecks = Object.values(checks).filter(c => c.passed).length;
  const totalChecks = Object.keys(checks).length;
  const healthScore = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Health Score Banner */}
      <div className={`bg-gradient-to-r ${healthScore >= 80 ? 'from-success/20 to-success/10 border-success/30' : healthScore >= 50 ? 'from-warning/20 to-warning/10 border-warning/30' : 'from-error/20 to-error/10 border-error/30'} border rounded-lg p-5 shadow-sm transition-all duration-300`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-lg font-semibold ${healthScore >= 80 ? 'text-success' : healthScore >= 50 ? 'text-warning' : 'text-error'}`}>
              Strategy Health Score
            </h3>
            <p className="text-sm text-base-content/70 mt-1">
              {passedChecks} of {totalChecks} profitability criteria met
            </p>
          </div>
          <div className={`text-4xl font-bold ${healthScore >= 80 ? 'text-success' : healthScore >= 50 ? 'text-warning' : 'text-error'}`}>
            {healthScore.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <MetricCard
          title="In-Sample Profit"
          value={metrics.inProfit}
          subtitle={run.in_sample_range}
          format="currency"
        />
        <MetricCard
          title="OOS Profit %"
          value={metrics.oosProfit * 100}
          subtitle={run.out_sample_range}
          threshold={thresholds.min_oos_profit * 100}
          isHigherBetter={true}
          format="percentage"
          decimals={1}
        />
        <MetricCard
          title="Max Drawdown"
          value={metrics.maxDD}
          threshold={thresholds.max_drawdown}
          isHigherBetter={false}
          format="percentage"
          decimals={1}
        />
        <MetricCard
          title="Win Rate"
          value={metrics.winRate}
          threshold={thresholds.min_win_rate}
          isHigherBetter={true}
          format="percentage"
          decimals={1}
        />
        <MetricCard
          title="Sharpe Ratio"
          value={metrics.sharpe}
          threshold={thresholds.min_sharpe}
          isHigherBetter={true}
          format="ratio"
          decimals={2}
        />
        <MetricCard
          title="Profit Factor"
          value={metrics.profitFactor}
          threshold={thresholds.min_profit_factor}
          isHigherBetter={true}
          format="ratio"
          decimals={2}
        />
        <MetricCard
          title="Total Trades"
          value={metrics.trades}
          subtitle="Goal: ≥200 for significance"
          format="number"
          decimals={0}
        />
        <MetricCard
          title="MC P95 Drawdown"
          value={mc.p95_drawdown * 100}
          threshold={thresholds.monte_carlo_threshold * 100}
          isHigherBetter={false}
          format="percentage"
          decimals={1}
        />
      </div>

      {/* Profitability Gates */}
      <div className="bg-base-200 border border-base-300 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-base-content mb-4 flex items-center gap-2">
          <span>🚪</span> Profitability Gates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(checks).map(([name, data]) => (
            <div key={name} className="flex items-center justify-between bg-base-300 p-4 rounded border border-base-300">
              <span className="text-sm text-base-content/70 capitalize">
                {name.replace(/_/g, " ")}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-base-content/50 font-mono">{data.value}</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${data.passed ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
                  {data.passed ? '✓ PASS' : '✗ FAIL'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monte Carlo Results */}
      <div className="bg-base-200 border border-base-300 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-base-content mb-4 flex items-center gap-2">
          <span>🎲</span> Monte Carlo Stress Test
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-base-300 p-4 rounded border border-base-300">
            <div className="text-xs text-base-content/50 mb-1">P95 Drawdown</div>
            <div className={`text-xl font-bold ${mc.p95_drawdown < 0.35 ? 'text-success' : 'text-error'}`}>
              {(mc.p95_drawdown * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-base-300 p-4 rounded border border-base-300">
            <div className="text-xs text-base-content/50 mb-1">P5 Drawdown</div>
            <div className="text-xl font-bold text-primary">
              {(mc.p5_drawdown * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-base-300 p-4 rounded border border-base-300">
            <div className="text-xs text-base-content/50 mb-1">Median Return</div>
            <div className={`text-xl font-bold ${mc.median_final_return > 0 ? 'text-success' : 'text-error'}`}>
              {(mc.median_final_return * 100).toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="text-xs text-base-content/40 mt-3 p-3 bg-black/10 rounded">
          {mc.simulations} Monte Carlo shuffles run • {mc.passed ? '✓ Passed' : '✗ Failed'} stress test
        </div>
      </div>

      {/* Run Information */}
      <div className="bg-base-200 border border-base-300 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-base-content mb-4">Run Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-base-content/50">Strategy</div>
            <div className="text-base-content font-mono">{run.strategy}</div>
          </div>
          <div>
            <div className="text-base-content/50">Timeframe</div>
            <div className="text-base-content font-mono">{run.timeframe}</div>
          </div>
          <div>
            <div className="text-base-content/50">Exchange</div>
            <div className="text-base-content font-mono">{run.exchange}</div>
          </div>
          <div>
            <div className="text-base-content/50">Run ID</div>
            <div className="text-base-content font-mono text-xs">{run.run_id.slice(0, 12)}...</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
