import api from "../../services/api";

export function loadAutoQuantOptions() {
  return api.autoquant.loadOptions();
}

export function saveAutoQuantOptions(options) {
  return api.autoquant.saveOptions(options);
}

export function loadTimeframeThresholds(timeframe) {
  return api.autoquant.loadTimeframeThresholds(timeframe);
}

export function generateTemplate(payload) {
  return api.autoquant.generateTemplate(payload);
}

export function screenPairs(payload) {
  return api.autoquant.screenPairs(payload);
}

export function startRun(payload) {
  return api.autoquant.startRun(payload);
}

export function cancelRun(runId) {
  return api.autoquant.cancelRun(runId);
}

export function resumeRun(runId, approvedPairs) {
  return api.autoquant.resumeRun(runId, approvedPairs);
}

export function listAISuggestions(runId) {
  return api.autoquant.listAISuggestions(runId);
}

export function approveAISuggestion(runId, suggestionId) {
  return api.autoquant.approveAISuggestion(runId, suggestionId);
}

export function rejectAISuggestion(runId, suggestionId) {
  return api.autoquant.rejectAISuggestion(runId, suggestionId);
}

export function explainStage(runId, payload) {
  return api.autoquant.explainStage(runId, payload);
}

export function explainFailure(runId, payload) {
  return api.autoquant.explainFailure(runId, payload);
}

export function getReport(runId) {
  return api.autoquant.getReport(runId);
}

export function listRuns() {
  return api.autoquant.listRuns();
}
