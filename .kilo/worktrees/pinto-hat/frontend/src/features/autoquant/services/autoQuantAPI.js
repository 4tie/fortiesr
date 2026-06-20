/**
 * AutoQuant API Service
 * Feature-specific API calls for AutoQuant functionality
 */

import api from '../../../services/api';

export const autoQuantAPI = {
  /**
   * Generate strategies using AI
   */
  async generateStrategies(config) {
    const res = await fetch(`${api.autoquant.baseURL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Upload strategy file
   */
  async uploadStrategy(file, metadata) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    const res = await fetch(`${api.autoquant.baseURL}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Validate strategy code
   */
  async validateStrategy(code) {
    const res = await fetch(`${api.autoquant.baseURL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Get adaptive thresholds for a trading style
   */
  async getThresholds(style) {
    const res = await fetch(`${api.autoquant.baseURL}/thresholds/${style}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /**
   * Update thresholds
   */
  async updateThresholds(style, thresholds) {
    const res = await fetch(`${api.autoquant.baseURL}/thresholds/${style}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(thresholds),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

export default autoQuantAPI;
