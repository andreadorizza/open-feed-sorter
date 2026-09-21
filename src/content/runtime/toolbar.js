/**
 * The toolbar that sits above a sorted grid.
 *
 * It does two things: re-sort what is already on screen, and export it.
 * Re-sorting is instant — every item is in memory, so switching from "most
 * views" to "most comments" is a sort and a re-render, with no second scrape.
 */

import { SORT_KEYS, sortItems, availableSortKeys } from "../../core/sort.js";
import { explainBaseline, OUTLIER_DEFAULTS } from "../../core/outlier.js";
import { dotIcon } from "./dots.js";
import { toCsv } from "../../core/export/csv.js";
import { toJson } from "../../core/export/json.js";
import { toXlsx } from "../../core/export/xlsx.js";
import { safeFilename } from "../../core/format.js";

const ID = "sfb-toolbar";

export class Toolbar {
  /**
   * @param {object} options
   * @param {(items: object[]) => void} options.onReorder
   * @param {() => void} options.onExit
   */
  constructor({ onReorder, onExit }) {
    this.onReorder = onReorder;
    this.onExit = onExit;
    this.items = [];
    this.meta = {};
    this.sortKey = null;
    this.el = null;
  }

  /**
   * The toolbar is rebuilt on every render, so the active sort key lives here
   * rather than being read back from the run config — otherwise a re-sort
   * would redraw the select showing the sort the run started with.
   */
  mount(items, meta, container) {
    const nextMeta = meta || {};
    if (nextMeta !== this.meta || !this.sortKey) this.sortKey = this._initialKey(items, nextMeta);
    this.items = items;
    this.meta = nextMeta;
    this.remove();

    this.el = this._build();
    container?.before(this.el);
    return this.el;
  }

  remove() {
    document.getElementById(ID)?.remove();
    this.el = null;
  }

  _build() {
    const root = document.createElement("div");
    root.id = ID;
    root.className = "sfb-toolbar";

    const count = this.items.length;
    const profile = this.meta.profile ? `@${this.meta.profile}` : "";

    root.innerHTML = `
      <div class="sfb-toolbar__row">
        <div class="sfb-toolbar__lead">
          <span class="sfb-toolbar__badge">Sorted</span>
          <span class="sfb-toolbar__count">${count} item${count === 1 ? "" : "s"}${profile ? ` from ${escapeHtml(profile)}` : ""}</span>
        </div>
        <div class="sfb-toolbar__actions">
          <label class="sfb-toolbar__field">
            <span>Sort by</span>
            <span class="sfb-select"><select class="sfb-toolbar__sort"></select></span>
          </label>
          <label class="sfb-toolbar__field">
            <span>Export</span>
            <span class="sfb-select">
              <select class="sfb-toolbar__export">
                <option value="">Choose…</option>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="json">JSON</option>
              </select>
            </span>
          </label>
          <button type="button" class="sfb-toolbar__exit">Show original feed</button>
        </div>
      </div>
      <p class="sfb-toolbar__note"></p>
    `;

    for (const wrap of root.querySelectorAll(".sfb-select")) wrap.appendChild(dotIcon("caret"));
    this._fillSortOptions(root.querySelector(".sfb-toolbar__sort"));

    const note = root.querySelector(".sfb-toolbar__note");
    note.replaceChildren();
    const explanation = explainBaseline(this.meta.outlier);
    if (explanation) note.append(dotIcon("bolt"), explanation);
    note.hidden = !explanation;

    root.querySelector(".sfb-toolbar__sort").addEventListener("change", (event) => {
      this.sortKey = event.target.value;
      this.items = sortItems(this.items, this.sortKey, { outlierFallback: this._fallbackMetric() });
      this.onReorder?.(this.items);
    });

    const exportSelect = root.querySelector(".sfb-toolbar__export");
    exportSelect.addEventListener("change", (event) => {
      const format = event.target.value;
      if (format) this._export(format);
      // Reset so picking the same format twice fires again.
      event.target.value = "";
    });

    root.querySelector(".sfb-toolbar__exit").addEventListener("click", () => this.onExit?.());

    return root;
  }

  _fillSortOptions(select) {
    const scored = isScored(this.items);
    const metrics = new Set();
    for (const item of this.items) {
      for (const key of ["views", "likes", "comments", "shares", "saves"]) {
        if (item[key] != null) metrics.add(key);
      }
    }

    for (const key of availableSortKeys([...metrics])) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = SORT_KEYS[key].label;
      // Shown but disabled rather than dropped: an option that silently
      // vanishes after you picked it reads as a bug. The note says why.
      if (key === "outlier" && !scored) {
        option.disabled = true;
        option.textContent = `${SORT_KEYS[key].label} (needs ${OUTLIER_DEFAULTS.floor} older posts)`;
      }
      option.selected = key === this.sortKey;
      select.appendChild(option);
    }
  }

  /** The run's sort, or what it fell back to when outliers couldn't be scored. */
  _initialKey(items, meta) {
    const key = meta.config?.sortBy || "views";
    if (key === "outlier" && !isScored(items)) return meta.outlier?.metric || "views";
    return key;
  }

  _fallbackMetric() {
    return this.meta.outlier?.metric || "views";
  }

  _export(format) {
    const base = safeFilename(
      `${this.meta.profile || this.meta.config?.platform || "feed"}-${this.items.length}-${this.meta.config?.surface || "items"}`,
    );

    if (format === "csv") {
      download(new Blob([toCsv(this.items)], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
    } else if (format === "json") {
      const payload = toJson(this.items, {
        platform: this.meta.config?.platform,
        surface: this.meta.config?.surface,
        profile: this.meta.profile,
        outlier: this.meta.outlier,
      });
      download(new Blob([payload], { type: "application/json" }), `${base}.json`);
    } else if (format === "xlsx") {
      download(toXlsx(this.items, { sheetName: this.meta.profile || "Feed" }), `${base}.xlsx`);
    }
  }
}

function isScored(items) {
  return items.some((item) => typeof item.outlierScore === "number");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers; one turn of
  // the event loop is enough for it to have started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
