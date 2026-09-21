/**
 * Dot-matrix icons.
 *
 * Matrix Sans Screen draws every glyph on a 5×7 grid of square dots, 100 units
 * apart in a 1000-unit em. These icons use the same grid and the same dot, so
 * at any font size they line up with the text beside them like one more glyph.
 * The font has no play, heart or arrow characters, and a fallback font's
 * outline glyph next to dot-matrix text would break the effect.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Five columns by seven rows, top row first. `#` is a lit dot. */
const BITMAPS = {
  views: ["#....", "##...", "###..", "####.", "###..", "##...", "#...."],
  likes: [".....", "##.##", "#####", "#####", ".###.", "..#..", "....."],
  comments: [".....", "#####", "#...#", "#...#", "#####", "##...", "#...."],
  shares: [".....", "..###", "...##", "..#.#", ".#...", "#....", "....."],
  saves: ["#####", "#...#", "#...#", "#...#", "#.#.#", "##.##", "#...#"],
  caret: [".....", ".....", "#####", ".###.", "..#..", ".....", "....."],
  bolt: ["...#.", "..#..", ".#...", "#####", "...#.", "..#..", ".#..."],
};

/** Dot size as a share of the pitch — the font's 86-unit dot on a 100-unit grid. */
const DOT = 0.86;
const INSET = (1 - DOT) / 2;

export function hasDotIcon(name) {
  return Object.hasOwn(BITMAPS, name);
}

/**
 * An inline SVG that sits on the text baseline and advances like one glyph
 * (0.6em wide, 0.7em tall — the font's advance and cap height).
 */
export function dotIcon(name, doc = document) {
  const rows = BITMAPS[name];
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", `sfb-dots sfb-dots--${name}`);
  svg.setAttribute("viewBox", "-0.5 0 6 7");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const path = doc.createElementNS(SVG_NS, "path");
  let d = "";
  rows?.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "#") d += `M${x + INSET} ${y + INSET}h${DOT}v${DOT}h-${DOT}z`;
    });
  });
  path.setAttribute("d", d);
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);
  return svg;
}
