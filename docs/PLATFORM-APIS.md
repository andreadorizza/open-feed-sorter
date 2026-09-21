# Platform APIs

What this extension reads, and where it comes from. Everything here is
observable in your browser's Network tab on a profile page — open DevTools,
filter to Fetch/XHR, and scroll.

This is the reference to reach for when a platform changes something and a
sort stops working.

---

## Why read the network at all

Instagram's profile grid renders no numbers. Hovering a tile shows likes and
comments for one post at a time, and view counts never appear. So the counts
worth sorting by are not on screen to be scraped.

They are, however, in the page. Every time Instagram draws that grid it
requests a GraphQL response carrying `like_count`, `comment_count` and
`play_count` for every post in the page. TikTok is the same: `/api/post/item_list`
returns a full `stats` object per video.

The data is already in the tab. Reading the response the site requested is both
more complete than scraping the DOM and less work — no parsing of rendered
markup that changes with every redesign.

---

## Instagram

### Endpoints

Profile feeds come from a private GraphQL API on one of two paths:

```
/graphql/query
/api/graphql
```

Both are live. Instagram is migrating query by query, so a single page load can
use either, and an account that has not been moved yet still uses the older
path. Matching only one breaks that half of users — silently, because the
collect loop only starts once a response is recognised.

Those paths also carry plenty of unrelated traffic (`ig_quick_promotion_batch_fetch_root`,
`xdt_api__v1__discover__chaining`, and others). **URL matching is only a
pre-filter.** What decides whether a response is a feed page is whether the
expected key is in it.

### Response keys

| Surface | Key on `data` |
|---|---|
| Posts timeline | `xdt_api__v1__feed__user_timeline_graphql_connection` |
| Reels (current) | `fetch__XDTUserDict.clips_connection` |
| Reels (older) | `xdt_api__v1__clips__user__connection_v2` |

The reels key has moved once already, which is why the adapter tries both
shapes. `page_info.has_next_page` tells you whether more pages exist.

Items live at `edges[].node` for the timeline and `edges[].node.media` for
reels — reels wrap the media one level deeper.

### Item fields

```
pk                          media id (see "Dates" below)
code                        short code used in the post URL
media_type                  1 photo · 2 video · 8 carousel
taken_at                    unix seconds — Posts only
like_count
comment_count
play_count / view_count     videos only
caption.text
user.username
image_versions2.candidates[]      {url, width}; order is not guaranteed
timeline_pinned_user_ids[]        non-empty ⇒ pinned on the Posts grid
clips_tab_pinned_user_ids[]       non-empty ⇒ pinned on the Reels tab
```

**Photos and carousels have no view count at all.** An Instagram Posts grid can
therefore only be sorted and scored on likes. Treating the missing value as
zero is a real bug, not a theoretical one — it drags an outlier baseline toward
zero across a photo-heavy profile.

### Dates

Reels payloads carry no `taken_at`. The date is recovered from the media id,
which is Snowflake-style — the high bits hold milliseconds since a fixed
Instagram epoch:

```js
const IG_EPOCH_MS = 1314220021721;
new Date(Number((BigInt(pk) >> 23n) + BigInt(IG_EPOCH_MS)));
```

Where `taken_at` is present it wins; the id is the fallback.

### Pinned posts

Instagram floats pinned posts to the top of a grid regardless of age. Two
consequences, both of which the code depends on:

- A pinned post must not end a date-range run. Meeting one says nothing about
  how far back the feed has been read.
- A pinned post must stay out of an outlier baseline. They are usually the
  account's best work, so including them raises the bar the rest is measured
  against.

---

## TikTok

### Endpoint

```
/api/post/item_list
```

Delivered over `fetch`.

### Response

Items arrive under `itemList`, `item_list` or `aweme_list` depending on the
build. `hasMore` / `has_more` signals further pages, and arrives as `1` rather
than `true` in some responses.

### Item fields

```
id                     video id
desc                   caption
createTime             unix seconds
author.uniqueId        username
isPinnedItem           TikTok floats up to 3 pinned videos
imagePost.images[]     present ⇒ a photo post, not a video
video.cover            thumbnail
stats.playCount        views
stats.diggCount        likes
stats.commentCount
stats.shareCount
stats.collectCount     saves
```

TikTok exposes more than Instagram — shares and saves have no Instagram
equivalent on the web API.

---

## Pagination

The extension never requests a feed page itself. It scrolls, the site
paginates, and the hook catches the response.

That is a deliberate constraint rather than a limitation. These endpoints are
signed and cursor-based, they change without notice, and a request the
extension forges is one the platform can distinguish from the browser's own.
Driving the site's own infinite scroll produces exactly the traffic that
reading a profile produces, in the same order, with the same headers.

Two things follow:

- A run is bounded by scroll speed, and needs a watchdog. `requestNextPage()`
  retries the scroll up to four times at 3.5 s before treating the feed as
  stalled.
- A run paces itself. Asking for the next page the instant the last one lands
  would mean hundreds of requests in a couple of minutes, which is the one
  thing about this that does not look like a person reading. See
  `src/page/runtime/pace.js`.

---

## Image URLs

The CDN URLs in these payloads are signed and short-lived. A tile rebuilt from
a stored URL an hour later shows a broken image.

This is why the collector captures each tile's rendered `outerHTML` rather than
constructing a tile from the JSON — and why exports carry the permalink rather
than the image URL.

---

## When something breaks

A sort that hangs on *"Scrolling the feed to collect posts…"* means no response
was recognised. Open DevTools → Network → Fetch/XHR, reload the profile and
scroll, then find the request carrying the posts.

- **The URL no longer matches** → fix `matchesFeedRequest()` in the adapter.
- **The URL matches but the key is gone** → fix `extractPage()`.

Keep the old pattern alongside the new one in both cases. These rollouts are
gradual, and both shapes are live at once for weeks.

Add the new shape to `test/adapters.test.js` and keep the old one — that pair is
the regression guard. Full walkthrough in [TESTING.md](TESTING.md#3-when-it-breaks).
