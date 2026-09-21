import { test } from "node:test";
import assert from "node:assert/strict";
import { sortItems, availableSortKeys } from "../src/core/sort.js";

const items = [
  { id: "a", views: 100, likes: 5, createdAtMs: 300 },
  { id: "b", views: 300, likes: 1, createdAtMs: 100 },
  { id: "c", views: 200, likes: 9, createdAtMs: 200 },
];

test("sorts descending by the key's metric", () => {
  assert.deepEqual(sortItems(items, "views").map((i) => i.id), ["b", "c", "a"]);
  assert.deepEqual(sortItems(items, "likes").map((i) => i.id), ["c", "a", "b"]);
});

test("newest and oldest are opposite orders", () => {
  assert.deepEqual(sortItems(items, "newest").map((i) => i.id), ["a", "c", "b"]);
  assert.deepEqual(sortItems(items, "oldest").map((i) => i.id), ["b", "c", "a"]);
});

test("does not mutate the input", () => {
  const original = items.map((i) => i.id);
  sortItems(items, "views");
  assert.deepEqual(items.map((i) => i.id), original);
});

test("items missing the metric sink to the bottom in either direction", () => {
  const withGaps = [
    { id: "a", views: 10 },
    { id: "b", views: null },
    { id: "c", views: 20 },
  ];
  assert.deepEqual(sortItems(withGaps, "views").map((i) => i.id), ["c", "a", "b"]);

  const byDate = [
    { id: "a", createdAtMs: 10 },
    { id: "b", createdAtMs: null },
    { id: "c", createdAtMs: 20 },
  ];
  assert.deepEqual(sortItems(byDate, "oldest").map((i) => i.id), ["a", "c", "b"]);
});

test("outlier falls back to the surface metric when nothing was scored", () => {
  assert.deepEqual(
    sortItems(items, "outlier", { outlierFallback: "likes" }).map((i) => i.id),
    ["c", "a", "b"],
  );
});

test("outlier uses scores once they are present", () => {
  const scored = [
    { id: "a", views: 100, outlierScore: 5 },
    { id: "b", views: 900, outlierScore: 1 },
  ];
  assert.deepEqual(sortItems(scored, "outlier").map((i) => i.id), ["a", "b"]);
});

test("an unknown key leaves the order alone", () => {
  assert.deepEqual(sortItems(items, "nope").map((i) => i.id), ["a", "b", "c"]);
});

test("only offers metrics the surface actually carries", () => {
  const keys = availableSortKeys(["views", "likes"]);
  assert.ok(keys.includes("views"));
  assert.ok(!keys.includes("shares"));
  // Date and outlier sorts work on any surface.
  assert.ok(keys.includes("newest"));
  assert.ok(keys.includes("outlier"));
});
