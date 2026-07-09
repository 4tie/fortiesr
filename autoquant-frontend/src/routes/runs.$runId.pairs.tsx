import { createFileRoute } from '@tanstack/react-router'
import { useRunStore } from '../lib/runStore'
import { formatPercent } from '../lib/format'
import PairTable from '../components/autoquant/PairTable'

export const Route = createFileRoute('/runs/$runId/pairs')({
  component: PairSelection,
})

function PairSelection() {
  const { pairs } = useRunStore()
  const [selectedPairs, setSelectedPairs] = React.useState<Set<string>>(new Set())

  const togglePair = (pairKey: string) => {
    setSelectedPairs(prev => {
      const next = new Set(prev)
      if (next.has(pairKey)) {
        next.delete(pairKey)
      } else {
        next.add(pairKey)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedPairs(new Set(pairs.map(p => p.key)))
  }

  const selectNone = () => {
    setSelectedPairs(new Set())
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pair Selection</h2>
          <p className="text-text-muted text-sm">Select pairs to include in the optimization</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            className="px-3 py-1.5 text-sm rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            Select None
          </button>
        </div>
      </div>

      <div className="glass rounded-lg p-6">
        <div className="mb-4 text-sm text-text-muted">
          {selectedPairs.size} of {pairs.length} pairs selected
        </div>
        <PairTable
          pairs={pairs}
          selectedPairs={selectedPairs}
          onTogglePair={togglePair}
        />
      </div>

      {selectedPairs.size > 0 && (
        <div className="flex justify-end">
          <button className="px-4 py-2 rounded-lg bg-primary text-background font-medium hover:bg-primary-dim transition-colors neon-ring-primary">
            Approve {selectedPairs.size} Pairs
          </button>
        </div>
      )}
    </div>
  )
}
