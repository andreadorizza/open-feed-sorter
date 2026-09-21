import { test } from "node:test";
import assert from "node:assert/strict";
import { makeProfileDom } from "../test-utils/dom.js";
import { Toolbar } from "../src/content/runtime/toolbar.js";

function items(scored) {
  return [3, 1, 2].map((n) => ({
    id: `id${n}`,
    views: n * 1000,
    likes: n * 10,
    comments: n,
    createdAtMs: Date.UTC(2026, 0, n),
    outlierScore: scored ? n / 2 : undefined,
  }));
}

function mount(toolbar, list, meta, env) {
  return toolbar.mount(list, meta, env.grid);
}

test("an unscorable run keeps the outlier option, disabled, and says why", () => {
  const env = makeProfileDom();
  const meta = {
    config: { sortBy: "outlier" },
    outlier: { status: "insufficient", baseline: null, metric: "views", poolSize: 12 },
  };
  const el = mount(new Toolbar({}), items(false), meta, env);

  const select = el.querySelector(".sfb-toolbar__sort");
  const outlier = select.querySelector('option[value="outlier"]');
  assert.ok(outlier, "still listed");
  assert.equal(outlier.disabled, true);
  assert.equal(select.value, "views", "shows the sort that was actually applied");
  assert.match(el.querySelector(".sfb-toolbar__note").textContent, /found 12 posts/);
  env.teardown();
});

test("a scored run offers the outlier sort and explains the baseline", () => {
  const env = makeProfileDom();
  const meta = {
    config: { sortBy: "outlier" },
    outlier: { status: "ok", baseline: 2000, metric: "views", poolSize: 25 },
  };
  const el = mount(new Toolbar({}), items(true), meta, env);

  const select = el.querySelector(".sfb-toolbar__sort");
  assert.equal(select.value, "outlier");
  assert.equal(select.querySelector('option[value="outlier"]').disabled, false);
  assert.match(el.querySelector(".sfb-toolbar__note").textContent, /views ÷ 2K/);
  env.teardown();
});

test("a re-sort survives the toolbar being rebuilt", () => {
  const env = makeProfileDom();
  const meta = { config: { sortBy: "views" }, outlier: null };
  let toolbar;
  toolbar = new Toolbar({ onReorder: (list) => mount(toolbar, list, meta, env) });
  const el = mount(toolbar, items(false), meta, env);

  const select = el.querySelector(".sfb-toolbar__sort");
  select.value = "comments";
  select.dispatchEvent(new env.window.Event("change"));

  const rebuilt = env.window.document.querySelector(".sfb-toolbar__sort");
  assert.notEqual(rebuilt, select, "the toolbar was re-mounted");
  assert.equal(rebuilt.value, "comments");
  env.teardown();
});
