import { test } from "node:test";
import assert from "node:assert/strict";
import { makeProfileDom } from "../test-utils/dom.js";
import { hasLoadedMedia, tileMarkup } from "../src/page/runtime/dom-wait.js";

test("an image with its real src but hidden until it loads is not loaded yet", () => {
  const env = makeProfileDom();
  const tile = env.addTile("A", { hidden: true });
  assert.equal(hasLoadedMedia(tile), false);

  // What the platform's load handler does.
  tile.querySelector("img").style.removeProperty("visibility");
  assert.equal(hasLoadedMedia(tile), true);
  env.teardown();
});

test("a placeholder image is not loaded, a visible real one is", () => {
  const env = makeProfileDom();
  assert.equal(hasLoadedMedia(env.addTile("A", { loaded: false })), false);
  assert.equal(hasLoadedMedia(env.addTile("B")), true);
  env.teardown();
});

test("captured markup never keeps an image hidden for loading", () => {
  // The copy in the sorted grid has no load handler to unhide it, so a tile
  // captured mid-load would render blank for good.
  const env = makeProfileDom();
  const tile = env.addTile("A", { hidden: true });
  const host = env.window.document.createElement("div");
  host.innerHTML = tileMarkup(tile);

  const img = host.querySelector("img");
  assert.equal(img.getAttribute("src"), "https://cdn/A.jpg");
  assert.equal(img.style.visibility, "");
  assert.equal(img.style.objectFit, "cover", "the rest of the style is kept");
  env.teardown();
});

test("capturing markup leaves the platform's own tile alone", () => {
  const env = makeProfileDom();
  const tile = env.addTile("A", { hidden: true });
  tileMarkup(tile);
  assert.equal(tile.querySelector("img").style.visibility, "hidden");
  env.teardown();
});
