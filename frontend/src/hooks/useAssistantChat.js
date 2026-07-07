/**
 * useAssistantChat
 *
 * Handles the core chat streaming, workflow event dispatch, session restore,
 * and action confirmation. Shared between the Mini Assistant and the full
 * AssistantChatPanel surface — all connected to the same backend session.
 */
import { useCallback, useRef, useState } from "react";
import { useAssistantWorkflow } from "./useAssistantWorkflow.js";

// SSE event types that drive workflow cards (not raw text messages)
const WORKFLOW_EVENT_TYPES = new Set([
  "tool_confirmation_required",
  "tool_started",
  "job_active",
  "tool_progress",
  "tool_result",
  "tool_failed",
  "tool_cancelled",
  "tool_timed_out",
  "execution_timeout",
  "observation_timeout",
  "observation_paused",
  "monitoring_paused",
]);

// ── SSE parser ────────────────────────────────────────────────────────────────

export function parseSseEvent(chunk) {
  const event = { type: "message", data: "" };
  chunk.split("\n").forEach((line) => {
    if (line.startsWith("event:")) event.type = line.slice(6).trim();
    if (line.startsWith("data:"))  event.data += line.slice(5).trim();
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

function mergeAssistantContent(current, incoming, { append = false } = {}) {
  const prev = String(current || "");
  const next = String(incoming || "");
  if (!next) return prev;
  if (append) return prev + next;
  if (next === prev) return prev;
  if (next.startsWith(prev)) return next;
  if (prev.endsWith(next)) return prev;
  return prev + next;
}

// ── rebuild timeline from persisted session ───────────────────────────────────

function buildTimelineFromSession(session) {
  if (!session || !Array.isArray(session.messages)) return [];
  const items = [];
  let counter = 0;
  for (const msg of session.messages) {
    // Skip system / tool messages from the chat timeline
    if (msg.role === "system" || msg.role === "tool") continue;
    counter += 1;
    items.push({
      id:      msg.id || `restored-${counter}`,
      role:    msg.role,
      content: msg.content || "",
      type:    "message",
    });
  }
  return items;
}

function buildCardsFromSession(session) {
  if (!session) return [];
  const events = [];

  // Pending actions → awaiting confirmation cards
  for (const pending of session.pending_actions || []) {
    events.push({
      type:                   "tool_confirmation_required",
      action_id:              pending.action_id,
      tool_name:              pending.tool_name,
      arguments:              pending.arguments || {},
      confirmation_endpoint:  "/api/ai/actions/confirm",
      confirmation_action_type: "confirm_tool_action",
      confirmation_payload:   { action_id: pending.action_id },
    });
  }

  // Tool runs → completed / failed / cancelled cards
  const seenKeys = new Set();
  for (const run of session.tool_runs || []) {
    const key = run.action_id
      ? `action:${run.action_id}`
      : run.tool_call_id
        ? `call:${run.tool_call_id}`
        : `tool:${run.tool_name}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    if (run.status === "completed") {
      // Synthesise: started → completed
      events.push({ type: "tool_started", tool_name: run.tool_name, tool_call_id: run.tool_call_id });
      events.push({ type: "tool_result",  tool_name: run.tool_name, tool_call_id: run.tool_call_id, result: run.result_summary });
    } else if (run.status === "failed") {
      events.push({ type: "tool_started", tool_name: run.tool_name, tool_call_id: run.tool_call_id });
      events.push({ type: "tool_failed",  tool_name: run.tool_name, tool_call_id: run.tool_call_id, error: run.error });
    } else if (run.status === "cancelled") {
      events.push({ type: "tool_started",   tool_name: run.tool_name, tool_call_id: run.tool_call_id });
      events.push({ type: "tool_cancelled", tool_name: run.tool_name, tool_call_id: run.tool_call_id });
    } else if (run.status === "timed_out") {
      events.push({ type: "tool_started",    tool_name: run.tool_name, tool_call_id: run.tool_call_id });
      events.push({ type: "tool_timed_out",  tool_name: run.tool_name, tool_call_id: run.tool_call_id, error: run.error });
    } else {
      // running / queued — show as observation paused since UI closed
      events.push({ type: "tool_started", tool_name: run.tool_name, tool_call_id: run.tool_call_id });
      events.push({ type: "observation_timeout", tool_name: run.tool_name, api_session_id: run.tool_call_id });
    }
  }

  // active_jobs — running background jobs that have no tool_run record yet.
  // Synthesise: tool_started → job_active (with progress) → observation_timeout
  const seenJobKeys = new Set();
  for (const job of session.active_jobs || []) {
    const jobToolName = job.job_type
      ? `run_${job.job_type}`.replace(/-/g, "_")  // e.g. "optimizer" → "run_optimizer"
      : null;
    const toolName = job.tool_name || jobToolName || null;
    if (!toolName) continue;

    const jobKey = job.action_id
      ? `action:${job.action_id}`
      : job.tool_call_id
        ? `call:${job.tool_call_id}`
        : `tool:${toolName}`;

    if (seenJobKeys.has(jobKey) || seenKeys.has(jobKey)) continue;
    seenJobKeys.add(jobKey);

    events.push({
      type:               "tool_started",
      tool_name:          toolName,
      tool_call_id:       job.tool_call_id   || null,
      action_id:          job.action_id       || null,
      api_session_id:     job.api_session_id  || null,
      optimizer_session_id: job.optimizer_session_id || null,
      run_id:             job.run_id          || null,
      auto_quant_run_id:  job.auto_quant_run_id || null,
    });

    events.push({
      type:               "job_active",
      tool_name:          toolName,
      tool_call_id:       job.tool_call_id   || null,
      status:             job.status         || "running",
      api_session_id:     job.api_session_id  || null,
      optimizer_session_id: job.optimizer_session_id || null,
      run_id:             job.run_id          || null,
      auto_quant_run_id:  job.auto_quant_run_id || null,
      progress:           job.progress        || null,
    });
  }

  return events;
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useAssistantChat({ contextOverrides = {}, mode: defaultMode = "analysis" } = {}) {
  const [messages, setMessages]   = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus]       = useState("idle");
  const [error, setError]         = useState("");
  const [availableActions, setAvailableActions] = useState([]);
  const [restored, setRestored]   = useState(false);

  const workflow = useAssistantWorkflow();

  const messageCounterRef  = useRef(0);
  const restoredSessionRef = useRef(null);

  // ── helpers ────────────────────────────────────────────────────────────────

  const updateAssistantMessage = useCallback((assistantId, updater) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? updater(m) : m))
    );
  }, []);

  const appendTimelineItem = useCallback((item) => {
    setMessages((prev) => [...prev, item]);
  }, []);

  // ── session restore ────────────────────────────────────────────────────────

  const restoreSession = useCallback(async (sid) => {
    if (!sid || restoredSessionRef.current === sid) return;
    restoredSessionRef.current = sid;
    try {
      const res = await fetch(`/api/ai/chat/${sid}`);
      if (!res.ok) return;
      const session = await res.json();

      // FIX: Persist the session_id so subsequent sendMessage calls include it
      setSessionId(sid);

      // Rebuild messages
      const restoredMessages = buildTimelineFromSession(session);

      // Rebuild cards from tool runs, pending actions, and active_jobs
      const cardEvents = buildCardsFromSession(session);
      for (const ev of cardEvents) {
        workflow.applyEvent(ev);
      }

      // Deduplicate: don't append messages already in state
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = restoredMessages.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newOnes];
      });

      setRestored(true);
    } catch {
      // Restore is best-effort; silent failure is acceptable
    }
  }, [workflow]);

  // ── SSE stream consumer ────────────────────────────────────────────────────

  const consumeStream = useCallback(
    async (response, assistantId) => {
      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedContent = "";
      let hasStreamedContent = false;

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
            if (event.data?.session_id) {
              setSessionId(event.data.session_id);
              restoreSession(event.data.session_id);
            }
            if (event.data?.available_actions) {
              setAvailableActions(event.data.available_actions);
            }
            continue;
          }

          if (event.type === "token") {
            const token = event.data?.content || "";
            if (!token) continue;
            hasStreamedContent = true;
            streamedContent = mergeAssistantContent(streamedContent, token, { append: true });
            updateAssistantMessage(assistantId, (m) => ({ ...m, content: streamedContent }));
            continue;
          }

          if (event.type === "done") {
            if (event.data?.session_id) setSessionId(event.data.session_id);
            if (event.data?.available_actions) setAvailableActions(event.data.available_actions);
            const finalContent = getDoneContent(event.data);
            if (finalContent) {
              streamedContent = mergeAssistantContent(streamedContent, finalContent);
              updateAssistantMessage(assistantId, (m) => ({ ...m, content: streamedContent }));
            }
            setStatus("idle");
            continue;
          }

          if (event.type === "error") {
            throw new Error(event.data?.detail || event.data?.message || "Assistant stream failed.");
          }

          if (event.type === "message" || event.type === "final") {
            // Copilot streaming: message/final are content snapshots, not additive tokens.
            const chunk = event.data?.content || "";
            if (chunk) {
              hasStreamedContent = true;
              streamedContent = mergeAssistantContent(streamedContent, chunk);
              updateAssistantMessage(assistantId, (m) => ({ ...m, content: streamedContent }));
            }
            continue;
          }

          if (event.type === "status") {
            // Orchestration status updates (e.g. "Thinking step 2...") — ignore in chat
            continue;
          }

          if (WORKFLOW_EVENT_TYPES.has(event.type)) {
            // Apply event to workflow card state
            workflow.applyEvent({ ...event.data, type: event.type });
          }
        }
      }

      setStatus("idle");
    },
    [restoreSession, updateAssistantMessage, workflow]
  );

  // ── send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (rawText, request = {}) => {
      const text = String(rawText || "").trim();
      if (!text || status === "sending" || status === "streaming") return false;

      messageCounterRef.current += 1;
      const n = messageCounterRef.current;
      const userId      = `mini-user-${n}`;
      const assistantId = `mini-assistant-${n}`;

      setError("");
      setStatus("sending");
      setMessages((prev) => [
        ...prev,
        { id: userId,      role: "user",      content: text,  type: "message" },
        { id: assistantId, role: "assistant",  content: "",    type: "message" },
      ]);

      try {
        const response = await fetch("/api/ai/chat/stream", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            message:          text,
            session_id:       sessionId,
            mode:             request.mode || defaultMode || "analysis",
            model:            request.model || undefined,
            include_strategy_source: Boolean(request.includeStrategySource),
            context_overrides: request.contextOverrides || contextOverrides || {},
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
        await consumeStream(response, assistantId);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Assistant request failed.";
        setError(msg);
        setStatus("error");
        updateAssistantMessage(assistantId, (m) => ({
          ...m,
          content: `Assistant error: ${msg}`,
          error: true,
        }));
        return false;
      }
    },
    [contextOverrides, defaultMode, sessionId, status, consumeStream, updateAssistantMessage]
  );

  // ── confirm workflow action ────────────────────────────────────────────────
  /**
   * Confirm a pending workflow tool action.
   * - cardKey: the key of the WorkflowCard to update
   * - card: the current card object containing confirmation metadata
   *
   * Sends POST /api/ai/actions/confirm with the copilot confirmation contract.
   * The response is SSE — its events are consumed and fed into workflow.applyEvent.
   */
  const confirmAction = useCallback(
    async (cardKey, card) => {
      if (!card || !card.actionId) return;

      // Mark card as confirming
      workflow.patchCard(cardKey, { confirming: true, status: "starting" });

      try {
        const response = await fetch(card.confirmationEndpoint || "/api/ai/actions/confirm", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            action_type: card.confirmationActionType || "confirm_tool_action",
            payload:     { ...card.confirmationPayload, action_id: card.actionId },
            session_id:  sessionId,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || "Confirmation failed.");
        }

        // The confirmation response is SSE
        if (response.body?.getReader) {
          // Synthesise an assistantId to capture any post-confirmation AI text
          messageCounterRef.current += 1;
          const confirmId = `mini-assistant-confirm-${messageCounterRef.current}`;
          appendTimelineItem({ id: confirmId, role: "assistant", content: "", type: "message" });
          setStatus("streaming");
          await consumeStream(response, confirmId);
        } else {
          // Non-streaming fallback: parse JSON result
          const data = await response.json().catch(() => ({}));
          const terminalType = data.status === "completed" ? "tool_result"
            : data.status === "failed"    ? "tool_failed"
            : data.status === "cancelled" ? "tool_cancelled"
            : "tool_result";
          workflow.applyEvent({
            type:         terminalType,
            tool_name:    card.toolName,
            action_id:    card.actionId,
            result:       data.result_summary || data,
            error:        data.error || null,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Confirmation failed.";
        setError(msg);
        workflow.applyEvent({
          type:      "tool_failed",
          tool_name: card.toolName,
          action_id: card.actionId,
          error:     msg,
        });
      } finally {
        workflow.patchCard(cardKey, { confirming: false });
        setStatus("idle");
      }
    },
    [sessionId, workflow, consumeStream, appendTimelineItem]
  );

  // ── execute read-only / draft action ──────────────────────────────────────
  /**
   * Execute an available_actions item (from the done/meta events).
   * Read-only and draft actions execute immediately.
   * Result is appended as an assistant message.
   */
  const executeAction = useCallback(
    async (action) => {
      if (!action?.action_type) return;

      const tempId = `mini-action-${Date.now()}`;
      appendTimelineItem({ id: tempId, role: "assistant", content: "", type: "message", loading: true });
      setStatus("streaming");

      try {
        const res = await fetch("/api/ai/actions/confirm", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            action_type:        action.action_type,
            payload:            action.payload || {},
            session_id:         sessionId,
            confirmation_token: "CONFIRM",
          }),
        });

        // Confirmation endpoint may return SSE or JSON
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/event-stream") && res.body?.getReader) {
          await consumeStream(res, tempId);
        } else {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || "Action failed.");
          const text = typeof data === "string"
            ? data
            : JSON.stringify(data, null, 2);
          updateAssistantMessage(tempId, (m) => ({ ...m, content: `**${action.label}**\n\n\`\`\`json\n${text}\n\`\`\``, loading: false }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Action failed.";
        updateAssistantMessage(tempId, (m) => ({
          ...m,
          content: `Error running action: ${msg}`,
          error: true,
          loading: false,
        }));
      } finally {
        setStatus("idle");
      }
    },
    [sessionId, consumeStream, appendTimelineItem, updateAssistantMessage]
  );

  return {
    messages,
    sessionId,
    status,
    error,
    restored,
    availableActions,
    // Workflow card state
    cards:     workflow.cards,
    cardList:  workflow.cardList,
    // Actions
    sendMessage,
    confirmAction,
    executeAction,
    restoreSession,
  };
}
