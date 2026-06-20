import { useMemo, useState } from "react";

const views = [
  {
    id: "radar",
    label: "Market Radar",
    thesis: "Discovery and ranking first, optimized for choosing promising pairs quickly.",
  },
  {
    id: "control",
    label: "Backtest Control Room",
    thesis: "Live progress, failures, and diagnostics first, optimized for active monitoring.",
  },
  {
    id: "workbench",
    label: "Portfolio Workbench",
    thesis: "Selected pairs and apply flow first, optimized for strategy configuration.",
  },
];

const setup = [
  ["Strategy", "MeanRevertX"],
  ["Timeframe", "1h"],
  ["Range", "20240101-20240601"],
  ["Wallet", "2500 USDT"],
  ["Max trades", "4"],
  ["Pair groups", "6"],
];

const stages = [
  ["Queued", "done", "Strategy and pair universe accepted"],
  ["Downloading", "done", "Candles available for 22 of 24 pairs"],
  ["Backtesting", "active", "4 groups complete, 1 running"],
  ["Scoring", "waiting", "Waiting for final result rows"],
  ["Apply", "waiting", "Review selected pairs before sync"],
];

const results = [
  { group: "BTC/USDT + ETH/USDT", status: "completed", profit: 8.5, win: 60, drawdown: 5.1, trades: 12, score: 94 },
  { group: "SOL/USDT + AVAX/USDT", status: "completed", profit: 6.2, win: 57, drawdown: 7.4, trades: 18, score: 87 },
  { group: "LINK/USDT + AAVE/USDT", status: "running", profit: 2.4, win: 52, drawdown: 4.8, trades: 9, score: 73 },
  { group: "XRP/USDT + DOGE/USDT", status: "failed", profit: null, win: null, drawdown: null, trades: 0, score: 18 },
  { group: "ADA/USDT + MATIC/USDT", status: "completed", profit: 3.8, win: 55, drawdown: 8.9, trades: 15, score: 76 },
];

const radarPairs = [
  ["BTC/USDT", 96, "+4.2%", "High liquidity", "selected"],
  ["ETH/USDT", 92, "+4.0%", "Stable sample", "selected"],
  ["SOL/USDT", 88, "+3.6%", "Momentum pocket", "watch"],
  ["AVAX/USDT", 81, "+2.7%", "Volatile but tradable", "watch"],
  ["LINK/USDT", 74, "+1.9%", "Needs longer range", "hold"],
  ["DOGE/USDT", 31, "-2.4%", "Failed data check", "blocked"],
];

const history = [
  ["session-8142", "MeanRevertX", "completed", "24 pairs", "12m ago"],
  ["session-8011", "BreakoutLab", "failed", "18 pairs", "1h ago"],
  ["session-7920", "GridScout", "completed", "30 pairs", "yesterday"],
];

function Status({ status }) {
  return <span className={`status ${status}`}>{status}</span>;
}

