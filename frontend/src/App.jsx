import { useState, useCallback, useEffect } from "react";
import { useSharedState } from "./hooks/useSharedState.js";
import { useStrategies } from "./hooks/useStrategies.js";
import { usePairs } from "./hooks/usePairs.js";
import { useTheme } from "./hooks/useTheme.js";
import { useAgentUiState } from "./hooks/useAgentUiState.js";
import BacktestResults from "./components/BacktestResults.jsx";
import ResultsView from "./components/ResultsView.jsx";
import NavPanel from "./components/NavPanel.jsx";
import AssistantChatPanel from "./components/AssistantChatPanel.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ThemeSwitcher from "./components/ThemeSwitcher.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import { TAB_LABELS, ASK_AI_TABS, getTabConfig } from "./components/tabs/registry.js";
import { SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";

function StatusDot({ online }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
      online
        ? "border-success/30 text-success bg-success/10"
        : "border-error/30 text-error bg-error/10"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-success animate-pulse" : "bg-error"}`} />
      {online ? "Backend Online" : "Backend Offline"}
    </span>
  );
}

function AppHeader({ activeTab, backendOnline, onAskAi }) {
  return (
    <header className="h-12 shrink-0 bg-base-200 border-b border-base-300 flex items-center px-4 gap-4 z-30">
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-md bg-primary text-primary-content flex items-center justify-center font-bold text-xs">
          SL
        </div>
        <span className="text-sm font-bold tracking-tight hidden sm:block">Strategy Lab</span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-base-content/40">
        <span className="hidden md:block">·</span>
        <span className="hidden md:block text-base-content/60 font-medium">
          {TAB_LABELS[activeTab] || activeTab}
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {ASK_AI_TABS.has(activeTab) && (
          <button
            type="button"
            className="btn btn-xs btn-ghost border border-primary/25 text-primary gap-1.5"
            onClick={onAskAi}
            title="Ask AI about the current context"
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>
        )}
        <StatusDot online={backendOnline} />
        <ThemeSwitcher />
      </div>
    </header>
  );
}

function renderTabContent(activeTab, tabProps) {
  const tabConfig = getTabConfig(activeTab);
  if (!tabConfig) return null;

  const TabComponent = tabConfig.component;
  
  // Special handling for results tab
  if (activeTab === "results") {
    const { activeResult, clearActiveResult, handleLoadResult } = tabProps;
    return (
      <ErrorBoundary tabName="Results">
        {activeResult ? (
          <div className="py-6">
            <div className="mx-auto w-full max-w-5xl px-6 mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Result Details</h2>
              <button className="btn btn-sm btn-ghost" onClick={clearActiveResult}>
                ← Back to list
              </button>
            </div>
            <BacktestResults results={activeResult.results} runId={activeResult.run_id} />
          </div>
        ) : (
          <ResultsView onLoadResult={handleLoadResult} />
        )}
      </ErrorBoundary>
    );
  }

  // Special handling for backtest tab (needs BacktestForm)
  if (activeTab === "backtest") {
    const { strategies, strategiesLoading, availablePairs, searchPairs, sharedState, sharedLoading, syncSharedState } = tabProps;
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
        />
      </ErrorBoundary>
    );
  }

  // Standard tab rendering
  return (
    <ErrorBoundary tabName={tabConfig.label}>
      <TabComponent {...tabProps} />
    </ErrorBoundary>
  );
}

