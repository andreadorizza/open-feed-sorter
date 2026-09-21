/**
 * The collect loop.
 *
 * One run looks like this:
 *
 *   network hook  ──▶ queue ──▶ drain loop ──▶ capture tile ──▶ items[]
 *                                    │
 *                                    └─ need more? ─▶ scroll ─▶ (site fetches) ─┐
 *                                                                              │
 *                                       ◀──────────────────────────────────────┘
 *
 * Pages are queued rather than processed inline because the hook is
 * synchronous and several pages can land while we're still waiting on the DOM
 * for the first one. A single drain loop keeps feed order intact, which
 * matters: both feeds are newest-first, and a date run relies on that to know
 * when it has gone far enough back.
 */

import { waitForElement, waitForMedia } from "./dom-wait.js";
import { PendingPage, requestNextPage } from "./scroll.js";
import { nextDelay, pause } from "./pace.js";
import { inRange, isOlderThanRange } from "../../core/dates.js";
import { qualifies } from "../../core/outlier.js";

export class Collector {
  /**
   * @param {object} options
   * @param {import("../../adapters/types.js").Adapter} options.adapter
   * @param {import("../../core/session.js").RunConfig} options.config
   * @param {import("./abort.js").StopSignal} options.signal
   * @param {(progress: object) => void} options.onProgress
   * @param {{metric: string, need: number, maxExtra: number}|null} [options.baseline]
   *   when set, keep reading past the finish line — into the pool only — until
   *   `need` items qualify for an outlier baseline or `maxExtra` more have been
   *   read. Without this a short run has too few posts to score.
   */
  constructor({ adapter, config, signal, onProgress, baseline = null }) {
    this.adapter = adapter;
    this.config = config;
    this.signal = signal;
    this.onProgress = onProgress || (() => {});
    this.baseline = baseline;

    /** @type {import("../../adapters/types.js").FeedItem[]} */
    this.items = [];
    /** Every item seen, including ones filtered out — the outlier baseline pool. */
    this.pool = [];

    this._seen = new Set();
    this._queue = [];
    this._draining = false;
    this._pending = new PendingPage();
    this._feedExhausted = false;
    this._doneResolve = null;
    this._finished = false;

    /** Set once the displayed set is complete; the run may still be topping up the pool. */
    this._displayReason = null;
    this._qualifying = 0;
    this._extraRead = 0;

    this._done = new Promise((resolve) => {
      this._doneResolve = resolve;
    });

    // Stopping while topping up the pool loses nothing the user asked for.
    signal.onStop(() => this._finish(this._displayReason || "stopped"));
  }

  /** Called by the network hook for each parsed feed response. */
  acceptPage(json) {
    const page = this.adapter.extractPage(json, this.config.surface);
    if (!page) return false;

    this._queue.push(page);
    this._pending.signal();
    this._drain();
    return true;
  }

  /** Resolves when the run finishes, however it finishes. */
  finished() {
    return this._done;
  }

  get target() {
    return this.config.mode === "count" ? this.config.count : null;
  }

  async _drain() {
    if (this._draining) return;
    this._draining = true;

    try {
      while (!this.signal.requested) {
        const page = this._queue.shift();
        if (!page) break;

        const reachedEnd = await this._processPage(page);
        if (reachedEnd) return;

        if (this._queue.length > 0) continue;

        if (!page.hasMore) {
          this._feedExhausted = true;
          this._finish(this._displayReason || "feed-exhausted");
          return;
        }

        // Nothing queued and the feed says there is more. Pause before asking,
        // so a long run reads as someone scrolling rather than as a script —
        // see pace.js.
        const paced = await pause(nextDelay(), this.signal);
        if (!paced || this.signal.requested) return;

        this._pending.arm();
        const container = this.adapter.gridContainer();
        const arrived = await requestNextPage(container, this._pending, { signal: this.signal });
        if (!arrived) {
          this._finish(this._displayReason || "stalled");
          return;
        }
      }
    } finally {
      this._draining = false;
    }
  }

