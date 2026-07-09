import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { Run } from '../../lib/autoquant.types'

interface RunProgressChartProps {
  runs: Run[]
}

export default function RunProgressChart({ runs }: RunProgressChartProps) {
  const data = runs.map((run, index) => ({
    name: run.strategy || `Run ${index + 1}`,
    progress: Math.min(100, Math.max(0, run.progress ?? 0)),
    status: run.status,
  }))

  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center text-text-muted text-sm">
        No run progress available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 42 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="name"
          stroke="var(--color-text-muted)"
          fontSize={12}
          tick={{ angle: -35, textAnchor: 'end' }}
          height={56}
        />
        <YAxis
          stroke="var(--color-text-muted)"
          fontSize={12}
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
          }}
          formatter={(value: number) => [`${value.toFixed(1)}%`, 'Progress']}
          labelFormatter={(label) => `${label}`}
        />
        <Bar dataKey="progress" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
