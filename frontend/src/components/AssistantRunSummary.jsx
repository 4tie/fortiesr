/**
 * AssistantRunSummary
 *
 * Compact summary of the current active run, shown in the Mini Assistant "Run" tab.
 * Uses real context from contextOverrides passed by the parent page.
 * Does NOT recreate the full Optimizer/Backtest/AutoQuant UI.
 * Links to the real application tab via onNavigate.
 */

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  running:              "text-violet-700 bg-violet-50 border-violet-200",
  queued:               "text-violet-600 bg-violet-50 border-violet-100",
  starting:             "text-violet-600 bg-violet-50 border-violet-100",
  completed:            "text-emerald-700 bg-emerald-50 border-emerald-200",
  failed:               "text-red-700 bg-red-50 border-red-200",
  cancelled:            "text-gray-500 bg-gray-100 border-gray-200",
  observation_paused:   "text-amber-700 bg-amber-50 border-amber-200",
  execution_timed_out:  "text-orange-700 bg-orange-50 border-orange-200",
};

function StatusBadge({ status }) {
  if (!status) return null;
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const cls = STATUS_COLORS[status] || "text-gray-500 bg-gray-50 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ── Row helper ────────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid grid-cols-[80px_1fr] gap-1 text-xs">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="min-w-0 break-words font-medium text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  );
}

function navigationPayload(tab, ctx = {}, liveCard = {}) {
  const payload = { tab };
  const optimizerSessionId = ctx.optimizer_session_id || liveCard.optimizerSessionId || liveCard.result?.optimizer_session_id;
  const apiSessionId = ctx.api_session_id || liveCard.apiSessionId;
  const runId = ctx.backtest_run_id || ctx.run_id || liveCard.runId || liveCard.result?.run_id;
  const autoQuantRunId = ctx.auto_quant_run_id || liveCard.autoQuantRunId || liveCard.result?.auto_quant_run_id;
  if (optimizerSessionId) payload.optimizer_session_id = optimizerSessionId;
  if (apiSessionId) payload.api_session_id = apiSessionId;
  if (runId) payload.run_id = runId;
  if (autoQuantRunId) payload.auto_quant_run_id = autoQuantRunId;
  return payload;
}

// ── Optimizer summary ─────────────────────────────────────────────────────────
function OptimizerSummary({ ctx, liveCard, onNavigate }) {
  const sessionId = ctx.optimizer_session_id;

  // Try to pull live data from a workflow card if the optimizer is running
  const progress = liveCard?.progress || null;
  const liveStatus = liveCard?.status || null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Optimizer</div>
          {sessionId && (
            <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 truncate">
              {sessionId.slice(0, 16)}…
            </div>
          )}
        </div>
        {liveStatus ? <StatusBadge status={liveStatus} /> : (
          <StatusBadge status="running" />
        )}
      </div>

      <div className="space-y-1 rounded-md bg-gray-50 dark:bg-gray-900/50 p-2">
        <InfoRow label="Strategy"  value={ctx.strategy_name} />
        {progress?.completed_trials != null && progress?.total_trials != null && (
          <InfoRow label="Progress" value={`${progress.completed_trials} / ${progress.total_trials} trials`} />
        )}
        {progress?.best_trial_number != null && (
          <InfoRow label="Best trial" value={`#${progress.best_trial_number}`} />
        )}
        {progress?.best_metrics?.score != null && (
          <InfoRow label="Best score" value={Number(progress.best_metrics.score).toFixed(3)} />
        )}
        {progress?.phase && (
          <InfoRow label="Phase" value={progress.phase} />
        )}
        {ctx.optimizer_trial_number != null && (
          <InfoRow label="Selected" value={`Trial #${ctx.optimizer_trial_number}`} />
        )}
      </div>

      <button
        type="button"
        onClick={() => onNavigate?.(navigationPayload("optimizer", ctx, liveCard))}
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 transition-colors hover:border-violet-400 dark:hover:border-violet-600 hover:text-violet-700 dark:hover:text-violet-400"
      >
        Open Optimizer
      </button>
    </div>
  );
}

// ── Backtest summary ──────────────────────────────────────────────────────────
function BacktestSummary({ ctx, liveCard, onNavigate }) {
  const liveStatus = liveCard?.status || null;
  const args = liveCard?.arguments || {};

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Backtest</div>
        {liveStatus ? <StatusBadge status={liveStatus} /> : (
          <StatusBadge status="running" />
        )}
      </div>

      <div className="space-y-1 rounded-md bg-gray-50 dark:bg-gray-900/50 p-2">
        <InfoRow label="Strategy"  value={ctx.strategy_name || args.strategy_name} />
        <InfoRow label="Timeframe" value={args.timeframe} />
        <InfoRow label="Timerange" value={args.timerange} />
        {ctx.backtest_run_id && (
          <InfoRow label="Run ID" value={ctx.backtest_run_id.slice(0, 12) + "…"} />
        )}
      </div>

      <button
        type="button"
        onClick={() => onNavigate?.(navigationPayload("results", ctx, liveCard))}
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 transition-colors hover:border-violet-400 dark:hover:border-violet-600 hover:text-violet-700 dark:hover:text-violet-400"
      >
        Open Results
      </button>
    </div>
  );
}

