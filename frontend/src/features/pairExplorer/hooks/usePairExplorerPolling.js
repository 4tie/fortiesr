import { useCallback, useEffect, useRef } from "react";
import { POLL_MS, TERMINAL_STATUSES } from "../constants";
import { getPairExplorerSession } from "../api";

export function usePairExplorerPolling({ onSession, onTerminal }) {
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (sessionId) => {
      stopPolling();
      const pollOnce = async () => {
        try {
          const data = await getPairExplorerSession(sessionId);
          onSession(data);
          if (TERMINAL_STATUSES.has(data.status)) {
            stopPolling();
            onTerminal(data);
          }
        } catch (err) {
          console.debug("Failed to poll pair explorer session:", err);
        }
      };
      void pollOnce();
      pollRef.current = setInterval(pollOnce, POLL_MS);
    },
    [onSession, onTerminal, stopPolling]
  );

  useEffect(() => stopPolling, [stopPolling]);

  return {
    startPolling,
    stopPolling,
  };
}
