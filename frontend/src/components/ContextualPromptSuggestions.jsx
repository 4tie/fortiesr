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
        title: "Review optimizer progress",
        prompt: "Review the current optimizer session. How many trials have completed, what's the best performance so far, and is the search converging?",
      },
      {
        title: "Analyze best trial",
        prompt: "Analyze the best trial found so far. What parameters are working well? What's the performance breakdown?",
      },
      {
        title: "Suggest parameter adjustments",
        prompt: "Based on the current results, what parameter ranges should I explore next? Are there any obvious patterns in the search space?",
      },
    ];
  }

  // Backtest-specific prompts
  if (active_tab === "results" && context.backtest_run_id) {
    return [
      {
        title: "Analyze backtest results",
        prompt: "Analyze this backtest run. What are the key metrics? How does the strategy perform across different pairs and timeframes?",
      },
      {
        title: "Identify weaknesses",
        prompt: "What are the weaknesses in this backtest? Are there drawdowns, poor performance in certain conditions, or other concerns?",
      },
      {
        title: "Compare with baseline",
        prompt: "How does this backtest compare to the baseline or previous runs? What improvements or regressions do you see?",
      },
    ];
  }

  // Strategy editor prompts
  if (active_tab === "strategy-editor" && context.strategy_name) {
    return [
      {
        title: "Review strategy logic",
        prompt: "Review the current strategy code. Explain the entry and exit logic, indicators used, and any potential issues or improvements.",
      },
      {
        title: "Suggest optimizations",
        prompt: "What optimizations would you suggest for this strategy? Are there parameter adjustments or logic changes that could improve performance?",
      },
      {
        title: "Check for common issues",
        prompt: "Check this strategy for common issues like overfitting, look-ahead bias, or improper risk management.",
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

  if (prompts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 px-3 pt-2">
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
  );
}
