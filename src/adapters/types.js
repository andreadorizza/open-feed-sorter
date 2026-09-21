/**
 * The adapter contract.
 *
 * Everything platform-specific lives behind this interface: which requests
 * carry a feed page, how to read items out of one, and how to find the
 * matching tile in the DOM. Adding a platform means writing one of these — no
 * other module needs to know it exists.
 *
 * @typedef {object} FeedItem
 * @property {string} id              platform's own id for the item
 * @property {string} code            short code used in the item's URL
 * @property {string} url             canonical permalink
 * @property {string} platform
 * @property {string} surface
 * @property {string} author          username, without a leading @
 * @property {string} caption
 * @property {number|null} createdAtMs
 * @property {number|null} views
 * @property {number|null} likes
 * @property {number|null} comments
 * @property {number|null} shares
 * @property {number|null} saves
 * @property {boolean} isPinned       platforms float pinned items regardless of date
 * @property {boolean} isVideo
 * @property {string|null} thumbnailUrl
 * @property {string} [html]          captured outerHTML of the item's grid tile
 * @property {number|null} [outlierScore]
 *
 * @typedef {object} FeedPage
 * @property {object[]} items   raw, unnormalised platform objects
 * @property {boolean} hasMore
 *
 * @typedef {object} Adapter
 * @property {string} id
 * @property {string} label
 * @property {string[]} metrics                     fields this platform populates
 * @property {() => string|null} detectSurface      current surface, or null if unsupported
 * @property {(url: string) => boolean} matchesFeedRequest
 * @property {(json: any, surface: string) => FeedPage|null} extractPage
 * @property {(raw: any, ctx: {surface: string}) => FeedItem} normalize
 * @property {(item: FeedItem) => string} tileSelector   CSS selector for the item's anchor
 * @property {() => Element|null} gridContainer
 */

/**
 * Find the element that contains every tile anchor on the page.
 *
 * Both platforms render their profile grid as rows inside one container and
 * change the class names on it regularly, so the container is identified by
 * what it holds rather than by any attribute: climb from an anchor until the
 * node contains all of them.
 */
export function findCommonAncestor(selector, root = document) {
  const anchors = Array.from(root.querySelectorAll(selector));
  if (anchors.length === 0) return null;

  let node = anchors[0].parentElement;
  while (node && node !== document.body) {
    if (anchors.every((anchor) => node.contains(anchor))) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Climb from an anchor to the largest ancestor that still contains only this
 * one tile — that element is the tile, whatever the current markup calls it.
 */
export function tileFor(anchor, selector) {
  let node = anchor;
  while (
    node.parentElement &&
    node.parentElement !== document.body &&
    node.parentElement.querySelectorAll(selector).length === 1
  ) {
    node = node.parentElement;
  }
  return node;
}

/** Coerce a platform count to a number, keeping null distinct from zero. */
export function num(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Pick the widest image candidate; platforms don't guarantee ordering. */
export function widestCandidate(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return null;
  let best = null;
  let bestWidth = -1;
  for (const candidate of candidates) {
    const width = Number(candidate?.width) || 0;
    if (candidate?.url && width > bestWidth) {
      bestWidth = width;
      best = candidate.url;
    }
  }
  return best;
}
