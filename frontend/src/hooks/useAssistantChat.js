import { useCallback, useRef, useState } from "react";

const WORKFLOW_EVENT_TYPES = new Set([
  "tool_confirmation_required",
  "tool_started",
  "job_active",
  "tool_progress",
  "tool_result",
  "tool_failed",
  "tool_cancelled",
  "tool_timed_out",
]);

function parseSseEvent(chunk) {
  const event = { type: "message", data: "" };

  chunk.split("\n").forEach((line) => {
    if (line.startsWith("event:")) event.type = line.slice(6).trim();
    if (line.startsWith("data:")) event.data += line.slice(5).trim();
  });

  if (!event.data) return null;

  try {
    return { type: event.type, data: JSON.parse(event.data) };
  } catch {
    return { type: event.type, data: { content: event.data } };
  }
}

function getDoneContent(data) {
  return data?.message?.content || data?.content || data?.text || "";
}

export function useAssistantChat({ contextOverrides = {} } = {}) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [workflowEvents, setWorkflowEvents] = useState([]);
  const messageCounterRef = useRef(0);

  const updateAssistantMessage = useCallback((assistantId, updater) => {
    setMessages((current) => current.map((message) => (
      message.id === assistantId ? updater(message) : message
    )));
  }, []);

  const sendMessage = useCallback(async (rawText) => {
    const text = String(rawText || "").trim();
    if (!text || status === "sending" || status === "streaming") return false;

    messageCounterRef.current += 1;
    const messageNumber = messageCounterRef.current;
    const userId = `mini-user-${messageNumber}`;
    const assistantId = `mini-assistant-${messageNumber}`;
    let streamedContent = "";
    let hasStreamedContent = false;

    setError("");
    setStatus("sending");
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: text },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          mode: "analysis",
          context_overrides: contextOverrides || {},
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Assistant request failed.");
      }

      if (!response.body?.getReader) {
        throw new Error("Assistant streaming is not available in this browser.");
      }

      setStatus("streaming");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const event = parseSseEvent(part);
          if (!event) continue;

          if (event.type === "meta") {
            if (event.data?.session_id) setSessionId(event.data.session_id);
            continue;
          }

          if (event.type === "token") {
            const token = event.data?.content || "";
            if (!token) continue;
            hasStreamedContent = true;
            streamedContent += token;
            updateAssistantMessage(assistantId, (message) => ({
              ...message,
              content: streamedContent,
            }));
            continue;
          }

          if (event.type === "done") {
            if (event.data?.session_id) setSessionId(event.data.session_id);
            const finalContent = getDoneContent(event.data);
            if (!hasStreamedContent && finalContent) {
              streamedContent = finalContent;
              updateAssistantMessage(assistantId, (message) => ({
                ...message,
                content: finalContent,
              }));
            }
            setStatus("idle");
            continue;
          }

          if (event.type === "error") {
            throw new Error(event.data?.detail || event.data?.message || "Assistant stream failed.");
          }

          if (WORKFLOW_EVENT_TYPES.has(event.type)) {
            setWorkflowEvents((current) => [...current, event]);
          }
        }
      }

      setStatus("idle");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assistant request failed.";
      setError(message);
      setStatus("error");
      updateAssistantMessage(assistantId, (current) => ({
        ...current,
        content: `Assistant error: ${message}`,
        error: true,
      }));
      return false;
    }
  }, [contextOverrides, sessionId, status, updateAssistantMessage]);

  return {
    messages,
    sessionId,
    status,
    error,
    workflowEvents,
    sendMessage,
  };
}
