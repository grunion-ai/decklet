#!/usr/bin/env node
// build-sheet.mjs — the whole slide library for review: every template AND every library layout as one slide,
// organised by the kind of slide it is (title & section, agenda, concept, quote, data, diagram & process,
// timeline, image, end). A divider opens each kind; the footer names the source of each slide (template · id / layout · id).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES } from './index.mjs';
import { LIBRARY } from '../lib/layouts.mjs';
import { scale } from '../lib/templates/kit.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;

// ── the kinds, in deck order, and which template / layout ids belong to each
export const KINDS = [
  { id: 'title', name: 'Title & section', note: 'Covers, dividers and the bare title chrome.',
    templates: ['cover-hero', 'cover-split', 'section-numeral'], layouts: ['cover', 'title', 'section', 'content'] },
  { id: 'agenda', name: 'Agenda', note: 'What the deck covers.', templates: ['agenda-ruled'], layouts: ['agenda'] },
  { id: 'concept', name: 'Concept', note: 'Claims, comparisons, frameworks, cards: the slide that carries an argument.',
    templates: ['exec-summary', 'statement', 'three-up-cards', 'bento-grid', 'two-col-compare', 'pros-cons', 'benchmark-table', 'harvey-balls', 'two-by-two', 'swot', 'temple', 'venn-3', 'pyramid-layers', 'value-chain', 'table-insight', 'proof-strip', 'team-grid'],
    layouts: ['statement', 'two-cols', 'two-cols-header', 'comparison'] },
  { id: 'quote', name: 'Quote', note: 'Someone else\'s words at display size.', templates: ['quote-pull'], layouts: ['quote'] },
  { id: 'data', name: 'Data', note: 'Numbers, KPIs and every chart.',
    templates: ['stat-hero', 'stat-row-4', 'kpi-scorecard', 'stat-plus-chart', 'delta-pair', 'progress-tracker', 'dashboard-composite',
      'chart-column', 'chart-bar-ranked', 'chart-stacked-100', 'chart-grouped', 'chart-line-trend', 'chart-area-band', 'chart-waterfall', 'chart-donut', 'chart-donut-row', 'chart-gauge', 'chart-scatter', 'chart-heatmap', 'chart-histogram', 'chart-slope', 'chart-dumbbell', 'chart-small-multiples', 'chart-marimekko', 'chart-pareto', 'chart-flow-split'],
    layouts: ['fact', 'stat', 'kpi-grid', 'kpi-grid-4', 'chart'] },
  { id: 'process', name: 'Diagram & process', note: 'Steps, flows, cycles, funnels and free figures.',
    templates: ['process-flow-4', 'vertical-steps', 'cycle-loop', 'funnel-stages'], layouts: ['process-steps', 'diagram'] },
  { id: 'timeline', name: 'Timeline', note: 'Dated events on a spine, lanes on a month grid.', templates: ['timeline-horizontal', 'gantt-lanes'], layouts: ['timeline'] },
  { id: 'image', name: 'Image', note: 'A photo or a screenshot carries the slide.', templates: ['image-hero-overlay', 'image-split', 'annotated-shot'], layouts: ['image-left', 'image-right'] },
  { id: 'end', name: 'End', note: 'The ask, then thanks.', templates: ['closing-cta'], layouts: ['cta', 'end'] },
];
// every template and every layout is placed exactly once
const placedT = KINDS.flatMap(k => k.templates), placedL = KINDS.flatMap(k => k.layouts);
for (const t of TEMPLATES) if (!placedT.includes(t.id)) throw new Error(`template ${t.id} has no kind`);
for (const n of Object.keys(LIBRARY)) if (!placedL.includes(n) && LIBRARY[n].group !== 'modern') throw new Error(`layout ${n} has no kind`);   // the modern nine review as their templates
for (const id of placedT) if (!TEMPLATES.some(t => t.id === id)) throw new Error(`kind names unknown template ${id}`);
for (const n of placedL) if (!LIBRARY[n]) throw new Error(`kind names unknown layout ${n}`);

