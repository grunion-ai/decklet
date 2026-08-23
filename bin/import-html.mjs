#!/usr/bin/env node
// decklet import-html: finalized HTML pages (fixed viewport) → model.json {w,h,styles,slots,layouts,master,slides}.
// Walks each mockup's live DOM (Playwright, fonts loaded) and emits only rows that PAINT (text/bg/border/svg/img),
// then lifts structure out of the per-slide rows: recurring rows → master layer, heading signatures → layout slots,
// style signatures → roles, bottom-right text → footer, single-line / shrink-to-fit intent → nowrap / w:'auto'.
// usage: node bin/import-html.mjs [--w 1600 --h 900] [--out model.json] [--shots dir] <pages.html | glob> [...]
//   --shots: directory of reference PNGs named <page-basename>.png — recorded in model.report.json for bin/verify.mjs --refs
// Needs Playwright (optional devDependency) — the only part of the toolchain that needs a browser besides verify.
// library: import {extract, assemble, extractInPage, classify, ROLES} — assemble() is pure and unit-tested.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// ── in-page walker: serialised into the mockup page by Playwright ──
export function extractInPage(VW) {
  const r2 = v => Math.round(v * 100) / 100;
  const hex = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c; const [r, g, b, a] = m[1].split(',').map(Number); if (a === 0) return null; const h = [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''); return '#' + h.toUpperCase() + (a != null && a < 1 ? Math.round(a * 255).toString(16).padStart(2, '0') : ''); };
  // 1) materialise ::before/::after pseudo content as real spans so they get rects like everything else
  const PROPS = ['position', 'left', 'right', 'top', 'bottom', 'transform', 'color', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'line-height', 'text-transform', 'display', 'width', 'height', 'background-color', 'border-radius', 'opacity', 'white-space'];
  for (const el of [...document.querySelectorAll('body *')]) for (const ps of ['::before', '::after']) {
    const cs = getComputedStyle(el, ps); if (!cs.content || cs.content === 'none' || cs.content === 'normal') continue;
    const s = document.createElement('span'); s.dataset.pseudo = ps;
    for (const k of PROPS) s.style.setProperty(k, cs.getPropertyValue(k));
    s.textContent = cs.content.replace(/^"|"$/g, '');
    ps === '::before' ? el.prepend(s) : el.append(s);
  }
  const st = document.createElement('style'); st.textContent = '*::before,*::after{content:none!important}'; document.head.append(st);
  // 2) walk
  const els = [];
  const bodyCs = getComputedStyle(document.body);
  const isInline = e => getComputedStyle(e).display.startsWith('inline') && !(e instanceof SVGElement) && e.tagName !== 'IMG';
  const hasText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const isLeaf = e => { const kids = [...e.children]; if (e instanceof SVGElement || e.tagName === 'IMG') return false; if (hasText(e)) return true; return kids.length && kids.every(isInline) && e.textContent.trim(); };
  const rect = e => { const r = e.getBoundingClientRect(); return { x: r2(r.left), y: r2(r.top), w: r2(r.width), h: r2(r.height) }; };
  const side = (cs, s) => { const w = parseFloat(cs.getPropertyValue(`border-${s}-width`)); if (!w) return null; return `${w}px ${cs.getPropertyValue(`border-${s}-style`)} ${hex(cs.getPropertyValue(`border-${s}-color`))}`; };
  // source line count: cluster the content range's client rects by top
  const lines = e => { const rg = document.createRange(); rg.selectNodeContents(e); const tops = []; for (const r of rg.getClientRects()) { if (!r.width && !r.height) continue; if (!tops.some(t => Math.abs(t - r.top) < 2)) tops.push(r.top); } return tops.length || 1; };
  // shrink-to-fit: width unchanged under max-content ⇒ the source box hugs its content (inline-block / auto-width flex item / abs)
  // (measured as content width == inner width — the max-content probe is a no-op on table cells, so a 58px td read as a hugging chip)
  const hugs = e => { const cs = getComputedStyle(e), rg = document.createRange(); rg.selectNodeContents(e); const inner = e.getBoundingClientRect().width - ['Left', 'Right'].reduce((a, s) => a + parseFloat(cs['padding' + s]) + parseFloat(cs['border' + s + 'Width']), 0); return Math.abs(inner - rg.getBoundingClientRect().width) < 1.5; };
  function boxRow(e, cs) {
    const bg = hex(cs.backgroundColor); const sides = ['top', 'right', 'bottom', 'left'].map(s => side(cs, s));
    if (!bg && !sides.some(Boolean) && cs.boxShadow === 'none') return null;
    const row = { ...rect(e) };
    if (bg) row.bg = bg;
    const uniq = [...new Set(sides)];
    if (uniq.length === 1 && sides[0]) row.bd = sides[0];
    else { ['bt', 'br', 'bb', 'bl'].forEach((k, i) => { if (sides[i]) row[k] = sides[i]; }); }
    const rad = ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map(c => cs.getPropertyValue(`border-${c}-radius`));
    if (rad.some(v => v !== '0px')) row.radius = new Set(rad).size === 1 ? parseFloat(rad[0]) : rad.join(' ');
    if (cs.boxShadow !== 'none') row.shadow = cs.boxShadow;
    if (cs.opacity !== '1') row.op = +cs.opacity;
    return row;
  }
  function textRow(e, cs, bx) {
    const r = e.getBoundingClientRect();
    const pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), pt = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
    const pr = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth), pb = parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    const n = lines(e), hug = n === 1 && hugs(e);
    // hugging single-line source (chip / pill / label): ONE row carrying its own padding + border + bg, w:'auto' — not a box row + an inner text row
    const row = hug ? { x: r2(r.left), y: r2(r.top), w: 'auto', ...(bx ? Object.fromEntries(Object.entries(bx).filter(([k]) => !'xywh'.includes(k))) : {}), p: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(v => parseFloat(v)).join('px ') + 'px' }
                    : { x: r2(r.left + pl), y: r2(r.top + pt), w: r2(r.width - pl - pr) };
    // vertically centred single line (table cell / flex align-items:center): the line box sits below the padding edge — take y from the glyph rect
    if (n === 1 && !hug) { const rg = document.createRange(); rg.selectNodeContents(e); const g = rg.getBoundingClientRect(); const lh = cs.lineHeight === 'normal' ? g.height : parseFloat(cs.lineHeight); const y = r2(g.top - (lh - g.height) / 2); if (y > row.y + 0.5) row.y = y; }
    if (row.p === '0px 0px 0px 0px') delete row.p;
    row._w = r2(r.width); row._h = r2(r.height); // proof metadata: the source box (the AE proof masks it where the scale changed the row)
    // fit: the largest font-size at which this row still keeps its source line count inside its box (hugging rows have no box to fit)
    if (!hug) { const s0 = parseFloat(cs.fontSize), prev = e.style.fontSize, ok = sz => { e.style.fontSize = sz + 'px'; return lines(e) <= n && e.scrollWidth <= e.clientWidth + 1; };
      if (!ok(s0)) row._fit = s0; else { let lo = s0, hi = s0 * 1.6; while (hi - lo > 0.25) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; } row._fit = Math.floor(lo * 2) / 2; }
      e.style.fontSize = prev; }
    row.font = cs.fontFamily; row.size = parseFloat(cs.fontSize); row.weight = +cs.fontWeight; row.color = hex(cs.color);
    if (cs.letterSpacing !== 'normal') row.ls = parseFloat(cs.letterSpacing);
    if (cs.lineHeight !== 'normal') row.lh = r2(parseFloat(cs.lineHeight));
    if (cs.textTransform !== 'none') row.tt = cs.textTransform;
    if (cs.textAlign !== 'start' && cs.textAlign !== 'left') row.align = cs.textAlign;
    if (cs.whiteSpace !== 'normal' && cs.whiteSpace !== 'nowrap') row.ws = cs.whiteSpace;
    if (cs.fontStyle !== 'normal') row.italic = 1;
    if (cs.opacity !== '1') row.op = +cs.opacity;
    if (n === 1) row.nowrap = 1; // intent: the source reads as one line — it must never wrap in the deck
    row._lines = n;
    // inline descendants: pin any style that differs from the leaf, then serialise as html
    const leafFlex = /flex/.test(cs.display);
    if (leafFlex) row.css = `display:flex;gap:${cs.gap};align-items:${cs.alignItems};justify-content:${cs.justifyContent};flex-wrap:${cs.flexWrap}`;
    const inl = [...e.querySelectorAll('*')];
    if (inl.length) {
      const keys = ['color', 'font-weight', 'font-family', 'font-size', 'letter-spacing', 'text-transform', 'padding-left', 'padding-right', 'font-style', 'opacity', 'position', 'top', 'line-height', 'display', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'padding-top', 'padding-bottom', 'white-space', 'vertical-align'];
      const pin = inl.map(d => { const dc = getComputedStyle(d); const o = {}; for (const k of keys) { const v = dc.getPropertyValue(k), pv = cs.getPropertyValue(k); const always = k === 'display' ? (v !== 'inline' && !(leafFlex && v === 'block')) : /^(margin|padding)-/.test(k) ? v !== '0px' : false; if (always || v !== pv) o[k] = k === 'color' ? hex(v) : v; } return o; });
      inl.forEach((d, i) => { for (const k in pin[i]) d.style.setProperty(k, pin[i][k]); d.removeAttribute('class'); if (d.dataset.pseudo) { delete d.dataset.pseudo; } });
      // the SERIALISED runs lose the locked type keys — runs change weight/style/position/colour, never size (the role owns family/size/lh/tracking)
      const raw = e.innerHTML.replace(/\s+/g, ' ').trim(), LK = /\s*(font-size|font-family|line-height|letter-spacing):\s*(?:&quot;[^&]*&quot;|[^;])*;?/g;
      row.html = raw.replace(LK, ''); if (raw !== row.html) row._runs = 1; // a run changed family/size in the mockup → brand-scale conflict, recorded
    } else row.text = e.textContent;
    return { row, hug };
  }
  function walk(e) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (e instanceof SVGElement) { const c = e.cloneNode(true); c.removeAttribute('width'); c.removeAttribute('height'); els.push({ ...rect(e), svg: c.outerHTML }); return; }
    if (e.tagName === 'IMG') {
      const row = { ...rect(e), img: e.getAttribute('src'), fit: cs.objectFit, pos: cs.objectPosition };
      const bx = boxRow(e, cs); if (bx) Object.assign(row, { bd: bx.bd, radius: bx.radius, bg: bx.bg });
      els.push(row); return;
    }
    // inside a CSS-transformed subtree the mockup rasterises at fractional offsets; mirror that with a translate of the fraction
    const xf = e.closest('[data-xf]') || (cs.transform !== 'none' && (e.dataset.xf = '1', e));
    const frac = row => { if (!xf) return row; const fx = row.x - Math.floor(row.x), fy = row.y - Math.floor(row.y); row.x = Math.floor(row.x); row.y = Math.floor(row.y); row.css = (row.css ? row.css + ';' : '') + `transform:translate(${r2(fx)}px,${r2(fy)}px)`; return row; };
    const bx = boxRow(e, cs);
    if (isLeaf(e)) { const { row, hug } = textRow(e, cs, bx); if (bx && !hug) els.push(frac(bx)); els.push(frac(row)); return; }
    if (bx) els.push(frac(bx));
    for (const k of e.children) walk(k);
  }
  for (const k of document.body.children) walk(k);
  return { bg: hex(bodyCs.backgroundColor), els };
}

