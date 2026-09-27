// decklet template library — 74 finished slides that ship in the engine (59 candidates, the ten figures, and the starting rungs). A template is a layout PLUS sample rows: the
// candidate sheet (templates/candidates.html) surveyed across the open-source slide catalogs, reviewed on
// 2026-09-07 and promoted whole. A slide names one — `{template:'three-up-cards', fill:{t2:'Three things, one price.'}}` — and
// create() expands it into the ordinary rows it stands for (like a chart row), scaled from the 960×540 cut to the canvas.
// Every text row of a template is a key, t1..tn in row order; `fill` replaces the sample text by key; free `els` on the
// slide follow the template rows. The template's chrome (`content` / `title`) is a library layout the deck may redefine.
// A template whose MEANING is a number — a Harvey-ball rating, a progress fill, a gauge read — also declares VALUE keys
// (ROADMAP U4): `vals: {r1c1: {range: [0, 4], sample: 3, of: 'Incumbent A · Coverage'}}` with `els` written as a function
// of the value map. `fill` takes those keys as numbers (a `kind: 'data'` key takes the chart row's own array — the template
// hands it to that row, so the drawing rules are the chart row's), validate checks them, and `--templates` prints them under
// the text keys.
// K22: a filled slide names every quantity its graphic draws. A required value key left out fails expansion with a message
// naming it; an optional one (`optional`) drops its graphic instead; a `kind: 'logos'` key takes a group of 1–4 logos. A
// template whose graphic no key reaches yet is SAMPLE_BOUND: it shows as its sample, and any fill is refused.
// Sources: lib/templates/cat-*.mjs (the vocabulary in lib/templates/kit.mjs). Catalogue: node bin/validate.mjs --templates
import narrative from './templates/cat-narrative.mjs';
import numbers from './templates/cat-numbers.mjs';
import proportion from './templates/cat-proportion.mjs';   // Numbers too: values drawn at their size (K10)
import frameworks from './templates/cat-frameworks.mjs';
import process_ from './templates/cat-process.mjs';
import charts from './templates/cat-charts.mjs';
import modern from './templates/cat-modern.mjs';
import figures from './templates/cat-figures.mjs';
import chrome from './templates/cat-chrome.mjs';
import density from './templates/cat-density.mjs';
import quad from './templates/cat-quad.mjs';
import logo from './templates/cat-logo.mjs';
import {scale, cell} from './templates/kit.mjs';
import {checkChart} from './chart.mjs';
import {GAP, PLATES, padOf, plateOf, isLogoRow, autoCol} from './logo.mjs';
import {ICONS} from './icons.mjs';
import {initials} from './assets.mjs';
import {LIBRARY, MEDIA_MIN} from './layouts.mjs';

// density per template: speaker (fluffy) when the sample carries ≤ 3 points, reading (dense) otherwise — see DENSITY in layouts.mjs
// (a template may also state its own `density`, which wins: `stat-row-3` is the speaker cut of a family whose others are reading)
const SPEAKER = new Set(['cover-hero', 'cover-split', 'section-numeral', 'quote-pull', 'statement', 'closing-cta', 'stat-hero', 'delta-pair',
  'chart-donut', 'chart-gauge', 'image-hero-overlay', 'image-split']);   // a four-node cycle and a three-branch tree count 4+ points: reading
// the value map a template renders with when nothing is filled: every declared key at its sample
const sampleVals = t => Object.fromEntries(Object.entries(t.vals || {}).map(([k, d]) => [k, d.sample]));
// `els` may be written as a function of the value map. TEMPLATES normalises: `els` is ALWAYS the sample rows (the sheet, the
// catalogue and the tests read one shape), `build` is the function when there is one.
// A list-shaped template marks each item's LEAD text row `item: 1` (or `item: <px>`, the default media height for that row) in
// its source. The marker never reaches a deck: TEMPLATES strips it and keeps the text keys it sat on as `media` — m1..mn.
const isText = r => r.text != null || r.html != null;
const isCell = r => Array.isArray(r.cell);   // a scorecard cell: one key, whether the sample draws text or a rating ring
const fillable = r => isText(r) || isCell(r);
const unmark = rows => rows.map(r => { if (!('item' in r)) return r; const {item, ...o} = r; return o; });
const itemsOf = rows => { let n = 0; const out = [];
  for (const r of rows) if (fillable(r)) { n++; if (r.item) out.push({on: 't' + n, h: r.item > 1 ? r.item : null}); }
  return out; };
// the neutral scale (template.html's styles.roles): size, line height, cw — a deck's own roles win, read back to the 960 cut
export const NEUTRAL_ROLES = {Title: [64, 68, 0.45], Supertitle: [12, 16, 0.73], H1: [34, 40, 0.46], H2: [22, 28, 0.44], Body: [16, 24, 0.46],
  Caption: [13, 18, 0.47], Label: [11, 14, 0.69], Stat: [40, 44, 0.45]};
