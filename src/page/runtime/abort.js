/**
 * A stop signal that settles pending waits instead of only being polled.
 *
 * A run spends most of its time inside waits — for a tile to render, for the
 * next feed page to land. Polling a boolean between those waits means Stop can
 * take as long as the current wait's timeout to be noticed, which deep into a
 * run is several seconds of a button that looks broken. Registering each wait
 * here lets Stop settle all of them at once.
 */

export class StopSignal {
  constructor() {
    this.requested = false;
    this._waiters = new Set();
    this._listeners = new Set();
  }

  /** Register a pending wait. The caller parks its timer id on `.timer`. */
  register(resolve) {
    const waiter = { resolve, timer: null, settled: false };
    this._waiters.add(waiter);
    return waiter;
  }

  /** Settle one wait exactly once, clearing its timer and registration. */
  settle(waiter, value) {
    if (waiter.settled) return;
    waiter.settled = true;
    clearTimeout(waiter.timer);
    this._waiters.delete(waiter);
    try {
      waiter.resolve(value);
    } catch {
      /* a throwing consumer must not strand the other waiters */
    }
  }

  onStop(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Idempotent: cut every pending wait short with null, then notify. */
  stop() {
    if (this.requested) return;
    this.requested = true;

    for (const waiter of Array.from(this._waiters)) {
      this.settle(waiter, null);
    }
    this._waiters.clear();

    for (const listener of this._listeners) {
      try {
        listener();
      } catch {
        /* keep notifying the rest */
      }
    }
  }
}
