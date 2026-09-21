/**
 * Pacing between feed pages.
 *
 * Without this the collector asks for the next page the instant the previous
 * one lands, which on a large run means hundreds of requests in a couple of
 * minutes. That rate is the one thing about this tool that does not look like
 * a person reading a profile — everything else already is, because the
 * requests are the site's own.
 *
 * The pause is randomised rather than fixed. A constant interval is itself a
 * signature; jitter makes the gaps look like a human deciding when to scroll.
 * It costs roughly a second per page, which on a 25-item run is invisible and
 * on a 500-item run is the difference between "fast reader" and "script".
 */

export const PACE = {
  minMs: 700,
  maxMs: 1800,
};

/** A fresh randomised gap, in ms. */
export function nextDelay({ minMs, maxMs } = PACE) {
  return Math.round(minMs + Math.random() * (maxMs - minMs));
}

/**
 * Wait, unless the run is stopped first.
 *
 * Registered with the stop signal so pressing Stop during a pause ends the run
 * immediately rather than after the remaining delay — otherwise Stop would feel
 * broken for up to `maxMs` on every page boundary.
 *
 * @returns {Promise<boolean>} false if the wait was cut short by Stop
 */
export function pause(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.requested) return resolve(false);
    if (!(ms > 0)) return resolve(true);

    // The stop signal settles every waiter with null, because its other
    // callers (waiting on a tile) treat null as "no element". Normalise here
    // so this function keeps the boolean contract it advertises.
    const done = (value) => resolve(value === true);

    const waiter = signal ? signal.register(done) : { resolve: done, timer: null, settled: false };
    const settle = (value) => (signal ? signal.settle(waiter, value) : done(value));

    waiter.timer = setTimeout(() => settle(true), ms);
  });
}

/**
 * Estimate how long a run of `pages` pages spends paused, for the popup's
 * warning. Uses the midpoint, since the actual total is random.
 */
export function estimatePauseMs(pages, { minMs, maxMs } = PACE) {
  return Math.max(0, pages - 1) * ((minMs + maxMs) / 2);
}
