// State actions - functions that mutate state
// Clear action names for easy debugging

import { store } from './store.js';
import { settingsService } from '../api/services/settings.js';
import { backtestService } from '../api/services/backtest.js';
import { autoQuantService } from '../api/services/auto_quant.js';

export const actions = {
  // UI Actions
  setCurrentPage(page) {
    store.setState({ currentPage: page });
  },

  setLoading(isLoading) {
    store.setState({ isLoading });
  },

  setError(error) {
    store.setState({ error });
  },

  clearError() {
    store.setState({ error: null });
  },

  toggleSidebar() {
    const currentState = store.getState();
    store.setState({ sidebarOpen: !currentState.sidebarOpen });
  },

  // Settings Actions
  async loadSettings() {
    try {
      actions.setLoading(true);
      const settings = await settingsService.getSettings();
      store.setState({ settings });
      actions.clearError();
    } catch (error) {
      actions.setError('Failed to load settings');
      console.error('Load settings error:', error);
    } finally {
      actions.setLoading(false);
    }
  },

  async updateSettings(newSettings) {
    try {
      actions.setLoading(true);
      const updated = await settingsService.updateSettings(newSettings);
      store.setState({ settings: updated });
      actions.clearError();
    } catch (error) {
      actions.setError('Failed to update settings');
      console.error('Update settings error:', error);
    } finally {
      actions.setLoading(false);
    }
  },

  // Backtest Actions
  async runBacktest(config) {
    try {
      actions.setLoading(true);
      const results = await backtestService.runBacktest(config);
      store.setState({ backtestResults: results });
      actions.clearError();
    } catch (error) {
      actions.setError('Failed to run backtest');
      console.error('Run backtest error:', error);
    } finally {
      actions.setLoading(false);
    }
  },

  async loadBacktestResults() {
    try {
      actions.setLoading(true);
      const results = await backtestService.getResults();
      store.setState({ backtestResults: results });
      actions.clearError();
    } catch (error) {
      actions.setError('Failed to load backtest results');
      console.error('Load backtest results error:', error);
    } finally {
      actions.setLoading(false);
    }
  },

  async loadBacktestConfig() {
    try {
      actions.setLoading(true);
      const config = await backtestService.getConfig();
      store.setState({ backtestConfig: config });
      actions.clearError();
    } catch (error) {
      actions.setError('Failed to load backtest config');
      console.error('Load backtest config error:', error);
    } finally {
      actions.setLoading(false);
    }
  },

  // AutoQuant Actions
  async startAutoQuant(config) {
    try {
      actions.setLoading(true);
      const status = await autoQuantService.startPipeline(config);
      store.setState({ autoQuantStatus: status });
      actions.clearError();
    } catch (error) {
      actions.setError('Failed to start AutoQuant pipeline');
      console.error('Start AutoQuant error:', error);
    } finally {
      actions.setLoading(false);
    }
  },

  async stopAutoQuant() {
    try {
      actions.setLoading(true);
      const status = await autoQuantService.stopPipeline();
      store.setState({ autoQuantStatus: status });
      actions.clearError();
    } catch (error) {
      actions.setError('Failed to stop AutoQuant pipeline');
      console.error('Stop AutoQuant error:', error);
    } finally {
      actions.setLoading(false);
    }
  },

  async loadAutoQuantStatus() {
    try {
      actions.setLoading(true);
      const status = await autoQuantService.getStatus();
      store.setState({ autoQuantStatus: status });
      actions.clearError();
    } catch (error) {
      actions.setError('Failed to load AutoQuant status');
      console.error('Load AutoQuant status error:', error);
    } finally {
      actions.setLoading(false);
    }
  },

  async loadAutoQuantResults() {
    try {
      actions.setLoading(true);
      const results = await autoQuantService.getResults();
      store.setState({ autoQuantResults: results });
      actions.clearError();
    } catch (error) {
      actions.setError('Failed to load AutoQuant results');
      console.error('Load AutoQuant results error:', error);
    } finally {
      actions.setLoading(false);
    }
  },

  async loadAutoQuantConfig() {
    try {
      actions.setLoading(true);
      const config = await autoQuantService.getConfig();
      store.setState({ autoQuantConfig: config });
      actions.clearError();
    } catch (error) {
      actions.setError('Failed to load AutoQuant config');
      console.error('Load AutoQuant config error:', error);
    } finally {
      actions.setLoading(false);
    }
  },
};
