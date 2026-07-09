import { createFileRoute } from '@tanstack/react-router'
import { useRunStore } from '../lib/runStore'
import { formatPercent, formatNumber } from '../lib/format'
import EquityChart from '../components/autoquant/EquityChart'
import TradeDistribution from '../components/autoquant/TradeDistribution'
import WFOTable from '../components/autoquant/WFOTable'
import DownloadButtons from '../components/autoquant/DownloadButtons'

export const Route = createFileRoute('/runs/$runId/results')({
  component: Results,
})

function Results() {
  const { results } = useRunStore()

  if (!results) {
    return (
      <div className="glass rounded-lg p-8 text-center">
        <div className="text-text-muted">Results not yet available</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Profit" value={formatPercent(results.total_profit)} />
        <MetricCard label="Sharpe Ratio" value={formatNumber(results.sharpe_ratio)} />
        <MetricCard label="Sortino Ratio" value={formatNumber(results.sortino_ratio)} />
        <MetricCard label="Max Drawdown" value={formatPercent(results.max_drawdown)} />
        <MetricCard label="Win Rate" value={formatPercent(results.win_rate)} />
        <MetricCard label="Expectancy" value={formatNumber(results.expectancy)} />
      </div>

      {results.equity_curve && (
        <div className="glass rounded-lg p-6">
          <h3 className="text-sm font-semibold mb-4">Equity Curve</h3>
          <EquityChart data={results.equity_curve} />
        </div>
      )}

      {results.trade_distribution && (
        <div className="glass rounded-lg p-6">
          <h3 className="text-sm font-semibold mb-4">Trade P&L Distribution</h3>
          <TradeDistribution data={results.trade_distribution} />
        </div>
      )}

      {results.wfo_windows && results.wfo_windows.length > 0 && (
        <div className="glass rounded-lg p-6">
          <h3 className="text-sm font-semibold mb-4">Walk-Forward Optimization Windows</h3>
          <WFOTable windows={results.wfo_windows} />
        </div>
      )}

      <div className="glass rounded-lg p-6">
        <h3 className="text-sm font-semibold mb-4">Downloads</h3>
        <DownloadButtons />
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-lg p-4">
      <div className="text-[10px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold font-mono mt-1">{value}</div>
    </div>
  )
}
