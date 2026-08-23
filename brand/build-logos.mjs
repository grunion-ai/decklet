#!/usr/bin/env node
// decklet brand asset generator — single source of truth for the logo mark.
//
// Family: grunion-ai (same blue as weave/kami). 48-unit grid, one colour,
// transparent-safe (no background-coloured "gap" paint — cuts are masks).
// The candidates are parametric so a decision round can be re-rendered.
// Usage: node brand/build-logos.mjs [outDir=brand/assets]
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const PALETTE = {
  blue: "#2563eb", sky: "#60a5fa", ink: "#0c1b33", cream: "#e0dcd4", ice: "#bcd3ff", white: "#ffffff",
};

// A 16:9 slide card centred on the 48 grid. w=36 → h=20.25, rounded 3.
const card = (x, y, w, r = 3) => ({ x, y, w, h: +(w * 9 / 16).toFixed(3), r });
const rect = (c, fill, extra = "") =>
  `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${c.r}" fill="${fill}"${extra}/>`;
const outline = (c, stroke, sw = 3.5) =>
  `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${c.r}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;

// Candidate marks. Each returns {defs, body} in one colour `c`.
export const MARKS = {
  // A — stack: three cards, the front one solid, two behind as a fanned deck.
  stack(c, id = "a", gw = 2.5) {
    const f = card(6, 16.5, 36), m = card(9, 11, 30), b = card(12, 6, 24);
    const defs = `<mask id="${id}M" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48"><rect width="48" height="48" fill="#fff"/>` +
      `<rect x="${f.x - gw}" y="${f.y - gw}" width="${f.w + 2 * gw}" height="${f.h + 2 * gw}" rx="${f.r + gw}" fill="#000"/>` +
      `<rect x="${m.x - gw}" y="${m.y - gw}" width="${m.w + 2 * gw}" height="${m.h + 2 * gw}" rx="${m.r + gw}" fill="#000" mask="url(#${id}F)"/></mask>` +
      `<mask id="${id}F" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48"><rect width="48" height="48" fill="#fff"/>` +
      `<rect x="${f.x - gw}" y="${f.y - gw}" width="${f.w + 2 * gw}" height="${f.h + 2 * gw}" rx="${f.r + gw}" fill="#000"/></mask>`;
    const body = rect(b, c, ` mask="url(#${id}M)"`) + rect(m, c, ` mask="url(#${id}F)"`) + rect(f, c);
    return { defs, body };
  },
  // B — nib: one outlined slide with the editor's corner resize nib, solid.
  nib(c) {
    const s = card(6, 13.875, 36), n = 7;
    return { defs: "", body: outline(s, c) + `<rect x="${s.x + s.w - n / 2}" y="${s.y + s.h - n / 2}" width="${n}" height="${n}" rx="1.5" fill="${c}"/>` };
  },
  // C — roles: solid slide cut by a Title bar and two Body bars (the eight roles).
  roles(c, id = "c") {
    const s = card(6, 13.875, 36);
    const bar = (y, w, h) => `<rect x="12" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#000"/>`;
    const defs = `<mask id="${id}M" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48"><rect width="48" height="48" fill="#fff"/>` +
      bar(19, 16, 4) + bar(26, 24, 2.25) + bar(30.5, 18, 2.25) + `</mask>`;
    return { defs, body: rect(s, c, ` mask="url(#${id}M)"`) };
  },
  // D — peek: two slides; the front one solid, the next one peeking behind (offset ×1).
  peek(c, id = "d") {
    const f = card(6, 17, 36), b = card(10, 11, 36);
    const gw = 2.5;
    const defs = `<mask id="${id}M" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48"><rect width="48" height="48" fill="#fff"/>` +
      `<rect x="${f.x - gw}" y="${f.y - gw}" width="${f.w + 2 * gw}" height="${f.h + 2 * gw}" rx="${f.r + gw}" fill="#000"/></mask>`;
    return { defs, body: rect({ ...b, w: 32 }, c, ` mask="url(#${id}M)"`) + rect(f, c) };
  },
  // E — d-card: the letter d whose bowl is a 16:9 slide. Ascender on the right.
  dcard(c) {
    const sw = 4.5, s = card(6 + sw / 2, 22, 30 - sw, 2.5);
    const asc = `<rect x="${s.x + s.w - sw / 2}" y="6" width="${sw}" height="${s.h + 16}" rx="${sw / 2}" fill="${c}"/>`;
    return { defs: "", body: outline(s, c, sw) + asc };
  },
  // G — dnib: the d-card with the editor's corner nib on the bowl.
  dnib(c) {
    const sw = 4.5, s = card(6 + sw / 2, 22, 30 - sw, 2.5), n = 7;
    const asc = `<rect x="${s.x + s.w - sw / 2}" y="6" width="${sw}" height="${s.h + 16}" rx="${sw / 2}" fill="${c}"/>`;
    const nib = `<rect x="${s.x - n / 2}" y="${s.y + s.h - n / 2}" width="${n}" height="${n}" rx="1.5" fill="${c}"/>`;
    return { defs: "", body: outline(s, c, sw) + asc + nib };
  },
  // F — one-file: a solid slide with a dog-eared top-right corner (one portable file).
  file(c) {
    const s = card(6, 13.875, 36), e = 8;
    const { x, y, w, h, r } = s;
    const d = `M${x + r},${y} H${x + w - e} L${x + w},${y + e} V${y + h - r} a${r},${r} 0 0 1 -${r},${r} H${x + r} a${r},${r} 0 0 1 -${r},-${r} V${y + r} a${r},${r} 0 0 1 ${r},-${r} Z`;
    const ear = `M${x + w - e},${y} V${y + e} H${x + w} Z`;
    return { defs: "", body: `<path d="${d}" fill="${c}"/><path d="${ear}" fill="${c}" opacity=".45"/>` };
  },
};

