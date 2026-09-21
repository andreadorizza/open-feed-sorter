import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRange, inRange, isOlderThanRange, RANGE_PRESETS } from "../src/core/dates.js";

const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime(); // local noon, mid-month

test("a preset spans the right number of days and ends today", () => {
  const { fromMs, toMs } = resolveRange("1w", NOW);
  assert.equal(new Date(toMs).getDate(), 15);
  assert.equal(new Date(toMs).getHours(), 23);
  assert.equal(new Date(fromMs).getDate(), 8);
  assert.equal(new Date(fromMs).getHours(), 0);
});

test("the range end covers the whole current day", () => {
  // Something posted an hour ago must fall inside "last week".
  const range = resolveRange("1w", NOW);
  assert.ok(inRange(NOW - 3600_000, range));
  assert.ok(inRange(NOW + 3600_000, range), "later today still counts");
});

test("all-time starts at the epoch", () => {
  assert.equal(resolveRange("all", NOW).fromMs, 0);
});

test("an explicit range is honoured and extended to end of day", () => {
  const from = new Date(2026, 0, 1).getTime();
  const to = new Date(2026, 0, 31, 9, 0, 0).getTime();
  const range = resolveRange({ fromMs: from, toMs: to }, NOW);
  assert.equal(range.fromMs, from);
  assert.equal(new Date(range.toMs).getHours(), 23);
  assert.ok(inRange(new Date(2026, 0, 31, 22, 0, 0).getTime(), range));
});

test("an unknown preset falls back rather than throwing", () => {
  const range = resolveRange("nope", NOW);
  assert.ok(range.fromMs < range.toMs);
});

test("isOlderThanRange is the stop signal for a newest-first feed", () => {
  const range = resolveRange("1m", NOW);
  assert.ok(isOlderThanRange(range.fromMs - 1, range));
  assert.ok(!isOlderThanRange(range.fromMs, range));
  assert.ok(!isOlderThanRange(NOW, range));
  assert.ok(!isOlderThanRange(null, range), "an undated item never ends the run");
});

test("every preset is resolvable", () => {
  for (const id of Object.keys(RANGE_PRESETS)) {
    const range = resolveRange(id, NOW);
    assert.ok(Number.isFinite(range.fromMs) && Number.isFinite(range.toMs), id);
    assert.ok(range.fromMs < range.toMs, id);
  }
});
