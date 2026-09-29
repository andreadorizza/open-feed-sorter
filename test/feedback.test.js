import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  REVIEW_ASK_AFTER_RUNS,
  recordRunStarted,
  takeReviewAsk,
  describeBrowser,
  describeDiagnostics,
} from "../src/core/feedback.js";

const root = resolve(import.meta.dirname, "..");

/** A minimal localStorage; the module only uses get/set. */
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
});

function startRuns(n) {
  for (let i = 0; i < n; i++) recordRunStarted();
}

test("no review request before enough sorts", () => {
  startRuns(REVIEW_ASK_AFTER_RUNS - 1);
  assert.equal(takeReviewAsk(), false);
});

test("the review request comes once, and never again", () => {
  startRuns(REVIEW_ASK_AFTER_RUNS);
  assert.equal(takeReviewAsk(), true);
  assert.equal(takeReviewAsk(), false);
  startRuns(10);
  assert.equal(takeReviewAsk(), false);
});

test("storage that cannot be written means no request, not one every time", () => {
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ runs: 99, asked: false }),
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.doesNotThrow(() => recordRunStarted());
  assert.equal(takeReviewAsk(), false);
});

test("storage that cannot be read means no request", () => {
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {},
  };
  assert.doesNotThrow(() => recordRunStarted());
  assert.equal(takeReviewAsk(), false);
});

test("the browser is named by its real brand, not the placeholder or Chromium", () => {
  const brands = [
    { brand: "Not)A;Brand", version: "8" },
    { brand: "Chromium", version: "138" },
    { brand: "Brave", version: "138" },
  ];
  assert.equal(describeBrowser(brands), "Brave 138");
  assert.equal(describeBrowser(brands.slice(0, 2)), "Chromium 138");
});

test("without userAgentData, the browser falls back to the user agent", () => {
  const ua = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
  assert.equal(describeBrowser(undefined, ua), "Chromium 138");
  assert.equal(describeBrowser([], ""), "unknown browser");
});

const BASE = { version: "0.1.0", browser: "Google Chrome 138", os: "macOS", tab: "Instagram, Reels tab of a profile" };

test("debug info for a finished sort says how it ended and with what settings", () => {
  const text = describeDiagnostics({
    ...BASE,
    lastRun: {
      surface: "reels",
      sortBy: "outlier",
      mode: "count",
      count: 100,
      outcome: "done",
      items: 100,
      reason: "count-reached",
      outlier: "ok",
    },
  });
  assert.deepEqual(text.split("\n"), [
    "Open Feed Sorter 0.1.0",
    "Browser: Google Chrome 138 on macOS",
    "Tab: Instagram, Reels tab of a profile",
    "Last sort: sorted 100 (ended: count-reached)",
    "Settings: reels, sort by outlier, latest 100",
    "Outlier baseline: ok",
  ]);
});

test("debug info carries a failure's message and the run's range", () => {
  const text = describeDiagnostics({
    ...BASE,
    lastRun: { surface: "videos", sortBy: "views", mode: "range", range: "3m", outcome: "failed", error: "boom" },
  });
  assert.match(text, /^Last sort: failed: boom$/m);
  assert.match(text, /^Settings: videos, sort by views, posted within 3m$/m);
  assert.doesNotMatch(text, /Outlier/);
});

test("debug info names the Everything option rather than its sentinel", () => {
  const text = describeDiagnostics({
    ...BASE,
    lastRun: { surface: "posts", sortBy: "likes", mode: "count", count: 100000, outcome: "no-feed" },
  });
  assert.match(text, /, everything$/m);
  assert.match(text, /^Last sort: no feed response within 20 s$/m);
});

test("debug info without a sort in the tab says so", () => {
  assert.match(describeDiagnostics({ ...BASE, lastRun: null }), /^Last sort: none in this tab since it loaded$/m);
});

test("the popup's bug links open a form that exists and takes the version", () => {
  const popup = readFileSync(resolve(root, "src/popup/popup.html"), "utf8");
  const links = [...popup.matchAll(/href="([^"]+)"[^>]*data-bug-link/g)].map((m) => new URL(m[1]));
  assert.ok(links.length >= 1, "popup has a bug link");

  for (const url of links) {
    const template = url.searchParams.get("template");
    const path = resolve(root, ".github/ISSUE_TEMPLATE", template);
    assert.ok(existsSync(path), `${template} exists`);
    // The popup sets ?version=; GitHub fills the form field with that id.
    assert.match(readFileSync(path, "utf8"), /^\s+id: version$/m);
  }
});
