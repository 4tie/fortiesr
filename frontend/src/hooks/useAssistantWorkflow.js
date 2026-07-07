/**
 * useAssistantWorkflow
 *
 * Manages workflow card state derived from real SSE events. A card has one
 * canonical key, while backend identifiers are tracked as aliases to that key.
 */
import { useCallback, useReducer } from "react";

export const CARD_STATUS = {
  PROPOSED: "proposed",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  STARTING: "starting",
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  OBSERVATION_PAUSED: "observation_paused",
  EXECUTION_TIMED_OUT: "execution_timed_out",
};

export const INITIAL_WORKFLOW_STATE = {
  cards: {},
  aliases: {},
  activeByTool: {},
};

const TERMINAL_STATUSES = new Set([
  CARD_STATUS.COMPLETED,
  CARD_STATUS.FAILED,
  CARD_STATUS.CANCELLED,
  CARD_STATUS.OBSERVATION_PAUSED,
  CARD_STATUS.EXECUTION_TIMED_OUT,
]);

function labelFromToolName(toolName) {
  return String(toolName || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function aliasEntriesFromEvent(event = {}) {
  return [
    ["action", event.action_id],
    ["call", event.tool_call_id],
    ["api", event.api_session_id],
    ["optimizer", event.optimizer_session_id],
    ["run", event.run_id || event.backtest_run_id],
    ["autoquant", event.auto_quant_run_id],
  ]
    .filter(([, value]) => value != null && value !== "")
    .map(([kind, value]) => `${kind}:${value}`);
}

export function cardKeyFromEvent(event) {
  return aliasEntriesFromEvent(event)[0] || null;
}

function mergeAliases(state, canonicalKey, event) {
  const aliases = { ...state.aliases, [canonicalKey]: canonicalKey };
  for (const alias of aliasEntriesFromEvent(event)) {
    aliases[alias] = canonicalKey;
  }
  return aliases;
}

function resolveCardKey(state, event) {
  for (const alias of aliasEntriesFromEvent(event)) {
    if (state.aliases[alias]) return state.aliases[alias];
    if (state.cards[alias]) return alias;
  }

  const toolName = event.tool_name;
  if (!toolName) return null;

  const candidates = (state.activeByTool[toolName] || []).filter((key) => {
    const card = state.cards[key];
    return card && !TERMINAL_STATUSES.has(card.status);
  });

  return candidates.length === 1 ? candidates[0] : null;
}

function rememberActiveTool(state, card) {
  if (!card?.toolName || TERMINAL_STATUSES.has(card.status)) return state.activeByTool;
  const existing = state.activeByTool[card.toolName] || [];
  return {
    ...state.activeByTool,
    [card.toolName]: [...existing.filter((key) => key !== card.key), card.key],
  };
}

function withCard(state, key, card, event) {
  const mergedCard = {
    ...card,
    key,
    actionId: card.actionId || event.action_id || null,
    toolCallId: card.toolCallId || event.tool_call_id || null,
    apiSessionId: card.apiSessionId || event.api_session_id || null,
    optimizerSessionId: card.optimizerSessionId || event.optimizer_session_id || null,
    runId: card.runId || event.run_id || event.backtest_run_id || null,
    autoQuantRunId: card.autoQuantRunId || event.auto_quant_run_id || null,
    jobType: card.jobType || event.job_type || null,
  };
  const next = {
    cards: { ...state.cards, [key]: mergedCard },
    aliases: mergeAliases(state, key, event),
    activeByTool: state.activeByTool,
  };
  return { ...next, activeByTool: rememberActiveTool(next, mergedCard) };
}

function baseCard(key, event, status) {
  return {
    key,
    status,
    toolName: event.tool_name,
    title: labelFromToolName(event.tool_name),
    arguments: event.arguments || {},
    actionId: event.action_id || null,
    toolCallId: event.tool_call_id || null,
    confirmationEndpoint: event.confirmation_endpoint || "/api/ai/actions/confirm",
    confirmationActionType: event.confirmation_action_type || "confirm_tool_action",
    confirmationPayload: event.confirmation_payload || {},
    sessionId: event.session_id || null,
    progress: null,
    error: null,
    result: null,
    confirming: false,
  };
}

export function workflowReducer(state = INITIAL_WORKFLOW_STATE, action) {
  const event = action?.event || {};
  const resolvedKey = resolveCardKey(state, event);
  const key = resolvedKey || cardKeyFromEvent(event);
  if (!key) return state;

  const existing = state.cards[key] || null;

  switch (event.type) {
    case "tool_confirmation_required": {
      if (existing) return withCard(state, key, existing, event);
      return withCard(state, key, baseCard(key, event, CARD_STATUS.AWAITING_CONFIRMATION), event);
    }

    case "tool_started": {
      const card = existing || baseCard(key, event, CARD_STATUS.STARTING);
      return withCard(state, key, { ...card, status: CARD_STATUS.STARTING, confirming: false }, event);
    }

    case "job_active": {
      const rawStatus = event.status || event.progress?.status || "running";
      const status = rawStatus === "queued" ? CARD_STATUS.QUEUED : CARD_STATUS.RUNNING;
      const card = existing || baseCard(key, event, status);
      return withCard(state, key, { ...card, status, progress: event.progress || null }, event);
    }

    case "tool_progress": {
      const card = existing || baseCard(key, event, CARD_STATUS.RUNNING);
      return withCard(state, key, { ...card, status: CARD_STATUS.RUNNING, progress: event.progress || null }, event);
    }

    case "tool_result": {
      if (!existing) return state;
      return withCard(state, key, { ...existing, status: CARD_STATUS.COMPLETED, result: event.result || null, error: null, progress: null }, event);
    }

    case "tool_failed": {
      if (!existing) return state;
      return withCard(state, key, { ...existing, status: CARD_STATUS.FAILED, error: event.error || "Tool execution failed.", progress: null }, event);
    }

    case "tool_cancelled": {
      if (!existing) return state;
      return withCard(state, key, { ...existing, status: CARD_STATUS.CANCELLED, error: event.error || null, progress: null }, event);
    }

    case "tool_timed_out":
    case "execution_timeout": {
      if (!existing) return state;
      return withCard(state, key, { ...existing, status: CARD_STATUS.EXECUTION_TIMED_OUT, error: event.error || "Execution timed out.", progress: null }, event);
    }

    case "observation_timeout":
    case "observation_paused":
    case "monitoring_paused": {
      if (!existing) return state;
      return withCard(state, key, { ...existing, status: CARD_STATUS.OBSERVATION_PAUSED, progress: null }, event);
    }

    case "__patch": {
      const patchKey = event.__key;
      if (!patchKey || !state.cards[patchKey]) return state;
      return {
        ...state,
        cards: {
          ...state.cards,
          [patchKey]: { ...state.cards[patchKey], ...event.__patch },
        },
      };
    }

    default:
      return state;
  }
}

export function useAssistantWorkflow() {
  const [state, dispatch] = useReducer(workflowReducer, INITIAL_WORKFLOW_STATE);

  const applyEvent = useCallback((event) => {
    dispatch({ event });
  }, []);

  const patchCard = useCallback((key, patch) => {
    dispatch({ event: { type: "__patch", __key: key, __patch: patch } });
  }, []);

  return {
    cards: state.cards,
    cardList: Object.values(state.cards),
    applyEvent,
    patchCard,
  };
}
