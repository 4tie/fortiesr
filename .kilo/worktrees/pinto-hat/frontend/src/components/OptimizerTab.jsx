import { useState, useEffect, useRef, useCallback } from "react";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

// ── constants ─────────────────────────────────────────────────────────────────
const POLL_MS      = 300;
const MAX_LOG      = 200;
const C_GREEN      = "#059669";
const C_RED        = "#ef4444";
const C_GRID       = "#27272a";
const C_MUTED      = "#71717a";
const C_BG         = "#09090b";

const TIMEFRAMES = ["1m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d","3d","1w"];

const SEARCH_STRATEGIES = [
  { value: "random",       label: "Random" },
  { value: "grid",         label: "Grid" },
  { value: "bayesian",     label: "Bayesian" },
  { value: "evolutionary", label: "Evolutionary" },
];

const SCORE_METRICS = [
  { value: "composite",        label: "Composite" },
  { value: "total_profit_pct", label: "Total Profit %" },
  { value: "net_profit_abs",   label: "Net Profit (abs)" },
  { value: "sharpe_ratio",     label: "Sharpe Ratio" },
  { value: "profit_factor",    label: "Profit Factor" },
  { value: "win_rate",         label: "Win Rate" },
  { value: "max_drawdown_pct", label: "Max Drawdown %" },
  { value: "total_trades",     label: "Total Trades" },
];

const DATE_PRESETS = [
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
  { label: "3Y", days: 1095 },
];

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function toTimerange(s, e) {
  return `${s.replace(/-/g,""  )}-${e.replace(/-/g,"")}`;
}
function datePreset(days) {
  const end = new Date(), start = new Date();
  start.setDate(start.getDate() - days);
  return { start: fmtDate(start), end: fmtDate(end) };
}
function fmtPct(v, decimals = 2) {
  if (v == null) return "—";
  const n = Number(v);
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}
function fmtScore(v) {
  if (v == null) return "—";
  return Number(v).toFixed(4);
}
function fmtElapsed(s) {
  if (!s) return "0s";
  const sec = Math.floor(s);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec/60)}m ${sec%60}s`;
}

// ── sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    completed: "bg-success/15 text-success border-success/30",
    running:   "bg-primary/15 text-primary border-primary/30",
    failed:    "bg-error/15 text-error border-error/30",
    pruned:    "bg-warning/15 text-warning border-warning/30",
    pending:   "bg-base-300/40 text-base-content/30 border-base-300/50",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${map[status] || map.pending}`}>
      {status}
    </span>
  );
}

function MiniTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{
      background:"#18181b", border:"1px solid #3f3f46", borderRadius:6,
      padding:"6px 10px", fontSize:11, fontFamily:"ui-monospace,monospace",
      boxShadow:"0 4px 16px rgba(0,0,0,.7)",
    }}>
      <span style={{ color: C_MUTED }}>Trial {label}: </span>
      <span style={{ color: val >= 0 ? C_GREEN : C_RED, fontWeight:700 }}>
        {val != null ? `${val >= 0 ? "+" : ""}${Number(val).toFixed(2)}%` : "—"}
      </span>
    </div>
  );
}

