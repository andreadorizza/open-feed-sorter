#!/usr/bin/env node
/**
 * Regenerate the Chrome Web Store screenshots and Product Hunt gallery images.
 *
 *   node store/tools/screenshots.mjs              # every shot, both sizes
 *   node store/tools/screenshots.mjs --only=popup # one shot, for iterating
 *                                                 # (ids: see SHOTS below)
 *   node store/tools/screenshots.mjs --keep-build # leave store/harness/build/
 *
 * What it does:
 *
 *   1. Bundles the extension's real content-script and page-world code (plus
 *      the fake profile site) with esbuild into store/harness/build/. The one
 *      substitution is src/adapters/index.js → store/harness/adapter.js; see
 *      that file for why.
 *   2. Serves the repository on 127.0.0.1, including a fake feed endpoint
 *      that answers with the fictional account in each platform's JSON shape.
 *   3. Drives headless Google Chrome over the DevTools protocol: one page per
 *      shot, rendered at a device scale factor of 1.25 so the UI is large
 *      enough to read when the store shrinks the image.
 *   4. Re-encodes each capture as 8-bit RGB PNG (no alpha channel, as the
 *      store asks) and checks every written file from its bytes.
 *
 * Nothing is downloaded and no network request leaves the machine. All data is
 * fictional — see store/harness/fixture.js.
 */

import * as esbuild from "esbuild";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import * as zlib from "node:zlib";

const ROOT = resolve(import.meta.dirname, "../..");
const HARNESS = join(ROOT, "store/harness");
const BUILD = join(HARNESS, "build");

const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * Device scale 1.25 turns a 1024×640 CSS layout into exactly 1280×800, and
 * 1016×608 into exactly 1270×760 — so both sets are rendered, not resized.
 */
const SCALE = 1.25;
const CWS = { width: 1280, height: 800 };
const PRODUCT_HUNT = { width: 1270, height: 760 };

/** The Chrome Web Store image in store/screenshots/, and the same shot for Product Hunt. */
function storeAndGallery(name) {
  return [
    { size: CWS, path: `store/screenshots/${name}.png` },
    { size: PRODUCT_HUNT, path: `store/product-hunt/gallery-${name}.png` },
  ];
}

/**
 * Every image this script writes. `id` is what --only= takes; `stage` is the
 * shot in store/harness/stage.js to set up (defaults to `id`).
 *
 * store/screenshots/ holds exactly the five images uploaded to the Chrome Web
 * Store, which takes at most five, in file-name order. site/index.html links
 * 01 and the landing-only dark copy of it by name.
 */
const SHOTS = [
  { id: "sorted-grid", outputs: storeAndGallery("01-sorted-grid") },
  { id: "popup", outputs: storeAndGallery("02-popup") },
  { id: "collecting", outputs: storeAndGallery("03-collecting") },
  { id: "export", outputs: storeAndGallery("04-export") },
  { id: "dark", theme: "dark", outputs: storeAndGallery("05-dark-mode") },
  // The hero again, same data, sort and caption, in the dark (backlit) theme:
  // the landing page's dark-mode hero. Not a store image.
  {
    id: "sorted-grid-dark",
    stage: "sorted-grid",
    theme: "dark",
    outputs: [{ size: CWS, path: "store/landing/01-sorted-grid-dark.png" }],
  },
];

const args = new Set(process.argv.slice(2));
const only = [...args].find((arg) => arg.startsWith("--only="))?.slice(7);

// ── 1. bundle ────────────────────────────────────────────────────────────

/** Point the content script's adapter lookup at the harness adapter. */
const harnessAdapterPlugin = {
  name: "harness-adapter",
  setup(build) {
    build.onResolve({ filter: /adapters\/index\.js$/ }, (args) => {
      const target = resolve(args.resolveDir, args.path);
      if (target === join(ROOT, "src/adapters/index.js")) return { path: join(HARNESS, "adapter.js") };
      return undefined;
    });
  },
};

