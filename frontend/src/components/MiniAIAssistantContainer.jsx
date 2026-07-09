/**
 * MiniAIAssistantContainer
 *
 * The Mini AI Assistant — a compact panel surfaced from the GuidanceBubble.
 * Tabs: Chat | Run | History
 *
 * Architecture:
 * - useAssistantChat is called ONCE at the container level
 * - Chat, Run, and History tabs all receive shared state as props
 * - No duplicate hook instances / no state loss on tab switch
 * - Session restore on mount (in container so Run tab sees active_jobs cards)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAssistantChat } from "../hooks/useAssistantChat.js";
import WorkflowCard from "./WorkflowCard.jsx";
import AssistantRunSummary from "./AssistantRunSummary.jsx";
import AssistantRunHistory from "./AssistantRunHistory.jsx";
import ContextualPromptSuggestions from "./ContextualPromptSuggestions.jsx";

const TABS = [
  { id: "chat",    label: "Chat" },
  { id: "run",     label: "Run" },
  { id: "history", label: "History" },
];

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message }) {
  if (!message.content && !message.loading) {
    // Typing indicator
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-sm">
          <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500 text-xs">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0.15s]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0.3s]" />
          </span>
        </div>
      </div>
    );
  }

  const isUser  = message.role === "user";
  const isError = Boolean(message.error);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? "bg-violet-600 text-white"
            : isError
              ? "border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-sm"
              : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-sm"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Suggested action pills ────────────────────────────────────────────────────
function ActionPills({ actions, onExecute, disabled }) {
  if (!actions || actions.length === 0) return null;
  const safeActions = actions.filter((a) => a.safety === "Read-only");
  if (safeActions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-1 pb-2 border-b border-gray-100 dark:border-gray-800">
      {safeActions.map((action, idx) => (
        <button
          key={`${action.action_type}-${idx}`}
          type="button"
          onClick={() => onExecute(action)}
          disabled={disabled}
          className="rounded-full border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-50"
          title={action.description}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

// ── Timeline item ─────────────────────────────────────────────────────────────
function TimelineItem({ item, onConfirm, onNavigate }) {
  if (item.type === "workflow_card") {
    return (
      <div className="flex justify-start">
        <div className="w-full max-w-[96%]">
          <WorkflowCard card={item.card} onConfirm={onConfirm} onNavigate={onNavigate} />
        </div>
      </div>
    );
  }
  return <MessageBubble message={item} />;
}

// ── Chat panel ────────────────────────────────────────────────────────────────
function ChatPanel({
  messages,
  cardList,
  availableActions,
  status,
  onSend,
  onConfirm,
  onExecute,
  onNavigate,
  contextOverrides,
}) {
  const [draft, setDraft] = useState("");
  const scrollerRef = useRef(null);
  const isActive = status === "sending" || status === "streaming";

  // Auto-scroll
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, cardList, status]);

  // Build combined timeline: messages + workflow cards interleaved
  const seenCardKeys = new Set();
  const timelineItems = [];

  for (const msg of messages) {
    timelineItems.push({ ...msg, type: "message" });
  }

  for (const card of cardList) {
    if (seenCardKeys.has(card.key)) continue;
    seenCardKeys.add(card.key);
    timelineItems.push({ id: `card-${card.key}`, type: "workflow_card", card });
  }

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isActive) return;
    setDraft("");
    await onSend(text);
  };

  const handleSelectPrompt = (prompt) => {
    setDraft(prompt);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = timelineItems.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
      {/* Timeline */}
      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
        {isEmpty ? (
          <ContextualPromptSuggestions
            context={contextOverrides}
            onSelectPrompt={handleSelectPrompt}
          />
        ) : (
          timelineItems.map((item) => (
            <TimelineItem
              key={item.id}
              item={item}
              onConfirm={onConfirm}
              onNavigate={onNavigate}
            />
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
        <ActionPills actions={availableActions} onExecute={onExecute} disabled={isActive} />
        <div className="flex items-end gap-2 mt-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type a message…"
            disabled={isActive}
            className="max-h-24 min-h-9 flex-1 resize-none rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-900 dark:text-gray-100 outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900/30 disabled:bg-gray-50 dark:disabled:bg-gray-800/50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || isActive}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-violet-600 px-3 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
          >
            {isActive ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Run panel ─────────────────────────────────────────────────────────────────
function RunPanel({ contextOverrides, cards, onNavigate, onSendMessage }) {
  return (
    <div className="h-full overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
      <AssistantRunSummary
        contextOverrides={contextOverrides}
        cards={cards}
        onNavigate={onNavigate}
        onSendMessage={onSendMessage}
      />
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────
function HistoryPanel({ sessionId, onNavigate, onSendMessage }) {
  return (
    <div className="h-full overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
      <AssistantRunHistory sessionId={sessionId} onNavigate={onNavigate} onAskAI={onSendMessage} />
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export default function MiniAIAssistantContainer({
  contextOverrides = {},
  onNavigate,
  onClose,
  onHeaderPointerDown,
  onNewMessage,
}) {
  const [activeTab, setActiveTab] = useState("chat");
  const [ollamaHealthy, setOllamaHealthy] = useState(null); // null = checking, true = healthy, false = unhealthy

  // ── Single shared hook instance ──────────────────────────────────────────
  // All tabs read from the same hook, ensuring Run tab sees session-restored cards.
  const {
    messages,
    sessionId,
    status,
    cards,
    cardList,
    availableActions,
    sendMessage,
    confirmAction,
    executeAction,
    restoreSession,
  } = useAssistantChat({ contextOverrides, onNewMessage });

  // Session restore on mount — happens at container level so Run tab benefits too
  useEffect(() => {
    const stored = sessionStorage.getItem("mini_assistant_session_id");
    if (stored) restoreSession(stored);
  }, [restoreSession]);

  // Persist session id for next mount
  useEffect(() => {
    if (sessionId) sessionStorage.setItem("mini_assistant_session_id", sessionId);
  }, [sessionId]);

  // Check Ollama health periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/ai/health");
        const data = await response.json();
        setOllamaHealthy(data.reachable === true);
      } catch (error) {
        setOllamaHealthy(false);
      }
    };

    // Check immediately on mount
    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigate = useCallback(
    (tabId) => {
      if (onNavigate) onNavigate(tabId);
    },
    [onNavigate]
  );

  return (
    <section className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div
        className="bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2.5 flex items-center justify-between cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={onHeaderPointerDown}
      >
        <h3 className="text-white font-semibold text-sm select-none">AI Assistant</h3>
        <div className="flex items-center gap-2">
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              ollamaHealthy === null
                ? "bg-yellow-400 animate-pulse"
                : ollamaHealthy
                ? "bg-green-400"
                : "bg-red-500"
            }`}
            title={ollamaHealthy === null ? "Checking Ollama..." : ollamaHealthy ? "Ollama connected" : "Ollama disconnected"}
          />
          {onClose && (
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white rounded-md hover:bg-white/10 p-1 transition-colors ml-1"
              title="Close"
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 dark:bg-gray-900 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white dark:bg-gray-800 text-violet-700 dark:text-violet-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
        {activeTab === "chat" && (
          <div className="h-full min-h-0">
            <ChatPanel
              messages={messages}
              cardList={cardList}
              availableActions={availableActions}
              status={status}
              onSend={sendMessage}
              onConfirm={confirmAction}
              onExecute={executeAction}
              onNavigate={handleNavigate}
              contextOverrides={contextOverrides}
            />
          </div>
        )}

        {activeTab === "run" && (
          <div className="h-full">
            <RunPanel
              contextOverrides={contextOverrides}
              cards={cards}
              onNavigate={handleNavigate}
              onSendMessage={sendMessage}
            />
          </div>
        )}

        {activeTab === "history" && (
          <div className="h-full">
            <HistoryPanel sessionId={sessionId} onNavigate={handleNavigate} onSendMessage={sendMessage} />
          </div>
        )}
      </div>
    </section>
  );
}
