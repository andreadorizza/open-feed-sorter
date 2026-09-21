import { test } from "node:test";
import assert from "node:assert/strict";
import { makeProfileDom, reelsPage } from "../test-utils/dom.js";
import { Collector } from "../src/page/runtime/collector.js";
import { StopSignal } from "../src/page/runtime/abort.js";
import instagram from "../src/adapters/instagram.js";
import { resolveRange } from "../src/core/dates.js";

function setup(config, page = null) {
  const env = makeProfileDom();
  const signal = new StopSignal();
  const progress = [];
  const collector = new Collector({
    adapter: instagram,
    config: { platform: "instagram", surface: "reels", ...config },
    signal,
    onProgress: (p) => progress.push(p),
  });
  return { env, signal, collector, progress, page };
}

test("collects up to the requested count and stops there", async () => {
  const { env, collector } = setup({ mode: "count", count: 3 });
  const codes = ["A", "B", "C", "D", "E"];
  for (const code of codes) env.addTile(code);

  collector.acceptPage(reelsPage(codes, true));
  const result = await collector.finished();

  assert.equal(result.reason, "count-reached");
  assert.equal(result.items.length, 3);
  assert.deepEqual(result.items.map((i) => i.code), ["A", "B", "C"]);
  env.teardown();
});

test("captures each tile's markup so it can be re-laid-out later", async () => {
  const { env, collector } = setup({ mode: "count", count: 2 });
  env.addTile("A");
  env.addTile("B");

  collector.acceptPage(reelsPage(["A", "B"], false));
  const result = await collector.finished();

  assert.ok(result.items[0].html.includes('href="/creator/reel/A/"'));
  assert.ok(result.items[0].html.includes("cdn/A.jpg"));
  env.teardown();
});

test("stops when the feed says there is nothing more", async () => {
  const { env, collector } = setup({ mode: "count", count: 50 });
  env.addTile("A");
  env.addTile("B");

  collector.acceptPage(reelsPage(["A", "B"], false));
  const result = await collector.finished();

  assert.equal(result.reason, "feed-exhausted");
  assert.equal(result.items.length, 2);
  assert.equal(result.feedExhausted, true);
  env.teardown();
});

test("deduplicates items that appear on more than one page", async () => {
  const { env, collector } = setup({ mode: "count", count: 10 });
  for (const code of ["A", "B", "C"]) env.addTile(code);

  collector.acceptPage(reelsPage(["A", "B"], true));
  collector.acceptPage(reelsPage(["B", "C"], false, 1));
  const result = await collector.finished();

  assert.deepEqual(result.items.map((i) => i.code), ["A", "B", "C"]);
  env.teardown();
});

test("stop finishes immediately with whatever has been collected", async () => {
  const { env, collector, signal } = setup({ mode: "count", count: 100 });
  env.addTile("A");

  collector.acceptPage(reelsPage(["A", "B", "C"], true));
  // Let the first item land, then abort.
  await new Promise((r) => setTimeout(r, 30));
  signal.stop();

  const result = await collector.finished();
  assert.equal(result.reason, "stopped");
  assert.ok(result.items.length >= 1);
  env.teardown();
});

test("an item older than the range ends a date run", async () => {
  const now = Date.now();
  const range = resolveRange("1w", now);
  const { env, collector } = setup({ mode: "range", range: "1w", resolvedRange: range });

  const page = reelsPage(["A", "B", "C"], true);
  const edges = page.data.xdt_api__v1__clips__user__connection_v2.edges;
  // A and B inside the window, C well outside it. Dates come from the id, so
  // they are set by overriding taken_at, which takes precedence.
  edges[0].node.media.taken_at = Math.floor((now - 1 * 86400_000) / 1000);
  edges[1].node.media.taken_at = Math.floor((now - 2 * 86400_000) / 1000);
  edges[2].node.media.taken_at = Math.floor((now - 90 * 86400_000) / 1000);

  for (const code of ["A", "B", "C"]) env.addTile(code);
  collector.acceptPage(page);
  const result = await collector.finished();

  assert.equal(result.reason, "range-complete");
  assert.deepEqual(result.items.map((i) => i.code), ["A", "B"]);
  env.teardown();
});

test("a pinned item outside the range does not end the run", async () => {
  const now = Date.now();
  const range = resolveRange("1w", now);
  const { env, collector } = setup({ mode: "range", range: "1w", resolvedRange: range });

  const page = reelsPage(["P", "A", "B"], false);
  const edges = page.data.xdt_api__v1__clips__user__connection_v2.edges;
  // Platforms float a pinned post to the top whatever its age; treating it as
  // proof we've paged past the window would truncate the run at item one.
  edges[0].node.media.taken_at = Math.floor((now - 400 * 86400_000) / 1000);
  edges[0].node.media.clips_tab_pinned_user_ids = [1];
  edges[1].node.media.taken_at = Math.floor((now - 1 * 86400_000) / 1000);
  edges[2].node.media.taken_at = Math.floor((now - 2 * 86400_000) / 1000);

  for (const code of ["P", "A", "B"]) env.addTile(code);
  collector.acceptPage(page);
  const result = await collector.finished();

  assert.deepEqual(result.items.map((i) => i.code), ["A", "B"], "run continued past the pin");
  env.teardown();
});

test("the baseline pool keeps items the date filter rejected", async () => {
  const now = Date.now();
  const range = resolveRange("1w", now);
  const { env, collector } = setup({ mode: "range", range: "1w", resolvedRange: range });

  const page = reelsPage(["A", "OLD"], false);
  const edges = page.data.xdt_api__v1__clips__user__connection_v2.edges;
  edges[0].node.media.taken_at = Math.floor((now - 1 * 86400_000) / 1000);
  edges[1].node.media.taken_at = Math.floor((now - 60 * 86400_000) / 1000);

  for (const code of ["A", "OLD"]) env.addTile(code);
  collector.acceptPage(page);
  const result = await collector.finished();

  assert.equal(result.items.length, 1, "only the in-range item is displayed");
  assert.equal(result.pool.length, 2, "but both feed the outlier baseline");
  env.teardown();
});

test("reports progress as items land", async () => {
  const { env, collector, progress } = setup({ mode: "count", count: 3 });
  for (const code of ["A", "B", "C"]) env.addTile(code);

  collector.acceptPage(reelsPage(["A", "B", "C"], false));
  await collector.finished();

  assert.deepEqual(progress.map((p) => p.collected), [1, 2, 3]);
  assert.deepEqual(progress.map((p) => p.ratio), [1 / 3, 2 / 3, 1]);
  env.teardown();
});

test("an item whose tile never renders is still collected", async () => {
  // Losing the markup costs the thumbnail, not the row: the metrics came from
  // the API and the export must still contain it.
  const { env, collector } = setup({ mode: "count", count: 2 });
  env.addTile("A");
  // "B" never gets a tile.

  collector.acceptPage(reelsPage(["A", "B"], false));
  const result = await collector.finished();

  assert.equal(result.items.length, 2);
  assert.ok(result.items[0].html);
  assert.equal(result.items[1].html, undefined);
  env.teardown();
});

test("responses that are not feed pages are ignored", async () => {
  const { env, collector } = setup({ mode: "count", count: 5 });
  assert.equal(collector.acceptPage({ data: { something_else: {} } }), false);
  assert.equal(collector.acceptPage({}), false);
  env.teardown();
});
