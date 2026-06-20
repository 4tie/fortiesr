/**
 * StrategyDetailsPage - Detailed strategy view
 * Displays metrics, charts, validation results, and AI summary
 */

import React from 'react';
import { useParams } from 'react-router-dom';

export default function StrategyDetailsPage() {
  const { strategyId } = useParams();

  // Mock data - in real implementation, would fetch from API
  const strategy = {
    id: strategyId,
    name: 'RSI Scalper #1',
    timeframe: '5m',
    pairs: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'],
    status: 'elite',
    tier: 'elite',
    score: 87.5,
    metrics: {
      profitFactor: 1.85,
      drawdown: 18.5,
      expectancy: 0.0012,
      trades: 847,
      winRate: 54.2,
      sharpeRatio: 2.1,
      sortinoRatio: 2.8,
    },
    validationResults: {
      discovery: { passed: true, metrics: {} },
      validation: { passed: true, metrics: {} },
      elite_validation: { passed: true, metrics: {} },
    },
    walkForwardResults: {
      passRate: 75,
      avgDegradation: 22,
      windows: [
        { windowId: '1', trainProfit: 1200, testProfit: 950, degradation: 20.8, passed: true },
        { windowId: '2', trainProfit: 980, testProfit: 820, degradation: 16.3, passed: true },
        { windowId: '3', trainProfit: 1100, testProfit: 780, degradation: 29.1, passed: true },
        { windowId: '4', trainProfit: 850, testProfit: 720, degradation: 15.3, passed: true },
      ],
    },
    robustnessResults: {
      robustnessScore: 0.78,
      parameterStability: 0.82,
      slippageTolerance: 0.75,
      spreadTolerance: 0.80,
      volatilityTolerance: 0.72,
      recommendation: 'Moderately Robust - Suitable for testing',
    },
    pairResults: [
      { pair: 'BTC/USDT', profitFactor: 1.92, drawdown: 15.2, passed: true },
      { pair: 'ETH/USDT', profitFactor: 1.78, drawdown: 20.1, passed: true },
      { pair: 'BNB/USDT', profitFactor: 1.65, drawdown: 22.8, passed: true },
    ],
    aiExplanation: 'This scalping strategy demonstrates strong performance characteristics with a profit factor of 1.85 and controlled drawdown of 18.5%. The walk-forward analysis shows good consistency across different time periods with 75% of windows passing. Robustness testing confirms the strategy handles market perturbations well.',
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{strategy.name}</h1>
        <div className={`badge badge-lg ${strategy.tier === 'elite' ? 'badge-warning' : 'badge-neutral'}`}>
          {strategy.tier.toUpperCase()}
        </div>
      </div>

      {/* Score Card */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Score Card</h2>
          <div className="text-5xl font-bold text-primary mb-4">{strategy.score.toFixed(1)}/100</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat">
              <div className="stat-title">Expectancy</div>
              <div className="stat-value text-sm">{strategy.metrics.expectancy.toFixed(6)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Profit Factor</div>
              <div className="stat-value text-sm">{strategy.metrics.profitFactor.toFixed(2)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Drawdown</div>
              <div className="stat-value text-sm">{strategy.metrics.drawdown.toFixed(2)}%</div>
            </div>
            <div className="stat">
              <div className="stat-title">Win Rate</div>
              <div className="stat-value text-sm">{strategy.metrics.winRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Key Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat">
              <div className="stat-title">Total Trades</div>
              <div className="stat-value">{strategy.metrics.trades}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Sharpe Ratio</div>
              <div className="stat-value">{strategy.metrics.sharpeRatio.toFixed(2)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Sortino Ratio</div>
              <div className="stat-value">{strategy.metrics.sortinoRatio.toFixed(2)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Timeframe</div>
              <div className="stat-value">{strategy.timeframe}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Results */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Validation Results</h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span>Discovery</span>
              <span className="badge badge-success">PASSED</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Validation</span>
              <span className="badge badge-success">PASSED</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Elite Validation</span>
              <span className="badge badge-success">PASSED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Walk Forward Results */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Walk Forward Analysis</h2>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span>Pass Rate</span>
              <span className="font-bold">{strategy.walkForwardResults.passRate}%</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Average Degradation</span>
              <span className="font-bold">{strategy.walkForwardResults.avgDegradation}%</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Window</th>
                  <th>Train Profit</th>
                  <th>Test Profit</th>
                  <th>Degradation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {strategy.walkForwardResults.windows.map((window) => (
                  <tr key={window.windowId}>
                    <td>{window.windowId}</td>
                    <td>${window.trainProfit}</td>
                    <td>${window.testProfit}</td>
                    <td>{window.degradation.toFixed(1)}%</td>
                    <td>
                      <span className={`badge ${window.passed ? 'badge-success' : 'badge-error'}`}>
                        {window.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Robustness Results */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Robustness Testing</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="stat">
              <div className="stat-title">Overall Score</div>
              <div className="stat-value">{(strategy.robustnessResults.robustnessScore * 100).toFixed(0)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Parameter Stability</div>
              <div className="stat-value">{(strategy.robustnessResults.parameterStability * 100).toFixed(0)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Slippage Tolerance</div>
              <div className="stat-value">{(strategy.robustnessResults.slippageTolerance * 100).toFixed(0)}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Volatility Tolerance</div>
              <div className="stat-value">{(strategy.robustnessResults.volatilityTolerance * 100).toFixed(0)}</div>
            </div>
          </div>
          <div className="alert alert-info">
            <span>{strategy.robustnessResults.recommendation}</span>
          </div>
        </div>
      </div>

      {/* Pair Breakdown */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Pair Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Pair</th>
                  <th>Profit Factor</th>
                  <th>Drawdown</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {strategy.pairResults.map((result) => (
                  <tr key={result.pair}>
                    <td>{result.pair}</td>
                    <td>{result.profitFactor.toFixed(2)}</td>
                    <td>{result.drawdown.toFixed(2)}%</td>
                    <td>
                      <span className={`badge ${result.passed ? 'badge-success' : 'badge-error'}`}>
                        {result.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI Explanation */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">AI Analysis</h2>
          <p className="text-lg">{strategy.aiExplanation}</p>
          <div className="alert alert-success mt-4">
            <span className="font-bold">Recommendation: READY FOR DRY-RUN TESTING</span>
          </div>
        </div>
      </div>
    </div>
  );
}
