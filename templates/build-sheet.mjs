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
const CHART = { mark: 'bar', data: [{ label: 'Mon', value: 48 }, { label: 'Tue', value: 61 }, { label: 'Wed', value: 57 }, { label: 'Thu', value: 74 }], source: 'Desk log, one week' };
// sample content for the library layouts, by `layout.slot`, then by slot name, then by role. Every layout speaks for one
// of the same fictional companies the templates use (Tallyline, Fieldsense, Stride, Meridian Partners, Forage, Relay),
// each about a different subject, so the sheet reads as twenty-two slides rather than one slide repeated.
const TEXT = {
  // role / slot defaults (a layout below overrides them)
  supertitle: 'Section', title: 'A title that states the claim', body: 'Two sentences of body copy at most: what the reader should take from this slide, and why it matters now.',
  caption: 'Source · one line', label: 'the label', stat: '63%', number: '02',
  subtitle: 'One line under the title that says what the slide shows.', note: 'A note for the reader who has no speaker in the room.', source: 'Source · where the numbers came from', legend: '● this year  ● last year',
  // openers
  'cover.supertitle': 'Board update', 'cover.title': 'Tallyline, third quarter', 'cover.body': 'Forty new accounts, a second data center, and the first profitable month in September.', 'cover.caption': 'Board pack · October 2026',
  'title.supertitle': 'Part three', 'title.title': 'The close, rebuilt',
  'section.number': '04', 'section.title': 'Go-to-market', 'section.body': 'Channels, pricing and the three accounts worth a visit.',
  'content.supertitle': 'Field notes', 'content.title': 'A title over an empty canvas', 'content.subtitle': 'The rows of the slide go here; this chrome is all the layout gives.', 'content.note': 'Bind only the chrome you need.', 'content.source': 'Source · your own', 'content.legend': '',
  'agenda.supertitle': 'Today', 'agenda.title': 'Five things in thirty minutes', 'agenda.subtitle': 'Questions at the end, or in the thread afterwards.', 'agenda.note': 'Times are a guide; the third item usually runs long.', 'agenda.source': 'Agenda · product review, week 12', 'agenda.legend': '',
  // text
  'statement.title': 'Every long meeting is a short memo nobody wrote.', 'statement.caption': 'the thesis',
  'quote.quote': 'We cut our produce bill by a fifth and the kitchen stopped calling six suppliers every morning.', 'quote.attribution': 'Head chef · Harbor Hotels',
  'two-cols.supertitle': 'Pricing', 'two-cols.title': 'Usage pricing against a flat seat', 'two-cols.subtitle': 'Two years, one account, the same product.', 'two-cols.left': 'Usage pricing keeps the entry cheap and small teams sign up on a card. The bill rises with traffic and finance cannot forecast it.', 'two-cols.right': 'A flat seat fixes the monthly cost and every spike is free. Small teams balk at the floor and a quiet quarter is paid for anyway.', 'two-cols.note': 'Both columns assume the same support tier and the same contract term.', 'two-cols.source': 'Source · billing data, 2024–2026', 'two-cols.legend': '',
  'two-cols-header.supertitle': 'Retention', 'two-cols-header.title': 'What changed when the reminder moved to 7 pm', 'two-cols-header.subtitle': 'A four-week product experiment.', 'two-cols-header.header': 'The reminder moved from 7 am to 7 pm; nothing else did.', 'two-cols-header.left': 'Morning runs held. The runners who left were the ones who never ran before work, and they now plan the night before.', 'two-cols-header.right': 'Evening runs rose within a week. Second-week retention climbed four points and the support inbox lost its notifications thread.', 'two-cols-header.note': 'The control group kept the morning reminder and the gap held through week four.', 'two-cols-header.source': 'Source · product analytics, 28 days', 'two-cols-header.legend': '',
  'comparison.supertitle': 'Connectivity', 'comparison.title': 'Cellular or radio for the field', 'comparison.subtitle': 'Sensor to dashboard, measured over a month.', 'comparison.left-head': 'Cellular', 'comparison.right-head': 'Radio', 'comparison.left': 'Two-minute readings, the same every day. Dead zones on three farms in ten. A SIM fee per unit.', 'comparison.right': 'Fifteen-minute readings, most of the delay at the gateway. No dead zones. One gateway per site.', 'comparison.note': 'Cellular wins on cadence; radio wins on cost.', 'comparison.source': 'Source · field trial, 20 sites', 'comparison.legend': '',
  // numbers
  'fact.stat': '4 days', 'fact.label': 'saved on the month-end close by matching payments on arrival', 'fact.body': 'The bank feed posts overnight. Matching it the same morning clears the queue before the close begins.',
  'stat.supertitle': 'Activity', 'stat.title': 'Most runs are logged on a Saturday', 'stat.subtitle': 'Weekend runs against the whole week.', 'stat.stat': '58%', 'stat.caption': 'of runs, Saturdays, last twelve months', 'stat.note': 'A Sunday challenge spreads the load across the weekend.', 'stat.source': 'Source · activity log, twelve months', 'stat.legend': '',
  'kpi-grid.supertitle': 'Dispatch', 'kpi-grid.title': 'The first month with the second hub', 'kpi-grid.subtitle': 'Three numbers, against the month before.', 'kpi-grid.body': 'More orders out before nine, fewer late runs, and the Saturday backlog is gone.', 'kpi-grid.note': 'Fuel cost rose in the same month and is outside these numbers.', 'kpi-grid.source': 'Source · dispatch log, March', 'kpi-grid.legend': '● March  ● February',
  'kpi-grid-4.supertitle': 'Platform', 'kpi-grid-4.title': 'The quarter, in four numbers', 'kpi-grid-4.subtitle': 'July to September, against last quarter.', 'kpi-grid-4.body': 'Events rose with the payments launch; the new region filled a week after it opened.', 'kpi-grid-4.note': 'The outage week is in the availability figure.', 'kpi-grid-4.source': 'Source · platform metrics, Q3', 'kpi-grid-4.legend': '● this quarter  ● last quarter',
  'chart.supertitle': 'Support desk', 'chart.title': 'Tickets climb through the week', 'chart.subtitle': 'Desk count, Monday to Thursday.', 'chart.takeaway': 'Thursday carries half again what Monday does; the second analyst belongs on Thursday.', 'chart.source': 'Source · desk log, one week', 'chart.legend': '● tickets',
  // diagrams
  'process-steps.supertitle': 'Engagement', 'process-steps.title': 'An engagement in four steps and six weeks', 'process-steps.subtitle': 'Kickoff on a Monday, handover six weeks later.', 'process-steps.body': 'Every step ends in a written decision; the work between them belongs to the client\'s own team.', 'process-steps.note': 'A larger team adds a week to the second step.', 'process-steps.source': 'Source · the engagement plan', 'process-steps.legend': '',
  'diagram.supertitle': 'Architecture', 'diagram.title': 'From the sensor to the dashboard', 'diagram.subtitle': 'Three parts, one radio link, no wiring.', 'diagram.caption': 'The sensor reports to the gateway; the gateway posts to the cloud, so the gateway takes the only power outlet.', 'diagram.note': '', 'diagram.source': 'Source · the system diagram', 'diagram.legend': '',
  'timeline.supertitle': 'Launch', 'timeline.title': 'One release, four dates', 'timeline.subtitle': 'Code freeze to store listing.', 'timeline.note': 'The gap between the second and third dates is the app review.', 'timeline.source': 'Source · the release plan', 'timeline.legend': '',
  // images
  'image-left.supertitle': 'Hardware', 'image-left.title': 'The second-generation gateway', 'image-left.subtitle': 'Solar top-up, one radio, no cables.', 'image-left.body': 'Twelve sensors per gateway, one gateway per site, mounted in twenty minutes. The battery lasts a season.', 'image-left.note': 'Photographed on the first install.', 'image-left.source': 'Source · Fieldsense', 'image-left.legend': '',
  'image-right.supertitle': 'Route', 'image-right.title': 'The morning run in October', 'image-right.subtitle': 'Eleven stops, one hub, one driver.', 'image-right.body': 'Start at the hub, finish at the hub. The hotels are in the first hour; the rest is restaurants along the waterfront.', 'image-right.note': 'Chilled van, dock access before seven.', 'image-right.source': 'Source · dispatch', 'image-right.legend': '',
  // closers
  'cta.title': 'Start on a Monday.', 'cta.body': 'Two weeks inside your team and one written plan at the end.', 'cta.button-label': 'Book a working session',
  'end.title': 'Thank you', 'end.body': 'hello@example.com · Meridian Partners', 'end.caption': 'Slides made with decklet · MIT',
};
const ITEMS = ['Where we are', 'What shipped', 'What it cost', 'What is next', 'Questions'];
const STEPS = ['Kickoff', 'Discover', 'Design', 'Hand over'];
const EVENTS = ['Code freeze', 'Beta out', 'Review passed', 'In the store'];
const DATES = ['Mar', 'May', 'Jun', 'Jul'];
const KPIS = {   // per layout, so the two grids speak for two companies
  'kpi-grid': [['640', 'orders a week'], ['3', 'late runs'], ['12 min', 'longest wait'], ['9', 'routes']],
  'kpi-grid-4': [['40M', 'events'], ['99.98%', 'delivered'], ['84 ms', 'median latency'], ['3', 'regions']],
};
const DELTAS = { 'kpi-grid': ['↑ 12%', '↓ 2', '↑ 4 min', 'new'], 'kpi-grid-4': ['↑ 12%', '↑ 0.01', '↓ 6 ms', '+1'] };
const fill = (name) => {
  const lay = LIBRARY[name];
  const els = Object.entries(lay.slots).filter(([slot]) => TEXT[`${name}.${slot}`] !== '').map(([slot, sl]) => {
    if (slot === 'image') return { slot, img: IMG, fit: 'cover' };
    if (slot === 'chart') return { slot, chart: CHART };
    if (!sl.role) return { slot };                                        // paint: the slot carries it
    let m;
    if ((m = /^n(\d)$/.exec(slot))) return { slot, text: '0' + m[1] };
    if ((m = /^item(\d)$/.exec(slot))) return { slot, text: ITEMS[m[1] - 1] };
    if ((m = /^step(\d)$/.exec(slot))) return { slot, text: STEPS[m[1] - 1] };
    if ((m = /^t(\d)$/.exec(slot))) return { slot, text: DATES[m[1] - 1] };
    if ((m = /^e(\d)$/.exec(slot))) return { slot, text: EVENTS[m[1] - 1] };
    if ((m = /^kpi(\d)-delta$/.exec(slot))) return { slot, text: DELTAS[name][m[1] - 1] };
    if ((m = /^kpi(\d)-label$/.exec(slot))) return { slot, text: KPIS[name][m[1] - 1][1] };
    if ((m = /^kpi(\d)$/.exec(slot))) return { slot, text: KPIS[name][m[1] - 1][0] };
    return { slot, text: TEXT[`${name}.${slot}`] ?? TEXT[slot] ?? slot };
  });
  if (name === 'diagram') {   // a figure inside the frame: three boxes, two connectors
    const box = (x, t) => ({ x, y: 250, w: 200, h: 72, box: 1, role: 'H2', text: t });
    els.push(box(80, 'Sensor'), { x: 280, y: 286, line: [340, 286], h: 2.5, bg: 'var(--fg)', arrow: 'end', head: 'triangle' }, box(340, 'Gateway'), { x: 540, y: 286, line: [600, 286], h: 2.5, bg: 'var(--fg)', arrow: 'end', head: 'triangle' }, box(600, 'Dashboard'));
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
  spell: { ignore: ['tallyline', 'fieldsense'] },   // the invented company names; every other word is in the dictionary
  // `title` and `content` come from the library (the templates were cut on the same geometry)
  master: [ { id: 'foot', footer: 1, x: 60, y: 506, w: 340, role: 'Label', text: 'decklet library' } ],
  slides,
};
fs.writeFileSync(path.join(dir, 'candidates.model.json'), JSON.stringify(model, null, 1));
fs.writeFileSync(path.join(dir, 'candidates.index.json'), JSON.stringify(index, null, 1));
console.log(`${index.length} library slides (${index.filter(r => r.source === 'template').length} templates + ${index.filter(r => r.source === 'layout').length} layouts) in ${KINDS.length} kinds → templates/candidates.model.json`);
