import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { useRunStore } from '../lib/runStore'
import { formatPercent } from '../lib/format'
import { fetchRun } from '../lib/api'
import PairTable from '../components/autoquant/PairTable'
import type { PairMetrics } from '../lib/autoquant.types'

export const Route = createFileRoute('/runs/$runId/pairs')({
  component: PairSelection,
})

function PairSelection() {
  const { runId } = Route.useParams()
  
  if (!runId) {
    return <div className="text-text-muted">Invalid run ID</div>
  }
  
  const { pairs: storePairs } = useRunStore()
  const { data: run } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => fetchRun(runId),
    enabled: !!runId,
  })
  
  // Get pairs from API response or store
  const rawPairs = run?.all_pairs || run?.selected_pairs || run?.user_approved_pairs || run?.discovery_results?.recommended_pairs || storePairs || []
  
  // Convert string pairs to PairMetrics format if needed
  const pairs: PairMetrics[] = React.useMemo(() => {
    if (!Array.isArray(rawPairs) || rawPairs.length === 0) {
      return []
    }
    
    // Check if first element is a string (pair key) or PairMetrics object
    const firstItem = rawPairs[0]
    if (typeof firstItem === 'string') {
      // Convert string array to PairMetrics
      return (rawPairs as string[]).map((pairKey: string) => ({
        key: pairKey,
        profit_total: 0,
        profit_total_abs: 0,
        max_drawdown: 0,
        win_rate: 0,
        profit_factor: 0,
        trades: 0,
      }))
    }
    // Already PairMetrics format
    return rawPairs as PairMetrics[]
  }, [rawPairs])
  
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
