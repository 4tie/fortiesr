import { useEffect, useCallback, useMemo, useRef } from "react";
import RunHistoryDashboard from "./RunHistoryDashboard";
import {
  STAGE_NAMES,
} from "../features/autoquant/constants";
import {
  parsePairUniverse,
} from "../features/autoquant/utils";
import AutoQuantStageStepper from "./autoquant/AutoQuantStageStepper";
import AutoQuantLiveFitnessCurve from "./autoquant/AutoQuantLiveFitnessCurve";
import AutoQuantLogTerminal from "./autoquant/AutoQuantLogTerminal";
import AutoQuantFailureReport from "./autoquant/AutoQuantFailureReport";
import AutoQuantInterruptedReport from "./autoquant/AutoQuantInterruptedReport";
import AutoQuantWfoWindowsTable from "./autoquant/AutoQuantWfoWindowsTable";
import AutoQuantRobustnessBadge from "./autoquant/AutoQuantRobustnessBadge";
import AutoQuantTradeDistributionChart from "./autoquant/AutoQuantTradeDistributionChart";
import AutoQuantFinalReport from "./autoquant/AutoQuantFinalReport";
import useAutoQuantForm from "../features/autoquant/hooks/useAutoQuantForm";
import useAutoQuantPipeline from "../features/autoquant/hooks/useAutoQuantPipeline";
import useAutoQuantStrategyGen from "../features/autoquant/hooks/useAutoQuantStrategyGen";
import useAutoQuantScreening from "../features/autoquant/hooks/useAutoQuantScreening";
import useAutoQuantUI from "../features/autoquant/hooks/useAutoQuantUI";

