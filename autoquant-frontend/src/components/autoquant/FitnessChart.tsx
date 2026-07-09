import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { FitnessPoint } from '../../lib/autoquant.types'

interface FitnessChartProps {
  data: FitnessPoint[]
}

export default function FitnessChart({ data }: FitnessChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-text-muted text-sm">
        No fitness data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis 
          dataKey="epoch" 
          stroke="var(--color-text-muted)"
          fontSize={12}
        />
        <YAxis 
          stroke="var(--color-text-muted)"
          fontSize={12}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
          }}
          itemStyle={{ color: 'var(--color-text)' }}
        />
        <Line 
          type="monotone" 
          dataKey="objective" 
          stroke="var(--color-primary)" 
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
