import { JSDOM } from "jsdom";

/**
 * A stand-in for a profile page: a grid of tiles that a fake feed response can
 * be matched against.
 *
 * Tiles are added lazily, the way both platforms add them — the collector has
 * to wait for each one, so a harness that pre-rendered everything would not
 * exercise the waiting at all.
 */
export function makeProfileDom({ url = "https://www.instagram.com/creator/" } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body><main><div id="grid"></div></main></body></html>`,
    { url, pretendToBeVisual: true },
  );

  const { window } = dom;
  const grid = window.document.getElementById("grid");

  // jsdom implements neither of these, and the collector calls both.
  window.Element.prototype.scrollIntoView = function () {};
  window.scrollTo = () => {};

  installGlobals(window);

  return {
    dom,
    window,
    grid,
    /** Render a tile for a code, as the platform would once its data arrives. */
    addTile(code, { loaded = true } = {}) {
      const tile = window.document.createElement("div");
      tile.innerHTML =
        `<a href="/creator/reel/${code}/">` +
        `<img src="${loaded ? `https://cdn/${code}.jpg` : "data:image/gif;base64,R0lGOD"}">` +
        `</a>`;
      grid.appendChild(tile);
      return tile;
    },
    teardown() {
      restoreGlobals();
      window.close();
    },
  };
}

const GLOBALS = [
  "window", "document", "location", "Element", "Node",
  "HTMLElement", "MutationObserver", "getComputedStyle", "XMLHttpRequest",
];
const saved = new Map();

function installGlobals(window) {
  for (const key of GLOBALS) {
    saved.set(key, globalThis[key]);
    globalThis[key] = key === "window" ? window : window[key];
  }
  // Timers are deliberately left as Node's. jsdom's window.setTimeout
  // delegates to the global one, so installing it globally recurses the
  // moment a second DOM is created in the same process.
}

function restoreGlobals() {
  for (const [key, value] of saved) globalThis[key] = value;
  saved.clear();
}

/** Build a feed page in Instagram's reels shape. */
export function reelsPage(codes, hasMore = false, startIndex = 0) {
  return {
    data: {
      xdt_api__v1__clips__user__connection_v2: {
        edges: codes.map((code, i) => {
          const n = startIndex + i;
          return {
            node: {
              media: {
                // Descending ids so the feed reads newest-first, as both
                // platforms serve it.
                pk: String(3_000_000_000_000_000_000n - BigInt(n) * 100_000_000_000n),
                code,
                media_type: 2,
                play_count: (100 - n) * 1000,
                like_count: (100 - n) * 10,
                comment_count: n,
                user: { username: "creator" },
                caption: { text: `post ${code}` },
              },
            },
          };
        }),
        page_info: { has_next_page: hasMore },
      },
    },
  };
}
