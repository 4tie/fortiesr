/**
 * API request/response types
 * These define the contract between frontend and backend
 */

/**
 * API Response wrapper
 */
export class ApiResponse {
  constructor({
    success = false,
    data = null,
    error = null,
    message = '',
  } = {}) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.message = message;
  }
}

/**
 * AutoQuant Run Request
 */
export class AutoQuantRunRequest {
  constructor({
    strategySource = 'generate', // 'generate' or 'upload'
    strategyCode = null,
    strategyFile = null,
    tradingStyle = 'swing', // 'scalping', 'intraday', 'swing', 'position'
    riskProfile = 'balanced', // 'conservative', 'balanced', 'aggressive'
    exchange = 'binance',
    analysisDepth = 'full', // 'quick', 'deep', 'full'
    timeframe = null, // auto-discover if null
    pairs = null, // auto-select if null
  } = {}) {
    this.strategySource = strategySource;
    this.strategyCode = strategyCode;
    this.strategyFile = strategyFile;
    this.tradingStyle = tradingStyle;
    this.riskProfile = riskProfile;
    this.exchange = exchange;
    this.analysisDepth = analysisDepth;
    this.timeframe = timeframe;
    this.pairs = pairs;
  }
}

/**
 * AutoQuant Run Response
 */
export class AutoQuantRunResponse {
  constructor({
    runId = '',
    status = 'queued',
    message = '',
  } = {}) {
    this.runId = runId;
    this.status = status;
    this.message = message;
  }
}

/**
 * Strategy Upload Request
 */
export class StrategyUploadRequest {
  constructor({
    name = '',
    code = '',
    timeframe = '4h',
    pairs = [],
  } = {}) {
    this.name = name;
    this.code = code;
    this.timeframe = timeframe;
    this.pairs = pairs;
  }
}

/**
 * Backtest Request
 */
export class BacktestRequest {
  constructor({
    strategyId = '',
    timeframe = '4h',
    pairs = [],
    startDate = null,
    endDate = null,
    stakeAmount = 100,
  } = {}) {
    this.strategyId = strategyId;
    this.timeframe = timeframe;
    this.pairs = pairs;
    this.startDate = startDate;
    this.endDate = endDate;
    this.stakeAmount = stakeAmount;
  }
}

/**
 * Export Request
 */
export class ExportRequest {
  constructor({
    runId = '',
    format = 'json', // 'json', 'csv', 'pdf'
    includeCharts = true,
  } = {}) {
    this.runId = runId;
    this.format = format;
    this.includeCharts = includeCharts;
  }
}

/**
 * Paginated Request
 */
export class PaginatedRequest {
  constructor({
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    filters = {},
  } = {}) {
    this.page = page;
    this.limit = limit;
    this.sortBy = sortBy;
    this.sortOrder = sortOrder;
    this.filters = filters;
  }
}

/**
 * Paginated Response
 */
export class PaginatedResponse {
  constructor({
    data = [],
    total = 0,
    page = 1,
    limit = 20,
    totalPages = 0,
  } = {}) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = totalPages;
  }
}
