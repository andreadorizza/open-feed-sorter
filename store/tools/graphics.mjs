/**
 * Store, social and launch graphics, regenerated from code.
 *
 *   node store/tools/graphics.mjs                 → render every graphic
 *   node store/tools/graphics.mjs og small        → only the named ones
 *   node store/tools/graphics.mjs --out=/tmp/x    → render somewhere else, to compare
 *   node store/tools/graphics.mjs --verify        → render nothing; check the files
 *
 * Names: small, marquee, og, github, store-icon, ph-thumbnail.
 * See store/graphics/README.md for what each one is for and where it goes.
 *
 * Text graphics are HTML pages rendered by headless Chrome, set in the
 * extension's own Matrix Sans Screen. The font is embedded as bytes, so there
 * is no file:// request to fail quietly into a fallback face; and in case it
 * fails anyway, each page paints itself red unless the face reports "loaded",
 * which fails the run.
 *
 * Chrome's PNG is re-encoded here as 8-bit RGB with no alpha channel — the
 * Chrome Web Store takes promo tiles as JPEG or 24-bit PNG without alpha —
 * and every file is then checked from its bytes: signature, IHDR size, bit
 * depth, colour type, and no tRNS chunk.
 *
 * The store icon and the Product Hunt thumbnail have no text. They are drawn
 * dot by dot with the drawing code, bitmap and palette of
 * scripts/make-icons.mjs, so every dot sits on whole pixels.
 *
 * Needs Google Chrome (CHROME_PATH to override); no npm dependencies.
 */

import { spawn } from "node:child_process";
import { deflateSync, inflateSync, crc32 } from "node:zlib";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// ── palette ─────────────────────────────────────────────────────────────

/**
 * The reflective-LCD tokens from src/popup/popup.css and src/content/styles.css:
 * dark segments on a green panel. The whole set uses this one look — it is
 * the icon's, and it stands out on the store's light grey.
 */
const THEME = { lcd: "#c7e3ab", ink: "#13200f", dim: "#4d6440" };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));
const rgb = (c) => `rgb(${c.join(",")})`;

const LCD = hex(THEME.lcd);
const INK = hex(THEME.ink);
/** An unlit LCD segment: ink at low strength over the panel, as in make-icons.mjs. */
const GHOST = mix(LCD, INK, 0.12);

/** The icon's bitmap, from scripts/make-icons.mjs: four bars, tallest first — a feed, sorted. */
const BARS = [
  "#......",
  "#......",
  "#.#....",
  "#.#....",
  "#.#.#..",
  "#.#.#.#",
  "#.#.#.#",
];

// ── page scaffold ───────────────────────────────────────────────────────

/**
 * The LCD's unlit-pixel texture. The extension draws it at a 3px pitch; here
 * it is 6px — the grid a 2x screen shows — as square dots on whole pixels.
 * A 3px pitch moirés as soon as an image is shown at half size; 6px halves
 * to a clean 3.
 */
function texture({ pitch = 6, dot = 2, alpha = 0.09 } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pitch}" height="${pitch}"><rect width="${dot}" height="${dot}" fill="rgba(${INK.join(",")},${alpha})" shape-rendering="crispEdges"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 0 0 / ${pitch}px ${pitch}px`;
}

let fontBase64;

/**
 * Type sizes are multiples of 10px throughout: Matrix Sans draws every glyph
 * on a 0.1em dot grid, so each dot then lands on a whole pixel.
 */
