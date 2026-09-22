import { test } from "node:test";
import assert from "node:assert/strict";
import { makeProfileDom, reelsPage } from "../test-utils/dom.js";
import { Collector } from "../src/page/runtime/collector.js";
import { StopSignal } from "../src/page/runtime/abort.js";
import { PACE } from "../src/page/runtime/pace.js";
import instagram from "../src/adapters/instagram.js";
import { resolveRange } from "../src/core/dates.js";

function setup(config, { baseline = null } = {}) {
  const env = makeProfileDom();
  const signal = new StopSignal();
  const progress = [];
  const collector = new Collector({
    adapter: instagram,
    config: { platform: "instagram", surface: "reels", ...config },
    signal,
    onProgress: (p) => progress.push(p),
    baseline,
  });
  return { env, signal, collector, progress };
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

// ── baseline top-up ─────────────────────────────────────────────────────
// Fixture items are dated years back and all carry views, so each one
// qualifies for the baseline.

test("keeps reading into the pool after the count until the baseline can be scored", async () => {
  const codes = ["A", "B", "C", "D", "E", "F"];
  const { env, collector, progress } = setup(
    { mode: "count", count: 2 },
    { baseline: { metric: "views", need: 4, maxExtra: 10 } },
  );
  for (const code of codes) env.addTile(code);

  collector.acceptPage(reelsPage(codes, true));
  const result = await collector.finished();

  assert.equal(result.reason, "count-reached", "the displayed set is what finished the run");
  assert.deepEqual(result.items.map((i) => i.code), ["A", "B"], "extra posts are not displayed");
  assert.deepEqual(result.pool.map((i) => i.code), ["A", "B", "C", "D"], "stops once 4 qualify");
  assert.ok(progress.some((p) => p.phase === "baseline"), "the banner can say what it is doing");
  env.teardown();
});

test("the top-up gives up after maxExtra posts", async () => {
  const codes = ["A", "B", "C", "D", "E", "F"];
  const { env, collector } = setup(
    { mode: "count", count: 2 },
    { baseline: { metric: "views", need: 50, maxExtra: 2 } },
  );
  for (const code of codes) env.addTile(code);

  collector.acceptPage(reelsPage(codes, true));
  const result = await collector.finished();

  assert.equal(result.reason, "count-reached");
  assert.equal(result.pool.length, 4);
  env.teardown();
});

test("running out of feed while topping up still reports the display reason", async () => {
  const { env, collector } = setup(
    { mode: "count", count: 2 },
    { baseline: { metric: "views", need: 50, maxExtra: 50 } },
  );
  for (const code of ["A", "B", "C"]) env.addTile(code);

  collector.acceptPage(reelsPage(["A", "B", "C"], false));
  const result = await collector.finished();

  assert.equal(result.reason, "count-reached");
  assert.equal(result.items.length, 2);
  assert.equal(result.pool.length, 3);
  env.teardown();
});

test("no top-up when the run already has enough", async () => {
  const codes = ["A", "B", "C", "D"];
  const { env, collector } = setup(
    { mode: "count", count: 3 },
    { baseline: { metric: "views", need: 2, maxExtra: 10 } },
  );
  for (const code of codes) env.addTile(code);

  collector.acceptPage(reelsPage(codes, true));
  const result = await collector.finished();

  assert.equal(result.pool.length, 3);
  env.teardown();
});

// ── page boundaries ─────────────────────────────────────────────────────
// Between pages the collector pauses (pace.js), then scrolls and gives the
// site a few chances to send the next page (scroll.js). These tests run that in
// mocked time and play the site: each scroll the collector makes is recorded,
// and pages land when the test says so.

// requestNextPage's watchdog, from scroll.js: four scrolls, 3.5 s apart.
const SCROLLS = 4;
const SCROLL_WAIT_MS = 3500;
/** Longer than any pause plus the whole watchdog. */
const RUN_OUT_MS = 30_000;

const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Move mocked time forward in small steps, letting the run react between them. */
async function advance(t, ms, stepMs = 50) {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
    await flush();
    t.mock.timers.tick(stepMs);
  }
  await flush();
}

function setupPaced(t, config) {
  const run = setup(config);
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });

  // The site: every scroll is recorded, and answered with the next page in
  // `answers` after a network round trip, if there is one.
  const nudges = [];
  const answers = [];
  run.env.window.scrollTo = () => {
    nudges.push(Date.now());
    const page = answers.shift();
    if (page) setTimeout(() => run.collector.acceptPage(page), 200);
  };
  return { ...run, nudges, answers };
}

