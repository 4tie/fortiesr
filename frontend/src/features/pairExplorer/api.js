async function parseJsonResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || fallbackMessage || response.statusText);
  }
  return data;
}

export function normalizePairExplorerSession(session) {
  if (!session) return session;
  const rawResults = session.results;
  const results = Array.isArray(rawResults)
    ? rawResults
    : rawResults && typeof rawResults === "object"
      ? Object.values(rawResults)
      : [];
  return {
    ...session,
    results,
  };
}

export async function listPairExplorerSessions() {
  const response = await fetch("/api/strategy/pair-explorer");
  return parseJsonResponse(response, "Failed to load pair exploration history.");
}

export async function getPairSelectorState() {
  const response = await fetch("/api/pairs");
  return parseJsonResponse(response, "Failed to load configured pairs.");
}

export async function startPairExplorer(payload) {
  const response = await fetch("/api/strategy/pair-explorer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response, "Failed to start exploration.");
}

export async function getPairExplorerSession(sessionId) {
  const response = await fetch(`/api/strategy/pair-explorer/${sessionId}`);
  const data = await parseJsonResponse(response, `Failed to load pair exploration session ${sessionId}.`);
  return normalizePairExplorerSession(data);
}