const svgOf = ({ defs, body }, vb = "0 0 48 48", extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${extra}>${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;

// Canonical mark (decision 2026-08-23, revised same day): A · stack.
export const CANON = "stack";

// ---------------------------------------------------------------------------
// Loader: cycling through the deck. Each card advances one slot (back → mid →
// front → off the bottom) while a new one fades in at the back; after one step
// the picture equals the start, so a single step loops seamlessly. SMIL only —
// works inline, in <img>, and as a CSS background. The under-card cuts carry
// the SAME keyframes as the cards cutting them, so gaps stay registered.
export const LOADER_CYCLE_MS = 1400;
const SLOTS = [card(14, 2.5, 20), card(12, 6, 24), card(9, 11, 30), card(6, 16.5, 36), card(8, 21, 32)];
const OP = [0, 1, 1, 1, 0]; // slot opacity (-1 and 3 are invisible)
export function loaderStack({ c = PALETTE.blue, id = "ls", dur = LOADER_CYCLE_MS / 1000 } = {}) {
  const gw = 2.5, kt = "0;.6;1", spline = ` calcMode="spline" keyTimes="${kt}" keySplines=".45 0 .25 1;0 0 1 1"`;
  const an = (attr, a, b, t = spline) => `<animate attributeName="${attr}" values="${a};${b};${b}" dur="${dur}s" repeatCount="indefinite"${t}/>`;
  const fast = ` calcMode="spline" keyTimes="0;.3;1" keySplines=".4 0 1 1;0 0 1 1"`; // the exiting card is gone early
  // A rect moving from slot i to i+1; `pad` grows it for mask cuts.
  const mover = (i, fill, pad = 0, extra = "") => {
    const A = SLOTS[i], B = SLOTS[i + 1];
    return `<rect x="${A.x - pad}" y="${A.y - pad}" width="${A.w + 2 * pad}" height="${A.h + 2 * pad}" rx="${A.r + pad}" fill="${fill}" opacity="${OP[i]}"${extra}>` +
      an("x", A.x - pad, B.x - pad) + an("y", A.y - pad, B.y - pad) + an("width", A.w + 2 * pad, B.w + 2 * pad) +
      an("height", A.h + 2 * pad, B.h + 2 * pad) + an("opacity", OP[i], OP[i + 1], i === 3 ? fast : spline) + `</rect>`;
  };
  const region = `maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48"`;
  // Card moving from slot i is cut by every card in front of it (slots > i).
  // The exiting card (3→4) drops BEHIND the deck: drawn first, cut by all three.
  const mask = (i, cutters) => `<mask id="${id}${i}" ${region}><rect width="48" height="48" fill="#fff"/>` +
    cutters.map(j => mover(j, "#000", gw)).join("") + `</mask>`;
  const defs = mask(3, [0, 1, 2]) + mask(0, [1, 2]) + mask(1, [2]);
  const body = mover(3, c, 0, ` mask="url(#${id}3)"`) + mover(0, c, 0, ` mask="url(#${id}0)"`) + mover(1, c, 0, ` mask="url(#${id}1)"`) + mover(2, c);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="Loading"><defs>${defs}</defs>${body}</svg>`;
}

// Favicon: the d at 16px needs a heavier stroke (optical correction, as weave).
export function faviconSvg() { return svgOf(MARKS.stack(PALETTE.blue, "fav", 3.5)); }

export function markSvg(name, c = PALETTE.blue) { return svgOf(MARKS[name](c)); }

// App-icon tile: blue squircle, cream mark.
export function tileSvg(name) {
  const m = MARKS[name](PALETTE.cream);
  return svgOf({ defs: m.defs, body: `<rect width="48" height="48" rx="11" fill="${PALETTE.blue}"/>` + m.body });
}

// Lockup: mark ≈ cap-height beside lowercase wordmark.
export function lockupSvg(name, c = PALETTE.blue, text = PALETTE.ink) {
  const m = MARKS[name](c);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 48"><defs>${m.defs}</defs>` +
    `<g transform="translate(4 9) scale(.62)">${m.body}</g>` +
    `<text x="38" y="33" font-family="Outfit, Inter, system-ui, -apple-system, sans-serif" font-weight="600" font-size="28" letter-spacing="-0.56" fill="${text}">decklet</text></svg>`;
}

export function contactSheet() {
  const names = Object.keys(MARKS);
  const col = 170, row = 180;
  const cell = (n, i) => {
    const x = 20 + i * col;
    const swatch = (y, bg, c, size, label) =>
      `<rect x="${x}" y="${y}" width="140" height="64" rx="8" fill="${bg}"/>` +
      [48, 32, 16].map((s, k) => `<g transform="translate(${x + 8 + k * 48 + (48 - s) / 2} ${y + 8 + (48 - s) / 2}) scale(${s / 48})">${MARKS[n](c, n + k + label).body}</g>`).join("");
    const defs = [0, 1, 2].flatMap(k => ["l", "d"].map(l => MARKS[n](PALETTE.blue, n + k + l).defs)).join("");
    return `<defs>${defs}</defs><text x="${x}" y="30" font-family="system-ui" font-size="13" font-weight="600" fill="#0c1b33">${String.fromCharCode(65 + i)} · ${n}</text>` +
      swatch(40, "#ffffff", PALETTE.blue, 48, "l") + swatch(112, PALETTE.ink, PALETTE.cream, 48, "d");
  };
  const w = 40 + names.length * col;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${row + 20}" width="${w}" height="${row + 20}"><rect width="${w}" height="${row + 20}" fill="#f4f3f0"/>` +
    names.map(cell).join("") + `</svg>`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "assets");
  mkdirSync(out, { recursive: true });
  const files = {
    "decklet-mark-mono-blue.svg": markSvg(CANON, PALETTE.blue),
    "decklet-mark-mono-cream.svg": markSvg(CANON, PALETTE.cream),
    "decklet-mark-white.svg": markSvg(CANON, PALETTE.white),
    "decklet-mark-ink.svg": markSvg(CANON, PALETTE.ink),
    "decklet-tile.svg": tileSvg(CANON),
    "decklet-favicon.svg": faviconSvg(),
    "decklet-lockup.svg": lockupSvg(CANON),
    "decklet-lockup-dark.svg": lockupSvg(CANON, PALETTE.sky, PALETTE.cream),
    "decklet-loader.svg": loaderStack(),
    "decklet-loader-cream.svg": loaderStack({ c: PALETTE.cream }),
  };
  if (process.argv.includes("--candidates")) files["decklet-candidates.svg"] = contactSheet();
  for (const [f, s] of Object.entries(files)) writeFileSync(join(out, f), s);
  console.log(`wrote ${Object.keys(files).length} files → ${out}`);
}