test("a page that lands during the pause between pages is collected, not dropped", async (t) => {
  // Scrolling tiles into view while capturing them is enough for the site to
  // fetch its next page, so that page can land while the collector is pausing.
  const { env, collector, nudges } = setupPaced(t, { mode: "count", count: 50 });
  for (const code of ["A", "B", "C", "D", "E"]) env.addTile(code);

  collector.acceptPage(reelsPage(["A", "B", "C"], true));
  await advance(t, PACE.minMs / 2);
  assert.equal(collector.items.length, 3, "page one is in");
  assert.equal(nudges.length, 0, "and the collector is still pausing");

  collector.acceptPage(reelsPage(["D", "E"], false, 3));
  await advance(t, RUN_OUT_MS);

  const result = await collector.finished();
  assert.equal(result.reason, "feed-exhausted", "the last page ends the run rather than stalling it");
  assert.equal(result.feedExhausted, true);
  assert.deepEqual(result.items.map((i) => i.code), ["A", "B", "C", "D", "E"]);
  assert.equal(nudges.length, 0, "no scrolling for a page that had already arrived");
  env.teardown();
});

test("several pages landing during one pause are all collected, in feed order", async (t) => {
  const codes = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const { env, collector, nudges } = setupPaced(t, { mode: "count", count: 50 });
  for (const code of codes) env.addTile(code);

  collector.acceptPage(reelsPage(["A", "B", "C"], true));
  await advance(t, PACE.minMs / 2);
  collector.acceptPage(reelsPage(["D", "E", "F"], true, 3));
  collector.acceptPage(reelsPage(["G", "H"], false, 6));
  await advance(t, RUN_OUT_MS);

  const result = await collector.finished();
  assert.equal(result.reason, "feed-exhausted");
  assert.deepEqual(result.items.map((i) => i.code), codes);
  assert.equal(nudges.length, 0);
  env.teardown();
});

test("a page taken from the queue is counted once, and the next one is still scrolled for", async (t) => {
  const codes = ["A", "B", "C", "D", "E", "F", "G"];
  const { env, collector, nudges, answers, progress } = setupPaced(t, { mode: "count", count: 50 });
  for (const code of codes) env.addTile(code);
  answers.push(reelsPage(["G"], false, 6));

  collector.acceptPage(reelsPage(["A", "B", "C"], true));
  await advance(t, PACE.minMs / 2);
  // The same page twice, as a retried request would deliver it.
  collector.acceptPage(reelsPage(["D", "E", "F"], true, 3));
  collector.acceptPage(reelsPage(["D", "E", "F"], true, 3));
  await advance(t, RUN_OUT_MS);

  const result = await collector.finished();
  assert.equal(result.reason, "feed-exhausted");
  assert.deepEqual(result.items.map((i) => i.code), codes);
  assert.deepEqual(progress.map((p) => p.collected), [1, 2, 3, 4, 5, 6, 7], "each item counted once");
  assert.equal(nudges.length, 1, "one scroll, for the page that had not arrived yet");
  env.teardown();
});

test("a page landing just as the watchdog gives up is collected, not reported as a stall", async (t) => {
  const { env, collector, nudges } = setupPaced(t, { mode: "count", count: 50 });
  for (const code of ["A", "B", "C", "D"]) env.addTile(code);

  // The site answers only the last scroll, and only at the instant that
  // scroll's wait runs out. Its timer is set just after the watchdog's, so
  // both fire in the same tick with the watchdog's first.
  env.window.scrollTo = () => {
    nudges.push(Date.now());
    if (nudges.length < SCROLLS) return;
    queueMicrotask(() =>
      setTimeout(() => collector.acceptPage(reelsPage(["D"], false, 3)), SCROLL_WAIT_MS),
    );
  };

  collector.acceptPage(reelsPage(["A", "B", "C"], true));
  await advance(t, RUN_OUT_MS);

  const result = await collector.finished();
  assert.equal(nudges.length, SCROLLS, "the page answered the final scroll");
  assert.equal(result.reason, "feed-exhausted");
  assert.deepEqual(result.items.map((i) => i.code), ["A", "B", "C", "D"]);
  env.teardown();
});

test("stop while a page is queued keeps what was collected", async (t) => {
  const { env, collector, signal, nudges } = setupPaced(t, { mode: "count", count: 50 });
  for (const code of ["A", "B", "C", "D", "E"]) env.addTile(code);

  collector.acceptPage(reelsPage(["A", "B", "C"], true));
  await advance(t, PACE.minMs / 2);
  collector.acceptPage(reelsPage(["D", "E"], false, 3));
  signal.stop();

  const result = await collector.finished();
  assert.equal(result.reason, "stopped");
  assert.deepEqual(result.items.map((i) => i.code), ["A", "B", "C"]);

  // Stop is final: the queued page is not picked up afterwards.
  await advance(t, RUN_OUT_MS);
  assert.equal(result.items.length, 3);
  assert.equal(nudges.length, 0);
  env.teardown();
});
