function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`group flex items-center gap-3 px-3 py-2.5 w-full text-left transition-colors rounded-lg ${
        active
          ? "bg-primary/12 text-primary font-medium"
          : "text-base-content/50 hover:bg-base-200 hover:text-base-content"
      }`}
    >
      <span className="text-base leading-none shrink-0">{icon}</span>
      <span className="text-xs truncate">{label}</span>
      {badge != null && (
        <span className="ml-auto badge badge-xs badge-primary shrink-0">{badge}</span>
      )}
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] font-semibold text-base-content/25 uppercase tracking-wider px-3 pt-4 pb-1.5">
      {children}
    </div>
  );
}

export default function NavPanel({ activeItem, onChange, resultsCount }) {
  return (
    <aside className="w-52 shrink-0 bg-base-200 border-r border-base-300 flex flex-col overflow-y-auto">
      <nav className="flex-1 px-2 py-3 flex flex-col">
        <SectionLabel>Tools</SectionLabel>
        <NavItem icon="🧪" label="Backtest"        active={activeItem === "backtest"}        onClick={() => onChange("backtest")} />
        <NavItem icon="📊" label="Results"         active={activeItem === "results"}         onClick={() => onChange("results")} badge={resultsCount} />
        <NavItem icon="🔥" label="Stress Test Lab" active={activeItem === "stress-test"}     onClick={() => onChange("stress-test")} />
        <NavItem icon="🎯" label="Optimizer"       active={activeItem === "optimizer"}       onClick={() => onChange("optimizer")} />
        <NavItem icon="🔭" label="Pair Explorer"  active={activeItem === "pair-explorer"}   onClick={() => onChange("pair-explorer")} />
        <NavItem icon="🏭" label="Auto-Quant Factory" active={activeItem === "auto-quant"} onClick={() => onChange("auto-quant")} />

        <SectionLabel>Strategy</SectionLabel>
        <NavItem icon="📝" label="Strategy Editor" active={activeItem === "strategy-editor"} onClick={() => onChange("strategy-editor")} />

        <SectionLabel>Analytics</SectionLabel>
        <NavItem icon="📈" label="Performance"     active={activeItem === "performance"}     onClick={() => onChange("performance")} />
        <NavItem icon="⚙️" label="Settings"        active={activeItem === "settings"}        onClick={() => onChange("settings")} />
      </nav>

      <div className="px-3 py-2.5 border-t border-base-300 text-[10px] text-base-content/25 text-center shrink-0">
        Strategy Lab v0.1
      </div>
    </aside>
  );
}
