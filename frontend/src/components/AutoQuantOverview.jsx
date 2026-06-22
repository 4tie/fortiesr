import { useState, useEffect, useRef, useCallback } from "react";
import { STAGE_NAMES } from "../features/autoquant/constants";
import AutoQuantConfigPanel from "../features/autoquant/components/AutoQuantConfigPanel";
import AutoQuantRunDashboard from "../features/autoquant/components/AutoQuantRunDashboard";
import useAutoQuantForm from "../features/autoquant/hooks/useAutoQuantForm";
import useAutoQuantPipeline from "../features/autoquant/hooks/useAutoQuantPipeline";
import useAutoQuantScreening from "../features/autoquant/hooks/useAutoQuantScreening";
import useAutoQuantStrategyGen from "../features/autoquant/hooks/useAutoQuantStrategyGen";
import useAutoQuantUI from "../features/autoquant/hooks/useAutoQuantUI";
import { parsePairUniverse } from "../features/autoquant/utils";

const AGENT_COLORS = {
  Orchestrator: "#A78BFA",
  Scout: "#7DD3FC",
  Scribe: "#F472B6",
  Reach: "#E879F9",
  Dev: "#A78BFA",
};

function Eyebrow() {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-2 h-2 rounded-full bg-mint pulse-mint" />
      <div className="h-px flex-1 bg-white/10" />
      <span className="font-mono text-xs text-mint tracking-wider">4TIE</span>
      <div className="h-px flex-1 bg-white/10" />
      <span className="font-mono text-[10px] text-muted">v1.1</span>
    </div>
  );
}

function PipelineStatsStrip({ pipelineState }) {
  const stats = pipelineState || {};
  
  const statsArray = [
    { 
      label: 'Stage', 
      value: stats.current_stage !== undefined ? `${stats.current_stage + 1}/7` : '0/7', 
      color: 'mint', 
      subtext: stats.current_stage !== undefined ? STAGE_NAMES[stats.current_stage] : 'Not started' 
    },
    { 
      label: 'Progress', 
      value: `${stats.progress || 0}%`, 
      color: 'cyan', 
      subtext: stats.eta_seconds ? `${Math.floor(stats.eta_seconds / 60)}m remaining` : 'Calculating...' 
    },
    { 
      label: 'Pairs', 
      value: (stats.selected_pairs || []).length.toString(), 
      color: 'violet-glow', 
      subtext: `${(stats.winning_pairs || []).length} winning` 
    },
    { 
      label: 'Profit', 
      value: stats.thresholds?.min_oos_profit ? `${(stats.thresholds.min_oos_profit * 100).toFixed(1)}%` : '0%', 
      color: 'gold', 
      subtext: 'Min target' 
    },
    { 
      label: 'Drawdown', 
      value: `${stats.thresholds?.max_drawdown_threshold || 30}%`, 
      color: 'pink', 
      subtext: 'Max allowed' 
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {statsArray.map((stat) => (
        <div
          key={stat.label}
          className="glass-card p-4"
          style={{ borderTopColor: `var(--${stat.color})`, borderTopWidth: '2px' }}
        >
          <div className="font-mono text-[10px] text-muted mb-2">{stat.label}</div>
          <div
            className="font-medium"
            style={{ fontSize: 'clamp(24px, 2.4vw, 34px)', fontWeight: 500 }}
          >
            {stat.value}
          </div>
          <div className="font-mono text-[10px] text-muted mt-1">{stat.subtext}</div>
        </div>
      ))}
    </div>
  );
}

function PipelineProgress({ pipelineState }) {
  const canvasRef = useRef(null);
  const [progressData, setProgressData] = useState([]);

  useEffect(() => {
    if (!pipelineState || !pipelineState.stages) {
      setTimeout(() => setProgressData([]), 0);
      return;
    }

    // Convert stage progress to data points
    const data = pipelineState.stages.map(stage => {
      if (stage.status === 'completed') return 1.0;
      if (stage.status === 'running') return 0.5;
      if (stage.status === 'failed') return 0.2;
      return 0.0;
    });
    setTimeout(() => setProgressData(data), 0);
  }, [pipelineState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const data = progressData.length > 0 ? progressData : Array.from({ length: 7 }, () => 0);
      const maxVal = 1.0;

      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
      gradient.addColorStop(1, 'rgba(125, 211, 252, 0.1)');

      // Draw filled area
      ctx.beginPath();
      ctx.moveTo(0, height);
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (val / maxVal) * height * 0.8;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (val / maxVal) * height * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw dots at each stage
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (val / maxVal) * height * 0.8;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        
        // Color based on stage status
        if (pipelineState?.stages?.[i]?.status === 'completed') {
          ctx.fillStyle = '#7DD3FC';
        } else if (pipelineState?.stages?.[i]?.status === 'running') {
          ctx.fillStyle = '#F472B6';
        } else if (pipelineState?.stages?.[i]?.status === 'failed') {
          ctx.fillStyle = '#EF4444';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        }
        
        ctx.fill();
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    };

    draw();

    const interval = setInterval(() => {
      draw();
    }, 900);

    return () => clearInterval(interval);
  }, [progressData, pipelineState]);

  const completedStages = pipelineState?.stages?.filter(s => s.status === 'completed').length || 0;
  const totalStages = pipelineState?.stages?.length || 7;

  return (
    <div className="glass-card p-6">
      <div className="flex items-baseline gap-4 mb-4">
        <div
          className="font-bold text-cyan"
          style={{ fontSize: 'clamp(34px, 4vw, 56px)', fontWeight: 700 }}
        >
          {completedStages}/{totalStages}
        </div>
        <span className="text-muted text-[18px]">stages completed</span>
      </div>
      <canvas ref={canvasRef} width={400} height={100} className="w-full mb-2" />
      <div className="font-mono text-[10px] text-mint">
        {pipelineState?.status ? pipelineState.status.toUpperCase() : 'IDLE'}
      </div>
    </div>
  );
}

