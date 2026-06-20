export function fmtDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function toTimerange(start, end) {
  return `${start.replace(/-/g, "")}-${end.replace(/-/g, "")}`;
}

export function fromTimerangeDate(raw) {
  if (!raw || raw.length !== 8) return "";
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export function datePreset(days, now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { start: fmtDate(start), end: fmtDate(end) };
}

export function defaultDateRange(now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  return { start: fmtDate(start), end: fmtDate(end) };
}

export function fmt(value, decimals = 2, suffix = "") {
  if (value == null) return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}${suffix}`;
}

export function fmtPct(value) {
  return fmt(value, 2, "%");
}

export function fmtRaw(value) {
  if (value == null) return "-";
  const n = Number(value);
  return Number.isNaN(n) ? "-" : n.toFixed(4);
}

export function fmtWin(value) {
  if (value == null) return "-";
  const n = Number(value);
  return Number.isNaN(n) ? "-" : `${n.toFixed(1)}%`;
}

export function fmtRelTime(iso, nowMs) {
  if (!iso || nowMs == null) return "";
  const createdMs = new Date(iso).getTime();
  if (Number.isNaN(createdMs)) return "";
  const diff = Math.max(0, nowMs - createdMs);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
