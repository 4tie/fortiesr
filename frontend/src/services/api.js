/**
 * Central API client for Strategy Lab
 * Handles all HTTP requests to the backend
 */

const API_BASE = "/api";

async function parseJsonResponse(res, fallbackMessage) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || fallbackMessage || res.statusText);
  }
  return data;
}

export const api = {
  /**
   * AutoQuant pipeline endpoints
   */
  autoquant: {
    baseURL: `${API_BASE}/auto-quant`,

    /**
     * Load AutoQuant options
     * @returns {Promise<object>}
     */
    async loadOptions() {
      const res = await fetch(`${this.baseURL}/options`);
      return parseJsonResponse(res, "Failed to load AutoQuant options.");
    },

    /**
     * Save AutoQuant options
     * @param {object} options
     * @returns {Promise<object>}
     */
    async saveOptions(options) {
      const res = await fetch(`${this.baseURL}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      return parseJsonResponse(res, "Failed to save AutoQuant options.");
    },

    /**
     * Load timeframe thresholds
     * @param {string} timeframe
     * @returns {Promise<object>}
     */
    async loadTimeframeThresholds(timeframe) {
      const res = await fetch(`${this.baseURL}/timeframe-thresholds/${timeframe}`);
      return parseJsonResponse(res, "Failed to load timeframe thresholds.");
    },

    /**
     * Generate strategy template
     * @param {object} payload
     * @returns {Promise<object>}
     */
    async generateTemplate(payload) {
      const res = await fetch(`${this.baseURL}/generate-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return parseJsonResponse(res, "Failed to generate template.");
    },

    /**
     * Screen pairs for trading
     * @param {object} payload
     * @returns {Promise<object>}
     */
    async screenPairs(payload) {
      const res = await fetch(`${this.baseURL}/screen-pairs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return parseJsonResponse(res, "Screening failed.");
    },

    /**
     * Start a new pipeline execution
     * @param {object} payload
     * @returns {Promise<{run_id: string, message: string}>}
     */
    async startRun(payload) {
      const res = await fetch(`${this.baseURL}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return parseJsonResponse(res, "Failed to start pipeline.");
    },

    /**
     * Cancel a running pipeline
     * @param {string} runId
     * @returns {Promise<object>}
     */
    async cancelRun(runId) {
      const res = await fetch(`${this.baseURL}/cancel/${runId}`, { method: "POST" });
      return parseJsonResponse(res, "Failed to send cancellation request.");
    },

    /**
     * Get pipeline run status
     * @param {string} runId
     * @returns {Promise<PipelineRun>}
     */
    async getStatus(runId) {
      const res = await fetch(`${this.baseURL}/status/${runId}`);
      return parseJsonResponse(res, `Failed to load run ${runId}.`);
    },

    /**
     * Get pipeline report
     * @param {string} runId
     * @returns {Promise<object>}
     */
    async getReport(runId) {
      const res = await fetch(`${this.baseURL}/report/${runId}`);
      return parseJsonResponse(res, `Failed to load report for ${runId}.`);
    },

    /**
     * List all pipeline runs
     * @returns {Promise<object>}
     */
    async listRuns() {
      const res = await fetch(`${this.baseURL}/runs`);
      return parseJsonResponse(res, "Failed to load AutoQuant runs.");
    },

    /**
     * Open WebSocket for real-time updates
     * @param {string} runId
     * @returns {WebSocket}
     */
    connectWebSocket(runId) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return new WebSocket(`${protocol}//${window.location.host}${this.baseURL}/ws/${runId}`);
    },
  },

  /**
   * Candidate evaluation endpoints
   */
  candidate: {
    /**
     * Start an async candidate evaluation run
     * @param {StrategySpec} spec
     * @param {CandidateConfig} config
     * @returns {Promise<{run_id: string, status: string, message: string}>}
     */
    async startRun(spec, config) {
      const res = await fetch(`${API_BASE}/candidate/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, config }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    /**
     * Get async candidate run state
     * @param {string} runId
     * @returns {Promise<CandidateRunState>}
     */
    async getRun(runId) {
      const res = await fetch(`${API_BASE}/candidate/runs/${runId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    /**
     * Build WebSocket URL for candidate run progress
     * @param {string} runId
     * @returns {string}
     */
    getWebSocketUrl(runId) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/api/candidate/ws/${runId}`;
    },

    /**
     * Open WebSocket for live candidate progress
     * @param {string} runId
     * @returns {WebSocket}
     */
    connectWebSocket(runId) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return new WebSocket(`${protocol}//${window.location.host}/api/candidate/ws/${runId}`);
    },

    /**
     * Evaluate a candidate strategy
     * @param {StrategySpec} spec
     * @param {CandidateConfig} config
     * @returns {Promise<{verdict: CandidateVerdict}>}
     */
    async evaluate(spec, config) {
      const res = await fetch(`${API_BASE}/candidate/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, config }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  },
};

export default api;
