/**
 * Abstract thumbnails for the fictional bakery account.
 *
 * Every image is a small generated SVG — flat shapes on a warm background —
 * so the screenshots contain no photographs, no faces and nothing belonging to
 * anyone. Each motif is a loose nod to a bake (a scored boule, a croissant, a
 * tray of buns); none of them tries to look like a real post.
 *
 * Everything is seeded, so a regenerated screenshot is pixel-identical.
 */

/** mulberry32: small, fast, and good enough for picking colours. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BACKDROPS = [
  ["#f4ebdd", "#e6d3b8"], // flour
  ["#e9c9a7", "#d7a77c"], // biscuit
  ["#c9d3b6", "#a9b88f"], // sage
  ["#efcfc8", "#dfaaa1"], // blush
  ["#f3dd9c", "#e6c06a"], // butter
  ["#c7d7df", "#a5bcc8"], // pale blue
  ["#5a4034", "#3d2b23"], // cocoa
  ["#d9c7df", "#b9a0c2"], // lilac
  ["#e4e1d8", "#c9c4b6"], // linen
  ["#2f3a36", "#1f2724"], // slate
];

const CRUST = [
  ["#e7b36e", "#a8622c"],
  ["#dca25c", "#8f4f22"],
  ["#eec27f", "#b9763a"],
  ["#d69a52", "#7d4219"],
];

const PASTEL = ["#f2b8c0", "#b9dcc2", "#f4dc8f", "#c9b8e6", "#f6c89f", "#a9d3e0", "#e9a6a6"];

const W = 300;
const H = 400;
const CX = W / 2;
const CY = H / 2 + 6;

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

function f(n) {
  return Math.round(n * 10) / 10;
}

function crustGradient(id, [light, dark]) {
  return `<radialGradient id="${id}" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></radialGradient>`;
}

function shadow(rx, ry, dy = 0) {
  return `<ellipse cx="${CX}" cy="${f(CY + dy)}" rx="${f(rx)}" ry="${f(ry)}" fill="#000" opacity="0.16" filter="url(#blur)"/>`;
}

/** A light dusting of flour: scattered pale dots. */
function dust(rand, count, { cx = CX, cy = CY, r = 100, colour = "#fff", opacity = 0.55 } = {}) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * r;
    out += `<circle cx="${f(cx + Math.cos(a) * d)}" cy="${f(cy + Math.sin(a) * d)}" r="${f(0.8 + rand() * 1.8)}" fill="${colour}" opacity="${opacity}"/>`;
  }
  return out;
}

