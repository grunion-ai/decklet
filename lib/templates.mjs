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
// Sources: lib/templates/cat-*.mjs (the vocabulary in lib/templates/kit.mjs). Catalogue: node bin/validate.mjs --templates
import narrative from './templates/cat-narrative.mjs';
import numbers from './templates/cat-numbers.mjs';
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
import {GAP, PLATES} from './logo.mjs';
import {ICONS} from './icons.mjs';
import {initials} from './assets.mjs';
import {LIBRARY} from './layouts.mjs';

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
export const TEMPLATES = [...narrative, ...numbers, ...frameworks, ...process_, ...charts, ...modern, ...figures, ...chrome, ...density, ...quad, ...logo]
  .map(t => { const fn = typeof t.els === 'function' ? t.els : null, raw = fn ? fn(sampleVals(t)) : t.els;
    return {...t, build: fn && (v => unmark(fn(v))), els: unmark(raw), media: itemsOf(raw),
      density: t.density || (SPEAKER.has(t.id) ? 'speaker' : 'reading')}; });
export const TEMPLATE = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));
export const MEDIA_TEMPLATES = TEMPLATES.filter(t => t.media.length).map(t => t.id);

// ── per-item media (F10): `fill: {m1: {logo}, m2: {img, fit}, m3: {icon}}`. The media sits BESIDE its item's lead text, centred
// on the text's first line, GAP (the logo row's gutter) before the text; a centred lead row keeps the pair centred on its box,
// by the role's cw estimate. A logo turns the lead row into a logo row whose name is the text (docs/logo.md), so the name
// lands where the text was. Sizes are the 960 cut's: the lead role's line height, held to 20..32px, unless the item or `h` says.
const MEDIA_PROPS = {logo: ['logo', 'monogram', 'plate', 'aspect', 'col', 'h', 'alt'], img: ['img', 'fit', 'pos', 'w', 'h', 'alt'], icon: ['icon', 'color', 'h']};
const SRC = /^(data:|#)/;   // an inline data: URI, or '#id' into deck.assets (the runtime resolves it)
const FITS = ['contain', 'cover', 'fill', 'none', 'scale-down'];
const kindsOf = m => ['logo', 'img', 'icon'].filter(k => k === 'logo' ? ('logo' in m || 'monogram' in m) : k in m);
// the neutral scale (template.html's styles.roles): size, line height, cw — a deck's own roles win, read back to the 960 cut
export const NEUTRAL_ROLES = {Title: [64, 68, 0.45], Supertitle: [12, 16, 0.73], H1: [34, 40, 0.46], H2: [22, 28, 0.44], Body: [16, 24, 0.46],
  Caption: [13, 18, 0.47], Label: [11, 14, 0.69], Stat: [40, 44, 0.45]};
const metrics = (role, roles, k) => { const n = NEUTRAL_ROLES[role] || NEUTRAL_ROLES.Body, d = roles && roles[role];
  return d ? {size: (d.size ?? n[0] * k) / k, lh: (d.lh ?? (d.size ? d.size * 1.25 : n[1] * k)) / k, cw: d.cw ?? n[2]} : {size: n[0], lh: n[1], cw: n[2]}; };
const plainOf = o => String(o.text ?? o.html ?? '').replace(/<[^>]+>/g, '');
function withMedia(o, m, item, roles, k) {
  const R = metrics(o.role, roles, k), [kind] = kindsOf(m), text = plainOf(o);
  const s = m.h ?? item.h ?? Math.min(32, Math.max(20, R.lh));
  const chip = kind === 'logo' && !m.logo;   // the monogram chip is square: its column is the chip, not a wordmark's 2:1
  const mw = kind === 'icon' || chip ? (m.col ?? s) : kind === 'img' ? (m.w ?? 2 * s) : (m.col ?? 2 * s);
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
    for (const far of d.kind === 'data' ? [d.sample.map(p => ({...p, value: p.value + 1, label: p.label + '·'}))] : d.range) {
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
    if (vk && vk.kind === 'data') { for (const m of checkChart({mark: vk.mark, data: val})) out.push(`fill value "${k}": ${m}`); continue; }
    if (vk) { if (typeof val !== 'number' || !Number.isFinite(val) || val < vk.range[0] || val > vk.range[1])
      out.push(`fill value "${k}" must be a number ${vk.range[0]}..${vk.range[1]} (${vk.of}), not ${JSON.stringify(val)}`); continue; }
    const key = keys.find(e => e.key === k);
    if (!key) out.push(`fill key "${k}" is not a fill key of ${id} (${keys.map(e => e.key).join(' ')}${vals.length ? ` · values ${vals.map(e => e.key).join(' ')}` : ''}${TEMPLATE[id].media.length ? ` · media ${templateMedia(id).map(e => e.key).join(' ')}` : ''})`);
    else if (typeof val === 'number' && !key.cell) out.push(`fill key "${k}" takes text — only a scorecard cell takes a number (its 0..4 rating)`);
    else if (typeof val === 'number' && !(Number.isInteger(val) && val >= 0 && val <= 4)) out.push(`fill key "${k}": a rating is a whole number 0..4 (quarters of the ring), not ${val}`);
    else if (typeof val !== 'number' && typeof val !== 'string') out.push(`fill key "${k}" takes a string${key.cell ? ', or a 0..4 rating' : ''} — got ${typeof val}`);
  }
  if (out.length) return out;
  // K14: a text that outgrows its sample moves the rows under it down; refuse the fill that would move one off the canvas
  const t = TEMPLATE[id], {rows, grows} = fillRows(t, fill, null, 1);
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
  const vals = sampleVals(t);
  for (const key of Object.keys(vals)) if (key in fill) vals[key] = fill[key];
  let n = 0; const grows = [];
  const rows = (t.build ? t.build(vals) : t.els).map(r => {
    const o = {...r, src: r};
    if (!fillable(o)) return o;
    const key = o.key = 't' + (++n);
    if (!(key in fill)) return o;
    if (isCell(o)) return {...cell(...o.cell, fill[key]), src: r, key};
    delete o.html; o.text = fill[key];
    const g0 = geo(r, t.layout), was = textH(g0, roles, k), now = textH(geo(o, t.layout), roles, k);
    if (was != null && now > was) grows.push({key, x: g0.x, w: g0.w, foot: g0.y + was, d: now - was,
      lines: Math.round(now / metrics(g0.role || 'Body', roles, k).lh), was: Math.round(was / metrics(g0.role || 'Body', roles, k).lh), moves: new Set()});
    return o;
  });
  for (const o of rows) {
    if (o.slot || typeof o.y !== 'number') continue;
    const x0 = typeof o.x === 'number' ? o.x : 0, x1 = typeof o.w === 'number' ? x0 + o.w : o.line ? o.line[0] : x0;
    let shift = 0;
    for (const g of grows) if (o.y >= g.foot - 0.5 && Math.min(x0, x1) < g.x + g.w && Math.max(x0, x1) >= g.x) { shift += g.d; g.moves.add(o.src); }
    if (!shift) continue;
    o.y += shift; o.shift = shift;
    if (Array.isArray(o.line)) o.line = [o.line[0], o.line[1] + shift];
    if (Array.isArray(o.cell)) o.cell = [o.cell[0], o.cell[1] + shift, o.cell[2], o.cell[3]];
  }
  return {rows, grows};
}

// replace every VALID template slide with its rows; invalid ones stay for validate to report
export function expandTemplates(deck) {
  const k = (deck.w || 960) / 960;
  for (const s of deck.slides || []) {
    if (!s || typeof s !== 'object' || !s.template) continue;
    const t = TEMPLATE[s.template]; if (!t) continue;
    const fill = s.fill || {}; if (fillErrors(t.id, fill).length) continue;
    const media = Object.fromEntries(t.media.map((e, i) => [e.on, ['m' + (i + 1), e]]).filter(([, [mk]]) => mk in fill));
    const rows = scale(fillRows(t, fill, deck.styles && deck.styles.roles, k).rows.flatMap(({src, key, shift, ...o}) =>
      key && media[key] ? withMedia(o, fill[media[key][0]], media[key][1], deck.styles && deck.styles.roles, k) : [o]), k);
    s.els = [...rows, ...(Array.isArray(s.els) ? s.els : [])];
    if (t.layout && !s.layout) s.layout = t.layout;
    s.name = s.name || t.id;
    s.density = s.density || t.density;
    delete s.template; delete s.fill;
  }
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
      for (const v of templateVals(t.id)) lines.push(`    ${v.key.padEnd(4)} ${(v.kind === 'data' ? `${v.mark} data` : `${v.range[0]}–${v.range[1]}`).padEnd(10)} ${v.of}`);
    }
  }
  return lines.join('\n');
}
