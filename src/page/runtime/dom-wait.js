/**
 * Waiting for the platform to render the tile that matches a feed item.
 *
 * The feed payload arrives before the DOM that displays it, and we need the
 * DOM: a run captures each tile's markup so it can be re-laid-out in sorted
 * order after the platform has recycled the original off-screen.
 */

/**
 * Poll for an element, settling early if the run is stopped.
 *
 * @returns {Promise<Element|null>} null on timeout or stop
 */
export function waitForElement(selector, { signal, timeoutMs = 3000, intervalMs = 100 } = {}) {
  return new Promise((resolve) => {
    const immediate = document.querySelector(selector);
    if (immediate) return resolve(immediate);
    if (signal?.requested) return resolve(null);

    const waiter = signal ? signal.register(resolve) : { resolve, timer: null, settled: false };
    const settle = (value) => (signal ? signal.settle(waiter, value) : resolve(value));

    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      if (waiter.settled) return;
      const element = document.querySelector(selector);
      if (element) return settle(element);
      if (Date.now() >= deadline) return settle(null);
      waiter.timer = setTimeout(tick, intervalMs);
    };
    waiter.timer = setTimeout(tick, intervalMs);
  });
}

/**
 * True once a tile is showing real media rather than a placeholder.
 *
 * Both platforms mount a tile with a transparent GIF or a blank background and
 * swap in the real image once it loads. Capturing during that window produces
 * a tile that renders empty in the sorted grid, because the markup we cloned
 * genuinely points at nothing.
 */
export function hasLoadedMedia(tile) {
  if (!tile) return false;

  const img = tile.querySelector("img[src]");
  const src = img?.getAttribute("src") || "";
  if (src && !src.startsWith("data:image/gif")) return !isHiddenUntilLoad(img);

  const bgHost = tile.querySelector('[style*="background-image"]');
  const bg = bgHost?.style?.backgroundImage?.match(/url\(["']?(.*?)["']?\)/)?.[1] || "";
  return Boolean(bg) && !bg.startsWith("data:image/gif");
}

/**
 * A real `src` is not yet a loaded image. Instagram mounts a tile's <img> with
 * its final URL and `visibility: hidden`, and clears the style from the
 * image's load handler, about half a second later.
 */
function isHiddenUntilLoad(img) {
  return img.style?.visibility === "hidden";
}

/**
 * The tile's markup as it looks once its media has loaded.
 *
 * The copy in the sorted grid has none of the platform's handlers, so an image
 * captured while hidden for loading would stay hidden for good — a blank tile.
 * Unhiding it is safe: the copy fetches the same URL and shows it when it
 * arrives. The live tile is cloned first, so the platform's DOM is untouched.
 */
export function tileMarkup(tile) {
  const copy = tile.cloneNode(true);
  for (const img of copy.querySelectorAll("img[src]")) {
    if (isHiddenUntilLoad(img)) img.style.removeProperty("visibility");
  }
  return copy.outerHTML;
}

/** Wait for a tile's media to load, giving up (but still returning the tile) on timeout. */
export function waitForMedia(tile, { signal, timeoutMs = 3000, intervalMs = 100 } = {}) {
  return new Promise((resolve) => {
    if (!tile) return resolve(null);
    if (hasLoadedMedia(tile)) return resolve(tile);
    if (signal?.requested) return resolve(null);

    const waiter = signal ? signal.register(resolve) : { resolve, timer: null, settled: false };
    const settle = (value) => (signal ? signal.settle(waiter, value) : resolve(value));

    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      if (waiter.settled) return;
      if (hasLoadedMedia(tile)) return settle(tile);
      // Timing out is not a failure: a tile that never loaded its image is
      // still worth keeping, since its caption, link and counts are intact.
      if (Date.now() >= deadline) return settle(tile);
      waiter.timer = setTimeout(tick, intervalMs);
    };
    waiter.timer = setTimeout(tick, intervalMs);
  });
}
