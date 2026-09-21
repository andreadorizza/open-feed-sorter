import { test } from "node:test";
import assert from "node:assert/strict";
import instagram, { pkToTimestamp } from "../src/adapters/instagram.js";
import tiktok from "../src/adapters/tiktok.js";

/** The adapters read `location` for the profile name; stub it for Node. */
function withLocation(pathname, hostname, fn) {
  const previous = globalThis.location;
  globalThis.location = { pathname, hostname, search: "" };
  try {
    return fn();
  } finally {
    globalThis.location = previous;
  }
}

test("instagram: media ids decode to their post time", () => {
  // Instagram media ids are Snowflake-style. This id is a known reference
  // point: shifting out the low 23 bits and adding the IG epoch must land on
  // the post's real timestamp.
  const ms = pkToTimestamp("3000000000000000000");
  assert.ok(Number.isFinite(ms));
  assert.ok(ms > Date.UTC(2020, 0, 1) && ms < Date.UTC(2030, 0, 1));

  // Monotonic: a larger id is always a later post.
  assert.ok(pkToTimestamp("3000000000000000001") >= ms);
  assert.ok(pkToTimestamp("2900000000000000000") < ms);

  assert.equal(pkToTimestamp(null), null);
  assert.equal(pkToTimestamp("not-a-number"), null);
});

test("instagram: matches both the old and new GraphQL paths", () => {
  assert.ok(instagram.matchesFeedRequest("https://www.instagram.com/graphql/query"));
  assert.ok(instagram.matchesFeedRequest("https://www.instagram.com/api/graphql"));
  assert.ok(!instagram.matchesFeedRequest("https://www.instagram.com/api/v1/feed/reels_tray/"));
  assert.ok(!instagram.matchesFeedRequest(""));
});

test("instagram: detects the profile surface and ignores the rest of the site", () => {
  withLocation("/someone/", "www.instagram.com", () =>
    assert.equal(instagram.detectSurface(), "posts"));
  withLocation("/someone/reels/", "www.instagram.com", () =>
    assert.equal(instagram.detectSurface(), "reels"));
  withLocation("/explore/", "www.instagram.com", () =>
    assert.equal(instagram.detectSurface(), null));
  withLocation("/direct/inbox/", "www.instagram.com", () =>
    assert.equal(instagram.detectSurface(), null));
  withLocation("/someone/tagged/", "www.instagram.com", () =>
    assert.equal(instagram.detectSurface(), null));
});

test("instagram: reads the timeline connection", () => {
  const page = instagram.extractPage(
    {
      data: {
        xdt_api__v1__feed__user_timeline_graphql_connection: {
          edges: [{ node: { pk: "1", code: "AAA" } }, { node: { pk: "2", code: "BBB" } }],
          page_info: { has_next_page: true },
        },
      },
    },
    "posts",
  );
  assert.equal(page.items.length, 2);
  assert.equal(page.hasMore, true);
});

test("instagram: reads both known reels connection shapes", () => {
  const edges = [{ node: { media: { pk: "9", code: "R1", media_type: 2 } } }];

  const legacy = instagram.extractPage(
    { data: { xdt_api__v1__clips__user__connection_v2: { edges, page_info: {} } } },
    "reels",
  );
  assert.equal(legacy.items[0].code, "R1");

  const current = instagram.extractPage(
    { data: { fetch__XDTUserDict: { clips_connection: { edges, page_info: {} } } } },
    "reels",
  );
  assert.equal(current.items[0].code, "R1");
});

test("instagram: unrelated traffic on the same endpoint is rejected", () => {
  assert.equal(instagram.extractPage({ data: { ig_quick_promotion_batch_fetch_root: {} } }, "posts"), null);
  assert.equal(instagram.extractPage({}, "posts"), null);
  assert.equal(instagram.extractPage(null, "reels"), null);
});

