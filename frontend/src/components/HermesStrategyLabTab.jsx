import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";
import StrategyLabTab from "./StrategyLabTab.jsx";
import StrategySpecPreview from "./StrategySpecPreview.jsx";

const DEFAULT_FORM = {
  trading_style: "scalping",
  direction: "long",
  risk_profile: "balanced",
  timeframe_preference: "5m",
  user_notes: "Generate a simple long-only strategy intent. Avoid overfitting.",
};

const DEFAULT_CANDIDATE_CONFIG = {
  timerange: "20240101-20240401",
  timeframe: "5m",
  pairs: ["BTC/USDT", "ETH/USDT"],
  user_data_dir: "user_data",
  config_file: "config.json",
  exchange: "binance",
  max_repair_iterations: 3,
  auto_download_data: true,
  max_data_download_attempts: 1,
  risk_profile: "balanced",
};

function buildCandidateConfig(form) {
  return {
    ...DEFAULT_CANDIDATE_CONFIG,
    timeframe: form.timeframe_preference,
    risk_profile: form.risk_profile,
  };
}

function StatusPill({ status }) {
  if (!status) return null;
  const cls = status === "completed" ? "badge-success" : status === "failed" ? "badge-error" : "badge-primary";
  return <span className={`badge badge-sm ${cls}`}>{status}</span>;
}

export default function HermesStrategyLabTab(props) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [spec, setSpec] = useState(null);
  const [rawResponse, setRawResponse] = useState("");
  const [errors, setErrors] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [runState, setRunState] = useState(null);
  const [runError, setRunError] = useState(null);

  const candidateConfig = useMemo(() => buildCandidateConfig(form), [form]);

  useEffect(() => {
    if (!runState?.run_id || ["completed", "failed"].includes(runState.status)) return undefined;
    const id = setInterval(async () => {
      try {
        const next = await api.candidate.getRun(runState.run_id);
        setRunState(next);
      } catch (err) {
        setRunError(err.message || "Failed to poll candidate run.");
      }
    }, 2000);
    return () => clearInterval(id);
  }, [runState?.run_id, runState?.status]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors([]);
    setRunError(null);
  };

  const generateSpec = async () => {
    setGenerating(true);
    setErrors([]);
    setSpec(null);
    setRawResponse("");
    setRunState(null);
    setRunError(null);
    try {
      const res = await fetch("/api/auto-quant/generate-strategy-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Failed to generate StrategySpec.");
      setRawResponse(data.raw_response || "");
      if (data.errors?.length) {
        setErrors(data.errors);
        return;
      }
      setSpec(data.spec || null);
    } catch (err) {
      setErrors([err.message || "Failed to generate StrategySpec."]);
    } finally {
      setGenerating(false);
    }
  };

  const startCandidate = async () => {
    if (!spec) return;
    setStarting(true);
    setRunError(null);
    try {
      const response = await api.candidate.startRun(spec, candidateConfig);
      setRunState(response);
    } catch (err) {
      setRunError(err.message || "Failed to start candidate workflow.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card bg-base-200 border border-primary/20 shadow-sm">
        <div className="card-body p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold">Hermes Strategy Designer</h2>
              <p className="text-sm text-base-content/60 mt-1">
                Hermes now generates a tiny StrategyIntent. The backend expands it into a validated StrategySpec, then the Candidate Workflow tests it.
              </p>
            </div>
            <span className="badge badge-primary badge-outline">MVP: long only</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <label className="form-control">
              <span className="label-text text-xs mb-1">Trading style</span>
              <select className="select select-bordered select-sm" value={form.trading_style} onChange={(e) => updateForm("trading_style", e.target.value)}>
                <option value="scalping">scalping</option>
                <option value="intraday">intraday</option>
                <option value="swing">swing</option>
                <option value="position">position</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs mb-1">Direction</span>
              <select className="select select-bordered select-sm" value={form.direction} onChange={(e) => updateForm("direction", e.target.value)}>
                <option value="long">long</option>
              </select>
              <span className="text-[10px] text-base-content/40 mt-1">short/both disabled until templates support futures shorts</span>
            </label>

            <label className="form-control">
              <span className="label-text text-xs mb-1">Risk profile</span>
              <select className="select select-bordered select-sm" value={form.risk_profile} onChange={(e) => updateForm("risk_profile", e.target.value)}>
                <option value="conservative">conservative</option>
                <option value="balanced">balanced</option>
                <option value="aggressive">aggressive</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs mb-1">Timeframe</span>
              <select className="select select-bordered select-sm" value={form.timeframe_preference} onChange={(e) => updateForm("timeframe_preference", e.target.value)}>
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="30m">30m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
                <option value="1d">1d</option>
              </select>
            </label>
          </div>

          <label className="form-control mt-3">
            <span className="label-text text-xs mb-1">Notes</span>
            <textarea className="textarea textarea-bordered textarea-sm h-20" value={form.user_notes} onChange={(e) => updateForm("user_notes", e.target.value)} />
          </label>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <button className="btn btn-primary btn-sm" onClick={generateSpec} disabled={generating || starting}>
              {generating ? <span className="loading loading-spinner loading-xs" /> : null}
              Generate with Hermes
            </button>
            <button className="btn btn-success btn-sm" onClick={startCandidate} disabled={!spec || generating || starting}>
              {starting ? <span className="loading loading-spinner loading-xs" /> : null}
              Confirm & Start Candidate Workflow
            </button>
            <StatusPill status={runState?.status} />
            {runState?.run_id && <span className="text-xs font-mono text-base-content/50">Run: {runState.run_id.slice(0, 8)}...</span>}
          </div>

          {errors.length > 0 && (
            <div className="alert alert-error mt-4">
              <div className="text-sm space-y-1">{errors.map((error) => <div key={error}>{error}</div>)}</div>
            </div>
          )}

          {runError && <div className="alert alert-error mt-4"><span>{runError}</span></div>}

          {spec && (
            <div className="mt-5">
              <StrategySpecPreview spec={spec} validationErrors={errors} />
            </div>
          )}

          {runState?.verdict && (
            <div className="alert mt-4 ${runState.verdict.passed ? 'alert-success' : 'alert-warning'}">
              <span>
                Candidate verdict: {runState.verdict.passed ? "passed" : "failed"}
                {runState.verdict.failure_reason ? ` — ${runState.verdict.failure_reason}` : ""}
              </span>
            </div>
          )}

          {rawResponse && (
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer text-base-content/50">Raw Hermes intent</summary>
              <pre className="mt-2 p-3 bg-base-300 rounded overflow-auto">{rawResponse}</pre>
            </details>
          )}
        </div>
      </div>

      <div className="divider text-xs text-base-content/40">Manual Strategy Lab</div>
      <StrategyLabTab {...props} />
    </div>
  );
}