async function bundle() {
  await rm(BUILD, { recursive: true, force: true });
  await mkdir(BUILD, { recursive: true });

  const entries = {
    "page-world": "page-world.entry.js",
    content: "content.entry.js",
    site: "site.js",
  };
  for (const [name, entry] of Object.entries(entries)) {
    await esbuild.build({
      entryPoints: [join(HARNESS, entry)],
      outfile: join(BUILD, `${name}.js`),
      bundle: true,
      format: "iife",
      target: "chrome111",
      loader: { ".woff2": "binary" },
      plugins: [harnessAdapterPlugin],
      legalComments: "none",
      logLevel: "warning",
    });
  }

  // The real popup.html, with its two relative links made absolute and the
  // chrome.* stand-in loaded ahead of popup.js.
  let html = await readFile(join(ROOT, "src/popup/popup.html"), "utf8");
  const before = html;
  html = html.replace(/href="popup\.css"/, 'href="/src/popup/popup.css"');
  html = html.replace(
    /<script\b[^>]*\bsrc="popup\.js"[^>]*><\/script>/,
    '<script type="module" src="/store/harness/popup-stub.js"></script>\n    <script type="module" src="/src/popup/popup.js"></script>',
  );
  if (!html.includes("/src/popup/popup.css") || !html.includes("/src/popup/popup.js") || html === before) {
    throw new Error("src/popup/popup.html changed shape; update the rewrite in screenshots.mjs");
  }
  await writeFile(join(BUILD, "popup.html"), html);
}

// ── 2. serve ─────────────────────────────────────────────────────────────

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/** Only the source tree and the harness are served. */
const SERVED = ["src/", "store/harness/"];

const PAGE_SIZE = 12;

async function feedPages() {
  const fixture = await import(join(HARNESS, "fixture.js"));
  // The same bakery on both platforms, with its own numbers on each.
  return {
    instagram: fixture.instagramReels(fixture.posts(100)),
    tiktok: fixture.tiktokVideos(
      fixture.posts(100, { seed: 11, typicalViews: 9800, outliers: fixture.TIKTOK_OUTLIERS }),
    ),
  };
}

async function serve() {
  const feeds = await feedPages();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      // The fake site's own feed requests, in each platform's shape.
      if (url.pathname === "/api/graphql") {
        const page = Number(url.searchParams.get("page")) || 0;
        const media = feeds.instagram.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        return json(res, {
          data: {
            xdt_api__v1__clips__user__connection_v2: {
              edges: media.map((m) => ({ node: { media: m } })),
              page_info: { has_next_page: (page + 1) * PAGE_SIZE < feeds.instagram.length },
            },
          },
        });
      }
      if (url.pathname === "/api/post/item_list/") {
        const cursor = Number(url.searchParams.get("cursor")) || 0;
        return json(res, {
          itemList: feeds.tiktok.slice(cursor * PAGE_SIZE, (cursor + 1) * PAGE_SIZE),
          hasMore: (cursor + 1) * PAGE_SIZE < feeds.tiktok.length,
          cursor: String(cursor + 1),
        });
      }

      const path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const file = resolve(ROOT, path);
      if (!file.startsWith(ROOT + sep) || !SERVED.some((prefix) => path.startsWith(prefix))) {
        res.writeHead(404).end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });

  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return server;
}

function json(res, value) {
  res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

// ── 3. drive Chrome ──────────────────────────────────────────────────────

async function launchChrome() {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}; set CHROME_PATH`);
  const profile = await mkdtemp(join(tmpdir(), "ofs-shots-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-sync",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--lang=en-US",
      "--window-size=1280,800",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let stderr = "";
  chrome.stderr.on("data", (chunk) => (stderr += chunk));

  const portFile = join(profile, "DevToolsActivePort");
  const deadline = Date.now() + 20_000;
  while (!existsSync(portFile) || !(await readFile(portFile, "utf8")).includes("\n")) {
    if (Date.now() > deadline || chrome.exitCode != null) {
      throw new Error(`Chrome did not start:\n${stderr.slice(-2000)}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const [port, path] = (await readFile(portFile, "utf8")).trim().split("\n");
  const cdp = await Cdp.connect(`ws://127.0.0.1:${port}${path}`);

  return {
    cdp,
    async close() {
      try {
        await cdp.send("Browser.close");
      } catch {
        chrome.kill();
      }
      await new Promise((r) => (chrome.exitCode != null ? r() : chrome.once("exit", r)));
      await rm(profile, { recursive: true, force: true });
    },
  };
}