// ── sample content for the library layouts: one bound row per slot, by slot name, then by role
const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5B9CF6"/><stop offset="1" stop-color="#1E3A8A"/></linearGradient></defs><rect width="4" height="3" fill="url(#g)"/></svg>');
const CHART = { mark: 'bar', data: [{ label: 'Q1', value: 62 }, { label: 'Q2', value: 71 }, { label: 'Q3', value: 78 }, { label: 'Q4', value: 92 }], source: 'Ledger, FY26' };
const TEXT = {   // by slot name; the layout id can override with `id.slot`
  supertitle: 'Section', title: 'A title that states the claim', body: 'Two sentences of body copy at most: what the reader should take from this slide, and why it matters now.',
  caption: 'Source · one line', label: 'the label', stat: '63%', quote: 'We stopped reconciling by hand in week two. That was the whole business case.', attribution: 'Head of Ops · 40-truck fleet',
  header: 'One spanning lede above two columns.', left: 'The left column: three short lines that hold up the claim on their own.', right: 'The right column: the counterpoint, or the second half of the argument.',
  'left-head': 'Option A', 'right-head': 'Option B', takeaway: 'Every quarter beat the one before it; the Q4 step is the pricing change.', source: 'Source · ledger, FY26',
  number: '02', 'button-label': 'Book the pilot',
  subtitle: 'The claim in one line under the title.', note: 'What to make of it: the note a reader gets without a speaker in the room.', legend: '● plan  ● actual',
  'cover.supertitle': 'decklet · library', 'cover.title': 'Every slide the engine knows', 'cover.body': 'Fifty-eight templates and twenty-two layouts, one per slide, grouped by the kind of slide it is.', 'cover.caption': 'Grunion · September 2026',
  'title.supertitle': 'Chapter two', 'title.title': 'Display-title chrome',
  'section.title': 'Where the money goes', 'section.body': 'Unit economics, channel by channel.',
  'content.title': 'Title chrome, the canvas free', 'content.supertitle': 'Content',
  'statement.title': 'Every deck is a spreadsheet that gave up.', 'statement.caption': 'the thesis',
  'fact.label': 'of renewals close before the deadline', 'fact.body': 'Retention is worth 3.4× a new logo at current CAC.',
  'stat.title': 'Renewals decide the year', 'stat.caption': 'renewed before the deadline, FY26',
  'cta.title': 'Ready when you are.', 'cta.body': 'Reply to this thread and we start on a Monday.',
  'end.title': 'Thank you', 'end.body': 'hello@grunion.ai · grunion.ai', 'end.caption': 'decklet is MIT — github.com/grunion-ai/decklet',
  'agenda.title': 'Four things, twenty minutes.', 'kpi-grid.title': 'Three numbers that moved', 'kpi-grid-4.title': 'Four numbers that moved',
  'chart.title': 'Revenue stepped up every quarter', 'comparison.title': 'Build or buy', 'two-cols.title': 'Two columns, one title', 'two-cols-header.title': 'A lede over two columns',
  'process-steps.title': 'Four steps from packet to terms', 'diagram.title': 'One figure, one claim', 'diagram.caption': 'The parser feeds the grader; the grader feeds the terms.',
  'timeline.title': 'The year in four dates', 'image-left.title': 'The product, in one screen', 'image-right.title': 'What the reviewer sees',
};
const ITEMS = ['Where we are', 'What broke', 'The fix', 'What we need', 'Questions'];
const STEPS = ['Drop the packet', 'Parse every statement', 'Grade the terms', 'Send the offer'];
const EVENTS = ['Pilot signed', 'First packet', 'Ten funders live', 'Renewal'];
const DATES = ['Jan', 'Apr', 'Jul', 'Oct'];
const KPIS = [['63%', 'renewed'], ['41', 'days early'], ['$1.2M', 'retained ARR'], ['2.4%', 'churn']];
const fill = (name) => {
  const lay = LIBRARY[name];
  const els = Object.entries(lay.slots).map(([slot, sl]) => {
    if (slot === 'image') return { slot, img: IMG, fit: 'cover' };
    if (slot === 'chart') return { slot, chart: CHART };
    if (!sl.role) return { slot };                                        // paint: the slot carries it
    let m;
    if ((m = /^n(\d)$/.exec(slot))) return { slot, text: '0' + m[1] };
    if ((m = /^item(\d)$/.exec(slot))) return { slot, text: ITEMS[m[1] - 1] };
    if ((m = /^step(\d)$/.exec(slot))) return { slot, text: STEPS[m[1] - 1] };
    if ((m = /^t(\d)$/.exec(slot))) return { slot, text: DATES[m[1] - 1] };
    if ((m = /^e(\d)$/.exec(slot))) return { slot, text: EVENTS[m[1] - 1] };
    if ((m = /^kpi(\d)-delta$/.exec(slot))) return { slot, text: '↑ ' + (m[1] * 3) + ' pts' };
    if ((m = /^kpi(\d)-label$/.exec(slot))) return { slot, text: KPIS[m[1] - 1][1] };
    if ((m = /^kpi(\d)$/.exec(slot))) return { slot, text: KPIS[m[1] - 1][0] };
    return { slot, text: TEXT[`${name}.${slot}`] ?? TEXT[slot] ?? slot };
  });
  if (name === 'diagram') {   // a figure inside the frame: three boxes, two connectors
    const box = (x, t) => ({ x, y: 250, w: 200, h: 72, box: 1, role: 'H2', text: t });
    els.push(box(80, 'Packet'), { x: 280, y: 286, line: [340, 286], h: 2.5, bg: 'var(--fg)', arrow: 'end', head: 'triangle' }, box(340, 'Parser'), { x: 540, y: 286, line: [600, 286], h: 2.5, bg: 'var(--fg)', arrow: 'end', head: 'triangle' }, box(600, 'Terms'));
  }
  if (name === 'cta') for (const e of els) if (e.slot === 'button' || e.slot === 'button-label') e.href = 'https://example.com';
  return els;
};