function page({ width, height, frame = 0, css = "", body }) {
  fontBase64 ??= readFileSync(join(ROOT, "src/fonts/MatrixSansScreen-Regular.woff2")).toString("base64");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<style>
@font-face { font-family: "SFF Matrix Sans Screen"; src: url(data:font/woff2;base64,${fontBase64}) format("woff2"); font-display: block; }
:root { --lcd: ${THEME.lcd}; --ink: ${THEME.ink}; --dim: ${THEME.dim}; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
body { position: relative; background: ${texture()}, var(--lcd);
       color: var(--ink); font: 400 20px/1 "SFF Matrix Sans Screen", monospace;
       -webkit-font-smoothing: antialiased; }
/* An ink frame, so a pale panel still has a hard edge on a pale page. */
body::before { content: ""; position: absolute; inset: 0; z-index: 50; pointer-events: none;
               box-shadow: inset 0 0 0 ${frame}px var(--ink); }
.abs { position: absolute; }
.dim { color: var(--dim); }
.col { position: absolute; display: flex; flex-direction: column; align-items: flex-start; }
.row { display: flex; gap: 12px; }
.name { white-space: pre; }
.badge { display: inline-block; padding: 5px 8px; font-size: 20px; line-height: 20px; white-space: pre;
         border: 2px solid var(--ink); background: var(--lcd); color: var(--ink); }
.badge.chip { padding: 8px 11px; font-size: 30px; line-height: 30px; border-width: 3px; }
/* Inverse video marks the thing that matters, as the extension's hot badge does. */
.badge.hot { background: var(--ink); color: var(--lcd); }
.dots { display: inline-block; width: .6em; height: .7em; vertical-align: baseline; overflow: visible; }
body.font-missing::after { content: ""; position: fixed; inset: 0; z-index: 99; background: #ff0000; }
${css}
</style></head>
<body>
${body}
<script>
// fonts.check() answers true for a face that failed to load, so ask the face.
document.fonts.ready.then(() => {
  const loaded = [...document.fonts].some((f) => f.family.includes("SFF Matrix Sans Screen") && f.status === "loaded");
  if (!loaded) document.body.classList.add("font-missing");
});
</script>
</body></html>`;
}

// ── components ──────────────────────────────────────────────────────────

/**
 * The toolbar icon as SVG: an ink-framed LCD panel with the bars lit on it.
 * Whole pixels throughout, so it is as crisp as the icon PNGs.
 */
function icon({ size, border, pitch, dot, x = 0, y = 0 }) {
  const span = (BARS.length - 1) * pitch + dot;
  const origin = Math.floor((size - span) / 2);
  let dots = "";
  BARS.forEach((row, r) =>
    [...row].forEach((cell, c) => {
      const fill = rgb(cell === "#" ? INK : GHOST);
      dots += `<rect x="${origin + c * pitch}" y="${origin + r * pitch}" width="${dot}" height="${dot}" fill="${fill}"/>`;
    }),
  );
  return `<svg class="abs" style="left:${x}px;top:${y}px" width="${size}" height="${size}" shape-rendering="crispEdges">
<rect width="${size}" height="${size}" fill="${rgb(INK)}"/>
<rect x="${border}" y="${border}" width="${size - 2 * border}" height="${size - 2 * border}" fill="${rgb(LCD)}"/>
${dots}</svg>`;
}

/** The 5×7 metric icons from src/content/runtime/dots.js. */
const METRIC_DOTS = {
  views: ["#....", "##...", "###..", "####.", "###..", "##...", "#...."],
  likes: [".....", "##.##", "#####", "#####", ".###.", "..#..", "....."],
};

/** A metric icon that sits in a line of text like one more glyph, as dotIcon() does. */
function metricIcon(name) {
  const DOT = 0.86;
  const inset = (1 - DOT) / 2;
  let d = "";
  METRIC_DOTS[name].forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell === "#") d += `M${x + inset} ${y + inset}h${DOT}v${DOT}h-${DOT}z`;
    }),
  );
  return `<svg class="dots" viewBox="-0.5 0 6 7"><path d="${d}" fill="currentColor"/></svg>`;
}

/**
 * Thumbnails as dot art — a video, a landscape, a portrait. Abstract on
 * purpose: no real posts, no platform imagery.
 */
const ART = {
  video: [
    ".....#.......",
    ".....###.....",
    ".....#####...",
    ".....###.....",
    ".....#.......",
  ],
  landscape: [
    "..........##.",
    "....#....####",
    "...###....##.",
    ".#######.....",
    "#############",
  ],
  portrait: [
    ".....###.....",
    "....#####....",
    ".....###.....",
    "...#######...",
    "..#########..",
  ],
};

/** A fictional profile, already sorted: every score and count is invented. */
const FEED = [
  { score: 4.2, views: "1.2M", likes: "96K", art: "video" },
  { score: 3.1, views: "880K", likes: "71K", art: "landscape" },
  { score: 2.4, views: "690K", likes: "40K", art: "portrait" },
  { score: 1.7, views: "480K", likes: "35K", art: "landscape" },
  { score: 1.2, views: "340K", likes: "22K", art: "portrait" },
  { score: 0.9, views: "250K", likes: "19K", art: "video" },
  { score: 0.8, views: "210K", likes: "12K", art: "portrait" },
  { score: 0.7, views: "180K", likes: "14K", art: "video" },
  { score: 0.6, views: "150K", likes: "9K", art: "landscape" },
];

/** The extension's badge rule (core/outlier.js BADGE_MIN): 2x and up is inverted. */
const HOT = 2;

/**
 * One tile, laid out like the extension's own: rank top left, outlier score
 * top right, counts along the bottom.
 */
function tile({ x, y, size, rank, score, views, likes, art }) {
  const inner = size - 6; // inside a 3px border
  const pitch = 10;
  const cells = Math.floor(inner / pitch);
  const off = Math.floor((inner - cells * pitch) / 2) + 1;
  const picture = ART[art];
  const left = Math.floor((cells - picture[0].length) / 2);
  // Centre the picture in the band between the badges (56px down) and the counts bar (35px tall).
  const band = (56 - 3 + inner - 35) / 2;
  const top = Math.round((band - off - (picture.length * pitch - 2) / 2) / pitch);
  const unlit = rgb(mix(LCD, INK, 0.07));
  const lit = rgb(mix(LCD, INK, 0.32));
  let dots = "";
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const on = picture[r - top]?.[c - left] === "#";
      dots += `<rect x="${off + c * pitch}" y="${off + r * pitch}" width="8" height="8" fill="${on ? lit : unlit}"/>`;
    }
  }
  return `<div class="abs tile" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px">
<svg class="abs" width="${inner}" height="${inner}" shape-rendering="crispEdges">${dots}</svg>
<span class="abs badge" style="left:8px;top:8px">#${rank}</span>
<span class="abs badge chip${score >= HOT ? " hot" : ""}" style="right:8px;top:8px">${score.toFixed(1)}x</span>
<div class="abs stats">${metricIcon("views")}${views}<i></i>${metricIcon("likes")}${likes}</div>
</div>`;
}

const TILE_CSS = `
.tile { border: 3px solid var(--ink); background: var(--lcd); overflow: hidden; }
.stats { left: 0; right: 0; bottom: 0; display: flex; align-items: baseline; gap: 6px;
         padding: 7px 9px 6px; border-top: 2px solid var(--ink); background: var(--lcd);
         font-size: 20px; line-height: 20px; white-space: pre; }
.stats i { width: 8px; }`;

/** The profile grid, three by three, best first. Returns HTML and its outer size. */
function sortedGrid({ x, y, size, gap }) {
  const tiles = FEED.map((post, i) =>
    tile({ x: (i % 3) * (size + gap), y: Math.floor(i / 3) * (size + gap), size, rank: i + 1, ...post }),
  );
  const span = 3 * size + 2 * gap;
  return `<div class="abs" style="left:${x}px;top:${y}px;width:${span}px;height:${span}px">${tiles.join("\n")}</div>`;
}

const gridSpan = (size, gap) => 3 * size + 2 * gap;

// ── graphics ────────────────────────────────────────────────────────────

/** The one line under the name. */
const TAGLINE = {
  /** Must read at 220×140: 30px type, so 20 characters fit the strip. */
  small: "Sort by views. Free.",
  marquee: "Best posts first. Free.",
  /** On the cards "free" has a chip of its own. */
  card: "Best posts first.",
};

/**
 * Where Matrix Sans puts its dots inside a line-height:1 box: the first dot
 * column 0.05em in from the left, the cap line 0.15em down. Caps are 0.7em.
 */
const BEARING = 0.05;
const CAP_TOP = 0.15;
const CAP = 0.7;

const GRAPHICS = {};

/** CWS small promo tile. Shown as small as 220×140, so: the icon, the name, one line. */
GRAPHICS.small = {
  out: "store/graphics/promo-small-440x280.png",
  width: 440,
  height: 280,
  html() {
    const W = 440, H = 280, frame = 6, strip = 50;
    const size = 60; // name, three lines 60px apart
    const ico = { size: 144, border: 5, pitch: 18, dot: 16 };
    const nameW = 6 * 0.6 * size - 2 * BEARING * size; // "SORTER"
    const nameH = 2 * size + CAP * size;
    const gap = 30;
    const x = Math.round((W - ico.size - gap - nameW) / 2);
    const mid = (frame + H - strip) / 2; // centre of the panel above the strip
    const nameTop = Math.round(mid - nameH / 2);
    return page({
      width: W, height: H, frame,
      css: `.strip { left: 0; right: 0; bottom: 0; height: ${strip}px; display: flex; align-items: center; justify-content: center;
                     background: var(--ink); color: var(--lcd); font-size: 30px; line-height: 30px; }`,
      body: `
${icon({ ...ico, x, y: Math.round(mid - ico.size / 2) })}
<div class="abs name" style="left:${x + ico.size + gap - BEARING * size}px;top:${nameTop - CAP_TOP * size}px;font-size:${size}px;line-height:${size}px">OPEN\nFEED\nSORTER</div>
<div class="abs strip">${TAGLINE.small}</div>`,
    });
  },
};

/** CWS marquee: the same lockup and line, with the sorted grid beside them. */
GRAPHICS.marquee = {
  out: "store/graphics/marquee-1400x560.png",
  width: 1400,
  height: 560,
  html() {
    const W = 1400, H = 560, frame = 10;
    const tileSize = 156, gap = 12;
    const span = gridSpan(tileSize, gap);
    const inset = Math.round((H - span) / 2); // the grid sits as far from the right edge as from the top
    const gx = W - inset - span;
    const size = 90; // name, two lines 100px apart
    const ico = { size: 162, border: 6, pitch: 20, dot: 18 }; // as tall as the name's caps
    const lockupW = ico.size + 40 + 5.3 * size; // "OPEN FEED" is 5.3em
    const left = Math.round((frame + gx - lockupW) / 2);
    return page({
      width: W, height: H, frame,
      css: TILE_CSS,
      body: `
${sortedGrid({ x: gx, y: inset, size: tileSize, gap })}
<div class="col" style="left:${left}px;top:0;bottom:0;justify-content:center">
  <div class="row" style="gap:40px">
    <div style="position:relative;margin-top:${Math.round(CAP_TOP * size)}px;width:${ico.size}px;height:${ico.size}px">${icon(ico)}</div>
    <div class="name" style="font-size:${size}px;line-height:100px">OPEN FEED\nSORTER</div>
  </div>
  <div style="margin-top:56px;font-size:50px;line-height:50px">${TAGLINE.marquee}</div>
</div>`,
    });
  },
};

/**
 * A link card: the name, one line, what it works on, three chips, and the
 * sorted grid. Shared by the Open Graph image and the GitHub social preview.
 * Naming the two sites in plain text is fine here; their logos and colours
 * are not used anywhere.
 */
function card({ width: W, height: H, margin, tileSize, chips }) {
  const frame = 10;
  const gap = 12;
  const span = gridSpan(tileSize, gap);
  const gx = W - frame - margin - span;
  const left = frame + margin;
  return page({
    width: W, height: H, frame,
    css: TILE_CSS,
    body: `
${sortedGrid({ x: gx, y: Math.round((H - span) / 2), size: tileSize, gap })}
<div class="col" style="left:${left}px;top:0;bottom:0;width:${gx - left - 40}px;justify-content:center">
  <div class="name" style="font-size:90px;line-height:100px">OPEN FEED\nSORTER</div>
  <div style="margin-top:36px;font-size:40px;line-height:40px">${TAGLINE.card}</div>
  <div class="dim" style="margin-top:22px;font-size:30px;line-height:40px;text-wrap:balance">Sort any Instagram or TikTok profile by views, likes or outlier score.</div>
  <div class="row" style="margin-top:34px">${chips.map((c, i) => `<span class="badge chip${i === 0 ? " hot" : ""}">${c}</span>`).join("")}</div>
</div>`,
  });
}

/** Open Graph card for the landing page, which links this exact filename. */
GRAPHICS.og = {
  out: "store/graphics/og-1200x630.png",
  width: 1200,
  height: 630,
  html: () => card({ width: 1200, height: 630, margin: 56, tileSize: 156, chips: ["FREE", "OPEN SOURCE", "NO ACCOUNT"] }),
};

/**
 * GitHub social preview. Sites that re-crop it to 1.91:1 trim about 30px a
 * side, so everything sits at least 90px in from the left and right edges.
 */
GRAPHICS.github = {
  out: "store/graphics/github-social-1280x640.png",
  width: 1280,
  height: 640,
  html: () => card({ width: 1280, height: 640, margin: 80, tileSize: 170, chips: ["FREE", "MIT", "NO ACCOUNT"] }),
};

// ── pixel graphics ──────────────────────────────────────────────────────

/**
 * draw() from scripts/make-icons.mjs, unchanged but for returning pixels
 * instead of a PNG: an ink frame, an LCD panel inset by `pad` of transparency,
 * and the bars as lit dots over unlit ones. RGBA.
 */
function drawIcon(size, { pad = 0, border = 0, pitch, dot }) {
  const px = Buffer.alloc(size * size * 4); // transparent
  const fill = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) px.set([...c, 255], (y * size + x) * 4);
    }
  };
  const panel = size - pad * 2;
  fill(pad, pad, panel, panel, INK);
  fill(pad + border, pad + border, panel - border * 2, panel - border * 2, LCD);
  const span = (BARS.length - 1) * pitch + dot;
  const origin = pad + Math.floor((panel - span) / 2);
  BARS.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      fill(origin + x * pitch, origin + y * pitch, dot, dot, cell === "#" ? INK : GHOST);
    }),
  );
  return px;
}

/**
 * CWS store icon: 96×96 artwork inside 16px of transparent padding, which is
 * what the store asks for. src/icons/icon-128.png is 112×112 inside 8px.
 * Same frame and dot gap as the 128 icon; the dots step down from 12px to 10.
 */
GRAPHICS["store-icon"] = {
  out: "store/graphics/store-icon-128.png",
  width: 128,
  height: 128,
  alpha: true,
  draw: () => encodePNG(128, 128, 4, drawIcon(128, { pad: 16, border: 4, pitch: 12, dot: 10 })),
};

/** Product Hunt thumbnail: the icon edge to edge, opaque. */
GRAPHICS["ph-thumbnail"] = {
  out: "store/product-hunt/thumbnail-240.png",
  width: 240,
  height: 240,
  draw: () => {
    const rgba = { width: 240, height: 240, channels: 4, data: drawIcon(240, { border: 8, pitch: 28, dot: 24 }) };
    return encodePNG(240, 240, 3, toRGB(rgba, LCD).data);
  },
};

// ── PNG ─────────────────────────────────────────────────────────────────

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

/** Chunk types and IHDR fields, read straight from the file. */
function inspectPNG(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");
  const chunks = [];
  for (let at = 8; at < buf.length; ) {
    const length = buf.readUInt32BE(at);
    chunks.push({ type: buf.toString("ascii", at + 4, at + 8), data: buf.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  const ihdr = chunks[0]?.type === "IHDR" ? chunks[0].data : null;
  if (!ihdr) throw new Error("PNG without a leading IHDR");
  return {
    width: ihdr.readUInt32BE(0),
    height: ihdr.readUInt32BE(4),
    bitDepth: ihdr[8],
    colorType: ihdr[9],
    interlace: ihdr[12],
    chunks,
  };
}

/** Decode an 8-bit, non-interlaced PNG to raw samples. */
function decodePNG(buf) {
  const png = inspectPNG(buf);
  const channels = CHANNELS[png.colorType];
  if (png.bitDepth !== 8 || !channels || png.interlace) {
    throw new Error(`unsupported PNG: depth ${png.bitDepth}, colour type ${png.colorType}, interlace ${png.interlace}`);
  }
  const raw = inflateSync(Buffer.concat(png.chunks.filter((c) => c.type === "IDAT").map((c) => c.data)));
  const stride = png.width * channels;
  const out = Buffer.alloc(stride * png.height);
  for (let y = 0; y < png.height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { width: png.width, height: png.height, channels, data: out };
}

/** Encode raw samples: 3 channels → colour type 2 (RGB), 4 → 6 (RGBA). */
function encodePNG(width, height, channels, data) {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, body) => {
    const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const out = Buffer.alloc(body.length + 12);
    out.writeUInt32BE(body.length, 0);
    typed.copy(out, 4);
    out.writeUInt32BE(crc32(typed), body.length + 8);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = { 3: 2, 4: 6 }[channels];
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Drop alpha by compositing over `bg`. Greyscale is widened to RGB. */
function toRGB(img, bg) {
  if (img.channels === 3) return img;
  const out = Buffer.alloc(img.width * img.height * 3);
  const hasAlpha = img.channels === 2 || img.channels === 4;
  const colour = img.channels >= 3;
  for (let i = 0, j = 0; i < img.data.length; i += img.channels, j += 3) {
    const a = hasAlpha ? img.data[i + img.channels - 1] / 255 : 1;
    for (let k = 0; k < 3; k++) {
      const v = img.data[i + (colour ? k : 0)];
      out[j + k] = Math.round(v * a + bg[k] * (1 - a));
    }
  }
  return { width: img.width, height: img.height, channels: 3, data: out };
}

// ── Chrome ──────────────────────────────────────────────────────────────

/**
 * Screenshot a page. Headless Chrome on macOS can write the file and then
 * never exit, so this waits for the file rather than the process, then kills
 * the whole process group.
 */
function screenshot(htmlPath, width, height, out, profile) {
  rmSync(out, { force: true });
  return new Promise((done, fail) => {
    const child = spawn(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--force-device-scale-factor=1",
        // let the font decode and the load check run before the capture
        "--virtual-time-budget=4000",
        `--user-data-dir=${profile}`,
        `--window-size=${width},${height}`,
        `--screenshot=${out}`,
        `file://${htmlPath}`,
      ],
      { detached: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    const written = () => existsSync(out) && statSync(out).size > 0;

    let settled = false;
    let lastSize = -1;
    const started = Date.now();
    const poll = setInterval(() => {
      if (written()) {
        const size = statSync(out).size;
        if (/written to file/i.test(log) && size === lastSize) return finish();
        lastSize = size;
      }
      if (Date.now() - started > 60_000) finish(new Error(`Chrome timed out on ${htmlPath}\n${log}`));
    }, 250);
    child.on("error", (err) => finish(err));
    child.on("exit", () => finish(written() ? null : new Error(`Chrome exited without a screenshot\n${log}`)));

    function finish(err) {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // already gone
      }
      err ? fail(err) : done(out);
    }
  });
}

