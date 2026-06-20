import { useCallback, useEffect, useRef } from "react";

const SAVE_DEBOUNCE = 300;

export function useAgentUiState() {
  const pending = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return useCallback((patch) => {
    pending.current = { ...(pending.current || {}), ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const body = pending.current;
      pending.current = null;
      timer.current = null;
      fetch("/api/agent/ui-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    }, SAVE_DEBOUNCE);
  }, []);
}
