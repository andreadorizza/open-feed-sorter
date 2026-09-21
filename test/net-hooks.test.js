import { test } from "node:test";
import assert from "node:assert/strict";
import { makeProfileDom } from "../test-utils/dom.js";
import { installNetworkHooks } from "../src/page/runtime/net-hooks.js";

function setup(matcher = (url) => url.includes("/feed")) {
  const env = makeProfileDom();
  const seen = [];
  const original = { calls: [] };

  env.window.fetch = async (input) => {
    original.calls.push(input);
    return new Response(JSON.stringify({ hello: "world" }), {
      headers: { "content-type": "application/json" },
    });
  };
  globalThis.fetch = env.window.fetch;

  const uninstall = installNetworkHooks(matcher, (url, json) => seen.push({ url, json }));
  return { env, seen, original, uninstall };
}

/** Hooks live on `window`; run the call the way page code would. */
const flush = () => new Promise((r) => setTimeout(r, 10));

test("delivers a matching fetch response to the handler", async () => {
  const { env, seen, uninstall } = setup();

  await env.window.fetch("https://site/api/feed?page=1");
  await flush();

  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "https://site/api/feed?page=1");
  assert.deepEqual(seen[0].json, { hello: "world" });

  uninstall();
  env.teardown();
});

test("ignores requests that don't match", async () => {
  const { env, seen, uninstall } = setup();

  await env.window.fetch("https://site/api/notifications");
  await flush();

  assert.equal(seen.length, 0);
  uninstall();
  env.teardown();
});

test("the page still receives its own response body", async () => {
  const { env, uninstall } = setup();

  // Reading the response must not starve the caller — we clone, never consume.
  const response = await env.window.fetch("https://site/api/feed");
  const body = await response.json();

  assert.deepEqual(body, { hello: "world" });
  uninstall();
  env.teardown();
});

test("a non-JSON body is skipped without throwing", async () => {
  const env = makeProfileDom();
  const seen = [];
  env.window.fetch = async () => new Response("<!doctype html><html></html>");

  const uninstall = installNetworkHooks(() => true, (u, j) => seen.push(j));
  await env.window.fetch("https://site/api/feed");
  await flush();

  assert.equal(seen.length, 0);
  uninstall();
  env.teardown();
});

test("malformed JSON is skipped without throwing", async () => {
  const env = makeProfileDom();
  const seen = [];
  const errors = [];
  env.window.fetch = async () => new Response('{"truncated": ');

  const uninstall = installNetworkHooks(() => true, (u, j) => seen.push(j));
  await env.window.fetch("https://site/api/feed").catch((e) => errors.push(e));
  await flush();

  assert.equal(seen.length, 0);
  assert.equal(errors.length, 0, "a bad body must not surface as a page error");
  uninstall();
  env.teardown();
});

test("installing twice is a no-op, so responses are never parsed twice", async () => {
  const { env, seen, uninstall } = setup();
  const second = installNetworkHooks(() => true, () => seen.push("duplicate"));

  await env.window.fetch("https://site/api/feed");
  await flush();

  assert.equal(seen.length, 1);
  second();
  uninstall();
  env.teardown();
});

test("uninstall restores the original primitives", async () => {
  const env = makeProfileDom();
  const originalFetch = env.window.fetch;
  const originalOpen = env.window.XMLHttpRequest.prototype.open;

  const uninstall = installNetworkHooks(() => true, () => {});
  assert.notEqual(env.window.fetch, originalFetch);

  uninstall();
  assert.equal(env.window.fetch, originalFetch);
  assert.equal(env.window.XMLHttpRequest.prototype.open, originalOpen);
  env.teardown();
});