function PipelineEvents({ pipelineState }) {
  const [displayEvents, setDisplayEvents] = useState([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const getAgentForStage = (stageIndex) => {
    const agentMapping = {
      0: 'Scout',
      1: 'Dev',
      2: 'Dev',
      3: 'Reach',
      4: 'Scout',
      5: 'Orchestrator',
      6: 'Scribe'
    };
    return agentMapping[stageIndex] || 'Orchestrator';
  };

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    if (!pipelineState || !pipelineState.stages) {
      setTimeout(() => setDisplayEvents([]), 0);
      return;
    }

    // Convert stage events to display format
    const events = pipelineState.stages
      .filter(stage => stage.status !== 'pending')
      .map((stage, index) => ({
        agent: getAgentForStage(index),
        task: STAGE_NAMES[index],
        status: stage.status,
        timestamp: Date.now() - (pipelineState.stages.length - index) * 60000
      }))
      .reverse()
      .slice(0, 8);

    setTimeout(() => setDisplayEvents(events), 0);
  }, [pipelineState]);

  const formatTime = (timestamp) => {
    const diff = currentTime - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="glass-card p-6">
      <div className="font-mono text-[10px] text-muted mb-4">PIPELINE EVENTS</div>
      <div className="space-y-3">
        {displayEvents.map((event, index) => (
          <div
            key={index}
            className="flex items-center gap-3 text-sm transition-all duration-300"
            style={{
              opacity: 1 - index * 0.1,
              transform: `translateY(${index * 2}px)`,
            }}
          >
            <span
              className="font-mono text-[10px] px-2 py-0.5 rounded"
              style={{
                backgroundColor: `${AGENT_COLORS[event.agent]}20`,
                color: AGENT_COLORS[event.agent],
              }}
            >
              {event.agent}
            </span>
            <span className="text-text/80 flex-1 truncate">{event.task}</span>
            <span className={`font-mono text-[10px] ${
              event.status === 'completed' ? 'text-mint' : 
              event.status === 'running' ? 'text-cyan' : 
              event.status === 'failed' ? 'text-red' : 'text-muted'
            }`}>
              {event.status}
            </span>
            <span className="font-mono text-[10px] text-muted ml-auto">
              {formatTime(event.timestamp)}
            </span>
          </div>
        ))}
        {displayEvents.length === 0 && (
          <div className="text-muted text-sm">No pipeline events yet</div>
        )}
      </div>
    </div>
  );
}

