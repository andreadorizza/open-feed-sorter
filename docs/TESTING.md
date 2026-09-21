# Testing

Two layers: the automated suite, which needs no browser, and manual testing
against the live platforms, which is the only thing that can tell you the
adapters still match reality.

---

## 1. Automated

```bash
npm install
npm test
```

111 tests, ~7 s. No browser, no network, no accounts.

| Area | What it covers |
|---|---|
| `core/` | sorting, outlier maths, date ranges, CSV/JSON/XLSX output |
| `adapters/` | endpoint matching, payload parsing, field mapping, both Instagram reels shapes |
| `collector` | the collect loop against jsdom — real waiting, real DOM capture |
| `grid` | hide/replace/restore, overlays, outlier scores, clicks open a new tab |
| `toolbar` | outlier option when unscorable, re-sort survives a rebuild |
| `net-hooks` | interception, clone-don't-consume, malformed bodies |
| `session` | the reload handshake and its re-run guard |

The ZIP and XLSX writers are checked against the system `unzip` (CRC and
part-by-part structure), because a subtly malformed spreadsheet fails at the
user's desk rather than in CI.

**What the suite cannot tell you:** whether Instagram or TikTok still return the
shapes the tests use. Those are recorded fixtures. Only §2 catches a platform
change.

---

## 2. Manual — the five-minute pass

```bash
npm run build
```

1. `chrome://extensions` → **Developer mode** on → **Load unpacked** → pick `dist/`
2. Open **your own** Instagram profile — you can verify the numbers against what
   you already know, which no other profile lets you do.
3. Click the extension icon. It should say `Instagram · Posts · @you`.
   - Says "open a profile page"? → `detectSurface()` is wrong for this URL.
4. Pick **Most likes**, **Latest 25**, hit **Sort this profile**.

Expected: the tab reloads, a banner appears, the page scrolls itself while the
count climbs, then the grid re-lays-out with a toolbar above it.

Then check:

- [ ] Tiles are in descending order of the metric you picked
- [ ] Counts on the tiles match what Instagram shows when you open a post
- [ ] The toolbar's **Sort by** re-orders instantly (no second scrape)
- [ ] **Export → CSV** downloads and opens with the right rows
- [ ] **Show original feed** restores Instagram's own grid exactly
- [ ] **Stop** mid-run finishes immediately and keeps what it had

Repeat on `/<you>/reels/` — a different payload shape and the one with view
counts — and on a TikTok profile.

### Worth testing specifically

| Case | Why |
|---|---|
| A profile with a **pinned** post | Must not end a date run early, and must stay out of the outlier baseline |
| An account with **< 20 posts** | Outlier should decline to score rather than invent a baseline |
| A **photo-only** Instagram profile | No view counts anywhere; likes must still sort, no empty Views column in exports |
| A **date range** run | Progress bar is driven by dates, not a count |
| **Everything** on a large profile | The long path — watch for stalls |

---

## 3. When it breaks

It will, eventually: these are private APIs with no stability promise. The
failure is almost always the same — the banner sits on *"Scrolling the feed to
collect posts…"* and nothing happens.

That means no feed response was recognised. Two possible causes, and you can
tell them apart in about a minute.

**Open DevTools → Network → Fetch/XHR, reload the profile and scroll.**

Find the request carrying the posts. Then:

**A. The endpoint moved** — the URL no longer contains what the adapter matches
(`/graphql/query` or `/api/graphql` for Instagram, `/api/post/item_list` for
TikTok).

→ Fix `matchesFeedRequest()`. Keep the old pattern as well: these rollouts are
gradual and both are live at once for weeks.

**B. The payload key moved** — the request is being matched, but the response no
longer has the key the adapter reads. Check the response JSON for the connection
holding the posts.

→ Fix `extractPage()`, again keeping the old shape. This has already happened
once to Instagram's reels connection, which is why the adapter tries three keys.

To confirm which, paste into the console on the profile page:

```js
// Does the adapter recognise the response shape?
// Copy a feed response body from the Network tab into `body` first.
const body = { /* paste here */ };
Object.keys(body.data ?? body);
```

Either fix is a few lines in `src/adapters/`. Add the new shape to
`test/adapters.test.js` and keep the old one — that is the regression guard.

### Other symptoms

| Symptom | Likely cause |
|---|---|
| "Couldn't start the sort" immediately | The MAIN-world script didn't load — check for errors in `chrome://extensions` |
| Banner appears, then "the feed didn't load" | Matched nothing for 20 s — same diagnosis as above |
| Grid renders but tiles are blank | Tile capture is finding the wrong element; check `tileFor()` / `gridContainer()` |
| Counts are all `—` | Field mapping in `normalize()` is stale |
| Sorted order looks wrong | Check whether the metric is `null` rather than `0` on those items |

---

## 4. Before opening a PR

```bash
npm run ci        # test, build, verify — the same three steps CI runs
```

`npm run verify` inspects the built extension: manifest paths, `getURL`
assets, bundle syntax, network hosts and permissions. It is what catches a
build that compiles but that Chrome would refuse to load.


and run §2 on at least one profile per platform you touched. A bug fix should
come with the test that would have caught it.
