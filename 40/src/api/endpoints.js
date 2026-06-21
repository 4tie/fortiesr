// Centralized endpoint definitions
// Easy to change API routes without touching service code

export const endpoints = {
  // Settings
  settings: {
    get: '/api/settings',
    update: '/api/settings',
  },
  
  // Backtest
  backtest: {
    run: '/api/backtest/run',
    results: '/api/backtest/results',
    config: '/api/backtest/config',
  },
  
  // AutoQuant
  autoQuant: {
    start: '/api/auto_quant/start',
    stop: '/api/auto_quant/stop',
    status: '/api/auto_quant/status',
    results: '/api/auto_quant/results',
    config: '/api/auto_quant/config',
  },
  
  // AI Assistant
  aiAssistant: {
    chat: '/api/ai_assistant/chat',
    history: '/api/ai_assistant/history',
  },
  
  // System Health
  health: {
    status: '/api/health',
    metrics: '/api/health/metrics',
  },
  
  // Agent
  agent: {
    list: '/api/agent',
    get: '/api/agent/{id}',
    create: '/api/agent',
    update: '/api/agent/{id}',
    delete: '/api/agent/{id}',
  },
  
  // Discord
  discord: {
    status: '/api/discord/status',
    send: '/api/discord/send',
    channels: '/api/discord/channels',
  },
};
