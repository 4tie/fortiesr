import { useState, useEffect, useRef, useCallback } from "react";

const SAVE_DEBOUNCE = 400;

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

export function useSharedState() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pending = useRef(null);
  const timer = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    fetchWithRetry("/api/shared-state")
      .then(r => (r ? r.json() : null))
      .then(data => {
        if (mounted.current) {
          setState(data || {});
          setError(null);
        }
      })
      .catch(err => {
        if (mounted.current) {
          setState({});
          setError(err?.message || "Failed to load shared state");
        }
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });

    return () => {
      mounted.current = false;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  const sync = useCallback((patch) => {
    setState((prev) => ({ ...(prev || {}), ...patch }));
    pending.current = { ...(pending.current || {}), ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const body = pending.current;
      pending.current = null;
      timer.current = null;
      fetch("/api/shared-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    }, SAVE_DEBOUNCE);
  }, []);

  return { state, setState, loading, error, sync };
}
