import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { fetchStrategies, createRun } from '../lib/api'
import type { CreateRunRequest } from '../lib/autoquant.types'

const createRunSchema = z.object({
  strategy: z.string().min(1, 'Strategy is required'),
  timerange_start: z.string().min(1, 'Start date is required'),
  timerange_end: z.string().min(1, 'End date is required'),
  hyperopt_spaces: z.object({
    buy: z.boolean(),
    sell: z.boolean(),
    roi: z.boolean(),
    stoploss: z.boolean(),
    trailing: z.boolean(),
  }),
  risk_profile: z.string().min(1, 'Risk profile is required'),
  pair_universe: z.array(z.string()).min(1, 'At least one pair is required'),
  epochs: z.number().optional(),
  jobs: z.number().optional(),
  timeframe: z.string().optional(),
  min_trades: z.number().optional(),
  spaces_order: z.array(z.string()).optional(),
  // Additional AutoQuant options
  out_of_sample_pct: z.number().optional(),
  ensemble_size: z.number().optional(),
  position_stacking: z.boolean().optional(),
  enable_protections: z.boolean().optional(),
})

export const Route = createFileRoute('/runs/new')({
  component: NewRunForm,
})

function NewRunForm() {
  const navigate = useNavigate()
  const { data: strategies, isLoading: strategiesLoading, error: strategiesError } = useQuery({
    queryKey: ['strategies'],
    queryFn: fetchStrategies,
  })

  console.log('Strategies data:', strategies)

  const createRunMutation = useMutation({
    mutationFn: (data: CreateRunRequest) => createRun(data),
    onSuccess: (run) => {
      navigate({ to: `/runs/${run.id}` })
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data = createRunSchema.parse({
      strategy: formData.get('strategy') as string,
      timerange_start: formData.get('timerange_start') as string,
      timerange_end: formData.get('timerange_end') as string,
      hyperopt_spaces: {
        buy: formData.get('buy') === 'on',
        sell: formData.get('sell') === 'on',
        roi: formData.get('roi') === 'on',
        stoploss: formData.get('stoploss') === 'on',
        trailing: formData.get('trailing') === 'on',
      },
      risk_profile: formData.get('risk_profile') as string,
      pair_universe: (formData.get('pair_universe') as string).split(',').map(p => p.trim()),
      epochs: formData.get('epochs') ? Number(formData.get('epochs')) : undefined,
      jobs: formData.get('jobs') ? Number(formData.get('jobs')) : undefined,
      timeframe: formData.get('timeframe') as string || undefined,
      min_trades: formData.get('min_trades') ? Number(formData.get('min_trades')) : undefined,
      out_of_sample_pct: formData.get('out_of_sample_pct') ? Number(formData.get('out_of_sample_pct')) : undefined,
      ensemble_size: formData.get('ensemble_size') ? Number(formData.get('ensemble_size')) : undefined,
      position_stacking: formData.get('position_stacking') === 'on',
      enable_protections: formData.get('enable_protections') === 'on',
    })
    createRunMutation.mutate(data)
  }

  if (strategiesLoading) {
    return <div className="text-text-muted">Loading strategies...</div>
  }

  if (strategiesError) {
    return <div className="text-destructive">Error loading strategies: {strategiesError.message}</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold neon-glow-primary">New AutoQuant Run</h1>
        <p className="text-text-muted mt-1">Configure a new optimization run</p>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Strategy</label>
          <select
            name="strategy"
            required
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="">Select a strategy</option>
            {strategies?.map((strategy, index) => {
              const displayName = strategy.name || strategy.description || `Strategy ${index + 1}`;
              const value = strategy.name || strategy.description || String(index);
              return (
                <option key={value} value={value}>
                  {displayName}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Time Range</label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                const end = new Date()
                const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
                document.querySelector<HTMLInputElement>('input[name="timerange_start"]')!.value = start.toISOString().split('T')[0]
                document.querySelector<HTMLInputElement>('input[name="timerange_end"]')!.value = end.toISOString().split('T')[0]
              }}
              className="px-3 py-1 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => {
                const end = new Date()
                const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000)
                document.querySelector<HTMLInputElement>('input[name="timerange_start"]')!.value = start.toISOString().split('T')[0]
                document.querySelector<HTMLInputElement>('input[name="timerange_end"]')!.value = end.toISOString().split('T')[0]
              }}
              className="px-3 py-1 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              1 Year
            </button>
            <button
              type="button"
              onClick={() => {
                const end = new Date()
                const start = new Date(end.getTime() - 2 * 365 * 24 * 60 * 60 * 1000)
                document.querySelector<HTMLInputElement>('input[name="timerange_start"]')!.value = start.toISOString().split('T')[0]
                document.querySelector<HTMLInputElement>('input[name="timerange_end"]')!.value = end.toISOString().split('T')[0]
              }}
              className="px-3 py-1 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              2 Years
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input
                type="date"
                name="timerange_start"
                required
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <input
                type="date"
                name="timerange_end"
                required
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Hyperopt Spaces</label>
          <div className="grid grid-cols-5 gap-4">
            {['buy', 'sell', 'roi', 'stoploss', 'trailing'].map((space) => (
              <label key={space} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name={space}
                  defaultChecked
                  className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
                />
                <span className="text-sm capitalize">{space}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Risk Profile</label>
          <select
            name="risk_profile"
            required
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          >
            <option key="conservative" value="conservative">Conservative</option>
            <option key="moderate" value="moderate">Moderate</option>
            <option key="aggressive" value="aggressive">Aggressive</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Pair Universe (comma-separated)</label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                const defaultPairs = [
                  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
                  'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
                  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'BCH/USDT',
                  'XLM/USDT', 'ALGO/USDT', 'VET/USDT', 'FIL/USDT', 'ICP/USDT',
                  'NEAR/USDT', 'APE/USDT', 'SAND/USDT', 'MANA/USDT', 'AXS/USDT',
                  'AAVE/USDT', 'MKR/USDT', 'COMP/USDT', 'YFI/USDT', 'SNX/USDT',
                  'CRV/USDT', 'SUSHI/USDT', '1INCH/USDT', 'ZRX/USDT', 'ENJ/USDT',
                  'GALA/USDT', 'IMX/USDT', 'SAND/USDT', 'CHZ/USDT', 'FLOW/USDT',
                  'ROSE/USDT', 'CELO/USDT', 'HBAR/USDT', 'ALPHA/USDT', 'FTM/USDT',
                  'GLM/USDT', 'BAT/USDT', 'KNC/USDT', 'RLC/USDT', 'LRC/USDT',
                  'STX/USDT', 'WAVES/USDT', 'NEXO/USDT', 'KAVA/USDT', 'THETA/USDT'
                ];
                document.querySelector<HTMLInputElement>('input[name="pair_universe"]')!.value = defaultPairs.join(', ');
              }}
              className="px-3 py-1 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Load Default 50
            </button>
          </div>
          <input
            type="text"
            name="pair_universe"
            placeholder="BTC/USDT, ETH/USDT, SOL/USDT"
            required
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
          />
        </div>

        <details className="glass rounded-lg">
          <summary className="px-4 py-3 cursor-pointer font-medium">Advanced Options</summary>
          <div className="px-4 pb-4 space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Epochs</label>
                <input
                  type="number"
                  name="epochs"
                  defaultValue={100}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Jobs</label>
                <input
                  type="number"
                  name="jobs"
                  defaultValue={-1}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Timeframe</label>
                <input
                  type="text"
                  name="timeframe"
                  placeholder="5m"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Min Trades</label>
                <input
                  type="number"
                  name="min_trades"
                  defaultValue={10}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Out of Sample %</label>
                <input
                  type="number"
                  name="out_of_sample_pct"
                  placeholder="20"
                  min="0"
                  max="50"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Ensemble Size</label>
                <input
                  type="number"
                  name="ensemble_size"
                  placeholder="5"
                  min="1"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="position_stacking"
                  className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
                />
                <span className="text-sm">Position Stacking</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="enable_protections"
                  defaultChecked
                  className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
                />
                <span className="text-sm">Enable Protections</span>
              </label>
            </div>
          </div>
        </details>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: '/' })}
            className="px-4 py-2 rounded-lg border border-border text-text hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createRunMutation.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-background font-medium hover:bg-primary-dim transition-colors neon-ring-primary disabled:opacity-50"
          >
            {createRunMutation.isPending ? 'Creating...' : 'Create Run'}
          </button>
        </div>
      </form>
    </div>
  )
}
