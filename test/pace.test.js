import { test } from "node:test";
import assert from "node:assert/strict";
import { PACE, nextDelay, pause, estimatePauseMs } from "../src/page/runtime/pace.js";
import { StopSignal } from "../src/page/runtime/abort.js";

test("delays fall inside the configured window", () => {
  for (let i = 0; i < 200; i++) {
    const ms = nextDelay();
    assert.ok(ms >= PACE.minMs && ms <= PACE.maxMs, `${ms} outside window`);
  }
});

test("delays vary, so the gap is not itself a signature", () => {
  const seen = new Set();
  for (let i = 0; i < 50; i++) seen.add(nextDelay());
  assert.ok(seen.size > 10, `only ${seen.size} distinct delays in 50 draws`);
});

test("a custom window is honoured", () => {
  for (let i = 0; i < 50; i++) {
    const ms = nextDelay({ minMs: 10, maxMs: 20 });
    assert.ok(ms >= 10 && ms <= 20);
  }
});

test("pause waits and reports completion", async () => {
  const started = Date.now();
  const finished = await pause(60);
  assert.equal(finished, true);
  // Timers fire no earlier than asked; allow slack for a loaded machine.
  assert.ok(Date.now() - started >= 50, "returned too early");
});

test("stop cuts a pause short instead of running it out", async () => {
  const signal = new StopSignal();
  const started = Date.now();

  const waiting = pause(5000, signal);
  setTimeout(() => signal.stop(), 30);

  assert.equal(await waiting, false, "reports it was interrupted");
  assert.ok(Date.now() - started < 1000, "Stop must not wait for the full delay");
});

test("a pause on an already-stopped run returns immediately", async () => {
  const signal = new StopSignal();
  signal.stop();
  const started = Date.now();
  assert.equal(await pause(5000, signal), false);
  assert.ok(Date.now() - started < 200);
});

test("a zero or negative delay does not wait", async () => {
  assert.equal(await pause(0), true);
  assert.equal(await pause(-5), true);
});

test("the estimate counts gaps between pages, not pages", () => {
  // One page needs no pause; ten pages have nine gaps.
  assert.equal(estimatePauseMs(1), 0);
  assert.equal(estimatePauseMs(0), 0);
  const mid = (PACE.minMs + PACE.maxMs) / 2;
  assert.equal(estimatePauseMs(10), 9 * mid);
});
