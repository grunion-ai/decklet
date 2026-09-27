// decklet assets, the pure half: names → slugs and domains, SVG path bbox and viewBox re-fit, plate detection for SVG and
// PNG logos, a small PNG decoder (stdlib zlib), site logo candidate ranking, the manifest row upsert and the monogram
// fallback. No network, no browser: bin/assets.mjs does the fetching and the screenshots and calls into here.
import zlib from 'node:zlib';

// simple-icons' titleToSlug: the rule its CDN file names follow
export function slugOf(name) {
  return String(name).toLowerCase().replace(/\+/g, 'plus').replace(/\./g, 'dot').replace(/&/g, 'and')
    .replace(/đ/g, 'd').replace(/ħ/g, 'h').replace(/ı/g, 'i').replace(/ĸ/g, 'k').replace(/ŀ/g, 'l').replace(/ł/g, 'l')
    .replace(/ß/g, 'ss').replace(/ŧ/g, 't').normalize('NFD').replace(/[^a-z0-9]/g, '');
}

export const isDomain = s => /^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+\/?$/.test(s);
export function domainOf(input) {
  const s = String(input).trim();
  if (!isDomain(s)) return slugOf(s) + '.com';
  return new URL(/^https?:/i.test(s) ? s : 'https://' + s).hostname.replace(/^www\./, '');
}
// the manifest key: a bare name slugs as-is, a domain slugs its first label ('3ds.com' → '3ds')
export const keyOf = input => slugOf(isDomain(input) ? domainOf(input).split('.')[0] : input);

// ---------- SVG path bbox ----------
const ARGS = {m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0};
function tokens(d) { // [[cmd, [numbers…]], …] with arc flags read as single digits and implicit repeats split out
  const out = []; let i = 0, cmd = null;
  const ws = () => { while (i < d.length && /[\s,]/.test(d[i])) i++; };
  const num = () => { ws(); const m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(d.slice(i)); if (!m) throw new Error('bad path at ' + i); i += m[0].length; return +m[0]; };
  const flag = () => { ws(); const c = d[i++]; if (c !== '0' && c !== '1') throw new Error('bad arc flag at ' + i); return +c; };
  for (ws(); i < d.length; ws()) {
    if (/[a-z]/i.test(d[i])) cmd = d[i++];
    else if (!cmd) throw new Error('path must start with a command');
    const k = cmd.toLowerCase(), n = ARGS[k];
    if (n === undefined) throw new Error('unknown path command ' + cmd);
    const a = k === 'a' ? [num(), num(), num(), flag(), flag(), num(), num()] : Array.from({length: n}, num);
    out.push([cmd, a]);
    if (k === 'm') cmd = cmd === 'm' ? 'l' : 'L'; // implicit lineto after moveto
    if (k === 'z') { ws(); if (i < d.length && !/[a-z]/i.test(d[i])) throw new Error('numbers after z'); }
  }
  return out;
}
// roots in (0,1) of the derivative of a 1-D bezier: quadratic (3 points) or cubic (4 points)
function extremaT(p) {
  if (p.length === 3) { const den = p[0] - 2 * p[1] + p[2]; return den ? [(p[0] - p[1]) / den] : []; }
  const a = -p[0] + 3 * p[1] - 3 * p[2] + p[3], b = 2 * (p[0] - 2 * p[1] + p[2]), c = p[1] - p[0];
  if (Math.abs(a) < 1e-12) return b ? [-c / b] : [];
  const disc = b * b - 4 * a * c; if (disc < 0) return [];
  const r = Math.sqrt(disc); return [(-b + r) / (2 * a), (-b - r) / (2 * a)];
}
const bez = (p, t) => p.length === 3 ? (1 - t) ** 2 * p[0] + 2 * (1 - t) * t * p[1] + t * t * p[2]
  : (1 - t) ** 3 * p[0] + 3 * (1 - t) ** 2 * t * p[1] + 3 * (1 - t) * t * t * p[2] + t ** 3 * p[3];