function TrialChart({ data, dataKey, color, title }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ fontSize:10, color:C_MUTED, marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>
        {title}
      </div>
      {data.length < 2 ? (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C_MUTED, fontSize:11 }}>
          Awaiting trials…
        </div>
      ) : (
        <div style={{ flex:1, minHeight:0 }}>
          <ResponsiveContainer width="100%" height="100%" debounce={80}>
            <LineChart data={data} margin={{ top:4, right:8, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} vertical={false} strokeOpacity={0.5} />
              <XAxis dataKey="trial" tick={{ fill:C_MUTED, fontSize:9 }} axisLine={{ stroke:C_GRID }} tickLine={false} height={16} />
              <YAxis
                tickFormatter={v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
                tick={{ fill:C_MUTED, fontSize:9 }}
                axisLine={false} tickLine={false} width={46}
              />
              <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="4 3" strokeWidth={1} />
              <Tooltip
                content={<MiniTip />}
                cursor={{ stroke:color, strokeWidth:1, strokeOpacity:0.3, strokeDasharray:"3 3" }}
              />
              <Line
                type="monotone" dataKey={dataKey}
                stroke={color} strokeWidth={2}
                dot={false}
                activeDot={{ r:3, fill:color, stroke:C_BG, strokeWidth:2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function OptimizerTab({
  strategies = [],
  strategiesLoading = false,
  sharedState = null,
  sharedLoading = false,
  syncSharedState = null,
}) {

  // form state
  const initEnd   = fmtDate(new Date());
  const initStart = (() => { const d = new Date(); d.setFullYear(d.getFullYear()-1); return fmtDate(d); })();

  const [strategyName,    setStrategyName]    = useState("");
  const [timeframe,       setTimeframe]       = useState("1h");
  const [dateStart,       setDateStart]       = useState(initStart);
  const [dateEnd,         setDateEnd]         = useState(initEnd);
  const [pairsText,       setPairsText]       = useState("BTC/USDT");
  const [totalTrials,     setTotalTrials]     = useState(50);
  const [searchStrategy,  setSearchStrategy]  = useState("random");
  const [scoreMetric,     setScoreMetric]     = useState("composite");
  const [maxOpenTrades,   setMaxOpenTrades]   = useState(1);
  const [wallet,          setWallet]          = useState(1000);

  // search-spaces (parameters table)
  const [searchSpaces,    setSearchSpaces]    = useState([]);
  const [spacesLoading,   setSpacesLoading]   = useState(false);

  // session
  const [sessionId,       setSessionId]       = useState(null);
  const [optSessionId,    setOptSessionId]    = useState(null);
  const [session,         setSession]         = useState(null);
  const [apiStatus,       setApiStatus]       = useState(null);
  const [isRunning,       setIsRunning]       = useState(false);
  const [submitError,     setSubmitError]     = useState(null);

  // trial selection + multi-export
  const [selectedTrial,   setSelectedTrial]   = useState(null);
  const [checkedTrials,   setCheckedTrials]   = useState(new Set());

  // toast notifications
  const [toasts,          setToasts]          = useState([]);

  // promote-candidate workflow
  const [promotingCandidate, setPromotingCandidate] = useState(false);
  const [candidateResult,    setCandidateResult]    = useState(null);

  // params viewer modal
  const [paramsModalOpen, setParamsModalOpen] = useState(false);
  const [paramsModalData, setParamsModalData] = useState(null);
  const [paramsLoading,   setParamsLoading]   = useState(false);

  // dangerous-action confirm dialog
  const [applyConfirmTrial, setApplyConfirmTrial] = useState(null);

  // history dropdown
  const [historyOpen,     setHistoryOpen]     = useState(false);
  const [historySessions, setHistorySessions] = useState([]);
  const [historyLoading,  setHistoryLoading]  = useState(false);

  // logs
  const [logLines,        setLogLines]        = useState([]);
  const logBoxRef  = useRef(null);
  const pollRef    = useRef(null);
  const esRef      = useRef(null);
  const hydrated   = useRef(false);

  // ── hydrate from shared state (once) ─────────────────────────────────────
  useEffect(() => {
    if (sharedLoading || !sharedState || hydrated.current) return;
    hydrated.current = true;
    if (sharedState.strategy_name)        setStrategyName(sharedState.strategy_name);
    if (sharedState.timeframe)            setTimeframe(sharedState.timeframe);
    if (sharedState.pairs?.length)        setPairsText(sharedState.pairs.join(", "));
    if (sharedState.max_open_trades != null) setMaxOpenTrades(sharedState.max_open_trades);
    if (sharedState.dry_run_wallet  != null) setWallet(sharedState.dry_run_wallet);
    if (sharedState.optimizer_total_trials  != null) setTotalTrials(sharedState.optimizer_total_trials);
    if (sharedState.optimizer_search_strategy)       setSearchStrategy(sharedState.optimizer_search_strategy);
    if (sharedState.optimizer_score_metric)          setScoreMetric(sharedState.optimizer_score_metric);
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

  // ── sync changes back to shared state ────────────────────────────────────
  useEffect(() => {
    if (!syncSharedState || !hydrated.current) return;
    const pairs = pairsText.split(/[\s,]+/).filter(Boolean);
    const patch = {};
    if (strategyName)   patch.strategy_name              = strategyName;
    if (timeframe)      patch.timeframe                  = timeframe;
    if (pairs.length)   patch.pairs                      = pairs;
    if (dateStart)      patch.start_date                 = dateStart;
    if (dateEnd)        patch.end_date                   = dateEnd;
    if (dateStart && dateEnd) patch.timerange             = toTimerange(dateStart, dateEnd);
    if (maxOpenTrades)  patch.max_open_trades             = maxOpenTrades;
    if (wallet)         patch.dry_run_wallet              = wallet;
    patch.optimizer_total_trials     = totalTrials;
    patch.optimizer_search_strategy  = searchStrategy;
    patch.optimizer_score_metric     = scoreMetric;
    if (Object.keys(patch).length)  syncSharedState(patch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyName, timeframe, pairsText, dateStart, dateEnd, maxOpenTrades, wallet, totalTrials, searchStrategy, scoreMetric]);

  // ── fetch search spaces ───────────────────────────────────────────────────
  useEffect(() => {
    if (!strategyName) { setSearchSpaces([]); return; }
    setSpacesLoading(true);
    fetch(`/api/optimizer/search-spaces/${encodeURIComponent(strategyName)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => setSearchSpaces((data.search_spaces || []).map(s => ({ ...s, enabled: s.enabled ?? true }))))
      .catch(() => setSearchSpaces([]))
      .finally(() => setSpacesLoading(false));
  }, [strategyName]);

  // ── polling ───────────────────────────────────────────────────────────────
  const startPolling = useCallback((apiId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const sr = await fetch(`/api/session/status/${apiId}`);
        if (!sr.ok) return;
        const sd = await sr.json();
        setApiStatus(sd.status);

        const optId = sd.result?.optimizer_session_id;
        if (optId) {
          setOptSessionId(optId);
          const or = await fetch(`/api/optimizer/session/${optId}`);
          if (or.ok) setSession(await or.json());
        }

        if (TERMINAL.has(sd.status)) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setIsRunning(false);
        }
      } catch (_) {}
    }, POLL_MS);
  }, []);

  // ── SSE logs ──────────────────────────────────────────────────────────────
  const startLogs = useCallback(() => {
    if (esRef.current) esRef.current.close();
    setLogLines([]);
    const es = new EventSource("/api/logs/stream");
    esRef.current = es;
    es.onmessage = (e) => {
      setLogLines(prev => {
        const next = [...prev, e.data];
        return next.length > MAX_LOG ? next.slice(-MAX_LOG) : next;
      });
    };
    es.onerror = () => {};
  }, []);

  // ── auto-scroll logs ──────────────────────────────────────────────────────
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logLines]);

  // ── cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (esRef.current)   esRef.current.close();
  }, []);

  // ── toast helpers ─────────────────────────────────────────────────────────
  const addToast = (message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // ── checkbox toggle ───────────────────────────────────────────────────────
  const toggleCheck = (e, trialNumber) => {
    e.stopPropagation();
    setCheckedTrials(prev => {
      const next = new Set(prev);
      if (next.has(trialNumber)) next.delete(trialNumber);
      else next.add(trialNumber);
      return next;
    });
  };

  // ── apply single trial (dangerous — writes directly to accepted version) ──
  const handleApplyTrial = async (trial) => {
    if (!trial?.parameters) return;
    try {
      const res = await fetch("/api/optimizer/apply-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy_name: strategyName, parameters: trial.parameters }),
      });
      if (res.ok) {
        addToast(`Trial #${trial.trial_number} parameters overwritten on accepted version.`, "success");
      } else {
        const d = await res.json();
        addToast(d.detail || "Failed to apply parameters.", "error");
      }
    } catch {
      addToast("Network error while applying parameters.", "error");
    }
  };

  // ── view best trial params (structured Freqtrade format) ──────────────────
  const handleViewBestParams = async () => {
    if (!optSessionId) return;
    setParamsLoading(true);
    setParamsModalOpen(true);
    setParamsModalData(null);
    try {
      const res = await fetch(`/api/optimizer/session/${optSessionId}/best-trial/params`);
      if (res.ok) {
        setParamsModalData(await res.json());
      } else {
        const d = await res.json();
        setParamsModalData({ error: d.detail || "Failed to load params." });
      }
    } catch {
      setParamsModalData({ error: "Network error loading params." });
    } finally {
      setParamsLoading(false);
    }
  };

  // ── promote best trial to candidate version (safe) ────────────────────────
  const handlePromoteCandidate = async () => {
    if (!optSessionId) return;
    setPromotingCandidate(true);
    setCandidateResult(null);
    try {
      const res = await fetch(
        `/api/optimizer/session/${optSessionId}/best-trial/promote-candidate`,
        { method: "POST" },
      );
      const data = await res.json();
      if (res.ok) {
        setCandidateResult({ ok: true, ...data });
        addToast(`Candidate version created: ${data.candidate_version_id}`, "success");
      } else {
        setCandidateResult({ ok: false, error: data.detail || "Promotion failed." });
        addToast(data.detail || "Failed to promote candidate.", "error");
      }
    } catch {
      setCandidateResult({ ok: false, error: "Network error during promotion." });
      addToast("Network error during promotion.", "error");
    } finally {
      setPromotingCandidate(false);
    }
  };

  // ── load history sessions for current strategy ───────────────────────────
  const loadHistory = async () => {
    if (!strategyName) return;
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const res = await fetch(`/api/optimizer/sessions?strategy_name=${encodeURIComponent(strategyName)}`);
      const data = await res.json();
      setHistorySessions(Array.isArray(data) ? data : []);
    } catch {
      setHistorySessions([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectHistory = (sessionId) => {
    setHistoryOpen(false);
    setOptSessionId(sessionId);
    setIsRunning(false);
    setApiStatus(null);
    setSession(null);
    setSelectedTrial(null);
    setCheckedTrials(new Set());
    setCandidateResult(null);
    setParamsModalOpen(false);
    setApplyConfirmTrial(null);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    // start polling immediately
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/optimizer/session/${sessionId}`);
        if (!r.ok) return;
        const s = await r.json();
        setSession(s);
        if (s.phase === "completed" || s.phase === "failed") {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch { /* ignore */ }
    }, 500);
    addToast("Loaded historical session.", "success");
  };

  // ── export multiple trials ────────────────────────────────────────────────
  const handleExportSelected = async () => {
    const toExport = (session?.trials || []).filter(t => checkedTrials.has(t.trial_number));
    if (!toExport.length) return;
    const payload = {
      trials: toExport.map(t => ({
        strategy_name: strategyName,
        trial_number: t.trial_number,
        score: t.metrics?.score ?? null,
        parameters: t.parameters || {},
        metrics: {
          net_profit_pct: t.metrics?.net_profit_pct ?? null,
          max_drawdown_pct: t.metrics?.max_drawdown_pct ?? null,
          total_trades: t.metrics?.total_trades ?? null,
          sharpe_ratio: t.metrics?.sharpe_ratio ?? null,
        },
      })),
    };
    try {
      const res = await fetch("/api/optimizer/export-trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        addToast(`${toExport.length} configuration${toExport.length > 1 ? "s" : ""} exported to Stress Test Lab!`, "success");
        setCheckedTrials(new Set());
      } else {
        const d = await res.json();
        addToast(d.detail || "Export failed.", "error");
      }
    } catch {
      addToast("Network error during export.", "error");
    }
  };

  // ── run ───────────────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!strategyName) return;
    setSubmitError(null);
    setSession(null);
    setSelectedTrial(null);
    setCheckedTrials(new Set());
    setApiStatus("running");
    setIsRunning(true);

    const pairs = pairsText.split(/[\s,]+/).filter(Boolean);
    const timerange = toTimerange(dateStart, dateEnd);

    try {
      const res = await fetch("/api/optimizer/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy_name: strategyName,
          timerange, timeframe, pairs,
          total_trials: totalTrials,
          search_strategy: searchStrategy,
          score_metric: scoreMetric,
          max_open_trades: maxOpenTrades,
          dry_run_wallet: wallet,
          fee_rate: 0.001,
          search_spaces: searchSpaces,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.detail || "Failed to start optimizer.");
        setIsRunning(false);
        setApiStatus(null);
        return;
      }
      setSessionId(data.session_id);
      startLogs();
      startPolling(data.session_id);
    } catch (err) {
      setSubmitError(String(err));
      setIsRunning(false);
      setApiStatus(null);
    }
  };

  // ── stop ──────────────────────────────────────────────────────────────────
  const handleStop = async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (esRef.current)   { esRef.current.close(); }
    setIsRunning(false);
    setApiStatus("cancelled");
    if (optSessionId) {
      fetch(`/api/optimizer/cancel/${optSessionId}`, { method: "POST" }).catch(() => {});
    }
  };

  // ── toggle / update params ────────────────────────────────────────────────
  const toggleParam = (idx) =>
    setSearchSpaces(prev => prev.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s));

  const updateParam = (idx, field, raw) => {
    const val = raw === "" ? null : Number(raw);
    setSearchSpaces(prev => prev.map((s, i) => i === idx ? { ...s, [field]: isNaN(val) ? null : val } : s));
  };

  // ── derived data ──────────────────────────────────────────────────────────
  const timerange     = toTimerange(dateStart, dateEnd);
  const phase         = session?.phase || apiStatus;
  const totalCount    = session?.total_trials || totalTrials;
  const completedCount = session?.completed_trials || 0;
  const failedCount   = session?.failed_trials || 0;
  const progressPct   = totalCount > 0 ? Math.min(100, (completedCount / totalCount) * 100) : 0;
  const elapsedSec    = session?.elapsed_seconds || 0;
  const etaSec        = session?.eta_seconds;
  const bestTrialNum  = session?.best_trial_number;
  const bestTrial     = bestTrialNum != null
    ? (session?.trials || []).find(t => t.trial_number === bestTrialNum)
    : null;

  const visibleTrials = (session?.trials || [])
    .filter(t => ["completed", "running", "failed", "pruned"].includes(t.status))
    .sort((a, b) => b.trial_number - a.trial_number);

  const completedWithMetrics = (session?.trials || [])
    .filter(t => t.status === "completed" && t.metrics)
    .sort((a, b) => a.trial_number - b.trial_number);

  const profitData   = completedWithMetrics
    .filter(t => t.metrics?.net_profit_pct != null)
    .map(t => ({ trial: t.trial_number, profit: Number(t.metrics.net_profit_pct) }));

  const drawdownData = completedWithMetrics
    .filter(t => t.metrics?.max_drawdown_pct != null)
    .map(t => ({ trial: t.trial_number, drawdown: Math.abs(Number(t.metrics.max_drawdown_pct)) }));

  const canRun = !!strategyName && !!dateStart && !!dateEnd && !isRunning;

  // ── phase pill color ──────────────────────────────────────────────────────
  const phaseCls = phase === "running"   ? "text-primary border-primary/30 bg-primary/10"
                 : phase === "completed" ? "text-success border-success/30 bg-success/10"
                 : phase === "failed"    ? "text-error   border-error/30   bg-error/10"
                 : phase === "cancelled" ? "text-warning border-warning/30 bg-warning/10"
                 :                        "hidden";

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-base-300 bg-base-200">
        <span className="text-sm font-bold tracking-tight">🎯 Parameter Optimizer</span>

        {phase && (
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${phaseCls}`}>
            {phase}
          </span>
        )}

        {session && (
          <span className="text-xs text-base-content/40 font-mono">
            {completedCount} / {totalCount} trials
            {etaSec != null && isRunning ? ` · ETA ${fmtElapsed(etaSec)}` : ""}
            {failedCount > 0 ? ` · ${failedCount} failed` : ""}
          </span>
        )}

        <div className="flex-1" />

        {isRunning && (
          <button onClick={handleStop} className="btn btn-ghost btn-sm text-error border-error/30 px-3">
            Stop
          </button>
        )}
        <button
          onClick={handleRun}
          disabled={!canRun}
          className="btn btn-primary btn-sm px-5 gap-2"
        >
          {isRunning
            ? <><span className="loading loading-spinner loading-xs" />Running…</>
            : "Run Optimizer"
          }
        </button>
      </div>

      {submitError && (
        <div className="shrink-0 mx-4 mt-2 text-xs text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">
          {submitError}
        </div>
      )}

      {/* ── toast stack ────────────────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={`px-4 py-2.5 rounded-lg border text-xs font-medium shadow-lg pointer-events-auto transition-all ${
              t.type === "error"
                ? "bg-error/15 border-error/40 text-error"
                : "bg-success/15 border-success/40 text-success"
            }`}>
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* ── three-pane body ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ══════════ LEFT SIDEBAR ══════════════════════════════════════════ */}
        <aside className="w-72 shrink-0 border-r border-base-300 bg-base-200/40 flex flex-col overflow-y-auto">
          <div className="px-4 pt-4 pb-2 flex flex-col gap-3">

            {/* Strategy + History */}
            <div>
              <label className="block text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-1">Strategy</label>
              <div className="flex gap-1.5">
                <select
                  className="select select-sm select-bordered w-full text-xs"
                  value={strategyName}
                  onChange={e => setStrategyName(e.target.value)}
                  disabled={isRunning}
                >
                  <option value="">— Select strategy —</option>
                  {strategies.map(s => (
                    <option key={s.strategy_name} value={s.strategy_name}>{s.strategy_name}</option>
                  ))}
                </select>
                <button
                  className="btn btn-sm btn-ghost shrink-0 border border-base-300 px-2 text-base-content/50 hover:text-primary"
                  title="Previous optimizer sessions"
                  disabled={!strategyName || isRunning}
                  onClick={loadHistory}
                >
                  📚
                </button>
              </div>
            </div>

            {/* History dropdown */}
            {historyOpen && (
              <div className="relative">
                <div className="absolute z-30 left-0 right-0 bg-base-200 border border-base-300 rounded-xl shadow-2xl overflow-hidden max-h-60 flex flex-col">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-base-300 bg-base-300/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">Previous Runs</span>
                    <button className="btn btn-ghost btn-xs text-base-content/30" onClick={() => setHistoryOpen(false)}>✕</button>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {historyLoading && (
                      <div className="flex items-center justify-center py-6 gap-2 text-[10px] text-base-content/40">
                        <span className="loading loading-spinner loading-xs" />
                        Loading...
                      </div>
                    )}
                    {!historyLoading && historySessions.length === 0 && (
                      <div className="px-3 py-4 text-[10px] text-base-content/40 text-center">
                        No previous sessions found.
                      </div>
                    )}
                    {!historyLoading && historySessions.map((s, i) => (
                      <button
                        key={s.session_id}
                        className={`w-full text-left px-3 py-2.5 text-[10px] hover:bg-base-300/40 transition-colors ${i !== 0 ? "border-t border-base-300/50" : ""}`}
                        onClick={() => handleSelectHistory(s.session_id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-base-content/70">
                            {s.session_id.slice(0, 8)}…</span>
                          <span className={`badge badge-xs ${s.phase === "completed" ? "badge-success" : s.phase === "failed" ? "badge-error" : "badge-primary"}`}>
                            {s.phase}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-base-content/40">
                          <span>{s.completed_trials} / {s.total_trials} trials</span>
                          {s.best_score != null && <span>• score {s.best_score.toFixed(3)}</span>}
                          <span>• {new Date(s.created_at).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Timeframe + Trials */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-1">Timeframe</label>
                <select
                  className="select select-sm select-bordered w-full text-xs"
                  value={timeframe}
                  onChange={e => setTimeframe(e.target.value)}
                  disabled={isRunning}
                >
                  {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-1">Trials</label>
                <input
                  type="number" min={1} max={500}
                  className="input input-sm input-bordered w-full text-xs"
                  value={totalTrials}
                  onChange={e => setTotalTrials(Math.max(1, Math.min(500, Number(e.target.value))))}
                  disabled={isRunning}
                />
              </div>
            </div>

            {/* Timerange */}
            <div>
              <label className="block text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-1">Timerange</label>
              <div className="flex gap-1 mb-1.5">
                {DATE_PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    className="btn btn-xs btn-ghost border border-base-300 text-[10px] px-2 flex-1"
                    disabled={isRunning}
                    onClick={() => {
                      const { start, end } = datePreset(p.days);
                      setDateStart(start); setDateEnd(end);
                    }}
                  >{p.label}</button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input type="date" className="input input-xs input-bordered flex-1 text-xs" value={dateStart} onChange={e => setDateStart(e.target.value)} disabled={isRunning} />
                <input type="date" className="input input-xs input-bordered flex-1 text-xs" value={dateEnd}  onChange={e => setDateEnd(e.target.value)}   disabled={isRunning} />
              </div>
              <div className="text-[10px] font-mono text-base-content/25 mt-1">{timerange}</div>
            </div>

            {/* Pairs */}
            <div>
              <label className="block text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-1">Pairs</label>
              <textarea
                className="textarea textarea-bordered w-full text-xs font-mono resize-none"
                rows={2}
                placeholder="BTC/USDT, ETH/USDT"
                value={pairsText}
                onChange={e => setPairsText(e.target.value)}
                disabled={isRunning}
              />
              <div className="text-[10px] text-base-content/25">Comma or space separated</div>
            </div>

            {/* Search strategy + Score metric */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-1">Search</label>
                <select className="select select-xs select-bordered w-full text-xs" value={searchStrategy} onChange={e => setSearchStrategy(e.target.value)} disabled={isRunning}>
                  {SEARCH_STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-1">Score</label>
                <select className="select select-xs select-bordered w-full text-xs" value={scoreMetric} onChange={e => setScoreMetric(e.target.value)} disabled={isRunning}>
                  {SCORE_METRICS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Max open trades + Wallet */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-1">Max Trades</label>
                <input type="number" min={1} className="input input-xs input-bordered w-full text-xs" value={maxOpenTrades} onChange={e => setMaxOpenTrades(Number(e.target.value))} disabled={isRunning} />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-1">Wallet</label>
                <input type="number" min={1} className="input input-xs input-bordered w-full text-xs" value={wallet} onChange={e => setWallet(Number(e.target.value))} disabled={isRunning} />
              </div>
            </div>

          </div>

          <div className="border-t border-base-300 mx-3 my-1.5" />

          {/* ── Parameters Table ── */}
          <div className="px-4 pb-4 flex flex-col flex-1 min-h-0">
            <div className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-2 flex items-center gap-2">
              Parameters
              {spacesLoading && <span className="loading loading-spinner loading-xs" />}
              {!spacesLoading && searchSpaces.length > 0 && (
                <span className="font-mono text-base-content/25">({searchSpaces.length})</span>
              )}
            </div>

            {!strategyName && (
              <p className="text-xs text-base-content/25 italic">Select a strategy to see parameters.</p>
            )}
            {strategyName && !spacesLoading && searchSpaces.length === 0 && (
              <p className="text-xs text-base-content/25 italic">No optimizable parameters found for this strategy.</p>
            )}

            {searchSpaces.length > 0 && (
              <div className="overflow-y-auto flex-1 -mx-1">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-base-content/25 uppercase tracking-wider">
                      <th className="w-5 pb-1.5" />
                      <th className="text-left pb-1.5 font-semibold pl-1">Name</th>
                      <th className="text-right pb-1.5 font-semibold">Min</th>
                      <th className="text-right pb-1.5 font-semibold">Max</th>
                      <th className="text-right pb-1.5 font-semibold">Def</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchSpaces.map((sp, idx) => (
                      <tr key={sp.name} className={`border-t border-base-300/40 ${sp.enabled ? "" : "opacity-40"}`}>
                        <td className="py-1">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs"
                            checked={sp.enabled}
                            onChange={() => toggleParam(idx)}
                            disabled={isRunning}
                          />
                        </td>
                        <td className="py-1 pl-1 font-mono text-base-content/60 max-w-[80px] truncate" title={sp.name}>{sp.name}</td>
                        <td className="py-1 pr-0.5">
                          {sp.choices != null ? (
                            <span className="text-right block text-base-content/40 font-mono text-[10px]">{sp.choices.length}c</span>
                          ) : (
                            <input
                              type="number"
                              className="w-full text-right bg-transparent border border-transparent hover:border-base-300 focus:border-primary/50 focus:outline-none rounded px-1 py-0.5 font-mono text-[10px] text-base-content/70 disabled:opacity-40"
                              value={sp.min_value ?? ""}
                              placeholder="—"
                              disabled={isRunning || !sp.enabled}
                              onChange={e => updateParam(idx, "min_value", e.target.value)}
                              step="any"
                            />
                          )}
                        </td>
                        <td className="py-1 pr-0.5">
                          {sp.choices != null ? (
                            <span className="text-right block text-base-content/40 font-mono text-[10px]">—</span>
                          ) : (
                            <input
                              type="number"
                              className="w-full text-right bg-transparent border border-transparent hover:border-base-300 focus:border-primary/50 focus:outline-none rounded px-1 py-0.5 font-mono text-[10px] text-base-content/70 disabled:opacity-40"
                              value={sp.max_value ?? ""}
                              placeholder="—"
                              disabled={isRunning || !sp.enabled}
                              onChange={e => updateParam(idx, "max_value", e.target.value)}
                              step="any"
                            />
                          )}
                        </td>
                        <td className="py-1 text-right text-base-content/40 font-mono text-[10px] pr-1">{sp.default != null ? String(sp.default) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </aside>

        {/* ══════════ CENTER PANE ═══════════════════════════════════════════ */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* Progress bar */}
          <div className="shrink-0 px-5 py-3 border-b border-base-300 bg-base-100">
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="font-semibold text-base-content/60">
                {completedCount} / {totalCount} trials complete
              </span>
              <div className="flex gap-3 text-base-content/35 font-mono">
                <span>Elapsed: {fmtElapsed(elapsedSec)}</span>
                {etaSec != null && isRunning && <span>ETA: ~{fmtElapsed(etaSec)}</span>}
                {failedCount > 0 && <span className="text-error">{failedCount} failed</span>}
              </div>
            </div>
            <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ background: C_GRID }}>
              <div
                className="h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${progressPct}%`,
                  background: phase === "completed" ? C_GREEN : phase === "failed" ? C_RED : "#3b82f6",
                }}
              />
            </div>
            <div className="text-[10px] text-right text-base-content/25 mt-1 font-mono">{progressPct.toFixed(1)}%</div>
          </div>

          {/* Charts */}
          <div className="shrink-0 grid grid-cols-2 border-b border-base-300" style={{ height: 196 }}>
            <div className="px-5 py-3 border-r border-base-300" style={{ height: 196 }}>
              <TrialChart data={profitData}   dataKey="profit"   color={C_GREEN} title="Net Profit % per Trial" />
            </div>
            <div className="px-5 py-3" style={{ height: 196 }}>
              <TrialChart data={drawdownData} dataKey="drawdown" color={C_RED}   title="Max Drawdown % per Trial (abs)" />
            </div>
          </div>

          {/* Trial table */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center gap-2 px-5 pt-3 pb-1.5">
              <span className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider">Trial Results</span>
              {visibleTrials.length > 0 && (
                <span className="text-[10px] text-base-content/25 font-mono">({visibleTrials.length})</span>
              )}
              {checkedTrials.size > 0 && (
                <button
                  onClick={handleExportSelected}
                  className="ml-auto btn btn-primary btn-xs gap-1.5 px-3"
                  title={`Export ${checkedTrials.size} selected trial${checkedTrials.size > 1 ? "s" : ""} to Stress Test Lab`}
                >
                  ⚡ Export {checkedTrials.size} to Stress Lab
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {visibleTrials.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-base-content/25 italic">
                    {isRunning ? "Waiting for first trial to complete…" : "No trials yet — run the optimizer to begin."}
                  </p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10" style={{ background:"var(--color-base-100,#09090b)" }}>
                    <tr className="border-b border-base-300 text-[10px] text-base-content/35 uppercase tracking-wider">
                      <th className="px-3 py-2 w-6">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={checkedTrials.size === visibleTrials.filter(t => t.status === "completed").length && checkedTrials.size > 0}
                          onChange={e => {
                            if (e.target.checked) {
                              setCheckedTrials(new Set(visibleTrials.filter(t => t.status === "completed").map(t => t.trial_number)));
                            } else {
                              setCheckedTrials(new Set());
                            }
                          }}
                          title="Select all completed trials"
                        />
                      </th>
                      <th className="text-left px-2 py-2 font-semibold">Trial</th>
                      <th className="text-left px-2 py-2 font-semibold">Status</th>
                      <th className="text-right px-2 py-2 font-semibold">Score</th>
                      <th className="text-right px-2 py-2 font-semibold">Profit %</th>
                      <th className="text-right px-2 py-2 font-semibold">Drawdown</th>
                      <th className="text-right px-5 py-2 font-semibold">Trades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTrials.map(t => {
                      const isBest     = t.trial_number === bestTrialNum;
                      const isSelected = selectedTrial?.trial_number === t.trial_number;
                      const isChecked  = checkedTrials.has(t.trial_number);
                      const profit     = t.metrics?.net_profit_pct;
                      const dd         = t.metrics?.max_drawdown_pct;
                      return (
                        <tr
                          key={t.trial_number}
                          onClick={() => setSelectedTrial(isSelected ? null : t)}
                          className={`border-b border-base-300/30 cursor-pointer transition-colors ${
                            isChecked  ? "bg-primary/8"
                            : isSelected ? "bg-primary/10"
                            : isBest   ? "bg-success/5 hover:bg-success/8"
                            :            "hover:bg-base-200/50"
                          }`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-xs"
                              checked={isChecked}
                              disabled={t.status !== "completed"}
                              onChange={e => toggleCheck(e, t.trial_number)}
                              onClick={e => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-2 py-2 font-mono font-semibold text-base-content/70">
                            #{t.trial_number}
                            {isBest && <span className="ml-1.5 text-success text-[10px]">★ best</span>}
                          </td>
                          <td className="px-2 py-2"><StatusBadge status={t.status} /></td>
                          <td className="px-2 py-2 text-right font-mono font-semibold text-base-content/75">
                            {fmtScore(t.metrics?.score)}
                          </td>
                          <td className={`px-2 py-2 text-right font-mono font-semibold ${
                            profit > 0 ? "text-success" : profit < 0 ? "text-error" : "text-base-content/35"
                          }`}>
                            {fmtPct(profit)}
                          </td>
                          <td className={`px-2 py-2 text-right font-mono ${dd != null ? "text-warning" : "text-base-content/35"}`}>
                            {dd != null ? fmtPct(Math.abs(dd)) : "—"}
                          </td>
                          <td className="px-5 py-2 text-right font-mono text-base-content/55">
                            {t.metrics?.total_trades ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Live logs */}
          <div className="shrink-0 border-t border-base-300" style={{ height: 142 }}>
            <div className="flex items-center gap-2 px-5 pt-2 pb-1">
              <span className="text-[10px] font-semibold text-base-content/35 uppercase tracking-wider">Live Logs</span>
              <span className="text-[10px] text-base-content/20 font-mono">{logLines.length > 0 ? `${logLines.length} lines` : ""}</span>
              {logLines.length > 0 && (
                <button className="ml-auto text-[9px] text-base-content/25 hover:text-base-content/55 transition-colors" onClick={() => setLogLines([])}>
                  Clear
                </button>
              )}
            </div>
            <div
              ref={logBoxRef}
              className="overflow-y-auto px-5 pb-2"
              style={{ height: 104 }}
            >
              {logLines.length === 0 ? (
                <span className="text-[10px] text-base-content/20 italic font-mono">Logs will appear when a session starts…</span>
              ) : logLines.map((line, i) => (
                <div key={i} className={`font-mono text-[10px] leading-relaxed ${
                  line.includes("ERROR") || line.includes("error") ? "text-error/80"
                  : line.includes("WARN")                          ? "text-warning/80"
                  : line.includes("Trial") || line.includes("trial") ? "text-primary/70"
                  :                                                   "text-base-content/45"
                }`}>{line}</div>
              ))}
            </div>
          </div>
        </main>

        {/* ══════════ RIGHT SIDEBAR ═════════════════════════════════════════ */}
        <aside className="w-64 shrink-0 border-l border-base-300 bg-base-200/40 flex flex-col overflow-y-auto">

          {/* Best Result */}
          <div className="px-4 py-4 border-b border-base-300">
            <div className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-2.5">Best Result</div>

            {!bestTrial ? (
              <p className="text-xs text-base-content/25 italic">No results yet.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold" style={{ color: C_GREEN }}>★ Trial #{bestTrial.trial_number}</span>
                  <StatusBadge status={bestTrial.status} />
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mb-4">
                  {[
                    { label: "Score",    val: fmtScore(bestTrial.metrics?.score),          cls: "text-base-content/80" },
                    { label: "Profit",   val: fmtPct(bestTrial.metrics?.net_profit_pct),   cls: bestTrial.metrics?.net_profit_pct >= 0 ? "text-success" : "text-error" },
                    { label: "Drawdown", val: bestTrial.metrics?.max_drawdown_pct != null ? fmtPct(Math.abs(bestTrial.metrics.max_drawdown_pct)) : "—", cls: "text-warning" },
                    { label: "Trades",   val: bestTrial.metrics?.total_trades ?? "—",      cls: "text-base-content/60" },
                    { label: "Sharpe",   val: bestTrial.metrics?.sharpe_ratio != null ? Number(bestTrial.metrics.sharpe_ratio).toFixed(3) : "—", cls: "text-base-content/60" },
                    { label: "Pf",       val: bestTrial.metrics?.profit_factor != null ? Number(bestTrial.metrics.profit_factor).toFixed(3) : "—", cls: "text-base-content/60" },
                  ].map(({ label, val, cls }) => (
                    <div key={label}>
                      <div className="text-[9px] uppercase tracking-wider text-base-content/25 mb-0.5">{label}</div>
                      <div className={`text-xs font-semibold font-mono ${cls}`}>{val}</div>
                    </div>
                  ))}
                </div>

                <button
                  className="btn btn-primary btn-xs w-full gap-1"
                  disabled={!bestTrial || !bestTrial.parameters || promotingCandidate}
                  title="Create a safe candidate version from the best trial — does not modify the accepted version"
                  onClick={handlePromoteCandidate}
                >
                  {promotingCandidate
                    ? <><span className="loading loading-spinner loading-xs" />Promoting…</>
                    : "⬆ Promote Best to Candidate"}
                </button>

                <button
                  className="btn btn-ghost btn-xs w-full gap-1 border border-base-300"
                  disabled={!bestTrial || !optSessionId}
                  title="View best trial parameters in Freqtrade-compatible JSON format"
                  onClick={handleViewBestParams}
                >
                  {paramsLoading ? <span className="loading loading-spinner loading-xs" /> : "{}"}
                  View Best Params
                </button>

                {candidateResult && (
                  <div className={`mt-1.5 text-[10px] rounded-lg px-2.5 py-2.5 border ${
                    candidateResult.ok
                      ? "bg-success/10 border-success/25 text-success"
                      : "bg-error/10 border-error/25 text-error"
                  }`}>
                    {candidateResult.ok ? (
                      <>
                        <div className="font-semibold mb-1">✓ Candidate version created</div>
                        <div className="font-mono break-all opacity-80 mb-2">{candidateResult.candidate_version_id}</div>
                        <div className="text-[9px] opacity-70 leading-relaxed border-t border-current/20 pt-1.5">
                          Next steps: go to <strong>Strategy Editor</strong> → open this strategy → review the candidate version → run a backtest → accept it to make it the live version.
                        </div>
                      </>
                    ) : candidateResult.error}
                  </div>
                )}

                {!candidateResult && (
                  <div className="text-[9px] text-base-content/30 leading-relaxed px-0.5 mt-1">
                    Creates a new <em>candidate version</em> with the best trial{"'"}s parameters — your accepted version is untouched. Afterwards, go to Strategy Editor to review, backtest, and accept it.
                  </div>
                )}

                <div className="border-t border-base-300/50 my-1" />

                <button
                  className="btn btn-ghost btn-xs w-full text-warning border border-warning/30 hover:bg-warning/10"
                  disabled={!bestTrial || !bestTrial.parameters}
                  title="⚠ Overwrites the accepted version params.json directly — use Promote to Candidate for the safe workflow"
                  onClick={() => setApplyConfirmTrial(selectedTrial?.parameters ? selectedTrial : bestTrial)}
                >
                  {selectedTrial?.parameters && selectedTrial.trial_number !== bestTrial?.trial_number
                    ? `⚠ Overwrite Accepted (T#${selectedTrial.trial_number})`
                    : "⚠ Overwrite Accepted Params"}
                </button>
              </>
            )}
          </div>

          {/* Selected Trial */}
          <div className="px-4 py-4 flex-1">
            <div className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider mb-2.5">
              {selectedTrial ? `Trial #${selectedTrial.trial_number}` : "Selected Trial"}
            </div>

            {!selectedTrial ? (
              <p className="text-xs text-base-content/25 italic">Click a row in the table to inspect its parameters.</p>
            ) : (
              <>
                <div className="mb-3"><StatusBadge status={selectedTrial.status} /></div>

                {selectedTrial.metrics && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-4">
                    {[
                      { label: "Score",    val: fmtScore(selectedTrial.metrics.score) },
                      { label: "Profit",   val: fmtPct(selectedTrial.metrics.net_profit_pct) },
                      { label: "Drawdown", val: selectedTrial.metrics.max_drawdown_pct != null ? fmtPct(Math.abs(selectedTrial.metrics.max_drawdown_pct)) : "—" },
                      { label: "Trades",   val: selectedTrial.metrics.total_trades ?? "—" },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div className="text-[9px] uppercase tracking-wider text-base-content/25 mb-0.5">{label}</div>
                        <div className="text-xs font-semibold font-mono text-base-content/70">{val}</div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedTrial.parameters && Object.keys(selectedTrial.parameters).length > 0 && (
                  <>
                    <div className="text-[9px] font-semibold text-base-content/25 uppercase tracking-wider mb-1.5">Parameters</div>
                    <div className="space-y-1.5">
                      {Object.entries(selectedTrial.parameters).map(([k, v]) => {
                        const sp = searchSpaces.find(s => s.name === k);
                        const changed = sp != null && String(v) !== String(sp.default);
                        return (
                          <div key={k} className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] text-base-content/40 truncate flex-1" title={k}>{k}</span>
                            <span className={`font-mono text-[10px] font-semibold shrink-0 ${changed ? "text-primary" : "text-base-content/55"}`}>
                              {String(v)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {selectedTrial.error && (
                  <div className="mt-3 text-[10px] text-error bg-error/10 border border-error/20 rounded px-2.5 py-2">
                    {selectedTrial.error}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

      </div>
    </div>

    {/* ── Params Viewer Modal ─────────────────────────────────────────────── */}
    {paramsModalOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={() => setParamsModalOpen(false)}
      >
        <div
          className="bg-base-200 border border-base-300 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col"
          style={{ maxHeight: "80vh" }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-300">
            <div>
              <div className="text-sm font-bold">Best Trial Parameters</div>
              <div className="text-[10px] text-base-content/40 mt-0.5">Freqtrade-compatible JSON format</div>
            </div>
            <button
              className="btn btn-ghost btn-xs text-base-content/40"
              onClick={() => setParamsModalOpen(false)}
            >✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {paramsLoading && (
              <div className="flex items-center justify-center py-10 gap-2 text-xs text-base-content/40">
                <span className="loading loading-spinner loading-sm" />
                Loading params…
              </div>
            )}
            {!paramsLoading && paramsModalData?.error && (
              <div className="text-xs text-error bg-error/10 border border-error/20 rounded px-3 py-2">
                {paramsModalData.error}
              </div>
            )}
            {!paramsLoading && paramsModalData && !paramsModalData.error && (() => {
              const p = paramsModalData.params || {};
              const sections = [
                { key: "buy",      label: "Buy",      color: "text-success" },
                { key: "sell",     label: "Sell",     color: "text-error" },
                { key: "roi",      label: "ROI Table", color: "text-primary" },
                { key: "trailing", label: "Trailing", color: "text-warning" },
              ];
              const hasSections = sections.some(s => p[s.key] && Object.keys(p[s.key]).length > 0);
              const hasStoploss = p.stoploss != null;
              return (
                <>
                  <div className="flex items-center gap-2 text-[10px] text-base-content/40">
                    <span className="font-mono font-bold text-base-content/70">{paramsModalData.strategy_name}</span>
                    <span>· best trial parameters</span>
                  </div>

                  {hasStoploss && (
                    <div className="rounded-lg border border-base-300 overflow-hidden">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-base-300/40 text-base-content/50">Stoploss</div>
                      <div className="px-3 py-2 flex items-center justify-between">
                        <span className="text-xs font-mono text-base-content/70">stoploss</span>
                        <span className="text-xs font-mono font-bold text-warning">{Number(p.stoploss).toFixed(4)}</span>
                      </div>
                    </div>
                  )}

                  {sections.map(({ key, label, color }) => {
                    const entries = p[key] ? Object.entries(p[key]) : [];
                    if (entries.length === 0) return null;
                    return (
                      <div key={key} className="rounded-lg border border-base-300 overflow-hidden">
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-base-300/40 text-base-content/50">{label}</div>
                        {entries.map(([k, v], i) => (
                          <div key={k} className={`px-3 py-2 flex items-center justify-between ${i !== 0 ? "border-t border-base-300/40" : ""}`}>
                            <span className="text-xs font-mono text-base-content/70">{k}</span>
                            <span className={`text-xs font-mono font-bold ${color}`}>
                              {typeof v === "number" ? Number(v).toFixed(4) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {!hasSections && !hasStoploss && (
                    <div className="text-xs text-base-content/35 italic text-center py-4">
                      No parameter values found in this trial.
                    </div>
                  )}

                  <div className="mt-2">
                    <div className="text-[9px] text-base-content/25 mb-1.5 uppercase tracking-wider font-semibold">Raw JSON</div>
                    <pre className="text-[10px] font-mono text-base-content/50 bg-base-300/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(paramsModalData, null, 2)}
                    </pre>
                  </div>
                </>
              );
            })()}
          </div>

          {!paramsLoading && paramsModalData && !paramsModalData.error && (
            <div className="px-5 py-3 border-t border-base-300 flex gap-2 justify-end">
              <button
                className="btn btn-ghost btn-xs border border-base-300"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(paramsModalData, null, 2));
                  addToast("Params JSON copied to clipboard!", "success");
                }}
              >
                Copy JSON
              </button>
              <button className="btn btn-ghost btn-xs" onClick={() => setParamsModalOpen(false)}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    )}

    {/* ── Overwrite Accepted Params Confirm Dialog ────────────────────────── */}
    {applyConfirmTrial && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={() => setApplyConfirmTrial(null)}
      >
        <div
          className="bg-base-200 border border-warning/40 rounded-xl shadow-2xl w-full max-w-sm mx-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="px-5 py-4 border-b border-warning/20">
            <div className="text-sm font-bold text-warning">⚠ Overwrite Accepted Params?</div>
          </div>
          <div className="px-5 py-4 text-xs text-base-content/70 space-y-2">
            <p>
              This will <strong className="text-warning">overwrite the accepted version{"'"}s params.json</strong> for{" "}
              <span className="font-mono text-base-content/90">{strategyName}</span> with the parameters
              from <strong>Trial #{applyConfirmTrial.trial_number}</strong>.
            </p>
            <p className="text-base-content/50">
              This cannot be undone automatically. Use <strong>Promote Best to Candidate</strong> for the safe workflow — it creates a separate candidate version without touching the accepted version.
            </p>
          </div>
          <div className="px-5 py-3 border-t border-base-300 flex gap-2 justify-end">
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setApplyConfirmTrial(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-warning btn-xs"
              onClick={() => {
                handleApplyTrial(applyConfirmTrial);
                setApplyConfirmTrial(null);
              }}
            >
              Yes, Overwrite
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
