import { useEffect, useRef, useState } from "react";
import { useAssistantChat } from "../hooks/useAssistantChat.js";
import WorkflowCard from "./WorkflowCard.jsx";

const TABS = [
  { id: "chat", label: "Chat", placeholder: "Chat will appear here." },
  { id: "run", label: "Run", placeholder: "No active run." },
  { id: "history", label: "History", placeholder: "No run history yet." },
];

const TEMP_WORKFLOW_CARD = {
  id: "temp-run-backtest-card",
  type: "workflow_card",
  title: "Run Backtest",
  description: "Test the selected strategy using the current page context.",
  status: "proposed",
  toolName: "run_backtest",
  arguments: {
    strategy_name: "DemoStrategy",
    timeframe: "5m",
    timerange: "20240101-20241231",
  },
};

function MessageBubble({ message }) {
  return (
    <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${
          message.role === "user"
            ? "bg-violet-600 text-white"
            : message.error
              ? "border border-red-200 bg-red-50 text-red-700 shadow-sm"
              : "border border-gray-200 bg-white text-gray-700 shadow-sm"
        }`}
      >
        {message.content || (
          <span className="inline-flex items-center gap-1 text-gray-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            Thinking
          </span>
        )}
      </div>
    </div>
  );
}

function TimelineItem({ item }) {
  if (item.type === "workflow_card") {
    return (
      <div className="flex justify-start">
        <div className="w-full max-w-[92%]">
          <WorkflowCard
            title={item.title}
            description={item.description}
            status={item.status}
            toolName={item.toolName}
            arguments={item.arguments}
          />
        </div>
      </div>
    );
  }

  return <MessageBubble message={item} />;
}

function ChatPanel({ contextOverrides = {} }) {
  const [draft, setDraft] = useState("");
  const { messages, status, sendMessage } = useAssistantChat({ contextOverrides });
  const scrollerRef = useRef(null);
  const isActive = status === "sending" || status === "streaming";
  const timelineItems = [
    ...messages.map((message) => ({ ...message, type: "message" })),
    TEMP_WORKFLOW_CARD,
  ];

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, status]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isActive) return;
    setDraft("");
    await sendMessage(text);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-200 bg-gray-50">
      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {timelineItems.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-gray-500">
            Chat will appear here.
          </div>
        ) : (
          timelineItems.map((item) => <TimelineItem key={item.id} item={item} />)
        )}
      </div>

      <div className="border-t border-gray-200 bg-white p-2">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type a message..."
            disabled={isActive}
            className="max-h-24 min-h-9 flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || isActive}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-violet-600 px-3 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isActive ? "Sending" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MiniAIAssistantContainer({ contextOverrides = {} }) {
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <section className="h-full flex flex-col bg-white">
      <div className="bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3">
        <h3 className="text-white font-semibold text-sm">AI Assistant</h3>
      </div>

      <div className="px-3 pt-3">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[260px] flex-1 overflow-hidden p-3">
        {TABS.map((tab) => (
          <div
            key={tab.id}
            className={
              activeTab === tab.id
                ? tab.id === "chat"
                  ? "h-full min-h-0"
                  : "h-full rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500"
                : "hidden"
            }
            aria-label={`${tab.label} placeholder`}
          >
            {tab.id === "chat" ? <ChatPanel contextOverrides={contextOverrides} /> : tab.placeholder}
          </div>
        ))}
      </div>
    </section>
  );
}