const MOTIFS = {
  boule(rand, defs) {
    defs.push(crustGradient("crust", pick(rand, CRUST)));
    const r = 98;
    const tilt = -20 + rand() * 40;
    let scores = "";
    for (let i = -1; i <= 1; i++) {
      const x = CX + i * 34;
      scores += `<path d="M${x - 10} ${CY - 70} Q${x + 18} ${CY} ${x - 10} ${CY + 70}" stroke="#f4d9a8" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.9"/>`;
    }
    return (
      shadow(r, 22, r - 6) +
      `<g transform="rotate(${f(tilt)} ${CX} ${CY})"><circle cx="${CX}" cy="${CY}" r="${r}" fill="url(#crust)"/>${scores}</g>` +
      dust(rand, 40, { r: 80, opacity: 0.35 })
    );
  },

  baguettes(rand, defs) {
    defs.push(crustGradient("crust", pick(rand, CRUST)));
    let out = "";
    const n = 3;
    for (let i = 0; i < n; i++) {
      const y = CY - 80 + i * 80;
      const angle = -28 + rand() * 8;
      let slashes = "";
      for (let s = 0; s < 5; s++) {
        const x = CX - 110 + s * 50;
        slashes += `<path d="M${x} ${y + 12} L${x + 30} ${y - 12}" stroke="#f3d5a0" stroke-width="6" stroke-linecap="round"/>`;
      }
      out += `<g transform="rotate(${f(angle)} ${CX} ${y})"><rect x="${CX - 150}" y="${y - 24}" width="300" height="48" rx="24" fill="url(#crust)"/>${slashes}</g>`;
    }
    return out + dust(rand, 30, { r: 130, opacity: 0.3 });
  },

  croissant(rand, defs) {
    defs.push(crustGradient("crust", pick(rand, CRUST)));
    // Overlapping lobes along an arc, fattest in the middle.
    let out = shadow(110, 18, 70);
    const lobes = 7;
    for (let i = 0; i < lobes; i++) {
      const t = i / (lobes - 1);
      const a = Math.PI * (1.1 + t * 0.8);
      const size = 30 + Math.sin(t * Math.PI) * 34;
      const x = CX + Math.cos(a) * 95;
      const y = CY + 40 + Math.sin(a) * 70;
      out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(size)}" ry="${f(size * 0.78)}" fill="url(#crust)" stroke="#8a4a1f" stroke-opacity="0.35" stroke-width="3" transform="rotate(${f((a * 180) / Math.PI + 90)} ${f(x)} ${f(y)})"/>`;
    }
    return out;
  },

  macarons(rand) {
    let out = "";
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 62 + col * 88 + (row % 2) * 12;
        const y = 78 + row * 84;
        const c = pick(rand, PASTEL);
        out +=
          `<ellipse cx="${x}" cy="${y + 20}" rx="36" ry="8" fill="#000" opacity="0.12" filter="url(#blur)"/>` +
          `<rect x="${x - 34}" y="${y - 22}" width="68" height="20" rx="10" fill="${c}"/>` +
          `<rect x="${x - 30}" y="${y - 4}" width="60" height="9" rx="4" fill="#fff6e8"/>` +
          `<rect x="${x - 34}" y="${y + 4}" width="68" height="20" rx="10" fill="${c}"/>` +
          `<rect x="${x - 26}" y="${y - 19}" width="30" height="5" rx="2.5" fill="#fff" opacity="0.35"/>`;
      }
    }
    return out;
  },

  cinnamon(rand, defs) {
    defs.push(crustGradient("crust", pick(rand, CRUST)));
    let spiral = "";
    const turns = 3.2;
    for (let i = 0; i <= 160; i++) {
      const t = i / 160;
      const a = t * turns * Math.PI * 2;
      const r = 8 + t * 78;
      spiral += `${i ? "L" : "M"}${f(CX + Math.cos(a) * r)} ${f(CY + Math.sin(a) * r)}`;
    }
    let glaze = "";
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2;
      const r = 30 + rand() * 60;
      glaze += `<path d="M${f(CX + Math.cos(a) * r - 14)} ${f(CY + Math.sin(a) * r)} q14 ${f(-10 + rand() * 20)} 28 0" stroke="#fffaf0" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.9"/>`;
    }
    return (
      shadow(98, 20, 92) +
      `<circle cx="${CX}" cy="${CY}" r="96" fill="url(#crust)"/>` +
      `<path d="${spiral}" stroke="#6b3514" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.55"/>` +
      glaze
    );
  },

  doughnut(rand) {
    const icing = pick(rand, ["#f2a7b8", "#b88a6a", "#f6e6a6", "#c7b3ea"]);
    let sprinkles = "";
    const colours = ["#ffffff", "#f4d35e", "#5aa9e6", "#7fc8a9", "#ee6c6c"];
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const r = 48 + rand() * 38;
      const x = CX + Math.cos(a) * r;
      const y = CY + Math.sin(a) * r;
      sprinkles += `<rect x="${f(x - 6)}" y="${f(y - 2)}" width="12" height="4" rx="2" fill="${pick(rand, colours)}" transform="rotate(${f(rand() * 180)} ${f(x)} ${f(y)})"/>`;
    }
    const ring = (r1, r2) =>
      `M${CX - r1} ${CY}a${r1} ${r1} 0 1 0 ${r1 * 2} 0a${r1} ${r1} 0 1 0 ${-r1 * 2} 0Z M${CX - r2} ${CY}a${r2} ${r2} 0 1 1 ${r2 * 2} 0a${r2} ${r2} 0 1 1 ${-r2 * 2} 0Z`;
    return (
      shadow(104, 20, 96) +
      `<path d="${ring(104, 34)}" fill="#d9a060" fill-rule="evenodd"/>` +
      `<path d="${ring(94, 40)}" fill="${icing}" fill-rule="evenodd"/>` +
      sprinkles
    );
  },

  slice(rand) {
    const cream = "#fff4e2";
    const sponge = pick(rand, ["#f1d08f", "#8a5a3c", "#f3c7a6"]);
    const fruit = pick(rand, ["#d64550", "#7a3b69", "#f28c28"]);
    let layers = "";
    for (let i = 0; i < 4; i++) {
      layers += `<path d="M${CX - 110} ${CY + 60 - i * 40} L${CX + 90} ${CY + 30 - i * 40} L${CX + 90} ${CY + 10 - i * 40} L${CX - 110} ${CY + 40 - i * 40} Z" fill="${i % 2 ? cream : sponge}"/>`;
    }
    return (
      shadow(110, 16, 76) +
      `<path d="M${CX - 110} ${CY + 70} L${CX + 90} ${CY + 40} L${CX + 90} ${CY - 120} L${CX - 110} ${CY - 90} Z" fill="${sponge}"/>` +
      layers +
      `<path d="M${CX - 110} ${CY - 90} L${CX + 90} ${CY - 120} L${CX + 60} ${CY - 140} L${CX - 90} ${CY - 112} Z" fill="${cream}"/>` +
      `<circle cx="${CX - 10}" cy="${CY - 128}" r="16" fill="${fruit}"/>` +
      `<circle cx="${CX - 16}" cy="${CY - 134}" r="4" fill="#fff" opacity="0.5"/>`
    );
  },

  tray(rand, defs) {
    defs.push(crustGradient("crust", pick(rand, CRUST)));
    let buns = "";
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const x = CX - 56 + col * 112;
        const y = CY - 104 + row * 104;
        buns +=
          `<circle cx="${x}" cy="${y}" r="44" fill="url(#crust)"/>` +
          `<ellipse cx="${x - 14}" cy="${y - 16}" rx="16" ry="9" fill="#fff" opacity="0.22"/>` +
          dust(rand, 4, { cx: x, cy: y, r: 22, colour: "#fbe8c4", opacity: 0.9 });
      }
    }
    return `<rect x="${CX - 124}" y="${CY - 164}" width="248" height="328" rx="16" fill="#3a3a3c"/><rect x="${CX - 114}" y="${CY - 154}" width="228" height="308" rx="10" fill="#4a4a4d"/>${buns}`;
  },

  cookies(rand) {
    let out = "";
    const spots = [
      [CX - 62, CY - 92],
      [CX + 66, CY - 58],
      [CX - 40, CY + 44],
      [CX + 72, CY + 96],
      [CX - 96, CY + 150],
    ];
    for (const [x, y] of spots) {
      const r = 46 + rand() * 12;
      out += `<circle cx="${f(x + 4)}" cy="${f(y + 8)}" r="${f(r)}" fill="#000" opacity="0.14" filter="url(#blur)"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#c98b4f"/>`;
      for (let i = 0; i < 7; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * r * 0.7;
        out += `<rect x="${f(x + Math.cos(a) * d - 5)}" y="${f(y + Math.sin(a) * d - 5)}" width="10" height="10" rx="3" fill="#4a2a17"/>`;
      }
    }
    return out;
  },

  pie(rand) {
    const filling = pick(rand, ["#b3253a", "#6b2d5c", "#e39b2d"]);
    let lattice = "";
    for (let i = -3; i <= 3; i++) {
      lattice += `<rect x="${CX + i * 26 - 8}" y="${CY - 100}" width="16" height="200" rx="8" fill="#e6b574"/>`;
      lattice += `<rect x="${CX - 100}" y="${CY + i * 26 - 8}" width="200" height="16" rx="8" fill="#dca764"/>`;
    }
    return (
      shadow(112, 20, 100) +
      `<clipPath id="pie"><circle cx="${CX}" cy="${CY}" r="92"/></clipPath>` +
      `<circle cx="${CX}" cy="${CY}" r="110" fill="#f1f1ee"/>` +
      `<circle cx="${CX}" cy="${CY}" r="96" fill="#d4995a"/>` +
      `<circle cx="${CX}" cy="${CY}" r="88" fill="${filling}"/>` +
      `<g clip-path="url(#pie)">${lattice}</g>`
    );
  },

  starter(rand) {
    let bubbles = "";
    for (let i = 0; i < 22; i++) {
      bubbles += `<circle cx="${f(CX - 60 + rand() * 120)}" cy="${f(CY - 20 + rand() * 120)}" r="${f(2 + rand() * 6)}" fill="none" stroke="#b9a988" stroke-width="2"/>`;
    }
    return (
      shadow(90, 14, 150) +
      `<rect x="${CX - 80}" y="${CY - 130}" width="160" height="280" rx="26" fill="#ffffff" opacity="0.45"/>` +
      `<rect x="${CX - 72}" y="${CY - 40}" width="144" height="182" rx="18" fill="#efe4cc"/>` +
      bubbles +
      `<rect x="${CX - 86}" y="${CY - 150}" width="172" height="34" rx="8" fill="#9a8b73"/>` +
      `<rect x="${CX - 80}" y="${CY - 60}" width="160" height="6" rx="3" fill="#6f7f5f" opacity="0.7"/>`
    );
  },

  loaf(rand, defs) {
    defs.push(crustGradient("crust", pick(rand, CRUST)));
    return (
      shadow(120, 18, 102) +
      `<path d="M${CX - 120} ${CY - 20} Q${CX - 120} ${CY - 120} ${CX} ${CY - 120} Q${CX + 120} ${CY - 120} ${CX + 120} ${CY - 20} L${CX + 110} ${CY + 96} L${CX - 110} ${CY + 96} Z" fill="url(#crust)"/>` +
      `<path d="M${CX - 110} ${CY - 12} L${CX + 110} ${CY - 12} L${CX + 104} ${CY + 96} L${CX - 104} ${CY + 96} Z" fill="#3f3f42"/>` +
      `<path d="M${CX - 70} ${CY - 70} Q${CX} ${CY - 100} ${CX + 70} ${CY - 70}" stroke="#fff3d6" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.85"/>` +
      dust(rand, 18, { cy: CY - 80, r: 60, colour: "#fff8e6", opacity: 0.8 })
    );
  },
};

