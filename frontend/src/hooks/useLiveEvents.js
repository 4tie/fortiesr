import { useState, useEffect, useCallback, useRef } from "react";

export function useLiveEvents() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const eventSourceRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const poll = async () => {
      try {
        const response = await fetch('/api/events/recent');
        if (response.ok) {
          const data = await response.json();
          setEvents(data.events || []);
          setConnected(true);
          setLastError(null);
        }
      } catch (error) {
        console.error('Polling error:', error);
        setConnected(false);
        setLastError('Polling failed');
      }
    };

    // Initial poll
    poll();
    // Poll every 8 seconds
    pollingIntervalRef.current = setInterval(poll, 8000);
  }, []);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource('/api/events/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
        setLastError(null);
        // Clear polling if SSE connects
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setEvents(prev => [data, ...prev].slice(0, 100)); // Keep last 100 events
        } catch (e) {
          console.error('Failed to parse event:', e);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        setConnected(false);
        setLastError('Connection lost, switching to polling');
        eventSource.close();
        // Fall back to polling
        startPolling();
      };
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      setLastError('SSE not supported, using polling');
      startPolling();
    }
  }, [startPolling]);

  useEffect(() => {
    // Try SSE first
    const timeoutId = setTimeout(() => {
      connectSSE();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      const eventSource = eventSourceRef.current;
      if (eventSource) {
        eventSource.close();
      }
      const pollingInterval = pollingIntervalRef.current;
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [connectSSE]);

  return { events, connected, lastError };
}
