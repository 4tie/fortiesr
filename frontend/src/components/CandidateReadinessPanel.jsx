import { useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { api } from "../services/api.js";
import { buildReadinessAnalysisPrompt } from "../utils/aiAnalysis.js";

const GROUP_ORDER = ["Optimizer", "Backtest", "Validation", "Stress", "Pairs", "Exits"];

const STATUS_META = {
  ready: {
    label: "Ready",
    badge: "badge-success",
    progress: "progress-success",
    Icon: CheckCircleIcon,
  },
  watch: {
    label: "Watch",
    badge: "badge-warning",
    progress: "progress-warning",
    Icon: ExclamationTriangleIcon,
  },
  not_ready: {
    label: "Not Ready",
    badge: "badge-error",
    progress: "progress-error",
    Icon: XCircleIcon,
  },
  insufficient_data: {
    label: "Insufficient Data",
    badge: "badge-ghost",
    progress: "progress-neutral",
    Icon: QuestionMarkCircleIcon,
  },
};

const GATE_META = {
  pass: "badge-success",
  warn: "badge-warning",
  fail: "badge-error",
  missing: "badge-ghost",
};

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function compactObserved(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isInteger(value) ? `${value}` : value.toFixed(3);
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined)
      .slice(0, 3)
      .map(([key, item]) => `${key}: ${typeof item === "number" ? item.toFixed(3) : item}`)
      .join(", ");
  }
  return String(value);
}

function GateRow({ gate }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-base-300/60 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{gate.label}</span>
          {gate.blocking ? <span className="badge badge-error badge-xs">Blocking</span> : null}
        </div>
        <p className="mt-0.5 text-xs text-base-content/65">{gate.reason}</p>
        {compactObserved(gate.observed) ? (
          <p className="mt-1 truncate text-[11px] font-mono text-base-content/50" title={compactObserved(gate.observed)}>
            {compactObserved(gate.observed)}
          </p>
        ) : null}
      </div>
      <span className={`badge badge-sm ${GATE_META[gate.status] || "badge-ghost"} capitalize`}>
        {gate.status}
      </span>
    </div>
  );
}

