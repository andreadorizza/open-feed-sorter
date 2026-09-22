# Privacy policy

**Open Feed Sorter** · effective 22 September 2026

Open Feed Sorter is a Chrome extension that sorts Instagram and TikTok profile
feeds. It has no server, no account and no analytics. It reads what those sites
have already sent to your tab, works on it inside that tab, and sends nothing
anywhere. The developer never receives any of it.

The rest of this page says exactly what that means. Every statement here
describes the code in [this repository](https://github.com/andreadorizza/open-feed-sorter),
which you can read for yourself.

---

## What the extension reads

**On an ordinary visit** to Instagram or TikTok, its scripts load, check whether
a sort is waiting to start, and otherwise do nothing until you open the popup.

**When you open the popup**, it reads the address of the active tab to tell
whether you are on Instagram or TikTok, on a profile page, and whose. Chrome
only lets the extension see the address of Instagram and TikTok tabs; on any
other site the popup cannot tell where you are, and just offers links to the
two sites.

**When you start a sort**, and only in that tab, it reads:

- **The feed responses the site requests for its own grid.** Instagram's come
  from `/api/graphql` and `/graphql/query`, TikTok's from `/api/post/item_list`.
  A response on those addresses that turns out not to be a profile feed is
  dropped, and nothing from it is kept. From each post in a feed, it keeps:
  - *Instagram:* the post's ID and short code, the author's username, the
    caption, when it was posted, its play or view count, like count and comment
    count, whether it is pinned, whether it is a video, photo or carousel, and
    the address of its thumbnail image.
  - *TikTok:* the video's ID, the author's username, the description, when it
    was posted, its play, like, comment, share and save counts, whether it is
    pinned, whether it is a photo post, and the address of its cover image.

  It also notes whether the feed has more pages to load.
- **The grid's tiles.** Each post's tile is copied from the page so the sorted
  grid looks like the site's own.

Nothing else is kept: not your messages, your login details or your cookies,
and nothing from any other website.

## Where it is processed, and what is stored

**In the tab, in memory.** Collecting, sorting, outlier scores and exports all
happen inside the Instagram or TikTok tab you started the sort in. The collected
posts are held in that tab's memory so you can re-sort them without collecting
again, and they are gone when you close or reload the tab. The toolbar's current
sort choice is kept the same way — a value in memory, so it survives the grid
being redrawn — and is not saved anywhere.

**One thing is written down, briefly.** Starting a sort reloads the tab, because
the site only sends a profile's first page once, when the page loads. To survive
that reload, the settings you chose — the site, which of the profile's tabs
(Posts, Reels or Videos), the sort, how many posts or which date range, and when
the sort started — are saved in the tab's session storage under the key
`sfb:run`. The reloaded page deletes that entry as soon as it picks it up,
normally within seconds, and session storage is cleared when the tab closes in
any case. It never holds any post data. Session storage belongs to the site, so
Instagram's or TikTok's own scripts could see that entry while it exists.

The extension uses no local storage, IndexedDB, extension storage or cookies.
Nothing it handles outlives the tab.

## What it sends

**Nothing.** The extension makes no network requests of its own. It never
contacts a server run by the developer — there isn't one — or anyone else. Every
build is checked for this: `scripts/verify-dist.mjs` fails if any of the
extension's scripts refers to a host other than `www.instagram.com` and
`www.tiktok.com`.

What you will see in your browser's network log during a sort is the site
itself:

- To collect more posts, the extension scrolls the page and the site loads the
  next page of the feed, exactly as it would if you scrolled. Those are the
  site's own requests, made with your own logged-in session; the extension does
  not create or change them.
- The sorted grid reuses the site's own tiles, so your browser loads their
  images from Instagram or TikTok as it does for the original grid. Clicking a
  post opens it on the site in a new tab.

**Exports** — CSV, Excel and JSON — are generated inside the tab and handed to
your browser as an ordinary download, saved wherever your browser saves files.
They are not uploaded anywhere. CSV and Excel files have one row per post:
profile, link, date, counts, outlier score and caption. A JSON file has every
field listed above plus each post's link and outlier score, the baseline the
scores were measured against, and when it was exported. What happens to the
file after that is up to you.

## Third parties

None. There is no analytics, advertising, tracking, crash reporting or
third-party code in the extension. No data is sold, shared or transferred to
anyone, because none is collected. Open Feed Sorter's handling of data complies
with the Chrome Web Store User Data Policy, including its Limited Use
requirements.

The only services involved are Instagram and TikTok themselves, which you are
already using. Their own privacy policies cover your use of their sites.

## Permissions

The extension asks Chrome for access to two sites and nothing else:

| Permission | Why |
|---|---|
| `https://www.instagram.com/*` | To run on Instagram, and so the popup can recognise an Instagram tab |
| `https://www.tiktok.com/*` | The same, for TikTok |

Chrome's install prompt shows these as *Read and change your data on
www.instagram.com and www.tiktok.com*. There are no other permissions: no access
to other websites, your browsing history, your downloads, extension storage or
any other part of Chrome.

## The welcome page

When you first install the extension, it opens a getting-started page. That
page is packaged inside the extension; it loads nothing from the internet and
records nothing. It links to the source code on GitHub, as the popup does, and
that link opens only if you click it.

## Children

Open Feed Sorter is not directed at children. The developer receives no
information about anyone who uses it, children included.

## Changes to this policy

This policy lives in the extension's public repository, so every change to it
is visible in the repository's history. If a change affects what the extension
reads, stores or sends, the date at the top will change and the release notes
for the version that makes the change will say so. If an update ever adds a
permission with a new warning, Chrome disables the extension until you approve
it.

## Contact

Questions or concerns: open an issue at
<https://github.com/andreadorizza/open-feed-sorter/issues>.

---

Open Feed Sorter is not affiliated with, endorsed by or sponsored by Meta,
Instagram, TikTok or ByteDance.
