/**
 * Rendering the sorted grid.
 *
 * The platform's own grid is hidden rather than reordered. Reordering it in
 * place fights the framework: both sites virtualise their grids and will
 * re-render, restoring feed order and discarding anything we moved. A separate
 * container we own is stable, and hiding rather than removing the original
 * means one line undoes the whole thing.
 *
 * Tiles are the markup captured during collection, so they carry the
 * platform's own styling and stay correct across redesigns.
 */

import { compactNumber, localDateTime } from "../../core/format.js";
import { formatScore, BADGE_MIN } from "../../core/outlier.js";

const GRID_ID = "sfb-grid";

export function clearGrid() {
  document.getElementById(GRID_ID)?.remove();
  for (const hidden of document.querySelectorAll("[data-sfb-hidden]")) {
    hidden.style.display = hidden.dataset.sfbPrevDisplay || "";
    delete hidden.dataset.sfbHidden;
    delete hidden.dataset.sfbPrevDisplay;
  }
}

/**
 * Measure the platform's own tile size so ours matches.
 *
 * Copying the measured geometry rather than picking our own numbers keeps the
 * sorted grid visually identical to the one it replaces, at any window width
 * and on either platform.
 */
function measureGrid(original) {
  const fallback = { cell: 220, columnGap: 4, rowGap: 4 };
  const firstTile = original?.querySelector("a")?.closest("div");
  if (!firstTile) return fallback;

  const rect = firstTile.getBoundingClientRect();
  const styles = getComputedStyle(original);
  return {
    cell: rect.width > 40 ? Math.round(rect.width) : fallback.cell,
    columnGap: parseFloat(styles.columnGap) || fallback.columnGap,
    rowGap: parseFloat(styles.rowGap) || fallback.rowGap,
  };
}

/**
 * @param {object[]} items
 * @param {object} options
 * @param {Element} options.container the platform grid to replace
 * @param {(item: object) => void} [options.onOpen]
 */
export function renderGrid(items, { container, onOpen } = {}) {
  clearGrid();
  if (!container) return null;

  const geometry = measureGrid(container);

  container.dataset.sfbPrevDisplay = container.style.display;
  container.dataset.sfbHidden = "true";
  container.style.display = "none";

  const grid = document.createElement("div");
  grid.id = GRID_ID;
  grid.className = "sfb-grid";
  // auto-fill against the measured cell width reflows exactly like the
  // original does, without us having to know the column count.
  grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${Math.max(80, geometry.cell - 2)}px, 1fr))`;
  grid.style.columnGap = `${geometry.columnGap}px`;
  grid.style.rowGap = `${geometry.rowGap}px`;

  for (const [index, item] of items.entries()) {
    grid.appendChild(buildTile(item, index, onOpen));
  }

  container.after(grid);
  return grid;
}

function buildTile(item, index, onOpen) {
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

  tile.appendChild(buildRank(index));
  tile.appendChild(buildStats(item));

  const score = item.outlierScore;
  if (typeof score === "number" && score >= BADGE_MIN) {
    tile.appendChild(buildOutlierBadge(score));
  }

  // The captured markup contains the platform's own anchor, which navigates on
  // its own. The handler is only for the fallback tile and for hosts that
  // swallow the click.
  if (onOpen) {
    tile.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
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

function buildOutlierBadge(score) {
  const badge = document.createElement("div");
  badge.className = "sfb-tile__outlier";
  badge.textContent = formatScore(score);
  badge.title = "Views compared with this account's recent median";
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
    cell.textContent = `${ICONS[key]} ${compactNumber(value)}`;
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

// Text glyphs rather than icon files: they inherit colour and font size, need
// no web_accessible_resources entry, and cannot 404.
const ICONS = {
  views: "▶",
  likes: "♥",
  comments: "💬",
  shares: "↗",
  saves: "🔖",
};
