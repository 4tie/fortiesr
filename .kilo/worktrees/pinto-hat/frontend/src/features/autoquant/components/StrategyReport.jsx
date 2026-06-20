/**
 * StrategyReport Component
 * Displays comprehensive strategy report with all sections
 */

import React from 'react';
import EquityCurveChart from './EquityCurveChart';
import DrawdownChart from './DrawdownChart';
import MonthlyReturnsChart from './MonthlyReturnsChart';
import PairPerformanceChart from './PairPerformanceChart';
import WalkForwardChart from './WalkForwardChart';
import RobustnessRadarChart from './RobustnessRadarChart';
import ScoreCardChart from './ScoreCardChart';
import TradeDistributionChart from './TradeDistributionChart';
import TimeframeComparisonChart from './TimeframeComparisonChart';
import OOSRetentionChart from './OOSRetentionChart';
import ReportExport from './ReportExport';

export default function StrategyReport({ strategy, runId }) {
  return (
    <div className="space-y-6">
      {/* Score Card */}
      <ScoreCardChart data={strategy.scoreCard} />

      {/* Key Metrics */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Key Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat">
              <div className="stat-title">Profit Factor</div>
              <div className="stat-value">{strategy.metrics?.profitFactor?.toFixed(2) || '-'}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Drawdown</div>
              <div className="stat-value">{strategy.metrics?.drawdown?.toFixed(2) || '-'}%</div>
            </div>
            <div className="stat">
              <div className="stat-title">Expectancy</div>
              <div className="stat-value">{strategy.metrics?.expectancy?.toFixed(6) || '-'}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Win Rate</div>
              <div className="stat-value">{strategy.metrics?.winRate?.toFixed(1) || '-'}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <EquityCurveChart data={strategy.equityCurve} />
        <DrawdownChart data={strategy.drawdownCurve} />
        <MonthlyReturnsChart data={strategy.monthlyReturns} />
        <PairPerformanceChart data={strategy.pairResults} />
        <WalkForwardChart data={strategy.walkForwardResults?.windows} />
        <RobustnessRadarChart data={strategy.robustnessResults} />
        <ScoreCardChart data={strategy.scoreCard} />
        <TradeDistributionChart data={strategy.tradeDistribution} />
        <TimeframeComparisonChart data={strategy.timeframeResults} />
        <OOSRetentionChart data={strategy.oosResults} />
      </div>

      {/* AI Explanation */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">AI Analysis</h2>
          <p className="text-lg">{strategy.aiExplanation}</p>
        </div>
      </div>

      {/* Export */}
      <ReportExport runId={runId} strategyData={strategy} />
    </div>
  );
}
