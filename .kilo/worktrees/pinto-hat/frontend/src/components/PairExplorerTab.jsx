import React, { useState, useEffect, useRef, useCallback } from "react";
import SmartPairSelector from "./SmartPairSelector.jsx";

const POLL_MS = 1500;
const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d"];
const TERMINAL = new Set(["completed", "failed"]);

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toTimerange(s, e) {
  return `${s.replace(/-/g, "")}-${e.replace(/-/g, "")}`;
}
function datePreset(days) {
  const end = new Date(), start = new Date();
  start.setDate(start.getDate() - days);
  return { start: fmtDate(start), end: fmtDate(end) };
}

function fmt(v, decimals = 2, suffix = "") {
  if (v == null) return "—";
  const n = Number(v);
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}${suffix}`;
}
function fmtPct(v) { return fmt(v, 2, "%"); }
function fmtRaw(v) { return v == null ? "—" : Number(v).toFixed(4); }
function fmtWin(v) { return v == null ? "—" : `${Number(v).toFixed(1)}%`; }

function fmtRelTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SORT_KEYS = {
  group:            (r) => r.group ?? r.pair ?? "",
  total_profit_pct: (r) => r.total_profit_pct ?? -Infinity,
  win_rate:         (r) => r.win_rate ?? -Infinity,
  sharpe_ratio:     (r) => r.sharpe_ratio ?? -Infinity,
  max_drawdown:     (r) => r.max_drawdown ?? -Infinity,
  total_trades:     (r) => r.total_trades ?? -Infinity,
  status:           (r) => r.status,
};

function SortIcon({ col, sortCol, sortDir }) {
  if (col !== sortCol) return <span className="ml-1 opacity-20">↕</span>;
  return <span className="ml-1 opacity-70">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function StatusBadge({ status }) {
  const cls = {
    completed:   "bg-success/15 text-success border-success/30",
    running:     "bg-primary/15 text-primary border-primary/30",
    downloading: "bg-info/15 text-info border-info/30",
    failed:      "bg-error/15 text-error border-error/30",
    pending:     "bg-base-300/40 text-base-content/30 border-base-300/50",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${cls[status] || cls.pending}`}>
      {status === "downloading" && <span className="loading loading-spinner loading-[6px]" />}
      {status === "running" && <span className="loading loading-spinner loading-[6px]" />}
      {status}
    </span>
  );
}

