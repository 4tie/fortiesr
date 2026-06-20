export default function ProgressPanel({ session, isRunning, completedPairs, totalPairs, progressPct }) {
  if (!session || !isRunning) return null;

  return (
    <div className="shrink-0 px-4 pt-3 pb-2">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-xs text-base-content/50 font-mono">
          {completedPairs} / {totalPairs} pairs complete
        </span>
        <span className="text-xs text-base-content/30">
          {Math.round(progressPct)}%
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-base-300 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
