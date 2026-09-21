/**
 * Rendering the sorted grid.
 *
 * The platform's own grid is set aside rather than reordered. Reordering it in
 * place fights the framework: both sites virtualise their grids and will
 * re-render, restoring feed order and discarding anything we moved. A separate
 * container we own is stable, and setting the original aside rather than
 * removing it means one call undoes the whole thing.
 *
 * Tiles are the markup captured during collection, so they carry the
 * platform's own styling and stay correct across redesigns.
 */

import { compactNumber, localDateTime } from "../../core/format.js";
import { formatScore, BADGE_MIN } from "../../core/outlier.js";
import { dotIcon } from "./dots.js";

const GRID_ID = "sfb-grid";

/** The grid on screen and the platform container it replaced. */
let mounted = null;

export function clearGrid() {
  mounted = null;
  document.getElementById(GRID_ID)?.remove();
  for (const hidden of document.querySelectorAll("[data-sfb-hidden]")) {
    hidden.style.cssText = hidden.dataset.sfbPrevStyle || "";
    if (!hidden.style.cssText) hidden.removeAttribute("style");
    if ("sfbSetAria" in hidden.dataset) hidden.removeAttribute("aria-hidden");
    delete hidden.dataset.sfbSetAria;
    delete hidden.dataset.sfbHidden;
    delete hidden.dataset.sfbPrevStyle;
  }
}

/**
 * Take the platform grid out of sight without letting its infinite scroll run.
 *
 * `display: none` looks like the obvious move and is the wrong one. A hidden
 * element measures as zero height at the top of the viewport, so the site's
 * scroll logic concludes the user is always at the end of its grid and fetches
 * page after page into it — traffic the user never asked for, and a spinner
 * under our grid.
 *
 * Instead the grid is "parked": fixed, invisible, and far below the viewport.
 * It keeps its real size, so by every measurement the end of the feed is a
 * long way off and nothing is fetched. Fixed elements don't extend the page,
 * unless an ancestor is transformed and becomes their containing block — so
 * the page height is checked, and `display: none` remains the fallback.
 *
 * @returns {"parked"|"removed"}
 */
function setAside(container) {
  const heightBefore = document.documentElement.scrollHeight;
  const width = container.getBoundingClientRect().width;

  container.dataset.sfbPrevStyle = container.getAttribute("style") || "";
  for (const [property, value] of [
    ["position", "fixed"],
    ["top", "100000px"],
    ["left", "0"],
    ["width", width > 0 ? `${width}px` : "100%"],
    ["visibility", "hidden"],
    ["pointer-events", "none"],
  ]) {
    container.style.setProperty(property, value, "important");
  }

  if (document.documentElement.scrollHeight > heightBefore + 100) {
    container.style.cssText = container.dataset.sfbPrevStyle;
    container.style.setProperty("display", "none", "important");
    container.dataset.sfbHidden = "removed";
    return "removed";
  }

  if (!container.hasAttribute("aria-hidden")) {
    container.setAttribute("aria-hidden", "true");
    container.dataset.sfbSetAria = "";
  }
  container.dataset.sfbHidden = "parked";
  return "parked";
}

const FALLBACK_GEOMETRY = { columns: 3, gap: 4 };

/**
 * Read the platform grid's column count and gap off the rendered tiles.
 *
 * Counting the tiles that share a row gives the column count exactly, where
 * deriving it from a measured tile width and `auto-fill` rounds differently
 * whenever the measurement is a pixel off. Rows are grouped by their top edge;
 * the widest row wins, because the last row of a feed can be short.
 */
function measureGrid(original) {
  const boxes = [...original.querySelectorAll("a[href]")]
    .map((anchor) => anchor.getBoundingClientRect())
    .filter((rect) => rect.width > 40 && rect.height > 40);
  if (!boxes.length) return FALLBACK_GEOMETRY;

  const rows = new Map();
  for (const rect of boxes) {
    const top = Math.round(rect.top);
    if (!rows.has(top)) rows.set(top, new Map());
    rows.get(top).set(Math.round(rect.left), rect);
  }
  const widest = [...rows.values()]
    .map((row) => [...row.values()].sort((a, b) => a.left - b.left))
    .sort((a, b) => b.length - a.length)[0];

  const gap = widest.length > 1 ? widest[1].left - widest[0].right : FALLBACK_GEOMETRY.gap;
  return {
    columns: widest.length,
    gap: Math.min(32, Math.max(0, Math.round(gap))),
  };
}

/** Measure once, hide the original, and put our grid in its place. */
function mountGrid(container) {
  const { columns, gap } = measureGrid(container);
  setAside(container);

  const grid = document.createElement("div");
  grid.id = GRID_ID;
  grid.className = "sfb-grid";
  grid.dataset.sfbGrid = "";
  grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  grid.style.columnGap = `${gap}px`;
  grid.style.rowGap = `${gap}px`;

  container.after(grid);
  mounted = { grid, container };
  return grid;
}

