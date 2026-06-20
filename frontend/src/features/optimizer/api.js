async function parseJsonResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || fallbackMessage || response.statusText);
  }
  return data;
}

function signalInit(options = {}) {
  return options.signal ? { signal: options.signal } : undefined;
}

function fetchOptionalInit(url, init) {
  return init ? fetch(url, init) : fetch(url);
}

export async function getOptimizerSearchSpaces(strategyName, options = {}) {
  const response = await fetchOptionalInit(
    `/api/optimizer/search-spaces/${encodeURIComponent(strategyName)}`,
    signalInit(options),
  );
  return parseJsonResponse(response, "Failed to load optimizer search spaces.");
}

export async function startOptimizer(payload, options = {}) {
  const response = await fetch("/api/optimizer/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return parseJsonResponse(response, "Failed to start optimizer.");
}

export async function getApiSessionStatus(apiSessionId, options = {}) {
  const response = await fetch(`/api/session/status/${apiSessionId}`, {
    cache: "no-store",
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return parseJsonResponse(response, `Failed to load session status ${apiSessionId}.`);
}

export async function getOptimizerSession(optimizerSessionId, options = {}) {
  const response = await fetch(`/api/optimizer/session/${optimizerSessionId}`, {
    cache: "no-store",
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return parseJsonResponse(response, `Failed to load optimizer session ${optimizerSessionId}.`);
}

export async function listOptimizerSessions(strategyName, options = {}) {
  const response = await fetchOptionalInit(
    `/api/optimizer/sessions?strategy_name=${encodeURIComponent(strategyName)}`,
    signalInit(options),
  );
  return parseJsonResponse(response, "Failed to load optimizer history.");
}

export async function cancelOptimizerSession(optimizerSessionId, options = {}) {
  const response = await fetch(`/api/optimizer/cancel/${optimizerSessionId}`, {
    method: "POST",
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return parseJsonResponse(response, "Failed to cancel optimizer session.");
}

export async function applyOptimizerTrial({ strategyName, parameters }, options = {}) {
  const response = await fetch("/api/optimizer/apply-trial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy_name: strategyName, parameters }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return parseJsonResponse(response, "Failed to apply parameters.");
}

export async function getTrialApplicationPreview({ optimizerSessionId, trialNumber }, options = {}) {
  const response = await fetchOptionalInit(
    `/api/optimizer/session/${optimizerSessionId}/trial/${trialNumber}/preview-application`,
    signalInit(options),
  );
  return parseJsonResponse(response, "Preview unavailable.");
}

export async function getTrialParams({ optimizerSessionId, trialNumber = null }, options = {}) {
  const path = trialNumber == null
    ? `/api/optimizer/session/${optimizerSessionId}/best-trial/params`
    : `/api/optimizer/session/${optimizerSessionId}/trial/${trialNumber}/params`;
  const response = await fetchOptionalInit(path, signalInit(options));
  return parseJsonResponse(response, "Failed to load params.");
}

export async function promoteOptimizerTrial({ optimizerSessionId, trial = null }, options = {}) {
  const url = trial?.trial_number
    ? `/api/optimizer/session/${optimizerSessionId}/trial/${trial.trial_number}/promote-candidate`
    : `/api/optimizer/session/${optimizerSessionId}/best-trial/promote-candidate`;
  const response = await fetch(url, {
    method: "POST",
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return parseJsonResponse(response, "Promotion failed.");
}

export async function exportOptimizerTrials(trials, options = {}) {
  const response = await fetch("/api/optimizer/export-trials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trials }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return parseJsonResponse(response, "Export failed.");
}

export function createOptimizerLogStream() {
  return new EventSource("/api/logs/stream");
}
