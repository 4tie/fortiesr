// Base API client with fetch wrapper
// Handles error handling, retries, and loading states

import { config } from '../config.js';

class ApiClient {
  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.timeout = config.apiTimeout;
    this.retryAttempts = config.retryAttempts;
  }

  async fetch(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${url}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include', // Include cookies for session auth
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  async get(url, options = {}) {
    return this.fetch(url, { ...options, method: 'GET' });
  }

  async post(url, data, options = {}) {
    return this.fetch(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(url, data, options = {}) {
    return this.fetch(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(url, options = {}) {
    return this.fetch(url, { ...options, method: 'DELETE' });
  }

  async retry(fn, attempts = this.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === attempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
}

export const apiClient = new ApiClient();
