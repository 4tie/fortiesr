export default function AutoQuantMetricCard({ label, value, unit = "", good = null, threshold = null }) {
  const colorClass =
    good === true
      ? "text-success"
      : good === false
      ? "text-error"
      : "text-base-content";
  return (
    <div className="bg-base-200 rounded-lg p-3 flex flex-col gap-1">
      <span className="text-[10px] text-base-content/50 uppercase tracking-wider">{label}</span>
      <span className={`text-lg font-bold ${colorClass}`}>
        {value != null ? `${value}${unit}` : "—"}
      </span>
      {threshold != null && (
        <span className="text-[10px] text-base-content/40">
          threshold: {threshold}
        </span>
      )}
    </div>
  );
}
