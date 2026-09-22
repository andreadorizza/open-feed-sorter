/**
 * Assemble the landing page into a directory GitHub Pages can serve.
 *
 *   node site/build.mjs            → _site/
 *   node site/build.mjs <outDir>   → anywhere else, e.g. a scratch folder
 *
 * The Pages workflow runs exactly this, so a local build is what deploys.
 * Preview it with `python3 -m http.server -d _site 8000`.
 *
 * It copies site/ (minus this script) and the few repo files the page shows —
 * screenshots, the social card, icons, the font and its licence — fills in
 * the {{PLACEHOLDERS}}, then refuses to finish if the result would be broken:
 *
 *   - a {{placeholder}} left unfilled;
 *   - a reference to a local file that isn't in the output, including the
 *     absolute URLs in the social tags that point back at this site;
 *   - an in-page #anchor with no matching id;
 *   - anything that would make the page load a resource from another host.
 *     The extension promises no third-party requests; so does its page.
 *
 * No dependencies: node: built-ins only.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const SITE = import.meta.dirname;
const ROOT = resolve(SITE, "..");
const OUT = resolve(ROOT, process.argv[2] ?? "_site");

const SITE_URL = "https://andreadorizza.github.io/open-feed-sorter/";
const REPO_URL = "https://github.com/andreadorizza/open-feed-sorter";

// ─────────────────────────────────────────────────────────────────────────────
// THE STORE SWITCH. Paste the Chrome Web Store listing URL here once it exists,
// e.g. "https://chromewebstore.google.com/detail/open-feed-sorter/<id>".
// Every install button, the note under it and the structured data follow.
const CHROME_WEB_STORE_URL = "";
// ─────────────────────────────────────────────────────────────────────────────

const install = CHROME_WEB_STORE_URL
  ? {
      INSTALL_URL: CHROME_WEB_STORE_URL,
      INSTALL_LABEL: "Add to Chrome",
      INSTALL_NOTE: "Free on the Chrome Web Store, for Chrome on desktop.",
    }
  : {
      INSTALL_URL: `${REPO_URL}#install`,
      INSTALL_LABEL: "Install from GitHub",
      INSTALL_NOTE:
        "Not on the Chrome Web Store yet. Until it is, you build it from source and load it " +
        "unpacked: four commands, then three clicks in chrome://extensions.",
    };

const manifest = JSON.parse(readFileSync(join(ROOT, "src", "manifest.json"), "utf8"));

const VALUES = {
  SITE_URL,
  VERSION: manifest.version,
  ...install,
};

/** Repo files the page shows, and where they land in the output. */
const COPIES = [
  // The hero, light and dark. The other store screenshots are not on the page.
  { from: "store/screenshots/01-sorted-grid.png", to: "screenshots/01-sorted-grid.png" },
  { from: "store/landing/01-sorted-grid-dark.png", to: "screenshots/01-sorted-grid-dark.png" },
  { from: "store/graphics/og-1200x630.png", to: "graphics/og-1200x630.png" },
  { from: "src/icons", to: "icons", filter: (name) => name.endsWith(".png") },
  { from: "src/fonts/MatrixSansScreen-Regular.woff2", to: "fonts/MatrixSansScreen-Regular.woff2" },
  { from: "src/fonts/OFL.txt", to: "fonts/OFL.txt" },
];

/** Files whose text gets placeholders filled and references checked. */
const TEXT = new Set([".html", ".css", ".xml", ".txt", ".json", ".webmanifest"]);

const problems = [];
const fail = (message) => problems.push(message);

// ── 1. Assemble ──────────────────────────────────────────────────────────────

// The output directory is wiped first, so only ever wipe one this script made.
const MARKER = ".site-build"; // a dotfile: upload-pages-artifact leaves it out
if (OUT === SITE || OUT.startsWith(SITE + sep) || SITE.startsWith(OUT + sep)) {
  console.error(`refusing to build into ${OUT}: it overlaps site/ or the repo itself`);
  process.exit(1);
}
if (existsSync(OUT) && readdirSync(OUT).length && !existsSync(join(OUT, MARKER))) {
  console.error(`refusing to overwrite ${OUT}: it isn't empty and wasn't made by this script`);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, MARKER), "Built by site/build.mjs. Safe to delete.\n");

cpSync(SITE, OUT, {
  recursive: true,
  filter: (path) => resolve(path) !== resolve(SITE, "build.mjs"),
});

for (const { from, to, filter } of COPIES) {
  const src = join(ROOT, from);
  // A missing source is not fatal here: if the page needs it, step 3 reports
  // the broken reference, which says what is missing and where it is used.
  if (!existsSync(src)) continue;
  if (statSync(src).isDirectory()) {
    for (const name of readdirSync(src).filter(filter ?? (() => true))) {
      cpSync(join(src, name), join(OUT, to, name));
    }
  } else {
    mkdirSync(dirname(join(OUT, to)), { recursive: true });
    cpSync(src, join(OUT, to));
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(OUT).filter((file) => !file.endsWith(sep + MARKER));
const textFiles = files.filter((file) => TEXT.has(extname(file)));

// ── 2. Fill placeholders ─────────────────────────────────────────────────────

for (const file of textFiles) {
  const source = readFileSync(file, "utf8");
  const filled = source.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (!(key in VALUES)) return match; // left in place, reported below
    // Everything substituted lands in HTML or XML text or attributes.
    return String(VALUES[key]).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  });
  if (filled !== source) writeFileSync(file, filled);

  filled.split("\n").forEach((line, i) => {
    if (line.includes("{{")) fail(`${rel(file)}:${i + 1} still has a placeholder: ${line.trim()}`);
  });
}

