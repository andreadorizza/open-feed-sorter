import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../src/core/export/csv.js";
import { toJson } from "../src/core/export/json.js";
import { buildColumns } from "../src/core/export/columns.js";

const base = { author: "a", url: "https://x/1", createdAtMs: Date.UTC(2026, 0, 2), caption: "hi" };

test("emits a BOM and CRLF line endings for Excel", () => {
  const csv = toCsv([base]);
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes("\r\n"));
});

test("quotes commas, quotes and newlines", () => {
  const csv = toCsv([{ ...base, caption: 'a,b "c" \n d' }]);
  assert.ok(csv.includes('"a,b ""c"" \n d"'));
});

test("quotes values with meaningful leading or trailing space", () => {
  const csv = toCsv([{ ...base, caption: "  padded  " }]);
  assert.ok(csv.includes('"  padded  "'));
});

test("columns appear only when some item carries them", () => {
  const withViews = buildColumns([{ ...base, views: 10 }]).map((c) => c.header);
  assert.ok(withViews.includes("Views"));

  const withoutViews = buildColumns([{ ...base, views: null }]).map((c) => c.header);
  assert.ok(!withoutViews.includes("Views"));
  // Identity columns are always present, even when empty.
  assert.ok(withoutViews.includes("Profile"));
  assert.ok(withoutViews.includes("Caption"));
});

test("dates export as ISO strings", () => {
  assert.ok(toCsv([base]).includes("2026-01-02T00:00:00.000Z"));
});

test("json export drops captured markup but keeps the metrics", () => {
  const payload = JSON.parse(toJson([{ ...base, views: 7, html: "<div>huge</div>" }]));
  assert.equal(payload.items[0].views, 7);
  assert.equal(payload.items[0].html, undefined);
  assert.equal(payload.generator, "sort-feed-for-free");
  assert.ok(payload.exportedAt);
});
