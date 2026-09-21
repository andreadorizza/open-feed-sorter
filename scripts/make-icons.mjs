/**
 * Draw the extension icons: four descending bars — a feed, sorted — as lit
 * dots on an LCD panel, matching the Matrix Sans Screen theme.
 *
 * Drawn pixel by pixel rather than scaled from one master, so every size has
 * whole-pixel dots and stays crisp in the toolbar. No dependencies: node:zlib
 * does the PNG compression and checksum.
 *
 *   node scripts/make-icons.mjs   → src/icons/icon-{16,32,48,128}.png
 */

import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LCD = [0xc7, 0xe3, 0xab];
const INK = [0x13, 0x20, 0x0f];
/** An unlit LCD segment: ink at low strength over the panel. */
const GHOST = LCD.map((c, i) => Math.round(c + (INK[i] - c) * 0.12));

/** Four bars, tallest first. Top row first; `#` is a lit dot. */
const BARS = [
  "#......",
  "#......",
  "#.#....",
  "#.#....",
  "#.#.#..",
  "#.#.#.#",
  "#.#.#.#",
];

/**
 * @param {number} size   canvas, px
 * @param {object} spec
 *   pad     transparent margin around the panel
 *   border  ink frame width
 *   bitmap  dot rows
 *   pitch   dot spacing
 *   dot     dot size
 *   ghost   draw unlit dots too
 */
function draw(size, { pad = 0, border = 0, bitmap, pitch, dot, ghost = true }) {
  const px = new Uint8Array(size * size * 4); // transparent
  const fill = (x0, y0, w, h, rgb) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * size + x) * 4;
        px.set([...rgb, 255], i);
      }
    }
  };

  const panel = size - pad * 2;
  fill(pad, pad, panel, panel, INK);
  fill(pad + border, pad + border, panel - border * 2, panel - border * 2, LCD);

  const span = (bitmap.length - 1) * pitch + dot;
  const origin = pad + Math.floor((panel - span) / 2);
  bitmap.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "#") fill(origin + x * pitch, origin + y * pitch, dot, dot, INK);
      else if (ghost) fill(origin + x * pitch, origin + y * pitch, dot, dot, GHOST);
    });
  });

  return png(size, px);
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }

  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const SIZES = {
  // Too small for gaps to read: solid bars on the panel, no frame.
  16: { bitmap: BARS, pitch: 2, dot: 2, ghost: false },
  32: { border: 1, bitmap: BARS, pitch: 4, dot: 3 },
  48: { border: 2, bitmap: BARS, pitch: 6, dot: 5 },
  // The store and install dialog expect artwork inset in a 128 canvas.
  128: { pad: 8, border: 4, bitmap: BARS, pitch: 14, dot: 12 },
};

const dir = resolve(import.meta.dirname, "..", "src", "icons");
for (const [size, spec] of Object.entries(SIZES)) {
  writeFileSync(resolve(dir, `icon-${size}.png`), draw(Number(size), spec));
}
console.log(`icons → ${dir}`);
