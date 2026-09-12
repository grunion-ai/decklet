// decklet template library — 71 finished slides that ship in the engine (59 candidates, the ten figures, and the starting rungs). A template is a layout PLUS sample rows: the
// candidate sheet (templates/candidates.html) surveyed across the open-source slide catalogs, reviewed on
// 2026-09-07 and promoted whole. A slide names one — `{template:'three-up-cards', fill:{t2:'Three things, one price.'}}` — and
// create() expands it into the ordinary rows it stands for (like a chart row), scaled from the 960×540 cut to the canvas.
// Every text row of a template is a key, t1..tn in row order; `fill` replaces the sample text by key; free `els` on the
// slide follow the template rows. The template's chrome (`content` / `title`) is a library layout the deck may redefine.
// Sources: lib/templates/cat-*.mjs (the vocabulary in lib/templates/kit.mjs). Catalogue: node bin/validate.mjs --templates
import narrative from './templates/cat-narrative.mjs';
import numbers from './templates/cat-numbers.mjs';
import frameworks from './templates/cat-frameworks.mjs';
import process_ from './templates/cat-process.mjs';
import charts from './templates/cat-charts.mjs';
import modern from './templates/cat-modern.mjs';
import figures from './templates/cat-figures.mjs';
import {scale, cell} from './templates/kit.mjs';

// density per template: speaker (fluffy) when the sample carries ≤ 3 points, reading (dense) otherwise — see DENSITY in layouts.mjs
const SPEAKER = new Set(['cover-hero', 'cover-split', 'section-numeral', 'quote-pull', 'statement', 'closing-cta', 'stat-hero', 'delta-pair',
  'chart-donut', 'chart-gauge', 'chart-flow-split', 'image-hero-overlay', 'image-split']);   // a four-node cycle and a three-branch tree count 4+ points: reading
export const TEMPLATES = [...narrative, ...numbers, ...frameworks, ...process_, ...charts, ...modern, ...figures]
  .map(t => ({...t, density: t.density || (SPEAKER.has(t.id) ? 'speaker' : 'reading')}));
export const TEMPLATE = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));
const isText = r => r.text != null || r.html != null;
const isCell = r => Array.isArray(r.cell);   // a scorecard cell: one key, whether the sample draws text or a rating ring
const fillable = r => isText(r) || isCell(r);

// the fill contract of one template: [{key, role, text}] — t1..tn over the rows a key reaches, in row order. A cell also
// carries `cell: true`: its key takes short text OR a 0..4 rating (validate checks the range).
export function templateKeys(id) {
  const t = TEMPLATE[id]; if (!t) return null;
  let n = 0;
  return t.els.filter(fillable).map(r => ({key: 't' + (++n), ...(isCell(r) ? {cell: true} : {}),
    role: isCell(r) ? 'Cell' : r.role || (r.slot ? r.slot === 'supertitle' ? 'Supertitle' : r.slot === 'title' ? (t.layout === 'title' ? 'Title' : 'H1') : r.slot : 'Body'),
    text: isText(r) ? r.text ?? r.html : `rating ${r.donut / 25} of 4`}));
}

// what a slide's `fill` gets wrong, one message each — empty when it is good. expandTemplates refuses a bad fill (the
// slide keeps its `template`, so validate reports it on the model the agent wrote), and validate prints this same list.
export function fillErrors(id, fill = {}) {
  const keys = templateKeys(id); if (!keys) return [];
  const out = [];
  for (const [k, val] of Object.entries(fill)) {
    const key = keys.find(e => e.key === k);
    if (!key) out.push(`fill key "${k}" is not a fill key of ${id} (${keys.map(e => e.key).join(' ')})`);
    else if (typeof val === 'number' && !key.cell) out.push(`fill key "${k}" takes text — only a scorecard cell takes a number (its 0..4 rating)`);
    else if (typeof val === 'number' && !(Number.isInteger(val) && val >= 0 && val <= 4)) out.push(`fill key "${k}": a rating is a whole number 0..4 (quarters of the ring), not ${val}`);
    else if (typeof val !== 'number' && typeof val !== 'string') out.push(`fill key "${k}" takes a string${key.cell ? ', or a 0..4 rating' : ''} — got ${typeof val}`);
  }
  return out;
}

// replace every VALID template slide with its rows; invalid ones stay for validate to report
export function expandTemplates(deck) {
  const k = (deck.w || 960) / 960;
  for (const s of deck.slides || []) {
    if (!s || typeof s !== 'object' || !s.template) continue;
    const t = TEMPLATE[s.template]; if (!t) continue;
    const fill = s.fill || {}; if (fillErrors(t.id, fill).length) continue;
    let n = 0;
    const rows = scale(t.els.map(r => {
      const o = {...r};
      if (!fillable(o)) return o;
      const key = 't' + (++n); if (!(key in fill)) return o;
      if (isCell(o)) return cell(...o.cell, fill[key]);   // a number redraws the ring, a string writes text in its place
      delete o.html; o.text = fill[key]; return o;
    }), k);
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
  const keyed = new Set(t.els.filter(fillable));   // templateKeys() draws one key per fillable row, in the same order — a scorecard cell's ring IS reachable
  const n = {};
  for (const r of t.els) if (!keyed.has(r)) n[KIND(r)] = (n[KIND(r)] || 0) + 1;
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
    }
  }
  return lines.join('\n');
}
