export default function SessionMeta({ session, isRunning, sessionId, completedCount, failedCount }) {
  if (!session || isRunning || !sessionId) return null;

  return (
    <div className="shrink-0 px-4 pt-3 pb-1 flex items-center gap-3 flex-wrap">
      {session.strategy_name && (
        <span className="text-[10px] font-mono font-semibold bg-base-200 px-2 py-0.5 rounded border border-base-300">
          {session.strategy_name}
        </span>
      )}
      {session.timeframe && (
        <span className="text-[10px] text-base-content/40 font-mono">{session.timeframe}</span>
      )}
      {session.timerange && (
        <span className="text-[10px] text-base-content/40 font-mono">{session.timerange}</span>
      )}
      {completedCount > 0 && (
        <span className="text-[10px] text-success/70">{completedCount} ok</span>
      )}
      {failedCount > 0 && (
        <span className="text-[10px] text-error/70">{failedCount} failed</span>
      )}
    </div>
  );
}
