# Working in this repository

## Commands

```bash
npm install
npm run build     # → dist/   (load unpacked in chrome://extensions)
npm run watch     # rebuild on change
npm test          # 112 tests, no browser
npm run ci        # test → build → verify: what CI runs
```

## Where things go

- `src/core/` — pure logic (sorting, outliers, dates, exports). **No DOM, no
  `chrome.*`, no platform knowledge.** It is unit-tested directly in Node and
  that only works while it stays pure.
- `src/adapters/` — **all** platform-specific knowledge: endpoint matching,
  payload field mapping, DOM selectors. Nothing else may know which site it is
  running on. Needing to edit outside `adapters/` to support a platform means
  the abstraction is wrong.
- `src/page/` — MAIN world. Network hooks and the collect loop. No `chrome.*`
  available here.
- `src/content/` — ISOLATED world. All UI, and the only half with `chrome.*`.

`docs/ARCHITECTURE.md` explains why the work is split across two worlds and
why a run reloads the tab. Read it before changing the run lifecycle.

## Rules that have already been broken once

- **`null` is not `0`.** `Number(null) === 0`, which silently scored posts with
  no view count as zero views and dragged outlier baselines toward zero. Use
  `num()` from `adapters/types.js`.
- **Never assert on another program's rendered output.** A test that grepped
  `unzip -l` for a non-ASCII filename passed locally and failed in CI, because
  how a CLI prints a name depends on its build and locale. Assert on bytes or
  on structure.
- **Never forge a feed request.** The collector scrolls and lets the site
  paginate itself.
- **No servers, no telemetry, no accounts.** `scripts/verify-dist.mjs` enforces
  this — a bundle referencing an unexpected host fails CI. Adding a permission
  means updating `EXPECTED_PERMISSIONS` in the same commit, so it is visible in
  review.

## Communication

End every response with a short TL;DR in simplified technical English: short
sentences, common words, technical terms where they are the clearest option.
