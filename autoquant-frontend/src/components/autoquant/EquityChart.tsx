import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface EquityChartProps {
  data: Array<{ timestamp: string; value: number }>
}

export default function EquityChart({ data }: EquityChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-text-muted text-sm">
        No equity data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis 
          dataKey="timestamp" 
          stroke="var(--color-text-muted)"
          fontSize={12}
          tickFormatter={(value) => new Date(value).toLocaleDateString()}
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
          labelFormatter={(value) => new Date(value).toLocaleString()}
        />
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke="var(--color-primary)" 
          fill="var(--color-primary)"
          fillOpacity={0.3}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
