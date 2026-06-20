import { useState, useEffect } from "react";

async function fetchWithRetry(url, maxAttempts = 8, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
      if (r.status < 500) return r;
    } catch (_) {}
    if (attempt < maxAttempts - 1) {
      await new Promise(res => setTimeout(res, Math.min(baseDelay * 2 ** attempt, 15000)));
    }
  }
  return null;
}

export function useStrategies() {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchWithRetry("/api/strategies")
      .then(r => (r ? r.json() : null))
      .then(data => { if (!cancelled) setStrategies(data?.strategies || []); })
      .catch(() => { if (!cancelled) setStrategies([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { strategies, loading };
}