const metrics = (role, roles, k) => { const n = NEUTRAL_ROLES[role] || NEUTRAL_ROLES.Body, d = roles && roles[role];
  return d ? {size: (d.size ?? n[0] * k) / k, lh: (d.lh ?? (d.size ? d.size * 1.25 : n[1] * k)) / k, cw: d.cw ?? n[2]} : {size: n[0], lh: n[1], cw: n[2]}; };
// K2: an icon a template places BESIDE text by hand sits the way a media slot's does — centred on the text's first line, GAP
// before the text (the text moves, keeping its right edge) — so no source can top-align one. The neutral line heights: the cut's.
function snapIcons(rows) {
  const out = [...rows];
  rows.forEach((ic, i) => {
    if (!ic.icon || typeof ic.y !== 'number' || typeof ic.w !== 'number' || typeof ic.h !== 'number') return;
    const j = rows.findIndex(r => isText(r) && typeof r.x === 'number' && typeof r.y === 'number' && r.x >= ic.x + ic.w
      && r.x - (ic.x + ic.w) <= 32 && r.y < ic.y + ic.h && r.y + metrics(r.role).lh > ic.y);
    if (j < 0) return;
    const q = out[j], x = ic.x + ic.w + GAP;
    out[i] = {...ic, y: q.y + (metrics(q.role).lh - ic.h) / 2};
    out[j] = {...q, x, ...(typeof q.w === 'number' ? {w: q.w + q.x - x} : {})};
  });
  return out;
}
// K22: a quantity graphic reads a value key. A key may be `optional: true` (or a group name its mates share): a filled slide
// that leaves the group out drops the rows marked `q: <group>` (the graphic, and any caption that only explains it) instead
// of drawing the sample; `unset` is the value an unfilled optional key builds with (default: its sample). `q` never reaches a
// deck: `els` and `build` strip it, `raw` keeps it for fillRows.
const unq = rows => rows.map(r => { if (!('q' in r)) return r; const {q, ...o} = r; return o; });
const groupOf = (k, d) => d.optional === true ? k : d.optional || null;
export const TEMPLATES = [...narrative, ...numbers, ...proportion, ...frameworks, ...process_, ...charts, ...modern, ...figures, ...chrome, ...density, ...quad, ...logo]
  .map(t => { const fn = typeof t.els === 'function' ? t.els : null, raw = fn ? fn(sampleVals(t)) : t.els;
    const rawBuild = fn && (v => snapIcons(unmark(fn(v))));
    return {...t, raw: rawBuild, build: fn && (v => unq(rawBuild(v))), els: unq(snapIcons(unmark(raw))), media: itemsOf(raw),
      density: t.density || (SPEAKER.has(t.id) ? 'speaker' : 'reading')}; });
// K22 audit: templates whose quantity graphic no fill key reaches yet. A fill would put the author's words over the sample's
// numbers, so any fill is refused until the template declares the key (the bare sample still shows on the sheet).
// A template may also declare `valsCheck(v)`: a rule across its keys, run on the filled map (sample under fill) once every key is in.
// Empty since every chart, process, quad, density and chrome template declared its keys; the guard stays for the next one.
export const SAMPLE_BOUND = {};
export const TEMPLATE = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));
export const MEDIA_TEMPLATES = TEMPLATES.filter(t => t.media.length).map(t => t.id);

