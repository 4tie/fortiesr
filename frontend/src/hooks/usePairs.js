import { useState, useEffect } from "react";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";

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
