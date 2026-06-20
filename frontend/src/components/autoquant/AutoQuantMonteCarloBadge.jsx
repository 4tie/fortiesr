export default function AutoQuantMonteCarloBadge({ mc, threshold = 0.35 }) {
  if (!mc) return null;
  const p95Pct = (mc.p95_drawdown * 100).toFixed(1);
  const p5Pct = (mc.p5_drawdown * 100).toFixed(1);
  const medPct = (mc.median_final_return * 100).toFixed(1);
  const thresholdPct = (threshold * 100).toFixed(1);
  const passed = mc.passed;
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
      passed ? "border-success/30 bg-success/5" : "border-error/30 bg-error/10"
    }`}>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <span className="text-[10px] uppercase tracking-wider text-base-content/50 font-medium">
          Monte Carlo ({mc.simulations?.toLocaleString() ?? "1 000"} shuffles)
        </span>
        <div className="flex flex-wrap gap-3 items-center">
          <span className={`font-bold text-base ${passed ? "text-success" : "text-error"}`}>
            p95 DD: {p95Pct}%
          </span>
          <span className="text-xs text-base-content/60">p5 DD: {p5Pct}%</span>
          <span className="text-xs text-base-content/60">Median return: {medPct}%</span>
        </div>
        <span className="text-[10px] text-base-content/40">threshold: p95 DD &lt; {thresholdPct}%</span>
      </div>
      <span className={`badge badge-sm shrink-0 ${passed ? "badge-success" : "badge-error"}`}>
        {passed ? "Passed" : "Failed"}
      </span>
    </div>
  );
}
