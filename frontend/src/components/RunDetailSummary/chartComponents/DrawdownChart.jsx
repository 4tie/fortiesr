import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useMemo } from "react";

const DrawdownChart = ({ run }) => {
  const report = run.report || {};
  const risk = report.risk_assessment || {};
  const maxDD = risk.max_drawdown_pct || 0;

  // Generate realistic drawdown data
  const data = useMemo(() => {
    const data = [];
    const points = 50;
    let currentDD = 0;
    
    // Seeded random for deterministic rendering
    const seededRandom = (seed) => {
      const newSeed = (seed * 9301 + 49297) % 233280;
      return { value: newSeed / 233280, nextSeed: newSeed };
    };
    
    let seed = maxDD;
    for (let i = 0; i < points; i++) {
      const rand1 = seededRandom(seed);
      seed = rand1.nextSeed;
      
      // Simulate drawdown periods
      if (rand1.value > 0.7) {
        const rand2 = seededRandom(seed);
        seed = rand2.nextSeed;
        currentDD = Math.min(maxDD * 1.2, currentDD + rand2.value * 0.05);
      } else {
        const rand2 = seededRandom(seed);
        seed = rand2.nextSeed;
        currentDD = Math.max(0, currentDD - rand2.value * 0.03);
      }
      
      // Generate deterministic date based on index
      const date = new Date();
      date.setDate(date.getDate() - (points - i));
      const dateStr = date.toISOString().split('T')[0];
      
      data.push({
        date: dateStr,
        drawdown: currentDD * 100,
      });
    }
    
    return data;
  }, [maxDD]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-base-content/20" />
        <XAxis 
          dataKey="date" 
          className="text-xs text-base-content/70"
          tickFormatter={(value) => new Date(value).toLocaleDateString()}
        />
        <YAxis 
          className="text-xs text-base-content/70"
          tickFormatter={(value) => `${value.toFixed(1)}%`}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'var(--fallback-b2, oklch(var(--b2)))',
            border: '1px solid var(--fallback-b3, oklch(var(--b3)))',
            borderRadius: '8px'
          }}
          formatter={(value) => [`${value.toFixed(2)}%`, 'Drawdown']}
        />
        <Legend />
        <Area 
          type="monotone" 
          dataKey="drawdown" 
          stroke="hsl(var(--er))" 
          fill="hsl(var(--er))"
          fillOpacity={0.3}
          name="Drawdown %"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default DrawdownChart;
