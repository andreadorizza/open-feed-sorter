import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBaseline, stampScores, median, formatScore } from "../src/core/outlier.js";

const NOW = Date.UTC(2026, 0, 31);
const DAY = 86_400_000;

/** `count` unpinned items, all old enough to qualify, with the given views. */
function pool(views, overrides = {}) {
  return views.map((v, i) => ({
    id: `i${i}`,
    views: v,
    createdAtMs: NOW - (i + 10) * DAY,
    isPinned: false,
    ...overrides,
  }));
}

test("median handles both parities and ignores non-numbers", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([1, null, "x", 3]), 2);
  assert.equal(median([]), null);
});

test("declines to score below the floor", () => {
  const meta = computeBaseline(pool(new Array(19).fill(100)), { metric: "views", now: NOW });
  assert.equal(meta.status, "insufficient");
  assert.equal(meta.baseline, null);
});

test("computes a median baseline at the floor", () => {
  const meta = computeBaseline(pool(new Array(20).fill(100)), { metric: "views", now: NOW });
  assert.equal(meta.status, "ok");
  assert.equal(meta.baseline, 100);
  assert.equal(meta.poolSize, 20);
});

test("excludes pinned items, which accounts float regardless of age", () => {
  // 20 ordinary items plus one pinned megahit; the pinned one must not count.
  const items = [...pool(new Array(20).fill(100)), {
    id: "pinned",
    views: 1_000_000,
    createdAtMs: NOW - 400 * DAY,
    isPinned: true,
  }];
  const meta = computeBaseline(items, { metric: "views", now: NOW });
  assert.equal(meta.poolSize, 20);
  assert.equal(meta.baseline, 100);
});

test("excludes items too new to have matured", () => {
  const fresh = pool(new Array(20).fill(100)).map((it) => ({ ...it, createdAtMs: NOW - 3600_000 }));
  assert.equal(computeBaseline(fresh, { metric: "views", now: NOW }).status, "insufficient");
});

test("caps the baseline at the most recent N items", () => {
  // 25 recent items at 100 views, then 25 older ones at 1. Only the recent
  // window should count, so the median stays 100.
  const recent = new Array(25).fill(0).map((_, i) => ({
    id: `r${i}`, views: 100, createdAtMs: NOW - (i + 10) * DAY, isPinned: false,
  }));
  const old = new Array(25).fill(0).map((_, i) => ({
    id: `o${i}`, views: 1, createdAtMs: NOW - (i + 500) * DAY, isPinned: false,
  }));
  const meta = computeBaseline([...recent, ...old], { metric: "views", now: NOW, cap: 25 });
  assert.equal(meta.baseline, 100);
  assert.equal(meta.poolSize, 25);
});

test("a median of zero is not a usable baseline", () => {
  const meta = computeBaseline(pool(new Array(20).fill(0)), { metric: "views", now: NOW });
  assert.equal(meta.status, "insufficient");
});

test("stampScores divides by the baseline and leaves gaps null", () => {
  const items = [{ views: 300 }, { views: 50 }, { views: null }];
  stampScores(items, { status: "ok", baseline: 100, metric: "views" });
  assert.equal(items[0].outlierScore, 3);
  assert.equal(items[1].outlierScore, 0.5);
  assert.equal(items[2].outlierScore, null);
});

test("stampScores is a no-op without a usable baseline", () => {
  const items = [{ views: 300 }];
  stampScores(items, { status: "insufficient", baseline: null, metric: "views" });
  assert.equal(items[0].outlierScore, undefined);
});

test("scores format to one decimal below 10x and whole numbers above", () => {
  assert.equal(formatScore(3.44), "3.4x");
  assert.equal(formatScore(12.7), "13x");
  assert.equal(formatScore(null), "");
});