export default function AutoQuantOverview({ strategies = [], strategiesLoading = false, onAgentContextChange = null, pipelineState: initialPipelineState = null }) {
  const formState = useAutoQuantForm();
  const pipeline = useAutoQuantPipeline(initialPipelineState);
  const strategyGen = useAutoQuantStrategyGen(strategies);
  const screening = useAutoQuantScreening();
  const uiState = useAutoQuantUI();
  const runHistoryRef = useRef(null);

  const { form, setForm } = formState;
  const {
    runId,
    setRunId,
    pipelineState,
    setPipelineState,
    setReport,
    setRunStartedAtMs,
    setWfoWindows,
    startPipeline,
    resumePipeline,
    cancelPipeline,
    loadReport,
    resetPipelineState,
  } = pipeline;

  useEffect(() => {
    if (!onAgentContextChange) return;
    onAgentContextChange({
      active_panel: pipelineState?.current_stage ? `stage-${pipelineState.current_stage}` : null,
      strategy_name: pipelineState?.strategy || form.strategy || null,
      auto_quant_run_id: runId,
      optimizer_session_id: null,
      backtest_run_id: null,
      api_session_id: null,
    });
  }, [form.strategy, onAgentContextChange, pipelineState?.current_stage, pipelineState?.strategy, runId]);

  const handleStart = async () => {
    if (!form.strategy) return;
    try {
      await startPipeline({
        ...form,
        pair_universe: parsePairUniverse(form.pair_universe),
      });
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
    resetPipelineState();
    setRunId(null);
    setPipelineState(null);
  };

  const handleReset = () => {
    resetPipelineState();
    setRunId(null);
    setPipelineState(null);
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
        stages:
          run.stages ||
          STAGE_NAMES.map((name, i) => ({
            index: i + 1,
            name,
            status: "pending",
            message: "",
            data: {},
          })),
        error: run.error || null,
        created_at: run.created_at,
        completed_at: run.completed_at,
        retry_history: run.retry_history || [],
        generalization_failure: run.generalization_failure || null,
        sensitivity: run.sensitivity || null,
        thresholds: run.thresholds || null,
        selected_pairs: run.selected_pairs || [],
        winning_pairs: run.winning_pairs || [],
        user_approved_pairs: run.user_approved_pairs || [],
        portfolio_baseline_result: run.portfolio_baseline_result || {},
        progress: run.progress ?? run.progress_percent ?? null,
        progress_percent: run.progress_percent ?? run.progress ?? null,
        eta_seconds: run.eta_seconds ?? null,
        progress_counters: run.progress_counters || {},
        validation_notes: run.validation_notes || [],
      });

      if (run.status === "completed" && !run.report) {
        loadReport(run.run_id).catch((err) => console.error("Failed to load report:", err));
      }
    },
    [loadReport, setPipelineState, setReport, setRunId, setRunStartedAtMs, setWfoWindows]
  );

  const hasActiveRun = Boolean(pipelineState);

  return (
    <div className="space-y-6">
      <Eyebrow />
      <PipelineStatsStrip pipelineState={pipelineState} />
      
      {!hasActiveRun && (
        <AutoQuantConfigPanel
          formState={formState}
          strategyGen={strategyGen}
          screening={screening}
          uiState={uiState}
          strategiesLoading={strategiesLoading}
          isConnecting={pipeline.isConnecting}
          runHistoryRef={runHistoryRef}
          onStart={handleStart}
          onLoadRun={handleLoadRun}
        />
      )}

      {hasActiveRun && (
        <AutoQuantRunDashboard
          form={form}
          pipelineState={pipelineState}
          runId={runId}
          logLines={pipeline.logLines}
          report={pipeline.report}
          setReport={setReport}
          fitnessCurve={pipeline.fitnessCurve}
          hyperoptProgress={pipeline.hyperoptProgress}
          elapsedSeconds={pipeline.elapsedSeconds}
          runStartedAtMs={pipeline.runStartedAtMs}
          wfoWindows={pipeline.wfoWindows}
          dataHealingStatus={pipeline.dataHealingStatus}
          pairStatusMap={pipeline.pairStatusMap}
          logFilter={uiState.logFilter}
          setLogFilter={uiState.setLogFilter}
          loadReport={loadReport}
          onResume={resumePipeline}
          onCancel={handleCancel}
          onReset={handleReset}
          onRetryRelaxed={handleRetryRelaxed}
        />
      )}

      <div className="grid grid-cols-[1.2fr_1fr] gap-6">
        <PipelineProgress pipelineState={pipelineState} />
        <PipelineEvents pipelineState={pipelineState} />
      </div>
    </div>
  );
}
