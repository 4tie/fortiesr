/**
 * ContextualPromptSuggestions
 *
 * Displays contextual prompt suggestions based on the current application state.
 * Currently supports AutoQuant run states with different prompts for:
 * - Before run (pipeline_status: null or "not_started")
 * - During run (pipeline_status: "running")
 * - Awaiting approval (pipeline_status: "awaiting_user_approval")
 * - After completion (pipeline_status: "completed", "failed", "cancelled")
 */

export function formatContextStrip(context) {
  const { active_tab, strategy_name, pipeline_status, current_stage, optimizer_session_id, backtest_run_id } = context;

  const parts = [];

  // Tab name
  const tabNames = {
    "auto-quant": "AutoQuant",
    "optimizer": "Optimizer",
    "backtest": "Backtest",
    "results": "Results",
    "strategy-editor": "Strategy Editor",
    "performance": "Performance",
    "pair-explorer": "Pair Explorer",
  };
  parts.push(tabNames[active_tab] || active_tab);

  // Strategy name if available
  if (strategy_name) {
    parts.push(strategy_name);
  }

  // AutoQuant-specific context
  if (active_tab === "auto-quant" && pipeline_status) {
    if (current_stage && pipeline_status === "running") {
      parts.push(`Stage ${current_stage}/6 · Running`);
    } else if (pipeline_status === "running") {
      parts.push("Running");
    } else if (pipeline_status === "awaiting_user_approval") {
      parts.push("Awaiting approval");
    } else if (pipeline_status === "completed") {
      parts.push("Completed");
    } else if (pipeline_status === "failed") {
      parts.push("Failed");
    } else if (pipeline_status === "cancelled") {
      parts.push("Cancelled");
    }
  }

  // Optimizer-specific context
  if (active_tab === "optimizer" && optimizer_session_id) {
    parts.push("Session active");
  }

  // Results-specific context
  if (active_tab === "results" && backtest_run_id) {
    parts.push("Backtest loaded");
  }

  return parts.join(" · ");
}

