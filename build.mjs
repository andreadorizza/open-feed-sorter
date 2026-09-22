/**
 * Build.
 *
 * Source is written as ES modules so the platform-agnostic core can be shared
 * between the two worlds and unit-tested in Node. Manifest-declared content
 * scripts are classic scripts, so each entry point is bundled into a
 * self-contained IIFE.
 */

import * as esbuild from "esbuild";
import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const out = resolve(root, "dist");
const watch = process.argv.includes("--watch");

const ENTRIES = {
  "content/instagram": "src/content/instagram.entry.js",
  "content/tiktok": "src/content/tiktok.entry.js",
  "page/instagram": "src/page/instagram.entry.js",
  "page/tiktok": "src/page/tiktok.entry.js",
  "popup/popup": "src/popup/popup.js",
  "background/service-worker": "src/background/service-worker.js",
};

const STATIC = [
  ["src/manifest.json", "manifest.json"],
  ["src/popup/popup.html", "popup/popup.html"],
  ["src/popup/popup.css", "popup/popup.css"],
  ["src/content/styles.css", "content/styles.css"],
  ["src/welcome.html", "welcome.html"],
  ["src/icons", "icons"],
  // The popup and welcome page link the font; the license travels with it.
  ["src/fonts", "fonts"],
];

async function copyStatic() {
  for (const [from, to] of STATIC) {
    await cp(resolve(root, from), resolve(out, to), { recursive: true });
  }
}

/**
 * The popup is the one entry loaded as `type="module"`; everything else is
 * injected as a classic script and must be an IIFE.
 */
function formatFor(name) {
  return name === "popup/popup" ? "esm" : "iife";
}

async function build() {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  const contexts = [];
  for (const [name, entry] of Object.entries(ENTRIES)) {
    const options = {
      entryPoints: [resolve(root, entry)],
      outfile: resolve(out, `${name}.js`),
      bundle: true,
      format: formatFor(name),
      target: "chrome111", // the floor for content_scripts `world: "MAIN"`
      legalComments: "none",
      // The content scripts carry the font as bytes — see content/runtime/font.js.
      loader: { ".woff2": "binary" },
      // Readable output is a feature for an extension people are asked to
      // review before installing an unpacked build.
      minify: false,
      sourcemap: watch ? "inline" : false,
    };

    if (watch) {
      const context = await esbuild.context(options);
      await context.watch();
      contexts.push(context);
    } else {
      await esbuild.build(options);
    }
  }

  await copyStatic();
  await syncVersion();

  if (watch) {
    console.log("watching src/ — reload the extension in chrome://extensions after each change");
  } else {
    console.log(`built → ${out}`);
  }
  return contexts;
}

/** Keep the manifest version in step with package.json, so there is one source. */
async function syncVersion() {
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const manifestPath = resolve(out, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.version = pkg.version;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
