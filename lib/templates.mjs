// decklet template library — 58 finished slides that ship in the engine. A template is a layout PLUS sample rows: the
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
import {scale} from './templates/kit.mjs';

// density per template: speaker (fluffy) when the sample carries ≤ 3 points, reading (dense) otherwise — see DENSITY in layouts.mjs
const SPEAKER = new Set(['cover-hero', 'cover-split', 'section-numeral', 'quote-pull', 'statement', 'closing-cta', 'stat-hero', 'delta-pair',
  'chart-donut', 'chart-gauge', 'chart-flow-split', 'image-hero-overlay', 'image-split']);   // a four-node cycle and a three-branch tree count 4+ points: reading
export const TEMPLATES = [...narrative, ...numbers, ...frameworks, ...process_, ...charts, ...modern]
  .map(t => ({...t, density: t.density || (SPEAKER.has(t.id) ? 'speaker' : 'reading')}));
export const TEMPLATE = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));
const isText = r => r.text != null || r.html != null;

// the fill contract of one template: [{key, role, text}] — t1..tn over the rows that carry text, in row order
export function templateKeys(id) {
  const t = TEMPLATE[id]; if (!t) return null;
  let n = 0;
  return t.els.filter(isText).map(r => ({key: 't' + (++n), role: r.role || (r.slot ? r.slot === 'supertitle' ? 'Supertitle' : r.slot === 'title' ? (t.layout === 'title' ? 'Title' : 'H1') : r.slot : 'Body'), text: r.text ?? r.html}));
}

// replace every VALID template slide with its rows; invalid ones stay for validate to report
export function expandTemplates(deck) {
  const k = (deck.w || 960) / 960;
  for (const s of deck.slides || []) {
    if (!s || typeof s !== 'object' || !s.template) continue;
    const t = TEMPLATE[s.template]; if (!t) continue;
    const fill = s.fill || {}; if (Object.keys(fill).some(key => !templateKeys(t.id).some(e => e.key === key))) continue;
    let n = 0;
    const rows = scale(t.els.map(r => { const o = {...r}; if (isText(o)) { const key = 't' + (++n); if (key in fill) { delete o.html; o.text = fill[key]; } } return o; }), k);
    s.els = [...rows, ...(Array.isArray(s.els) ? s.els : [])];
    if (t.layout && !s.layout) s.layout = t.layout;
    s.name = s.name || t.id;
    s.density = s.density || t.density;
    delete s.template; delete s.fill;
  }
  return deck;
}

// what the building agent reads instead of guessing: id · tier · density · category · note, then every key with its sample
export function templateCatalogue() {
  const lines = [];
  for (const cat of [...new Set(TEMPLATES.map(t => t.cat))]) {
    lines.push(cat);
    for (const t of TEMPLATES.filter(t => t.cat === cat)) {
      lines.push(`  ${t.id.padEnd(22)} ${t.tier.padEnd(8)} ${t.density.padEnd(8)} ${t.note}`);
      for (const e of templateKeys(t.id)) lines.push(`    ${e.key.padEnd(4)} ${String(e.role).padEnd(10)} ${String(e.text).replace(/\s+/g, ' ').slice(0, 70)}`);
    }
  }
  return lines.join('\n');
}
