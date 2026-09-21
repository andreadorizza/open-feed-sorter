/**
 * Instagram adapter.
 *
 * Instagram serves a profile feed from its private GraphQL API. Two things
 * about that API drive most of this file:
 *
 *  1. It is mid-migration from `/graphql/query` to `/api/graphql`, and the move
 *     is per-query — a single page load can use both. We match either path and
 *     let the response-shape check below reject the unrelated traffic that
 *     shares them.
 *
 *  2. The Posts timeline and the Reels tab arrive under different response
 *     keys, and the Reels key has itself moved. Every known shape is tried, so
 *     a partially-rolled-out account keeps working.
 */

import { findCommonAncestor, tileFor, num, widestCandidate } from "./types.js";

export const SURFACES = {
  posts: { label: "Posts", metrics: ["likes", "comments", "views"] },
  reels: { label: "Reels", metrics: ["views", "likes", "comments"] },
};

const TILE_SELECTOR = 'main a[href*="/p/"], main a[href*="/reel/"]';

/**
 * Both live paths, newest first. Instagram is migrating query by query, so a
 * single page load can use either — dropping the older one breaks accounts
 * that have not been moved yet.
 */
const FEED_ENDPOINTS = ["/api/graphql", "/graphql/query"];

/**
 * Instagram media ids are Snowflake-style: the high bits hold the creation
 * time in milliseconds since a fixed Instagram epoch. Reels payloads carry no
 * `taken_at`, so the post date is recovered from the id instead.
 */
const IG_EPOCH_MS = 1314220021721;
const IG_TIMESTAMP_SHIFT = 23n;

export function pkToTimestamp(pk) {
  if (pk == null || pk === "") return null;
  try {
    const ms = (BigInt(pk) >> IG_TIMESTAMP_SHIFT) + BigInt(IG_EPOCH_MS);
    const value = Number(ms);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Media type 2 is a video (a reel); 1 is a photo and 8 a carousel. */
const MEDIA_TYPE_VIDEO = 2;
const MEDIA_TYPE_CAROUSEL = 8;

export const instagramAdapter = {
  id: "instagram",
  label: "Instagram",
  surfaces: SURFACES,
  metrics: ["views", "likes", "comments"],

  detectSurface() {
    const path = location.pathname;
    // A profile path is /<username>/ with at most one more segment, which
    // keeps us off /explore/, /direct/ and the rest of the site.
    const match = path.match(/^\/([^/]+)\/?(reels|tagged|saved)?\/?$/);
    if (!match) return null;
    const reserved = new Set(["explore", "direct", "reels", "stories", "accounts", "p"]);
    if (reserved.has(match[1])) return null;
    return match[2] === "reels" ? "reels" : match[2] ? null : "posts";
  },

  profileName() {
    const match = location.pathname.match(/^\/([^/]+)/);
    return match ? match[1] : "";
  },

  matchesFeedRequest(url) {
    return typeof url === "string" && FEED_ENDPOINTS.some((path) => url.includes(path));
  },

  extractPage(json, surface) {
    const data = json?.data;
    if (!data) return null;

    const connection =
      surface === "reels"
        ? data.xdt_api__v1__clips__user__connection_v2 ||
          data.fetch__XDTUserDict?.clips_connection
        : data.xdt_api__v1__feed__user_timeline_graphql_connection;

    if (!connection || !Array.isArray(connection.edges)) return null;

    // Reels wrap the media one level deeper than the timeline does.
    const items = connection.edges
      .map((edge) => (surface === "reels" ? edge?.node?.media : edge?.node))
      .filter(Boolean);

    return { items, hasMore: !!connection.page_info?.has_next_page };
  },

  normalize(raw, { surface }) {
    const code = raw?.code || "";
    const isVideo = raw?.media_type === MEDIA_TYPE_VIDEO;
    const author = raw?.user?.username || instagramAdapter.profileName();

    // `taken_at` is authoritative when present; reels fall back to the id.
    const createdAtMs = raw?.taken_at ? raw.taken_at * 1000 : pkToTimestamp(raw?.pk);

    return {
      id: String(raw?.pk ?? code),
      code,
      url: `https://www.instagram.com/${author}/${isVideo ? "reel" : "p"}/${code}/`,
      platform: "instagram",
      surface,
      author,
      caption: raw?.caption?.text || "",
      createdAtMs,
      views: num(raw?.play_count ?? raw?.view_count),
      likes: num(raw?.like_count),
      comments: num(raw?.comment_count),
      shares: null, // not exposed on the web API
      saves: null,
      isPinned: Boolean(
        raw?.timeline_pinned_user_ids?.length || raw?.clips_tab_pinned_user_ids?.length,
      ),
      isVideo,
      isCarousel: raw?.media_type === MEDIA_TYPE_CAROUSEL,
      thumbnailUrl: widestCandidate(raw?.image_versions2?.candidates),
    };
  },

  /**
   * Both shapes are matched because a reel posted to the grid is linked as
   * /reel/ on the Reels tab and can appear as /p/ in the timeline.
   */
  tileSelector(item) {
    return `main a[href*="/p/${item.code}/"], main a[href*="/reel/${item.code}/"]`;
  },

  allTilesSelector: TILE_SELECTOR,

  gridContainer() {
    return findCommonAncestor(TILE_SELECTOR);
  },

  tileFor(anchor) {
    return tileFor(anchor, TILE_SELECTOR);
  },
};

export default instagramAdapter;