function arcPoints(x1, y1, rx, ry, deg, large, sweep, x2, y2) { // endpoint → centre (SVG 1.1 F.6.5), then the axis extrema inside the sweep
  if (!rx || !ry) return [[x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = deg * Math.PI / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
  const lam = xp * xp / (rx * rx) + yp * yp / (ry * ry); if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sq = Math.max(0, (rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp) / (rx * rx * yp * yp + ry * ry * xp * xp));
  const co = (large === sweep ? -1 : 1) * Math.sqrt(sq), cxp = co * rx * yp / ry, cyp = -co * ry * xp / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy) => Math.atan2(uy, ux);
  const t1 = ang((xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((-xp - cxp) / rx, (-yp - cyp) / ry) - t1;
  if (sweep && dt < 0) dt += 2 * Math.PI; else if (!sweep && dt > 0) dt -= 2 * Math.PI;
  const at = t => [cx + rx * cos * Math.cos(t) - ry * sin * Math.sin(t), cy + rx * sin * Math.cos(t) + ry * cos * Math.sin(t)];
  const pts = [[x2, y2]], tx = Math.atan2(-ry * sin, rx * cos), ty = Math.atan2(ry * cos, rx * sin);
  for (const base of [tx, tx + Math.PI, ty, ty + Math.PI]) for (let k = -2; k <= 2; k++) {
    const t = base + 2 * Math.PI * k, f = (t - t1) / dt;
    if (f > 0 && f < 1) pts.push(at(t));
  }
  return pts;
}
export function pathBBox(d) {
  let x = 0, y = 0, sx = 0, sy = 0, prev = null, cp = null; const pts = [];
  const add = (px, py) => pts.push([px, py]);
  const curve = (xs, ys) => { add(xs.at(-1), ys.at(-1)); for (const t of [...extremaT(xs), ...extremaT(ys)]) if (t > 0 && t < 1) add(bez(xs, t), bez(ys, t)); };
  for (const [cmd, a] of tokens(d)) {
    const rel = cmd === cmd.toLowerCase(), k = cmd.toLowerCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (k === 'm') { x = sx = a[0] + ox; y = sy = a[1] + oy; add(x, y); }
    else if (k === 'l' || k === 't' && !(prev === 'q' || prev === 't')) { if (k === 't') cp = [x, y]; x = a[0] + ox; y = a[1] + oy; add(x, y); }
    else if (k === 'h') { x = a[0] + ox; add(x, y); }
    else if (k === 'v') { y = a[0] + oy; add(x, y); }
    else if (k === 'z') { x = sx; y = sy; }
    else if (k === 'c' || k === 's') {
      const [c1x, c1y] = k === 'c' ? [a[0] + ox, a[1] + oy] : prev === 'c' || prev === 's' ? [2 * x - cp[0], 2 * y - cp[1]] : [x, y];
      const r = k === 'c' ? a.slice(2) : a, c2x = r[0] + ox, c2y = r[1] + oy, ex = r[2] + ox, ey = r[3] + oy;
      curve([x, c1x, c2x, ex], [y, c1y, c2y, ey]); cp = [c2x, c2y]; x = ex; y = ey;
    } else if (k === 'q' || k === 't') {
      const [qx, qy] = k === 'q' ? [a[0] + ox, a[1] + oy] : [2 * x - cp[0], 2 * y - cp[1]];
      const ex = (k === 'q' ? a[2] : a[0]) + ox, ey = (k === 'q' ? a[3] : a[1]) + oy;
      curve([x, qx, ex], [y, qy, ey]); cp = [qx, qy]; x = ex; y = ey;
    } else if (k === 'a') { for (const p of arcPoints(x, y, a[0], a[1], a[2], a[3], a[4], a[5] + ox, a[6] + oy)) add(...p); x = a[5] + ox; y = a[6] + oy; }
    prev = k;
  }
  if (!pts.length) return null;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
  return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0];
}
const r3 = n => Math.round(n * 1000) / 1000;
// the union of every <path>'s bbox, or null when the SVG paints with anything a pure parser would measure wrongly
export function svgBBox(svg) {
  const body = svg.replace(/<(title|desc|metadata|defs|style)[\s\S]*?<\/\1>/gi, '');
  if (/transform=|<(circle|ellipse|rect|polygon|polyline|line|text|use|image|g[^>]*clip-path)\b/i.test(body)) return null;
  const ds = [...body.matchAll(/<path\b[^>]*?\sd="([^"]*)"/gi)].map(m => m[1]);
  if (!ds.length) return null;
  let b = null;
  try { for (const d of ds) { const p = pathBBox(d); if (!p) continue; b = b ? [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[0] + b[2], p[0] + p[2]), Math.max(b[1] + b[3], p[1] + p[3])] : [p[0], p[1], p[0] + p[2], p[1] + p[3]]; } }
  catch { return null; }
  return b && [r3(b[0]), r3(b[1]), r3(b[2] - b[0]), r3(b[3] - b[1])];
}
// set the root viewBox to the painted bbox (+pad) and drop fixed width/height so the logo scales to its box
export function fitViewBox(svg, [x, y, w, h], pad = 0) {
  const vb = [x - pad, y - pad, w + 2 * pad, h + 2 * pad].map(r3).join(' ');
  return svg.replace(/<svg\b[^>]*>/i, tag => {
    let t = tag.replace(/\s(width|height|viewBox)="[^"]*"/gi, '');
    if (!/xmlns=/.test(t)) t = t.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    return t.replace(/\s*\/?>$/, m => ` viewBox="${vb}"${m.trim() === '/>' ? '/>' : '>'}`);
  });
}

// ---------- plate detection ----------
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const tone = rgb => lum(rgb) > 0.8 ? 'light' : lum(rgb) < 0.2 ? 'dark' : 'mid';
const NAMED = {white: [255, 255, 255], black: [0, 0, 0], currentcolor: [0, 0, 0]};
function rgbOf(c) {
  c = c.trim().toLowerCase();
  if (NAMED[c]) return NAMED[c];
  let m = /^#([0-9a-f]{3,8})$/.exec(c);
  if (m) { const h = m[1].length < 6 ? [...m[1].slice(0, 3)].map(x => x + x).join('') : m[1].slice(0, 6); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  m = /^rgba?\(([^)]*)\)$/.exec(c); if (m) return m[1].split(/[\s,/]+/).slice(0, 3).map(Number);
  return null; // other named colours and gradients read as mid
}
// the plate a logo needs: 'dark' for a white-on-transparent mark, 'light' for a dark one, 'any' when it carries its own contrast
const plateOf = tones => tones.every(t => t === 'light') ? 'dark' : tones.every(t => t === 'dark') ? 'light' : 'any';
export function svgPlate(svg) {
  const fills = [...svg.matchAll(/fill\s*(?:=\s*["']|:\s*)([^"';}]+)/gi)].map(m => m[1].trim()).filter(f => !/^(none|transparent)$/i.test(f));
  if (!fills.length) return 'light'; // SVG paints black by default
  return plateOf(fills.map(f => { const rgb = rgbOf(f); return rgb ? tone(rgb) : 'mid'; }));
}
// area-weighted: the mean luminance of the painted pixels, so a light wordmark with a few grey accents still asks for a dark plate
export function pngPlate(img) {
  if (!img?.data) return 'any';
  const {data} = img; let clear = 0, sum = 0;
  for (let i = 0; i < data.length; i += 4) { if (data[i + 3] < 128) clear++; else sum += lum([data[i], data[i + 1], data[i + 2]]); }
  const px = data.length / 4, seen = px - clear;
  if (clear < px * 0.05 || !seen) return 'any'; // an opaque tile brings its own plate
  const mean = sum / seen;
  return mean > 0.75 ? 'dark' : mean < 0.25 ? 'light' : 'any';
}

// ---------- PNG decode (8-bit, non-interlaced; anything else reports its size with data null) ----------
export function decodePng(buf) {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let i = 8, ihdr, plte, trns; const idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i), type = buf.toString('ascii', i + 4, i + 8), body = buf.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') ihdr = body; else if (type === 'PLTE') plte = body; else if (type === 'tRNS') trns = body; else if (type === 'IDAT') idat.push(body);
    i += 12 + len;
  }
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4), depth = ihdr[8], ct = ihdr[9];
  const ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct];
  if (depth !== 8 || ihdr[12] || !ch) return {width, height, data: null};
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * ch, px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[o + x - ch] : 0, b = y ? px[o - stride + x] : 0, c = x >= ch && y ? px[o - stride + x - ch] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[o + x] = row[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const s = p * ch; let rgba;
    if (ct === 0) rgba = [px[s], px[s], px[s], 255];
    else if (ct === 4) rgba = [px[s], px[s], px[s], px[s + 1]];
    else if (ct === 2) rgba = [px[s], px[s + 1], px[s + 2], 255];
    else if (ct === 6) rgba = [px[s], px[s + 1], px[s + 2], px[s + 3]];
    else { const k = px[s]; rgba = [plte[k * 3], plte[k * 3 + 1], plte[k * 3 + 2], trns && k < trns.length ? trns[k] : 255]; }
    data.set(rgba, p * 4);
  }
  return {width, height, data};
}

// ---------- site logo candidates ----------
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)].map(m => [m[1].toLowerCase(), (m[3] ?? m[4]).replace(/&amp;/g, '&')]));
const kindOfUrl = u => /^data:image\/svg/i.test(u) || /\.svg$/i.test(u.split(/[?#]/)[0]) ? 'svg' : /^data:image\/png/i.test(u) || /\.png$/i.test(u.split(/[?#]/)[0]) ? 'png' : null;
// header <img> logos first (SVG, naming the company, not an inverse variant), then SVG icon links, apple-touch-icon, PNG icons.
// .ico, JPEG and WebP are skipped: the plate and aspect checks read SVG and PNG only.
export function logoCandidates(html, base, name) {
  const abs = u => { try { return u.startsWith('data:') ? u : new URL(u, base).href; } catch { return null; } };
  const who = [slugOf(name), String(name).toLowerCase()].filter(Boolean), imgs = [], icons = [];
  [...html.matchAll(/<img\b[^>]*>/gi)].forEach((m, pos) => {
    const a = attrs(m[0]), src = a.src || a['data-src']; if (!src) return;
    const url = abs(src), fmt = url && kindOfUrl(url); if (!fmt) return;
    const hay = [src.split(/[?#]/)[0], a.alt, a.class, a.id].filter(Boolean).join(' ').toLowerCase();
    const named = who.some(w => hay.includes(w)), logo = /logo|brand|wordmark/.test(hay);
    if (!logo && !named) return;
    const score = (fmt === 'svg' ? 2 : 0) + (named ? 2 : 0) + (logo ? 1 : 0) - (/white|inverse|reverse|negative/.test(hay) ? 1 : 0);
    imgs.push({url, kind: 'site', fmt, score, pos});
  });
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]), rel = (a.rel || '').toLowerCase(); if (!/icon/.test(rel) || !a.href) continue;
    const url = abs(a.href), fmt = url && (/svg/.test(a.type || '') ? 'svg' : kindOfUrl(url)); if (!fmt) continue;
    icons.push({url, kind: 'site-icon', fmt, score: fmt === 'svg' ? 2 : /apple-touch/.test(rel) ? 1 : 0});
  }
  imgs.sort((a, b) => b.score - a.score || a.pos - b.pos);
  icons.sort((a, b) => b.score - a.score);
  const seen = new Set();
  return [...imgs.slice(0, 8), ...icons].filter(c => !seen.has(c.url) && seen.add(c.url)).map(({url, kind, fmt}) => ({url, kind, fmt}));
}

// ---------- manifest + monogram ----------
export const upsertManifest = (rows, row) => [...rows.filter(r => r.name !== row.name), row].sort((a, b) => a.name.localeCompare(b.name));

export const initials = name => String(name).trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
export function monogram(name) {
  let h = 0; for (const c of String(name)) h = (h * 31 + c.codePointAt(0)) >>> 0;
  const hue = h % 360, s = 0.45, l = 0.38, k = n => (n + hue / 30) % 12;
  const hex = [0, 8, 4].map(n => Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, '0')).join('');
  const t = initials(name), size = t.length > 1 ? 24 : 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#${hex}"/>` +
    `<text x="32" y="32" dy=".35em" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif" font-weight="700" font-size="${size}" fill="#fff">${t.replace(/[<&]/g, '')}</text></svg>`;
}
