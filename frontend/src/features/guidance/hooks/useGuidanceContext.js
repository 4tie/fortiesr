import { useState, useEffect, useCallback } from "react";

const WORKFLOW_STEPS = [
  { id: "pair-explorer", label: "Pair Explorer", description: "Screen trading pairs", order: 1 },
  { id: "optimizer", label: "Optimizer", description: "Optimize parameters", order: 2 },
  { id: "backtest", label: "Backtest", description: "Validate strategy", order: 3 },
  { id: "stress-test", label: "Stress Test", description: "Test robustness", order: 4 },
];

/**
 * Hook for detecting and managing user context for AI guidance
 * Monitors current page, user actions, and application state
 */
export function useGuidanceContext(activeTab = null) {
  const [context, setContext] = useState({
    currentPage: null,
    activeTab: activeTab,
    strategy: null,
    backtestRunning: false,
    backtestResults: null,
    pipelineRunning: false,
    pipelineStage: null,
    userGoal: null,
    workflowStep: null,
  });

  // Detect current page based on activeTab
  useEffect(() => {
    let pageContext = {
      currentPage: "unknown",
      activeTab: activeTab,
    };

    if (activeTab === "auto-quant") {
      pageContext = { currentPage: "auto-quant", activeTab: "auto-quant" };
    } else if (activeTab === "strategy-lab") {
      pageContext = { currentPage: "strategy-lab", activeTab: "strategy-lab" };
    } else if (activeTab === "results") {
      pageContext = { currentPage: "results", activeTab: "results" };
    } else if (activeTab === "optimizer") {
      pageContext = { currentPage: "optimizer", activeTab: "optimizer", workflowStep: WORKFLOW_STEPS.find(s => s.id === "optimizer") };
    } else if (activeTab === "pair-explorer") {
      pageContext = { currentPage: "pair-explorer", activeTab: "pair-explorer", workflowStep: WORKFLOW_STEPS.find(s => s.id === "pair-explorer") };
    } else if (activeTab === "backtest") {
      pageContext = { currentPage: "backtest", activeTab: "backtest", workflowStep: WORKFLOW_STEPS.find(s => s.id === "backtest") };
    } else if (activeTab === "stress-test") {
      pageContext = { currentPage: "stress-test", activeTab: "stress-test", workflowStep: WORKFLOW_STEPS.find(s => s.id === "stress-test") };
    }

    setContext((prev) => ({ ...prev, ...pageContext }));
  }, [activeTab]);

  // Update context with specific data
  const updateContext = useCallback((updates) => {
    setContext((prev) => ({ ...prev, ...updates }));
  }, []);

  // Detect strategy selection
  const setStrategy = useCallback((strategy) => {
    updateContext({ strategy });
  }, [updateContext]);

  // Detect backtest state
  const setBacktestState = useCallback((running, results = null) => {
    updateContext({ backtestRunning: running, backtestResults: results });
  }, [updateContext]);

  // Detect pipeline state
  const setPipelineState = useCallback((running, stage = null) => {
    updateContext({ pipelineRunning: running, pipelineStage: stage });
  }, [updateContext]);

  // Set user's stated goal
  const setUserGoal = useCallback((goal) => {
    updateContext({ userGoal: goal });
  }, [updateContext]);

  // Get next step in workflow based on current position
  const getNextStep = useCallback(() => {
    const currentStep = context.workflowStep;
    if (!currentStep) return null;

    const nextStep = WORKFLOW_STEPS.find(s => s.order === currentStep.order + 1);
    if (!nextStep) {
      // Completed workflow
      if (currentStep.order === 4) {
        return {
          message: "Complete! Strategy is ready for live testing",
          action: null,
          tabId: null,
        };
      }
      return null;
    }

    const messages = {
      "pair-explorer": {
        message: "Next: Go to Optimizer to optimize parameters for selected pairs",
        action: "Go to Optimizer",
        tabId: "optimizer",
      },
      "optimizer": {
        message: "Next: Run Backtest to validate optimized parameters",
        action: "Go to Backtest",
        tabId: "backtest",
      },
      "backtest": {
        message: "Next: Run Stress Test to test robustness",
        action: "Go to Stress Test",
        tabId: "stress-test",
      },
    };

    return messages[currentStep.id] || null;
  }, [context.workflowStep]);

  // Get context-aware suggestions
  const getContextSuggestions = useCallback(() => {
    const suggestions = [];

    // Page-specific suggestions
    switch (context.currentPage) {
      case "auto-quant":
        suggestions.push({
          type: "info",
          message: "You're in the AutoQuant pipeline. This is for automated strategy discovery and optimization.",
          action: "Start a new pipeline run to discover strategies automatically.",
        });
        if (context.pipelineRunning) {
          suggestions.push({
            type: "progress",
            message: `Pipeline is running at stage: ${context.pipelineStage || "initializing"}`,
            action: "Monitor progress or adjust parameters.",
          });
        }
        break;

      case "strategy-lab":
        suggestions.push({
          type: "info",
          message: "You're in Strategy Lab. This is for manual strategy development and testing.",
          action: "Create a new strategy or test an existing one.",
        });
        if (context.strategy) {
          suggestions.push({
            type: "action",
            message: `Strategy selected: ${context.strategy}`,
            action: "Run backtest or optimize parameters.",
          });
        }
        break;

      case "results":
        suggestions.push({
          type: "info",
          message: "You're viewing backtest results.",
          action: "Analyze performance metrics or export results.",
        });
        if (context.backtestResults) {
          const { profit, drawdown, winRate } = context.backtestResults;
          if (profit < 0) {
            suggestions.push({
              type: "warning",
              message: "Backtest shows negative profit. Strategy needs improvement.",
              action: "Try parameter optimization or pair filtering.",
            });
          } else if (drawdown > 20) {
            suggestions.push({
              type: "warning",
              message: `High drawdown (${drawdown}%). Consider adjusting stoploss.`,
              action: "Optimize risk management parameters.",
            });
          } else if (winRate < 40) {
            suggestions.push({
              type: "warning",
              message: `Low win rate (${winRate}%). Entry/exit signals may need adjustment.`,
              action: "Refine indicator parameters or add filters.",
            });
          } else {
            suggestions.push({
              type: "success",
              message: "Strategy looks promising!",
              action: "Consider out-of-sample validation or live testing.",
            });
          }
        }
        break;

      case "optimizer":
        suggestions.push({
          type: "info",
          message: "You're in the optimizer. This uses genetic algorithms to find optimal parameters.",
          action: "Configure optimization settings and run evolution.",
        });
        break;

      case "pair-explorer":
        suggestions.push({
          type: "info",
          message: "You're exploring trading pairs.",
          action: "Screen pairs for your strategy or analyze pair characteristics.",
        });
        break;

      default:
        suggestions.push({
          type: "info",
          message: "Welcome to FortiesR. Select a tab to get started.",
          action: "Try AutoQuant for automated discovery or Strategy Lab for manual development.",
        });
    }

    return suggestions;
  }, [context]);

  return {
    context,
    updateContext,
    setStrategy,
    setBacktestState,
    setPipelineState,
    setUserGoal,
    getContextSuggestions,
    getNextStep,
    WORKFLOW_STEPS,
  };
}