  /** @returns {Promise<boolean>} true when the run's finish condition was met */
  async _processPage(page) {
    const { adapter, config } = this;
    const range = config.mode === "range" ? config.resolvedRange : null;

    for (const raw of page.items) {
      if (this.signal.requested) return true;

      const item = adapter.normalize(raw, { surface: config.surface });
      if (!item.id || this._seen.has(item.id)) continue;
      this._seen.add(item.id);

      // The pool feeds the outlier baseline and deliberately holds everything,
      // including items a date filter rejects — the baseline describes the
      // account, not the slice being displayed.
      this.pool.push(item);
      if (this.baseline && qualifies(item, { metric: this.baseline.metric })) this._qualifying++;

      if (this._displayReason) {
        // Past the finish line: this item only feeds the baseline.
        this._extraRead++;
        this._emitProgress();
        if (this._baselineSettled()) {
          this._finish(this._displayReason);
          return true;
        }
        continue;
      }

      if (range) {
        // Pinned items sit out of chronological order at the top of the feed,
        // so one falling outside the range says nothing about how deep we are.
        if (!item.isPinned && isOlderThanRange(item.createdAtMs, range)) {
          if (this._completeDisplay("range-complete")) return true;
          continue;
        }
        if (!inRange(item.createdAtMs, range)) continue;
      }

      const captured = await this._captureTile(item);
      if (this.signal.requested) return true;
      if (captured) item.html = captured;

      this.items.push(item);
      this._emitProgress();

      if (this.target && this.items.length >= this.target) {
        if (this._completeDisplay("count-reached")) return true;
      }
    }

    return false;
  }

  /**
   * The displayed set is complete. Finish now, or keep reading for the
   * baseline if the pool is still too thin to score.
   *
   * @returns {boolean} true when the run finished
   */
  _completeDisplay(reason) {
    this._displayReason = reason;
    if (this._baselineSettled()) {
      this._finish(reason);
      return true;
    }
    this._emitProgress();
    return false;
  }

  _baselineSettled() {
    if (!this.baseline) return true;
    return this._qualifying >= this.baseline.need || this._extraRead >= this.baseline.maxExtra;
  }

  /**
   * Snapshot the tile's markup.
   *
   * Cloning the rendered tile rather than rebuilding one from the JSON is what
   * makes the sorted grid look native: it inherits the platform's own layout,
   * hover states, badges and image URLs, and keeps working when they redesign
   * the tile. It is also necessary — the image URLs are short-lived and
   * signed, so a tile rebuilt later would show broken images.
   */
  async _captureTile(item) {
    const anchor = await waitForElement(this.adapter.tileSelector(item), {
      signal: this.signal,
      timeoutMs: 3000,
    });
    if (!anchor) return null;

    const tile = this.adapter.tileFor(anchor);
    if (!tile) return null;

    // Bring the tile into view so the platform's lazy loader fetches its image
    // — and, as a side effect, so long runs keep making scroll progress.
    tile.scrollIntoView({ behavior: "auto", block: "center" });

    const ready = await waitForMedia(tile, { signal: this.signal, timeoutMs: 3000 });
    return ready ? ready.outerHTML : tile.outerHTML;
  }

  _emitProgress() {
    const collected = this.items.length;
    let ratio = null;

    if (this.target) {
      ratio = Math.min(1, collected / this.target);
    } else if (this.config.mode === "range" && this.config.resolvedRange) {
      // A date run's finish line is a date, not a count. The feed is
      // newest-first, so how far back the newest un-collected item sits is a
      // real, monotonic measure of progress.
      const { fromMs, toMs } = this.config.resolvedRange;
      const last = this.items[collected - 1]?.createdAtMs;
      if (Number.isFinite(last) && toMs > fromMs) {
        ratio = Math.min(1, Math.max(0, (toMs - last) / (toMs - fromMs)));
      }
    }

    if (this._displayReason) {
      // Topping up the baseline: progress is toward enough scorable posts.
      const { need, maxExtra } = this.baseline;
      ratio = Math.min(1, Math.max(this._qualifying / need, this._extraRead / maxExtra));
      this.onProgress({ collected, target: this.target, ratio, phase: "baseline" });
      return;
    }

    this.onProgress({ collected, target: this.target, ratio, phase: "collect" });
  }

  _finish(reason) {
    if (this._finished) return;
    this._finished = true;
    this._doneResolve({
      items: this.items,
      pool: this.pool,
      reason,
      feedExhausted: this._feedExhausted,
    });
  }
}
