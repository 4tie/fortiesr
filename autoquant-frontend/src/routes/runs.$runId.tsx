import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchRun } from '../lib/api'
import { useAutoQuantSocket } from '../lib/useAutoQuantSocket'
import { useRunStore } from '../lib/runStore'
import type { WSMessage } from '../lib/autoquant.types'

export const Route = createFileRoute('/runs/$runId')({
  component: RunLayout,
})

function RunLayout() {
  const { runId } = Route.useParams()
  
  console.log('RunLayout runId:', runId)
  
  if (!runId || runId === 'undefined') {
    return <div className="text-text-muted">Invalid run ID</div>
  }
  
  const { data: run, isLoading, error } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => fetchRun(runId),
    enabled: !!runId && runId !== 'undefined',
  })

  if (isLoading) {
    return <div className="text-text-muted">Loading run...</div>
  }

  if (error) {
    return <div className="text-destructive">Error loading run: {error.message}</div>
  }
  
  const addLog = useRunStore(state => state.addLog)
  const addFitnessPoint = useRunStore(state => state.addFitnessPoint)
  const setCurrentStage = useRunStore(state => state.setCurrentStage)
  const setPairs = useRunStore(state => state.setPairs)
  const setResults = useRunStore(state => state.setResults)
  const setStatus = useRunStore(state => state.setStatus)
  const setProgress = useRunStore(state => state.setProgress)
  const setEtaSeconds = useRunStore(state => state.setEtaSeconds)

  useAutoQuantSocket({
    runId,
    onMessage: (message: WSMessage) => {
      switch (message.type) {
        case 'status':
          setStatus(message.data.status)
          setProgress(message.data.progress)
          setEtaSeconds(message.data.eta_seconds)
          break
        case 'log':
          addLog(message.data)
          break
        case 'fitness':
          addFitnessPoint(message.data)
          break
        case 'stage':
          setCurrentStage(message.data)
          break
        case 'pairs_ready':
          setPairs(message.data.per_pair)
          break
        case 'results_ready':
          setResults(message.data)
          break
        case 'error':
          console.error('WebSocket error:', message.data)
          break
      }
    },
  })

  if (!run) {
    return <div className="text-text-muted">Loading run...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-text-muted hover:text-primary transition-colors">
            ← Back to runs
          </Link>
          <h1 className="text-2xl font-bold neon-glow-primary mt-2">{run.strategy}</h1>
          <p className="text-text-muted mt-1">Run ID: {run.id}</p>
        </div>
        <RunStatusBadge status={run.status} />
      </div>

      <div className="glass rounded-lg">
        <nav className="flex border-b border-border">
          <Link
            to="/runs/$runId"
            params={{ runId }}
            className="px-4 py-3 text-sm font-medium border-b-2 border-transparent hover:border-border transition-colors"
            activeProps={{ className: 'border-primary text-primary' }}
          >
            Dashboard
          </Link>
          <Link
            to="/runs/$runId/pairs"
            params={{ runId }}
            className="px-4 py-3 text-sm font-medium border-b-2 border-transparent hover:border-border transition-colors"
            activeProps={{ className: 'border-primary text-primary' }}
          >
            Pairs
          </Link>
          <Link
            to="/runs/$runId/results"
            params={{ runId }}
            className="px-4 py-3 text-sm font-medium border-b-2 border-transparent hover:border-border transition-colors"
            activeProps={{ className: 'border-primary text-primary' }}
          >
            Results
          </Link>
          <Link
            to="/runs/$runId/chat"
            params={{ runId }}
            className="px-4 py-3 text-sm font-medium border-b-2 border-transparent hover:border-border transition-colors"
            activeProps={{ className: 'border-primary text-primary' }}
          >
            AI Chat
          </Link>
        </nav>
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

function RunStatusBadge({ status }: { status: string }) {
  const colors = {
    pending: 'bg-text-muted/20 text-text-muted',
    running: 'bg-primary/20 text-primary animate-pulse-neon',
    paused: 'bg-warning/20 text-warning',
    completed: 'bg-success/20 text-success',
    failed: 'bg-destructive/20 text-destructive',
    cancelled: 'bg-text-muted/20 text-text-muted',
    awaiting_user_approval: 'bg-accent/20 text-accent',
    interrupted: 'bg-warning/20 text-warning',
  }

  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full ${colors[status as keyof typeof colors]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
