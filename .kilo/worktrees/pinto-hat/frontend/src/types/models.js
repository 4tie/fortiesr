/**
 * Core domain models - shared between frontend and backend
 * These match backend Pydantic models
 */

export const StrategyStatus = {
  DRAFT: 'draft',
  CANDIDATE: 'candidate',      // Passed discovery
  PROMISING: 'promising',       // Passed validation
  VALIDATED: 'validated',       // Passed elite validation
  ELITE: 'elite',               // Highest confidence
};

export const ValidationStage = {
  DISCOVERY: 'discovery',
  VALIDATION: 'validation',
  ELITE_VALIDATION: 'elite_validation',
  RANKING: 'ranking',
};

export const ValidationTier = {
  CANDIDATE: 'candidate',
  PROMISING: 'promising',
  VALIDATED: 'validated',
  ELITE: 'elite',
};

/**
 * StrategyMetrics - Performance metrics for a strategy
 */
export class StrategyMetrics {
  constructor({
    profitFactor = 0,
    drawdown = 0,
    expectancy = 0,
    trades = 0,
    winRate = 0,
    sharpeRatio = 0,
    sortinoRatio = 0,
    calmarRatio = 0,
    monthlyReturns = [],
    monthlyWinRate = [],
    maxConsecutiveLosses = 0,
    pairConsistency = 0,
    oosStability = 0,
    walkForwardScore = 0,
    robustnessScore = 0,
  } = {}) {
    this.profitFactor = profitFactor;
    this.drawdown = drawdown;
    this.expectancy = expectancy;
    this.trades = trades;
    this.winRate = winRate;
    this.sharpeRatio = sharpeRatio;
    this.sortinoRatio = sortinoRatio;
    this.calmarRatio = calmarRatio;
    this.monthlyReturns = monthlyReturns;
    this.monthlyWinRate = monthlyWinRate;
    this.maxConsecutiveLosses = maxConsecutiveLosses;
    this.pairConsistency = pairConsistency;
    this.oosStability = oosStability;
    this.walkForwardScore = walkForwardScore;
    this.robustnessScore = robustnessScore;
  }
}

/**
 * Strategy - A trading strategy with metrics and status
 */
export class Strategy {
  constructor({
    id = '',
    name = '',
    code = '',
    timeframe = '4h',
    pairs = [],
    status = StrategyStatus.DRAFT,
    metrics = null,
    tier = ValidationTier.CANDIDATE,
    score = 0,
    createdAt = new Date(),
    updatedAt = new Date(),
  } = {}) {
    this.id = id;
    this.name = name;
    this.code = code;
    this.timeframe = timeframe;
    this.pairs = pairs;
    this.status = status;
    this.metrics = metrics || new StrategyMetrics();
    this.tier = tier;
    this.score = score;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

/**
 * ValidationResult - Result of a validation stage
 */
export class ValidationResult {
  constructor({
    stage = ValidationStage.DISCOVERY,
    passed = false,
    errors = [],
    warnings = [],
    metrics = null,
    timestamp = new Date(),
  } = {}) {
    this.stage = stage;
    this.passed = passed;
    this.errors = errors;
    this.warnings = warnings;
    this.metrics = metrics || new StrategyMetrics();
    this.timestamp = timestamp;
  }
}

/**
 * EliteScore - Weighted score for elite strategies (0-100)
 */
export class EliteScore {
  constructor({
    strategyId = '',
    overall = 0,           // 0-100
    expectancy = 0,        // 20%
    profitFactor = 0,      // 20%
    drawdown = 0,          // 20%
    walkForward = 0,       // 15%
    robustness = 0,        // 15%
    pairConsistency = 0,   // 5%
    tradeQuality = 0,      // 5%
    timestamp = new Date(),
  } = {}) {
    this.strategyId = strategyId;
    this.overall = overall;
    this.expectancy = expectancy;
    this.profitFactor = profitFactor;
    this.drawdown = drawdown;
    this.walkForward = walkForward;
    this.robustness = robustness;
    this.pairConsistency = pairConsistency;
    this.tradeQuality = tradeQuality;
    this.timestamp = timestamp;
  }
}

/**
 * PipelineRun - State of an AutoQuant pipeline execution
 */
export class PipelineRun {
  constructor({
    runId = '',
    strategyId = '',
    strategyName = '',
    status = 'queued',  // queued, running, completed, failed
    currentStage = ValidationStage.DISCOVERY,
    progress = 0,       // 0-100
    candidates = [],
    promising = [],
    validated = [],
    elite = [],
    errors = [],
    startedAt = null,
    completedAt = null,
    elapsedSeconds = 0,
    etaSeconds = 0,
  } = {}) {
    this.runId = runId;
    this.strategyId = strategyId;
    this.strategyName = strategyName;
    this.status = status;
    this.currentStage = currentStage;
    this.progress = progress;
    this.candidates = candidates;    // After discovery
    this.promising = promising;      // After validation
    this.validated = validated;      // After elite validation
    this.elite = elite;              // After ranking
    this.errors = errors;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.elapsedSeconds = elapsedSeconds;
    this.etaSeconds = etaSeconds;
  }

  get candidateCount() { return this.candidates.length; }
  get promisingCount() { return this.promising.length; }
  get validatedCount() { return this.validated.length; }
  get eliteCount() { return this.elite.length; }
  get isRunning() { return this.status === 'running'; }
  get isCompleted() { return this.status === 'completed'; }
  get hasFailed() { return this.status === 'failed'; }
}
