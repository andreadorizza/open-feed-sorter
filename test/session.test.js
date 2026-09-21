import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { saveRun, peekRun, claimRun, takeRun, clearRun } from "../src/core/session.js";

/** A minimal sessionStorage; the module only uses get/set/remove. */
beforeEach(() => {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

const CONFIG = { platform: "instagram", surface: "reels", sortBy: "views", mode: "count", count: 25 };

test("a saved run round-trips", () => {
  saveRun(CONFIG);
  assert.deepEqual(peekRun(), CONFIG);
});

test("peek does not consume the record", () => {
  saveRun(CONFIG);
  peekRun();
  assert.notEqual(peekRun(), null);
});

test("claiming stamps the record so the other world can still read it", () => {
  // The page world claims at document_start; the content script reads the same
  // record at document_idle. Claiming must not delete it.
  saveRun(CONFIG);
  const claimed = claimRun();
  assert.equal(claimed.sortBy, "views");
  assert.ok(Number.isFinite(claimed.claimedAt));

  const stillThere = peekRun();
  assert.ok(stillThere, "record survives the claim for the content script");
  assert.ok(stillThere.claimedAt);
});

test("a second claim is refused, so a refresh cannot re-run a sort", () => {
  saveRun(CONFIG);
  claimRun();
  assert.equal(claimRun(), null);
  assert.equal(peekRun(), null, "the stale record is cleaned up");
});

test("takeRun reads and deletes, so the next load starts clean", () => {
  saveRun(CONFIG);
  claimRun();
  const taken = takeRun();
  assert.equal(taken.sortBy, "views");
  assert.equal(peekRun(), null);
});

test("an unclaimed record taken by the content script means the page world never ran", () => {
  saveRun(CONFIG);
  const taken = takeRun();
  assert.equal(taken.claimedAt, undefined);
});

test("claiming nothing is safe", () => {
  assert.equal(claimRun(), null);
  assert.equal(takeRun(), null);
});

test("a corrupt record does not throw", () => {
  sessionStorage.setItem("sfb:run", "{not json");
  assert.equal(peekRun(), null);
  assert.equal(claimRun(), null);
});

test("survives storage being unavailable", () => {
  globalThis.sessionStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.equal(saveRun(CONFIG), false, "the caller is told the run cannot start");
  assert.equal(peekRun(), null);
  assert.doesNotThrow(() => clearRun());
});