export default function PairExplorerTab({
  strategies = [],
  strategiesLoading = false,
  sharedState = null,
  sharedLoading = false,
  syncSharedState = null,
}) {
  const initEnd   = fmtDate(new Date());
  const initStart = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return fmtDate(d); })();

  const [strategyName, setStrategyName] = useState("");
  const [timeframe,    setTimeframe]    = useState("1h");
  const [dateStart,    setDateStart]    = useState(initStart);
  const [dateEnd,      setDateEnd]      = useState(initEnd);
  const [pairs,        setPairs]        = useState([]);
  const [wallet,       setWallet]       = useState("1000");
  const [maxTrades,    setMaxTrades]    = useState("1");

  const [sessionId,    setSessionId]    = useState(null);
  const [session,      setSession]      = useState(null);
  const [isRunning,    setIsRunning]    = useState(false);
  const [submitError,  setSubmitError]  = useState(null);

  const [sortCol,  setSortCol]  = useState("total_profit_pct");
  const [sortDir,  setSortDir]  = useState("desc");
  const [addedMap, setAddedMap] = useState({});
  const [addingMap, setAddingMap] = useState({});
  const [toasts,   setToasts]   = useState([]);

  // History panel
  const [pastSessions,      setPastSessions]      = useState([]);
  const [historyLoading,    setHistoryLoading]    = useState(false);
  const [historyOpen,       setHistoryOpen]       = useState(false);
  const [expandedError,     setExpandedError]     = useState(null);

  const pollRef  = useRef(null);
  const hydrated = useRef(false);

  // ── load past sessions ────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const r = await fetch("/api/strategy/pair-explorer");
      if (r.ok) {
        const data = await r.json();
        setPastSessions(data.sessions || []);
      }
    } catch (_) {}
    setHistoryLoading(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── hydrate from shared state ─────────────────────────────────────────────
  useEffect(() => {
    if (sharedLoading || !sharedState || hydrated.current) return;
    hydrated.current = true;
    if (sharedState.strategy_name)           setStrategyName(sharedState.strategy_name);
    if (sharedState.timeframe)               setTimeframe(sharedState.timeframe);
    if (sharedState.dry_run_wallet  != null) setWallet(String(sharedState.dry_run_wallet));
    if (sharedState.max_open_trades != null) setMaxTrades(String(sharedState.max_open_trades));
    const s = sharedState.start_date || "";
    const e = sharedState.end_date   || "";
    if (s && e) { setDateStart(s); setDateEnd(e); }
    else if (sharedState.timerange) {
      const [rawS, rawE] = sharedState.timerange.split("-");
      const fmt = raw => raw?.length === 8
        ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`
        : "";
      const fs = fmt(rawS), fe = fmt(rawE);
      if (fs) setDateStart(fs);
      if (fe) setDateEnd(fe);
    }
  }, [sharedState, sharedLoading]);

  // ── sync form changes back to shared state ────────────────────────────────
  useEffect(() => {
    if (!hydrated.current || !syncSharedState) return;
    const walletNum = parseFloat(wallet);
    const tradesNum = parseInt(maxTrades, 10);
    const patch = {};
    if (strategyName)                           patch.strategy_name   = strategyName;
    if (timeframe)                              patch.timeframe       = timeframe;
    if (dateStart)                              patch.start_date      = dateStart;
    if (dateEnd)                                patch.end_date        = dateEnd;
    if (dateStart && dateEnd)                   patch.timerange       = toTimerange(dateStart, dateEnd);
    if (pairs.length)                           patch.pairs           = pairs;
    if (!isNaN(walletNum) && walletNum > 0)     patch.dry_run_wallet  = walletNum;
    if (!isNaN(tradesNum) && tradesNum > 0)     patch.max_open_trades = tradesNum;
    if (Object.keys(patch).length) syncSharedState(patch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyName, timeframe, dateStart, dateEnd, pairs, wallet, maxTrades]);

  // ── pair change handler ───────────────────────────────────────────────────
  const handlePairsChange = useCallback((newPairs) => {
    setPairs(newPairs);
  }, []);

  // ── polling ───────────────────────────────────────────────────────────────
  const startPolling = useCallback((sid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/strategy/pair-explorer/${sid}`);
        if (!r.ok) return;
        const data = await r.json();
        setSession(data);
        if (TERMINAL.has(data.status)) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setIsRunning(false);
          loadHistory();
        }
      } catch (_) {}
    }, POLL_MS);
  }, [loadHistory]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // ── toast ─────────────────────────────────────────────────────────────────
  const addToast = (message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // ── run ───────────────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!strategyName) return;
    setSubmitError(null);
    setSession(null);
    setAddedMap({});
    setIsRunning(true);

    const timerange = toTimerange(dateStart, dateEnd);
    const walletNum = parseFloat(wallet) || 1000;
    const trNum = parseInt(maxTrades, 10) || 1;
    try {
      const res = await fetch("/api/strategy/pair-explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy_name: strategyName,
          pairs,
          timeframe,
          timerange,
          dry_run_wallet: walletNum,
          max_open_trades: trNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.detail || "Failed to start exploration.");
        setIsRunning(false);
        return;
      }
      setSessionId(data.session_id);
      startPolling(data.session_id);
      if (syncSharedState) {
        syncSharedState({ strategy_name: strategyName, timeframe, start_date: dateStart, end_date: dateEnd, pairs });
      }
    } catch (err) {
      setSubmitError(String(err));
      setIsRunning(false);
    }
  };

  // ── load a past session ───────────────────────────────────────────────────
  const handleLoadSession = async (sid) => {
    try {
      const r = await fetch(`/api/strategy/pair-explorer/${sid}`);
      if (!r.ok) return;
      const data = await r.json();
      setSession(data);
      setSessionId(sid);
      setIsRunning(false);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      setAddedMap({});
      setExpandedError(null);
    } catch (_) {}
  };

  // ── add pair to trading pairs (shared state + config whitelist) ────────────
  const handleAddPair = async (pair) => {
    setAddingMap(prev => ({ ...prev, [pair]: true }));
    try {
      const res = await fetch("/api/strategy/add-pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy_name: strategyName, pair }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddedMap(prev => ({ ...prev, [pair]: true }));

        // Sync to shared state so Backtest (and all other tabs) pick it up immediately
        if (syncSharedState) {
          const currentPairs = sharedState?.pairs || [];
          if (!currentPairs.includes(pair)) {
            syncSharedState({ pairs: [...currentPairs, pair] });
          }
        }

        addToast(
          data.already_present
            ? `${pair} is already in your trading pairs`
            : `${pair} added to trading pairs!`,
        );
      } else {
        addToast(data.detail || "Failed to add pair.", "error");
      }
    } catch {
      addToast("Network error.", "error");
    } finally {
      setAddingMap(prev => ({ ...prev, [pair]: false }));
    }
  };

  // ── sort ───────────────────────────────────────────────────────────────────
  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const totalPairs     = session?.total   || 0;
  const completedPairs = session?.completed || 0;
  const progressPct    = totalPairs > 0 ? Math.min(100, (completedPairs / totalPairs) * 100) : 0;

  const rawResults = session?.results || [];
  const sortedResults = [...rawResults].sort((a, b) => {
    const fn = SORT_KEYS[sortCol] || SORT_KEYS.pair;
    const av = fn(a), bv = fn(b);
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const tradesNum  = parseInt(maxTrades, 10) || 1;
  const numGroups  = pairs.length > 0 ? Math.ceil(pairs.length / tradesNum) : 0;
  const canRun = !!strategyName && !!dateStart && !!dateEnd && pairs.length > 0 && !isRunning;

  const TH = ({ col, children }) => (
    <th
      className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-base-content/40 cursor-pointer select-none hover:text-base-content/70 transition-colors whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      {children}
      <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  );

  // Stats for the current session header
  const failedCount    = sortedResults.filter(r => r.status === "failed").length;
  const completedCount = sortedResults.filter(r => r.status === "completed").length;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-base-300 bg-base-200">
        <span className="text-sm font-bold tracking-tight">🔭 Pair Explorer</span>

        {isRunning && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-primary/30 text-primary bg-primary/10">
            Running
          </span>
        )}
        {session?.status === "completed" && !isRunning && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-success/30 text-success bg-success/10">
            Done
          </span>
        )}

        {session && (
          <span className="text-xs text-base-content/40 font-mono">
            {completedPairs} / {totalPairs} run{totalPairs !== 1 ? "s" : ""}
            {failedCount > 0 && (
              <span className="ml-2 text-error/60">· {failedCount} failed</span>
            )}
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={handleRun}
          disabled={!canRun}
          className="btn btn-primary btn-sm px-5 gap-2"
        >
          {isRunning ? (
            <span className="loading loading-spinner loading-xs" />
          ) : "🔭"}
          {isRunning ? "Running…" : "Run Exploration"}
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── sidebar form ─────────────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-r border-base-300 bg-base-200/40 flex flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 p-4">

            {/* Strategy */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
                Strategy
              </label>
              {strategiesLoading ? (
                <div className="skeleton h-8 rounded" />
              ) : (
                <select
                  className="select select-sm select-bordered w-full font-mono text-xs"
                  value={strategyName}
                  onChange={e => setStrategyName(e.target.value)}
                  disabled={isRunning}
                >
                  <option value="">— pick a strategy —</option>
                  {strategies.map(s => (
                    <option key={s.strategy_name} value={s.strategy_name}>
                      {s.strategy_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Timeframe */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
                Timeframe
              </label>
              <select
                className="select select-sm select-bordered w-full font-mono text-xs"
                value={timeframe}
                onChange={e => setTimeframe(e.target.value)}
                disabled={isRunning}
              >
                {TIMEFRAMES.map(tf => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
                Date Range
              </label>
              <div className="flex gap-2">
                {[
                  { label: "6M", days: 180 },
                  { label: "1Y", days: 365 },
                  { label: "2Y", days: 730 },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    className="btn btn-xs btn-ghost border border-base-300 flex-1"
                    disabled={isRunning}
                    onClick={() => {
                      const { start, end } = datePreset(days);
                      setDateStart(start);
                      setDateEnd(end);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                className="input input-sm input-bordered w-full font-mono text-xs"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
                disabled={isRunning}
              />
              <input
                type="date"
                className="input input-sm input-bordered w-full font-mono text-xs"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
                disabled={isRunning}
              />
            </div>

            {/* Wallet & Max Open Trades */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
                  Wallet
                </label>
                <input
                  type="number"
                  min="1"
                  step="100"
                  className="input input-sm input-bordered w-full font-mono text-xs"
                  value={wallet}
                  onChange={e => setWallet(e.target.value)}
                  disabled={isRunning}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
                  Max Trades
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input input-sm input-bordered w-full font-mono text-xs"
                  value={maxTrades}
                  onChange={e => setMaxTrades(e.target.value)}
                  disabled={isRunning}
                />
              </div>
            </div>

            {/* Trading Pairs */}
            <div className="relative">
              <SmartPairSelector
                onChange={handlePairsChange}
                disabled={isRunning}
              />
              <p className="text-[10px] text-base-content/35 mt-1.5 leading-snug">
                {pairs.length === 0
                  ? <span className="text-warning/70">Select at least one pair to run.</span>
                  : tradesNum === 1
                    ? `${pairs.length} solo run${pairs.length !== 1 ? "s" : ""}`
                    : `${pairs.length} pairs → ${numGroups} group${numGroups !== 1 ? "s" : ""} of ${tradesNum}`}
              </p>
            </div>

            {submitError && (
              <div className="alert alert-error text-xs p-2">
                <span>{submitError}</span>
              </div>
            )}
          </div>

          {/* ── Past Runs history ─────────────────────────────────────────── */}
          <div className="border-t border-base-300 mt-auto">
            <button
              className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-base-content/40 hover:text-base-content/70 hover:bg-base-200 transition-colors"
              onClick={() => { setHistoryOpen(o => !o); if (!historyOpen) loadHistory(); }}
            >
              <span>Past Runs {pastSessions.length > 0 ? `(${pastSessions.length})` : ""}</span>
              <span>{historyOpen ? "▲" : "▼"}</span>
            </button>

            {historyOpen && (
              <div className="max-h-64 overflow-y-auto divide-y divide-base-300/60">
                {historyLoading ? (
                  <div className="px-4 py-3 text-xs text-base-content/30">Loading…</div>
                ) : pastSessions.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-base-content/30">No past runs yet.</div>
                ) : (
                  pastSessions.map(s => (
                    <button
                      key={s.session_id}
                      className={`w-full text-left px-4 py-2.5 hover:bg-base-200 transition-colors ${s.session_id === sessionId ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                      onClick={() => handleLoadSession(s.session_id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-semibold truncate">{s.strategy_name || "—"}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-base-content/35 font-mono">{s.timeframe}</span>
                        <span className="text-[10px] text-base-content/25">·</span>
                        <span className="text-[10px] text-base-content/35">{s.total} pairs</span>
                        <span className="text-[10px] text-base-content/25">·</span>
                        <span className="text-[10px] text-base-content/35">{fmtRelTime(s.created_at)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── main results area ─────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto flex flex-col">

          {/* session meta banner when viewing a past run */}
          {session && !isRunning && sessionId && (
            <div className="shrink-0 px-4 pt-3 pb-1 flex items-center gap-3 flex-wrap">
              {session.strategy_name && (
                <span className="text-[10px] font-mono font-semibold bg-base-200 px-2 py-0.5 rounded border border-base-300">
                  {session.strategy_name}
                </span>
              )}
              {session.timeframe && (
                <span className="text-[10px] text-base-content/40 font-mono">{session.timeframe}</span>
              )}
              {session.timerange && (
                <span className="text-[10px] text-base-content/40 font-mono">{session.timerange}</span>
              )}
              {completedCount > 0 && (
                <span className="text-[10px] text-success/70">{completedCount} ok</span>
              )}
              {failedCount > 0 && (
                <span className="text-[10px] text-error/70">{failedCount} failed</span>
              )}
            </div>
          )}

          {/* progress bar */}
          {session && isRunning && (
            <div className="shrink-0 px-4 pt-3 pb-2">
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-xs text-base-content/50 font-mono">
                  {completedPairs} / {totalPairs} pairs complete
                </span>
                <span className="text-xs text-base-content/30">
                  {Math.round(progressPct)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-base-300 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* empty / waiting state */}
          {!session && !isRunning && (
            <div className="flex-1 flex items-center justify-center text-base-content/25 text-sm flex-col gap-2">
              <span className="text-3xl">🔭</span>
              <span>Configure pairs on the left and click Run Exploration</span>
              {pastSessions.length > 0 && (
                <span className="text-[11px] text-base-content/20">or open Past Runs to reload a previous result</span>
              )}
            </div>
          )}

          {isRunning && !session && (
            <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm gap-3">
              <span className="loading loading-spinner loading-sm" />
              <span>Starting exploration…</span>
            </div>
          )}

          {/* results table */}
          {session && sortedResults.length > 0 && (
            <div className="flex-1 overflow-auto px-4 pb-4">
              <table className="table table-xs w-full">
                <thead className="sticky top-0 bg-base-100 z-10 border-b border-base-300">
                  <tr>
                    <TH col="group">Pairs / Group</TH>
                    <TH col="total_profit_pct">Profit %</TH>
                    <TH col="win_rate">Win Rate</TH>
                    <TH col="sharpe_ratio">Sharpe</TH>
                    <TH col="max_drawdown">Max DD</TH>
                    <TH col="total_trades">Trades</TH>
                    <TH col="status">Status</TH>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
                      Action / Error
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((row) => {
                    const rowKey  = row.group ?? row.pair ?? JSON.stringify(row.pairs);
                    const rowPairs = row.pairs ?? (row.pair ? [row.pair] : []);
                    const isExpanded = expandedError === rowKey;
                    return (
                    <React.Fragment key={rowKey}>
                      <tr className={`hover:bg-base-200/50 transition-colors ${row.status === "failed" && isExpanded ? "bg-error/5" : ""}`}>
                        {/* Pair / group label */}
                        <td className="px-3 py-2 font-mono text-xs font-semibold max-w-[180px]">
                          {rowPairs.length > 1 ? (
                            <div className="flex flex-col gap-0.5">
                              {rowPairs.map(p => (
                                <span key={p} className="truncate">{p}</span>
                              ))}
                            </div>
                          ) : rowPairs[0] ?? rowKey}
                        </td>
                        <td className={`px-3 py-2 font-mono text-xs ${
                          row.total_profit_pct == null ? "text-base-content/30"
                          : row.total_profit_pct >= 0 ? "text-success" : "text-error"
                        }`}>
                          {fmtPct(row.total_profit_pct)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-base-content/70">
                          {fmtWin(row.win_rate)}
                        </td>
                        <td className={`px-3 py-2 font-mono text-xs ${
                          row.sharpe_ratio == null ? "text-base-content/30"
                          : row.sharpe_ratio >= 0 ? "text-base-content/80" : "text-error/80"
                        }`}>
                          {fmtRaw(row.sharpe_ratio)}
                        </td>
                        <td className={`px-3 py-2 font-mono text-xs ${
                          row.max_drawdown == null ? "text-base-content/30" : "text-warning"
                        }`}>
                          {row.max_drawdown == null ? "—" : `${Math.abs(Number(row.max_drawdown)).toFixed(2)}%`}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-base-content/60">
                          {row.total_trades ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2">
                          {row.status === "completed" ? (
                            <div className="flex flex-wrap gap-1">
                              {rowPairs.map(p => (
                                <button
                                  key={p}
                                  className="btn btn-xs btn-ghost border border-base-300 px-2 gap-1 text-[10px]"
                                  disabled={!!addedMap[p] || !!addingMap[p]}
                                  onClick={() => handleAddPair(p)}
                                  title={`Add ${p} to config`}
                                >
                                  {addingMap[p] ? (
                                    <span className="loading loading-spinner loading-xs" />
                                  ) : addedMap[p] ? `✓ ${p}` : `+ ${p}`}
                                </button>
                              ))}
                            </div>
                          ) : row.status === "failed" ? (
                            <button
                              className="text-[10px] text-error/60 hover:text-error/90 truncate max-w-[160px] block text-left transition-colors"
                              title="Click to expand error"
                              onClick={() => setExpandedError(prev => prev === rowKey ? null : rowKey)}
                            >
                              {row.error || "failed"} {row.error ? "▾" : ""}
                            </button>
                          ) : (
                            <span className="loading loading-dots loading-xs opacity-30" />
                          )}
                        </td>
                      </tr>
                      {/* expanded error row */}
                      {row.status === "failed" && isExpanded && (
                        <tr className="bg-error/5">
                          <td colSpan={8} className="px-4 py-2">
                            <div className="text-[11px] font-mono text-error/80 break-all whitespace-pre-wrap bg-error/5 rounded p-2 border border-error/20">
                              {row.error || "No error details available."}
                            </div>
                            {row.download_warning && (
                              <p className="text-[10px] text-warning/60 mt-1">
                                ⚠ Download warning: {row.download_warning}
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* ── toasts ────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <div key={t.id} className={`alert alert-${t.type === "error" ? "error" : "success"} text-xs py-2 px-3 shadow-lg max-w-xs`}>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
