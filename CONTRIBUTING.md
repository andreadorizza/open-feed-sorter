# Contributing

## Setup

```bash
npm install
npm run build     # → dist/, load unpacked in chrome://extensions
npm run watch     # rebuild on change (reload the extension after)
npm test          # no browser needed
```

## The most useful thing you can do

**Fix a platform that broke.** Instagram and TikTok change their payloads
without notice, and when they do the extension stops working — usually
silently, because the collect loop only starts once a response is intercepted.

When a sort hangs on "Scrolling the feed to collect posts…", it is nearly always
one of two things:

1. The feed endpoint moved → `adapter.matchesFeedRequest()` no longer matches.
2. The payload key moved → `adapter.extractPage()` returns `null`.

To find out which, open DevTools on a profile page, filter Network to XHR/Fetch,
scroll, and look at what actually carries the posts. Then fix the adapter and
add the new shape to `test/adapters.test.js` — keep the old shape too, since
these rollouts are gradual and both are live at once for a while.

## Adding a platform

One adapter file and two three-line entry points. The full walkthrough is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#adding-a-platform).

If you find yourself editing anything outside `src/adapters/` to make a platform
work, the abstraction is wrong — open an issue rather than working around it.

## House rules

**Keep `core/` pure.** No DOM, no `chrome.*`, no platform knowledge. It is
unit-tested directly in Node, and that is only possible while it stays pure.

**Keep platform knowledge in `adapters/`.** Endpoint matching, field mapping and
selectors. Nothing else should know which site it is on.

**`null` is not `0`.** A post with no view count is not a post with zero views.
`Number(null)` is `0`, which has already caused one real bug here: it dragged
outlier baselines toward zero on Instagram Posts, where every photo has a null
view count. Use `num()` from `adapters/types.js`.

**Never forge a feed request.** The collector scrolls and lets the site fetch.
Calling those endpoints directly would be signed-request territory and
distinguishable from organic traffic — [why](docs/ARCHITECTURE.md#why-we-scroll-instead-of-fetching).

**No servers, no telemetry, no accounts.** A change that adds a network request
of the extension's own needs a very good argument.

**Comment the surprising parts.** Most of this code is straightforward; the
parts that aren't are that way for a reason (the reload, the `outerHTML`
capture, the pool/display split). Say why, not what.

## Tests

```bash
npm test          # unit + jsdom integration
npm run ci        # what CI runs: test, build, then verify the built extension
```

CI runs on every pull request against Node 22 and 24. `npm run verify` checks
the *built* extension rather than the source: every manifest path and
`getURL` asset exists, every bundle parses, no bundle reaches a host outside
the two platforms, and no permission crept into the manifest. That last pair
are the ones worth knowing about — this extension promises it makes no network
requests of its own and asks for no API permissions, only host permissions for
the two sites, and the check is what keeps those true. If you add a permission
on purpose, update `EXPECTED_PERMISSIONS` in `scripts/verify-dist.mjs` in the
same commit, so the change is visible in review.

Anything in `core/` or `adapters/` should be tested directly. DOM-level
behaviour — the collector, the grid, the network hooks — is tested against jsdom
via `test-utils/dom.js`.

A bug fix should come with the test that would have caught it.

## Scope

Deliberately out of scope:

- Anything needing a backend — transcription, Google Sheets export, accounts.
- Anything that posts, follows, likes, comments or messages. This project reads.
- Bulk-downloading other people's media. Sorting and export is the remit.
