/**
 * The fictional account every screenshot shows.
 *
 * "Crumbwell Bakery" does not exist. Its posts, counts, dates and captions are
 * generated here from a fixed seed, in the raw JSON shapes the two platforms'
 * feed responses use. The generator serves them as the fake site's feed
 * endpoint, so they reach the extension the way a real feed does: fetched by
 * the page, caught by the extension's network hook, parsed by the real adapter.
 *
 * The counts are shaped to make the outlier scores worth looking at: most
 * posts sit near the account's median, a handful beat it by 2x–8x, and the
 * two newest are still gathering views.
 */

import { rng, thumbnail } from "./thumbs.js";

export const ACCOUNT = {
  handle: "crumbwell.bakery",
  name: "Crumbwell Bakery",
  bio: "Small-batch sourdough, laminated pastry and whatever came out of the oven this morning.",
  note: "Fictional demo account",
  posts: 212,
  followers: "18.4K",
  following: 301,
};

/**
 * "Now", for the fixture. Dates and the three-day freshness cut-off are
 * measured from here rather than from the clock, so the screenshots do not
 * drift as the calendar moves.
 */
export const NOW = Date.UTC(2026, 8, 21, 15, 0);

const DAY = 24 * 60 * 60 * 1000;

/** What the bakery posts about, and which abstract motif stands in for it. */
const TOPICS = [
  ["boule", "Scoring a country boule, four ways"],
  ["croissant", "Croissant cross-section: 27 layers of butter"],
  ["cinnamon", "The cinnamon bun pull"],
  ["baguettes", "Morning bake: sixty baguettes before 7am"],
  ["macarons", "Pistachio macarons, take two"],
  ["starter", "Feeding the rye starter (day 4)"],
  ["cookies", "Brown butter cookies, crisp edge and soft middle"],
  ["pie", "Lattice cherry pie, start to finish"],
  ["doughnut", "Friday doughnuts"],
  ["tray", "A tray of milk buns"],
  ["loaf", "Lemon drizzle loaf"],
  ["slice", "Strawberry shortcake, sliced"],
  ["boule", "Why our loaves open like that"],
  ["croissant", "Laminating: fold three of three"],
  ["baguettes", "Shaping baguettes, slowed down"],
  ["cookies", "Oat and sour cherry cookies"],
  ["tray", "Hot cross buns, early batch"],
  ["starter", "How we keep the starter over a weekend off"],
  ["loaf", "Banana bread with a burnt-sugar top"],
  ["slice", "Chocolate layer cake for a birthday order"],
  ["cinnamon", "Cardamom knots"],
  ["pie", "Apple pie, lard crust vs butter crust"],
  ["macarons", "Macaron feet: what went wrong"],
  ["doughnut", "Custard doughnuts, piped to order"],
];

/**
 * Posts the scores should single out, by position in the feed (0 = newest)
 * and how many times the account's median views they get.
 */
export const OUTLIERS = new Map([
  [7, { score: 7.8, topic: ["croissant", "Croissant cross-section: 27 layers of butter"] }],
  [15, { score: 5.3, topic: ["boule", "Scoring a country boule, four ways"] }],
  [11, { score: 3.6, topic: ["cinnamon", "The cinnamon bun pull"] }],
  [30, { score: 2.7, topic: ["doughnut", "Friday doughnuts"] }],
  [4, { score: 2.2, topic: ["macarons", "Pistachio macarons, take two"] }],
]);

/** The same bakery on TikTok, where different posts took off. */
export const TIKTOK_OUTLIERS = new Map([
  [11, { score: 8.4, topic: ["cinnamon", "The cinnamon bun pull"] }],
  [7, { score: 6.1, topic: ["croissant", "Croissant cross-section: 27 layers of butter"] }],
  [19, { score: 3.3, topic: ["baguettes", "Morning bake: sixty baguettes before 7am"] }],
  [30, { score: 2.4, topic: ["doughnut", "Friday doughnuts"] }],
  [26, { score: 2.1, topic: ["pie", "Lattice cherry pie, start to finish"] }],
]);

/**
 * Two posts that people talked about more than they watched: a naming
 * contest and a Q&A. They are what makes "Most comments" a different order.
 */
const CHATTY = new Map([
  [9, { comments: 612, topic: ["loaf", "Name our new sourdough. Best name wins a loaf a week for a month"] }],
  [21, { comments: 348, topic: ["starter", "Ask us anything about starters"] }],
]);

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
    const [motif, caption] = outlier?.topic || chatty?.topic || TOPICS[(i * 7 + 3) % TOPICS.length];

    let views = lognormal(rand, typicalViews, 0.28);
    // Fresh posts have not finished collecting views.
    const ageDays = (NOW - createdAtMs) / DAY;
    if (ageDays < 3) views *= 0.25 + ageDays * 0.18;

    const likeRate = 0.045 + rand() * 0.03;
    const commentRate = 0.015 + rand() * 0.025;

    list.push({
      index: i,
      motif,
      caption,
      createdAtMs,
      views,
      likeRate,
      commentRate,
      outlierScore: outlier?.score ?? null,
      comments: chatty?.comments ?? null,
      seed: seed * 1000 + i,
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
    post.image = thumbnail({ motif: post.motif, seed: post.seed });
  }

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
