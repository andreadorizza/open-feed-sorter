/**
 * Sort keys and comparators.
 *
 * Every key is defined once here, with the metric it reads and the platforms
 * that actually carry that metric, so the popup can offer exactly the keys the
 * current surface supports instead of hard-coding a list per platform.
 */

/** @typedef {import("../adapters/types.js").FeedItem} FeedItem */

export const SORT_KEYS = {
  views: { label: "Most views", field: "views", dir: -1 },
  likes: { label: "Most likes", field: "likes", dir: -1 },
  comments: { label: "Most comments", field: "comments", dir: -1 },
  shares: { label: "Most shares", field: "shares", dir: -1 },
  saves: { label: "Most saves", field: "saves", dir: -1 },
  newest: { label: "Newest first", field: "createdAtMs", dir: -1 },
  oldest: { label: "Oldest first", field: "createdAtMs", dir: 1 },
  outlier: { label: "Biggest outliers", field: "outlierScore", dir: -1 },
};

/**
 * Null-safe numeric compare.
 *
 * Items missing the metric always sink to the bottom whichever way the sort
 * runs, so an "oldest first" sort doesn't open with a wall of undated items.
 */
function compareBy(field, dir) {
  return (a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    const aMissing = av == null || Number.isNaN(av);
    const bMissing = bv == null || Number.isNaN(bv);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return (av - bv) * dir;
  };
}

/**
 * Sort a copy of `items` by `key`.
 *
 * An outlier sort falls back to the surface's own metric when scoring produced
 * no baseline (too few qualifying items). One shared baseline divides every
 * item, so the metric order and the score order are the same — the fallback
 * changes the badges shown, never the ordering.
 */
export function sortItems(items, key, { outlierFallback = "views" } = {}) {
  const list = Array.isArray(items) ? items.slice() : [];
  const spec = SORT_KEYS[key];
  if (!spec) return list;

  if (key === "outlier") {
    const scored = list.some((it) => typeof it?.outlierScore === "number");
    if (!scored) return list.sort(compareBy(outlierFallback, -1));
  }

  return list.sort(compareBy(spec.field, spec.dir));
}

/** Sort keys that make sense for a set of items, in display order. */
export function availableSortKeys(metrics) {
  const order = ["views", "likes", "comments", "shares", "saves", "newest", "oldest", "outlier"];
  return order.filter((key) => {
    if (key === "newest" || key === "oldest" || key === "outlier") return true;
    return metrics.includes(SORT_KEYS[key].field);
  });
}
