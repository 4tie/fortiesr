/**
 * WorkflowCard
 *
 * Renders a single workflow tool action card in the Mini Assistant chat timeline.
 * Lifecycle: proposed → awaiting_confirmation → starting → queued → running
 *            → completed | failed | cancelled | observation_paused | execution_timed_out
 *
 * One click on the "Run …" button is the user's confirmation — no second modal.
 * Read-only tools do not show a confirm button (they auto-execute).
 */
import { useState } from "react";
import { CARD_STATUS } from "../hooks/useAssistantWorkflow.js";

// ── Tab destinations ──────────────────────────────────────────────────────────
// Maps tool names to the application tab they relate to.
const TOOL_TAB_MAP = {
  run_backtest:           "backtest",
  run_optimizer:          "optimizer",
  run_pair_explorer:      "pair-explorer",
  run_pair_stress_lab:    "stress-test",
  run_temporal_stress_test: "stress-test",
  run_autoquant:          "auto-quant",
  view_best_params:       "optimizer",
  view_trial_params:      "optimizer",
};

// ── Status styling ────────────────────────────────────────────────────────────
const STATUS_CLASSES = {
  [CARD_STATUS.PROPOSED]:              "border-blue-200 bg-blue-50 text-blue-700",
  [CARD_STATUS.AWAITING_CONFIRMATION]: "border-amber-200 bg-amber-50 text-amber-700",
  [CARD_STATUS.STARTING]:              "border-violet-200 bg-violet-50 text-violet-700",
  [CARD_STATUS.QUEUED]:                "border-violet-200 bg-violet-50 text-violet-700",
  [CARD_STATUS.RUNNING]:               "border-violet-200 bg-violet-50 text-violet-700",
  [CARD_STATUS.COMPLETED]:             "border-emerald-200 bg-emerald-50 text-emerald-700",
  [CARD_STATUS.FAILED]:                "border-red-200 bg-red-50 text-red-700",
  [CARD_STATUS.CANCELLED]:             "border-gray-200 bg-gray-100 text-gray-500",
  [CARD_STATUS.OBSERVATION_PAUSED]:    "border-amber-200 bg-amber-50 text-amber-700",
  [CARD_STATUS.EXECUTION_TIMED_OUT]:   "border-orange-200 bg-orange-50 text-orange-700",
};