// ── per-item media (F10): `fill: {m1: {logo}, m2: {img, fit}, m3: {icon}}`. The media sits BESIDE its item's lead text, centred
// on the text's first line, GAP (the logo row's gutter) before the text; a centred lead row keeps the pair centred on its box,
// by the role's cw estimate. A logo turns the lead row into a logo row whose name is the text (docs/logo.md), so the name
// lands where the text was. Sizes are the 960 cut's: the lead role's line height, held to 20..32px, unless the item or `h` says.
// A logo is never under MEDIA_MIN and never shrunk by its column (K11): a small `h` is raised, and a mark wider than the column
// grows it — to the widest mark on the slide, so every name still starts at one x. fillRows moves the rows under a taller item.
const MEDIA_PROPS = {logo: ['logo', 'monogram', 'plate', 'aspect', 'col', 'h', 'alt'], img: ['img', 'fit', 'pos', 'w', 'h', 'alt'], icon: ['icon', 'color', 'h']};
const SRC = /^(data:|#)/;   // an inline data: URI, or '#id' into deck.assets (the runtime resolves it)
const FITS = ['contain', 'cover', 'fill', 'none', 'scale-down'];
const kindsOf = m => ['logo', 'img', 'icon'].filter(k => k === 'logo' ? ('logo' in m || 'monogram' in m) : k in m);
const plainOf = o => String(o.text ?? o.html ?? '').replace(/<[^>]+>/g, '');
// K23: a wordmark — a logo about 3:1 or wider — reads like a line of type, so its floor is WORDMARK_MIN where a logomark's is
// MEDIA_MIN, and where it cannot sit beside its text it STACKS above it across the box's full width (the box grows to hold it)
export const WORDMARK = 3, WORDMARK_MIN = 14;
const isWordmark = m => !!(m && m.logo && m.aspect >= WORDMARK);
const floorOf = m => isWordmark(m) ? WORDMARK_MIN : MEDIA_MIN;
const sizeOf = (m, item, R) => { const s = m.h ?? item.h ?? Math.min(32, Math.max(MEDIA_MIN, R.lh));
  return kindsOf(m)[0] === 'logo' ? Math.max(floorOf(m), s) : s; };
// a refusal names the logo: its alt, else its asset id, else the text it sits beside; then its aspect
const logoName = (m, text) => m.alt ? `the ${m.alt} logo` : typeof m.logo === 'string' && m.logo.startsWith('#') ? `logo ${m.logo}` : `the logo beside "${text.slice(0, 30)}"`;
const aspectOf = m => m.aspect > 0 ? `${+m.aspect.toFixed(2)}:1${isWordmark(m) ? ' wordmark' : ''}` : 'no aspect given';
// the column a wordmark needs to draw at its full height: the chip's inner height times the aspect, plus the plate's padding
const needCol = (m, s) => { if (!m.logo || !(m.aspect > 0)) return 0; const p = padOf(s, plateOf(m.plate)); return Math.ceil((s - 2 * p) * m.aspect + 2 * p); };
function mediaBox(m, item, R, col = 0, size) {
  const [kind] = kindsOf(m), s = size ?? sizeOf(m, item, R);
  const chip = kind === 'logo' && !m.logo;   // the monogram chip is square: its column is the chip, not a wordmark's 2:1
  const mw = kind === 'icon' ? (m.col ?? s) : chip ? Math.max(m.col ?? s, s) : kind === 'img' ? (m.w ?? 2 * s) : Math.max(m.col ?? 2 * s, col, needCol(m, s));
  return {kind, chip, s, mw};
}
function withMedia(o, m, item, roles, k, col, size, stack) {
  const R = metrics(o.role, roles, k), text = plainOf(o), {kind, chip, s, mw} = mediaBox(m, item, R, col, size);
  if (stack) {   // K23: the wordmark on its own line at the text's place, the text under it at its full width; no name on the mark
    const mark = {x: o.x, y: o.y, h: s, col: needCol(m, s), gap: GAP, logo: m.logo, alt: m.alt || text};
    for (const p of ['plate', 'aspect']) if (m[p] != null) mark[p] = m[p];
    return [mark, {...o, y: o.y + s + GAP}];
  }
  const y = o.y + (R.lh - s) / 2, right = o.x + o.w;
  // a centred (or right-aligned) lead row: the PAIR takes the text's place, by the role's cw estimate, and the text runs w:'auto'
  const flow = o.align === 'center' || o.align === 'right', pair = mw + GAP + text.length * R.size * R.cw;
  const x = !flow ? o.x : o.x + (o.align === 'center' ? (o.w - pair) / 2 : o.w - pair);
  const {align, text: _t, html: _h, ...rest} = o, tx = x + mw + GAP;
  if (kind === 'logo') {
    const lr = {...rest, x, y, h: s, col: mw, gap: GAP, name: text};
    if (flow) delete lr.w; else lr.w = right - x;
    delete lr.nowrap;   // the logo row owns the name's wrapping (nowrap with no w); verify would count the monogram chip as a line
    for (const p of ['logo', 'monogram', 'plate', 'aspect', 'alt']) if (m[p] != null) lr[p] = m[p];
    if (lr.logo == null) lr.logo = '';
    if (chip && lr.monogram == null) lr.monogram = initials(text.split(/\s+/).filter(w => /^\p{L}/u.test(w)).join(' ') || text);   // words, not the '·' between them
    return [lr];
  }
  const mark = kind === 'icon' ? {x, y, w: s, h: s, icon: m.icon, color: m.color || o.color || 'var(--accent)'}
    : {x, y, w: mw, h: s, img: m.img, fit: m.fit || 'contain', ...(m.pos ? {pos: m.pos} : {}), alt: m.alt || text};
  return [mark, {...rest, ...(o.html != null ? {html: o.html} : {text: o.text}), x: tx, w: flow ? 'auto' : right - tx}];
}
// what one media value gets wrong, one message each
function mediaErrors(k, m) {
  const say = s => `fill media "${k}" ${s}`;
  if (!m || typeof m !== 'object' || Array.isArray(m) || kindsOf(m).length !== 1)
    return [say(`takes one of {logo}, {img} or {icon} — {logo: 'data:…', plate, aspect} (logo: '' draws the monogram), {img: 'data:…', fit}, {icon: 'factory'}; got ${JSON.stringify(m)?.slice(0, 60)}`)];
  const kind = kindsOf(m)[0], out = [], pos = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
  for (const p of Object.keys(m)) if (!MEDIA_PROPS[kind].includes(p)) out.push(say(`{${kind}} takes ${MEDIA_PROPS[kind].join(' · ')} — not "${p}"`));
  if (kind === 'logo' && m.logo != null && !(typeof m.logo === 'string' && (m.logo === '' || SRC.test(m.logo)))) out.push(say(`logo must be a data: URI, '#id' naming a deck.assets entry, or '' for the monogram chip`));
  if (kind === 'logo' && m.monogram != null && !(typeof m.monogram === 'string' && m.monogram.trim())) out.push(say('monogram must be the initials to draw'));
  if (kind === 'logo' && m.plate != null && !PLATES.includes(m.plate)) out.push(say(`plate "${m.plate}" not one of ${PLATES.join('|')}`));
  if (kind === 'img' && !(typeof m.img === 'string' && SRC.test(m.img))) out.push(say("img must be a data: URI or '#id' naming a deck.assets entry (single file, zero network)"));
  if (kind === 'img' && m.fit != null && !FITS.includes(m.fit)) out.push(say(`fit "${m.fit}" not one of ${FITS.join('|')}`));
  if (kind === 'icon' && !(typeof m.icon === 'string' && ICONS[m.icon])) out.push(say(`icon "${m.icon}" is not a Lucide name (node bin/validate.mjs --icons)`));
  for (const p of ['h', 'w', 'col', 'aspect']) if (m[p] != null && !pos(m[p])) out.push(say(`${p} must be a positive number of px${p === 'aspect' ? ' (width over height)' : ''}`));
  for (const p of ['alt', 'color', 'pos']) if (m[p] != null && typeof m[p] !== 'string') out.push(say(`${p} must be a string`));
  return out;
}
// the media contract of one template: [{key: 'm1', on: 't3'}] — one per item, on the text key of the item's lead row
export function templateMedia(id) {
  const t = TEMPLATE[id]; if (!t) return null;
  return t.media.map((e, i) => ({key: 'm' + (i + 1), on: e.on}));
}

// the fill contract of one template: [{key, role, text}] — t1..tn over the rows a key reaches, in row order. A cell also
// carries `cell: true`: its key takes short text OR a 0..4 rating (validate checks the range).
export function templateKeys(id) {
  const t = TEMPLATE[id]; if (!t) return null;
  let n = 0;
  return t.els.filter(fillable).map(r => ({key: 't' + (++n), ...(isCell(r) ? {cell: true} : {}),
    role: isCell(r) ? 'Cell' : r.role || (r.slot ? r.slot === 'supertitle' ? 'Supertitle' : r.slot === 'title' ? (t.layout === 'title' ? 'Title' : 'H1') : r.slot : 'Body'),
    text: isText(r) ? r.text ?? r.html : `rating ${r.donut / 25} of 4`}));
}

// the VALUE contract of one template: [{key, range, sample, of}] — the numbers its sample would otherwise hardcode
export function templateVals(id) {
  const t = TEMPLATE[id]; if (!t) return null;
  return Object.entries(t.vals || {}).map(([key, d]) => ({key, ...d}));
}
// which rows a value key drives: build the template with each key alone at each end of its range and take the rows that moved.
// One key at a time: a scale shared by every key (ranked bars) keeps the leader's length when all of them move together.
// Used by templateFixed, so a ring or a bar a key reaches is never reported as fixed.
const driven = t => { if (!t.build) return new Set();
  const base = sampleVals(t), moved = new Set();
  for (const [k, d] of Object.entries(t.vals))
    for (const far of d.kind === 'data' ? [d.sample.map(p => ({...Object.fromEntries(Object.entries(p).map(([f, x]) => [f, typeof x === 'number' ? x + 1 : x])), label: p.label + '·'})),   // every number moves: low/high/target too
      d.sample.map((p, i, a) => ({...a[a.length - 1 - i], label: p.label}))] : d.kind === 'logos' ? [d.sample.slice(0, 1)] : d.range) {   // reversed: the leader moves too
      const alt = t.build({...base, [k]: far});
      t.els.forEach((r, i) => { if (JSON.stringify(r) !== JSON.stringify(alt[i])) moved.add(r); });
    }
  return moved; };

// what a slide's `fill` gets wrong, one message each — empty when it is good. expandTemplates refuses a bad fill (the
// slide keeps its `template`, so validate reports it on the model the agent wrote), and validate prints this same list.
export function fillErrors(id, fill = {}) {
  const keys = templateKeys(id); if (!keys) return [];
  const vals = templateVals(id), out = [];
  for (const [k, val] of Object.entries(fill)) {
    if (/^m\d+$/.test(k) && k.slice(1) <= TEMPLATE[id].media.length && k !== 'm0') { out.push(...mediaErrors(k, val)); continue; }
    const vk = vals.find(e => e.key === k);
    if (vk && vk.kind === 'logos') {   // a logo group: 1–4 marks, each checked as a {logo} media value
      if (!Array.isArray(val) || val.length < 1 || val.length > 4) { out.push(`fill value "${k}" takes 1–4 logos [{logo, aspect?, plate?, alt}] (${vk.of}), not ${JSON.stringify(val)?.slice(0, 60)}`); continue; }
      val.forEach((m, i) => { const e = m && typeof m === 'object' && kindsOf(m)[0] === 'logo' ? mediaErrors(`${k}[${i}]`, m) : [`fill media "${k}[${i}]" takes {logo, aspect?, plate?, alt} — got ${JSON.stringify(m)?.slice(0, 60)}`];
        if (!e.length && !(typeof m.alt === 'string' && m.alt.trim())) e.push(`fill media "${k}[${i}]" needs alt: the company's name (the monogram's initials when logo is '')`);
        out.push(...e); });
      continue;
    }
    if (vk && vk.kind === 'data') { const e = checkChart({mark: vk.mark, data: val});   // then the template's own shape rules (K10: count, ring, high)
      for (const m of e.length || !vk.check ? e : vk.check(val)) out.push(`fill value "${k}": ${m}`); continue; }
    if (vk) { if (typeof val !== 'number' || !Number.isFinite(val) || val < vk.range[0] || val > vk.range[1])
      out.push(`fill value "${k}" must be a number ${vk.range[0]}..${vk.range[1]} (${vk.of}), not ${JSON.stringify(val)}`); continue; }
    const key = keys.find(e => e.key === k);
    if (!key) out.push(`fill key "${k}" is not a fill key of ${id} (${keys.map(e => e.key).join(' ')}${vals.length ? ` · values ${vals.map(e => e.key).join(' ')}` : ''}${TEMPLATE[id].media.length ? ` · media ${templateMedia(id).map(e => e.key).join(' ')}` : ''})`);
    else if (typeof val === 'number' && !key.cell) out.push(`fill key "${k}" takes text — only a scorecard cell takes a number (its 0..4 rating)`);
    else if (typeof val === 'number' && !(Number.isInteger(val) && val >= 0 && val <= 4)) out.push(`fill key "${k}": a rating is a whole number 0..4 (quarters of the ring), not ${val}`);
    else if (typeof val !== 'number' && typeof val !== 'string') out.push(`fill key "${k}" takes a string${key.cell ? ', or a 0..4 rating' : ''} — got ${typeof val}`);
  }
  // K22: a filled slide names every quantity its graphic draws — a required key left out would draw the sample's number
  if (Object.keys(fill).length) {
    if (SAMPLE_BOUND[id]) out.push(`${id} draws ${SAMPLE_BOUND[id]} from its own sample and no fill key reaches them yet (K22) — use it unfilled as the sample, or build the slide from rows (a chart row takes your numbers)`);
    for (const v of vals) {
      if (v.key in fill) continue;
      const shown = v.kind === 'data' ? `${v.sample.length}-point series` : v.kind === 'logos' ? `${v.sample.length} logos` : v.sample;
      const g = groupOf(v.key, v), got = g && vals.filter(w => groupOf(w.key, w) === g && w.key in fill).map(w => `"${w.key}"`);
      if (!g) out.push(`fill value "${v.key}" is not filled: the graphic would draw the sample's ${shown} (${v.of}) — fill it${v.range ? `, ${v.range[0]}..${v.range[1]}` : ''}`);
      else if (got.length) out.push(`fill value "${v.key}" is not filled: ${got.join(', ')} ${got.length > 1 ? 'draw' : 'draws'} with it (${v.of}) — fill it too, or leave them all out to drop that graphic`);
    }
    // a rule between keys (a bar ends inside the grid, the lit dot is one of the dots): the template's own `valsCheck`
    if (!out.length && TEMPLATE[id].valsCheck) out.push(...TEMPLATE[id].valsCheck({...sampleVals(TEMPLATE[id]), ...fill}));
  }
  if (out.length) return out;
  // K14: a text that outgrows its sample moves the rows under it down; refuse the fill that would move one off the canvas
  const t = TEMPLATE[id], {rows, grows, dropped} = fillRows(t, fill, null, 1);
  // K22: a text key on a dropped graphic (a caption that only explains it) would vanish with it — say so instead
  for (const d of dropped) if (d.key && d.key in fill) out.push(`fill key "${d.key}" belongs to the graphic of ${vals.filter(v => groupOf(v.key, v) === d.q).map(v => `"${v.key}"`).join(', ')}, which draws only when that is filled — fill it, or leave "${d.key}" out`);
  if (out.length) return out;
  // K11: a centred pair cannot grow sideways, so a mark too wide for its box at MEDIA_MIN is refused, never shrunk
  for (const o of rows) { const d = o.med; if (!d || needCol(d.m, d.s) <= d.room) continue;
    const who = `fill media "${d.mk}": ${logoName(d.m, plainOf(o))} (${aspectOf(d.m)}) needs ${needCol(d.m, d.s)}px`;
    return [...out, d.flow ? `${who} beside "${plainOf(o).slice(0, 30)}" at ${d.s}px tall and its centred box leaves ${Math.max(0, Math.floor(d.room))}px — clear or shorten ${o.key} (the wordmark can carry the name), or use a narrower mark`
      : `${who} at ${d.s}px tall and its box is ${Math.floor(d.room)}px wide — use a narrower mark, or a template with wider items`]; }
  for (const r of rows) {
    const g = geo(r, t.layout), b = g.y + (textH(g, null, 1) ?? (typeof g.h === 'number' ? g.h : 0)), own = grows.find(e => e.key === r.key);
    if (typeof g.y !== 'number' || !(r.shift || own) || b <= 540) continue;
    const why = own ? [own] : grows.filter(e => e.moves.has(r.src));
    out.push(`fill key ${why.map(e => `"${e.key}" runs to ~${e.lines} lines where the sample takes ${e.was}`).join(', ')}: ${own ? 'it' : `the rows under it move down ${r.shift}px and "${plainOf(r).slice(0, 40) || 'a shape'}"`} would end at ~${Math.round(b)}px, past the 540px canvas foot — shorten the text, or expand the template and place the rows by hand`);
    break;
  }
  return out;
}

// ── K14 reflow: the estimated height of a text row at the 960 cut — the gap gate's own estimate (role.cw em per character, a wrap
// counted past 12% over the box) — or null for a row that does not grow: no text, no box width, or a fixed h (a tile owns its box).
const geo = (r, layout) => r.slot ? {...((LIBRARY[layout] || {}).slots || {})[r.slot], ...r} : r;
function textH(g, roles, k) {
  if (!isText(g) || typeof g.y !== 'number' || typeof g.w !== 'number' || typeof g.h === 'number') return null;
  const R = metrics(g.role || 'Body', roles, k);
  const lines = g.nowrap ? 1 : plainOf(g).split('\n').reduce((n, s) => n + Math.max(1, Math.ceil(s.length * R.size * R.cw / g.w - 0.12)), 0);
  return lines * R.lh;
}
// the template's rows with `fill` applied (text keys, rating cells), and every row under a text that grew moved down by the growth:
// a row moves when its top sits at or under the grown row's sample foot and it shares the grown row's columns. Slot rows keep the
// layout's place. Each out row remembers its source row (`src`) and how far it moved (`shift`); neither reaches a deck.
function fillRows(t, fill, roles, k) {
  const vals = sampleVals(t), filled = Object.keys(fill).length > 0, off = new Set();
  for (const [key, d] of Object.entries(t.vals || {})) {
    if (key in fill) { vals[key] = fill[key]; continue; }
    const g = filled && groupOf(key, d);
    if (g) { off.add(g); if ('unset' in d) vals[key] = d.unset; }
  }
  for (const [key, d] of Object.entries(t.vals || {})) if (key in fill) off.delete(groupOf(key, d));   // a group with any key filled draws
  let n = 0; const grows = [], dropped = [];
  // per-item media: key of the lead row → {m, item}. A logo's size comes first (a centred pair must fit its box, so a wide mark
  // steps its height down toward MEDIA_MIN, never under it), then the one column every left-set logo on the slide shares.
  const media = Object.fromEntries(t.media.map((e, i) => [e.on, {mk: 'm' + (i + 1), m: fill['m' + (i + 1)], item: e}]).filter(([, e]) => e.m));
  const rows = (t.raw ? t.raw(vals) : t.els).map(r => {
    const {q, ...o} = {...r, src: r};
    if (fillable(o)) o.key = 't' + (++n);   // keys count every text row, dropped or not, so t1..tn never shift
    if (q && off.has(q)) { dropped.push({key: o.key, q}); return null; }
    if (!o.key || !(o.key in fill)) return o;
    if (isCell(o)) return {...cell(...o.cell, fill[o.key]), src: r, key: o.key};
    delete o.html; o.text = fill[o.key];
    return o;
  }).filter(Boolean);
  for (const o of rows) { const med = o.key && !isCell(o.src) && media[o.key]; if (!med) continue;
    const g = geo(o, t.layout), R = metrics(g.role || 'Body', roles, k), flow = g.align === 'center' || g.align === 'right';
    const room = flow ? g.w - GAP - plainOf(o).length * R.size * R.cw : g.w / 2;
    let s = sizeOf(med.m, med.item, R), stack = false;
    const lo = flow ? floorOf(med.m) : MEDIA_MIN, isLogo = kindsOf(med.m)[0] === 'logo';
    while (isLogo && s > lo && needCol(med.m, s) > room) s--;
    if (isLogo && !flow && isWordmark(med.m) && needCol(med.m, s) > room) {   // too wide beside: stack it across the box
      stack = true; s = sizeOf(med.m, med.item, R);
      while (s > WORDMARK_MIN && needCol(med.m, s) > g.w) s--;
    }
    // a stepped-down mark keeps the line's parity, so it centres on whole pixels and never overhangs the line by a rounded half
    if (isLogo && s < sizeOf(med.m, med.item, R) && (R.lh - s) % 2 && s - 1 >= (stack ? WORDMARK_MIN : lo)) s--;
    o.med = {...med, s, flow, stack, room: stack ? g.w : flow ? room : Infinity, col: 0}; }
  const col = Math.max(0, ...rows.filter(o => o.med && !o.med.flow && !o.med.stack).map(o => needCol(o.med.m, o.med.s)));
  for (const o of rows) {
    if (!o.key || isCell(o.src) || !(o.key in fill || o.med)) continue;
    const g0 = geo(o.src, t.layout), was = textH(g0, roles, k);
    let now = textH(geo(o, t.layout), roles, k), base = was;
    if (o.med) {   // the pair: the text beside the media (a narrower box unless it flows), and the media overhanging a short line;
      if (!o.med.flow) o.med.col = col;   // the sample's air already holds the default media size, so only a bigger one grows
      const g = geo(o, t.layout), R = metrics(g.role || 'Body', roles, k), b = mediaBox(o.med.m, o.med.item, R, o.med.col, o.med.s);
      const s0 = o.med.item.h ?? Math.min(32, Math.max(MEDIA_MIN, R.lh)), tH = o.med.flow ? now : textH({...g, w: g.w - b.mw - GAP}, roles, k);
      if (o.med.stack) { if (was != null) now = was + o.med.s + GAP; }   // a stacked mark adds its whole height above the text
      else if (tH != null && was != null) { now = Math.max(tH, (R.lh - b.s) / 2 + b.s); base = Math.max(was, (R.lh - s0) / 2 + s0); }
    }
    if (was != null && now > base) grows.push({key: o.key, x: g0.x, w: g0.w, foot: g0.y + was, d: now - base,
      lines: Math.round(now / metrics(g0.role || 'Body', roles, k).lh), was: Math.round(was / metrics(g0.role || 'Body', roles, k).lh), moves: new Set()});
  }
  // growths side by side (one per card in a row) move what is under them once, by the largest; growths stacked in one column add
  const along = hit => Math.max(0, ...hit.map(g => hit.filter(e => e.x < g.x + g.w && e.x + e.w > g.x).reduce((a, e) => a + e.d, 0)));
  for (const o of rows) {
    if (o.slot || typeof o.y !== 'number') continue;
    const x0 = typeof o.x === 'number' ? o.x : 0, x1 = typeof o.w === 'number' ? x0 + o.w : o.line ? o.line[0] : x0;
    // K23: a painted box that holds a grown row (its top above the row's sample foot, its bottom under it, its sides around it) grows by it
    if (!fillable(o) && !o.line && !o.curve && typeof o.w === 'number' && typeof o.h === 'number' && (o.bg || o.bd)) {
      const held = grows.filter(g => o.y < g.foot - 0.5 && o.y + o.h >= g.foot - 0.5 && o.x <= g.x && o.x + o.w >= g.x + g.w);
      if (held.length) o.h += along(held);
    }
    const hit = grows.filter(g => o.y >= g.foot - 0.5 && Math.min(x0, x1) < g.x + g.w && Math.max(x0, x1) >= g.x);
    const shift = along(hit);
    if (!shift) continue;
    for (const g of hit) g.moves.add(o.src);
    o.y += shift; o.shift = shift;
    if (Array.isArray(o.line)) o.line = [o.line[0], o.line[1] + shift];
    if (Array.isArray(o.cell)) o.cell = [o.cell[0], o.cell[1] + shift, o.cell[2], o.cell[3]];
  }
  return {rows, grows, dropped};
}

// replace every VALID template slide with its rows; invalid ones stay for validate to report
export function expandTemplates(deck) {
  const k = (deck.w || 960) / 960;
  for (const s of deck.slides || []) {
    if (!s || typeof s !== 'object' || !s.template) continue;
    const t = TEMPLATE[s.template]; if (!t) continue;
    // a refused slide keeps its template for validate to report, and takes the template's layout now, so the author's own slot
    // rows are judged against it instead of cascading into "not in any layout" errors under the one that names the cause
    const fill = s.fill || {}; if (fillErrors(t.id, fill).length) { if (t.layout && !s.layout) s.layout = t.layout; continue; }
    const rows = scale(fillRows(t, fill, deck.styles && deck.styles.roles, k).rows.flatMap(({src, key, shift, med, ...o}) =>
      med ? withMedia(o, med.m, med.item, deck.styles && deck.styles.roles, k, med.col, med.s, med.stack) : [o]), k);
    s.els = [...rows, ...(Array.isArray(s.els) ? s.els : [])];
    if (t.layout && !s.layout) s.layout = t.layout;
    s.name = s.name || t.id;
    s.density = s.density || t.density;
    if (t.textOnly && s.textOnly == null) s.textOnly = true;   // a words template's slide inherits the mark; a slide may say otherwise
    delete s.template; delete s.fill;
  }
  // K26: a logo row's col:'auto' becomes the painted logo's width here, before validate or create reads the row
  for (const s of deck.slides || []) for (const r of (s && Array.isArray(s.els) ? s.els : []))
    if (isLogoRow(r) && r.col === 'auto' && typeof r.h === 'number') r.col = autoCol(r);
  return deck;
}

// what `fill` cannot reach: every row of the template that draws no key — the non-text rows (a rating ring, a chart's bars,
// a rule, a shape) and any text row templateKeys() passes over. Those carry the sample's values into the deck unless the
// agent edits the expanded rows, so the catalogue says how many of each, most value-carrying kind first.
const KIND = r => r.donut != null ? 'ring' : r.bar != null ? 'bar' : r.chart ? 'chart series' : r.svg ? 'svg'
  : (r.arrow || r.head) ? 'arrow' : (r.line || r.curve) ? 'rule' : r.h != null && !r.bg ? 'image box' : 'shape';
const KIND_ORDER = ['ring', 'bar', 'chart series', 'svg', 'image box', 'arrow', 'rule', 'shape'];
const plural = (k, n) => n === 1 || k === 'chart series' || k === 'svg' ? k : k + 's';

export function templateFixed(id) {
  const t = TEMPLATE[id]; if (!t) return null;
  const keyed = new Set(t.els.filter(fillable)), val = driven(t);   // templateKeys() draws one key per fillable row, in the same order — a scorecard cell's ring IS reachable
  const n = {};
  for (const r of t.els) if (!keyed.has(r) && !val.has(r)) n[KIND(r)] = (n[KIND(r)] || 0) + 1;
  return KIND_ORDER.filter(k => n[k]).map(k => `${n[k]} ${plural(k, n[k])}`);
}

// what the building agent reads instead of guessing: id · tier · density · note, what fill cannot reach, then every key with its sample
export function templateCatalogue() {
  const lines = [];
  for (const cat of [...new Set(TEMPLATES.map(t => t.cat))]) {
    lines.push(cat);
    for (const t of TEMPLATES.filter(t => t.cat === cat)) {
      lines.push(`  ${t.id.padEnd(22)} ${t.tier.padEnd(8)} ${t.density.padEnd(8)} ${t.note}`);
      const fixed = templateFixed(t.id);
      lines.push(`    fixed: ${fixed.length ? fixed.join(' · ') : 'none — every row fills'}`);
      for (const e of templateKeys(t.id)) lines.push(`    ${e.key.padEnd(4)} ${String(e.role).padEnd(10)} ${String(e.text).replace(/\s+/g, ' ').slice(0, 70)}`);
      for (const e of templateMedia(t.id)) lines.push(`    ${e.key.padEnd(4)} ${'media'.padEnd(10)} logo · img · icon beside ${e.on}`);
      if (SAMPLE_BOUND[t.id]) lines.push(`    sample-bound: draws ${SAMPLE_BOUND[t.id]} from its sample — fill is refused (K22)`);
      for (const v of templateVals(t.id)) lines.push(`    ${v.key.padEnd(4)} ${(v.kind === 'data' ? `${v.mark} data` : v.kind === 'logos' ? '1–4 logos' : `${v.range[0]}–${v.range[1]}`).padEnd(10)} ${v.of}${v.optional ? ' · optional: left out, the graphic drops' : ''}`);
    }
  }
  return lines.join('\n');
}