async function renderHTML(name, spec, work) {
  const htmlPath = join(work, `${name}.html`);
  const shot = join(work, `${name}.png`);
  writeFileSync(htmlPath, spec.html());
  await screenshot(htmlPath, spec.width, spec.height, shot, join(work, "profile"));
  const img = toRGB(decodePNG(readFileSync(shot)), LCD);
  if (img.width !== spec.width || img.height !== spec.height) {
    throw new Error(`${name}: Chrome rendered ${img.width}x${img.height}, not ${spec.width}x${spec.height}`);
  }
  const centre = ((spec.height >> 1) * spec.width + (spec.width >> 1)) * 3;
  if (img.data[centre] === 255 && img.data[centre + 1] === 0 && img.data[centre + 2] === 0) {
    throw new Error(`${name}: Matrix Sans Screen did not load`);
  }
  return encodePNG(img.width, img.height, 3, img.data);
}

// ── main ────────────────────────────────────────────────────────────────

/** Check a written file from its bytes. Promo images: 8-bit RGB, no alpha, no tRNS. */
function verify(file, spec) {
  const png = inspectPNG(readFileSync(file));
  const colorType = spec.alpha ? 6 : 2;
  const problems = [];
  if (png.width !== spec.width || png.height !== spec.height) problems.push(`is ${png.width}x${png.height}`);
  if (png.bitDepth !== 8) problems.push(`bit depth ${png.bitDepth}`);
  if (png.colorType !== colorType) problems.push(`colour type ${png.colorType}, want ${colorType}`);
  if (!spec.alpha && png.chunks.some((c) => c.type === "tRNS")) problems.push("has a tRNS chunk");
  const kind = { 2: "8-bit RGB, no alpha (colour type 2)", 6: "8-bit RGBA (colour type 6)" }[png.colorType] ?? `colour type ${png.colorType}`;
  const kb = (statSync(file).size / 1024).toFixed(1);
  console.log(`${problems.length ? "FAIL" : "ok  "}  ${relative(ROOT, file).padEnd(44)} ${`${png.width}x${png.height}`.padEnd(10)} ${kind}, ${kb} KB${problems.length ? ` — ${problems.join("; ")}` : ""}`);
  if (problems.length) process.exitCode = 1;
}

const args = process.argv.slice(2);
const wanted = args.filter((a) => !a.startsWith("--"));
const outDir = args.find((a) => a.startsWith("--out="))?.slice("--out=".length);
const verifyOnly = args.includes("--verify");

const unknown = wanted.filter((name) => !(name in GRAPHICS));
if (unknown.length) {
  console.error(`unknown graphic: ${unknown.join(", ")} (have: ${Object.keys(GRAPHICS).join(", ")})`);
  process.exit(2);
}

const work = verifyOnly ? null : mkdtempSync(join(tmpdir(), "ofs-graphics-"));
try {
  for (const [name, spec] of Object.entries(GRAPHICS)) {
    if (wanted.length && !wanted.includes(name)) continue;
    const file = outDir ? resolve(outDir, `${name}.png`) : join(ROOT, spec.out);
    if (!verifyOnly) writeFileSync(file, spec.draw ? spec.draw() : await renderHTML(name, spec, work));
    verify(file, spec);
  }
} finally {
  if (work) rmSync(work, { recursive: true, force: true });
}
