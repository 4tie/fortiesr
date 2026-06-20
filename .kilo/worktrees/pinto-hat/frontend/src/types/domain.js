/**
 * Domain-specific types
 * These are business logic types used throughout the application
 */

/**
 * Trading Style
 */
export const TradingStyle = {
  SCALPING: 'scalping',      // 1m-5m, high trade count
  INTRADAY: 'intraday',      // 15m-1h, medium trade count
  SWING: 'swing',            // 1h-4h, lower trade count
  POSITION: 'position',     // 1d+, very low trade count
};

/**
 * Risk Profile
 */
export const RiskProfile = {
  CONSERVATIVE: 'conservative', // Low risk, lower returns
  BALANCED: 'balanced',         // Moderate risk, moderate returns
  AGGRESSIVE: 'aggressive',     // High risk, higher returns
};

/**
 * Analysis Depth
 */
export const AnalysisDepth = {
  QUICK: 'quick',     // Basic tests only
  DEEP: 'deep',       // Most tests
  FULL: 'full',       // All tests
};

/**
 * Exchange
 */
export const Exchange = {
  BINANCE: 'binance',
  BYBIT: 'bybit',
  OKX: 'okx',
};

/**
 * Timeframe
 */
export const Timeframe = {
  M1: '1m',
  M5: '5m',
  M15: '15m',
  M30: '30m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
};

/**
 * Pair Result - Performance on a specific trading pair
 */
export class PairResult {
  constructor({
    pair = '',
    profitFactor = 0,
    drawdown = 0,
    expectancy = 0,
    trades = 0,
    winRate = 0,
    passed = false,
  } = {}) {
    this.pair = pair;
    this.profitFactor = profitFactor;
    this.drawdown = drawdown;
    this.expectancy = expectancy;
    this.trades = trades;
    this.winRate = winRate;
    this.passed = passed;
  }
}

/**
 * Timeframe Result - Performance on a specific timeframe
 */
export class TimeframeResult {
  constructor({
    timeframe = '4h',
    profitFactor = 0,
    drawdown = 0,
    expectancy = 0,
    trades = 0,
    winRate = 0,
    passed = false,
  } = {}) {
    this.timeframe = timeframe;
    this.profitFactor = profitFactor;
    this.drawdown = drawdown;
    this.expectancy = expectancy;
    this.trades = trades;
    this.winRate = winRate;
    this.passed = passed;
  }
}

/**
 * Backtest Result - Full backtest results
 */
export class BacktestResult {
  constructor({
    strategyId = '',
    strategyName = '',
    timeframe = '4h',
    pairs = [],
    startDate = null,
    endDate = null,
    metrics = null,
    pairResults = [],
    timeframeResults = [],
    equityCurve = [],
    drawdownCurve = [],
  } = {}) {
    this.strategyId = strategyId;
    this.strategyName = strategyName;
    this.timeframe = timeframe;
    this.pairs = pairs;
    this.startDate = startDate;
    this.endDate = endDate;
    this.metrics = metrics;
    this.pairResults = pairResults;
    this.timeframeResults = timeframeResults;
    this.equityCurve = equityCurve;
    this.drawdownCurve = drawdownCurve;
  }
}

/**
 * Walk Forward Result - Walk-forward analysis results
 */
export class WalkForwardResult {
  constructor({
    strategyId = '',
    windows = [],
    passRate = 0,
    avgDegradation = 0,
    passed = false,
  } = {}) {
    this.strategyId = strategyId;
    this.windows = windows; // Array of window results
    this.passRate = passRate;
    this.avgDegradation = avgDegradation;
    this.passed = passed;
  }
}

/**
 * Walk Forward Window - Single walk-forward window
 */
export class WalkForwardWindow {
  constructor({
    windowId = '',
    trainStart = null,
    trainEnd = null,
    testStart = null,
    testEnd = null,
    trainProfit = 0,
    testProfit = 0,
    degradation = 0,
    passed = false,
  } = {}) {
    this.windowId = windowId;
    this.trainStart = trainStart;
    this.trainEnd = trainEnd;
    this.testStart = testStart;
    this.testEnd = testEnd;
    this.trainProfit = trainProfit;
    this.testProfit = testProfit;
    this.degradation = degradation;
    this.passed = passed;
  }
}

/**
 * Robustness Result - Robustness testing results
 */
export class RobustnessResult {
  constructor({
    strategyId = '',
    robustnessScore = 0,
    parameterStability = 0,
    slippageTolerance = 0,
    spreadTolerance = 0,
    volatilityTolerance = 0,
    fragilityFlags = [],
    recommendation = '',
    passed = false,
  } = {}) {
    this.strategyId = strategyId;
    this.robustnessScore = robustnessScore; // 0-1
    this.parameterStability = parameterStability; // 0-1
    this.slippageTolerance = slippageTolerance; // 0-1
    this.spreadTolerance = spreadTolerance; // 0-1
    this.volatilityTolerance = volatilityTolerance; // 0-1
    this.fragilityFlags = fragilityFlags;
    this.recommendation = recommendation;
    this.passed = passed;
  }
}

/**
 * Score Card - Comprehensive score breakdown
 */
export class ScoreCard {
  constructor({
    strategyId = '',
    strategyName = '',
    overallScore = 0,
    expectancyScore = 0,
    profitFactorScore = 0,
    drawdownScore = 0,
    walkForwardScore = 0,
    robustnessScore = 0,
    pairConsistencyScore = 0,
    tradeQualityScore = 0,
    tier = 'candidate',
    recommendation = '',
  } = {}) {
    this.strategyId = strategyId;
    this.strategyName = strategyName;
    this.overallScore = overallScore; // 0-100
    this.expectancyScore = expectancyScore; // 0-20
    this.profitFactorScore = profitFactorScore; // 0-20
    this.drawdownScore = drawdownScore; // 0-20
    this.walkForwardScore = walkForwardScore; // 0-15
    this.robustnessScore = robustnessScore; // 0-15
    this.pairConsistencyScore = pairConsistencyScore; // 0-5
    this.tradeQualityScore = tradeQualityScore; // 0-5
    this.tier = tier;
    this.recommendation = recommendation;
  }
}

/**
 * OOS Result - Out-of-sample testing results
 */
export class OOSResult {
  constructor({
    strategyId = '',
    inSampleProfit = 0,
    outOfSampleProfit = 0,
    degradation = 0,
    retention = 0,
    passed = false,
  } = {}) {
    this.strategyId = strategyId;
    this.inSampleProfit = inSampleProfit;
    this.outOfSampleProfit = outOfSampleProfit;
    this.degradation = degradation; // Percentage
    this.retention = retention; // Percentage
    this.passed = passed;
  }
}
