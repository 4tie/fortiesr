import { useState, useRef, useCallback, useEffect } from "react";
import { playChime } from "../utils";
import api from "../../../services/api";

export default function useAutoQuantPipeline(initialPipelineState = null) {
  const [runId, setRunId] = useState(initialPipelineState?.run_id ?? null);
  const [pipelineState, setPipelineState] = useState(initialPipelineState);
  const [logLines, setLogLines] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [report, setReport] = useState(null);
  const [fitnessCurve, setFitnessCurve] = useState([]);
  const [hyperoptProgress, setHyperoptProgress] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [runStartedAtMs, setRunStartedAtMs] = useState(null);
  const [wfoWindows, setWfoWindows] = useState([]);
  const [dataHealingStatus, setDataHealingStatus] = useState(null);
  const [pairStatusMap, setPairStatusMap] = useState({});

  // Refs for WebSocket and timers
  const elapsedRef = useRef(null);
  const startTimeRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const connectWsRef = useRef(null);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const clearElapsedTimer = useCallback(() => {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }, []);

  const resetPipelineState = useCallback(() => {
    clearElapsedTimer();
    clearReconnectTimeout();
    setLogLines([]);
    setFitnessCurve([]);
    setHyperoptProgress(null);
    setElapsedSeconds(0);
    setRunStartedAtMs(null);
    setWfoWindows([]);
    setDataHealingStatus(null);
    setPairStatusMap({});
    reconnectAttemptsRef.current = 0;
  }, [clearElapsedTimer, clearReconnectTimeout]);

  const handleWsMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === "log") {
        setLogLines((prev) => [...prev, msg.line]);
      } else if (msg.type === "stage_update") {
        setPipelineState((prev) => {
          if (!prev) return prev;
          const newStages = [...(prev.stages || [])];
          const idx = newStages.findIndex((s) => s.index === msg.stage_index);
          if (idx >= 0) {
            newStages[idx] = { ...newStages[idx], ...msg.stage };
          }
          return { ...prev, stages: newStages };
        });
      } else if (msg.type === "fitness_point") {
        setFitnessCurve((prev) => [...prev, msg.point]);
      } else if (msg.type === "hyperopt_progress") {
        setHyperoptProgress(msg.progress);
      } else if (msg.type === "wfo_window") {
        setWfoWindows((prev) => [...prev, msg.window]);
      } else if (msg.type === "data_healing_status") {
        setDataHealingStatus(msg.status);
      } else if (msg.type === "pair_status") {
        setPairStatusMap((prev) => ({ ...prev, [msg.pair]: msg.status }));
      } else if (msg.type === "pipeline_complete") {
        setPipelineState((prev) => ({ ...prev, status: "completed", completed_at: new Date().toISOString() }));
        clearElapsedTimer();
        clearReconnectTimeout();
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        playChime();
      } else if (msg.type === "pipeline_failed") {
        setPipelineState((prev) => ({ ...prev, status: "failed", completed_at: new Date().toISOString() }));
        clearElapsedTimer();
        clearReconnectTimeout();
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      } else if (msg.type === "pipeline_interrupted") {
        setPipelineState((prev) => ({ ...prev, status: "interrupted", completed_at: new Date().toISOString() }));
        clearElapsedTimer();
        clearReconnectTimeout();
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      }
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
    }
  }, [clearElapsedTimer, clearReconnectTimeout]);

  const connectWs = useCallback(() => {
    if (!runId) return;

    clearReconnectTimeout();
    setIsConnecting(true);

    const ws = api.autoquant.connectWebSocket(runId);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      reconnectAttemptsRef.current = 0;
      console.log("WebSocket connected");
    };

    ws.onmessage = handleWsMessage;

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setIsConnecting(false);
    };

    ws.onclose = (event = {}) => {
      setIsConnecting(false);
      console.log("WebSocket closed:", event.code, event.reason);

      const currentStatus = pipelineState?.status;
      const isTerminal = ["completed", "failed", "interrupted", "cancelled"].includes(currentStatus);

      if (!isTerminal && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connectWsRef.current?.();
        }, delay);
      }
    };
  }, [runId, pipelineState?.status, clearReconnectTimeout, handleWsMessage]);

  const startElapsedTimer = useCallback(() => {
    clearElapsedTimer();
    startTimeRef.current = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, [clearElapsedTimer]);

  const loadReport = useCallback(async (currentRunId) => {
    if (!currentRunId) return;
    try {
      const data = await api.autoquant.getReport(currentRunId);
      setReport(data);
    } catch (err) {
      console.error("Failed to load report:", err);
    }
  }, []);

  const startPipeline = useCallback(async (payload) => {
    try {
      resetPipelineState();
      const data = await api.autoquant.startRun(payload);
      setRunId(data.run_id);
      setPipelineState({ run_id: data.run_id, status: "running", created_at: new Date().toISOString() });
      setRunStartedAtMs(Date.now());
      startElapsedTimer();
      connectWs();
      return data.run_id;
    } catch (err) {
      console.error("Failed to start pipeline:", err);
      throw err;
    }
  }, [resetPipelineState, startElapsedTimer, connectWs]);

  const cancelPipeline = useCallback(async () => {
    if (!runId) return;
    try {
      await api.autoquant.cancelRun(runId);
      setPipelineState((prev) => ({ ...prev, status: "cancelled", completed_at: new Date().toISOString() }));
      clearElapsedTimer();
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    } catch (err) {
      console.error("Failed to cancel pipeline:", err);
      throw err;
    }
  }, [runId, clearElapsedTimer, clearReconnectTimeout]);

  // Load report when pipeline completes
  useEffect(() => {
    const load = async () => {
      if (pipelineState?.status === "completed" && runId && !report) {
        await loadReport(runId).catch((err) => console.error("Failed to load report:", err));
      }
    };
    load();
  }, [pipelineState?.status, runId, report, loadReport]);

  // Connect WebSocket when runId changes
  useEffect(() => {
    const connect = () => {
      if (runId && pipelineState?.status === "running") {
        connectWs();
      }
    };
    connect();
    return () => {
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [runId, pipelineState?.status, connectWs, clearReconnectTimeout]);

  // Update connectWs ref
  useEffect(() => {
    connectWsRef.current = connectWs;
  }, [connectWs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearElapsedTimer();
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearElapsedTimer, clearReconnectTimeout]);

  return {
    runId,
    setRunId,
    pipelineState,
    setPipelineState,
    logLines,
    setLogLines,
    isConnecting,
    report,
    setReport,
    fitnessCurve,
    setFitnessCurve,
    hyperoptProgress,
    setHyperoptProgress,
    elapsedSeconds,
    runStartedAtMs,
    setRunStartedAtMs,
    wfoWindows,
    setWfoWindows,
    dataHealingStatus,
    setDataHealingStatus,
    pairStatusMap,
    setPairStatusMap,
    startPipeline,
    cancelPipeline,
    loadReport,
    resetPipelineState,
  };
}
