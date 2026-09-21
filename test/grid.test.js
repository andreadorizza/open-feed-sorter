import { test } from "node:test";
import assert from "node:assert/strict";
import { makeProfileDom } from "../test-utils/dom.js";
import { renderGrid, clearGrid } from "../src/content/runtime/grid.js";

function items(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `id${i}`,
    code: `C${i}`,
    url: `https://www.instagram.com/creator/reel/C${i}/`,
    views: (n - i) * 1000,
    likes: (n - i) * 10,
    comments: i,
    createdAtMs: Date.UTC(2026, 0, i + 1),
    html: `<div class="native"><a href="/creator/reel/C${i}/"><img src="https://cdn/C${i}.jpg"></a></div>`,
  }));
}

test("hides the platform grid rather than reordering it", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  const container = env.grid;

  renderGrid(items(3), { container });

  assert.equal(container.style.display, "none");
  assert.equal(container.dataset.sfbHidden, "true");
  // The original is intact underneath, so exiting restores it exactly.
  assert.ok(container.querySelector("a"));
  env.teardown();
});

test("renders one tile per item, in the order given", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  renderGrid(items(4), { container: env.grid });

  const grid = env.window.document.getElementById("sfb-grid");
  const tiles = grid.querySelectorAll(".sfb-tile");
  assert.equal(tiles.length, 4);
  assert.deepEqual([...tiles].map((t) => t.dataset.sfbItemId), ["id0", "id1", "id2", "id3"]);
  env.teardown();
});

test("reuses the captured markup so tiles look native", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  renderGrid(items(1), { container: env.grid });

  const tile = env.window.document.querySelector(".sfb-tile");
  assert.ok(tile.querySelector(".native"), "platform markup preserved");
  assert.ok(tile.querySelector('a[href="/creator/reel/C0/"]'));
  env.teardown();
});

test("overlays a rank and every metric the item carries", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  renderGrid(items(2), { container: env.grid });

  const first = env.window.document.querySelector(".sfb-tile");
  assert.equal(first.querySelector(".sfb-tile__rank").textContent, "#1");

  const stats = first.querySelector(".sfb-tile__stats").textContent;
  assert.match(stats, /2K/, "views compacted");
  assert.match(stats, /20/, "likes shown");
  env.teardown();
});

test("omits metrics the platform did not return", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  const [item] = items(1);
  item.views = null; // an Instagram photo
  renderGrid([item], { container: env.grid });

  const tile = env.window.document.querySelector(".sfb-tile");
  assert.equal(tile.querySelector(".sfb-stat--views"), null);
  assert.ok(tile.querySelector(".sfb-stat--likes"));
  env.teardown();
});

test("badges only genuine outliers", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  const list = items(3);
  list[0].outlierScore = 4.2;
  list[1].outlierScore = 1.1; // normal — no badge
  renderGrid(list, { container: env.grid });

  const badges = env.window.document.querySelectorAll(".sfb-tile__outlier");
  assert.equal(badges.length, 1);
  assert.equal(badges[0].textContent, "4.2x");
  env.teardown();
});

test("falls back to a thumbnail when no markup was captured", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  const [item] = items(1);
  delete item.html;
  item.thumbnailUrl = "https://cdn/thumb.jpg";
  renderGrid([item], { container: env.grid });

  const fallback = env.window.document.querySelector(".sfb-tile__fallback");
  assert.equal(fallback.getAttribute("href"), item.url);
  assert.equal(fallback.querySelector("img").src, "https://cdn/thumb.jpg");
  env.teardown();
});

test("clearGrid restores the page exactly", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  const container = env.grid;
  const before = container.style.display;

  renderGrid(items(3), { container });
  clearGrid();

  assert.equal(env.window.document.getElementById("sfb-grid"), null);
  assert.equal(container.style.display, before);
  assert.equal(container.dataset.sfbHidden, undefined);
  env.teardown();
});

test("re-rendering replaces the previous grid instead of stacking", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  renderGrid(items(3), { container: env.grid });
  renderGrid(items(2), { container: env.grid });

  assert.equal(env.window.document.querySelectorAll("#sfb-grid").length, 1);
  assert.equal(env.window.document.querySelectorAll(".sfb-tile").length, 2);
  env.teardown();
});
