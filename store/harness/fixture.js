/**
 * The account every screenshot shows.
 *
 * It is the maintainer's own profile, with the covers of the maintainer's own
 * videos (see covers.js). Everything else is invented: the posts' counts,
 * dates and order, and the profile's post and follower counts, are generated
 * here from a fixed seed, in the raw JSON shapes the two platforms' feed
 * responses use. The generator serves them as the fake site's feed endpoint,
 * so they reach the extension the way a real feed does: fetched by the page,
 * caught by the extension's network hook, parsed by the real adapter.
 *
 * The counts are shaped to make the outlier scores worth looking at: most
 * posts sit near the account's median, a handful beat it by 2x–8x, and the
 * two newest are still gathering views.
 */

import { COVERS, coverUrl } from "./covers.js";

export const ACCOUNT = {
  handle: "intelligenza_artificiale_dori",
  name: "Dori ~ Intelligenza Artificiale",
  bio: "☯️ L'AI o si usa o si subisce",
  note: "Sample numbers",
  posts: 212,
  followers: "18.4K",
  following: 301,
};

/** mulberry32: small, fast, and good enough for shaping counts. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * "Now", for the fixture. Dates and the three-day freshness cut-off are
 * measured from here rather than from the clock, so the screenshots do not
 * drift as the calendar moves.
 */
export const NOW = Date.UTC(2026, 8, 21, 15, 0);

const DAY = 24 * 60 * 60 * 1000;

/**
 * Posts the scores should single out, by position in the feed (0 = newest),
 * how many times the account's median views they get, and their cover.
 */
export const OUTLIERS = new Map([
  [7, { score: 7.8, cover: "open-feed-sorter-2" }],
  [15, { score: 5.3, cover: "siti-scroll" }],
  [11, { score: 3.6, cover: "sicurezza-per-tutti" }],
  [30, { score: 2.7, cover: "nvidia-api" }],
  [4, { score: 2.2, cover: "dashboard-finanze" }],
]);

/** The same account on TikTok, where different posts took off. */
export const TIKTOK_OUTLIERS = new Map([
  [11, { score: 8.4, cover: "ai-websites" }],
  [7, { score: 6.1, cover: "open-feed-sorter-2" }],
  [19, { score: 3.3, cover: "humanizer" }],
  [30, { score: 2.4, cover: "vibe-coding-sicuro" }],
  [26, { score: 2.1, cover: "freellmapi" }],
]);

/**
 * Two posts that people commented on more than they watched: each asks for a
 * comment to get the prompts. They are what makes "Most comments" a different
 * order.
 */
const CHATTY = new Map([
  [9, { comments: 612, cover: "professional-pics", caption: "Foto pro senza fotografo. Commenta FOTO e ti mando i prompt" }],
  [21, { comments: 348, cover: "professional-pics-broll", caption: "6 prompt per foto LinkedIn e CV. Commenta PROMPT" }],
]);

/**
 * How many tiles one screenshot can show. Posts that can appear on the same
 * screen get different covers.
 */
const SCREEN = 16;

/**
 * The sets of posts a screenshot can show together: the feed as it loads,
 * newest first, and the top of each sort a shot uses, over the whole feed
 * and over a 50-post run.
 */
function screens(list) {
  const top = (field, from = list) => from.slice().sort((a, b) => b[field] - a[field]).slice(0, SCREEN);
  return [list.slice(0, SCREEN), top("views"), top("views", list.slice(0, 50)), top("comments")];
}

/**
 * Give every post a cover. Outliers and the chatty posts get the one named
 * above; every other post on a screen gets the first cover in COVERS that no
 * post on its screens has yet. Posts no shot shows take covers in turn.
 */
function assignCovers(list) {
  const near = new Map(list.map((post) => [post, new Set()]));
  for (const screen of screens(list)) {
    for (const post of screen) for (const other of screen) if (other !== post) near.get(post).add(other);
  }

  const cover = new Map();
  for (const post of list) if (post.cover) cover.set(post, post.cover);

  for (const post of list) {
    if (cover.has(post) || near.get(post).size === 0) continue;
    const taken = new Set([...near.get(post)].map((other) => cover.get(other)));
    const free = COVERS.find(({ slug }) => !taken.has(slug));
    if (!free) throw new Error(`fixture: no cover left for post ${post.index}; add covers or shrink SCREEN`);
    cover.set(post, free.slug);
  }

  for (const post of list) {
    const slug = cover.get(post) ?? COVERS[post.index % COVERS.length].slug;
    post.image = coverUrl(slug);
    post.caption ??= COVERS.find((c) => c.slug === slug).caption;
  }
}

