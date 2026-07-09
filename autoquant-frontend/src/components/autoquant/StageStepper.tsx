import type { Stage, RunStatus } from '../../lib/autoquant.types'

const STAGES = [
  { index: 0, name: 'preflight_filtering', label: 'Pre-flight' },
  { index: 1, name: 'portfolio_baseline', label: 'Portfolio Baseline' },
  { index: 2, name: 'hyperopt', label: 'Hyperopt' },
  { index: 3, name: 'candidate_backtest', label: 'Candidate Backtest' },
  { index: 4, name: 'stress_test', label: 'Stress Test' },
  { index: 5, name: 'temporal_stress', label: 'Temporal Stress' },
]

interface StageStepperProps {
  currentStage: Stage | null
  status: RunStatus
}

export default function StageStepper({ currentStage, status }: StageStepperProps) {
  const getStageState = (index: number) => {
    if (!currentStage) return 'pending'
    if (index < currentStage.index) return 'completed'
    if (index === currentStage.index) return status === 'running' ? 'running' : status
    return 'pending'
  }

  return (
    <div className="glass rounded-lg p-6">
      <div className="flex items-center justify-between">
        {STAGES.map((stage, index) => {
          const state = getStageState(index)
          const isLast = index === STAGES.length - 1

          return (
            <div key={stage.name} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    state === 'completed'
                      ? 'bg-success/20 text-success neon-ring-success'
                      : state === 'running'
                      ? 'bg-primary/20 text-primary animate-pulse-neon neon-ring-primary'
                      : state === 'failed'
                      ? 'bg-destructive/20 text-destructive neon-ring-destructive'
                      : state === 'awaiting_user_approval'
                      ? 'bg-accent/20 text-accent neon-ring-accent'
                      : 'bg-text-muted/20 text-text-muted'
                  }`}
                >
                  {state === 'completed' ? '✓' : index + 1}
                </div>
                <div className="text-xs mt-2 text-center max-w-[100px]">
                  {stage.label}
                </div>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-all ${
                    state === 'completed' ? 'bg-success' : 'bg-border'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
