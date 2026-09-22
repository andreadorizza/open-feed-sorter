/**
 * Sets up one screenshot.
 *
 * `stage.html?shot=<id>` loads the fake profile page, then drives the real
 * extension through the same steps a person would: the popup's "sort" message,
 * the reload, the run, the toolbar's re-sort and export controls. When the
 * page is in the state the shot needs, `window.stage.ready` resolves and the
 * generator (store/tools/screenshots.mjs) takes the picture.
 *
 * `window.stage.layout()` re-applies the shot's scroll position; the generator
 * calls it after each viewport change, since the same page is captured at the
 * Chrome Web Store size and again at the Product Hunt size.
 */

const RUN = { mode: "count", range: null };

export const SHOTS = {
  "sorted-grid": {
    caption: "Sort any profile by outlier score",
    platform: "instagram",
    run: { ...RUN, sortBy: "outlier", count: 100 },
    until: sorted,
    layout: toolbarNearTop,
  },

  popup: {
    caption: "Pick a sort and how much. No account.",
    platform: "instagram",
    // "Most views" rather than "Biggest outliers": the outlier choice adds a
    // four-line note that makes the popup taller than the image.
    popup: { sortBy: "views", count: "100" },
    layout: fitPopup,
  },

  collecting: {
    caption: "It scrolls the feed for you. Stop any time.",
    platform: "instagram",
    hold: 36,
    run: { ...RUN, sortBy: "outlier", count: 100 },
    until: (win) => bannerSays(win, "Collected 36 of 100"),
    layout: spinnerNearBottom,
  },

  export: {
    caption: "Re-sort instantly. Export CSV, Excel or JSON.",
    platform: "instagram",
    run: { ...RUN, sortBy: "outlier", count: 100 },
    until: sorted,
    after: resortAndExport("comments"),
    layout: (win) => {
      const y = toolbarNearTop(win);
      placeSheet(win);
      return y;
    },
  },

  dark: {
    caption: "Every metric on every tile. Dark mode too.",
    platform: "tiktok",
    run: { ...RUN, sortBy: "views", count: 50 },
    until: sorted,
    layout: toolbarNearTop,
  },
};

// ── waiting ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function until(test, { timeoutMs = 90_000, what = "condition" } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let value;
    try {
      value = await test();
    } catch {
      value = null;
    }
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(100);
  }
}

function nextLoad(frame) {
  return new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
}

/** The run finished: toolbar on screen, and the "Sorted N posts." banner gone. */
function sorted(win) {
  const doc = win.document;
  return doc.getElementById("sfb-toolbar") && !doc.getElementById("sfb-banner");
}

function bannerSays(win, text) {
  return win.document.querySelector(".sfb-banner__subtitle")?.textContent === text;
}

async function fontsReady(doc) {
  await doc.fonts.ready;
  await until(() => doc.fonts.check('15px "SFF Matrix Sans Screen"'), { what: "the dot-matrix font" });
}

// ── shot steps ──────────────────────────────────────────────────────────

/**
 * Scroll so the toolbar sits just under the site's sticky top bar — where a
 * person would scroll to look at the sorted grid.
 */
function toolbarNearTop(win) {
  const doc = win.document;
  const toolbar = doc.getElementById("sfb-toolbar");
  const bar = doc.querySelector(".topbar")?.getBoundingClientRect().height || 0;
  const top = toolbar.getBoundingClientRect().top + win.scrollY;
  return scrollPage(win, top - bar - 12);
}

/**
 * Mid-run, with the site's loading spinner at the foot of the screen and the
 * last captured row above it. The collector left the page at the very bottom
 * (it scrolls there to ask for the next page); this is a little higher, where
 * the feed rather than the site's footer fills the frame.
 */
function spinnerNearBottom(win) {
  const spinner = win.document.querySelector(".feed__spinner");
  const bottom = spinner.getBoundingClientRect().bottom + win.scrollY;
  return scrollPage(win, bottom - win.innerHeight + 16);
}

/** Scroll to a whole CSS pixel, and report where, so the generator can check it held. */
function scrollPage(win, top) {
  const y = Math.max(0, Math.round(top));
  win.scrollTo({ top: y, behavior: "instant" });
  return y;
}

function fitPopup() {
  const frame = document.getElementById("popup");
  const doc = frame.contentDocument;
  frame.style.height = `${doc.documentElement.scrollHeight}px`;
}

