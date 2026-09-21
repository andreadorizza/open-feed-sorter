/**
 * Date-range presets for "sort everything from the last N" runs.
 *
 * Ranges are half-open on the start and inclusive to the end of the current
 * day, so "last 1 week" picks up something posted an hour ago.
 */

export const RANGE_PRESETS = {
  "1w": { label: "Last week", days: 7 },
  "1m": { label: "Last month", days: 30 },
  "3m": { label: "Last 3 months", days: 90 },
  "6m": { label: "Last 6 months", days: 180 },
  "1y": { label: "Last year", days: 365 },
  all: { label: "All time", days: null },
};

/**
 * Resolve a range spec to concrete millisecond bounds.
 *
 * @param {string|{fromMs:number,toMs:number}} spec preset id or explicit bounds
 * @param {number} now
 * @returns {{fromMs:number, toMs:number}}
 */
export function resolveRange(spec, now = Date.now()) {
  if (spec && typeof spec === "object" && Number.isFinite(spec.fromMs)) {
    const to = new Date(Number.isFinite(spec.toMs) ? spec.toMs : now);
    to.setHours(23, 59, 59, 999);
    return { fromMs: spec.fromMs, toMs: to.getTime() };
  }

  const preset = RANGE_PRESETS[spec] || RANGE_PRESETS["1m"];
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (preset.days == null) return { fromMs: 0, toMs: to.getTime() };

  const from = new Date(now);
  from.setDate(from.getDate() - preset.days);
  from.setHours(0, 0, 0, 0);
  return { fromMs: from.getTime(), toMs: to.getTime() };
}

export function inRange(ms, { fromMs, toMs }) {
  return Number.isFinite(ms) && ms >= fromMs && ms <= toMs;
}

/**
 * Both feeds arrive newest-first, so an item older than the range start means
 * every item after it is older too — the signal to stop paginating.
 */
export function isOlderThanRange(ms, { fromMs }) {
  return Number.isFinite(ms) && ms < fromMs;
}
