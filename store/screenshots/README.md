# Store screenshots

Five screenshots for the Chrome Web Store listing, the same five for the
Product Hunt gallery, and a dark copy of the first one for the landing page.
One command makes all eleven:

```bash
node store/tools/screenshots.mjs
```

| Chrome Web Store (1280×800) | Product Hunt (1270×760) | Shows |
|---|---|---|
| `01-sorted-grid.png` | `../product-hunt/gallery-01-sorted-grid.png` | A profile sorted by outlier score. The toolbar is above the grid, and every tile has its rank, its score (`7.8x`, `5.3x`…) and its counts. |
| `02-popup.png` | `../product-hunt/gallery-02-popup.png` | The popup over the unsorted profile, with a sort and how many posts to collect. |
| `03-collecting.png` | `../product-hunt/gallery-03-collecting.png` | A run in progress: the banner with its progress bar and the Stop button, over the feed as it loads. |
| `04-export.png` | `../product-hunt/gallery-04-export.png` | The same run re-sorted by comments, with the CSV the toolbar exported opened next to it. |
| `05-dark-mode.png` | `../product-hunt/gallery-05-dark-mode.png` | The dark (backlit) theme, on TikTok-shaped data. Each tile shows views, likes, comments, shares and saves. |

The Chrome Web Store shows up to five screenshots, in the order of the file
names. This folder holds exactly those five, so keep other images out of it.
`site/index.html` links to images here by name, so keep the names too.

`store/landing/01-sorted-grid-dark.png` (1280×800) is shot 01 again in the dark
(backlit) theme, for the landing page's dark mode; it is not uploaded to the store.

All eleven are 8-bit RGB PNGs with no alpha channel, which is what the store
asks for. The generator checks every file it writes from the file's bytes: the
PNG signature, every chunk CRC, and the width, height, bit depth and colour
type in IHDR. Each run ends with a table of the results.

## All data is fictional

- **Crumbwell Bakery** (`@crumbwell.bakery`) is not a real account. Its posts,
  captions, dates and counts come from `store/harness/fixture.js`, which uses a
  fixed seed.
- The thumbnails are flat SVG shapes that `store/harness/thumbs.js` generates.
  There are no photos, no faces and no images of real posts.
- The profile page around the extension is a plain greyscale page. It uses no
  logo, colour, icon or layout from Instagram or TikTok. The profile header
  says "Fictional demo account".
- The popup names the platform in plain text ("Instagram · Reels"), because the
  real popup does that. No logos are used.

## How the screenshots are made

The extension UI in the screenshots comes from the extension's own code. It is
not a mock-up.

`store/harness/page.html` is a fake profile page. The page gets its feed as
JSON from `/api/graphql` (or `/api/post/item_list/` for TikTok), in each
platform's own response format. It shows the posts a page at a time, and it
loads more when you scroll to the bottom. The extension then runs on this page
the same way it runs on a real profile:

1. The popup message `sfb:run` goes to `src/content/run.js`. It saves the run
   and reloads the tab.
2. `src/page/run.js` takes the run. It adds its fetch hooks, and the collector
   scrolls the page and reads each page of the feed. The collector, pacing,
   outlier baseline and sort are all the real code.
3. The content script draws the banner, the grid and the toolbar with
   `banner.js`, `grid.js`, `toolbar.js` and `styles.css`. The font is Matrix
   Sans Screen, which `font.js` loads.
4. For the export shot, the real `<select>` change handlers re-sort the grid
   and write the CSV, XLSX and JSON files.

The popup is the real `src/popup/popup.html`, `popup.css` and `popup.js`. It
runs in an iframe beside the page. Its context line
("Instagram · Reels · @crumbwell.bakery") is the answer from the content
script in the page.

These parts were changed for the harness:

- **`src/adapters/index.js` is replaced by `store/harness/adapter.js`.** The
  page runs on localhost, so `adapterForHost()` would find no platform. The
  replacement adapter spreads the real Instagram or TikTok adapter object.
  Only `detectSurface()` and `profileName()` are replaced, because the real
  ones read the page URL.
- **A small `chrome.*` stub.** The harness page is a normal web page, so it has
  no `chrome.runtime`. The stub (`content.entry.js`, `popup-stub.js`) passes
  messages between the popup and the page. It also catches download links, so
  that an export is read in the page and not saved to disk.
- **A fixed clock** (`clock.js`). `Date.now()` starts at the fixture's "now".
  Outlier scores leave out posts newer than three days, so a fixed clock keeps
  the scores the same on every run.
- **Parts that are not extension UI:**
  - the LCD caption strip at the top of each image;
  - the fake profile page;
  - in `04-export.png`, the spreadsheet window. The window is plain HTML, but
    the rows in it are the CSV that the toolbar exported. The first two
    columns (Profile, URL) are off the left edge of the window.

## Regenerating

You need Node 22 or later, and Google Chrome at
`/Applications/Google Chrome.app`. For a different location, set `CHROME_PATH`.
The generator uses esbuild, which `npm install` already installs. It does not
download anything, and it does not touch `dist/`.

```bash
node store/tools/screenshots.mjs                 # all shots, both sizes (about 2 minutes)
node store/tools/screenshots.mjs --only=export   # one shot
node store/tools/screenshots.mjs --serve         # serve the harness to open in a browser
node store/tools/screenshots.mjs --keep-build    # keep store/harness/build/ after the run
```

Each shot is defined in `store/harness/stage.js`: its caption, which platform
it uses, what the run does, and where the page is scrolled. The render scale
is 1.25. At that scale, 1024×640 CSS pixels is exactly 1280×800, and
1016×608 is exactly 1270×760. Both sizes are rendered separately; neither is
a resized copy of the other.
