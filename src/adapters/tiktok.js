/**
 * TikTok adapter.
 *
 * TikTok's profile feed comes from `/api/post/item_list` over `fetch`, and the
 * payload is refreshingly flat: every count we want is on `stats`, and the
 * page tells us whether more exist via `hasMore`. The one wrinkle is that
 * responses have used both camelCase and snake_case key sets over time, so
 * both are read.
 */

import { findCommonAncestor, tileFor, num } from "./types.js";

export const SURFACES = {
  videos: { label: "Videos", metrics: ["views", "likes", "comments", "shares", "saves"] },
};

const TILE_SELECTOR = 'a[href*="/video/"]';

export const tiktokAdapter = {
  id: "tiktok",
  label: "TikTok",
  homeUrl: "https://www.tiktok.com/",
  profileExample: "tiktok.com/@username",
  surfaces: SURFACES,
  metrics: ["views", "likes", "comments", "shares", "saves"],

  detectSurface() {
    // Profile pages are /@username, optionally with a tab segment.
    return /^\/@[^/]+\/?$/.test(location.pathname) ? "videos" : null;
  },

  profileName() {
    const match = location.pathname.match(/^\/@([^/]+)/);
    return match ? match[1] : "";
  },

  matchesFeedRequest(url) {
    return !!url && url.includes("/api/post/item_list");
  },

  extractPage(json) {
    const items = json?.itemList ?? json?.item_list ?? json?.aweme_list;
    if (!Array.isArray(items) || items.length === 0) return null;

    const rawHasMore = json?.hasMore ?? json?.has_more;
    return { items, hasMore: rawHasMore === true || rawHasMore === 1 };
  },

  normalize(raw, { surface }) {
    const author = raw?.author?.uniqueId || tiktokAdapter.profileName();
    const id = String(raw?.id ?? "");
    const stats = raw?.stats || raw?.statsV2 || {};

    // A "photo post" is a carousel of stills; it still lives at /video/<id>.
    const isPhotoPost = Array.isArray(raw?.imagePost?.images) && raw.imagePost.images.length > 0;

    return {
      id,
      code: id,
      url: `https://www.tiktok.com/@${author}/video/${id}`,
      platform: "tiktok",
      surface,
      author,
      caption: raw?.desc || "",
      createdAtMs: raw?.createTime ? Number(raw.createTime) * 1000 : null,
      views: num(stats.playCount),
      likes: num(stats.diggCount),
      comments: num(stats.commentCount),
      shares: num(stats.shareCount),
      saves: num(stats.collectCount),
      isPinned: Boolean(raw?.isPinnedItem),
      isVideo: !isPhotoPost,
      isCarousel: isPhotoPost,
      thumbnailUrl: raw?.video?.cover || raw?.video?.dynamicCover || null,
    };
  },

  tileSelector(item) {
    return `a[href*="/video/${item.id}"]`;
  },

  allTilesSelector: TILE_SELECTOR,

  gridContainer() {
    // TikTok gives its grid a stable test hook; fall back to the structural
    // search when that changes.
    return (
      document.querySelector('[data-e2e="user-post-item-list"]') ||
      findCommonAncestor(TILE_SELECTOR)
    );
  },

  tileFor(anchor) {
    return anchor.closest('[data-e2e="user-post-item"]') || tileFor(anchor, TILE_SELECTOR);
  },
};

export default tiktokAdapter;
