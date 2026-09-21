/**
 * The column set for an export.
 *
 * Columns are derived from the items themselves rather than hard-coded per
 * platform: a column appears when at least one item carries a value for it. So
 * an Instagram Posts export has no Views column (photos have no view count)
 * while a Reels export does, without either being special-cased.
 */

import { isoDate } from "../format.js";
import { formatScore } from "../outlier.js";

const CANDIDATES = [
  { key: "author", header: "Profile", always: true },
  { key: "url", header: "URL", always: true },
  { key: "createdAtMs", header: "Date", always: true, map: (v) => isoDate(v) },
  { key: "views", header: "Views" },
  { key: "likes", header: "Likes" },
  { key: "comments", header: "Comments" },
  { key: "shares", header: "Shares" },
  { key: "saves", header: "Saves" },
  { key: "outlierScore", header: "Outlier", map: (v) => formatScore(v) },
  { key: "caption", header: "Caption", always: true },
];

function hasAnyValue(items, key) {
  return items.some((item) => item?.[key] != null && item[key] !== "");
}

export function buildColumns(items) {
  return CANDIDATES.filter((col) => col.always || hasAnyValue(items, col.key));
}

/** @returns {{headers: string[], rows: Array<Array<string|number|null>>}} */
export function toTable(items) {
  const columns = buildColumns(items);
  return {
    headers: columns.map((col) => col.header),
    rows: items.map((item) =>
      columns.map((col) => {
        const value = item?.[col.key] ?? null;
        if (value == null) return null;
        return col.map ? col.map(value) : value;
      }),
    ),
  };
}