export const MOTIF_NAMES = Object.keys(MOTIFS);

/**
 * @param {object} options
 * @param {string} options.motif one of MOTIF_NAMES
 * @param {number} options.seed
 * @param {number} [options.backdrop] index into BACKDROPS; seeded when omitted
 * @returns {string} a data: URI
 */
export function thumbnail({ motif, seed, backdrop }) {
  const rand = rng(seed);
  const [top, bottom] = BACKDROPS[backdrop ?? Math.floor(rand() * BACKDROPS.length)];
  const defs = [
    `<linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`,
    `<radialGradient id="vignette" cx="50%" cy="45%" r="75%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></radialGradient>`,
    `<filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>`,
  ];
  const body = (MOTIFS[motif] || MOTIFS.boule)(rand, defs);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">` +
    `<defs>${defs.join("")}</defs>` +
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>` +
    body +
    `<rect width="${W}" height="${H}" fill="url(#vignette)"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The profile picture: a boule on a warm disc. */
export function avatar() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<defs><radialGradient id="c" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#eec27f"/><stop offset="1" stop-color="#9c5a2b"/></radialGradient></defs>` +
    `<rect width="100" height="100" fill="#f1e4cf"/>` +
    `<circle cx="50" cy="54" r="30" fill="url(#c)"/>` +
    `<path d="M40 32 Q52 54 40 76 M52 30 Q64 54 52 78" stroke="#f6dfb4" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
