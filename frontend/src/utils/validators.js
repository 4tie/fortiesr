/**
 * StrategyValidation - Validation rules for each pipeline stage
 * Rules are separate from rendering, can be reused for testing
 */

export const StrategyValidation = {
  /**
   * Discovery: Permissive - find potential edges
   */
  discovery: (metrics) => {
    const errors = [];

    if (!metrics) {
      errors.push('No metrics available');
      return { passed: false, errors };
    }

    if (!Number.isFinite(metrics.profitFactor) || metrics.profitFactor <= 1.0) {
      errors.push('Profit factor must be > 1.0');
    }

    if (metrics.trades < 10) {
      errors.push('Minimum 10 trades required');
    }

    if (metrics.drawdown > 0.40) {
      errors.push('Drawdown must be < 40%');
    }

    return {
      passed: errors.length === 0,
      errors,
    };
  },

  /**
   * Validation: Medium - remove weak candidates
   */
  validation: (metrics) => {
    const errors = [];

    if (!metrics) {
      errors.push('No metrics available');
      return { passed: false, errors };
    }

    if (metrics.profitFactor <= 1.3) {
      errors.push('Profit factor must be > 1.3');
    }

    if (metrics.drawdown > 0.30) {
      errors.push('Drawdown must be < 30%');
    }

    if (metrics.winRate < 0.40) {
      errors.push('Win rate must be > 40%');
    }

    return {
      passed: errors.length === 0,
      errors,
    };
  },

  /**
   * Elite: Strict - deployment-quality only
   */
  elite: (metrics) => {
    const errors = [];

    if (!metrics) {
      errors.push('No metrics available');
      return { passed: false, errors };
    }

    if (metrics.profitFactor <= 1.5) {
      errors.push('Profit factor must be > 1.5');
    }

    if (metrics.drawdown > 0.25) {
      errors.push('Drawdown must be < 25%');
    }

    if (!metrics.walkForwardScore || metrics.walkForwardScore < 0.70) {
      errors.push('Walk-forward score must be > 0.70');
    }

    if (!metrics.robustnessScore || metrics.robustnessScore < 0.70) {
      errors.push('Robustness score must be > 0.70');
    }

    return {
      passed: errors.length === 0,
      errors,
    };
  },
};

/**
 * Format metrics for display
 */
export const MetricsFormatter = {
  profitFactor: (value) => {
    if (!Number.isFinite(value)) return 'N/A';
    return value.toFixed(2);
  },

  drawdown: (value) => {
    if (!Number.isFinite(value)) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  },

  winRate: (value) => {
    if (!Number.isFinite(value)) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  },

  expectancy: (value) => {
    if (!Number.isFinite(value)) return 'N/A';
    return value.toFixed(4);
  },

  sharpeRatio: (value) => {
    if (!Number.isFinite(value)) return 'N/A';
    return value.toFixed(2);
  },

  trades: (value) => {
    if (!Number.isInteger(value)) return 'N/A';
    return value.toString();
  },
};
