import { api } from "../../services/api.js";

/**
 * Guidance API service for AI-powered guidance
 * Integrates with backend Ollama service
 */

export const guidanceApi = {
  /**
   * Get AI guidance based on context and user input
   */
  async getGuidance(context, userInput, scenario = null) {
    try {
      const res = await fetch("/api/guidance/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          user_input: userInput,
          scenario,
        }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to get guidance: ${res.statusText}`);
      }
      
      return await res.json();
    } catch (error) {
      console.error("Failed to get AI guidance:", error);
      // Return fallback guidance
      return this.getFallbackGuidance(context, userInput, scenario);
    }
  },

  /**
   * Get context-aware suggestions without AI
   */
  getContextSuggestions(context) {
    const suggestions = [];

    // Page-specific suggestions
    switch (context.currentPage) {
      case "auto-quant":
        suggestions.push({
          type: "info",
          title: "AutoQuant Pipeline",
          message: "The automated pipeline discovers and optimizes strategies in 6 stages.",
          steps: [
            "1. Readiness Assessment",
            "2. Strategy Generation",
            "3. Pair Screening",
            "4. Genetic Optimization",
            "5. Multi-Pair Stress Test",
            "6. Validation",
          ],
        });
        break;

      case "strategy-lab":
        suggestions.push({
          type: "info",
          title: "Strategy Development",
          message: "Create and test trading strategies with manual control.",
          steps: [
            "1. Select or create a strategy",
            "2. Configure parameters",
            "3. Choose pairs and timeframe",
            "4. Run backtest",
            "5. Analyze results",
          ],
        });
        break;

      case "results":
        if (context.backtestResults) {
          const { profit, drawdown, winRate } = context.backtestResults;
          if (profit < 0) {
            suggestions.push({
              type: "warning",
              title: "Negative Profit Detected",
              message: `Your strategy lost ${Math.abs(profit)}%. This needs attention.`,
              recommendations: [
                "Try genetic optimization to find better parameters",
                "Filter pairs to only profitable ones",
                "Adjust timeframe - shorter timeframes may work better",
                "Add entry/exit filters to reduce bad trades",
              ],
            });
          } else if (drawdown > 20) {
            suggestions.push({
              type: "warning",
              title: "High Drawdown Risk",
              message: `Maximum drawdown is ${drawdown}%. This is risky.`,
              recommendations: [
                "Tighten stoploss to limit losses",
                "Add trailing stop to protect profits",
                "Reduce position sizing",
                "Add market condition filters",
              ],
            });
          } else if (winRate < 40) {
            suggestions.push({
              type: "warning",
              title: "Low Win Rate",
              message: `Win rate is ${winRate}%. Entry/exit signals need improvement.`,
              recommendations: [
                "Adjust indicator parameters for better signals",
                "Add confirmation indicators",
                "Filter volatile market conditions",
                "Consider different timeframe",
              ],
            });
          } else {
            suggestions.push({
              type: "success",
              title: "Promising Strategy",
              message: `Strategy shows ${profit}% profit with ${drawdown}% drawdown.`,
              recommendations: [
                "Run out-of-sample validation",
                "Test on different timeframes",
                "Consider live paper trading",
                "Export for Freqtrade",
              ],
            });
          }
        }
        break;

      case "optimizer":
        suggestions.push({
          type: "info",
          title: "Genetic Optimization",
          message: "Evolve strategy parameters using genetic algorithms.",
          steps: [
            "1. Configure search spaces (parameters to optimize)",
            "2. Set population size and generations",
            "3. Run evolution",
            "4. Review best performers",
            "5. Apply best parameters",
          ],
        });
        break;
    }

    return suggestions;
  },

  /**
   * Fallback guidance when AI is unavailable
   */
  getFallbackGuidance(context, userInput, scenario) {
    // Scenario-specific fallback guidance
    const scenarioGuidance = {
      "new-strategy": {
        title: "Creating a New Strategy",
        message: "Since AI is unavailable, here's a manual approach:",
        steps: [
          "1. Go to Strategy Lab tab",
          "2. Choose a strategy template (RSI, MACD, Bollinger, etc.)",
          "3. Select your trading style (scalping, intraday, swing)",
          "4. Choose timeframe (1m, 5m, 15m, 1h, 4h, 1d)",
          "5. Select trading pairs",
          "6. Configure initial parameters",
          "7. Run backtest to test",
        ],
      },
      "improve-strategy": {
        title: "Improving Existing Strategy",
        message: "Manual approach for strategy improvement:",
        steps: [
          "1. Analyze backtest results",
          "2. Identify weak areas (low win rate, high drawdown, etc.)",
          "3. Go to Optimizer tab",
          "4. Configure genetic optimization",
          "5. Run evolution to find better parameters",
          "6. Test optimized parameters",
        ],
      },
      "analyze-backtest": {
        title: "Analyzing Backtest Results",
        message: "Key metrics to review:",
        metrics: [
          "Profit Factor: Should be > 1.5",
          "Win Rate: Should be > 40%",
          "Max Drawdown: Should be < 20%",
          "Sharpe Ratio: Should be > 1.0",
          "Profit per pair: Check which pairs perform best",
        ],
      },
      "optimize-parameters": {
        title: "Parameter Optimization",
        message: "Using genetic algorithms:",
        steps: [
          "1. Define search spaces (parameters to vary)",
          "2. Set population size (50-100)",
          "3. Set generations (20-50)",
          "4. Choose optimization spaces (ROI, stoploss, indicators)",
          "5. Run optimization",
          "6. Review best performers",
        ],
      },
      "debug-strategy": {
        title: "Debugging Failing Strategy",
        message: "Common issues and fixes:",
        issues: [
          "No trades: Check indicator parameters and entry conditions",
          "All losses: Review stoploss and exit conditions",
          "Overfitting: Reduce complexity, add regularization",
          "Poor performance: Try different timeframe or pairs",
        ],
      },
    };

    return scenarioGuidance[scenario] || {
      title: "General Guidance",
      message: "AI guidance unavailable. Here are some tips:",
      tips: [
        "Start with simple strategies and build complexity",
        "Always test on out-of-sample data",
        "Use pair filtering to focus on profitable pairs",
        "Monitor drawdown carefully - it's your risk",
        "Paper trade before live trading",
      ],
    };
  },

  /**
   * Analyze backtest results for issues
   */
  analyzeBacktestResults(results) {
    const issues = [];
    const recommendations = [];

    if (!results) {
      return { issues: ["No backtest results available"], recommendations: ["Run a backtest first"] };
    }

    // Profit analysis
    if (results.profit < 0) {
      issues.push("Negative profit");
      recommendations.push("Try genetic optimization to find profitable parameters");
      recommendations.push("Filter pairs to only those with historical profitability");
    } else if (results.profit < 5) {
      issues.push("Low profit margin");
      recommendations.push("Consider leverage or position sizing");
      recommendations.push("Optimize for higher profit factor");
    }

    // Drawdown analysis
    if (results.drawdown > 30) {
      issues.push("Excessive drawdown");
      recommendations.push("Tighten stoploss significantly");
      recommendations.push("Add trailing stop");
      recommendations.push("Reduce position size");
    } else if (results.drawdown > 20) {
      issues.push("High drawdown risk");
      recommendations.push("Adjust stoploss parameters");
      recommendations.push("Add market condition filters");
    }

    // Win rate analysis
    if (results.winRate < 30) {
      issues.push("Very low win rate");
      recommendations.push("Completely revise entry/exit logic");
      recommendations.push("Add strong confirmation indicators");
    } else if (results.winRate < 40) {
      issues.push("Low win rate");
      recommendations.push("Adjust indicator thresholds");
      recommendations.push("Add additional filters");
    }

    // Profit factor analysis
    if (results.profitFactor < 1.0) {
      issues.push("Profit factor below 1.0");
      recommendations.push("Strategy is losing money overall");
      recommendations.push("Major parameter changes needed");
    } else if (results.profitFactor < 1.5) {
      issues.push("Marginal profit factor");
      recommendations.push("Optimize for better risk/reward ratio");
    }

    return { issues, recommendations };
  },
};
