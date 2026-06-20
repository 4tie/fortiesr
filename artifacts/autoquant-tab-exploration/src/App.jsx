import { useMemo, useState } from "react";

const stages = [
  { name: "Sanity Backtest", status: "passed", detail: "+4.8% IS profit" },
  { name: "Hyperopt Execution", status: "running", detail: "Epoch 68 / 100" },
  { name: "Auto-Patching", status: "pending", detail: "Waiting for candidate" },
  { name: "Out-of-Sample Validation", status: "pending", detail: "Strict holdout" },
  { name: "Multi-Pair Stress Test", status: "pending", detail: "Top 50 universe" },
  { name: "Risk Assessment", status: "pending", detail: "MC p95 DD gate" },
  { name: "Delivery", status: "pending", detail: "Export package" },
];

const runs = [
  { id: "b2200462", strategy: "AIStrategy", status: "running", oos: null, dd: null },
  { id: "68fb1bbd", strategy: "OmniFactory", status: "completed", oos: "+2.9%", dd: "11.4%" },
  { id: "41dd901a", strategy: "MomentumFactory", status: "failed", oos: "-1.8%", dd: "31.2%" },
];

const telemetry = [
  { label: "Best candidate", value: "+18.42 USDT" },
  { label: "Objective", value: "-0.1842" },
  { label: "Trades", value: "124" },
  { label: "ETA", value: "14m" },
];

const hypotheses = [
  {
    id: "factory",
    label: "Factory Line",
    thesis: "Stage-first workflow for confidence before launch.",
  },
  {
    id: "mission",
    label: "Mission Control",
    thesis: "Dense telemetry for active run monitoring.",
  },
  {
    id: "notebook",
    label: "Research Notebook",
    thesis: "Explanation-forward review for learning from runs.",
  },
];

function StageRail({ compact = false }) {
  return (
    <section className="panel">
      <div className="panel-title">Pipeline Stages</div>
      <div className={compact ? "stage-grid compact" : "stage-grid"}>
        {stages.map((stage, index) => (
          <div className={`stage ${stage.status}`} key={stage.name}>
            <div className="stage-index">{index + 1}</div>
            <div>
              <strong>{stage.name}</strong>
              <span>{stage.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RunList() {
  return (
    <section className="panel">
      <div className="panel-title">Run History</div>
      <div className="run-list">
        {runs.map((run) => (
          <div className="run-row" key={run.id}>
            <div>
              <strong>{run.strategy}</strong>
              <span>{run.id}</span>
            </div>
            <span className={`pill ${run.status}`}>{run.status}</span>
            <span>{run.oos || "live"}</span>
            <span>{run.dd || "pending"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConfigPanel() {
  return (
    <section className="panel">
      <div className="panel-title">Launch Configuration</div>
      <div className="config-grid">
        {["AIStrategy", "Swing", "Balanced", "Standard", "Binance", "Top 50 USDT"].map((item) => (
          <div className="config-cell" key={item}>{item}</div>
        ))}
      </div>
      <button className="primary-action" type="button">Start Auto-Quant</button>
    </section>
  );
}

function TelemetryPanel() {
  return (
    <section className="panel telemetry">
      <div className="panel-title">Live Telemetry</div>
      <div className="telemetry-grid">
        {telemetry.map((item) => (
          <div className="metric" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="curve" aria-label="Mock fitness curve">
        {Array.from({ length: 28 }).map((_, index) => (
          <i key={index} style={{ height: `${28 + ((index * 17) % 62)}%` }} />
        ))}
      </div>
    </section>
  );
}

function NotesPanel() {
  return (
    <section className="panel notes">
      <div className="panel-title">Research Notes</div>
      <p>
        Current candidate is improving in-sample profit, but OOS validation and
        Monte Carlo remain the decision gates. The interface should teach the
        user why a strategy is promoted or rejected without implying profit.
      </p>
      <div className="note-stack">
        <span>Hold fixed: backend metrics are source of truth.</span>
        <span>Watch: drawdown compression across pair universe.</span>
        <span>Next decision: allow the run to finish risk assessment.</span>
      </div>
    </section>
  );
}

export default function App() {
  const [active, setActive] = useState("factory");
  const selected = useMemo(
    () => hypotheses.find((item) => item.id === active) || hypotheses[0],
    [active]
  );

  return (
    <main className={`shell ${active}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">AutoQuantTab design exploration</p>
          <h1>{selected.label}</h1>
          <p>{selected.thesis}</p>
        </div>
        <nav>
          {hypotheses.map((item) => (
            <button
              className={item.id === active ? "active" : ""}
              key={item.id}
              onClick={() => setActive(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {active === "factory" && (
        <div className="layout factory-layout">
          <ConfigPanel />
          <StageRail />
          <RunList />
        </div>
      )}

      {active === "mission" && (
        <div className="layout mission-layout">
          <TelemetryPanel />
          <StageRail compact />
          <RunList />
        </div>
      )}

      {active === "notebook" && (
        <div className="layout notebook-layout">
          <NotesPanel />
          <StageRail />
          <TelemetryPanel />
        </div>
      )}
    </main>
  );
}
