/**
 * Post-build check on dist/.
 *
 * A build that emits files is not the same as a build Chrome will load. This
 * catches the failures that otherwise only show up as a red error in
 * chrome://extensions after a manual install: a manifest pointing at a file
 * the build no longer produces, a bundle that isn't valid JavaScript, or a
 * network call sneaking into an extension that promises it makes none.
 */

import { readFile, stat } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, relative } from "node:path";

const dist = resolve(import.meta.dirname, "..", "dist");
const problems = [];

function fail(message) {
  problems.push(message);
}

async function exists(path) {
  try {
    await stat(join(dist, path));
    return true;
  } catch {
    return false;
  }
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const manifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8"));

// 1. Every path the manifest names must be present.
const referenced = [
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
  manifest.action?.default_popup,
  manifest.background?.service_worker,
  ...(manifest.content_scripts ?? []).flatMap((cs) => [...(cs.js ?? []), ...(cs.css ?? [])]),
].filter(Boolean);

for (const path of referenced) {
  if (!(await exists(path))) fail(`manifest references a missing file: ${path}`);
}

// 2. Anything opened by chrome.runtime.getURL has to be packaged too — these
//    are invisible to the manifest and fail only at runtime.
const bundles = walk(dist).filter((f) => f.endsWith(".js"));
for (const file of bundles) {
  const source = await readFile(file, "utf8");
  for (const [, asset] of source.matchAll(/getURL\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    if (!(await exists(asset))) {
      fail(`${relative(dist, file)} opens a missing asset: ${asset}`);
    }
  }
}

// 3. Every bundle must parse. esbuild would normally catch this, but a broken
//    output is cheap to rule out and expensive to debug by hand.
for (const file of bundles) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    fail(`${relative(dist, file)} is not valid JavaScript: ${error.message.split("\n")[0]}`);
  }
}

// 4. The extension claims it makes no requests of its own. Hold it to that:
//    no bundle should reach a host outside the two platforms it runs on.
const ALLOWED_HOSTS = ["www.instagram.com", "www.tiktok.com"];
for (const file of bundles) {
  const source = await readFile(file, "utf8");
  for (const [url] of source.matchAll(/https?:\/\/[a-zA-Z0-9._-]+/g)) {
    const host = url.replace(/^https?:\/\//, "");
    // XML namespace URLs appear in the xlsx writer; they are identifiers in
    // the file format, never fetched.
    if (host === "schemas.openxmlformats.org") continue;
    if (!ALLOWED_HOSTS.includes(host)) {
      fail(`${relative(dist, file)} references an unexpected host: ${host}`);
    }
  }
}

// 5. Permissions should stay minimal; a new one is a deliberate decision, not
//    something that should slip in unnoticed.
const EXPECTED_PERMISSIONS = ["tabs"];
const extra = (manifest.permissions ?? []).filter((p) => !EXPECTED_PERMISSIONS.includes(p));
if (extra.length) {
  fail(`unexpected permissions: ${extra.join(", ")} — update EXPECTED_PERMISSIONS if intended`);
}

if (problems.length) {
  console.error("dist verification failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}

console.log(`dist verified: ${referenced.length} manifest paths, ${bundles.length} bundles, no unexpected hosts`);