// ── AutoQuant summary ─────────────────────────────────────────────────────────
function AutoQuantSummary({ ctx, liveCard, onNavigate }) {
  const liveStatus = liveCard?.status || null;
  const progress = liveCard?.progress || null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">AutoQuant</div>
          {ctx.auto_quant_run_id && (
            <div className="font-mono text-[10px] text-gray-400 dark:text-gray-500 truncate">
              {ctx.auto_quant_run_id.slice(0, 12)}…
            </div>
          )}
        </div>
        {liveStatus ? <StatusBadge status={liveStatus} /> : (
          <StatusBadge status="running" />
        )}
      </div>

      <div className="space-y-1 rounded-md bg-gray-50 dark:bg-gray-900/50 p-2">
        <InfoRow label="Strategy" value={ctx.strategy_name} />
        {progress?.phase && <InfoRow label="Stage"   value={progress.phase} />}
        {progress?.status && !progress?.phase && <InfoRow label="Status" value={progress.status} />}
      </div>

      <button
        type="button"
        onClick={() => onNavigate?.(navigationPayload("auto-quant", ctx, liveCard))}
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 transition-colors hover:border-violet-400 dark:hover:border-violet-600 hover:text-violet-700 dark:hover:text-violet-400"
      >
        Open AutoQuant
      </button>
    </div>
  );
}

// ── Stress Lab summary ────────────────────────────────────────────────────────
function StressSummary({ ctx, liveCard, onNavigate }) {
  const isTemporalStress = Boolean(ctx.temporal_stress_session_id);
  const label = isTemporalStress ? "Temporal Stress" : "Stress Lab";
  const liveStatus = liveCard?.status || null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Stress Test</div>
        {liveStatus ? <StatusBadge status={liveStatus} /> : <StatusBadge status="running" />}
      </div>

      <div className="space-y-1 rounded-md bg-gray-50 dark:bg-gray-900/50 p-2">
        <InfoRow label="Strategy" value={ctx.strategy_name} />
      </div>

      <button
        type="button"
        onClick={() => onNavigate?.(navigationPayload("stress-test", ctx, liveCard))}
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 transition-colors hover:border-violet-400 dark:hover:border-violet-600 hover:text-violet-700 dark:hover:text-violet-400"
      >
        Open {label}
      </button>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyRunState() {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center text-center text-sm text-gray-400 px-4">
      No active run.
      <br />
      Start an Optimizer, Backtest, or AutoQuant run to see live progress here.
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * @param {object} contextOverrides  - Current page context (optimizer_session_id, backtest_run_id, etc.)
 * @param {object} cards             - Live workflow card map from useAssistantWorkflow
 * @param {function} onNavigate      - (tabId) => void — uses existing app navigation
 */
export default function AssistantRunSummary({ contextOverrides = {}, cards = {}, onNavigate }) {
  const ctx = contextOverrides;

  // Find a live workflow card for the current context
  const cardList = Object.values(cards);
  const optimizerCard = cardList.find((c) => c.toolName === "run_optimizer");
  const backtestCard  = cardList.find((c) => c.toolName === "run_backtest");
  const aqCard        = cardList.find((c) => c.toolName === "run_autoquant");
  const stressCard    = cardList.find((c) =>
    c.toolName === "run_pair_stress_lab" || c.toolName === "run_temporal_stress_test"
  );

  // Detect active run from context
  if (ctx.optimizer_session_id) {
    return (
      <div className="p-3">
        <OptimizerSummary ctx={ctx} liveCard={optimizerCard} onNavigate={onNavigate} />
      </div>
    );
  }

  if (ctx.auto_quant_run_id) {
    return (
      <div className="p-3">
        <AutoQuantSummary ctx={ctx} liveCard={aqCard} onNavigate={onNavigate} />
      </div>
    );
  }

  if (ctx.backtest_run_id) {
    return (
      <div className="p-3">
        <BacktestSummary ctx={ctx} liveCard={backtestCard} onNavigate={onNavigate} />
      </div>
    );
  }

  if (ctx.stress_session_id || ctx.temporal_stress_session_id) {
    return (
      <div className="p-3">
        <StressSummary ctx={ctx} liveCard={stressCard} onNavigate={onNavigate} />
      </div>
    );
  }

  // Check if there's a live running or session-restored card even without explicit context
  const runningCard = cardList.find((c) =>
    ["starting", "queued", "running", "observation_paused"].includes(c.status)
  );
  if (runningCard) {
    const tabId = runningCard.toolName?.includes("optimizer") ? "optimizer"
      : runningCard.toolName?.includes("backtest")   ? "backtest"
      : runningCard.toolName?.includes("auto_quant") ? "auto-quant"
      : runningCard.toolName?.includes("stress")     ? "stress-test"
      : null;
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-gray-900 text-sm">{runningCard.title}</div>
          <StatusBadge status={runningCard.status} />
        </div>
        {runningCard.progress && (
          <div className="space-y-1 rounded-md bg-gray-50 p-2 text-xs">
            {Object.entries(runningCard.progress)
              .filter(([, v]) => v != null && typeof v !== "object")
              .slice(0, 4)
              .map(([k, v]) => (
                <div key={k} className="grid grid-cols-[80px_1fr] gap-1">
                  <span className="text-gray-500">{k.replace(/_/g, " ")}</span>
                  <span className="font-medium text-gray-800">{String(v)}</span>
                </div>
              ))}
          </div>
        )}
        {tabId && (
          <button
            type="button"
            onClick={() => onNavigate?.(navigationPayload(tabId, ctx, runningCard))}
            className="w-full rounded-md border border-gray-300 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-violet-400 hover:text-violet-700"
          >
            Open {tabId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        )}
      </div>
    );
  }

  return <EmptyRunState />;
}