/** Views a typical post settles at. The real median comes out near this. */
const TYPICAL_VIEWS = 11800;

function lognormal(rand, median, sigma) {
  // Box–Muller.
  const u = 1 - rand();
  const v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return median * Math.exp(sigma * z);
}

function round(n, step) {
  return Math.round(n / step) * step;
}

/**
 * The account's feed, newest first, as plain records. The platform-shaped
 * payloads below are built from these.
 */
export function posts(count = 100, { seed = 7, typicalViews = TYPICAL_VIEWS, outliers = OUTLIERS } = {}) {
  const rand = rng(seed);
  const list = [];
  let t = NOW - 0.9 * DAY;

  for (let i = 0; i < count; i++) {
    // Morning posts, every day or two.
    const day = new Date(t);
    day.setUTCHours(6 + Math.floor(rand() * 4), Math.floor(rand() * 60), 0, 0);
    const createdAtMs = day.getTime();

    const outlier = outliers.get(i);
    const chatty = CHATTY.get(i);

    let views = lognormal(rand, typicalViews, 0.28);
    // Fresh posts have not finished collecting views.
    const ageDays = (NOW - createdAtMs) / DAY;
    if (ageDays < 3) views *= 0.25 + ageDays * 0.18;

    const likeRate = 0.045 + rand() * 0.03;
    const commentRate = 0.015 + rand() * 0.025;

    list.push({
      index: i,
      cover: outlier?.cover ?? chatty?.cover ?? null,
      caption: chatty?.caption ?? null,
      createdAtMs,
      views,
      likeRate,
      commentRate,
      outlierScore: outlier?.score ?? null,
      comments: chatty?.comments ?? null,
    });

    t -= (1.1 + rand() * 0.9) * DAY;
  }

  // Put each outlier where it was asked to land. The extension's baseline is
  // the median of the 25 newest posts older than three days; the outliers sit
  // above that median whatever their exact value, so it is fixed by the other
  // posts alone and can be computed before the outliers are placed.
  for (const post of list) post.views = round(post.views, 10);
  const pool = list.filter((p) => (NOW - p.createdAtMs) / DAY >= 3).slice(0, 25);
  const baseline = medianOf(pool.map((p) => (p.outlierScore == null ? p.views : Infinity)));
  for (const post of list) {
    if (post.outlierScore != null) post.views = post.outlierScore * baseline;
  }

  for (const post of list) {
    post.views = round(post.views, 10);
    post.likes = round(post.views * post.likeRate * (post.outlierScore ? 1.15 : 1), 1);
    post.comments ??= Math.max(2, round(post.likes * post.commentRate * (post.outlierScore ? 1.3 : 1), 1));
    post.shares = Math.max(1, round(post.views * (0.004 + rand() * 0.006), 1));
    post.saves = Math.max(1, round(post.views * (0.006 + rand() * 0.01), 1));
  }

  assignCovers(list);
  return list;
}

function medianOf(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

function shortcode(rand) {
  let code = "D";
  for (let i = 0; i < 10; i++) code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return code;
}

/** Instagram's epoch for media ids — see src/adapters/instagram.js. */
const IG_EPOCH_MS = 1314220021721n;

/**
 * The posts as an Instagram Reels feed would carry them: the `media` objects
 * inside `xdt_api__v1__clips__user__connection_v2.edges[].node`.
 */
export function instagramReels(list) {
  const rand = rng(99);
  return list.map((post) => ({
    pk: String(((BigInt(post.createdAtMs) - IG_EPOCH_MS) << 23n) | BigInt(Math.floor(rand() * 8_000_000))),
    code: shortcode(rand),
    media_type: 2,
    taken_at: Math.floor(post.createdAtMs / 1000),
    play_count: post.views,
    like_count: post.likes,
    comment_count: post.comments,
    user: { username: ACCOUNT.handle },
    caption: { text: post.caption },
    image_versions2: { candidates: [{ url: post.image, width: 300, height: 400 }] },
  }));
}

/** The posts as TikTok's `/api/post/item_list` would carry them. */
export function tiktokVideos(list) {
  const rand = rng(101);
  return list.map((post) => ({
    id: String(7_400_000_000_000_000_000n + BigInt(Math.floor(post.createdAtMs / 1000)) * 1_000_000n + BigInt(Math.floor(rand() * 999_999))),
    desc: post.caption,
    createTime: Math.floor(post.createdAtMs / 1000),
    author: { uniqueId: ACCOUNT.handle },
    stats: {
      playCount: post.views,
      diggCount: post.likes,
      commentCount: post.comments,
      shareCount: post.shares,
      collectCount: post.saves,
    },
    video: { cover: post.image },
  }));
}
