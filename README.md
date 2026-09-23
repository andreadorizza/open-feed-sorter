# Open Feed Sorter

Sort any Instagram or TikTok profile by views, likes, comments or **outlier
score** — then export the results. No account, no backend, no paywall.

[![CI](https://github.com/andreadorizza/open-feed-sorter/actions/workflows/ci.yml/badge.svg)](https://github.com/andreadorizza/open-feed-sorter/actions/workflows/ci.yml)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/inbpbmepkjibdpakmmogmefkcgnfcbma?label=chrome%20web%20store)](https://chromewebstore.google.com/detail/inbpbmepkjibdpakmmogmefkcgnfcbma)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-4285F4.svg)](src/manifest.json)
[![Listed on Open Source Alternatives](https://www.opensourcealternatives.to/badge-osa.svg)](https://www.opensourcealternatives.to)

<a href="https://ko-fi.com/andreadorizza">
  <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support me on Ko-fi" height="36">
</a>

Instagram will not tell you how a profile's posts performed. The grid shows no
numbers; hover a tile and you get likes and comments one post at a time, never
view counts. The app has started offering a "most viewed" order on a profile's
Reels tab — one metric, on one tab, with nothing to compare or export. This
extension reads the counts the page already fetched for its own rendering, and
re-lays the grid out best-first.

> **Status: v0.1, works but young.** Instagram and TikTok profile feeds are
> supported and covered by tests. Expect breakage when either platform changes
> its API — see [Adding a platform](docs/ARCHITECTURE.md#adding-a-platform) and
> [Contributing](CONTRIBUTING.md).

---

## What it does

- **Sort a profile** by views, likes, comments, shares, saves, date — or outlier
  score.
- **Outlier scores on every tile.** `3.4x` means a post did 3.4 times this
  account's recent median. Pinned posts and anything under three days old are
  excluded from that median, because both would skew it. A short run reads a few
  extra older posts so it has enough to compute the median.
- **Any amount.** 25 posts or the whole feed; a date range or a count. Nothing
  is reserved for a paid tier, because nothing about "latest 500" costs more to
  compute than "latest 25".
- **Every metric on every tile** — not one at a time on hover.
- **Re-sort instantly.** Everything collected stays in memory, so switching from
  views to comments is a re-render, not a second scrape.
- **Export** to CSV, Excel (`.xlsx`) or JSON, generated in the tab.
- **Stop whenever.** Stop keeps what has been collected so far.

## What it doesn't do

No transcription and no Google Sheets export. Both need a server — paid speech
recognition and an OAuth client respectively — and this project does not have
one. Everything else runs entirely in the tab.

---

## Install

**[Add to Chrome](https://chromewebstore.google.com/detail/inbpbmepkjibdpakmmogmefkcgnfcbma)**
— free, and the same code as this repository.

To build it yourself instead, load it unpacked:

```bash
git clone https://github.com/andreadorizza/open-feed-sorter
cd open-feed-sorter
npm install
npm run build
```

Then in Chrome:

1. `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** → select the `dist/` folder

`npm run watch` rebuilds on change; reload the extension afterwards.

## Use

1. Open an Instagram or TikTok **profile page**.
2. Click the extension icon, pick a sort and how much to collect.
3. **Sort this profile.**

The tab reloads and scrolls itself while collecting — that is the mechanism, not
a bug ([why](docs/ARCHITECTURE.md#why-the-reload)). When it finishes, the grid is
re-laid-out with a toolbar above it for re-sorting and export. **Show original
feed** puts everything back.

---

## Privacy

There is no backend, no account and no analytics. The extension makes **zero**
network requests of its own — it reads responses the page already received, and
exports are generated locally. Nothing leaves your browser. The
[privacy policy](PRIVACY.md) spells out exactly what is read, what is kept and
for how long.

Permissions:

| Permission | Why |
|---|---|
| `host_permissions` for `www.instagram.com` and `www.tiktok.com` | Where the content scripts run, and how the popup tells which of the two sites the active tab is on |

That is the whole list. There are no API permissions at all: no `tabs`, no
`storage`, no `downloads`, no `webRequest`, no `externally_connectable`. The
popup finds, messages and reloads the active tab with calls that need none. So
Chrome's install prompt asks for one thing: *Read and change your data on
www.instagram.com and www.tiktok.com*.

---

## How it works

Short version: the counts are in the JSON the site fetches for its own grid, so
a script in the page's world wraps `fetch`/`XMLHttpRequest` and reads them. The
page is then scrolled so the site loads more on its own, each tile's markup is
captured, and the grid is re-laid-out in sorted order.

- [**Architecture**](docs/ARCHITECTURE.md) — the layers, the run lifecycle, and
  how to add a platform.
- [**Testing**](docs/TESTING.md) — the suite, a manual pass, and how to diagnose
  a platform change.
- [**Platform APIs**](docs/PLATFORM-APIS.md) — which endpoints carry the feed,
  which fields hold the numbers, and what to check when a platform changes
  something.

```
src/
├── core/        pure logic — sorting, outliers, dates, exports  (no DOM)
├── adapters/    all platform-specific knowledge lives here
├── page/        MAIN world: network hooks, collect loop
├── content/     ISOLATED world: banner, grid, toolbar
└── popup/
```

## Development

```bash
npm run build    # → dist/
npm run watch    # rebuild on change
npm test         # 120 tests, no browser needed
npm run ci       # test + build + verify the built extension (what CI runs)
npm run package  # build + verify → release/open-feed-sorter-<version>.zip for the store
```

Pushing a `v<version>` tag runs the same checks in CI and attaches that zip to
a GitHub release. The tag has to match the manifest's version; if it does not,
the release fails before anything is built. The same zip is what goes to the
store — see [Releasing](CONTRIBUTING.md#releasing).

Adding a platform means writing one adapter and two three-line entry points —
see [the guide](docs/ARCHITECTURE.md#adding-a-platform).

---

## Fair use

This reads data the platform already sent to your browser, at the speed a person
scrolling reads it. It does not forge API requests, use credentials other than
your own logged-in session, or touch anything you cannot already see.

Runs pace themselves — a randomised pause between pages, so a long run reads as
someone scrolling rather than as a script.

That said: automating a site is generally against Instagram's and TikTok's terms
of service, whoever does it. Large runs still page through a lot of the feed.
Use your own judgement about your own account, and prefer the smallest run that
answers your question.

## Support

The extension is free and always will be — nothing is reserved for a paid tier,
because nothing about "latest 500" costs more to compute than "latest 25".

If it saved you time, a coffee is welcome and entirely optional. It buys
nothing: there is no supporter build, no early access, and no feature behind it.

<a href="https://ko-fi.com/andreadorizza">
  <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support me on Ko-fi" height="36">
</a>

## Prior art

Two Instagram sorters with public source exist and are worth knowing about:
[insta-sorter](https://github.com/codeXsahil/insta-sorter) and
[free-sort-feed-extension](https://github.com/RostyslavDzhohola/free-sort-feed-extension).
Neither carries an open-source licence.

Both read the rendered page. That caps what they can do: Instagram only draws a
play count on Reels tiles, so a Posts grid cannot be sorted by likes that way —
the numbers simply are not on screen. Reading the feed response instead is what
makes Posts, TikTok, and export with full metrics possible.

free-sort-feed-extension defines an outlier against **follower count** (views
at least five times followers); insta-sorter has no outlier score. Reach on both
platforms is driven by recommendation rather than followers now, so a small
account with one recommended video looks like a permanent outlier. This project
compares a post against the account's own recent median instead, which is the
question people usually mean: did this beat what this account normally does?

## Licence

[MIT](LICENSE). Not affiliated with Instagram, Meta, TikTok or ByteDance.
