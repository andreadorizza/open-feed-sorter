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

test("sets the platform grid aside rather than reordering it", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  const container = env.grid;

  renderGrid(items(3), { container });

  // Parked, not display:none — a zero-height grid makes the site think the
  // user is always at the end of it, and it pages through the whole profile.
  assert.equal(container.dataset.sfbHidden, "parked");
  assert.equal(container.style.position, "fixed");
  assert.equal(container.style.visibility, "hidden");
  assert.notEqual(container.style.display, "none");
  // The original is intact underneath, so exiting restores it exactly.
  assert.ok(container.querySelector("a"));
  env.teardown();
});

test("parks the wrappers that hold only the grid, and puts ours outside them", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  const doc = env.window.document;

  // Instagram's shape: the rows sit two plain wrappers deep, beside the
  // profile header. It measures the outer wrapper to decide when to load
  // more, so a sorted grid inside it made every scroll to the bottom fetch.
  const column = doc.createElement("div");
  const outer = doc.createElement("div");
  const inner = doc.createElement("div");
  env.grid.replaceWith(column);
  column.append(doc.createElement("header"), outer);
  outer.appendChild(inner);
  inner.appendChild(env.grid);

  const grid = renderGrid(items(2), { container: env.grid });

  assert.equal(outer.dataset.sfbHidden, "parked");
  assert.equal(outer.nextElementSibling, grid);
  assert.equal(column.dataset.sfbHidden, undefined, "the header's column stays put");

  clearGrid();
  assert.equal(outer.dataset.sfbHidden, undefined);
  assert.equal(outer.getAttribute("style"), null, "restored exactly");
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

test("every scored tile shows its score; only real outliers are highlighted", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  const list = items(3);
  list[0].outlierScore = 4.2;
  list[1].outlierScore = 1.1; // normal — shown, not highlighted
  // list[2] has no score at all — nothing to show
  renderGrid(list, { container: env.grid });

  const badges = env.window.document.querySelectorAll(".sfb-tile__outlier");
  assert.deepEqual([...badges].map((b) => b.textContent), ["4.2x", "1.1x"]);
  const hot = env.window.document.querySelectorAll(".sfb-tile__outlier--hot");
  assert.equal(hot.length, 1);
  assert.equal(hot[0].textContent, "4.2x");
  env.teardown();
});

test("a click opens the post in a new tab instead of navigating away", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  const opened = [];
  renderGrid(items(1), { container: env.grid, onOpen: (item) => opened.push(item.url) });

  const link = env.window.document.querySelector(".sfb-tile a");
  assert.equal(link.target, "_blank", "copied links are retargeted for modified clicks too");

  const event = new env.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  link.dispatchEvent(event);

  assert.equal(event.defaultPrevented, true, "the tab itself does not navigate");
  assert.deepEqual(opened, ["https://www.instagram.com/creator/reel/C0/"]);
  env.teardown();
});

test("a cmd-click is left to the browser", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  const opened = [];
  renderGrid(items(1), { container: env.grid, onOpen: (item) => opened.push(item.url) });

  const link = env.window.document.querySelector(".sfb-tile a");
  const event = new env.window.MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true });
  link.addEventListener("click", (e) => e.preventDefault()); // keep jsdom from navigating
  link.dispatchEvent(event);

  assert.deepEqual(opened, []);
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
  container.style.paddingTop = "120px"; // the site's own virtualisation spacer
  const before = container.style.cssText;

  renderGrid(items(3), { container });
  clearGrid();

  assert.equal(env.window.document.getElementById("sfb-grid"), null);
  assert.equal(container.style.cssText, before);
  assert.equal(container.dataset.sfbHidden, undefined);
  assert.equal(container.getAttribute("aria-hidden"), null);
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

test("a re-sort reorders tiles inside the same grid", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  const first = renderGrid(items(3), { container: env.grid });
  const columns = first.style.gridTemplateColumns;

  const reversed = items(3).reverse();
  const second = renderGrid(reversed, { container: env.grid });

  assert.equal(second, first, "same element — nothing re-measured");
  assert.equal(second.style.gridTemplateColumns, columns);
  assert.deepEqual(
    [...second.querySelectorAll(".sfb-tile")].map((t) => t.dataset.sfbItemId),
    ["id2", "id1", "id0"],
  );
  assert.equal(env.grid.dataset.sfbHidden, "parked", "the original stays set aside throughout");
  env.teardown();
});

test("the column count comes from the platform's own rows", () => {
  const env = makeProfileDom();
  // Four tiles in a row of 4, then one more below — jsdom has no layout, so
  // the rectangles are supplied.
  const lefts = [0, 104, 208, 312, 0];
  const tops = [0, 0, 0, 0, 140];
  lefts.forEach((left, i) => {
    const tile = env.addTile(`T${i}`);
    tile.querySelector("a").getBoundingClientRect = () => ({
      left, right: left + 100, top: tops[i], bottom: tops[i] + 130, width: 100, height: 130,
    });
  });

  const grid = renderGrid(items(2), { container: env.grid });
  assert.equal(grid.style.gridTemplateColumns, "repeat(4, minmax(0, 1fr))");
  assert.equal(grid.style.columnGap, "4px");
  env.teardown();
});

test("by default a click opens the item's own URL", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  renderGrid(items(1), { container: env.grid });

  const opened = [];
  const realClick = env.window.HTMLAnchorElement.prototype.click;
  env.window.HTMLAnchorElement.prototype.click = function () {
    opened.push({ href: this.href, target: this.target });
  };
  try {
    const link = env.window.document.querySelector(".sfb-tile a");
    link.dispatchEvent(new env.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  } finally {
    env.window.HTMLAnchorElement.prototype.click = realClick;
  }

  // Once shipped as ".../reels/[object%20Object]": the item was passed where a URL belonged.
  assert.deepEqual(opened, [{ href: "https://www.instagram.com/creator/reel/C0/", target: "_blank" }]);
  env.teardown();
});

test("falls back to display:none if parking would stretch the page", () => {
  const env = makeProfileDom();
  env.addTile("C0");
  // A transformed ancestor turns position:fixed into position:absolute, and
  // the parked grid 100000px down would then lengthen the page.
  let calls = 0;
  Object.defineProperty(env.window.document.documentElement, "scrollHeight", {
    configurable: true,
    get: () => (calls++ === 0 ? 2000 : 102000),
  });

  renderGrid(items(1), { container: env.grid });

  assert.equal(env.grid.dataset.sfbHidden, "removed");
  assert.equal(env.grid.style.display, "none");
  assert.equal(env.grid.style.position, "", "the parking styles were undone");
  env.teardown();
});
