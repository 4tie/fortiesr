import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_LOG } from "../constants";
import { createOptimizerLogStream } from "../api";

export function useOptimizerLogs() {
  const [logLines, setLogLines] = useState([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const esRef = useRef(null);

  const stopLogs = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const startLogs = useCallback(() => {
    stopLogs();
    setLogLines([]);
    const es = createOptimizerLogStream();
    esRef.current = es;
    es.onmessage = (event) => {
      let line = event.data;
      try {
        const payload = JSON.parse(event.data);
        line = payload.message || event.data;
      } catch {
        // Raw SSE log lines are still useful when the stream is not JSON.
      }
      setLogLines((prev) => {
        const next = [...prev, line];
        return next.length > MAX_LOG ? next.slice(-MAX_LOG) : next;
      });
    };
    es.onerror = () => {};
  }, [stopLogs]);

  const clearLogs = useCallback(() => setLogLines([]), []);

  useEffect(() => stopLogs, [stopLogs]);

  return {
    logLines,
    setLogLines,
    logsOpen,
    setLogsOpen,
    startLogs,
    stopLogs,
    clearLogs,
  };
}
