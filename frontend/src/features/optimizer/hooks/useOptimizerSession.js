import { useCallback, useEffect, useRef, useState } from "react";
import { INITIAL_POLL_MS, MAX_POLL_MS, TERMINAL_STATUSES } from "../constants";
import {
  cancelOptimizerSession,
  getApiSessionStatus,
  getOptimizerSession,
  listOptimizerSessions,
  startOptimizer,
} from "../api";

const BACKOFF_STEPS = [1000, 2000, 5000, 10000];
const MAX_POLL_RETRIES = 3;
const API_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function nextBackoff(currentDelay) {
  const currentStep = BACKOFF_STEPS.findIndex((step) => step >= currentDelay);
  return BACKOFF_STEPS[Math.min(currentStep + 1, BACKOFF_STEPS.length - 1)];
}

export function useOptimizerSession({ startLogs, resetTransientState }) {
  const [activeTab, setActiveTab] = useState("setup");
  const [optSessionId, setOptSessionId] = useState(null);
  const [apiSessionId, setApiSessionId] = useState(null);
  const [session, setSession] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySessions, setHistorySessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [sessionTimeout, setSessionTimeout] = useState(false);

  const pollRef = useRef(null);
  const pollModeRef = useRef(null);
  const pollDelayRef = useRef(INITIAL_POLL_MS);
  const retryCountRef = useRef(0);
  const startTimeRef = useRef(null);
  const timeoutWarnedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    pollModeRef.current = null;
  }, []);

  const fetchOptimizerSession = useCallback(async (optimizerSessionId) => {
    try {
      const data = await getOptimizerSession(optimizerSessionId);
      setSession(data);
      setSessionError(null);
      retryCountRef.current = 0;
      return data;
    } catch (err) {
      setSessionError(err.message || `Failed to load session ${optimizerSessionId}`);
      throw err;
    }
  }, []);

  const schedule = useCallback((fn, delay) => {
    pollRef.current = setTimeout(fn, delay);
  }, []);

  const startApiPolling = useCallback((apiId) => {
    stopPolling();
    pollModeRef.current = "api";
    pollDelayRef.current = INITIAL_POLL_MS;
    retryCountRef.current = 0;
    startTimeRef.current = Date.now();

    const poll = async () => {
      try {
        if (
          startTimeRef.current &&
          Date.now() - startTimeRef.current > API_TIMEOUT_MS &&
          !timeoutWarnedRef.current
        ) {
          timeoutWarnedRef.current = true;
          setSessionTimeout(true);
          setSessionError(`Optimizer has been running for more than ${API_TIMEOUT_MS / 60000} minutes. Polling will continue; check logs if progress looks stale.`);
        }

        const status = await getApiSessionStatus(apiId);
        setApiStatus(status.status);

        const optimizerId = status.result?.optimizer_session_id;
        if (optimizerId) {
          setOptSessionId(optimizerId);
          try {
            await fetchOptimizerSession(optimizerId);
            retryCountRef.current = 0; // Reset retry count on success
          } catch {
            retryCountRef.current++;
            if (retryCountRef.current >= MAX_POLL_RETRIES) {
              pollRef.current = null;
              pollModeRef.current = null;
              setIsRunning(false);
              setSessionError(`Failed to load optimizer session after ${MAX_POLL_RETRIES} retries`);
              return;
            }
          }
        }

        if (TERMINAL_STATUSES.has(status.status)) {
          pollRef.current = null;
          pollModeRef.current = null;
          setIsRunning(false);
          setActiveTab(status.status === "completed" ? "candidate" : "trials");
          if (optimizerId) {
            try {
              await fetchOptimizerSession(optimizerId);
            } catch (sessionErr) {
              // Final session load failure for completed session
              setSessionError(`Failed to load final session data: ${sessionErr.message}`);
            }
          }
          return;
        }

        pollDelayRef.current = nextBackoff(pollDelayRef.current);
        schedule(poll, pollDelayRef.current);
      } catch (err) {
        retryCountRef.current++;
        if (retryCountRef.current >= MAX_POLL_RETRIES) {
          pollRef.current = null;
          pollModeRef.current = null;
          setIsRunning(false);
          setSessionError(`Polling failed after ${MAX_POLL_RETRIES} retries: ${err.message}`);
          return;
        }
        pollDelayRef.current = Math.min(pollDelayRef.current * 2, MAX_POLL_MS);
        schedule(poll, pollDelayRef.current);
      }
    };

    schedule(poll, pollDelayRef.current);
  }, [fetchOptimizerSession, schedule, stopPolling]);

  const startOptimizerSessionPolling = useCallback((optimizerId) => {
    stopPolling();
    pollModeRef.current = "optimizer";
    retryCountRef.current = 0;
    const poll = async () => {
      try {
        const data = await fetchOptimizerSession(optimizerId);
        if (TERMINAL_STATUSES.has(data.phase)) {
          pollRef.current = null;
          pollModeRef.current = null;
          setIsRunning(false);
          return;
        }
      } catch {
        retryCountRef.current++;
        if (retryCountRef.current >= MAX_POLL_RETRIES) {
          pollRef.current = null;
          pollModeRef.current = null;
          setSessionError(`Historical session refresh failed after ${MAX_POLL_RETRIES} retries`);
          return;
        }
      }
      schedule(poll, 1500);
    };
    schedule(poll, 1500);
  }, [fetchOptimizerSession, schedule, stopPolling]);

  const runOptimizer = useCallback(async (payload) => {
    setSubmitError(null);
    setSessionError(null);
    setSessionTimeout(false);
    setSession(null);
    resetTransientState?.();
    setOptSessionId(null);
    setApiSessionId(null);
    setApiStatus("running");
    setIsRunning(true);
    setActiveTab("live");
    stopPolling();
    pollDelayRef.current = INITIAL_POLL_MS;
    retryCountRef.current = 0;
    startTimeRef.current = Date.now();
    timeoutWarnedRef.current = false;

    try {
      const data = await startOptimizer(payload);
      startLogs();
      setApiSessionId(data.session_id);
      startApiPolling(data.session_id);
      return data;
    } catch (err) {
      setSubmitError(err.message || String(err));
      setIsRunning(false);
      setApiStatus(null);
      setApiSessionId(null);
      setActiveTab("setup");
      return null;
    }
  }, [resetTransientState, startApiPolling, startLogs, stopPolling]);

  const stopOptimizer = useCallback(async () => {
    stopPolling();
    setApiStatus("cancelled");
    setIsRunning(false);
    if (!optSessionId) return;
    try {
      await cancelOptimizerSession(optSessionId);
      await fetchOptimizerSession(optSessionId);
    } catch {
      // Cancellation is reflected by the optimistic status update above.
    }
  }, [fetchOptimizerSession, optSessionId, stopPolling]);

  const loadHistory = useCallback(async (strategyName) => {
    if (!strategyName) return;
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const data = await listOptimizerSessions(strategyName);
      setHistorySessions(Array.isArray(data) ? data : []);
    } catch {
      setHistorySessions([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const selectHistory = useCallback(async (historyId) => {
    setHistoryOpen(false);
    stopPolling();
    setSessionError(null);
    setSessionTimeout(false);
    setOptSessionId(historyId);
    setApiSessionId(null);
    setIsRunning(false);
    setApiStatus(null);
    setSession(null);
    resetTransientState?.();
    setActiveTab("candidate");
    retryCountRef.current = 0;
    try {
      await fetchOptimizerSession(historyId);
      startOptimizerSessionPolling(historyId);
    } catch (err) {
      setSessionError(`Failed to load historical session: ${err.message}`);
    }
  }, [fetchOptimizerSession, resetTransientState, startOptimizerSessionPolling, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  return {
    activeTab,
    setActiveTab,
    optSessionId,
    apiSessionId,
    session,
    apiStatus,
    isRunning,
    submitError,
    sessionError,
    sessionTimeout,
    historyOpen,
    setHistoryOpen,
    historySessions,
    historyLoading,
    fetchOptimizerSession,
    runOptimizer,
    stopOptimizer,
    loadHistory,
    selectHistory,
    stopPolling,
  };
}
