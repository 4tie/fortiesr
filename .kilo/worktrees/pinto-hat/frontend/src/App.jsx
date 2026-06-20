import { useState, useCallback, useEffect } from "react";
import { useSharedState } from "./hooks/useSharedState.js";
import { useStrategies } from "./hooks/useStrategies.js";
import { usePairs } from "./hooks/usePairs.js";
import { useTheme } from "./hooks/useTheme.js";
import BacktestForm from "./components/BacktestForm.jsx";
import NavPanel from "./components/NavPanel.jsx";
import ResultsView from "./components/ResultsView.jsx";
import BacktestResults from "./components/BacktestResults.jsx";
import SettingsTab from "./components/SettingsTab.jsx";
import StressTestTab from "./components/StressTestTab.jsx";
import OptimizerTab from "./components/OptimizerTab.jsx";
import StrategyEditorTab from "./components/StrategyEditorTab.jsx";
import PerformanceTab from "./components/PerformanceTab.jsx";
import PairExplorerTab from "./components/PairExplorerTab.jsx";
import AutoQuantTab from "./components/AutoQuantTab.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ThemeSwitcher from "./components/ThemeSwitcher.jsx";
import { ToastProvider } from "./components/Toast.jsx";

const TAB_LABELS = {
  "backtest":        "Backtest",
  "results":         "Results",
  "stress-test":     "Stress Test Lab",
  "optimizer":       "Optimizer",
  "pair-explorer":   "Pair Explorer",
  "auto-quant":      "Auto-Quant Factory",
  "strategy-editor": "Strategy Editor",
  "performance":     "Performance",
  "settings":        "Settings",
};

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

function AppHeader({ activeTab, backendOnline }) {
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
        <StatusDot online={backendOnline} />
        <ThemeSwitcher />
      </div>
    </header>
  );
}

function App() {
  const [activeTab,    setActiveTab]    = useState("backtest");
  const [activeResult, setActiveResult] = useState(null);
  const [editorDirty,  setEditorDirty]  = useState(false);
  const [pendingTab,   setPendingTab]   = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);

  useTheme();

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

  const handleTabChange = useCallback((tab) => {
    if (activeTab === "strategy-editor" && editorDirty && tab !== "strategy-editor") {
      setPendingTab(tab);
      return;
    }
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
    setActiveTab(dest);
    if (dest !== "results") setActiveResult(null);
  };

  const cancelLeave = () => setPendingTab(null);

  return (
    <ToastProvider>
    <div className="h-screen flex flex-col bg-base-100 text-base-content overflow-hidden">
      <AppHeader
        activeTab={activeTab}
        backendOnline={backendOnline}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">

        <NavPanel activeItem={activeTab} onChange={handleTabChange} />

        <main className="flex-1 min-w-0 overflow-y-auto bg-base-100">
          {activeTab === "backtest" && (
            <ErrorBoundary tabName="Backtest">
              <BacktestForm
                strategies={strategies}
                strategiesLoading={strategiesLoading}
                availablePairs={availablePairs}
                searchPairs={searchPairs}
                sharedState={sharedState}
                sharedLoading={sharedLoading}
                syncSharedState={syncSharedState}
              />
            </ErrorBoundary>
          )}

          {activeTab === "results" && (
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
          )}

          {activeTab === "stress-test" && (
            <ErrorBoundary tabName="Stress Test">
              <StressTestTab
                strategies={strategies}
                strategiesLoading={strategiesLoading}
                availablePairs={availablePairs}
                searchPairs={searchPairs}
                sharedState={sharedState}
                sharedLoading={sharedLoading}
                syncSharedState={syncSharedState}
              />
            </ErrorBoundary>
          )}

          {activeTab === "optimizer" && (
            <ErrorBoundary tabName="Optimizer">
              <OptimizerTab
                strategies={strategies}
                strategiesLoading={strategiesLoading}
                sharedState={sharedState}
                sharedLoading={sharedLoading}
                syncSharedState={syncSharedState}
              />
            </ErrorBoundary>
          )}

          {activeTab === "pair-explorer" && (
            <ErrorBoundary tabName="Pair Explorer">
              <PairExplorerTab
                strategies={strategies}
                strategiesLoading={strategiesLoading}
                sharedState={sharedState}
                sharedLoading={sharedLoading}
                syncSharedState={syncSharedState}
              />
            </ErrorBoundary>
          )}

          {activeTab === "auto-quant" && (
            <ErrorBoundary tabName="Auto-Quant Factory">
              <AutoQuantTab
                strategies={strategies}
                strategiesLoading={strategiesLoading}
              />
            </ErrorBoundary>
          )}

          {activeTab === "strategy-editor" && (
            <ErrorBoundary tabName="Strategy Editor">
              <StrategyEditorTab
                onDirtyChange={setEditorDirty}
              />
            </ErrorBoundary>
          )}

          {activeTab === "performance" && (
            <ErrorBoundary tabName="Performance">
              <PerformanceTab
                strategies={strategies}
                strategiesLoading={strategiesLoading}
              />
            </ErrorBoundary>
          )}

          {activeTab === "settings" && (
            <ErrorBoundary tabName="Settings">
              <SettingsTab />
            </ErrorBoundary>
          )}
        </main>
      </div>

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
    </ToastProvider>
  );
}

export default App;
