/** Display helpers shared by the grid overlay, the popup and the exporters. */

/** 12500 → "12.5K". Matches how both platforms label their own counts. */
export function compactNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return trimZero(n / 1000) + "K";
  if (n < 1_000_000_000) return trimZero(n / 1_000_000) + "M";
  return trimZero(n / 1_000_000_000) + "B";
}

function trimZero(n) {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function isoDate(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

export function localDateTime(ms) {
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Keep a string safe to drop into a filename on any platform. */
export function safeFilename(value, fallback = "export") {
  const cleaned = String(value || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}
