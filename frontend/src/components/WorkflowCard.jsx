const STATUS_STYLES = {
  proposed: "border-blue-200 bg-blue-50 text-blue-700",
  awaiting_confirmation: "border-amber-200 bg-amber-50 text-amber-700",
  running: "border-violet-200 bg-violet-50 text-violet-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  timed_out: "border-orange-200 bg-orange-50 text-orange-700",
  cancelled: "border-gray-200 bg-gray-50 text-gray-600",
};

const ARGUMENT_LABELS = {
  strategy_name: "Strategy",
  timeframe: "Timeframe",
  timerange: "Timerange",
  pairs: "Pairs",
};

function formatLabel(key) {
  return ARGUMENT_LABELS[key] || key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value == null) return "None";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatStatus(status) {
  return String(status || "proposed").replaceAll("_", " ");
}

export default function WorkflowCard({
  title,
  description,
  status = "proposed",
  toolName,
  arguments: toolArguments = {},
}) {
  const statusClass = STATUS_STYLES[status] || STATUS_STYLES.proposed;
  const argumentEntries = Object.entries(toolArguments || {});

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900">{title}</div>
          {toolName && (
            <div className="mt-0.5 truncate font-mono text-[11px] text-gray-400">{toolName}</div>
          )}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusClass}`}>
          {formatStatus(status)}
        </span>
      </div>

      {description && (
        <p className="mt-2 text-xs leading-relaxed text-gray-600">{description}</p>
      )}

      {argumentEntries.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-md bg-gray-50 p-2">
          {argumentEntries.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[72px_1fr] gap-2 text-xs">
              <span className="text-gray-500">{formatLabel(key)}</span>
              <span className="min-w-0 break-words font-medium text-gray-800">{formatValue(value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          disabled
          className="rounded-md bg-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500"
        >
          {title}
        </button>
      </div>
    </div>
  );
}
