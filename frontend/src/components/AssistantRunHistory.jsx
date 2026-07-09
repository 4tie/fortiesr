/**
 * AssistantRunHistory
 *
 * Shows WORKFLOW RUN HISTORY — not chat message history.
 * Uses real persisted data from the copilot session's tool_runs field
 * via GET /api/ai/copilot/sessions/{session_id}.
 *
 * Each row shows: workflow type, strategy, status, timestamp,
 * with an expandable details section and a link to the real application tab.
 */
import { useEffect, useState, useMemo } from "react";

// ── Destinations ──────────────────────────────────────────────────────────────
const TOOL_TAB_MAP = {
  run_backtest:             "backtest",
  run_optimizer:            "optimizer",
  run_pair_explorer:        "pair-explorer",
  run_pair_stress_lab:      "stress-test",
  run_temporal_stress_test: "stress-test",
  run_autoquant:            "auto-quant",
};

const TOOL_LABELS = {
  run_backtest:             "Backtest",
  run_optimizer:            "Optimizer",
  run_pair_explorer:        "Pair Explorer",
  run_pair_stress_lab:      "Stress Lab",
  run_temporal_stress_test: "Temporal Stress",
  view_best_params:         "View Best Params",
  view_trial_params:        "View Trial Params",
};

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  completed:            "text-emerald-700 bg-emerald-50 border-emerald-200",
  failed:               "text-red-700 bg-red-50 border-red-200",
  cancelled:            "text-gray-500 bg-gray-100 border-gray-200",
  running:              "text-violet-700 bg-violet-50 border-violet-200",
  queued:               "text-violet-600 bg-violet-50 border-violet-100",
  timed_out:            "text-orange-700 bg-orange-50 border-orange-200",
  awaiting_confirmation:"text-amber-700 bg-amber-50 border-amber-200",
  proposed:             "text-blue-700 bg-blue-50 border-blue-200",
};

function StatusBadge({ status }) {
  const label = String(status || "unknown").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const cls = STATUS_COLORS[status] || "text-gray-500 bg-gray-50 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function formatRelativeTime(isoString) {
  if (!isoString) return "";
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60)   return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60)   return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)   return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return "";
  }
}