// ── the deck
const divider = (k, i) => ({ name: `kind-${k.id}`, layout: 'title', els: [{ slot: 'supertitle', text: `${String(i + 1).padStart(2, '0')} · ${k.templates.length + k.layouts.length} slides` }, { slot: 'title', text: k.name }, { x: 60, y: 400, w: 700, role: 'Body', color: 'var(--muted)', text: k.note }] });
const tslide = (t) => ({ name: t.id, layout: t.layout || undefined, hide: t.layout ? undefined : ['foot'], els: [...scale(t.els, 1), ...(t.layout ? [{ override: 'foot', text: `template · ${t.id}` }] : [])] });
const lslide = (n) => ({ name: `layout-${n}`, layout: n, hide: n === 'image-hero-overlay' ? ['foot'] : undefined, els: [...fill(n), { override: 'foot', text: `layout · ${n}` }] });
const index = [];
const slides = [];
for (const [i, k] of KINDS.entries()) {
  const ts = TEMPLATES.filter(t => k.templates.includes(t.id) && (!only || only.includes(t.id)));
  const ls = k.layouts.filter(n => !only || only.includes(n));
  if (!ts.length && !ls.length) continue;
  slides.push(divider(k, i));
  for (const t of ts) { slides.push(tslide(t)); index.push({ kind: k.id, source: 'template', id: t.id, name: t.name, tier: t.tier, cat: t.cat, note: t.note }); }
  for (const n of ls) { slides.push(lslide(n)); index.push({ kind: k.id, source: 'layout', id: n, name: `Layout — ${n}`, tier: 'library', cat: LIBRARY[n].group, note: LIBRARY[n].use }); }
}
const model = {
  title: 'decklet slide library',
  w: 960, h: 540,
  styles: { margin: 60 },
  // `title` and `content` come from the library (the templates were cut on the same geometry)
  master: [ { id: 'foot', footer: 1, x: 60, y: 506, w: 340, role: 'Label', text: 'decklet library' } ],
  slides,
};
fs.writeFileSync(path.join(dir, 'candidates.model.json'), JSON.stringify(model, null, 1));
fs.writeFileSync(path.join(dir, 'candidates.index.json'), JSON.stringify(index, null, 1));
console.log(`${index.length} library slides (${index.filter(r => r.source === 'template').length} templates + ${index.filter(r => r.source === 'layout').length} layouts) in ${KINDS.length} kinds → templates/candidates.model.json`);