async function openPopup({ sortBy, count }) {
  const wrap = document.getElementById("popupWrap");
  const frame = document.getElementById("popup");
  const load = nextLoad(frame);
  frame.src = "build/popup.html";
  wrap.hidden = false;
  await load;

  const doc = frame.contentDocument;
  await until(() => !doc.getElementById("form").hidden, { what: "the popup's form" });
  // Choose the way a person would: set the control, fire its change event,
  // and let popup.js react (it writes the outlier explanation).
  for (const [id, value] of [["sortBy", sortBy], ["count", count]]) {
    const select = doc.getElementById(id);
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  await fontsReady(doc);
}

function resortAndExport(sortKey) {
  return async (win) => {
    const doc = win.document;

    const sort = doc.querySelector(".sfb-toolbar__sort");
    sort.value = sortKey;
    sort.dispatchEvent(new Event("change", { bubbles: true }));
    await until(() => doc.querySelector(".sfb-toolbar__sort")?.value === sortKey, { what: "the re-sort" });

    for (const format of ["csv", "xlsx", "json"]) {
      const select = doc.querySelector(".sfb-toolbar__export");
      select.value = format;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const files = await win.__harness.downloads();
    const csv = files.find((file) => file.filename.endsWith(".csv"));
    showSheet(csv);

    // Keyboard-style focus, so the Export control carries its focus ring.
    doc.querySelector(".sfb-toolbar__export").focus({ focusVisible: true });
  };
}

// ── the exported file ───────────────────────────────────────────────────

/**
 * Open the sheet just below the first row's rank and score badges, so the
 * re-sorted order stays readable above it.
 */
function placeSheet(win) {
  const grid = win.document.getElementById("sfb-grid");
  const frame = document.getElementById("page").getBoundingClientRect();
  document.getElementById("sheet").style.top = `${Math.round(frame.top + grid.getBoundingClientRect().top + 52)}px`;
}

/** RFC 4180, enough for the exporter's own output. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const body = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

const COLUMN_WIDTHS = { Date: 140, Views: 72, Likes: 60, Comments: 86, Outlier: 66, Caption: 250 };
const ROW_NUMBERS = 34;

/** More rows than fit: the window runs off the bottom of the image, as a long sheet would. */
const SHEET_ROWS = 14;

/**
 * The CSV the toolbar just exported, opened in a plain spreadsheet-style
 * view. It starts at the Date column — the first two columns (Profile and
 * URL) are scrolled out of view, the way a wide sheet opens narrow.
 */
function showSheet(csv) {
  const rows = parseCsv(csv.text);
  const header = rows[0];
  const first = header.indexOf("Date");
  const shown = header.slice(first);

  const letters = shown.map((_, i) => String.fromCharCode(65 + first + i));
  const numeric = new Set(["Views", "Likes", "Comments", "Outlier"]);

  const sheet = document.getElementById("sheet");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const widths = shown.map((name) => COLUMN_WIDTHS[name] || 90);
  const cols = widths.map((width) => `<col style="width:${width}px">`).join("");
  sheet.style.width = `${ROW_NUMBERS + widths.reduce((a, b) => a + b, 0)}px`;

  const body = rows.slice(0, SHEET_ROWS).map((row, r) => {
    const cells = row.slice(first).map((value, i) => {
      const name = shown[i];
      const classes = [r > 0 && numeric.has(name) ? "num" : "", name === "Outlier" && parseFloat(value) >= 2 ? "hot" : ""]
        .filter(Boolean)
        .join(" ");
      // A spreadsheet shows an ISO timestamp as a date and time.
      const display = r > 0 && name === "Date" ? value.replace("T", " ").slice(0, 16) : value;
      return `<td${classes ? ` class="${classes}"` : ""}>${esc(display)}</td>`;
    });
    return `<tr><th>${r + 1}</th>${cells.join("")}</tr>`;
  });

  sheet.innerHTML = `
    <header class="sheet__bar">
      <span class="sheet__dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="sheet__name">${esc(csv.filename)}</span>
    </header>
    <table class="sheet__table">
      <colgroup><col style="width:${ROW_NUMBERS}px">${cols}</colgroup>
      <thead><tr><th class="sheet__corner"></th>${letters.map((l) => `<th>${l}</th>`).join("")}</tr></thead>
      <tbody>${body.join("")}</tbody>
    </table>
  `;
  sheet.hidden = false;
}

// ── run ─────────────────────────────────────────────────────────────────

async function prepare(id) {
  const shot = SHOTS[id];
  if (!shot) throw new Error(`unknown shot "${id}"`);

  document.getElementById("captionTitle").textContent = shot.caption;
  await fontsReady(document);

  const frame = document.getElementById("page");
  const query = new URLSearchParams({ platform: shot.platform });
  if (shot.hold) query.set("hold", String(shot.hold));

  let load = nextLoad(frame);
  frame.src = `page.html?${query}`;
  await load;

  // The site has rendered its first page and the content script is listening.
  await until(() => frame.contentWindow.__harness && frame.contentDocument.documentElement.dataset.feedPages, {
    what: "the profile page",
  });

  if (shot.run) {
    // Exactly what the popup's "Sort this profile" sends to the tab.
    load = nextLoad(frame);
    const reply = await frame.contentWindow.__harness.sendMessage({ type: "sfb:run", config: shot.run });
    if (!reply?.ok) throw new Error(`run refused: ${JSON.stringify(reply)}`);
    await load; // the content script reloads the tab to start the run
    await until(() => frame.contentWindow.__harness && shot.until(frame.contentWindow), { what: `shot "${id}"` });
  }

  const win = frame.contentWindow;
  await fontsReady(win.document);
  await shot.after?.(win);
  if (shot.popup) await openPopup(shot.popup);

  // Let the banner's step animations and any last image decode settle.
  await sleep(700);
}

const id = new URLSearchParams(location.search).get("shot");
let intended = null;

/** Apply the shot's layout for the current viewport; resolves after two frames. */
function layout() {
  const win = document.getElementById("page").contentWindow;
  const y = SHOTS[id]?.layout?.(win);
  intended = typeof y === "number" ? y : null;
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))));
}

window.stage = {
  ready: prepare(id).then(
    async () => {
      await layout();
      return { ok: true };
    },
    (error) => ({ ok: false, error: String(error?.stack || error) }),
  ),
  layout,
  /**
   * Whether the page is still where layout() put it. A run in progress keeps
   * scrolling the page on its own; the generator retakes a capture if it did.
   */
  held() {
    const win = document.getElementById("page").contentWindow;
    return intended === null || Math.abs(win.scrollY - intended) < 1;
  },
};