// ── Single history row ────────────────────────────────────────────────────────
function HistoryRow({ run, onNavigate, onAskAI }) {
  const [expanded, setExpanded] = useState(false);

  const toolLabel  = TOOL_LABELS[run.tool_name] || run.tool_name?.replace(/_/g, " ") || "Tool";
  const destTab    = TOOL_TAB_MAP[run.tool_name] || null;
  const strategy   = run.arguments?.strategy_name || run.result_summary?.strategy_name || null;
  const timeago    = formatRelativeTime(run.started_at || run.created_at);

  // Calculate duration
  const duration = useMemo(() => {
    if (!run.started_at || !run.completed_at) return null;
    const start = new Date(run.started_at).getTime();
    const end = new Date(run.completed_at).getTime();
    const diff = end - start;
    if (diff < 1000) return `${diff}ms`;
    if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
    return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`;
  }, [run.started_at, run.completed_at]);

  const handleAskAI = () => {
    const contextParts = [
      `Tool: ${toolLabel}`,
      `Status: ${run.status}`,
      strategy && `Strategy: ${strategy}`,
      duration && `Duration: ${duration}`,
      run.started_at && `Started: ${new Date(run.started_at).toLocaleString()}`,
      run.error && `Error: ${run.error}`,
    ].filter(Boolean);

    const args = run.arguments ? Object.entries(run.arguments)
      .filter(([k, v]) => v != null && typeof v !== 'object')
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ') : null;

    if (args) contextParts.push(`Arguments: ${args}`);

    const result = run.result_summary ? Object.entries(run.result_summary)
      .filter(([k, v]) => v != null && typeof v !== 'object')
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ') : null;

    if (result) contextParts.push(`Results: ${result}`);

    const contextMessage = contextParts.length > 0
      ? `Explain this run:\n${contextParts.join('\n')}`
      : "Explain this run.";

    onAskAI?.(contextMessage);
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 text-sm shadow-sm">
      {/* Row header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-gray-900 dark:text-gray-100 text-xs truncate">{toolLabel}</div>
          {strategy && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{strategy}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge status={run.status} />
          {timeago && <span className="text-[10px] text-gray-400 dark:text-gray-500">{timeago}</span>}
        </div>
      </div>

      {/* Actions row */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {destTab && (
          <button
            type="button"
            onClick={() => {
              // FIX (Item 9): build deep navigation payload with real IDs
              const payload = { tab: destTab };
              if (run.arguments?.optimizer_session_id) payload.optimizer_session_id = run.arguments.optimizer_session_id;
              if (run.result_summary?.optimizer_session_id) payload.optimizer_session_id = run.result_summary.optimizer_session_id;
              if (run.arguments?.run_id || run.tool_call_id) payload.run_id = run.arguments?.run_id || run.tool_call_id;
              if (run.result_summary?.run_id) payload.run_id = run.result_summary.run_id;
              if (run.arguments?.auto_quant_run_id) payload.auto_quant_run_id = run.arguments.auto_quant_run_id;
              if (run.result_summary?.auto_quant_run_id) payload.auto_quant_run_id = run.result_summary.auto_quant_run_id;
              onNavigate?.(payload);
            }}
            className="rounded border border-gray-300 dark:border-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400 hover:border-violet-400 dark:hover:border-violet-600 hover:text-violet-700 dark:hover:text-violet-400 transition-colors"
          >
            Open
          </button>
        )}
        {(run.result_summary || run.error || run.arguments) && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[10px] text-gray-400 dark:text-gray-500 underline decoration-dotted hover:text-gray-600 dark:hover:text-gray-300"
          >
            {expanded ? "Hide details" : "View details"}
          </button>
        )}
        {onAskAI && (
          <button
            type="button"
            onClick={handleAskAI}
            className="text-[10px] text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
          >
            Ask AI
          </button>
        )}
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="mt-2 space-y-2">
          {duration && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              Duration: {duration}
            </div>
          )}
          {run.error && (
            <div className="text-[10px] text-red-600 dark:text-red-400 break-words bg-red-50 dark:bg-red-900/20 p-1.5 rounded">
              <strong>Error:</strong> {run.error}
            </div>
          )}
          {run.arguments && Object.keys(run.arguments).length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">Arguments:</div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 dark:bg-gray-900/50 p-1.5 text-[10px] text-gray-700 dark:text-gray-300">
                {JSON.stringify(run.arguments, null, 2)}
              </pre>
            </div>
          )}
          {run.result_summary && (
            <div>
              <div className="text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">Results:</div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 dark:bg-gray-900/50 p-1.5 text-[10px] text-gray-700 dark:text-gray-300">
                {JSON.stringify(run.result_summary, null, 2)}
              </pre>
            </div>
          )}
          {run.tool_call_id && (
            <div className="font-mono text-[9px] text-gray-400 dark:text-gray-500 truncate">
              ID: {run.tool_call_id}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AssistantRunHistory({ sessionId, onNavigate, onAskAI }) {
  const [runs, setRuns]         = useState([]);
  const [loadState, setLoadState] = useState("idle"); // idle | loading | loaded | error
  const [errorMsg, setErrorMsg] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTool, setFilterTool] = useState("all");
  const [sortBy, setSortBy] = useState("time"); // time | status | tool
  const [sortOrder, setSortOrder] = useState("desc"); // asc | desc
  const [searchQuery, setSearchQuery] = useState("");

  // Filter and sort runs
  const filteredRuns = useMemo(() => {
    let filtered = [...runs];

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(run => run.status === filterStatus);
    }

    // Tool filter
    if (filterTool !== "all") {
      filtered = filtered.filter(run => run.tool_name === filterTool);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(run => {
        const strategy = run.arguments?.strategy_name || run.result_summary?.strategy_name || "";
        const toolLabel = TOOL_LABELS[run.tool_name] || run.tool_name || "";
        return strategy.toLowerCase().includes(query) || toolLabel.toLowerCase().includes(query);
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "time") {
        const aTime = new Date(a.started_at || a.created_at || 0).getTime();
        const bTime = new Date(b.started_at || b.created_at || 0).getTime();
        comparison = bTime - aTime;
      } else if (sortBy === "status") {
        comparison = (a.status || "").localeCompare(b.status || "");
      } else if (sortBy === "tool") {
        comparison = (a.tool_name || "").localeCompare(b.tool_name || "");
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [runs, filterStatus, filterTool, sortBy, sortOrder, searchQuery]);

  useEffect(() => {
    if (!sessionId) {
      setLoadState("idle");
      setRuns([]);
      return;
    }

    let cancelled = false;
    setLoadState("loading");
    setErrorMsg("");

    fetch(`/api/ai/chat/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((session) => {
        if (cancelled) return;
        const toolRuns = Array.isArray(session.tool_runs)
          ? session.tool_runs
              .slice()
              .reverse() // most recent first
              .filter((r) => r.tool_name) // skip incomplete records
          : [];
        setRuns(toolRuns);
        setLoadState("loaded");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err.message || "Failed to load history.");
        setLoadState("error");
      });

    return () => { cancelled = true; };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center text-center text-sm text-gray-400 dark:text-gray-500 px-4">
        Start a conversation to see run history here.
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="flex h-full min-h-[80px] items-center justify-center text-xs text-gray-400 dark:text-gray-500">
        Loading history…
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-700 dark:text-red-400 m-3">
        Error loading history: {errorMsg}
      </div>
    );
  }

  if (loadState === "loaded" && runs.length === 0) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center text-center text-sm text-gray-400 dark:text-gray-500 px-4">
        No workflow runs yet in this session.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {/* Filter controls */}
      {loadState === "loaded" && runs.length > 0 && (
        <div className="space-y-2 mb-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-[10px] rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={filterTool}
              onChange={(e) => setFilterTool(e.target.value)}
              className="text-[10px] rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
            >
              <option value="all">All Tools</option>
              <option value="run_optimizer">Optimizer</option>
              <option value="run_backtest">Backtest</option>
              <option value="run_autoquant">AutoQuant</option>
              <option value="run_pair_stress_lab">Stress Lab</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-[10px] rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
            >
              <option value="time">Sort by Time</option>
              <option value="status">Sort by Status</option>
              <option value="tool">Sort by Tool</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="text-[10px] rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
          </div>
          <input
            type="text"
            placeholder="Search by strategy or tool..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-[10px] rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1"
          />
        </div>
      )}

      {filteredRuns.length === 0 && runs.length > 0 ? (
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">
          No runs match your filters.
        </div>
      ) : (
        filteredRuns.map((run, idx) => (
          <HistoryRow
            key={run.tool_run_id || run.tool_call_id || idx}
            run={run}
            onNavigate={onNavigate}
            onAskAI={onAskAI}
          />
        ))
      )}
    </div>
  );
}
