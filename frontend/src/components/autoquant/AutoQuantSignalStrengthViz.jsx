export default function AutoQuantSignalStrengthViz({ weights }) {
  if (!weights || Object.keys(weights).length === 0) return null;

  const rsi  = parseFloat(weights.rsi_weight  ?? 0);
  const macd = parseFloat(weights.macd_weight ?? 0);
  const bb   = parseFloat(weights.bb_weight   ?? 0);
  const threshold = parseFloat(weights.consensus_threshold ?? 0.5);
  const total = rsi + macd + bb;

  const signals = [
    { label: "RSI Oversold",  key: "rsi",  weight: rsi,  color: "bg-blue-400" },
    { label: "MACD Cross",    key: "macd", weight: macd, color: "bg-violet-400" },
    { label: "BB Breakout",   key: "bb",   weight: bb,   color: "bg-amber-400" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
          Alpha Signal Composition
        </h4>
        <span className="badge badge-xs badge-outline">
          Threshold: {(threshold * 100).toFixed(0)}%
        </span>
      </div>

      <div className="space-y-2">
        {signals.map(({ label, key, weight, color }) => {
          const pct = total > 0 ? (weight / total) * 100 : 0;
          const isActive = weight > 0.01;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${isActive ? color : "bg-base-content/20"}`} />
                  <span className={isActive ? "text-base-content/80 font-medium" : "text-base-content/35 line-through"}>
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[10px] ${isActive ? "text-base-content/60" : "text-base-content/25"}`}>
                    w={weight.toFixed(2)}
                  </span>
                  <span className={`font-bold text-xs ${isActive ? "text-base-content/80" : "text-base-content/25"}`}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-base-300 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isActive ? color : "bg-base-content/10"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-base-300/50">
        <div className="text-[10px] text-base-content/45 leading-relaxed">
          Hyperopt set signals with weight ≈ 0 to <span className="text-base-content/60 font-medium">off</span>.
          The normalized score reaches <span className="text-base-content/60 font-medium">1.0</span> only when
          all active signals vote buy simultaneously.
        </div>
      </div>
    </div>
  );
}
