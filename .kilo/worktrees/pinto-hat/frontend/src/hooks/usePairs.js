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

export function usePairs() {
  const [availablePairs, setAvailablePairs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchWithRetry("/api/pairs")
      .then(r => (r ? r.json() : null))
      .then(data => { if (!cancelled) setAvailablePairs(data?.available_pairs || []); })
      .catch(() => { if (!cancelled) setAvailablePairs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const searchPairs = async (q) => {
    if (!q.trim()) return [];
    try {
      const r = await fetch(`/api/pairs/search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      return data.matches || [];
    } catch {
      return [];
    }
  };

  return { availablePairs, searchPairs, loading };
}