function SetupStrip() {
  return (
    <section className="panel setup-strip">
      {setup.map(([label, value]) => (
        <div className="setup-cell" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <button className="action" type="button">Run Exploration</button>
    </section>
  );
}

function StageStack({ compact = false }) {
  return (
    <section className="panel">
      <div className="panel-title">Run Lifecycle</div>
      <div className={compact ? "stage-stack compact" : "stage-stack"}>
        {stages.map(([name, state, detail], index) => (
          <div className={`stage ${state}`} key={name}>
            <b>{index + 1}</b>
            <div>
              <strong>{name}</strong>
              <span>{detail}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RadarList() {
  return (
    <section className="panel radar-list">
      <div className="panel-title">Market Radar</div>
      <div className="radar-header">
        <span>Pair</span>
        <span>Score</span>
        <span>Profit</span>
        <span>Signal</span>
      </div>
      {radarPairs.map(([pair, score, profit, note, state]) => (
        <div className={`radar-row ${state}`} key={pair}>
          <strong>{pair}</strong>
          <span>{score}</span>
          <span>{profit}</span>
          <em>{note}</em>
        </div>
      ))}
    </section>
  );
}

function ResultsMatrix() {
  return (
    <section className="panel results">
      <div className="panel-title">Result Rows</div>
      <table>
        <thead>
          <tr>
            <th>Group</th>
            <th>Profit</th>
            <th>Win</th>
            <th>DD</th>
            <th>Trades</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={row.group}>
              <td>{row.group}</td>
              <td>{row.profit == null ? "-" : `+${row.profit.toFixed(1)}%`}</td>
              <td>{row.win == null ? "-" : `${row.win}%`}</td>
              <td>{row.drawdown == null ? "-" : `${row.drawdown.toFixed(1)}%`}</td>
              <td>{row.trades}</td>
              <td><Status status={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Telemetry() {
  return (
    <section className="panel telemetry">
      <div className="panel-title">Telemetry</div>
      <div className="metrics">
        <div><span>Progress</span><strong>67%</strong></div>
        <div><span>Completed groups</span><strong>4 / 6</strong></div>
        <div><span>Best group</span><strong>+8.5%</strong></div>
        <div><span>Failures</span><strong>1</strong></div>
      </div>
      <div className="bars" aria-label="Mock backtest progress">
        {Array.from({ length: 30 }).map((_, index) => (
          <i key={index} style={{ height: `${24 + ((index * 19) % 68)}%` }} />
        ))}
      </div>
    </section>
  );
}

function HistoryPanel() {
  return (
    <section className="panel history">
      <div className="panel-title">Past Runs</div>
      {history.map(([id, strategy, status, count, age]) => (
        <div className="history-row" key={id}>
          <div>
            <strong>{strategy}</strong>
            <span>{id}</span>
          </div>
          <Status status={status} />
          <span>{count}</span>
          <span>{age}</span>
        </div>
      ))}
    </section>
  );
}

function Diagnostics() {
  return (
    <section className="panel diagnostics">
      <div className="panel-title">Diagnostics</div>
      <div className="diag-row warn">
        <strong>XRP/USDT + DOGE/USDT</strong>
        <span>Skipped because the downloaded range had missing candles.</span>
      </div>
      <div className="diag-row">
        <strong>Shared state</strong>
        <span>Apply selected pairs only. Strategy, dates, wallet, and threshold semantics stay unchanged.</span>
      </div>
    </section>
  );
}

function PortfolioBasket() {
  const selected = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "AVAX/USDT"];
  return (
    <section className="panel basket">
      <div className="panel-title">Selected Pairs</div>
      <div className="pair-grid">
        {selected.map((pair) => <span key={pair}>{pair}</span>)}
      </div>
      <div className="apply-preview">
        <strong>Apply preview</strong>
        <p>Only the shared pair list changes. The active strategy keeps its existing timeframe, wallet, and validation rules.</p>
      </div>
      <button className="action" type="button">Apply 4 Pairs</button>
    </section>
  );
}

function View({ active }) {
  if (active === "radar") {
    return (
      <div className="layout radar-layout">
        <SetupStrip />
        <RadarList />
        <StageStack />
        <HistoryPanel />
      </div>
    );
  }
  if (active === "control") {
    return (
      <div className="layout control-layout">
        <Telemetry />
        <StageStack compact />
        <Diagnostics />
        <ResultsMatrix />
      </div>
    );
  }
  return (
    <div className="layout workbench-layout">
      <PortfolioBasket />
      <ResultsMatrix />
      <HistoryPanel />
      <Diagnostics />
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("radar");
  const selectedView = useMemo(
    () => views.find((view) => view.id === active) || views[0],
    [active]
  );

  return (
    <main className={`shell ${active}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">PairExplorerTab design exploration</p>
          <h1>{selectedView.label}</h1>
          <p>{selectedView.thesis}</p>
        </div>
        <nav aria-label="Exploration views">
          {views.map((view) => (
            <button
              className={view.id === active ? "active" : ""}
              key={view.id}
              onClick={() => setActive(view.id)}
              type="button"
            >
              {view.label}
            </button>
          ))}
        </nav>
      </header>
      <View active={active} />
    </main>
  );
}