/**
 * @param {object[]} items
 * @param {object} options
 * @param {Element} options.container the platform grid to replace
 * @param {(item: object) => void} [options.onOpen] defaults to the item's URL in a new tab
 * @param {{metric: string}|null} [options.outlier] the run's baseline verdict
 */
export function renderGrid(items, { container, onOpen = openItem, outlier = null } = {}) {
  if (!container) {
    clearGrid();
    return null;
  }

  // A re-sort reorders tiles inside the grid already on screen. Rebuilding it
  // would re-measure a page that now has our grid in it, and the column count
  // could change under the user.
  let grid = mounted?.container === container && mounted.grid.isConnected ? mounted.grid : null;
  if (!grid) {
    clearGrid();
    grid = mountGrid(container);
  }

  grid.replaceChildren(
    ...items.map((item, index) => buildTile(item, index, { onOpen, metric: outlier?.metric })),
  );
  return grid;
}

/**
 * Open a post without leaving the sorted grid.
 *
 * Following the captured link in place navigates the tab, and going back
 * reloads the profile in its original order — the sort is gone. An anchor
 * with target=_blank opens a tab the same way a cmd-click would.
 */
export function openInNewTab(url) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.click();
}

function openItem(item) {
  openInNewTab(item.url);
}

function buildTile(item, index, { onOpen, metric }) {
  const tile = document.createElement("div");
  tile.className = "sfb-tile";
  tile.dataset.sfbItemId = item.id;

  if (item.html) {
    tile.innerHTML = item.html;
    // Captured markup carries its own width; ours is set by the grid track.
    const root = tile.firstElementChild;
    if (root) {
      root.style.width = "100%";
      root.style.minWidth = "0";
    }
  } else {
    tile.appendChild(buildFallbackTile(item));
  }

  // Middle-, cmd- and shift-clicks are left to the browser, and land in a new
  // tab too — every copied link is retargeted.
  for (const link of tile.querySelectorAll("a[href]")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  tile.appendChild(buildRank(index));
  tile.appendChild(buildStats(item));

  const score = item.outlierScore;
  if (typeof score === "number" && Number.isFinite(score)) {
    tile.appendChild(buildOutlierBadge(score, metric));
  }

  // A plain click is taken over entirely: the platform's router listens for
  // clicks on its own links and would navigate this tab regardless of target.
  if (onOpen) {
    tile.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      onOpen(item);
    });
  }

  return tile;
}

/** Used when collection captured no markup — a rare but visible failure. */
function buildFallbackTile(item) {
  const link = document.createElement("a");
  link.className = "sfb-tile__fallback";
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  if (item.thumbnailUrl) {
    const img = document.createElement("img");
    img.src = item.thumbnailUrl;
    img.alt = "";
    img.loading = "lazy";
    link.appendChild(img);
  }
  return link;
}

function buildRank(index) {
  const rank = document.createElement("div");
  rank.className = "sfb-tile__rank";
  rank.textContent = `#${index + 1}`;
  return rank;
}

/**
 * Every scored tile carries its score, so "how did this one do?" never needs
 * a sort to answer. Only real outliers are highlighted.
 */
function buildOutlierBadge(score, metric = "views") {
  const badge = document.createElement("div");
  badge.className = `sfb-tile__outlier${score >= BADGE_MIN ? " sfb-tile__outlier--hot" : ""}`;
  badge.textContent = formatScore(score);
  badge.title = `${formatScore(score)} this account's median ${metric}`;
  return badge;
}

/**
 * The counts overlay.
 *
 * This is the point of the whole extension on Instagram, where a grid tile
 * shows no numbers at all until you hover it, and then only likes and
 * comments. Every metric the platform returned is shown at once.
 */
function buildStats(item) {
  const stats = document.createElement("div");
  stats.className = "sfb-tile__stats";

  const metrics = [
    ["views", "Views", item.views],
    ["likes", "Likes", item.likes],
    ["comments", "Comments", item.comments],
    ["shares", "Shares", item.shares],
    ["saves", "Saves", item.saves],
  ];

  for (const [key, label, value] of metrics) {
    if (value == null) continue;
    const cell = document.createElement("span");
    cell.className = `sfb-stat sfb-stat--${key}`;
    cell.title = `${label}: ${value.toLocaleString()}`;
    cell.append(dotIcon(key), compactNumber(value));
    stats.appendChild(cell);
  }

  if (Number.isFinite(item.createdAtMs)) {
    const date = document.createElement("span");
    date.className = "sfb-stat sfb-stat--date";
    date.textContent = localDateTime(item.createdAtMs);
    stats.appendChild(date);
  }

  return stats;
}