test("instagram: normalises a reel", () => {
  const item = withLocation("/creator/reels/", "www.instagram.com", () =>
    instagram.normalize(
      {
        pk: "3000000000000000000",
        code: "ABC123",
        media_type: 2,
        play_count: 5000,
        like_count: 300,
        comment_count: 12,
        caption: { text: "hello" },
        user: { username: "creator" },
        clips_tab_pinned_user_ids: [1],
        image_versions2: { candidates: [{ url: "small", width: 100 }, { url: "big", width: 1080 }] },
      },
      { surface: "reels" },
    ));

  assert.equal(item.url, "https://www.instagram.com/creator/reel/ABC123/");
  assert.equal(item.views, 5000);
  assert.equal(item.likes, 300);
  assert.equal(item.isPinned, true);
  assert.equal(item.isVideo, true);
  assert.equal(item.thumbnailUrl, "big", "widest candidate wins regardless of order");
  assert.ok(Number.isFinite(item.createdAtMs), "reels have no taken_at; date comes from the id");
});

test("instagram: a photo post has no view count and links as /p/", () => {
  const item = withLocation("/creator/", "www.instagram.com", () =>
    instagram.normalize(
      { pk: "1", code: "P1", media_type: 1, taken_at: 1_700_000_000, like_count: 10, user: { username: "creator" } },
      { surface: "posts" },
    ));
  assert.equal(item.views, null);
  assert.equal(item.url, "https://www.instagram.com/creator/p/P1/");
  assert.equal(item.createdAtMs, 1_700_000_000_000, "taken_at wins when present");
  assert.equal(item.isPinned, false);
});

test("tiktok: matches its feed endpoint only", () => {
  assert.ok(tiktok.matchesFeedRequest("https://www.tiktok.com/api/post/item_list/?x=1"));
  assert.ok(!tiktok.matchesFeedRequest("https://www.tiktok.com/api/recommend/item_list/"));
});

test("tiktok: reads both key styles and normalises hasMore", () => {
  const camel = tiktok.extractPage({ itemList: [{ id: "1" }], hasMore: true });
  assert.equal(camel.hasMore, true);

  const snake = tiktok.extractPage({ item_list: [{ id: "1" }], has_more: 1 });
  assert.equal(snake.hasMore, true, "has_more arrives as 1, not true");

  assert.equal(tiktok.extractPage({ itemList: [] }), null, "an empty page is not a page");
  assert.equal(tiktok.extractPage({}), null);
});

test("tiktok: normalises every metric the platform exposes", () => {
  const item = withLocation("/@someone", "www.tiktok.com", () =>
    tiktok.normalize(
      {
        id: "7123",
        desc: "caption",
        createTime: 1_700_000_000,
        author: { uniqueId: "someone" },
        stats: { playCount: 90, diggCount: 8, commentCount: 3, shareCount: 2, collectCount: 1 },
        isPinnedItem: true,
        video: { cover: "cover.jpg" },
      },
      { surface: "videos" },
    ));

  assert.equal(item.url, "https://www.tiktok.com/@someone/video/7123");
  assert.deepEqual(
    [item.views, item.likes, item.comments, item.shares, item.saves],
    [90, 8, 3, 2, 1],
  );
  assert.equal(item.createdAtMs, 1_700_000_000_000);
  assert.equal(item.isPinned, true);
});

test("tiktok: a photo post is flagged as a carousel", () => {
  const item = withLocation("/@someone", "www.tiktok.com", () =>
    tiktok.normalize({ id: "1", imagePost: { images: [{}, {}] }, stats: {} }, { surface: "videos" }));
  assert.equal(item.isVideo, false);
  assert.equal(item.isCarousel, true);
});

test("tiktok: detects a profile page only", () => {
  withLocation("/@someone", "www.tiktok.com", () =>
    assert.equal(tiktok.detectSurface(), "videos"));
  withLocation("/foryou", "www.tiktok.com", () =>
    assert.equal(tiktok.detectSurface(), null));
  withLocation("/@someone/video/123", "www.tiktok.com", () =>
    assert.equal(tiktok.detectSurface(), null));
});
