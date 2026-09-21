# Architecture

How this extension is put together, and why. If you are here to add a platform,
skip to [Adding a platform](#adding-a-platform).

---

## The problem

A browser extension cannot see a page's network traffic from a content script.
Content scripts run in an *isolated world* with their own `window.fetch` and
`XMLHttpRequest`; hooks installed there see nothing the site does.

But the counts we sort on only exist in that traffic — Instagram's grid renders
no numbers at all. So the interception has to run in the page's own world, which
has no `chrome.*` APIs and therefore cannot talk to the extension, read storage
or open a tab.

Neither half can do the job alone, which is what the layout below is for.

---

## Layers

```
        ┌───────────────────────────┐
        │ popup/                    │  pick a sort, start a run
        └─────────────┬─────────────┘
                      │ chrome.tabs.sendMessage
        ┌─────────────▼─────────────────────────────────┐
        │ content/           ISOLATED world             │
        │  · banner, grid, toolbar, exports             │
        │  · the only half with chrome.* access         │
        └─────────────┬─────────────────────────────────┘
                      │ window.postMessage   (core/protocol.js)
        ┌─────────────▼─────────────────────────────────┐
        │ page/              MAIN world                 │
        │  · fetch / XHR hooks                          │
        │  · collect loop, scroll driver, sorting       │
        └───────────────────────────────────────────────┘

        core/       pure, no DOM, unit-tested in Node
        adapters/   everything platform-specific, used by both worlds
```

`background/` is almost empty on purpose: there is no licence to check, no
account to hold and no server to call, so nothing needs to live there.

---

## A run, start to finish

```
1. popup    → content   { type: "sfb:run", config }
2. content  → sessionStorage.setItem("sfb:run", config)
3. content  → location.reload()
                ⋮  page reloads
4. page     → claimRun() finds the config at document_start
5. page     → installs fetch + XHR hooks BEFORE the site's first request
6. site     → fetches its feed
7. hook     → adapter.extractPage(json) → Collector.acceptPage()
8. collector→ normalize · wait for tile · capture outerHTML · repeat
              needs more? → scroll → site fetches → back to 7
9. page     → sort + outlier scores → postMessage DONE
10. content → hide native grid, render sorted tiles, mount toolbar
```

### Why the reload

Both platforms fetch a profile's first page exactly once, on load. By the time
the popup is open, that response is gone. Reloading is the only way to be
present for it — so `sessionStorage` carries the config across, and the
page-world script runs at `document_start` to beat the site's first request.

`sessionStorage` is the right store rather than a convenient one: it survives
the reload and dies with the tab, so a run can never leak into a new session.
The run is *claimed* (read-and-cleared) rather than merely read, so a crash or a
manual refresh starts clean instead of silently re-running a sort.

### Why we scroll instead of fetching

The collector never issues a feed request. It scrolls, the site fetches, the
hook catches it.

Feed endpoints are signed, cursor-based and change without notice — and a forged
request is one the platform can tell apart from organic traffic. Driving the
site's own infinite scroll produces exactly the traffic normal reading produces.
The cost is a slower run and the need for a watchdog: `requestNextPage()` retries
the scroll up to four times at 3.5 s each before treating the feed as stalled.

### Why tiles are cloned, not rebuilt

The collector captures each tile's `outerHTML` and the renderer re-lays those
out in sorted order.

Rebuilding tiles from the JSON would mean re-implementing each platform's tile
and chasing every redesign. It would also break: the CDN image URLs are
short-lived and signed, so a tile rebuilt later shows broken images. Cloning
inherits the site's own layout, hover states and badges for free.

The platform's grid is set aside, never removed, so exiting is one call and the
site's own state is untouched. It is *parked* — fixed, invisible, far below the
viewport — not `display:none`. A `display:none` grid measures as zero height,
so the site's infinite scroll decides the user is always at the end of it and
pages through the whole profile in the background. Parked, it keeps its real
size and the end of the feed always looks far away. If parking would lengthen
the page (a transformed ancestor makes `position: fixed` behave like
`absolute`), it falls back to `display:none`.

---

## Module map

| Path | Responsibility |
|---|---|
| `core/protocol.js` | The `postMessage` envelope. Namespaced and direction-tagged so neither half hears itself or the site's own chatter. |
| `core/session.js` | The reload-surviving run config. |
| `core/sort.js` | Sort keys and null-safe comparators. |
| `core/outlier.js` | Median baseline and scoring. |
| `core/dates.js` | Range presets and the newest-first stop test. |
| `core/zip.js` | Store-method ZIP + CRC32. |
| `core/export/` | CSV, JSON, and a dependency-free `.xlsx` writer on top of `zip.js`. |
| `page/runtime/net-hooks.js` | The `fetch`/`XHR` wraps. |
| `page/runtime/collector.js` | The collect loop. |
| `page/runtime/scroll.js` | Scroll driver and the next-page latch. |
| `page/runtime/abort.js` | Stop signal that settles pending waits. |
| `page/runtime/dom-wait.js` | Waiting for a tile and for its media to load. |
| `content/runtime/` | Banner, grid renderer, toolbar. |
| `adapters/` | **All** platform-specific knowledge. |

### Stop has to settle waits, not just flip a flag

A run spends most of its time inside waits — for a tile, for the next page. If
Stop only set a boolean, it would be noticed no sooner than the current wait's
timeout, which deep into a run is several seconds of a button that looks broken.

`StopSignal` keeps a registry of pending waits and settles all of them at once,
so Stop is immediate wherever the run happens to be.

### The outlier pool holds more than the display set

`Collector.pool` keeps every item seen, including ones a date filter rejected;
`Collector.items` holds only what will be shown.

That is deliberate. The baseline describes *the account*, so it should be
computed over everything the run saw. Computing it over a filtered slice would
mean "last week's posts, compared against last week's median" — which is close
to meaningless when the question is "did last week beat this account's normal?"

Scoring runs on every sort, not only when it was asked for, because every
tile shows its score. A stopped run is scored too: its pool is the newest part
of the feed, which is what the baseline reads anyway.

A short run — "Latest 25", or a one-week range — often has too few posts older
than three days to score. So once the displayed set is complete, the collector
keeps reading into the pool only (no tile capture, nothing added to the grid)
until 25 posts qualify or it has read 48 more. The finish reason stays the one
that completed the display, and Stop during this phase loses nothing the user
asked for.

---

## Adding a platform

Everything platform-specific lives in one file. Write `src/adapters/<name>.js`
exporting an object that satisfies the contract in `src/adapters/types.js`:

```js
export default {
  id: "example",
  label: "Example",
  homeUrl: "https://www.example.com/",        // the popup's "Open Example" button
  profileExample: "example.com/@username",    // shown when the tab isn't a profile
  surfaces: { videos: { label: "Videos", metrics: ["views", "likes"] } },
  metrics: ["views", "likes"],

  detectSurface(),              // → "videos" | null  (null = not a profile page)
  profileName(),                // → username from the URL
  matchesFeedRequest(url),      // → is this request worth parsing?
  extractPage(json, surface),   // → { items, hasMore } | null
  normalize(raw, { surface }),  // → FeedItem
  tileSelector(item),           // → CSS selector for this item's anchor
  gridContainer(),              // → the element holding the grid
  tileFor(anchor),              // → the anchor's tile element
};
```

Then:

1. Register it in `src/adapters/index.js`.
2. Add entry points — copy `src/{page,content}/instagram.entry.js`, swapping the
   adapter import. They are three lines each.
3. Add both to `ENTRIES` in `build.mjs`.
4. Add two `content_scripts` blocks and a `host_permissions` entry to
   `src/manifest.json` — one isolated (`document_idle`), one `world: "MAIN"`
   (`document_start`).
5. Write adapter tests. `test/adapters.test.js` is the pattern; no browser
   needed.

No other module should need to change. If one does, the abstraction is wrong —
please say so in an issue.

### Notes for whoever writes one

- **Match on URL, confirm on shape.** Endpoints move and are shared with
  unrelated traffic. `extractPage` returning `null` is the real filter.
- **Return `null` from `extractPage`, don't throw.** The hook sits on every
  request the page makes.
- **Keep `null` distinct from `0`.** A post with no view count is not a post with
  zero views — conflating them drags outlier baselines toward zero. Use `num()`
  from `types.js`.
- **`isPinned` matters more than it looks.** It keeps pinned posts out of the
  baseline and stops a date run from ending on the first pinned item.

---

## Testing

```bash
npm test          # 111 tests, no browser
```

`core/` and `adapters/` are pure and tested directly. The collector, grid and
network hooks are tested against jsdom (`test/helpers/dom.js`), which exercises
the real waiting and DOM capture rather than mocking them away.

The ZIP and XLSX writers are verified against the system `unzip` — CRC checks
and part-by-part structure — because a subtly malformed spreadsheet fails at the
user's desk, not in CI.

What is *not* covered: the live platform payloads. Those change, and the tests
use recorded shapes. When a platform breaks the extension, the fix belongs in an
adapter and a new shape belongs in `test/adapters.test.js`.
