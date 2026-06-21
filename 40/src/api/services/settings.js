// Settings API service
// Handles all settings-related API calls

import { apiClient } from '../client.js';
import { endpoints } from '../endpoints.js';

export const settingsService = {
  async getSettings() {
    return apiClient.get(endpoints.settings.get);
  },

  async updateSettings(settings) {
    return apiClient.post(endpoints.settings.update, settings);
  },
};
