import { useState } from "react";
import {
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { getPipelineStep, mapStageStatus, PIPELINE_STEPS } from "../../features/autoquant/pipelineSteps";
import { translateError } from "../../features/autoquant/errorTranslator";

const STATUS_CLASSES = {
  pending: {
    badge: "bg-base-300/30 border-base-300/40 text-base-content/40",
    icon: ClockIcon,
    label: "Pending",
  },
  running: {
    badge: "bg-primary/10 border-primary/30 text-primary animate-pulse",
    icon: null, // replaced by daisyUI spinner
    label: "Running",
  },
  passed: {
    badge: "bg-success/10 border-success/30 text-success",
    icon: CheckCircleIcon,
    label: "Passed",
  },
  failed: {
    badge: "bg-error/10 border-error/30 text-error",
    icon: XCircleIcon,
    label: "Failed",
  },
  warning: {
    badge: "bg-warning/10 border-warning/30 text-warning",
    icon: ExclamationTriangleIcon,
    label: "Warning",
  },
  skipped: {
    badge: "bg-base-300/30 border-base-300/40 text-base-content/40",
    icon: MinusCircleIcon,
    label: "Skipped",
  },
};

function StatusBadge({ status }) {
  const config = STATUS_CLASSES[status] || STATUS_CLASSES.pending;
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${config.badge}`}
    >
      {status === "running" ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      {config.label}
    </div>
  );
}

function MetricItem({ label, value, unit = "" }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-base-200 last:border-0">
      <span className="text-xs text-base-content/60">{label}</span>
      <span className="text-xs font-mono font-medium text-base-content">
        {value != null ? `${value}${unit}` : "—"}
      </span>
    </div>
  );
}

function ChecklistItem({ label, passed, warning }) {
  if (passed) {
    return (
      <div className="flex items-center gap-2 py-1">
        <CheckCircleIcon className="h-3.5 w-3.5 text-success shrink-0" />
        <span className="text-xs text-base-content/70">{label}</span>
      </div>
    );
  }
  if (warning) {
    return (
      <div className="flex items-center gap-2 py-1">
        <ExclamationTriangleIcon className="h-3.5 w-3.5 text-warning shrink-0" />
        <span className="text-xs text-base-content/70">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 py-1">
      <XCircleIcon className="h-3.5 w-3.5 text-error shrink-0" />
      <span className="text-xs text-base-content/50">{label}</span>
    </div>
  );
}

export default function AutoQuantPipelineCard({ stage, isExpanded: defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Get step metadata
  const stepMetadata = getPipelineStep(stage?.name);
  const mappedStatus = mapStageStatus(stage?.status, stage?.name);
  
  // Extract data from stage
  const stageData = stage?.data || {};
  const stageMessage = stage?.message || "";
  const stageDuration = stage?.duration_s;
  
  // Determine if there are warnings or failures
  const hasWarnings = mappedStatus === "warning" || (stageData?.warnings?.length > 0);
  const hasFailures = mappedStatus === "failed" || (stageData?.errors?.length > 0);
  const hasData = Object.keys(stageData).length > 0;

  return (
    <div
      className={`card border transition-all duration-300 ${
        mappedStatus === "running"
          ? "border-primary/40 border-l-2 border-l-primary bg-base-100 shadow-sm shadow-primary/10"
          : mappedStatus === "passed"
          ? "border-success/25 bg-base-100"
          : mappedStatus === "failed"
          ? "border-error/35 bg-base-100"
          : mappedStatus === "warning"
          ? "border-warning/35 bg-base-100"
          : "border-base-300/40 bg-base-100"
      }`}
    >
      <div className="card-body p-4">
        {/* Card Header - Always Visible */}
        <div className="flex items-start gap-3">
          {/* Step Number/Icon */}
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              mappedStatus === "running"
                ? "bg-primary/10"
                : mappedStatus === "passed"
                ? "bg-success/10"
                : mappedStatus === "failed"
                ? "bg-error/10"
                : mappedStatus === "warning"
                ? "bg-warning/10"
                : "bg-base-300/30"
            }`}
          >
            {stepMetadata ? (
              <span className="font-mono text-sm font-bold text-base-content/70">
                {PIPELINE_STEPS.findIndex((s) => s.id === stepMetadata.id) + 1}
              </span>
            ) : (
              <InformationCircleIcon className="h-5 w-5 text-base-content/40" />
            )}
          </div>

          {/* Step Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-base-content truncate">
                {stepMetadata?.name || stage?.name || "Unknown Step"}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={mappedStatus} />
                {stageDuration != null && mappedStatus === "passed" && (
                  <span className="text-[10px] font-mono text-base-content/35">
                    (<span>{stageDuration}s</span>)
                  </span>
                )}
              </div>
            </div>

            {/* Plain English Explanation */}
            <p className="text-xs text-base-content/60 mt-1 leading-relaxed">
              {stepMetadata?.description || "Processing pipeline step..."}
            </p>

            {/* Short status message */}
            {stageMessage && mappedStatus !== "running" && (
              <p className="text-[11px] text-base-content/45 mt-1 truncate">
                {stageMessage}
              </p>
            )}
          </div>

          {/* Expand Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn btn-ghost btn-xs btn-circle hover:bg-base-200 transition-colors"
            aria-label={isExpanded ? "Collapse details" : "Expand details"}
          >
            <ChevronRightIcon
              className={`h-4 w-4 text-base-content/60 transition-transform duration-200 ${isExpanded ? "rotate-90" : "rotate-0"}`}
            />
          </button>
        </div>

        {/* Expandable Technical Details */}
        {isExpanded && (
          <div className="mt-4 space-y-4">
            <div className="h-px bg-base-200/60" />
            {/* Why This Step Matters */}
            {stepMetadata?.whyItMatters && (
              <div className="flex gap-2">
                <InformationCircleIcon className="h-4 w-4 text-primary/50 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-primary/60 mb-1">
                    Why this matters
                  </h4>
                  <p className="text-xs text-base-content/70 leading-relaxed">
                    {stepMetadata.whyItMatters}
                  </p>
                </div>
              </div>
            )}

            {/* Inputs Used */}
            {stepMetadata?.inputs?.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 mb-2">
                  Inputs
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {stepMetadata.inputs.map((input, idx) => (
                    <span key={idx} className="badge badge-xs badge-ghost">
                      {input}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Checks Running */}
            {stepMetadata?.checks?.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 mb-2">
                  Checks
                </h4>
                <div className="space-y-1">
                  {stepMetadata.checks.map((check, idx) => (
                    <ChecklistItem
                      key={idx}
                      label={check}
                      passed={mappedStatus === "passed" && !hasWarnings}
                      warning={hasWarnings && mappedStatus !== "failed"}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Stage Data Metrics */}
            {hasData && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 mb-2">
                  Metrics
                </h4>
                <div className="bg-base-200/50 rounded-lg p-2 space-y-0.5">
                  {Object.entries(stageData).map(([key, value]) => {
                    // Handle arrays: flatten for display
                    if (Array.isArray(value)) {
                      // Skip common arrays that get their own sections below
                      if (["retry_history", "per_pair_metrics", "per_pair", "wfo_windows"].includes(key)) {
                        return null;
                      }
                      // Flatten other arrays
                      const arrayDisplay = value.length > 0
                        ? `${value.length} item${value.length !== 1 ? "s" : ""}`
                        : "empty";
                      const label = key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim();
                      return <MetricItem key={key} label={label} value={arrayDisplay} />;
                    }
                    // Skip nested objects (still)
                    if (typeof value === "object" && value !== null) return null;
                    // Format the key for display
                    const label = key
                      .replace(/_/g, " ")
                      .replace(/([A-Z])/g, " $1")
                      .trim();
                    // Format the value
                    let displayValue = value;
                    if (typeof value === "number") {
                      displayValue = value.toFixed(2);
                    }
                    return (
                      <MetricItem key={key} label={label} value={displayValue} />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Per-Pair Results (if present) */}
            {stageData?.per_pair && Array.isArray(stageData.per_pair) && stageData.per_pair.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 mb-2">
                  Pairs
                </h4>
                <div className="flex flex-wrap gap-1">
                  {stageData.per_pair.map((pair, idx) => {
                    const pairName = typeof pair === "string" ? pair : pair.key || pair.pair || `Pair ${idx}`;
                    return (
                      <span key={idx} className="badge badge-xs badge-primary badge-outline">
                        {pairName}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WFO Windows Summary (if present) */}
            {stageData?.wfo_windows && Array.isArray(stageData.wfo_windows) && stageData.wfo_windows.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50 mb-2">
                  Walk-Forward Windows
                </h4>
                <div className="text-xs text-base-content/70">
                  {stageData.wfo_windows.length} window{stageData.wfo_windows.length !== 1 ? "s" : ""} tested
                </div>
              </div>
            )}

            {/* Warnings */}
            {hasWarnings && stageData?.warnings?.length > 0 && (
              <div className="rounded-lg bg-warning/10 border border-warning/20 p-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-warning mb-2">
                  Warnings
                </h4>
                <ul className="space-y-1">
                  {stageData.warnings.map((warning, idx) => {
                    const translated = translateError(warning, stage?.name);
                    return (
                      <li key={idx} className="text-xs text-warning/90 flex items-start gap-2">
                        <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{translated.userMessage || warning}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Failures */}
            {hasFailures && stageData?.errors?.length > 0 && (
              <div className="rounded-lg bg-error/10 border border-error/20 p-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-error mb-2">
                  Errors
                </h4>
                <ul className="space-y-2">
                  {stageData.errors.map((error, idx) => {
                    const translated = translateError(error, stage?.name);
                    return (
                      <li key={idx} className="text-xs text-error/90 space-y-1">
                        <div className="flex items-start gap-2">
                          <XCircleIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{translated.userMessage || error}</span>
                        </div>
                        {translated.userMessage !== error && (
                          <div className="text-[10px] text-error/60 font-mono pl-5 break-words">
                            {error}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Stage Message (if not shown above) */}
            {stageMessage && mappedStatus === "running" && (
              <div className="flex items-center gap-2 text-xs text-base-content/50">
                <ClockIcon className="h-3.5 w-3.5 animate-spin" />
                <span>{stageMessage}</span>
              </div>
            )}

            {/* Not Available Yet */}
            {!hasData && !hasWarnings && !hasFailures && mappedStatus === "pending" && (
              <div className="text-center py-6">
                <span className="block text-3xl font-mono text-base-content/[0.12] leading-none select-none">
                  {stepMetadata ? PIPELINE_STEPS.findIndex((s) => s.id === stepMetadata.id) + 1 : "—"}
                </span>
                <p className="text-xs text-base-content/35 mt-2">Waiting to start</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
