import { useEffect, useRef } from "react";

export function useBacktestAgentContext({
  strategy,
  timeframe,
  timerange,
  startDate,
  endDate,
  pairs,
  wallet,
  maxTrades,
  running,
  runStatus,
  sessionId,
  runId,
  resultPanel,
  downloading,
  onAgentContextChange,
}) {
  const stableOnAgentContextChange = useRef(onAgentContextChange);
  stableOnAgentContextChange.current = onAgentContextChange;

  const payload = useBacktestAgentContextPayload({
    strategy,
    timeframe,
    timerange,
    startDate,
    endDate,
    pairs,
    wallet,
    maxTrades,
    running,
    runStatus,
    sessionId,
    runId,
    resultPanel,
    downloading,
  });

  useEffect(() => {
    if (!stableOnAgentContextChange.current) return;
    stableOnAgentContextChange.current({
      active_tab: "backtest",
      ...payload,
    });
  }, [payload]);
}

export function useBacktestAgentContextPayload({
  strategy,
  timeframe,
  timerange,
  startDate,
  endDate,
  pairs,
  wallet,
  maxTrades,
  running,
  runStatus,
  sessionId,
  runId,
  resultPanel,
  downloading,
}) {
  const active_panel = activePanelFromState({
    running,
    runStatus,
    runId,
    resultPanel,
    downloading,
  });

  const wallet_num = wallet === "" || wallet == null ? null : Number(wallet);
  const max_trades_num = maxTrades === "" || maxTrades == null ? null : Number(maxTrades);

  const payload = {
    active_tab: "backtest",
    active_panel,
    strategy_name: strategy || null,
    timeframe: timeframe || null,
    timerange: timerange || null,
    start_date: startDate || null,
    end_date: endDate || null,
    pairs: Array.isArray(pairs) ? pairs : [],
    dry_run_wallet: Number.isFinite(wallet_num) && wallet_num > 0 ? wallet_num : null,
    max_open_trades:
      Number.isInteger(max_trades_num) && max_trades_num > 0 ? max_trades_num : null,
    backtest_status: runStatus || null,
    backtest_run_id: runId || null,
    api_session_id: sessionId || null,
  };

  return payload;
}

function activePanelFromState({ running, runStatus, runId, resultPanel, downloading }) {
  if (downloading || ["downloading", "queued", "running"].includes(runStatus)) {
    return "backtest_running";
  }
  if (resultPanel || runId) {
    return "backtest_result";
  }
  return "backtest_setup";
}