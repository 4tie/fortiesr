import type { PairMetrics } from '../../lib/autoquant.types'
import { formatPercent, formatNumber } from '../../lib/format'

interface PairTableProps {
  pairs: PairMetrics[]
  selectedPairs: Set<string>
  onTogglePair: (pairKey: string) => void
}

export default function PairTable({ pairs, selectedPairs, onTogglePair }: PairTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left font-semibold text-text-muted">
              <input
                type="checkbox"
                checked={selectedPairs.size === pairs.length && pairs.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    pairs.forEach(p => onTogglePair(p.key))
                  } else {
                    selectedPairs.forEach(key => onTogglePair(key))
                  }
                }}
                className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
              />
            </th>
            <th className="px-4 py-2 text-left font-semibold text-text-muted">Pair</th>
            <th className="px-4 py-2 text-right font-semibold text-text-muted">Profit</th>
            <th className="px-4 py-2 text-right font-semibold text-text-muted">Win Rate</th>
            <th className="px-4 py-2 text-right font-semibold text-text-muted">Profit Factor</th>
            <th className="px-4 py-2 text-right font-semibold text-text-muted">Max DD</th>
            <th className="px-4 py-2 text-right font-semibold text-text-muted">Trades</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair) => {
            const isSelected = selectedPairs.has(pair.key)
            return (
              <tr
                key={pair.key}
                className={`border-b border-border hover:bg-surface-hover transition-colors ${
                  isSelected ? 'bg-primary/5' : ''
                }`}
              >
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onTogglePair(pair.key)}
                    className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
                  />
                </td>
                <td className="px-4 py-2 font-mono">{pair.key}</td>
                <td className={`px-4 py-2 text-right font-mono ${pair.profit_total >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatPercent(pair.profit_total)}
                </td>
                <td className="px-4 py-2 text-right font-mono">{formatPercent(pair.win_rate)}</td>
                <td className="px-4 py-2 text-right font-mono">{formatNumber(pair.profit_factor)}</td>
                <td className="px-4 py-2 text-right font-mono text-destructive">
                  {formatPercent(pair.max_drawdown)}
                </td>
                <td className="px-4 py-2 text-right font-mono">{pair.trades}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
