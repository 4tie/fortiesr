import { EMPTY_TRIALS, TERMINAL_STATUSES } from "./constants";

export function buildOptimizerViewModel({ session, apiStatus, totalTrials }) {
  const phase = session?.phase || apiStatus;
  const trials = session?.trials || EMPTY_TRIALS;
  const totalCount = session?.total_trials || totalTrials;
  const completedCount = session?.completed_trials || 0;
  const failedCount = session?.failed_trials || 0;
  const runningCount = trials.filter((trial) => trial.status === "running").length;
  const terminalCount = completedCount + failedCount;
  const progressPct = totalCount > 0 ? Math.min(100, (terminalCount / totalCount) * 100) : 0;
  const elapsedSec = session?.elapsed_seconds || 0;
  const etaSec = session?.eta_seconds;
  const bestTrialNum = session?.best_trial_number;
  const bestTrial = bestTrialNum != null
    ? trials.find((trial) => trial.trial_number === bestTrialNum)
    : null;
  const autoLockEvents = session?.auto_lock_events || [];
  const vectorbtScreening = session?.vectorbt_screening || null;
  const topVectorbtCandidates = vectorbtScreening?.top_candidates || [];
  const visibleTrials = trials
    .filter((trial) => ["completed", "running", "failed", "pruned"].includes(trial.status))
    .sort((a, b) => b.trial_number - a.trial_number);
  const completedWithMetrics = trials
    .filter((trial) => trial.status === "completed" && trial.metrics)
    .sort((a, b) => a.trial_number - b.trial_number);
  const topFiveTrials = completedWithMetrics
    .filter((trial) => trial.metrics?.score != null)
    .sort((a, b) => (b.metrics?.score ?? 0) - (a.metrics?.score ?? 0))
    .slice(0, 5);
  const profitData = completedWithMetrics
    .filter((trial) => trial.metrics?.net_profit_pct != null)
    .map((trial) => ({ trial: trial.trial_number, profit: Number(trial.metrics.net_profit_pct) }));
  const drawdownData = completedWithMetrics
    .filter((trial) => trial.metrics?.max_drawdown_pct != null)
    .map((trial) => ({ trial: trial.trial_number, drawdown: Math.abs(Number(trial.metrics.max_drawdown_pct)) }));

  return {
    phase,
    trials,
    totalCount,
    completedCount,
    failedCount,
    runningCount,
    terminalCount,
    progressPct,
    elapsedSec,
    etaSec,
    bestTrialNum,
    bestTrial,
    topFiveTrials,
    autoLockEvents,
    vectorbtScreening,
    topVectorbtCandidates,
    visibleTrials,
    completedWithMetrics,
    profitData,
    drawdownData,
    isTerminal: TERMINAL_STATUSES.has(phase),
  };
}

export function optimizerRunDisabledReason({
  strategyName,
  dateStart,
  dateEnd,
  validDateRange,
  pairList,
  enabledSpaces,
  isRunning,
}) {
  if (isRunning) return "Optimizer is already running.";
  if (!strategyName) return "Select a strategy.";
  if (!dateStart || !dateEnd) return "Select a start and end date.";
  if (!validDateRange) return "Start date must be before or equal to end date.";
  if (!pairList.length) return "Add at least one trading pair.";
  if (!enabledSpaces.length) return "Enable at least one optimizable parameter.";
  return null;
}