export function getContextualPrompts(context) {
  const { active_tab, pipeline_status, current_stage, auto_quant_run_id } = context;

  // AutoQuant-specific prompts
  if (active_tab === "auto-quant" && auto_quant_run_id) {
    if (!pipeline_status || pipeline_status === "not_started") {
      return [
        {
          title: "Review my current AutoQuant setup",
          prompt: "Review my current AutoQuant setup. Explain what the pipeline will do, what inputs are selected, and whether anything important is missing before I start.",
        },
        {
          title: "Explain the pipeline stages",
          prompt: "Explain what each stage of the AutoQuant pipeline does and how they work together to discover profitable strategies.",
        },
      ];
    }

    if (pipeline_status === "running") {
      return [
        {
          title: "Summarize the current workflow",
          prompt: "Review the current AutoQuant run. Tell me which stage it is in, what stages have completed, what has been discovered so far, any warnings or blockers, and what the pipeline will do next.",
        },
        {
          title: "Explain the current findings",
          prompt: "What is working well in this run? What is failing or showing weak results? Are there any concerning patterns in the data?",
        },
        {
          title: "Check for blockers",
          prompt: "Is anything preventing progress in the current run? Are there any errors, warnings, or issues that need attention?",
        },
      ];
    }

    if (pipeline_status === "awaiting_user_approval") {
      return [
        {
          title: "Explain what needs approval",
          prompt: "Explain what AutoQuant is waiting for me to review. Tell me why the current pairs or candidates were selected or rejected and what I should check before approving.",
        },
        {
          title: "Analyze the selected candidates",
          prompt: "Analyze the current candidates. What makes them strong or weak? What metrics should I focus on when deciding?",
        },
        {
          title: "Compare with alternatives",
          prompt: "How do the current candidates compare to what was rejected? What trade-offs am I making by approving these?",
        },
      ];
    }

    if (pipeline_status === "completed" || pipeline_status === "failed" || pipeline_status === "cancelled") {
      return [
        {
          title: "Summarize the completed run",
          prompt: "Summarize the completed AutoQuant run. Explain the strongest findings, weakest evidence, why the final candidate passed or failed, and the most logical next step.",
        },
        {
          title: "Analyze the results",
          prompt: "What were the key results from this run? What performed well and what didn't? What insights can we take forward?",
        },
        {
          title: "Suggest improvements",
          prompt: "Based on the results, what should I change for the next run? Are there configuration adjustments, different pairs, or strategy parameters to try?",
        },
      ];
    }
  }

  // Optimizer-specific prompts
  if (active_tab === "optimizer" && context.optimizer_session_id) {
    return [
      {
        title: "Summarize optimizer progress",
        prompt: "Summarize the current optimizer progress. Tell me how many trials have completed, the best result so far, and whether the search is improving.",
      },
      {
        title: "Explain the current best trial",
        prompt: "Explain the current best trial in simple terms. What parameters changed, what improved, and what risks remain?",
      },
      {
        title: "Compare best trial with current strategy",
        prompt: "Compare the best trial against the current strategy parameters and explain whether promotion is justified.",
      },
      {
        title: "Investigate trial failures",
        prompt: "Investigate why some trials are failing or producing zero trades.",
      },
    ];
  }

  // Backtest-specific prompts
  if (active_tab === "backtest" && context.backtest_run_id) {
    return [
      {
        title: "Run a backtest with current settings",
        prompt: "Run a backtest using the currently selected strategy, pairs, timeframe, and timerange.",
      },
      {
        title: "Analyze the latest backtest result",
        prompt: "Analyze the latest backtest result. Explain profitability, profit factor, drawdown, expectancy, trade count, and the biggest weaknesses.",
      },
      {
        title: "Analyze pair performance",
        prompt: "Tell me which pairs are helping the strategy and which pairs are hurting the overall result.",
      },
      {
        title: "Suggest next step based on evidence",
        prompt: "Based on the real backtest evidence, tell me whether this strategy should go to Optimizer, Pair Explorer, AutoQuant, or be rejected.",
      },
    ];
  }

  // Results-specific prompts
  if (active_tab === "results" && context.backtest_run_id) {
    return [
      {
        title: "Analyze this result",
        prompt: "Analyze this result and explain what actually happened.",
      },
      {
        title: "Identify the biggest weakness",
        prompt: "What is the biggest weakness in this result?",
      },
      {
        title: "Check for robustness",
        prompt: "Is this result robust enough to continue, or is there evidence of overfitting or weak generalization?",
      },
      {
        title: "Suggest next validation step",
        prompt: "Suggest the next validation step based only on the current result.",
      },
    ];
  }

  // Pair Explorer prompts
  if (active_tab === "pair-explorer" && context.strategy_name) {
    return [
      {
        title: "Find promising pairs",
        prompt: "Find more promising pairs for the current strategy using the real available pair universe.",
      },
      {
        title: "Compare and rank pairs",
        prompt: "Compare the current Pair Explorer results and rank the strongest pairs using real profitability, profit factor, expectancy, drawdown, and trade count.",
      },
      {
        title: "Compare specific pair",
        prompt: "Compare JTO/USDT against the other tested pairs and explain which pairs are worth testing together with it.",
      },
    ];
  }

  // Strategy editor prompts
  if (active_tab === "strategy-editor" && context.strategy_name) {
    return [
      {
        title: "Read and explain strategy",
        prompt: "Read the current strategy and explain its entry logic, exit logic, indicators, ROI, stoploss, and risk behavior.",
      },
      {
        title: "Check for logical problems",
        prompt: "Check this strategy for obvious logical problems without changing any files.",
      },
      {
        title: "Explain optimizable parameters",
        prompt: "Explain which parameters are currently optimizable and which ones are fixed.",
      },
      {
        title: "Explain market conditions",
        prompt: "Explain what kind of market condition this strategy is designed for.",
      },
    ];
  }

  // Performance prompts
  if (active_tab === "performance" && context.strategy_name) {
    return [
      {
        title: "Summarize performance across runs",
        prompt: "Summarize the strategy's performance across the available runs.",
      },
      {
        title: "Identify strengths and weaknesses",
        prompt: "Where does this strategy perform well, and where does it consistently struggle?",
      },
      {
        title: "Compare recent changes",
        prompt: "Compare the available runs and explain whether recent changes actually improved robustness.",
      },
    ];
  }

  // Default generic prompts
  return [
    {
      title: "Summarize the current page",
      prompt: "Summarize what's currently displayed on this page. What information is available and what should I focus on?",
    },
    {
      title: "Explain the context",
      prompt: "Explain the current context and state of the application. What am I looking at and what actions are available?",
    },
    {
      title: "Suggest next steps",
      prompt: "Based on the current state, what would be logical next steps or actions I should consider?",
    },
  ];
}

export default function ContextualPromptSuggestions({ context, onSelectPrompt }) {
  const prompts = getContextualPrompts(context);
  const contextStrip = formatContextStrip(context);

  if (prompts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Context Strip */}
      <div className="px-3 pt-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
          {contextStrip}
        </div>
      </div>

      {/* Suggestions */}
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 px-3 pb-2">
          What can I help you with?
        </p>
        <div className="flex flex-col gap-2 px-3 pb-2">
          {prompts.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(suggestion.prompt)}
              className="text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200 shadow-sm hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all"
            >
              <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                {suggestion.title}
              </div>
              <div className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {suggestion.prompt}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