const STATUS_LABELS = {
  [CARD_STATUS.PROPOSED]:              "Proposed",
  [CARD_STATUS.AWAITING_CONFIRMATION]: "Awaiting Confirmation",
  [CARD_STATUS.STARTING]:              "Starting",
  [CARD_STATUS.QUEUED]:                "Queued",
  [CARD_STATUS.RUNNING]:               "Running",
  [CARD_STATUS.COMPLETED]:             "Completed",
  [CARD_STATUS.FAILED]:                "Failed",
  [CARD_STATUS.CANCELLED]:             "Cancelled",
  [CARD_STATUS.OBSERVATION_PAUSED]:    "Monitoring Paused",
  [CARD_STATUS.EXECUTION_TIMED_OUT]:   "Execution Timed Out",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const ARGUMENT_LABELS = {
  strategy_name:        "Strategy",
  timeframe:            "Timeframe",
  timerange:            "Timerange",
  pairs:                "Pairs",
  total_trials:         "Trials",
  search_strategy:      "Search",
  parameter_mode:       "Params",
  optimizer_session_id: "Session",
  trial_number:         "Trial",
};

function formatLabel(key) {
  return (
    ARGUMENT_LABELS[key] ||
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatValue(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    if (value.length <= 4)  return value.join(", ");
    return `${value.slice(0, 4).join(", ")} +${value.length - 4} more`;
  }
  if (value == null)            return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Only show "interesting" arguments — skip very large or irrelevant fields
const SKIP_ARGS = new Set([
  "search_spaces",
  "config_file",
  "version_id",
  "dry_run_wallet",
  "max_open_trades",
  "fee_rate",
  "enable_vectorbt_screening",
  "vectorbt_candidate_count",
  "vectorbt_keep_ratio",
  "vectorbt_timeout_seconds",
]);

// ── Progress summary ──────────────────────────────────────────────────────────

function ProgressSummary({ toolName, progress }) {
  if (!progress) return null;

  const lines = [];

  // Optimizer-specific
  if (progress.completed_trials != null && progress.total_trials != null) {
    lines.push(`${progress.completed_trials} / ${progress.total_trials} trials`);
  }
  if (progress.best_trial_number != null) {
    lines.push(`Best trial: #${progress.best_trial_number}`);
  }
  if (progress.best_metrics?.score != null) {
    lines.push(`Best score: ${Number(progress.best_metrics.score).toFixed(3)}`);
  }
  if (progress.phase) {
    lines.push(`Phase: ${progress.phase}`);
  }

  // Generic job
  if (progress.status) {
    const s = String(progress.status);
    if (!lines.some((l) => l.toLowerCase().includes(s.toLowerCase()))) {
      lines.push(s.charAt(0).toUpperCase() + s.slice(1));
    }
  }

  if (lines.length === 0) return null;

  return (
    <div className="mt-2 space-y-0.5 text-[11px] text-gray-600 dark:text-gray-400">
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

// ── Result summary ────────────────────────────────────────────────────────────

function ResultSummary({ result }) {
  const [expanded, setExpanded] = useState(false);
  if (!result || Object.keys(result).length === 0) return null;

  const preview = typeof result === "object"
    ? Object.entries(result)
        .filter(([k]) => !["error"].includes(k))
        .slice(0, 3)
        .map(([k, v]) => `${formatLabel(k)}: ${formatValue(v)}`)
        .join(" · ")
    : String(result);

  return (
    <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-400">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="underline decoration-dotted text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        {expanded ? "Hide result" : "Show result"}
      </button>
      {expanded && (
        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 dark:bg-gray-800/50 p-2 text-[10px]">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
      {!expanded && (
        <div className="mt-0.5 text-gray-500 dark:text-gray-500 truncate">{preview}</div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkflowCard({
  card,
  onConfirm,
  onNavigate,
}) {
  const {
    key: cardKey,
    status     = CARD_STATUS.AWAITING_CONFIRMATION,
    toolName   = "",
    title      = "",
    arguments: toolArguments = {},
    progress   = null,
    result     = null,
    error      = null,
    confirming = false,
    // FIX (Item 9): real IDs for deep navigation
    optimizerSessionId = null,
    apiSessionId       = null,
    runId              = null,
    autoQuantRunId     = null,
  } = card || {};

  // Build a navigation payload with real IDs when available.
  // The parent (App.jsx) uses these to pre-select the session/run.
  const buildNavPayload = (tab) => {
    const payload = { tab };
    if (optimizerSessionId)          payload.optimizer_session_id = optimizerSessionId;
    else if (apiSessionId)           payload.api_session_id = apiSessionId;
    if (runId)                       payload.run_id = runId;
    if (autoQuantRunId)              payload.auto_quant_run_id = autoQuantRunId;
    // Also propagate from result if available
    if (result?.optimizer_session_id)  payload.optimizer_session_id = result.optimizer_session_id;
    if (result?.run_id)                payload.run_id = result.run_id;
    if (result?.auto_quant_run_id)     payload.auto_quant_run_id = result.auto_quant_run_id;
    return payload;
  };

  const statusClass = STATUS_CLASSES[status] || STATUS_CLASSES[CARD_STATUS.PROPOSED];
  const statusLabel = STATUS_LABELS[status]  || status;

  const isTerminal = [
    CARD_STATUS.COMPLETED,
    CARD_STATUS.FAILED,
    CARD_STATUS.CANCELLED,
    CARD_STATUS.OBSERVATION_PAUSED,
    CARD_STATUS.EXECUTION_TIMED_OUT,
  ].includes(status);

  const isRunning = [
    CARD_STATUS.STARTING,
    CARD_STATUS.QUEUED,
    CARD_STATUS.RUNNING,
  ].includes(status);

  const isAwaiting = status === CARD_STATUS.AWAITING_CONFIRMATION;

  const destinationTab = TOOL_TAB_MAP[toolName] || null;

  // Visible arguments (skip internal / large fields)
  const visibleArgs = Object.entries(toolArguments || {}).filter(
    ([k]) => !SKIP_ARGS.has(k)
  );

  const [argsExpanded, setArgsExpanded] = useState(false);
  const MAX_ARGS_COLLAPSED = 3;
  const displayArgs = argsExpanded ? visibleArgs : visibleArgs.slice(0, MAX_ARGS_COLLAPSED);
  const hasMoreArgs = visibleArgs.length > MAX_ARGS_COLLAPSED;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</div>
          {toolName && (
            <div className="mt-0.5 font-mono text-[10px] text-gray-400 dark:text-gray-500 truncate">{toolName}</div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusClass}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Arguments */}
      {displayArgs.length > 0 && (
        <div className="mt-2 space-y-1 rounded-md bg-gray-50 dark:bg-gray-900/50 p-2">
          {displayArgs.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[80px_1fr] gap-1 text-xs">
              <span className="text-gray-500 dark:text-gray-400 truncate">{formatLabel(key)}</span>
              <span className="min-w-0 break-words font-medium text-gray-800 dark:text-gray-200">
                {formatValue(value)}
              </span>
            </div>
          ))}
          {hasMoreArgs && (
            <button
              type="button"
              onClick={() => setArgsExpanded((e) => !e)}
              className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {argsExpanded ? "Show less" : `+${visibleArgs.length - MAX_ARGS_COLLAPSED} more arguments`}
            </button>
          )}
        </div>
      )}

      {/* Progress */}
      {(isRunning || status === CARD_STATUS.OBSERVATION_PAUSED) && <ProgressSummary toolName={toolName} progress={progress} />}

      {/* Observation paused note */}
      {status === CARD_STATUS.OBSERVATION_PAUSED && (
        <p className="mt-2 text-[11px] text-amber-700">
          The Assistant stopped monitoring this run, but the job may still be active.
        </p>
      )}

      {/* Error */}
      {error && !isRunning && (
        <p className="mt-2 text-[11px] text-red-600 break-words">{error}</p>
      )}

      {/* Result */}
      {status === CARD_STATUS.COMPLETED && result && (
        <ResultSummary result={result} />
      )}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {isAwaiting && (
          <button
            type="button"
            onClick={() => onConfirm?.(cardKey, card)}
            disabled={confirming}
            className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {confirming && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {title}
          </button>
        )}

        {isRunning && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-violet-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
            Running…
          </span>
        )}

        {(isTerminal || status === CARD_STATUS.OBSERVATION_PAUSED) && destinationTab && (
          <button
            type="button"
            onClick={() => onNavigate?.(buildNavPayload(destinationTab))}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-violet-400 hover:text-violet-700"
          >
            Open {destinationTab.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        )}
      </div>
    </div>
  );
}
