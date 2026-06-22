import { useState, useEffect } from "react";

const NAV_TABS = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "Agents" },
  { id: "tasks", label: "Tasks" },
  { id: "schedule", label: "Schedule" },
  { id: "content", label: "Content" },
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

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet to-cyan opacity-80" />
        <div className="absolute inset-0 rounded-full border-2 border-white/20" />
        <div className="relative w-2 h-2 rounded-full bg-mint pulse-mint" />
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-sm font-medium tracking-wider">4TIE</span>
        <span className="font-mono text-[10px] text-muted bg-white/5 border border-white/10 rounded px-1.5 py-0.5">v1.1</span>
      </div>
    </div>
  );
}

function StatusPill({ online }) {
  return (
    <div className="glass-card px-3 py-1.5 flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${online ? "bg-mint pulse-mint" : "bg-red"}`} />
      <span className="text-xs text-text/80">All systems operational</span>
      <LiveClock />
    </div>
  );
}

export default function TopNav({ activeTab, onChange, backendOnline }) {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 glass-card border-b border-white/10 z-50 px-6 flex items-center justify-between">
      <BrandMark />
      
      <div className="flex items-center gap-1 bg-white/5 rounded-full p-1">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-base-100"
                : "text-text/60 hover:text-text hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <StatusPill online={backendOnline} />
    </nav>
  );
}
