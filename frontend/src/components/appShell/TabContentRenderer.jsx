import BacktestResults from "../BacktestResults.jsx";
import ErrorBoundary from "../ErrorBoundary.jsx";
import ResultsView from "../ResultsView.jsx";
import { getTabConfig } from "../tabs/registry.js";

function ResultsTabContent({ activeResult, clearActiveResult, handleLoadResult, onAskAi }) {
  return (
    <ErrorBoundary tabName="Results">
      {activeResult ? (
        <div className="py-6">
          <div className="mx-auto w-full max-w-5xl px-6 mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight font-heading">Result Details</h2>
            <button className="btn btn-sm btn-ghost" onClick={clearActiveResult}>
              &larr; Back to list
            </button>
          </div>
          <BacktestResults
            results={activeResult.results}
            runId={activeResult.run_id}
            strategyName={activeResult.strategy_name}
            onAnalyzeResult={({ runId, message }) => onAskAi?.({
              context: {
                active_tab: "results",
                active_panel: "backtest_result",
                strategy_name: activeResult.strategy_name || null,
                backtest_run_id: runId,
              },
              message,
              mode: "analysis",
            })}
            onAnalyzeReadiness={({ message, context }) => onAskAi?.({
              context: {
                ...context,
                active_tab: "results",
                active_panel: "candidate_readiness",
                strategy_name: context?.strategy_name || activeResult.strategy_name || null,
                backtest_run_id: context?.backtest_run_id || activeResult.run_id,
              },
              message,
              mode: "analysis",
            })}
          />
        </div>
      ) : (
        <ResultsView onLoadResult={handleLoadResult} />
      )}
    </ErrorBoundary>
  );
}

function BacktestTabContent({ component: TabComponent, tabProps }) {
  const {
    strategies,
    strategiesLoading,
    availablePairs,
    searchPairs,
    sharedState,
    sharedLoading,
    syncSharedState,
    onAskAi,
    onAgentContextChange,
    deepNavigationTarget,
  } = tabProps;

  return (
    <ErrorBoundary tabName="Backtest">
      <TabComponent
        strategies={strategies}
        strategiesLoading={strategiesLoading}
        availablePairs={availablePairs}
        searchPairs={searchPairs}
        sharedState={sharedState}
        sharedLoading={sharedLoading}
        syncSharedState={syncSharedState}
        onAskAi={onAskAi}
        onAgentContextChange={onAgentContextChange}
        deepNavigationTarget={deepNavigationTarget}
      />
    </ErrorBoundary>
  );
}

function AutoQuantTabContent({ component: TabComponent, tabProps }) {
  const {
    strategies,
    strategiesLoading,
    sharedState,
    sharedLoading,
    syncSharedState,
    onAskAi,
    deepNavigationTarget,
    // FIX (Item 8): forward onAgentContextChange so AutoQuantOverview can
    // report active_tab, pipeline stage, run IDs, etc. to the Mini Assistant.
    onAgentContextChange,
  } = tabProps;

  return (
    <ErrorBoundary tabName="AutoQuant">
      <TabComponent
        strategies={strategies}
        strategiesLoading={strategiesLoading}
        sharedState={sharedState}
        sharedLoading={sharedLoading}
        syncSharedState={syncSharedState}
        onAskAi={onAskAi}
        onAgentContextChange={onAgentContextChange}
        deepNavigationTarget={deepNavigationTarget}
      />
    </ErrorBoundary>
  );
}

export default function TabContentRenderer({ activeTab, tabProps }) {
  const tabConfig = getTabConfig(activeTab);
  if (!tabConfig) return null;

  const TabComponent = tabConfig.component;

  if (activeTab === "results") {
    return (
      <ResultsTabContent
        activeResult={tabProps.activeResult}
        clearActiveResult={tabProps.clearActiveResult}
        handleLoadResult={tabProps.handleLoadResult}
        onAskAi={tabProps.onAskAi}
      />
    );
  }

  if (activeTab === "backtest") {
    return <BacktestTabContent component={TabComponent} tabProps={tabProps} />;
  }

  if (activeTab === "auto-quant") {
    return <AutoQuantTabContent component={TabComponent} tabProps={tabProps} />;
  }

  return (
    <ErrorBoundary tabName={tabConfig.label}>
      <TabComponent {...tabProps} />
    </ErrorBoundary>
  );
}
