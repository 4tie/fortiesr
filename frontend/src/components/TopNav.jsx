import { useState, useEffect } from "react";

const NAV_TABS = [
  { id: "auto-quant", label: "AutoQuant" },
  { id: "optimizer", label: "Optimizer" },
  { id: "backtest", label: "Backtest" },
  { id: "results", label: "Results" },
  { id: "pair-explorer", label: "Pair Explorer" },
  { id: "settings", label: "Settings" },
  { id: "strategy-lab", label: "Strategy Lab" },
  { id: "quant", label: "Quant" },
  { id: "performance", label: "Performance" },
  { id: "ai-assistant", label: "AI Assistant" },
  { id: "strategy-editor", label: "Strategy Editor" },
  { id: "stress-test", label: "Stress Test" },
];

function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span className="font-mono text-xs">{time}</span>;
}

function BrandMark({ backendOnline, isWorkRunning }) {
  const getDotClass = () => {
    if (!backendOnline) return "bg-red pulse-red";
    if (isWorkRunning) return "bg-mint pulse-mint";
    return "bg-mint";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet to-cyan opacity-80" />
        <div className="absolute inset-0 rounded-full border-2 border-white/20" />
        <div className={`relative w-2 h-2 rounded-full ${getDotClass()}`} />
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-sm font-medium tracking-wider">4TIE</span>
        <span className="font-mono text-[10px] text-muted bg-white/5 border border-white/10 rounded px-1.5 py-0.5">v1.1</span>
      </div>
    </div>
  );
}

function StatusPill() {
  return (
    <div className="glass-card px-3 py-1.5 flex items-center gap-2">
      <LiveClock />
    </div>
  );
}

export default function TopNav({ activeTab, onChange, backendOnline, isWorkRunning }) {
  const activeTabLabel = NAV_TABS.find(tab => tab.id === activeTab)?.label || activeTab;

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 glass-card border-b border-white/10 z-50 px-6 flex items-center justify-between">
      <BrandMark backendOnline={backendOnline} isWorkRunning={isWorkRunning} />

      <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 overflow-x-auto max-w-[70vw] scrollbar-hide">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white text-base-100 shadow-lg shadow-white/10"
                : "text-text/60 hover:text-text hover:bg-white/5"
            }`}
            title={tab.label}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex text-xs font-mono text-muted">
          {activeTabLabel}
        </div>
        <StatusPill />
      </div>
    </nav>
  );
}
