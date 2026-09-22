/**
 * Outlier scoring.
 *
 * An outlier score answers "how did this post do compared to this account's
 * normal?" — it is the post's metric divided by a baseline, so 3.0 means three
 * times the account's usual.
 *
 * The baseline is the MEDIAN of the account's most recent qualifying posts.
 * Median rather than mean because one viral post would drag a mean up far
 * enough to hide every other outlier in the set.
 *
 * Qualifying excludes two kinds of post that would bias the baseline:
 *   - pinned posts, which both platforms float to the top of a profile
 *     regardless of age and which are usually the account's best work;
 *   - posts younger than `minAgeMs`, which have not finished accumulating
 *     views and would drag the baseline down.
 */

import { compactNumber } from "./format.js";

export const OUTLIER_DEFAULTS = {
  /** below this, a post is still gathering views and is not representative */
  minAgeMs: 72 * 60 * 60 * 1000,
  /** fewer qualifying posts than this and we decline to score at all */
  floor: 20,
  /** baseline is taken from at most this many of the most recent qualifying posts */
  cap: 25,
};

/**
 * Strict numeric coercion.
 *
 * `Number(null)` and `Number("")` are both 0, which is exactly wrong here: a
 * post with no view count is not a post with zero views. Treating the two the
 * same drags the baseline toward zero — visible on Instagram Posts, where
 * every photo has a null view count.
 */
function toNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The two verdicts scoring can reach. */
export const SCORED = "ok";
export const UNSCORABLE = "insufficient";

function unscorable(metric, poolSize) {
  return { status: UNSCORABLE, baseline: null, metric, poolSize };
}

/** True when a verdict carries a baseline worth dividing by. */
export function usableBaseline(meta) {
  return Boolean(meta) && meta.status === SCORED && meta.baseline > 0;
}

export function median(values) {
  const nums = values
    .map(toNumber)
    .filter((n) => n !== null)
    .sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = nums.length >> 1;
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

/**
 * Compute the baseline for a pool of items.
 *
 * @returns {{status:"ok"|"insufficient", baseline:number|null, metric:string, poolSize:number}}
 */
/** Whether an item can count toward the baseline for `metric`. */
export function qualifies(item, { metric, now = Date.now(), minAgeMs = OUTLIER_DEFAULTS.minAgeMs } = {}) {
  if (!item || item.isPinned) return false;
  if (!Number.isFinite(item.createdAtMs)) return false;
  if (now - item.createdAtMs < minAgeMs) return false;
  return toNumber(item[metric]) !== null;
}

export function computeBaseline(pool, { metric, now = Date.now(), ...opts } = {}) {
  const { minAgeMs, floor, cap } = { ...OUTLIER_DEFAULTS, ...opts };

  const qualifying = (pool || []).filter((item) => qualifies(item, { metric, now, minAgeMs }));

  if (qualifying.length < floor) return unscorable(metric, qualifying.length);

  // Newest first, then keep the cap. The most recent posts describe what the
  // account's normal is *now*; a three-year-old back catalogue does not.
  const recent = qualifying
    .slice()
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, cap);

  const baseline = median(recent.map((item) => item[metric]));

  // A zero or missing median is not a baseline — dividing by it would make
  // every post either infinite or undefined.
  return baseline > 0
    ? { status: SCORED, baseline, metric, poolSize: recent.length }
    : unscorable(metric, recent.length);
}

/** Write `outlierScore` onto each item in place. Returns the same array. */
export function stampScores(items, meta) {
  if (!usableBaseline(meta)) return items;
  for (const item of items) {
    const value = toNumber(item?.[meta.metric]);
    item.outlierScore = value === null ? null : value / meta.baseline;
  }
  return items;
}

/** Score at or above which an item is worth badging as an outlier. */
export const BADGE_MIN = 2;

/** "3.4x" — one decimal below 10, whole numbers above, where it stops mattering. */
export function formatScore(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "";
  if (score >= 10) return `${Math.round(score)}x`;
  return `${score.toFixed(1)}x`;
}

/**
 * One sentence saying what the scores mean for this run — or why there are
 * none. Shown under the toolbar, so a missing score is never a mystery.
 *
 * @param {{status:string, baseline:number|null, metric:string, poolSize:number}|null} meta
 */
export function explainBaseline(meta, { floor = OUTLIER_DEFAULTS.floor } = {}) {
  if (!meta) return "";
  const metric = meta.metric || "views";

  if (usableBaseline(meta)) {
    return (
      `Outlier score = ${metric} ÷ ${compactNumber(meta.baseline)}, the median of this account's ` +
      `${meta.poolSize} most recent posts older than 3 days (pinned posts left out).`
    );
  }

  const found = meta.poolSize ?? 0;
  return (
    `No outlier scores: found ${found} post${found === 1 ? "" : "s"} older than 3 days with ` +
    `${metric}, and scoring needs ${floor}.`
  );
}
