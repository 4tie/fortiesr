import { formatPercent, formatNumber } from '../../lib/format'

interface WFOWindow {
  window: string
  profit: number
  trades: number
  sharpe: number
}

interface WFOTableProps {
  windows: WFOWindow[]
}

export default function WFOTable({ windows }: WFOTableProps) {
  if (!windows || windows.length === 0) {
    return (
      <div className="text-center text-text-muted py-8">
        No WFO windows data available
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left font-semibold text-text-muted">Window</th>
            <th className="px-4 py-2 text-right font-semibold text-text-muted">Profit</th>
            <th className="px-4 py-2 text-right font-semibold text-text-muted">Trades</th>
            <th className="px-4 py-2 text-right font-semibold text-text-muted">Sharpe</th>
          </tr>
        </thead>
        <tbody>
          {windows.map((wfo, index) => (
            <tr key={index} className="border-b border-border hover:bg-surface-hover transition-colors">
              <td className="px-4 py-2 font-mono">{wfo.window}</td>
              <td className={`px-4 py-2 text-right font-mono ${wfo.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatPercent(wfo.profit)}
              </td>
              <td className="px-4 py-2 text-right font-mono">{wfo.trades}</td>
              <td className="px-4 py-2 text-right font-mono">{formatNumber(wfo.sharpe)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
