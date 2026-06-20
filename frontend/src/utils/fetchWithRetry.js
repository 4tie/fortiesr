/**
 * Shared fetchWithRetry utility
 * Handles HTTP requests with exponential backoff retry logic
 */

export async function fetchWithRetry(url, maxAttempts = 8, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
      if (r.status < 500) return r;
    } catch {
      // Intentionally silent - retry logic handles failures
    }
    if (attempt < maxAttempts - 1) {
      await new Promise(res => setTimeout(res, Math.min(baseDelay * 2 ** attempt, 15000)));
    }
  }
  return null;
}
