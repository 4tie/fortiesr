export default function SessionHeader({
  session,
  isRunning,
  completedPairs,
  totalPairs,
  failedCount,
  onRun,
  canRun,
}) {
  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-base-300 bg-base-200">
      <span className="text-sm font-bold tracking-tight">Pair Explorer</span>

      {isRunning && (
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-primary/30 text-primary bg-primary/10">
          Running
        </span>
      )}
      {session?.status === "completed" && !isRunning && (
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-success/30 text-success bg-success/10">
          Done
        </span>
      )}

      {session && (
        <span className="text-xs text-base-content/40 font-mono">
          {completedPairs} / {totalPairs} run{totalPairs !== 1 ? "s" : ""}
          {failedCount > 0 && (
            <span className="ml-2 text-error/60">- {failedCount} failed</span>
          )}
        </span>
      )}

      <div className="flex-1" />

      <button
        onClick={onRun}
        disabled={!canRun}
        className="btn btn-primary btn-sm px-5 gap-2"
      >
        {isRunning && <span className="loading loading-spinner loading-xs" />}
        {isRunning ? "Running..." : "Run Exploration"}
      </button>
    </div>
  );
}