function MissingEvidence({ report }) {
  const missingGates = (report?.gates || []).filter((gate) => gate.status === "missing");
  const missingSources = report?.missing_sources || [];
  if (!missingGates.length && !missingSources.length) return null;

  return (
    <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
      <div className="flex items-center gap-2 font-semibold text-warning-content">
        <ExclamationTriangleIcon className="h-4 w-4" />
        <span>Missing Evidence</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {missingGates.map((gate) => (
          <span key={gate.key} className="badge badge-outline badge-sm">
            {gate.group}: {gate.label}
          </span>
        ))}
        {missingSources.map((source, index) => (
          <span key={`${source.source}-${source.id}-${index}`} className="badge badge-outline badge-sm">
            {source.source}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CandidateReadinessPanel({
  strategyName,
  optimizerSessionId,
  trialNumber,
  backtestRunId,
  candidateRunId,
  stressSessionId,
  temporalStressSessionId,
  profile,
  readinessOverride = null,
  onAnalyzeReadiness = null,
  compact = false,
  className = "",
}) {
  const params = useMemo(
    () =>
      cleanParams({
        strategy_name: strategyName,
        optimizer_session_id: optimizerSessionId,
        trial_number: trialNumber,
        backtest_run_id: backtestRunId,
        candidate_run_id: candidateRunId,
        stress_session_id: stressSessionId,
        temporal_stress_session_id: temporalStressSessionId,
        profile,
      }),
    [
      strategyName,
      optimizerSessionId,
      trialNumber,
      backtestRunId,
      candidateRunId,
      stressSessionId,
      temporalStressSessionId,
      profile,
    ]
  );
  const [report, setReport] = useState(readinessOverride);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const queryKey = useMemo(() => JSON.stringify(params), [params]);
  const hasInputs = Object.keys(params).length > 0;

  useEffect(() => {
    if (readinessOverride) {
      setReport(readinessOverride);
      return;
    }
    if (!hasInputs) {
      setReport(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    api.readiness
      .getReport(params)
      .then((nextReport) => {
        if (!cancelled) setReport(nextReport);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Failed to load readiness report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasInputs, queryKey, readinessOverride]);

  const groupedGates = useMemo(() => {
    const groups = new Map();
    (report?.gates || []).forEach((gate) => {
      const group = gate.group || "Other";
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(gate);
    });
    return [...groups.entries()].sort(
      ([a], [b]) =>
        (GROUP_ORDER.includes(a) ? GROUP_ORDER.indexOf(a) : GROUP_ORDER.length) -
        (GROUP_ORDER.includes(b) ? GROUP_ORDER.indexOf(b) : GROUP_ORDER.length)
    );
  }, [report]);

  if (!hasInputs && !readinessOverride) return null;

  const meta = STATUS_META[report?.status] || STATUS_META.insufficient_data;
  const StatusIcon = meta.Icon;
  const score = Math.max(0, Math.min(100, Number(report?.overall_score || 0)));

  const handleAnalyze = () => {
    if (!report || !onAnalyzeReadiness) return;
    onAnalyzeReadiness({
      report,
      message: buildReadinessAnalysisPrompt({ readiness: report }),
      context: {
        active_panel: "candidate_readiness",
        strategy_name: report.inputs?.strategy_name || strategyName || null,
        optimizer_session_id: report.inputs?.optimizer_session_id || optimizerSessionId || null,
        optimizer_trial_number: report.inputs?.trial_number ?? trialNumber ?? null,
        backtest_run_id: report.inputs?.backtest_run_id || backtestRunId || null,
        candidate_run_id: report.inputs?.candidate_run_id || candidateRunId || null,
        stress_session_id: report.inputs?.stress_session_id || stressSessionId || null,
        temporal_stress_session_id:
          report.inputs?.temporal_stress_session_id || temporalStressSessionId || null,
        readiness_profile: report.inputs?.profile || profile || null,
      },
    });
  };

  return (
    <section
      className={`rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm ${className}`}
      data-testid="candidate-readiness-panel"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusIcon className="h-5 w-5 text-base-content/70" />
            <h3 className="text-base font-semibold">Candidate Readiness</h3>
            {loading ? (
              <span className="badge badge-ghost gap-1">
                <ArrowPathIcon className="h-3 w-3 animate-spin" />
                Loading
              </span>
            ) : (
              <span className={`badge ${meta.badge}`}>{report?.readiness_label || meta.label}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-base-content/60">
            Backend-computed pass, warn, fail report from attached result evidence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="min-w-28">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs uppercase text-base-content/50">Score</span>
              <span className="font-mono text-lg font-semibold">{score}</span>
            </div>
            <progress className={`progress ${meta.progress} h-2 w-full`} value={score} max="100" />
          </div>
          {onAnalyzeReadiness ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleAnalyze}
              disabled={!report || loading}
            >
              <SparklesIcon className="h-4 w-4" />
              Analyze Readiness
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="alert alert-error mt-3 py-2 text-sm">{error}</div> : null}
      {report?.blocking_failures?.length ? (
        <div className="mt-3 rounded-md border border-error/30 bg-error/10 p-3">
          <div className="text-sm font-semibold text-error">Blocking Failures</div>
          <ul className="mt-1 space-y-1 text-xs text-base-content/70">
            {report.blocking_failures.map((failure) => (
              <li key={failure.gate}>{failure.label}: {failure.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report ? (
        <div className="mt-4 space-y-3">
          <MissingEvidence report={report} />
          <div className={`grid gap-3 ${compact ? "grid-cols-1" : "lg:grid-cols-2"}`}>
            {groupedGates.map(([group, gates]) => (
              <div key={group} className="rounded-md border border-base-300/70 p-3">
                <div className="mb-1 text-xs font-semibold uppercase text-base-content/50">{group}</div>
                {gates.map((gate) => (
                  <GateRow key={gate.key} gate={gate} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
