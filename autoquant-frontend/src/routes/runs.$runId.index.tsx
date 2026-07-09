import { createFileRoute } from '@tanstack/react-router'
import { useRunStore } from '../lib/runStore'
import { formatDuration } from '../lib/format'
import StageStepper from '../components/autoquant/StageStepper'
import LogTerminal from '../components/autoquant/LogTerminal'
import FitnessChart from '../components/autoquant/FitnessChart'

export const Route = createFileRoute('/runs/$runId/')({
  component: PipelineDashboard,
})

function PipelineDashboard() {
  const { logs, fitness, currentStage, status, progress, etaSeconds } = useRunStore()

  return (
    <div className="space-y-6">
      <StageStepper currentStage={currentStage} status={status} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-lg p-6">
            <h3 className="text-sm font-semibold mb-4">Fitness Curve</h3>
            <FitnessChart data={fitness} />
          </div>

          <div className="glass rounded-lg p-6">
            <LogTerminal logs={logs} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-lg p-6">
            <h3 className="text-sm font-semibold mb-4">Progress</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-muted">Overall Progress</span>
                  <span className="font-mono">{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {etaSeconds && (
                <div className="text-sm">
                  <span className="text-text-muted">ETA: </span>
                  <span className="font-mono">{formatDuration(etaSeconds)}</span>
                </div>
              )}

              <div className="text-sm">
                <span className="text-text-muted">Status: </span>
                <span className="font-medium capitalize">{status.replace(/_/g, ' ')}</span>
              </div>

              {currentStage && (
                <div className="text-sm">
                  <span className="text-text-muted">Current Stage: </span>
                  <span className="font-medium capitalize">{currentStage.name.replace(/_/g, ' ')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="glass rounded-lg p-6">
            <h3 className="text-sm font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                Pause Run
              </button>
              <button className="w-full px-4 py-2 text-sm rounded-lg bg-warning/10 text-warning hover:bg-warning/20 transition-colors">
                Cancel Run
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