export default function AutoQuantTab({
  strategies = [],
  strategiesLoading = false,
  onAgentContextChange = null,
  pipelineState: initialPipelineState = null,
}) {
  // Custom hooks for state management
  const formState = useAutoQuantForm();
  const pipelineState = useAutoQuantPipeline(initialPipelineState);
  const strategyGen = useAutoQuantStrategyGen(strategies);
  const screening = useAutoQuantScreening();
  const uiState = useAutoQuantUI();
  const runHistoryRef = useRef(null);

  const {
    form,
    setForm,
    updateField,
    toggleSpace,
    timeframeProfile,
    showAdvanced,
    setShowAdvanced,
  } = formState;

  const {
    runId,
    setRunId,
    pipelineState: pipelineData,
    setPipelineState,
    logLines,
    isConnecting,
    report,
    setReport,
    fitnessCurve,
    hyperoptProgress,
    elapsedSeconds,
    runStartedAtMs,
    setRunStartedAtMs,
    wfoWindows,
    setWfoWindows,
    dataHealingStatus,
    pairStatusMap,
    startPipeline,
    cancelPipeline,
    loadReport,
    resetPipelineState,
  } = pipelineState;

  const {
    generatedStrategies,
    generateStatus,
    isGenerating,
    templateType,
    setTemplateType,
    strategyList,
    handleGenerateTemplate,
  } = strategyGen;


  const {
    showScreener,
    setShowScreener,
    screenPairs,
    setScreenPairs,
    screening: isScreening,
    screenResults,
    screenError,
    selectedPair,
    setSelectedPair,
    handleScreenPairs,
  } = screening;

  const {
    showHyperopt,
    setShowHyperopt,
    showWfo,
    setShowWfo,
    showEnsemble,
    setShowEnsemble,
    logFilter,
    setLogFilter,
    notifEnabled,
    setNotifEnabled,
    toggleNotif,
  } = uiState;

  useEffect(() => {
    if (!onAgentContextChange) return;
    onAgentContextChange({
      active_panel: pipelineData?.current_stage ? `stage-${pipelineData.current_stage}` : null,
      strategy_name: pipelineData?.strategy || form.strategy || null,
      auto_quant_run_id: runId,
      optimizer_session_id: null,
      backtest_run_id: null,
      api_session_id: null,
    });
  }, [form.strategy, onAgentContextChange, pipelineData?.current_stage, pipelineData?.strategy, runId]);

  const handleStart = async () => {
    if (!form.strategy) return;
    const pairUniverseList = parsePairUniverse(form.pair_universe);
    try {
      const id = await startPipeline({
        ...form,
        pair_universe: pairUniverseList,
      });
      setRunId(id);
    } catch (err) {
      console.error("Failed to start pipeline:", err);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelPipeline();
    } catch (err) {
      console.error("Failed to cancel pipeline:", err);
    }
  };

  const handleReset = () => {
    resetPipelineState();
  };

  const handleRetryRelaxed = (bestAttempt, thresholds, bestStrategyName) => {
    const bestProfit = bestAttempt?.profit ?? null;
    const bestDd = bestAttempt?.drawdown ?? thresholds?.max_drawdown_threshold ?? 30;
    const relaxedProfit = bestProfit != null ? parseFloat((bestProfit - 0.01).toFixed(4)) : 0;
    const relaxedDd = Math.min(35, parseFloat((bestDd + 5).toFixed(1)));
    setForm((prev) => ({
      ...prev,
      min_oos_profit: relaxedProfit,
      max_drawdown_threshold: relaxedDd,
      ...(bestStrategyName ? { strategy: bestStrategyName } : {}),
    }));
    handleReset();
  };

  const handleLoadRun = useCallback(
    (run) => {
      setRunId(run.run_id);
      if (run.created_at) {
        const createdAtMs = new Date(run.created_at).getTime();
        setRunStartedAtMs(Number.isNaN(createdAtMs) ? null : createdAtMs);
      } else {
        setRunStartedAtMs(null);
      }
      setReport(run.report || null);
      setWfoWindows(run.wfo_windows || []);
      setPipelineState({
        run_id: run.run_id,
        strategy: run.strategy,
        timeframe: run.timeframe,
        in_sample_range: run.in_sample_range,
        out_sample_range: run.out_sample_range,
        exchange: run.exchange,
        status: run.status,
        current_stage: run.current_stage || 0,
        stages: run.stages || STAGE_NAMES.map((name, i) => ({
          index: i + 1, name, status: "pending", message: "", data: {},
        })),
        error: run.error || null,
        created_at: run.created_at,
        completed_at: run.completed_at,
        retry_history: run.retry_history || [],
        generalization_failure: run.generalization_failure || null,
        sensitivity: run.sensitivity || null,
        thresholds: run.thresholds || null,
      });

      if (run.status === "completed" && !run.report) {
        loadReport(run.run_id).catch((err) => console.error("Failed to load report:", err));
      }
    },
    [setRunId, setRunStartedAtMs, setReport, setWfoWindows, setPipelineState, loadReport]
  );

  const formatElapsed = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const isRunning =
    pipelineData?.status === "running" || pipelineData?.status === "pending";

  const estimatedTimeRemaining = useMemo(() => {
    if (!isRunning || elapsedSeconds === 0) return null;
    const currentStage = pipelineData?.current_stage || 0;
    if (currentStage === 0) return null;
    const totalStages = 7;
    const avgTimePerStage = elapsedSeconds / currentStage;
    const remainingStages = totalStages - currentStage;
    return Math.round(avgTimePerStage * remainingStages);
  }, [elapsedSeconds, isRunning, pipelineData?.current_stage]);
  const isCompleted = pipelineData?.status === "completed";
  const isFailed = pipelineData?.status === "failed";
  const isCancelled = pipelineData?.status === "cancelled";
  const isInterrupted = pipelineData?.status === "interrupted";
  const isDone = isCompleted || isFailed || isCancelled || isInterrupted;

  const progress =
    pipelineData?.current_stage > 0
      ? Math.round((pipelineData.current_stage / 7) * 100)
      : 0;
  const stageNowMs = runStartedAtMs ? runStartedAtMs + elapsedSeconds * 1000 : null;

  return (
    <div className="py-6 px-4 sm:px-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Auto-Quant Factory</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Fully automated 7-stage strategy optimization — sanity check, hyperopt,
            parameter injection, OOS validation, stress test, risk assessment, and delivery.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleNotif}
          title={notifEnabled ? "Notifications on — click to disable" : "Enable run notifications"}
          className={`btn btn-sm btn-circle shrink-0 mt-0.5 transition-all ${
            notifEnabled
              ? "btn-primary shadow-sm shadow-primary/30"
              : "btn-ghost text-base-content/40 hover:text-base-content/70"
          }`}
        >
          🔔
        </button>
      </div>

      {/* Config form + Recent Runs */}
      {!pipelineData && (
        <>
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-5 space-y-5">
            <h2 className="text-sm font-semibold">Pipeline Configuration</h2>

            {/* ── Section: Robustness-First Settings (NEW) ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
                Robustness-First Settings
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Trading Style */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs font-medium">Trading Style</span>
                  </label>
                  <select
                    className="select select-bordered select-sm"
                    value={form.trading_style}
                    onChange={(e) => updateField("trading_style", e.target.value)}
                  >
                    <option value="scalping">Scalping (1m-5m)</option>
                    <option value="intraday">Intraday (5m-30m)</option>
                    <option value="swing">Swing (1h-4h)</option>
                    <option value="position">Position (1d+)</option>
                  </select>
                  <label className="label py-0.5">
                    <span className="label-text-alt text-base-content/40">
                      Auto-selects timeframe & thresholds
                    </span>
                  </label>
                </div>

                {/* Risk Profile */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs font-medium">Risk Profile</span>
                  </label>
                  <select
                    className="select select-bordered select-sm"
                    value={form.risk_profile}
                    onChange={(e) => updateField("risk_profile", e.target.value)}
                  >
                    <option value="conservative">Conservative (low risk)</option>
                    <option value="balanced">Balanced (moderate risk)</option>
                    <option value="aggressive">Aggressive (high risk)</option>
                  </select>
                  <label className="label py-0.5">
                    <span className="label-text-alt text-base-content/40">
                      Adjusts drawdown & profit factor gates
                    </span>
                  </label>
                </div>

                {/* Analysis Depth */}
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs font-medium">Analysis Depth</span>
                  </label>
                  <select
                    className="select select-bordered select-sm"
                    value={form.analysis_depth}
                    onChange={(e) => updateField("analysis_depth", e.target.value)}
                  >
                    <option value="quick">Quick (3 months IS)</option>
                    <option value="standard">Standard (6 months IS)</option>
                    <option value="deep">Deep (12 months IS)</option>
                  </select>
                  <label className="label py-0.5">
                    <span className="label-text-alt text-base-content/40">
                      Sets date ranges & hyperopt epochs
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* ── Section: Strategy ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
                Strategy
              </p>
              <div className="form-control">
                <div className="flex gap-2 items-start flex-wrap">
                  {strategiesLoading ? (
                    <div className="skeleton h-9 flex-1 rounded-lg" />
                  ) : (
                    <select
                      className="select select-bordered select-sm flex-1"
                      value={form.strategy}
                      onChange={(e) => updateField("strategy", e.target.value)}
                    >
                      <option value="">Select strategy...</option>
                      {strategyList.map((s) => (
                        <option key={s.strategy_name} value={s.strategy_name}>
                          {s.strategy_name}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    className="select select-bordered select-sm shrink-0"
                    value={templateType}
                    onChange={(e) => setTemplateType(e.target.value)}
                    disabled={isGenerating}
                    title="Choose which strategy template to generate"
                  >
                    <option value="omni">⚡ Omni-Strategy (Boolean Switches)</option>
                    <option value="catfactory">CatFactory (MACD/RSI/BB)</option>
                    <option value="adaptive">Adaptive Regime (ATR)</option>
                    <option value="ensemble">Ensemble (Weighted Voting)</option>
                    <option value="momentum">Momentum (EMA + ATR)</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-1.5 shrink-0"
                    onClick={handleGenerateTemplate}
                    disabled={isGenerating}
                    title="Generate the selected strategy template"
                  >
                    {isGenerating ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      "✦"
                    )}
                    Generate
                  </button>
                </div>
                {generateStatus && (
                  <div
                    className={`mt-1.5 text-xs px-2 py-1 rounded ${
                      generateStatus.ok
                        ? "text-success bg-success/10"
                        : "text-error bg-error/10"
                    }`}
                  >
                    {generateStatus.message}
                  </div>
                )}
              </div>
            </div>

            {/* ── Section: Advanced Settings (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <span>Advanced Settings</span>
                <span className="text-base-content/40 text-[10px]">
                  {showAdvanced ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showAdvanced && (
                <div className="px-4 pb-4 pt-3 bg-base-300/30 space-y-5">
                  {/* ── Subsection: Time Ranges & Exchange ── */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
                      Time Ranges &amp; Exchange
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Timeframe */}
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Timeframe</span>
                          {timeframeProfile && (
                            <span className={`label-text-alt badge badge-xs font-semibold ${
                              timeframeProfile.profile === "Scalping" ? "badge-warning" :
                              timeframeProfile.profile === "Intraday" ? "badge-info" :
                              timeframeProfile.profile === "Swing"    ? "badge-primary" :
                              timeframeProfile.profile === "Position" ? "badge-secondary" :
                              "badge-ghost"
                            }`}>
                              {timeframeProfile.profile}
                            </span>
                          )}
                        </label>
                        <select
                          className="select select-bordered select-sm"
                          value={form.timeframe}
                          onChange={(e) => updateField("timeframe", e.target.value)}
                        >
                          {["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"].map((tf) => (
                            <option key={tf} value={tf}>{tf}</option>
                          ))}
                        </select>
                        {timeframeProfile && (
                          <label className="label py-0.5">
                            <span className="label-text-alt text-base-content/40">
                              {timeframeProfile.description} — thresholds auto-applied
                            </span>
                          </label>
                        )}
                      </div>

                      {/* Exchange */}
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Exchange</span>
                        </label>
                        <select
                          className="select select-bordered select-sm"
                          value={form.exchange}
                          onChange={(e) => updateField("exchange", e.target.value)}
                        >
                          {["binance", "bybit", "kraken", "kucoin", "okx", "gate"].map((ex) => (
                            <option key={ex} value={ex}>{ex}</option>
                          ))}
                        </select>
                      </div>

                      {/* In-sample range */}
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">In-Sample Timerange</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered input-sm font-mono"
                          placeholder="20230101-20240101"
                          value={form.in_sample_range}
                          onChange={(e) => updateField("in_sample_range", e.target.value)}
                        />
                        <label className="label py-0.5">
                          {(() => {
                            try {
                              const [s, e] = form.in_sample_range.split("-");
                              if (s?.length === 8 && e?.length === 8) {
                                const d1 = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`);
                                const d2 = new Date(`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`);
                                const days = Math.round((d2 - d1) / 86400000);
                                const months = (days / 30).toFixed(0);
                                if (days < 90) return <span className="label-text-alt text-error">⚠ {days} days — too short, expect overfitting</span>;
                                if (days < 180) return <span className="label-text-alt text-warning">⚠ {days} days ({months} mo) — recommend 6+ months</span>;
                                return <span className="label-text-alt text-success">✓ {days} days (~{months} months)</span>;
                              }
                            } catch (err) {
                              console.debug("Failed to parse in-sample range:", err);
                            }
                            return <span className="label-text-alt text-base-content/40">Used for sanity backtest &amp; hyperopt</span>;
                          })()}
                        </label>
                      </div>

                      {/* OOS range */}
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Out-of-Sample Timerange</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered input-sm font-mono"
                          placeholder="20240101-20241201"
                          value={form.out_sample_range}
                          onChange={(e) => updateField("out_sample_range", e.target.value)}
                        />
                        <label className="label py-0.5">
                          <span className="label-text-alt text-base-content/40">
                            Never seen by hyperopt — tests for overfitting
                          </span>
                        </label>
                      </div>

                      {/* Pair Universe (for Omni-Strategy multi-pair backtesting) */}
                      <div className="form-control sm:col-span-2">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Pair Universe</span>
                          <span className="label-text-alt text-[10px] text-base-content/40">for multi-pair filtering</span>
                        </label>
                        <textarea
                          className="textarea textarea-bordered textarea-sm font-mono text-xs leading-relaxed"
                          rows={2}
                          placeholder="BTC/USDT, ETH/USDT, SOL/USDT, ... (leave blank for default Top 50)"
                          value={form.pair_universe}
                          onChange={(e) => updateField("pair_universe", e.target.value)}
                        />
                        <label className="label py-0.5">
                          <div className="flex items-center justify-between w-full">
                            <span className="label-text-alt text-base-content/40">
                              {form.pair_universe
                                ? `${form.pair_universe.split(',').length} custom pairs configured`
                                : "Using default Top 50 USDT pairs by volume"}
                            </span>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost text-[10px] gap-1"
                              onClick={() => {
                                const defaultPairs = "BTC/USDT,ETH/USDT,BNB/USDT,SOL/USDT,XRP/USDT,ADA/USDT,DOGE/USDT,AVAX/USDT,DOT/USDT,MATIC/USDT,LINK/USDT,UNI/USDT,ATOM/USDT,LTC/USDT,ETC/USDT,FIL/USDT,NEAR/USDT,ALGO/USDT,VET/USDT,ICP/USDT,OP/USDT,ARB/USDT,PEPE/USDT,SHIB/USDT,RNDR/USDT,INJ/USDT,APT/USDT,QNT/USDT,AAVE/USDT,MKR/USDT,CRV/USDT,COMP/USDT,YFI/USDT,SNX/USDT,KAVA/USDT,ROSE/USDT,FTM/USDT,GLM/USDT,GRT/USDT,LDO/USDT,FXS/USDT,PENDLE/USDT,GMX/USDT,GALA/USDT,SAND/USDT,MANA/USDT,AXS/USDT,ENJ/USDT,IMX/USDT,SUI/USDT";
                                updateField("pair_universe", defaultPairs);
                              }}
                            >
                              📋 Load Default Top 50
                            </button>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Section: Screen Pairs (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowScreener((v) => !v)}
              >
                <span className="flex items-center gap-2">
                  🔬 Screen Pairs
                  {selectedPair && (
                    <span className="badge badge-xs badge-primary">{selectedPair}</span>
                  )}
                </span>
                <span className="text-base-content/40 text-[10px]">
                  {showScreener ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showScreener && (
                <div className="px-4 pb-4 pt-3 bg-base-300/30 space-y-3">
                  <p className="text-[10px] text-base-content/50 leading-relaxed">
                    Run quick backtests across a list of pairs to find the most profitable for your strategy. Uses the In-Sample timerange. Click any result row to select that pair.
                  </p>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Pairs to Screen</span>
                      <span className="label-text-alt text-[10px] text-base-content/40">comma-separated</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered textarea-sm font-mono text-xs leading-relaxed"
                      rows={2}
                      placeholder="BTC/USDT, ETH/USDT, SOL/USDT, ..."
                      value={screenPairs}
                      onChange={(e) => setScreenPairs(e.target.value)}
                      disabled={screening}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline gap-2 w-full"
                    onClick={handleScreenPairs}
                    disabled={screening || !form.strategy || !screenPairs.trim()}
                    title={!form.strategy ? "Select a strategy first" : ""}
                  >
                    {screening ? (
                      <>
                        <span className="loading loading-spinner loading-xs" />
                        Screening pairs…
                      </>
                    ) : (
                      <>🔬 Screen Pairs</>
                    )}
                  </button>

                  {screenError && (
                    <div className="text-xs text-warning bg-warning/10 border border-warning/20 rounded px-3 py-2">
                      ⚠ {screenError}
                    </div>
                  )}

                  {screenResults.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-base-300">
                      <table className="table table-xs w-full">
                        <thead>
                          <tr className="text-base-content/40 text-[9px] uppercase tracking-wider">
                            <th className="font-semibold">#</th>
                            <th className="font-semibold">Pair</th>
                            <th className="font-semibold text-right">Profit %</th>
                            <th className="font-semibold text-right">Trades</th>
                            <th className="font-semibold text-right">Win Rate</th>
                            <th className="font-semibold text-right">Max DD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {screenResults.map((row, i) => (
                            <tr
                              key={row.pair}
                              className={`cursor-pointer hover:bg-primary/10 transition-colors text-xs ${
                                selectedPair === row.pair
                                  ? "bg-primary/15 border-l-2 border-l-primary"
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedPair(row.pair);
                                updateField("pair_universe", row.pair);
                              }}
                              title="Click to select this pair and populate the Pair Universe field"
                            >
                              <td className="font-mono text-base-content/40 text-[10px]">{i + 1}</td>
                              <td className="font-semibold">
                                {selectedPair === row.pair && (
                                  <span className="mr-1 text-primary text-[10px]">▶</span>
                                )}
                                {row.pair}
                              </td>
                              <td className={`text-right font-mono font-bold ${
                                row.profit_pct == null
                                  ? "text-base-content/30"
                                  : row.profit_pct >= 0
                                  ? "text-success"
                                  : "text-error"
                              }`}>
                                {row.profit_pct == null
                                  ? "—"
                                  : `${row.profit_pct >= 0 ? "+" : ""}${row.profit_pct}%`}
                              </td>
                              <td className="text-right font-mono text-base-content/60">
                                {row.trade_count ?? "—"}
                              </td>
                              <td className={`text-right font-mono ${
                                row.win_rate == null
                                  ? "text-base-content/30"
                                  : row.win_rate >= 50
                                  ? "text-success"
                                  : "text-error"
                              }`}>
                                {row.win_rate == null ? "—" : `${row.win_rate}%`}
                              </td>
                              <td className={`text-right font-mono ${
                                row.max_dd == null
                                  ? "text-base-content/30"
                                  : row.max_dd > 20
                                  ? "text-error"
                                  : row.max_dd > 10
                                  ? "text-warning"
                                  : "text-base-content/60"
                              }`}>
                                {row.max_dd == null ? "—" : `${row.max_dd}%`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {screenResults.length === 0 && !screening && !screenError && (
                    <div className="text-center py-3 text-xs text-base-content/35 italic">
                      Results appear here after screening runs.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Section: Hyperopt Settings (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowHyperopt((v) => !v)}
              >
                <span>Hyperopt Settings</span>
                <span className="text-base-content/40 text-[10px]">
                  {showHyperopt ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showHyperopt && (
                <div className="px-4 pb-4 pt-3 bg-base-300/30 space-y-4">
                  {/* Loss Function */}
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Loss Function</span>
                    </label>
                    <select
                      className="select select-bordered select-sm"
                      value={form.hyperopt_loss}
                      onChange={(e) => updateField("hyperopt_loss", e.target.value)}
                    >
                      <option value="ProfitLockinHyperOptLoss">ProfitLockinHyperOptLoss — locks in high-profit trades (recommended)</option>
                      <option value="SharpeHyperOptLoss">SharpeHyperOptLoss — stable returns, low risk</option>
                      <option value="SortinoHyperOptLoss">SortinoHyperOptLoss — penalises downside volatility only</option>
                      <option value="CalmarHyperOptLoss">CalmarHyperOptLoss — return / max drawdown ratio</option>
                      <option value="MaxDrawDownRelativeHyperOptLoss">MaxDrawDownRelativeHyperOptLoss — minimise drawdown first</option>
                      <option value="OnlyProfitHyperOptLoss">OnlyProfitHyperOptLoss — maximise profit (overfits easily)</option>
                    </select>
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">
                        Sharpe / Sortino / Calmar reduce overfitting vs pure profit optimisation
                      </span>
                    </label>
                  </div>

                  {/* Search Spaces */}
                  {(() => {
                    const SPACE_META = {
                      buy:        { description: "Entry signal thresholds — indicator levels that trigger a buy", costMultiplier: "2×" },
                      sell:       { description: "Exit signal thresholds — indicator levels that trigger a sell", costMultiplier: "2×" },
                      roi:        { description: "Minimum return targets per time bucket", costMultiplier: "1×" },
                      stoploss:   { description: "Fixed stop-loss percentage below entry price", costMultiplier: "1×" },
                      trailing:   { description: "Trailing stop offset that follows price upward", costMultiplier: "1×" },
                      protection: { description: "Cooldown & stoploss-guard rules after losing trades", costMultiplier: "3×" },
                    };
                    const PRESETS = [
                      { label: "Fast",      spaces: ["stoploss", "roi"],               epochs: 50,  title: "Stoploss + ROI — quick result, low overfit risk" },
                      { label: "Balanced",  spaces: ["buy", "roi", "stoploss"],         epochs: 100, title: "Buy + ROI + Stoploss — good starting point" },
                      { label: "Thorough",  spaces: Object.keys(SPACE_META),            epochs: 200, title: "All spaces — best results but takes longest" },
                    ];
                    return (
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Search Spaces</span>
                        </label>

                        {/* Preset buttons */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {PRESETS.map((preset) => {
                            const active =
                              preset.spaces.length === form.hyperopt_spaces.length &&
                              preset.spaces.every((s) => form.hyperopt_spaces.includes(s)) &&
                              form.hyperopt_epochs === preset.epochs;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                title={preset.title}
                                className={`btn btn-xs gap-1 ${active ? "btn-primary" : "btn-outline"}`}
                                onClick={() => {
                                  updateField("hyperopt_spaces", preset.spaces);
                                  updateField("hyperopt_epochs", preset.epochs);
                                }}
                              >
                                {preset.label}
                                <span className="opacity-60 font-normal">{preset.epochs} ep</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Card grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(SPACE_META).map(([space, meta]) => {
                            const active = form.hyperopt_spaces.includes(space);
                            return (
                              <button
                                key={space}
                                type="button"
                                onClick={() => toggleSpace(space)}
                                className={`text-left rounded-lg border px-3 py-2.5 transition-all cursor-pointer select-none ${
                                  active
                                    ? "border-primary bg-primary/10 shadow-sm"
                                    : "border-base-300 bg-base-200/50 hover:border-base-content/30"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs font-mono font-semibold ${active ? "text-primary" : "text-base-content/70"}`}>
                                    {space}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    active ? "bg-primary/20 text-primary" : "bg-base-300 text-base-content/50"
                                  }`}>
                                    {meta.costMultiplier}
                                  </span>
                                </div>
                                <p className="text-[10px] leading-snug text-base-content/50">
                                  {meta.description}
                                </p>
                              </button>
                            );
                          })}
                        </div>

                        <label className="label py-0.5 mt-1">
                          {form.hyperopt_spaces.length === 0 ? (
                            <span className="label-text-alt text-error">Select at least one space</span>
                          ) : form.hyperopt_spaces.length <= 2 ? (
                            <span className="label-text-alt text-success">✓ Fewer spaces = less overfitting</span>
                          ) : form.hyperopt_spaces.length >= 4 ? (
                            <span className="label-text-alt text-warning">⚠ Many spaces increases overfitting risk</span>
                          ) : (
                            <span className="label-text-alt text-base-content/40">More spaces = more parameters to optimise</span>
                          )}
                        </label>
                      </div>
                    );
                  })()}

                  {/* Epochs */}
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Epochs</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-32"
                      min={10}
                      max={1000}
                      step={10}
                      value={form.hyperopt_epochs}
                      onChange={(e) => updateField("hyperopt_epochs", parseInt(e.target.value, 10) || 100)}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">
                        More epochs find better parameters but take longer. 100–200 is a good balance.
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* ── Section: Walk-Forward Optimization (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowWfo((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <span>Walk-Forward Optimization</span>
                  {form.wfo_enabled && (
                    <span className="badge badge-primary badge-xs">ON</span>
                  )}
                </div>
                <span className="text-base-content/40 text-[10px]">
                  {showWfo ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showWfo && (
                <div className="px-4 pb-4 pt-3 bg-base-300/30 space-y-4">
                  <p className="text-[10px] text-base-content/40 leading-relaxed">
                    Instead of a single hyperopt pass, WFO rolls (IS, OOS) windows over the in-sample
                    range — fitting on each IS period and validating on the matching OOS period.
                    Final strategy parameters come from the most recent successful window.
                  </p>

                  {/* Toggle */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="toggle toggle-sm toggle-primary"
                      checked={form.wfo_enabled}
                      onChange={(e) => updateField("wfo_enabled", e.target.checked)}
                      id="wfo-toggle"
                    />
                    <label htmlFor="wfo-toggle" className="text-xs font-medium cursor-pointer">
                      {form.wfo_enabled ? "Walk-Forward enabled" : "Walk-Forward disabled (standard hyperopt)"}
                    </label>
                  </div>

                  {form.wfo_enabled && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">IS Window (months)</span>
                        </label>
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          min={1}
                          max={24}
                          step={1}
                          value={form.wfo_is_months}
                          onChange={(e) => updateField("wfo_is_months", parseInt(e.target.value, 10) || 3)}
                        />
                        <label className="label py-0.5">
                          <span className="label-text-alt text-base-content/40">Training window size</span>
                        </label>
                      </div>

                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">OOS Window (months)</span>
                        </label>
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          min={1}
                          max={6}
                          step={1}
                          value={form.wfo_oos_months}
                          onChange={(e) => updateField("wfo_oos_months", parseInt(e.target.value, 10) || 1)}
                        />
                        <label className="label py-0.5">
                          <span className="label-text-alt text-base-content/40">Validation step size</span>
                        </label>
                      </div>

                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs font-medium">Recency Weight</span>
                        </label>
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          min={1.0}
                          max={3.0}
                          step={0.1}
                          value={form.wfo_recency_weight}
                          onChange={(e) => updateField("wfo_recency_weight", parseFloat(e.target.value) || 1.0)}
                        />
                        <label className="label py-0.5">
                          <span className="label-text-alt text-base-content/40">1.0 = equal weight, &gt;1 favours recent</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {form.wfo_enabled && form.in_sample_range && (() => {
                    const parts = form.in_sample_range.split("-");
                    if (parts.length !== 2) return null;
                    const start = new Date(parts[0].replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));
                    const end   = new Date(parts[1].replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));
                    const totalMonths = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30));
                    const windowSize = form.wfo_is_months + form.wfo_oos_months;
                    const approxWindows = totalMonths >= windowSize
                      ? Math.floor((totalMonths - form.wfo_is_months) / form.wfo_oos_months)
                      : 0;
                    return (
                      <div className={`text-[10px] px-3 py-2 rounded ${
                        approxWindows >= 2
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }`}>
                        {approxWindows >= 2
                          ? `≈ ${approxWindows} rolling windows from your IS range (${totalMonths}m total)`
                          : `⚠ Too few windows (≈${approxWindows}) — increase IS range or reduce window sizes. Need ≥2 windows.`}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── Section: Alpha Consensus Voting (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowEnsemble((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <span>Alpha Consensus Voting</span>
                  {form.ensemble_enabled && (
                    <span className="badge badge-secondary badge-xs">ON</span>
                  )}
                </div>
                <span className="text-base-content/40 text-[10px]">
                  {showEnsemble ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showEnsemble && (
                <div className="px-4 pb-4 pt-3 bg-base-300/30 space-y-4">
                  <p className="text-[10px] text-base-content/40 leading-relaxed">
                    Instead of a single entry signal, the Ensemble strategy computes RSI, MACD, and BB
                    signals simultaneously. Each signal is assigned a weight; the normalized weighted
                    score must exceed a tunable consensus threshold to trigger an entry. Hyperopt
                    discovers the best weights — including setting a weight to 0 to switch a signal off.
                    Weights can also be updated live via <span className="font-mono">user_data/ensemble_weights.json</span>.
                  </p>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="toggle toggle-sm toggle-secondary"
                      checked={form.ensemble_enabled}
                      onChange={(e) => updateField("ensemble_enabled", e.target.checked)}
                      id="ensemble-toggle"
                    />
                    <label htmlFor="ensemble-toggle" className="text-xs font-medium cursor-pointer">
                      {form.ensemble_enabled
                        ? "Alpha Consensus Voting enabled — generates EnsembleFactory"
                        : "Alpha Consensus Voting disabled (single-signal CatFactory)"}
                    </label>
                  </div>

                  {form.ensemble_enabled && (
                    <div className="rounded-lg bg-secondary/10 border border-secondary/25 px-3 py-3 space-y-2">
                      <p className="text-[10px] font-semibold text-secondary/80 uppercase tracking-wider">
                        Default alpha weights (hyperopt will optimise these)
                      </p>
                      <div className="grid grid-cols-3 gap-3 text-[11px]">
                        {[
                          { label: "RSI Oversold", color: "bg-blue-400", default: "0.40" },
                          { label: "MACD Cross",   color: "bg-violet-400", default: "0.30" },
                          { label: "BB Breakout",  color: "bg-amber-400", default: "0.30" },
                        ].map(({ label, color, default: def }) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                            <span className="text-base-content/60">{label}</span>
                            <span className="ml-auto font-mono text-base-content/50">{def}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-base-content/35">
                        Consensus threshold: 0.50 (default) — score = Σ(vote × weight) / Σ(weight)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Section: Risk Thresholds (collapsible) ── */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-base-content/70 hover:bg-base-300 transition-colors"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <span>Risk Thresholds</span>
                <span className="text-base-content/40 text-[10px]">
                  {showAdvanced ? "▲ collapse" : "▼ expand"}
                </span>
              </button>

              {showAdvanced && (
                <div className="px-4 pb-4 pt-2 bg-base-300/30 grid grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Max Drawdown (%)</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      min={1}
                      max={100}
                      step={1}
                      value={form.max_drawdown_threshold}
                      onChange={(e) => updateField("max_drawdown_threshold", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">Default: 30%</span>
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Min Win Rate (%)</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      min={0}
                      max={100}
                      step={1}
                      value={form.min_win_rate}
                      onChange={(e) => updateField("min_win_rate", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">Default: 40%</span>
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Min Profit Factor</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      min={0}
                      step={0.1}
                      value={form.min_profit_factor}
                      onChange={(e) => updateField("min_profit_factor", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">Default: 1.0</span>
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Min Sharpe Ratio</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      min={0}
                      step={0.1}
                      value={form.min_sharpe}
                      onChange={(e) => updateField("min_sharpe", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">Default: 0.5</span>
                    </label>
                  </div>

                  <div className="form-control col-span-2">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Min OOS Profit (fraction)</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-40"
                      min={-1}
                      step={0.01}
                      value={form.min_oos_profit}
                      onChange={(e) => updateField("min_oos_profit", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">
                        Stage 4 gate — strategy retries if OOS profit falls below this value. Default: 0.0 (break-even). Use 0.02 to require ≥2% profit.
                      </span>
                    </label>
                  </div>

                  <div className="form-control col-span-2">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">MC p95 Drawdown Limit (fraction)</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-40"
                      min={0.01}
                      max={1}
                      step={0.01}
                      value={form.monte_carlo_threshold}
                      onChange={(e) => updateField("monte_carlo_threshold", parseFloat(e.target.value))}
                    />
                    <label className="label py-0.5">
                      <span className="label-text-alt text-base-content/40">
                        Stage 6 Monte Carlo gate — pipeline fails if the p95 worst-case drawdown exceeds this fraction. Default: 0.35 (35%). Use 0.20 for a tighter conservative limit.
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                className="btn btn-primary btn-sm gap-2"
                onClick={handleStart}
                disabled={!form.strategy || isConnecting}
              >
                {isConnecting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "▶"
                )}
                Start Auto-Quant
              </button>
            </div>
          </div>
        </div>

        {/* Run History Dashboard */}
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-5">
            <h2 className="text-sm font-semibold mb-3">Run History</h2>
            <RunHistoryDashboard
              ref={runHistoryRef}
              onLoad={handleLoadRun}
            />
          </div>
        </div>
        </>
      )}

      {/* Real-Time Optimization Dashboard */}
      {pipelineData && (
        <div className="space-y-4">

          {/* ── Dashboard header bar ── */}
          <div className="card bg-base-200 border border-base-300">
            <div className="card-body p-4">
              <div className="flex items-center gap-4">
                {/* Status indicator */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isRunning ? "bg-primary animate-pulse" :
                  isCompleted ? "bg-success" :
                  isFailed ? "bg-error" :
                  isInterrupted ? "bg-warning" :
                  isCancelled ? "bg-warning" :
                  "bg-base-content/30"
                }`} />

                {/* Run info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold truncate">{pipelineData.strategy}</span>
                    {pipelineData.timeframe && (
                      <span className="badge badge-xs badge-ghost font-mono">{pipelineData.timeframe}</span>
                    )}
                    {pipelineData.exchange && (
                      <span className="badge badge-xs badge-ghost">{pipelineData.exchange}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-base-content/50">
                      {isRunning
                        ? `Stage ${pipelineData.current_stage}/7 — ${STAGE_NAMES[pipelineData.current_stage - 1] || "Starting..."}`
                        : isCompleted ? "✓ Pipeline Completed"
                        : isFailed ? "✗ Pipeline Failed"
                        : isInterrupted ? "⚠ Pipeline Interrupted"
                        : isCancelled ? "⚠ Pipeline Cancelled"
                        : "Starting..."}
                    </span>
                    {isRunning && elapsedSeconds > 0 && (
                      <span className="text-sm font-bold text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">
                        ⏱ {formatElapsed(elapsedSeconds)}
                      </span>
                    )}
                    {isRunning && estimatedTimeRemaining != null && estimatedTimeRemaining > 0 && (
                      <span className="text-xs text-base-content/60 font-mono">
                        ≈ {formatElapsed(estimatedTimeRemaining)} remaining
                      </span>
                    )}
                    {hyperoptProgress && isRunning && (
                      <span className="text-xs text-primary/70 font-mono">
                        ⚡ Epoch {hyperoptProgress.current}/{hyperoptProgress.total || "?"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress % */}
                <span className={`text-lg font-bold shrink-0 ${
                  isCompleted ? "text-success" :
                  isFailed ? "text-error" :
                  isInterrupted ? "text-warning" :
                  isCancelled ? "text-warning" :
                  "text-primary"
                }`}>{isCompleted ? 100 : progress}%</span>

                {/* Action buttons */}
                <div className="flex gap-2 shrink-0">
                  {isRunning && (
                    <button
                      className="btn btn-error btn-sm gap-1.5"
                      onClick={handleCancel}
                    >
                      ■ Stop
                    </button>
                  )}
                  {isDone && (
                    <button className="btn btn-outline btn-sm gap-1.5" onClick={handleReset}>
                      ↩ New Run
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <progress
                  className={`progress w-full h-1.5 ${
                    isCompleted ? "progress-success" :
                    isFailed ? "progress-error" :
                    isInterrupted ? "progress-warning" :
                    isCancelled ? "progress-warning" :
                    "progress-primary"
                  }`}
                  value={isCompleted ? 100 : progress}
                  max={100}
                />
              </div>
            </div>
          </div>

          {/* ── Main dashboard grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Left: Stage Pipeline Tracker */}
            <div className="lg:col-span-1">
              <div className="card bg-base-200 border border-base-300 h-full">
                <div className="card-body p-4">
                  <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>Pipeline Stages</span>
                    {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                  </h3>
                  
                  {/* Pre-Flight Filtering (Data Healing) Status */}
                  {dataHealingStatus && (
                    <div className="mb-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider flex items-center gap-1.5">
                          🔬 Pre-Flight Filtering
                          {dataHealingStatus.in_progress && (
                            <span className="loading loading-spinner loading-xs text-primary" />
                          )}
                        </span>
                        <span className="text-[10px] text-base-content/50 font-mono">
                          {dataHealingStatus.surviving_pairs != null
                            ? `${dataHealingStatus.surviving_pairs}/${dataHealingStatus.total_pairs} pairs`
                            : `${dataHealingStatus.total_pairs} pairs`}
                        </span>
                      </div>
                      
                      {/* Real-time pair status table */}
                      {Object.keys(pairStatusMap).length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {Object.entries(pairStatusMap).slice(-10).map(([pair, status]) => (
                            <div key={pair} className="flex items-center justify-between text-[10px]">
                              <span className="font-mono text-base-content/70">{pair}</span>
                              <span className={`font-medium ${
                                status.status === "downloading" ? "text-primary animate-pulse" :
                                status.status === "healed" ? "text-success" :
                                status.status === "evicted" ? "text-error" :
                                "text-base-content/50"
                              }`}>
                                {status.status === "downloading" && "⬇ "}
                                {status.status === "healed" && "✓ "}
                                {status.status === "evicted" && "✗ "}
                                {status.status}
                                {status.reason && status.status === "evicted" && ` (${status.reason})`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Summary when complete */}
                      {!dataHealingStatus.in_progress && dataHealingStatus.surviving_pairs != null && (
                        <div className="mt-2 pt-2 border-t border-primary/10">
                          <span className="text-[10px] text-success/80">
                            ✓ Complete: {dataHealingStatus.surviving_pairs} pairs passed, {dataHealingStatus.evicted_pairs} evicted
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <AutoQuantStageStepper stages={pipelineData.stages || []} nowMs={stageNowMs} />
                </div>
              </div>
            </div>

            {/* Right: Live charts panel */}
            <div className="lg:col-span-2 flex flex-col gap-4">

              {/* Live Fitness Curve */}
              <div className="card bg-base-200 border border-base-300">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest flex items-center gap-2">
                      ⚡ Live Fitness Curve
                      {fitnessCurve.length > 0 && (
                        <span className="text-primary/60 normal-case tracking-normal font-normal">
                          ({fitnessCurve.length} epochs)
                        </span>
                      )}
                    </h3>
                    {hyperoptProgress && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-base-content/40 font-mono">
                          {hyperoptProgress.current}/{hyperoptProgress.total || "?"} epochs
                        </span>
                        {isRunning && pipelineData.current_stage === 2 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                      </div>
                    )}
                  </div>
                  <AutoQuantLiveFitnessCurve
                    data={fitnessCurve}
                    hyperoptProgress={hyperoptProgress}
                  />
                </div>
              </div>

              {/* Trade Distribution Chart */}
              {(pipelineData?.stages?.[0]?.data?.trade_distribution || pipelineData?.stages?.[3]?.data?.trade_distribution) && (
                <div className="card bg-base-200 border border-base-300">
                  <div className="card-body p-4">
                    <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest mb-3">
                      📊 Trade Distribution
                    </h3>
                    <AutoQuantTradeDistributionChart 
                      tradeDistribution={pipelineData?.stages?.[3]?.data?.trade_distribution || pipelineData?.stages?.[0]?.data?.trade_distribution}
                    />
                  </div>
                </div>
              )}

              {/* Candidate Leaderboard */}
              {fitnessCurve.length > 0 && (() => {
                const sorted = [...fitnessCurve]
                  .sort((a, b) => b.profit_usdt - a.profit_usdt)
                  .slice(0, 5);
                return (
                  <div className="card bg-base-200 border border-base-300">
                    <div className="card-body p-4">
                      <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest mb-3">
                        🏆 Top Candidates
                      </h3>
                      <div className="text-xs text-base-content/50 italic">
                        CandidateLeaderboard component extracted to separate file
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Robustness Badge (live — shown once sensitivity check completes) */}
              {pipelineData?.sensitivity && (
                <div className="card bg-base-200 border border-base-300">
                  <div className="card-body p-4">
                    <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest mb-2 flex items-center gap-2">
                      📈 Robustness Check
                    </h3>
                    <AutoQuantRobustnessBadge sensitivity={pipelineData.sensitivity} />
                  </div>
                </div>
              )}

              {/* WFO Windows Table */}
              {(pipelineData?.wfo_enabled || wfoWindows.length > 0) && (
                <div className="card bg-base-200 border border-base-300">
                  <div className="card-body p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest flex items-center gap-2">
                        📊 Walk-Forward Windows
                        {wfoWindows.length > 0 && (
                          <span className="text-primary/60 normal-case tracking-normal font-normal">
                            ({wfoWindows.length}/{pipelineData?.wfo_windows?.length || wfoWindows[0]?.total_windows || "?"} complete)
                          </span>
                        )}
                      </h3>
                      {wfoWindows.length > 0 && (() => {
                        const valid = wfoWindows.filter(w => w.profit != null);
                        const avg = valid.length > 0
                          ? (valid.reduce((s, w) => s + w.profit, 0) / valid.length).toFixed(2)
                          : null;
                        return avg != null ? (
                          <span className={`text-xs font-mono font-semibold ${parseFloat(avg) >= 0 ? "text-success" : "text-error"}`}>
                            avg {parseFloat(avg) >= 0 ? "+" : ""}{avg}%
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <AutoQuantWfoWindowsTable windows={wfoWindows} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Log Terminal ── */}
          <div className="card bg-base-200 border border-base-300">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest flex items-center gap-2">
                  ▶ Live Output
                  {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                </h3>
                <span className="text-[10px] text-base-content/30">{logLines.length} lines</span>
              </div>
              <div className="mb-2">
                <input
                  type="text"
                  className="input input-xs input-bordered w-full font-mono text-[11px] bg-base-300 border-base-content/15 placeholder:text-base-content/25"
                  placeholder="Filter log lines…"
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                />
              </div>
              <AutoQuantLogTerminal lines={logLines} filter={logFilter} />
            </div>
          </div>

          {/* ── Failure / interrupted / cancelled ── */}
          {isFailed && <AutoQuantFailureReport state={pipelineData} onRetryRelaxed={handleRetryRelaxed} />}

          {isInterrupted && <AutoQuantInterruptedReport state={pipelineData} />}

          {isCancelled && (
            <div className="alert alert-warning">
              <span className="text-sm">Pipeline was cancelled by user.</span>
            </div>
          )}

          {/* ── Final report ── */}
          {isCompleted && report && (
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body p-5">
                <h3 className="text-[10px] font-semibold text-base-content/50 uppercase tracking-widest mb-4">
                  ✓ Results &amp; Downloads
                </h3>
                <AutoQuantFinalReport report={report} runId={runId} strategy={pipelineData?.strategy || form.strategy} />
              </div>
            </div>
          )}

          {isCompleted && !report && (
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body p-5 flex items-center gap-3">
                <span className="loading loading-spinner loading-sm" />
                <span className="text-sm text-base-content/60">Loading report...</span>
                <button
                  className="btn btn-xs btn-ghost ml-auto"
                  onClick={() =>
                    loadReport(runId)
                      .then(setReport)
                      .catch((err) => console.error("Failed to load report:", err))
                  }
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
