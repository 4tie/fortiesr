import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchRuns } from '../lib/api'
import { formatRelativeTime } from '../lib/format'
import type { Run } from '../lib/autoquant.types'

export const Route = createFileRoute('/')({
  component: RunsList,
})

function RunsList() {
  const { data: runs, isLoading, error } = useQuery({
    queryKey: ['runs'],
    queryFn: fetchRuns,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted">Loading runs...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Error loading runs: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold neon-glow-primary">AutoQuant Runs</h1>
          <p className="text-text-muted mt-1">Manage and monitor your optimization runs</p>
        </div>
        <Link
          to="/runs/new"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors neon-ring-primary"
        >
          New Run
        </Link>
      </div>

      {!runs || !Array.isArray(runs) || runs.length === 0 ? (
        <div className="glass rounded-lg p-8 text-center">
          <div className="text-text-muted mb-4">No runs yet</div>
          <Link
            to="/runs/new"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors neon-ring-primary"
          >
            Create your first run
          </Link>
        </div>
      ) : (
        <div className="glass rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Strategy
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run: Run) => (
                <tr key={run.id} className="border-b border-border hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono text-sm">{run.strategy}</div>
                  </td>
                  <td className="px-4 py-3">
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    Stage {run.current_stage}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {formatRelativeTime(run.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/runs/${run.id}`}
                      className="text-sm text-primary hover:text-primary-dim transition-colors"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RunStatusBadge({ status }: { status: Run['status'] }) {
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
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
