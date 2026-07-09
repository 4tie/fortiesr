import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TradeDistributionProps {
  data: Array<{ bin: string; count: number }>
}

export default function TradeDistribution({ data }: TradeDistributionProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-text-muted text-sm">
        No trade distribution data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis 
          dataKey="bin" 
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
        <Bar 
          dataKey="count" 
          fill="var(--color-primary)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
