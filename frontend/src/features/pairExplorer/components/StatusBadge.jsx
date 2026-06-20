export default function StatusBadge({ status }) {
  const cls = {
    completed: "bg-success/15 text-success border-success/30",
    running: "bg-primary/15 text-primary border-primary/30",
    downloading: "bg-info/15 text-info border-info/30",
    failed: "bg-error/15 text-error border-error/30",
    pending: "bg-base-300/40 text-base-content/30 border-base-300/50",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${cls[status] || cls.pending}`}>
      {(status === "downloading" || status === "running") && (
        <span className="loading loading-spinner loading-[6px]" />
      )}
      {status}
    </span>
  );
}
