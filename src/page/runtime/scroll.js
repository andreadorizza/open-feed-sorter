/**
 * Driving pagination.
 *
 * We never call the feed API ourselves. Those endpoints are signed, rate
 * limited and change without notice; a request we forge is also a request the
 * platform can tell apart from its own. Instead we scroll the page the way a
 * reader would, let the site's own infinite scroll fire the next request, and
 * catch it in the hook. The traffic is exactly the traffic normal use
 * produces, in the same order and with the same headers.
 */

/** Scroll far enough to cross the platform's "load more" threshold. */
export function nudgeForNextPage(container) {
  const lastTile = container?.lastElementChild;
  if (lastTile && typeof lastTile.scrollIntoView === "function") {
    lastTile.scrollIntoView({ behavior: "auto", block: "end" });
  }
  // Scrolling to the bottom of the document as well covers the case where the
  // grid is virtualised and its last child is not the lowest thing on screen.
  window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" });
}

/**
 * Ask for another page and wait for it, retrying the scroll a few times.
 *
 * A single scroll is not reliable: the platform may be mid-render, or the
 * scroll may land short of the threshold. Retrying turns a missed nudge into a
 * slightly slower run instead of a stalled one.
 *
 * @returns {Promise<boolean>} true if a page arrived
 */
export async function requestNextPage(container, pending, { signal, attempts = 4, waitMs = 3500 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.requested) return false;

    nudgeForNextPage(container);

    const arrived = await pending.wait(waitMs, signal);
    if (arrived) return true;
  }
  return false;
}

/**
 * A one-shot latch the network hook resolves when the next page lands.
 *
 * Reset before each nudge so a page that arrived earlier can't satisfy a later
 * wait.
 */
export class PendingPage {
  constructor() {
    this._resolve = null;
  }

  arm() {
    this._resolve = null;
  }

  /** Called from the hook when a feed page is parsed. */
  signal() {
    const resolve = this._resolve;
    this._resolve = null;
    if (resolve) resolve(true);
  }

  wait(timeoutMs, signal) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        this._resolve = null;
        clearTimeout(timer);
        unsubscribe?.();
        resolve(value);
      };

      this._resolve = () => finish(true);
      const timer = setTimeout(() => finish(false), timeoutMs);
      const unsubscribe = signal?.onStop(() => finish(false));
    });
  }
}
