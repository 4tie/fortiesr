import { useCallback, useEffect, useMemo, useState } from "react";
import SetupPanel from "../features/pairExplorer/components/SetupPanel";
import HistoryPanel from "../features/pairExplorer/components/HistoryPanel";
import SessionHeader from "../features/pairExplorer/components/SessionHeader";
import SessionMeta from "../features/pairExplorer/components/SessionMeta";
import ProgressPanel from "../features/pairExplorer/components/ProgressPanel";
import { EmptyState, StartingState, WaitingForResultsState } from "../features/pairExplorer/components/PairExplorerStates";
import ResultsTable from "../features/pairExplorer/components/ResultsTable";
import { getPairExplorerSession, startPairExplorer } from "../features/pairExplorer/api";
import { TERMINAL_STATUSES } from "../features/pairExplorer/constants";
import { usePairExplorerForm } from "../features/pairExplorer/hooks/usePairExplorerForm";
import { usePairExplorerHistory } from "../features/pairExplorer/hooks/usePairExplorerHistory";
import { usePairExplorerPolling } from "../features/pairExplorer/hooks/usePairExplorerPolling";
import { usePairExplorerSelection } from "../features/pairExplorer/hooks/usePairExplorerSelection";
import { useSortableResults } from "../features/pairExplorer/hooks/useSortableResults";
import {
  buildStartPayload,
  normalizeStrategies,
  saveLastUsedPairPreset,
} from "../features/pairExplorer/utils";
import PageContainer from "./shared/PageContainer.jsx";
import PageHeader from "./shared/PageHeader.jsx";

export default function PairExplorerTab({
  strategies = [],
  strategiesLoading = false,
  sharedState = null,
  sharedLoading = false,
  syncSharedState = null,
}) {
  const {
    form,
    setField,
    setPairs,
  } = usePairExplorerForm({ sharedState, sharedLoading, syncSharedState });
  const normalizedStrategies = useMemo(() => normalizeStrategies(strategies), [strategies]);
  const {
    pastSessions,
    historyLoading,
    loadHistory,
  } = usePairExplorerHistory();

  const [sessionId, setSessionId] = useState(null);
  const [session, setSession] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [nowMs, setNowMs] = useState(null);

  const rawResults = session?.results || [];
  const {
    sortCol,
    sortDir,
    sortedResults,
    toggleSort,
  } = useSortableResults(rawResults);
  const {
    checkedPairs,
    setCheckedPairs,
    applying,
    applySuccess,
    resetSelection,
    applyPairs,
  } = usePairExplorerSelection();

  const totalPairs = session?.total || 0;
  const completedPairs = session?.completed || 0;
  const progressPct = totalPairs > 0 ? Math.min(100, (completedPairs / totalPairs) * 100) : 0;
  const failedCount = sortedResults.filter((row) => row.status === "failed").length;
  const completedCount = sortedResults.filter((row) => row.status === "completed").length;
  const canRun = Boolean(form.strategyName && form.dateStart && form.dateEnd && form.pairs.length > 0 && !isRunning);

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleTerminalSession = useCallback(() => {
    setIsRunning(false);
    void loadHistory();
  }, [loadHistory]);

  const {
    startPolling,
    stopPolling,
  } = usePairExplorerPolling({
    onSession: setSession,
    onTerminal: handleTerminalSession,
  });

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleRun = async () => {
    if (!form.strategyName) return;
    setSubmitError(null);
    setSession(null);
    setIsRunning(true);
    resetSelection();

    try {
      const payload = buildStartPayload(form);
      const data = await startPairExplorer(payload);
      saveLastUsedPairPreset(form);
      setSessionId(data.session_id);
      startPolling(data.session_id);
      if (syncSharedState) {
        syncSharedState({
          strategy_name: form.strategyName,
          timeframe: form.timeframe,
          start_date: form.dateStart,
          end_date: form.dateEnd,
          pairs: form.pairs,
          dry_run_wallet: parseFloat(form.wallet) || 1000,
          max_open_trades: parseInt(form.maxTrades, 10) || 1,
        });
      }
    } catch (err) {
      setSubmitError(err.message || String(err));
      setIsRunning(false);
    }
  };

  const handleLoadSession = async (id) => {
    try {
      stopPolling();
      const data = await getPairExplorerSession(id);
      setSession(data);
      setSessionId(id);
      setIsRunning(!TERMINAL_STATUSES.has(data.status));
      resetSelection();
      if (!TERMINAL_STATUSES.has(data.status)) {
        startPolling(id);
      }
    } catch (err) {
      console.debug("Failed to load pair explorer session:", err);
    }
  };

  return (
    <PageContainer className="!px-0 !py-0 !max-w-full">
      <div className="h-full flex flex-col overflow-hidden">
        <SessionHeader
          session={session}
          isRunning={isRunning}
          completedPairs={completedPairs}
          totalPairs={totalPairs}
          failedCount={failedCount}
          onRun={handleRun}
          canRun={canRun}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <aside className="w-72 shrink-0 border-r border-base-300 bg-base-200/40 flex flex-col overflow-y-auto">
            <SetupPanel
              form={form}
              strategies={normalizedStrategies}
              strategiesLoading={strategiesLoading}
              isRunning={isRunning}
              submitError={submitError}
              setField={setField}
              setPairs={setPairs}
            />
            <HistoryPanel
              open={historyOpen}
              onToggle={() => setHistoryOpen((open) => !open)}
              sessions={pastSessions}
              loading={historyLoading}
              activeSessionId={sessionId}
              nowMs={nowMs}
              onLoadSession={handleLoadSession}
              onRefresh={loadHistory}
            />
          </aside>

          <main className="flex-1 min-w-0 overflow-y-auto flex flex-col">
            <SessionMeta
              session={session}
              isRunning={isRunning}
              sessionId={sessionId}
              completedCount={completedCount}
              failedCount={failedCount}
            />
            <ProgressPanel
              session={session}
              isRunning={isRunning}
              completedPairs={completedPairs}
              totalPairs={totalPairs}
              progressPct={progressPct}
            />

            {!session && !isRunning && (
              <EmptyState hasHistory={pastSessions.length > 0} />
            )}
            {isRunning && !session && <StartingState />}
            {session && sortedResults.length === 0 && (
              <WaitingForResultsState session={session} />
            )}

            <ResultsTable
              sortedResults={sortedResults}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={toggleSort}
              checkedPairs={checkedPairs}
              setCheckedPairs={setCheckedPairs}
              applying={applying}
              applySuccess={applySuccess}
              onApplyPairs={() => applyPairs({ syncSharedState })}
              syncEnabled={Boolean(syncSharedState)}
            />
          </main>
        </div>
      </div>
    </PageContainer>
  );
}