// ── pure structure lifting (node side) ──
const paints = r => !!(r.text || r.html || r.svg || r.img || r.bg || r.bd || r.bt || r.br || r.bb || r.bl);
const kind = r => r.svg ? 'svg' : r.img ? 'img' : (r.text != null || r.html != null) ? 'text' : 'box';
const plain = r => (r.text ?? r.html ?? '').replace(/<[^>]+>/g, '').trim();
const viewBox = r => (r.svg.match(/viewBox="([^"]+)"/) || [])[1] || '';
const wOf = r => r.w === 'auto' ? 0 : r.w;
const rightOf = r => r.x + (r.w === 'auto' ? (r._w ?? (r._box && r._box[2]) ?? 0) : r.w); // hugging rows: the source width rides _w (walker) / _box (assembled)
// hugging rows (w:'auto') are the same element when EITHER edge lines up: a right-anchored footer grows leftward as its text changes
const near = (a, b, tol) => (Math.abs(a.x - b.x) <= tol || (a.w === 'auto' && b.w === 'auto' && Math.abs(rightOf(a) - rightOf(b)) <= tol)) && Math.abs(a.y - b.y) <= tol && (a.w === 'auto' || b.w === 'auto' || Math.abs(a.w - b.w) <= tol) && Math.abs((a.h || 0) - (b.h || 0)) <= tol;
// same KIND of thing: a recoloured logo, a rephrased footer, the same rule at a different margin
const kin = (a, b) => { const k = kind(a); if (k !== kind(b)) return false; if (k === 'svg') return viewBox(a) === viewBox(b); if (k === 'text') return Math.abs(a.size - b.size) <= 2; if (k === 'box') return ['bg', 'bd', 'bt', 'br', 'bb', 'bl'].every(p => !!a[p] === !!b[p]); return true; };
const mode = arr => { const c = new Map(); for (const v of arr) c.set(v, (c.get(v) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]; };
const rkey = r => [r.x, r.y, r.w, r.h].join(',');

// ── the eight roles. Roles are the ONLY source of family / size / line-height / tracking; a row may carry weight,
//    colour, case, italic — never size: for any text type there is exactly one font/size/leading combination.
export const ROLES = ['Title', 'Supertitle', 'H1', 'H2', 'Body', 'Caption', 'Label', 'Stat'];
const LOCKED = ['font', 'size', 'lh', 'ls', 'mono'];
const fam = f => String(f || '').split(',')[0].replace(/["']/g, '').trim().toLowerCase(); // first family = the face the mockup asked for
const upper = r => r.tt === 'uppercase' || (/[A-Z]/.test(plain(r)) && plain(r) === plain(r).toUpperCase());
const isMono = r => /mono|menlo|courier|fira code/i.test(r.font || '');
export const classify = r => {
  const s = r.size || 14, t = plain(r);
  if (s >= 28 && /\d/.test(t) && t.length <= 12) return 'Stat';
  if (r.w === 'auto' && r.p || isMono(r) || (upper(r) && s < 14)) return 'Label';   // chips, pills, step numbers, mono tags
  if (upper(r) && s <= 18) return 'Supertitle';
  if (s >= 40) return 'H1';   // Title is never emitted here — detectTitle assigns it after layouts
  if (s >= 20 && (r.weight || 400) >= 600) return 'H2';
  if (s <= 14) return 'Caption';
  return 'Body';
};
const SEED = { // neutral eight-role scale (px at 1600 model space); detected modal signatures override these seeds
  Title: { font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 106, weight: 800, lh: 113, ls: -2.5, color: '#F3F4F6', tt: null }, // display: 1.9× H1; detectTitle assigns it
    Supertitle: { font: 'ui-monospace, Menlo, Consolas, monospace', size: 20, weight: 500, lh: 26, ls: 2.5, color: '#5B9CF6', tt: 'uppercase' },
  H1: { font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 56, weight: 800, lh: 66, ls: -0.8, color: '#F3F4F6', tt: null },
  H2: { font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 36, weight: 600, lh: 46, ls: -0.5, color: '#F3F4F6', tt: null },
  Body: { font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 26, weight: 400, lh: 40, ls: 0, color: '#F3F4F6', tt: null },
  Caption: { font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 21, weight: 400, lh: 30, ls: 0, color: '#9CA3AF', tt: null },
  Label: { font: 'ui-monospace, Menlo, Consolas, monospace', size: 18, weight: 500, lh: 23, ls: 1.7, color: '#9CA3AF', tt: 'uppercase' },
  Stat: { font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 66, weight: 800, lh: 73, ls: -1.7, color: '#5B9CF6', tt: null },
};
const RP = ['font', 'size', 'weight', 'lh', 'ls', 'color', 'tt'];

// chrome = rows that recur by POSITION BAND (top/bottom ~15%, never a heading) on ≥ half the slides: same kind, rect within
// tol — whatever they say. Master sits at the modal rect; measured drift (< tol) is mockup error and is normalised away:
// NO override for position, NO override for text. A slide forks only a colour (recoloured logo / dark footer) or hides the row.
export function detectMaster(slides, W, H, tol = 24) {
  const N = slides.length, need = Math.max(2, Math.ceil(N / 2));
  const band = e => e.y < H * 0.15 || e.y > H * 0.85;
  const chromeish = e => band(e) && (kind(e) !== 'text' || ['Caption', 'Label'].includes(classify(e)));
  const clusters = [];
  slides.forEach((s, si) => s.els.forEach((e, ei) => {
    if (!chromeish(e)) return;
    let c = clusters.find(c => !c.inst.some(x => x.si === si) && kin(c.proto, e) && near(c.proto, e, tol));
    if (!c) clusters.push(c = { proto: e, inst: [] });
    c.inst.push({ si, ei, e });
  }));
  const master = [], normalised = []; let n = 0;
  for (const c of clusters) {
    if (c.inst.length < need) continue;
    const modal = mode(c.inst.map(x => rkey(x.e)));
    const proto = c.inst.find(x => rkey(x.e) === modal).e;
    const m = { id: 'm' + (++n), ...structuredClone(proto) }; delete m._lines;
    if (kind(m) === 'text') { const t = mode(c.inst.map(x => x.e.text ?? x.e.html)); if (m.html != null) m.html = t; else m.text = t; }
    master.push(m); c.id = m.id; c.m = m;
  }
  const foot = master.filter(m => kind(m) === 'text' && m.y > H * 0.8).sort((a, b) => (b.y - a.y) || ((b.x + wOf(b)) - (a.x + wOf(a))))[0];
  // the mockups typed their page count ("· 2/5", "3 / 6", "Page 2 of 5"); the engine renders the counter — strip it from every instance before the text vote
  const COUNTER = /\s*[·|\-–—]?\s*(?:page\s*)?\d+\s*(?:\/|of)\s*\d+\s*$/i;
  if (foot) { foot.footer = 1; const c = clusters.find(c => c.m === foot); for (const x of c.inst) if (x.e.text != null && COUNTER.test(x.e.text)) x.e.text = x.e.text.replace(COUNTER, ''); foot.text = foot.text == null ? foot.text : mode(c.inst.map(x => x.e.text)); }
  slides.forEach((s, si) => {
    const used = new Set(), keep = [];
    for (const c of clusters) {
      if (!c.m) continue; const m = c.m, x = c.inst.find(x => x.si === si);
      if (!x) { (s.hide = s.hide || []).push(m.id); continue; }
      used.add(x.ei); const e = x.e;
      if (rkey(e) !== rkey(m)) normalised.push({ slide: s.name, id: m.id, what: 'rect', from: [e.x, e.y, e.w, e.h], to: [m.x, m.y, m.w, m.h] });
      const o = { override: m.id };
      if (kind(m) === 'svg' && e.svg !== m.svg) o.svg = e.svg;                                    // recoloured mark
      if (kind(m) === 'text') { if (e.color !== m.color) o.color = e.color; if ((e.text ?? e.html) !== (m.text ?? m.html)) normalised.push({ slide: s.name, id: m.id, what: 'text', from: plain(e), to: plain(m) }); if (e.html && m.html && e.html !== m.html && e.color === m.color) { /* run colours differ — keep the master's */ } }
      if (kind(m) === 'box') for (const p of ['bg', 'bd', 'bt', 'br', 'bb', 'bl']) if (e[p] !== m[p]) o[p] = e[p];
      if (Object.keys(o).length > 1) { if (m.footer) o.footer = 1; keep.push(o); }
    }
    s.els = s.els.filter((_, ei) => !used.has(ei)).concat(keep);
  });
  return { master, normalised };
}

// heading rows in the top band, reading order → layout key; one layout per distinct (bg, heading sequence).
// The supertitle slot is DECK-scope (deck.slots): one rect for every slide; layouts vary content slots only.
const heads = (s, H) => s.els.filter(e => kind(e) === 'text' && !e.override && e.y < H * 0.35).sort((a, b) => (a.y - b.y) || (a.x - b.x)).slice(0, 3).map(e => ({ e, role: classify(e) }));
export function detectLayouts(slides, W, H) {
  const key = s => (s.bg || '') + '|' + heads(s, H).map(h => h.role).join(',');
  const groups = new Map(); slides.forEach((s, si) => (groups.get(key(s)) || groups.set(key(s), []).get(key(s))).push(si));
  const order = [...groups.values()].sort((a, b) => b.length - a.length);
  const layouts = {}, slots = {}, sup = [];
  order.forEach((idx, gi) => {
    const name = gi === 0 ? 'content' : idx[0] === 0 ? 'title' : 'alt' + gi;
    const hs = idx.map(si => heads(slides[si], H)); const n = Math.min(...hs.map(h => h.length)); const ls = {};
    for (let k = 0; k < n; k++) {
      const role = hs[0][k].role; if (!hs.every(h => h[k].role === role)) break;
      const rows = hs.map(h => h[k].e);
      if (k === 0 && role === 'Supertitle') { rows.forEach(r => { r.slot = 'supertitle'; r.role = role; sup.push(r); }); continue; }
      const slot = role === 'H1' ? 'title' : role.toLowerCase() + (k ? k : '');
      ls[slot] = { x: +mode(rows.map(r => r.x)), y: +mode(rows.map(r => r.y)), w: mode(rows.map(r => r.w)), role };
      rows.forEach(r => { r.slot = slot; r.role = role; ['x', 'y', 'w'].forEach(p => { if (r[p] === ls[slot][p]) delete r[p]; }); });
    }
    layouts[name] = ls; idx.forEach(si => { slides[si].layout = name; });
  });
  if (sup.length) { slots.supertitle = { x: +mode(sup.map(r => r.x)), y: +mode(sup.map(r => r.y)), w: mode(sup.map(r => r.w)), role: 'Supertitle' }; sup.forEach(r => ['x', 'y', 'w'].forEach(p => delete r[p])); }
  return { layouts, slots };
}
// Title: the headline signature that appears ONLY on non-content layouts (title / closing) and is larger than any content
// H1 — the largest display cluster. Rebinds the slot role too when the headline is slot-bound.
export function detectTitle(slides, layouts) {
  const h1s = s => s.els.filter(e => kind(e) === 'text' && !e.override && (e.role || classify(e)) === 'H1');
  const contentMax = Math.max(0, ...slides.filter(s => s.layout === 'content').flatMap(h1s).map(e => e.size || 0));
  const heads = slides.filter(s => s.layout !== 'content').flatMap(s => h1s(s).filter(e => (e.size || 0) > contentMax).map(e => ({ s, e })));
  if (!heads.length) return [];
  heads.forEach(({ s, e }) => { e.role = 'Title'; if (e.slot && layouts[s.layout] && layouts[s.layout][e.slot]) layouts[s.layout][e.slot].role = 'Title'; });
  return heads.map(h => h.e);
}
// roles: neutral seed ← modal detected signature. Every text row gets one of the eight roles; locked props (font/size/lh/ls)
// are deleted from the row outright — a row that disagreed with its role is a type-scale CONFLICT, recorded, never kept.
export function detectRoles(slides, master) {
  const all = [...slides.flatMap(s => s.els), ...master].filter(e => kind(e) === 'text');
  all.forEach(e => { if (!e.role) e.role = classify(e); });
  const roles = {}, conflicts = {};
  for (const name of ROLES) {
    const rows = all.filter(e => e.role === name); const t = { ...SEED[name] };
    if (rows.length) for (const p of RP) t[p] = mode(rows.map(r => r[p] ?? null));
    // fit cap: the scale may shrink a row, never crowd it — a role is its modal signature capped by the tightest row wearing it
    // (_fit = the largest font-size at which the row keeps its source line count inside its box, measured in the mockup page)
    const tight = rows.filter(r => r._fit != null && r._fit < t.size).sort((a, b) => a._fit - b._fit)[0]; let cap = null;
    if (tight) { cap = { from: t.size, to: tight._fit, text: plain(tight).slice(0, 40) }; const sig = rows.filter(r => r.size <= tight._fit).sort((a, b) => b.size - a.size)[0];
      const ratio = tight._fit / t.size; t.lh = t.lh == null ? null : Math.round(t.lh * ratio * 100) / 100; t.size = tight._fit;
      if (sig && sig.lh != null) t.lh = sig.lh; } // prefer a real mockup leading at/below the cap
    roles[name] = t;
    const off = rows.filter(r => r.size !== t.size);
    conflicts[name] = { seed: SEED[name].size, mockup: t.size, rows: rows.length, ...(cap ? { cap } : {}), snapped: off.map(r => ({ from: r.size, text: plain(r).slice(0, 40) })) };
  }
  all.forEach(e => {
    const t = roles[e.role];
    // proof metadata: ANY locked key off the role (row or run) = the scale changed this row — verify reports its line-count drift as scale crowding, not a parity failure
    if (!!e._runs || e.size !== t.size || (e.lh ?? null) !== (t.lh ?? null) || Math.abs((e.ls ?? 0) - (t.ls ?? 0)) > 0.05 || fam(e.font) !== fam(t.font)) e._src = { size: e.size, lh: e.lh ?? null, ls: e.ls ?? null, ...(e._runs ? { runs: 1 } : {}) };
    delete e._runs; delete e._fit;
    for (const p of LOCKED) delete e[p];
    for (const p of ['weight', 'color', 'tt']) { if ((e[p] ?? null) === (t[p] ?? null)) delete e[p]; else if (e[p] == null) e[p] = null; }
    if (e.html) e.html = e.html.replace(/\s*(font-size|font-family|line-height|letter-spacing):[^;"]+;?/g, '');   // runs never carry size
  });
  return { roles, conflicts };
}
export function assemble(raw, { w: W = 1600, h: H = 900 } = {}) {
  const slides = raw.map(s => ({ name: s.name, bg: s.bg, els: s.els.filter(paints).map(e => { const o = { ...e }; if (o.text != null || o.html != null) { o._box = [o.x, o.y, o._w ?? o.w, o.h]; delete o._w; delete o.h; } if (o.w === 'auto') delete o.h; return o; }) }));
  const { master, normalised } = detectMaster(slides, W, H);
  const { layouts, slots } = detectLayouts(slides, W, H);
  detectTitle(slides, layouts);
  const { roles, conflicts } = detectRoles(slides, master);
  // margin token: the content inset chrome sits on — modal inset of the master rows from either canvas edge
  const ins = master.flatMap(m => [m.x, ...(m.w !== 'auto' && m.w ? [W - m.x - m.w] : [])]).map(Math.round);
  const margin = ins.length ? +mode(ins) : Math.round(W * 0.05);
  const deck = { w: W, h: H, styles: { roles, margin, pad: { chip: '5px 12px', pill: '6px 14px' } }, slots, layouts, master, slides };
  return Object.defineProperty(deck, '_report', { value: { conflicts, normalised }, enumerable: false });
}

export async function extract(files, { w = 1600, h = 900, shots = null } = {}) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch(); const raw = [];
  for (const f of files) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.goto('file://' + path.resolve(f)); await p.waitForTimeout(1500);
    const rows = await p.evaluate(extractInPage, w);
    for (const e of rows.els) if (e.img && !e.img.startsWith('data:')) { const fp = path.resolve(path.dirname(f), e.img); e.img = 'data:image/png;base64,' + fs.readFileSync(fp).toString('base64'); }
    raw.push({ name: path.basename(f, '.html'), ...rows });
    await p.close();
  }
  await b.close();
  const deck = assemble(raw, { w, h });
  if (shots) deck._report.refs = Object.fromEntries(deck.slides.map((s, n) => [n, path.resolve(shots, s.name + '.png')]).filter(([, f]) => fs.existsSync(f)));
  return deck;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), opt = { w: 1600, h: 900, out: 'model.json', shots: null }, files = [];
  for (let k = 0; k < a.length; k++) a[k].startsWith('--') ? (opt[a[k].slice(2)] = a[++k]) : files.push(...(/[*?[]/.test(a[k]) ? fs.globSync(a[k]).sort() : [a[k]]));
  if (!files.length) { console.error('usage: node bin/import-html.mjs [--w 1600 --h 900] [--out model.json] [--shots dir] <pages.html|glob> […]'); process.exit(2); }
  const deck = await extract(files, { w: +opt.w, h: +opt.h, shots: opt.shots });
  fs.writeFileSync(opt.out, JSON.stringify(deck));
  fs.writeFileSync(opt.out.replace(/\.json$/, '') + '.report.json', JSON.stringify(deck._report, null, 1));
  console.log('wrote ' + opt.out + ' (+ .report.json: role conflicts, normalised chrome, reference shots)');
  console.log(deck.slides.map(s => `${s.name} [${s.layout}]: ${s.els.length} rows`).join('\n') + `\nmaster: ${deck.master.length} rows · layouts: ${Object.keys(deck.layouts).join(',')} · margin ${deck.styles.margin}`);
}
