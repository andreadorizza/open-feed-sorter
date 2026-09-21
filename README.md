# Sort Feed Better

Sort any Instagram or TikTok profile by views, likes, comments or **outlier
score** — then export the results. No account, no backend, no paywall.

Instagram will not tell you how a profile's posts performed. The grid shows no
numbers; hover a tile and you get likes and comments one post at a time, never
view counts. This extension reads the counts the page already fetched for its
own rendering, and re-lays the grid out best-first.

> **Status: v0.1, works but young.** Instagram and TikTok profile feeds are
> supported and covered by tests. Expect breakage when either platform changes
> its API — see [Adding a platform](docs/ARCHITECTURE.md#adding-a-platform) and
> [Contributing](CONTRIBUTING.md).

---

## What it does

- **Sort a profile** by views, likes, comments, shares, saves, date — or outlier
  score.
- **Outlier scores.** `3.4x` means a post did 3.4 times this account's recent
  median. Pinned posts and anything under three days old are excluded from that
  median, because both would skew it.
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

No store listing yet. Build it and load it unpacked:

```bash
git clone https://github.com/andreadorizza/sort-feed-better
cd sort-feed-better
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
exports are generated locally. Nothing leaves your browser.

Permissions:

| Permission | Why |
|---|---|
| `tabs` | The popup asks the active tab what profile it's on |
| `host_permissions` for the two sites | Where the content scripts run |

That is the whole list. No `storage`, no `downloads`, no `webRequest`, no
`externally_connectable`.

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
npm test         # 95 tests, no browser needed
npm run ci       # test + build + verify the built extension (what CI runs)
```

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

## Prior art

Two open-source Instagram sorters exist and are worth knowing about:
[insta-sorter](https://github.com/codeXsahil/insta-sorter) and
[free-sort-feed-extension](https://github.com/RostyslavDzhohola/free-sort-feed-extension).

Both read the rendered page. That caps what they can do: Instagram only draws a
play count on Reels tiles, so a Posts grid cannot be sorted by likes that way —
the numbers simply are not on screen. Reading the feed response instead is what
makes Posts, TikTok, and export with full metrics possible.

They also define an outlier against **follower count**. Reach on both platforms
is driven by recommendation rather than followers now, so a small account with
one recommended video looks like a permanent outlier. This project compares a
post against the account's own recent median instead, which is the question
people usually mean: did this beat what this account normally does?

## Licence

[MIT](LICENSE). Not affiliated with Instagram, Meta, TikTok or ByteDance.
