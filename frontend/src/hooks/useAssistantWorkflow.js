/**
 * useAssistantWorkflow
 *
 * Manages workflow card state derived from real SSE events.
 * Cards have stable identity keyed on action_id → tool_call_id → tool_name.
 * Each lifecycle event updates the SAME card rather than appending a new one.
 */
import { useCallback, useReducer } from "react";

// ── card lifecycle states ─────────────────────────────────────────────────────
export const CARD_STATUS = {
  PROPOSED:             "proposed",
  AWAITING_CONFIRMATION:"awaiting_confirmation",
  STARTING:             "starting",
  QUEUED:               "queued",
  RUNNING:              "running",
  COMPLETED:            "completed",
  FAILED:               "failed",
  CANCELLED:            "cancelled",
  // Two semantically distinct timeout states:
  OBSERVATION_PAUSED:   "observation_paused",  // assistant stopped monitoring — job may still run
  EXECUTION_TIMED_OUT:  "execution_timed_out", // backend job exceeded its limit
};

/**
 * Derive the best stable card key from a workflow event.
 * Priority: action_id > tool_call_id > tool_name
 */
export function cardKeyFromEvent(event) {
  if (event.action_id)    return `action:${event.action_id}`;
  if (event.tool_call_id) return `call:${event.tool_call_id}`;
  if (event.tool_name)    return `tool:${event.tool_name}`;
  return null;
}

/**
 * Friendly label for a tool name.
 */
function labelFromToolName(toolName) {
  return String(toolName || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── reducer ───────────────────────────────────────────────────────────────────

function cardsReducer(state, action) {
  const { event } = action;
  const key = cardKeyFromEvent(event);
  if (!key) return state;

  const existing = state[key] || null;

  switch (event.type) {
    case "tool_confirmation_required": {
      if (existing) return state; // already created
      return {
        ...state,
        [key]: {
          key,
          status:               CARD_STATUS.AWAITING_CONFIRMATION,
          toolName:             event.tool_name,
          title:                labelFromToolName(event.tool_name),
          arguments:            event.arguments || {},
          actionId:             event.action_id || null,
          toolCallId:           null,
          confirmationEndpoint: event.confirmation_endpoint || "/api/ai/actions/confirm",
          confirmationActionType: event.confirmation_action_type || "confirm_tool_action",
          confirmationPayload:  event.confirmation_payload || {},
          sessionId:            event.session_id || null,
          progress:             null,
          error:                null,
          result:               null,
          confirming:           false,
        },
      };
    }

    case "tool_started": {
      if (!existing) {
        // Synthesise a card for read-only tools that skip confirmation
        return {
          ...state,
          [key]: {
            key,
            status:     CARD_STATUS.STARTING,
            toolName:   event.tool_name,
            title:      labelFromToolName(event.tool_name),
            arguments:  event.arguments || {},
            actionId:   event.action_id || null,
            toolCallId: event.tool_call_id || null,
            progress:   null,
            error:      null,
            result:     null,
          },
        };
      }
      return {
        ...state,
        [key]: { ...existing, status: CARD_STATUS.STARTING, toolCallId: event.tool_call_id || existing.toolCallId, confirming: false },
      };
    }

    case "job_active": {
      const rawStatus = event.status || event.progress?.status || "running";
      const cardStatus = rawStatus === "queued" ? CARD_STATUS.QUEUED : CARD_STATUS.RUNNING;
      const base = existing || {
        key,
        toolName:   event.tool_name,
        title:      labelFromToolName(event.tool_name),
        arguments:  {},
        actionId:   null,
        toolCallId: event.tool_call_id || null,
        error:      null,
        result:     null,
      };
      return {
        ...state,
        [key]: { ...base, status: cardStatus, progress: event.progress || null },
      };
    }

    case "tool_progress": {
      const base = existing || {
        key,
        toolName:  event.tool_name,
        title:     labelFromToolName(event.tool_name),
        arguments: {},
        actionId:  null,
        toolCallId: event.tool_call_id || null,
        error:     null,
        result:    null,
        status:    CARD_STATUS.RUNNING,
      };
      return {
        ...state,
        [key]: { ...base, status: CARD_STATUS.RUNNING, progress: event.progress || null },
      };
    }

    case "tool_result": {
      if (!existing) return state;
      return {
        ...state,
        [key]: {
          ...existing,
          status:   CARD_STATUS.COMPLETED,
          result:   event.result || null,
          error:    null,
          progress: null,
        },
      };
    }

    case "tool_failed": {
      if (!existing) return state;
      return {
        ...state,
        [key]: {
          ...existing,
          status: CARD_STATUS.FAILED,
          error:  event.error || "Tool execution failed.",
          progress: null,
        },
      };
    }

    case "tool_cancelled": {
      if (!existing) return state;
      return {
        ...state,
        [key]: {
          ...existing,
          status: CARD_STATUS.CANCELLED,
          error:  event.error || null,
          progress: null,
        },
      };
    }

    case "tool_timed_out": {
      if (!existing) return state;
      // This is execution-level timeout (backend job exceeded its limit).
      // Display as execution_timed_out with amber/red styling.
      return {
        ...state,
        [key]: {
          ...existing,
          status: CARD_STATUS.EXECUTION_TIMED_OUT,
          error:  event.error || "Execution timed out.",
          progress: null,
        },
      };
    }

    case "observation_timeout": {
      // The assistant stopped monitoring — the job may still be running.
      // Use observation_paused status (NOT a failure state).
      // Map by job_type since there's no action_id in observation_timeout.
      const obsKey = event.api_session_id
        ? `obs:${event.api_session_id}`
        : key;
      const obsExisting = state[obsKey] || existing;
      if (!obsExisting) return state;
      return {
        ...state,
        [obsKey]: {
          ...obsExisting,
          status: CARD_STATUS.OBSERVATION_PAUSED,
          progress: null,
        },
      };
    }

    case "__patch": {
      const pKey = event.__key;
      if (!pKey || !state[pKey]) return state;
      return { ...state, [pKey]: { ...state[pKey], ...event.__patch } };
    }

    default:
      return state;
  }
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useAssistantWorkflow() {
  const [cards, dispatch] = useReducer(cardsReducer, {});

  const applyEvent = useCallback((event) => {
    dispatch({ event });
  }, []);

  const setCardConfirming = useCallback((key, confirming) => {
    dispatch({
      event: {
        // synthetic event to track in-flight confirmation
        type:       "__set_confirming",
        __key:      key,
        __confirming: confirming,
      },
    });
  }, []);

  // Patch for confirming state (handled outside main reducer for simplicity)
  const patchCard = useCallback((key, patch) => {
    dispatch({ event: { type: "__patch", __key: key, __patch: patch } });
  }, []);

  return {
    /** Map of cardKey → card object */
    cards,
    /** Sorted array of cards in insertion order */
    cardList: Object.values(cards),
    /** Apply a single workflow SSE event */
    applyEvent,
    /** Patch a card's fields directly (e.g. confirming: true) */
    patchCard,
  };
}
