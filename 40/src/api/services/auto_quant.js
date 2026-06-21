// AutoQuant API service
// Handles all AutoQuant-related API calls

import { apiClient } from '../client.js';
import { endpoints } from '../endpoints.js';

export const autoQuantService = {
  async startPipeline(config) {
    return apiClient.post(endpoints.autoQuant.start, config);
  },

  async stopPipeline() {
    return apiClient.post(endpoints.autoQuant.stop);
  },

  async getStatus() {
    return apiClient.get(endpoints.autoQuant.status);
  },

  async getResults() {
    return apiClient.get(endpoints.autoQuant.results);
  },

  async getConfig() {
    return apiClient.get(endpoints.autoQuant.config);
  },
};
