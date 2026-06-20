export function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function toTimerange(start, end) {
  return `${String(start || "").replace(/-/g, "")}-${String(end || "").replace(/-/g, "")}`;
}

export function fromTimerangeDate(raw) {
  return raw?.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : "";
}

export function datePreset(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start: fmtDate(start), end: fmtDate(end) };
}

export function fmtPct(v, decimals = 2, signed = true) {
  if (v == null || Number.isNaN(Number(v))) return "-";
  const n = Number(v);
  return `${signed && n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

export function fmtScore(v) {
  if (v == null || Number.isNaN(Number(v))) return "-";
  return Number(v).toFixed(4);
}

export function fmtNum(v, decimals = 2) {
  if (v == null || Number.isNaN(Number(v))) return "-";
  return Number(v).toFixed(decimals);
}

export function fmtMoney(v) {
  if (v == null || Number.isNaN(Number(v))) return "-";
  return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function fmtElapsed(s) {
  if (!s) return "0s";
  const sec = Math.max(0, Math.floor(Number(s)));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return `${min}m ${rem}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function trialDuration(trial) {
  if (!trial?.started_at || !trial?.completed_at) return "-";
  const start = new Date(trial.started_at).getTime();
  const end = new Date(trial.completed_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "-";
  return fmtElapsed((end - start) / 1000);
}
