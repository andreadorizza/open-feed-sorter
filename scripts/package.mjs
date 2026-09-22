/**
 * Package dist/ as the zip the Chrome Web Store takes.
 *
 * The store wants manifest.json at the root of the archive. Zipping the folder
 * by hand gets that wrong in quiet ways: the entries end up under `dist/`, and
 * macOS adds `.DS_Store` and `__MACOSX/` along the way. This writes the archive
 * with the same store-method writer the xlsx export uses, so there is no zip
 * dependency and no reliance on whichever `zip` the machine has.
 *
 * Run it through `npm run package`, which builds and verifies first.
 */

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { makeZip } from "../src/core/zip.js";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const release = join(root, "release");

/**
 * Every file under `dir`, as a sorted list of paths relative to it with `/`
 * separators. Anything whose name, or whose folder's name, starts with a dot
 * is left out: none of it belongs in a store upload.
 */
export async function listFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .filter((path) => !path.split("/").some((part) => part.startsWith(".")))
    .sort();
}

/** Zip the contents of `dir` — not the folder itself — so its files sit at the root. */
export async function zipDirectory(dir, options) {
  const names = await listFiles(dir);
  const entries = await Promise.all(
    names.map(async (name) => ({ name, data: await readFile(join(dir, name)) })),
  );
  return { zip: makeZip(entries, options), names };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  // build.mjs copies package.json's version into the built manifest, so the
  // two can only disagree through src/manifest.json. That still matters: the
  // release workflow checks the tag against it.
  const pkg = await readJson(join(root, "package.json"));
  const versions = {
    "src/manifest.json": (await readJson(join(root, "src", "manifest.json"))).version,
    "dist/manifest.json": (await readJson(join(dist, "manifest.json"))).version,
  };
  const mismatched = Object.entries(versions).filter(([, version]) => version !== pkg.version);
  if (mismatched.length) {
    console.error(
      `version mismatch — package.json says ${pkg.version}:\n` +
        mismatched.map(([file, version]) => `  - ${file} says ${version}`).join("\n"),
    );
    process.exit(1);
  }

  const { zip, names } = await zipDirectory(dist);
  const bytes = Buffer.from(await zip.arrayBuffer());

  await mkdir(release, { recursive: true });
  const out = join(release, `${pkg.name}-${pkg.version}.zip`);
  await writeFile(out, bytes);

  console.log(`packaged → ${relative(root, out)} (${names.length} files, ${(bytes.length / 1024).toFixed(1)} KB)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
