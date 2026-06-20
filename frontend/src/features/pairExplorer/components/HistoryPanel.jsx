import StatusBadge from "./StatusBadge";
import { fmtRelTime } from "../formatters";

export default function HistoryPanel({
  open,
  onToggle,
  sessions,
  loading,
  activeSessionId,
  nowMs,
  onLoadSession,
  onRefresh,
}) {
  return (
    <div className="border-t border-base-300 mt-auto">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-base-content/40 hover:text-base-content/70 hover:bg-base-200 transition-colors"
        onClick={() => {
          onToggle();
          if (!open) onRefresh();
        }}
      >
        <span>Past Runs {sessions.length > 0 ? `(${sessions.length})` : ""}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="max-h-64 overflow-y-auto divide-y divide-base-300/60">
          {loading ? (
            <div className="px-4 py-3 text-xs text-base-content/30">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-base-content/30">No past runs yet.</div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.session_id}
                className={`w-full text-left px-4 py-2.5 hover:bg-base-200 transition-colors ${session.session_id === activeSessionId ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                aria-label={`Load ${session.strategy_name || "pair explorer"} run`}
                onClick={() => onLoadSession(session.session_id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-semibold truncate">{session.strategy_name || "-"}</span>
                  <StatusBadge status={session.status} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-base-content/35 font-mono">{session.timeframe}</span>
                  <span className="text-[10px] text-base-content/25">.</span>
                  <span className="text-[10px] text-base-content/35">{session.total} pairs</span>
                  <span className="text-[10px] text-base-content/25">.</span>
                  <span className="text-[10px] text-base-content/35">{fmtRelTime(session.created_at, nowMs)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