/** The smallest DevTools-protocol client that does the job. */
class Cdp {
  static connect(url) {
    return new Promise((resolveConnect, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener("open", () => resolveConnect(new Cdp(socket)));
      socket.addEventListener("error", () => reject(new Error(`cannot connect to ${url}`)));
    });
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve: done, reject, method } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else done(message.result);
      } else if (message.method) {
        for (const listener of this.listeners) listener(message);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((done, reject) => this.pending.set(id, { resolve: done, reject, method }));
  }

  on(listener) {
    this.listeners.push(listener);
  }
}

async function openPage(cdp) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);

  cdp.on((message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      console.warn(`  page error: ${details.exception?.description || details.text}`);
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      console.warn(`  console.error: ${message.params.args.map((a) => a.value ?? a.description).join(" ")}`);
    }
  });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setTimezoneOverride", { timezoneId: "UTC" });
  await send("Emulation.setLocaleOverride", { locale: "en-US" });

  return {
    send,
    async evaluate(expression) {
      const { result, exceptionDetails } = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
      return result.value;
    },
    close: () => cdp.send("Target.closeTarget", { targetId }),
  };
}

async function setSize(page, size) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: Math.round(size.width / SCALE),
    height: Math.round(size.height / SCALE),
    deviceScaleFactor: SCALE,
    mobile: false,
  });
}

async function renderShot(cdp, baseUrl, shot) {
  const page = await openPage(cdp);
  try {
    await page.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: shot.theme || "light" }],
    });
    await setSize(page, shot.outputs[0].size);
    await page.send("Page.navigate", {
      url: `${baseUrl}/store/harness/stage.html?shot=${shot.stage || shot.id}`,
    });

    const deadline = Date.now() + 10_000;
    while (!(await page.evaluate("typeof window.stage === 'object'").catch(() => false))) {
      if (Date.now() > deadline) throw new Error("stage did not load");
      await new Promise((r) => setTimeout(r, 100));
    }
    const ready = await page.evaluate("window.stage.ready");
    if (!ready?.ok) throw new Error(`shot "${shot.id}" failed:\n${ready?.error}`);

    const written = [];
    for (const { size, path } of shot.outputs) {
      await setSize(page, size);

      // A run in progress can scroll the page between layout and capture;
      // when it has, lay out again and retake.
      let data;
      for (let attempt = 1; ; attempt++) {
        await page.evaluate("window.stage.layout()");
        await new Promise((r) => setTimeout(r, 400));
        ({ data } = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true }));
        if (await page.evaluate("window.stage.held()")) break;
        if (attempt === 5) throw new Error(`${shot.id}: the page kept scrolling during capture`);
      }
      const image = decodePng(Buffer.from(data, "base64"));
      if (image.width !== size.width || image.height !== size.height) {
        throw new Error(`${shot.id}: captured ${image.width}×${image.height}, wanted ${size.width}×${size.height}`);
      }
      const out = join(ROOT, path);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, encodePngRgb(image));
      written.push({ file: out, size });
    }
    return written;
  } finally {
    await page.close();
  }
}

// ── 4. PNG in, 24-bit RGB PNG out ────────────────────────────────────────

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crc32 =
  typeof zlib.crc32 === "function"
    ? (buf) => zlib.crc32(buf)
    : (() => {
        const table = Array.from({ length: 256 }, (_, n) => {
          let c = n;
          for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          return c >>> 0;
        });
        return (buf) => {
          let c = 0xffffffff;
          for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
          return (c ^ 0xffffffff) >>> 0;
        };
      })();

