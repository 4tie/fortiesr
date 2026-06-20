import { useState, useEffect } from "react";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";

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
