/**
 * Central API client for Strategy Lab
 * Handles all HTTP requests to the backend
 */

const API_BASE = "http://localhost:8000/api";

export const api = {
  /**
   * AutoQuant pipeline endpoints
   */
  autoquant: {
    /**
     * Start a new pipeline execution
     * @param {Strategy} strategy
     * @returns {Promise<{run_id: string, message: string}>}
     */
    async startPipeline(strategy) {
      const res = await fetch(`${API_BASE}/auto-quant/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(strategy),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    /**
     * Get pipeline run status
     * @param {string} runId
     * @returns {Promise<PipelineRun>}
     */
    async getRun(runId) {
      const res = await fetch(`${API_BASE}/auto-quant/runs/${runId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    /**
     * List all pipeline runs
     * @returns {Promise<{runs: PipelineRun[], total: number}>}
     */
    async listRuns() {
      const res = await fetch(`${API_BASE}/auto-quant/runs`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    /**
     * Cancel a running pipeline
     * @param {string} runId
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async cancelRun(runId) {
      const res = await fetch(`${API_BASE}/auto-quant/runs/${runId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    /**
     * Open WebSocket for real-time updates
     * @param {string} runId
     * @returns {WebSocket}
     */
    connectWebSocket(runId) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return new WebSocket(`${protocol}//${window.location.host}/api/auto-quant/ws/${runId}`);
    },
  },
};

export default api;