function App() {
  const [activeTab,    setActiveTab]    = useState("backtest");
  const [activeResult, setActiveResult] = useState(null);
  const [editorDirty,  setEditorDirty]  = useState(false);
  const [pendingTab,   setPendingTab]   = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);
  const [agentTabContext, setAgentTabContext] = useState({});
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantContext, setAssistantContext] = useState({});

  useTheme();
  const syncAgentUiState = useAgentUiState();

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      fetch("/health")
        .then(r => { if (!cancelled) setBackendOnline(r.ok); })
        .catch(() => { if (!cancelled) setBackendOnline(false); });
    };
    check();
    const id = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const { state: sharedState, loading: sharedLoading, sync: syncSharedState } = useSharedState();
  const { strategies, loading: strategiesLoading } = useStrategies();
  const { availablePairs, searchPairs } = usePairs();

  const handleLoadResult = (res) => {
    setActiveResult(res);
    setActiveTab("results");
  };

  const clearActiveResult = () => setActiveResult(null);

  const currentAgentOverrides = useCallback(() => {
    const scoped = ["auto-quant", "optimizer", "strategy-editor", "performance"].includes(activeTab)
      ? agentTabContext
      : {};
    return {
      active_tab: activeTab,
      active_panel: scoped.active_panel ?? null,
      strategy_name: scoped.strategy_name ?? null,
      auto_quant_run_id: activeTab === "auto-quant" ? scoped.auto_quant_run_id ?? null : null,
      optimizer_session_id: activeTab === "optimizer" ? scoped.optimizer_session_id ?? null : null,
      optimizer_trial_number: activeTab === "optimizer" ? scoped.optimizer_trial_number ?? null : null,
      backtest_run_id: activeTab === "results" ? activeResult?.run_id ?? null : scoped.backtest_run_id ?? null,
      api_session_id: scoped.api_session_id ?? null,
    };
  }, [activeResult?.run_id, activeTab, agentTabContext]);

  const openAssistant = useCallback(() => {
    const overrides = currentAgentOverrides();
    setAssistantContext(overrides);
    setAssistantOpen(true);
    syncAgentUiState(overrides);
  }, [currentAgentOverrides, syncAgentUiState]);

  const handleTabChange = useCallback((tab) => {
    if (activeTab === "strategy-editor" && editorDirty && tab !== "strategy-editor") {
      setPendingTab(tab);
      return;
    }
    setAgentTabContext({});
    setActiveTab(tab);
    if (tab !== "results") setActiveResult(null);
    if (tab !== "strategy-editor") {
      setEditorDirty(false);
    }
  }, [activeTab, editorDirty]);

  const confirmLeave = () => {
    const dest = pendingTab;
    setPendingTab(null);
    setEditorDirty(false);
    setAgentTabContext({});
    setActiveTab(dest);
    if (dest !== "results") setActiveResult(null);
  };

  const cancelLeave = () => setPendingTab(null);

  useEffect(() => {
    const scoped = ["auto-quant", "optimizer", "strategy-editor", "performance"].includes(activeTab)
      ? agentTabContext
      : {};
    syncAgentUiState({
      active_tab: activeTab,
      active_panel: scoped.active_panel ?? null,
      strategy_name: scoped.strategy_name ?? null,
      auto_quant_run_id: activeTab === "auto-quant" ? scoped.auto_quant_run_id ?? null : null,
      optimizer_session_id: activeTab === "optimizer" ? scoped.optimizer_session_id ?? null : null,
      optimizer_trial_number: activeTab === "optimizer" ? scoped.optimizer_trial_number ?? null : null,
      backtest_run_id: activeTab === "results" ? activeResult?.run_id ?? null : scoped.backtest_run_id ?? null,
      api_session_id: scoped.api_session_id ?? null,
    });
  }, [activeTab, activeResult?.run_id, agentTabContext, syncAgentUiState]);

  return (
    <ToastProvider>
    <ErrorBoundary tabName="App">
      <div className="h-screen flex flex-col bg-base-100 text-base-content overflow-hidden">
        <AppHeader
          activeTab={activeTab}
          backendOnline={backendOnline}
          onAskAi={openAssistant}
        />

      <div className="flex flex-1 min-h-0 overflow-hidden">

        <NavPanel activeItem={activeTab} onChange={handleTabChange} />

        <main className="flex-1 min-w-0 overflow-y-auto bg-base-100">
          {renderTabContent(activeTab, {
            strategies,
            strategiesLoading,
            availablePairs,
            searchPairs,
            sharedState,
            sharedLoading,
            syncSharedState,
            activeResult,
            clearActiveResult,
            handleLoadResult,
            onAgentContextChange: setAgentTabContext,
            onDirtyChange: setEditorDirty,
          })}
        </main>
      </div>

      {assistantOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[1px]">
          <div className="w-full max-w-2xl h-full bg-base-100 border-l border-base-300 shadow-2xl">
            <AssistantChatPanel
              mode="drawer"
              initialContextOverrides={assistantContext}
              onClose={() => setAssistantOpen(false)}
            />
          </div>
          <button
            type="button"
            className="absolute left-4 top-4 btn btn-sm btn-circle bg-base-100/90 border border-base-300"
            onClick={() => setAssistantOpen(false)}
            title="Close AI Assistant"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {pendingTab && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-1">⚠️ Unsaved Changes!</h3>
            <p className="text-sm text-base-content/70">
              You have unsaved modifications in your strategy code. Are you sure you want to
              leave without saving?
            </p>
            <div className="modal-action mt-4">
              <button className="btn btn-ghost btn-sm" onClick={cancelLeave}>Cancel</button>
              <button className="btn btn-error btn-sm" onClick={confirmLeave}>Leave Anyway</button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/40" onClick={cancelLeave} />
        </dialog>
      )}
      </div>
    </ErrorBoundary>
    </ToastProvider>
  );
}

export default App;
