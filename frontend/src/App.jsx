import { useState, useCallback, useEffect } from "react";
import { useSharedState } from "./hooks/useSharedState.js";
import { useStrategies } from "./hooks/useStrategies.js";
import { usePairs } from "./hooks/usePairs.js";
import { useTheme } from "./hooks/useTheme.js";
import { useAgentUiState } from "./hooks/useAgentUiState.js";
import TopNav from "./components/TopNav.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import AssistantDrawer from "./components/appShell/AssistantDrawer.jsx";
import TabContentRenderer from "./components/appShell/TabContentRenderer.jsx";
import UnsavedChangesDialog from "./components/appShell/UnsavedChangesDialog.jsx";
import { buildAgentContext } from "./components/appShell/agentContext.js";
import GuidanceBubble from "./components/GuidanceBubble.jsx";

function App() {
  const [activeNavTab, setActiveNavTab] = useState("auto-quant");
  const [activeTab,    setActiveTab]    = useState("auto-quant");
  const [activeResult, setActiveResult] = useState(null);
  const [pendingTab,   setPendingTab]   = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);
  const [agentTabContext, setAgentTabContext] = useState({});
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantContext, setAssistantContext] = useState({});
  const [assistantRequest, setAssistantRequest] = useState({});
  const [deepNavigationTarget, setDeepNavigationTarget] = useState(null);
  const [strategyEditorDirty, setStrategyEditorDirty] = useState(false);

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
  const isWorkRunning = sharedState?.isWorkRunning || false;
  const { strategies, loading: strategiesLoading } = useStrategies();
  const { availablePairs, searchPairs } = usePairs();

  const handleLoadResult = (res) => {
    setActiveResult(res);
    setActiveTab("results");
    setActiveNavTab("results"); // With flat navigation, navTab equals tabId
  };

  const clearActiveResult = () => setActiveResult(null);

  const currentAgentOverrides = useCallback(() => (
    buildAgentContext({ activeTab, activeResult, agentTabContext })
  ), [activeResult, activeTab, agentTabContext]);

  const openAssistant = useCallback((request = {}) => {
    const requestContext = request.context || request.contextOverrides || {};
    const overrides = {
      ...currentAgentOverrides(),
      ...requestContext,
    };
    setAssistantContext(overrides);
    setAssistantRequest({
      initialPrompt: request.message || request.initialPrompt || "",
      initialMode: request.mode || (request.message || request.initialPrompt ? "analysis" : "auto"),
      initialIncludeStrategySource: Boolean(request.includeStrategySource),
      requestKey: request.requestKey || `${Date.now()}-${Math.random()}`,
    });
    setAssistantOpen(true);
    syncAgentUiState(overrides);
  }, [currentAgentOverrides, syncAgentUiState]);

  const handleNavTabChange = useCallback((navTab) => {
    if (navTab !== activeTab && activeTab === "strategy-editor" && strategyEditorDirty) {
      setPendingTab(navTab);
      return;
    }
    setActiveNavTab(navTab);
    // With flat navigation, navTab and activeTab are the same
    setActiveTab(navTab);
  }, [activeTab, strategyEditorDirty]);

  /**
   * FIX (Item 9): Deep navigation handler.
   * Accepts either a plain tab string (backward compat) or a payload object:
   *   { tab: "optimizer", optimizer_session_id: "...", run_id: "...", auto_quant_run_id: "..." }
   *
   * The tab is switched and any IDs are merged into agentTabContext so the
   * destination tab can pre-select the session/run where it already supports it.
   * If the destination tab does not yet support ID-based loading, the ID is
   * available in context for the AI assistant but no automatic load is triggered.
   */
  const handleDeepNavigate = useCallback((destination) => {
    const tabId = typeof destination === "string" ? destination : destination?.tab;
    if (!tabId) return;

    // Switch to the destination tab
    handleNavTabChange(tabId);

    // Merge any IDs into agentTabContext for downstream consumption
    if (destination && typeof destination === "object") {
      const { tab: _tab, ...ids } = destination;
      setDeepNavigationTarget(destination);
      if (Object.keys(ids).length > 0) {
        setAgentTabContext((prev) => ({ ...prev, ...ids }));
      }
    } else {
      setDeepNavigationTarget({ tab: tabId });
    }
  }, [handleNavTabChange]);

  const confirmLeave = () => {
    const dest = pendingTab;
    setPendingTab(null);
    setAgentTabContext({});
    setStrategyEditorDirty(false);
    setActiveTab(dest);
    setActiveNavTab(dest); // With flat navigation, navTab equals tabId
    if (dest !== "results") setActiveResult(null);
  };

  const cancelLeave = () => setPendingTab(null);

  useEffect(() => {
    syncAgentUiState(currentAgentOverrides());
  }, [currentAgentOverrides, syncAgentUiState]);

  return (
    <ToastProvider>
      <ErrorBoundary tabName="App">
        <div className="h-screen w-screen flex flex-col bg-base-100 text-base-content overflow-hidden">
          <div className="bg-orbs" />
          <div className="bg-dot-grid" />
          
          <TopNav
            activeTab={activeNavTab}
            onChange={handleNavTabChange}
            backendOnline={backendOnline}
            isWorkRunning={isWorkRunning}
          />

          <main className="flex-1 min-w-0 overflow-hidden">
            <div className="h-full overflow-y-auto pt-[56px] px-6 pb-6">
              <div className="max-w-[1600px] mx-auto">
                <TabContentRenderer
                  activeTab={activeTab}
                  tabProps={{
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
                    onDirtyChange: setStrategyEditorDirty,
                    onAskAi: openAssistant,
                    deepNavigationTarget,
                  }}
                />
              </div>
            </div>
          </main>

          {assistantOpen && (
            <AssistantDrawer
              context={assistantContext}
              request={assistantRequest}
              onClose={() => setAssistantOpen(false)}
            />
          )}

          <GuidanceBubble
            activeTab={activeTab}
            onNavigate={handleDeepNavigate}
            contextOverrides={currentAgentOverrides()}
          />

          {pendingTab && (
            <UnsavedChangesDialog
              onCancel={cancelLeave}
              onConfirm={confirmLeave}
            />
          )}
        </div>
      </ErrorBoundary>
    </ToastProvider>
  );
}

export default App;