// ── 3. Check references ──────────────────────────────────────────────────────

const outFiles = new Set(files.map((file) => resolve(file)));

/** An absolute URL on this site, or a relative one, → the output file it names. */
function localTarget(ref, fromFile) {
  const path = ref.split(/[?#]/)[0];
  const base = ref.startsWith(SITE_URL) ? OUT : dirname(fromFile);
  const target = resolve(base, ref.startsWith(SITE_URL) ? path.slice(SITE_URL.length) : path);
  return path === "" || path.endsWith("/") || target === OUT ? join(target, "index.html") : target;
}

const isExternal = (ref) => /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//");
const isOwnSite = (ref) => ref.startsWith(SITE_URL);

let checked = 0;

function checkLocal(ref, file, where) {
  checked++;
  const target = localTarget(ref, file);
  if (!outFiles.has(target)) {
    fail(`${rel(file)}: ${where} "${ref}" → missing ${relative(OUT, target) || "index.html"}`);
  }
}

for (const file of textFiles.filter((f) => extname(f) === ".html")) {
  const html = readFileSync(file, "utf8");
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

  for (const [, tag, attrs] of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const attr = (name) => attrs.match(new RegExp(`\\s${name}="([^"]*)"`, "i"))?.[1];
    const rel_ = (attr("rel") ?? "").toLowerCase().split(/\s+/);

    // Things the browser fetches on its own. None may leave this site.
    const fetched = [attr("src"), attr("poster"), ...(attr("srcset") ?? "").split(",").map((s) => s.trim().split(/\s+/)[0])];
    if (tag.toLowerCase() === "link" && !rel_.includes("canonical")) fetched.push(attr("href"));

    for (const ref of fetched.filter(Boolean)) {
      if (isExternal(ref) && !isOwnSite(ref)) fail(`${rel(file)}: <${tag}> loads a third-party resource: ${ref}`);
      else checkLocal(ref, file, `<${tag}>`);
    }

    // Links: in-page anchors must exist; relative and own-site links must resolve.
    const href = attr("href");
    if (href && tag.toLowerCase() !== "link") {
      if (href.startsWith("#")) {
        checked++;
        if (href.length > 1 && !ids.has(href.slice(1))) fail(`${rel(file)}: link to missing anchor ${href}`);
      } else if (!isExternal(href) || isOwnSite(href)) {
        checkLocal(href, file, `<${tag} href>`);
      }
    }

    // Social cards and the canonical URL point back here by absolute URL.
    const content = attr("content");
    if (content && isOwnSite(content)) checkLocal(content, file, "meta content");
    if (tag.toLowerCase() === "link" && rel_.includes("canonical") && href) checkLocal(href, file, "canonical");
  }

  // SVG paint servers: fill="url(#id)".
  for (const [, id] of html.matchAll(/url\(#([^)]+)\)/g)) {
    checked++;
    if (!ids.has(id)) fail(`${rel(file)}: url(#${id}) names no element`);
  }

  if (/<script\b(?![^>]*type="application\/ld\+json")/i.test(html)) {
    fail(`${rel(file)}: has a <script> — the page is meant to run without JavaScript`);
  }
}

for (const file of textFiles.filter((f) => extname(f) === ".css")) {
  const css = readFileSync(file, "utf8");
  for (const match of css.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)|@import\s+(["'])([^"']+)\3/g)) {
    const ref = match[2] ?? match[4];
    if (!ref || ref.startsWith("#") || ref.startsWith("data:")) continue;
    if (isExternal(ref) && !isOwnSite(ref)) fail(`${rel(file)}: loads a third-party resource: ${ref}`);
    else checkLocal(ref, file, "url()");
  }
}

// robots.txt and sitemap.xml name this site's URLs in plain text.
for (const file of textFiles.filter((f) => /\.(txt|xml)$/.test(f))) {
  for (const [ref] of readFileSync(file, "utf8").matchAll(/https:\/\/[^\s<"]+/g)) {
    if (isOwnSite(ref)) checkLocal(ref, file, "URL");
  }
}

function rel(file) {
  return relative(OUT, file).split(sep).join("/");
}

if (problems.length) {
  console.error(`site build failed (${OUT}):\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}

const store = CHROME_WEB_STORE_URL ? "Chrome Web Store" : "GitHub (no store URL set)";
const where = OUT.startsWith(ROOT + sep) ? relative(ROOT, OUT) : OUT;
console.log(`site built: ${where}/ — ${files.length} files, ${checked} references checked, install → ${store}`);
