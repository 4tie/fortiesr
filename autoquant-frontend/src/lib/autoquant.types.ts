// AutoQuant API Types
// These types are based on the existing backend implementation
// Adjust these if your FastAPI endpoints differ

export type RunStatus = 
  | 'pending' 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'awaiting_user_approval'
  | 'interrupted';

export type StageName = 
  | 'preflight_filtering'
  | 'portfolio_baseline'
  | 'hyperopt'
  | 'candidate_backtest'
  | 'stress_test'
  | 'temporal_stress';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Run {
  id: string;
  strategy: string;
  status: RunStatus;
  current_stage: number;
  progress?: number;
  created_at: string;
  updated_at: string;
  error?: string;
  stages?: Stage[];
  selected_pairs?: string[];
  user_approved_pairs?: string[];
  discovery_results?: {
    recommended_pairs?: string[];
  };
  all_pairs?: PairMetrics[];
}

export interface Stage {
  index: number;
  name: StageName;
  status: RunStatus;
  started_at?: string;
  completed_at?: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  stage?: string;
}

export interface FitnessPoint {
  epoch: number;
  objective: number;
  profit_usdt: number;
  trades?: number;
}

export interface PairMetrics {
  key: string;
  profit_total: number;
  profit_total_abs: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  trades: number;
}

export interface PortfolioReview {
  per_pair: PairMetrics[];
  portfolio_profit: number;
  portfolio_max_dd: number;
  portfolio_trades: number;
  max_open_trades: number;
  current_pairs?: string[];
}

export interface Results {
  total_profit: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  win_rate: number;
  expectancy: number;
  equity_curve?: Array<{ timestamp: string; value: number }>;
  trade_distribution?: Array<{ bin: string; count: number }>;
  wfo_windows?: Array<{
    window: string;
    profit: number;
    trades: number;
    sharpe: number;
  }>;
}

export interface Strategy {
  name: string;
  description?: string;
}

export interface HyperoptSpace {
  buy: boolean;
  sell: boolean;
  roi: boolean;
  stoploss: boolean;
  trailing: boolean;
}

export interface RiskProfile {
  name: string;
  max_open_trades: number;
  max_drawdown: number;
}

export interface CreateRunRequest {
  strategy: string;
  timerange_start: string;
  timerange_end: string;
  hyperopt_spaces: HyperoptSpace;
  risk_profile: string;
  pair_universe: string[];
  epochs?: number;
  jobs?: number;
  timeframe?: string;
  min_trades?: number;
  spaces_order?: string[];
}

export interface ApprovePairsRequest {
  pairs: string[];
}

export interface ControlRunRequest {
  action: 'pause' | 'resume' | 'cancel';
}

// WebSocket message types
export type WSMessageType = 
  | 'status'
  | 'log'
  | 'fitness'
  | 'stage'
  | 'pairs_ready'
  | 'results_ready'
  | 'error';

export interface WSMessage {
  type: WSMessageType;
  data: unknown;
}

export interface WSStatusMessage extends WSMessage {
  type: 'status';
  data: {
    status: RunStatus;
    current_stage: number;
    progress: number;
    eta_seconds?: number;
  };
}

export interface WSLogMessage extends WSMessage {
  type: 'log';
  data: LogEntry;
}

export interface WSFitnessMessage extends WSMessage {
  type: 'fitness';
  data: FitnessPoint;
}

export interface WSStageMessage extends WSMessage {
  type: 'stage';
  data: Stage;
}

export interface WSPairsReadyMessage extends WSMessage {
  type: 'pairs_ready';
  data: PortfolioReview;
}

export interface WSResultsReadyMessage extends WSMessage {
  type: 'results_ready';
  data: Results;
}

export interface WSErrorMessage extends WSMessage {
  type: 'error';
  data: {
    message: string;
    stage?: string;
  };
}

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AISuggestion {
  stage: StageName;
  prompts: string[];
}