function chunks(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("not a PNG");
  const list = [];
  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("latin1", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    const crc = buf.readUInt32BE(offset + 8 + length);
    if (crc32(buf.subarray(offset + 4, offset + 8 + length)) !== crc) throw new Error(`bad CRC in ${type}`);
    list.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return list;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decode an 8-bit, non-interlaced RGB or RGBA PNG to RGB, flattening any alpha onto white. */
function decodePng(buf) {
  const list = chunks(buf);
  const ihdr = list.find((c) => c.type === "IHDR").data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const depth = ihdr[8];
  const colourType = ihdr[9];
  const interlace = ihdr[12];
  if (depth !== 8 || interlace !== 0 || (colourType !== 2 && colourType !== 6)) {
    throw new Error(`unsupported PNG: depth ${depth}, colour type ${colourType}, interlace ${interlace}`);
  }
  const channels = colourType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(list.filter((c) => c.type === "IDAT").map((c) => c.data)));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      const v = line[x];
      out[x] =
        filter === 0 ? v
        : filter === 1 ? v + a
        : filter === 2 ? v + b
        : filter === 3 ? v + ((a + b) >> 1)
        : v + paeth(a, b, c);
    }
  }

  const rgb = Buffer.alloc(width * height * 3);
  let translucent = 0;
  for (let i = 0, j = 0; i < pixels.length; i += channels, j += 3) {
    const alpha = channels === 4 ? pixels[i + 3] : 255;
    if (alpha !== 255) translucent++;
    for (let k = 0; k < 3; k++) rgb[j + k] = Math.round((pixels[i + k] * alpha + 255 * (255 - alpha)) / 255);
  }
  if (translucent) console.warn(`  note: ${translucent} translucent pixels flattened onto white`);
  return { width, height, rgb };
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Colour type 2, bit depth 8, with a per-row adaptive filter. */
function encodePngRgb({ width, height, rgb }) {
  const stride = width * 3;
  const filtered = Buffer.alloc((stride + 1) * height);
  const candidate = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const line = rgb.subarray(y * stride, (y + 1) * stride);
    const prev = y ? rgb.subarray((y - 1) * stride, y * stride) : null;
    let best = null;
    let bestScore = Infinity;
    for (let filter = 0; filter <= 4; filter++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= 3 ? line[x - 3] : 0;
        const b = prev ? prev[x] : 0;
        const c = prev && x >= 3 ? prev[x - 3] : 0;
        const predictor =
          filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c);
        const value = (line[x] - predictor) & 0xff;
        candidate[x] = value;
        score += value < 128 ? value : 256 - value;
      }
      if (score < bestScore) {
        bestScore = score;
        best = { filter, bytes: Buffer.from(candidate) };
      }
    }
    filtered[y * (stride + 1)] = best.filter;
    best.bytes.copy(filtered, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour, no alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(filtered, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Read a written file back and check what the stores check. */
async function verify(file, { width, height }) {
  const buf = await readFile(file);
  const list = chunks(buf); // signature and every CRC
  const ihdr = list[0];
  if (ihdr.type !== "IHDR") throw new Error(`${file}: first chunk is ${ihdr.type}`);
  const w = ihdr.data.readUInt32BE(0);
  const h = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8];
  const colourType = ihdr.data[9];
  const problems = [];
  if (w !== width || h !== height) problems.push(`${w}×${h}, expected ${width}×${height}`);
  if (depth !== 8) problems.push(`bit depth ${depth}`);
  if (colourType !== 2) problems.push(`colour type ${colourType}, expected 2 (RGB)`);
  if (list.some((c) => c.type === "tRNS")) problems.push("has a tRNS chunk");
  if (list.at(-1).type !== "IEND") problems.push("no IEND");
  if (problems.length) throw new Error(`${file}: ${problems.join("; ")}`);
  return { file, width: w, height: h, depth, colourType, bytes: (await stat(file)).size };
}

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  const shots = only ? SHOTS.filter((shot) => shot.id === only) : SHOTS;
  if (!shots.length) throw new Error(`no shot called "${only}"; have ${SHOTS.map((s) => s.id).join(", ")}`);

  await bundle();
  const server = await serve();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Look at a shot in an ordinary browser instead of capturing it.
  if (args.has("--serve")) {
    const stage = shots[0].stage || shots[0].id;
    console.log(`serving the harness; open ${baseUrl}/store/harness/stage.html?shot=${stage} (Ctrl-C to stop)`);
    return;
  }
  const browser = await launchChrome();

  const results = [];
  try {
    for (const shot of shots) {
      const started = Date.now();
      process.stdout.write(`${shot.id} … `);
      const files = await renderShot(browser.cdp, baseUrl, shot);
      console.log(`${((Date.now() - started) / 1000).toFixed(1)}s`);
      for (const { file, size } of files) results.push(await verify(file, size));
    }
  } finally {
    await browser.close();
    server.close();
    if (!args.has("--keep-build")) await rm(BUILD, { recursive: true, force: true });
  }

  console.log("\nverified from bytes (PNG signature, CRCs, IHDR):");
  for (const r of results) {
    console.log(
      `  ${r.file.slice(ROOT.length + 1).padEnd(54)} ${r.width}×${r.height}  depth ${r.depth}  colour type ${r.colourType} (RGB)  ${(r.bytes / 1024).toFixed(0)} KB`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
