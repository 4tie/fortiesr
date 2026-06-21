// Backtest API service
// Handles all backtest-related API calls

import { apiClient } from '../client.js';
import { endpoints } from '../endpoints.js';

export const backtestService = {
  async runBacktest(config) {
    return apiClient.post(endpoints.backtest.run, config);
  },

  async getResults() {
    return apiClient.get(endpoints.backtest.results);
  },

  async getConfig() {
    return apiClient.get(endpoints.backtest.config);
  },
};
