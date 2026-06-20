import { useCallback, useEffect, useState } from "react";
import { listPairExplorerSessions } from "../api";

export function usePairExplorerHistory() {
  const [pastSessions, setPastSessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await listPairExplorerSessions();
      setPastSessions(data.sessions || []);
    } catch (err) {
      console.debug("Failed to load pair explorer history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadHistory();
    });
  }, [loadHistory]);

  return {
    pastSessions,
    historyLoading,
    loadHistory,
  };
}
