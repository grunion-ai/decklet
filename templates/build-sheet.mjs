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
const CHART = { mark: 'bar', data: [{ label: 'Mon', value: 48 }, { label: 'Tue', value: 61 }, { label: 'Wed', value: 57 }, { label: 'Thu', value: 74 }], source: 'Front-desk log, one week' };
// sample content for the library layouts, by `layout.slot`, then by slot name, then by role. Every layout speaks
// about a different everyday subject, so the sheet reads as twenty-two slides rather than one slide repeated.
const TEXT = {
  // role / slot defaults (a layout below overrides them)
  supertitle: 'Section', title: 'A title that states the claim', body: 'Two sentences of body copy at most: what the reader should take from this slide, and why it matters now.',
  caption: 'Source · one line', label: 'the label', stat: '63%', number: '02',
  subtitle: 'One line under the title that says what the slide shows.', note: 'A note for the reader who has no speaker in the room.', source: 'Source · where the numbers came from', legend: '● this year  ● last year',
  // openers
  'cover.supertitle': 'Spring programme', 'cover.title': 'A season at the community garden', 'cover.body': 'Forty plots, a new tool shed, and the first Saturday market in June.', 'cover.caption': 'Volunteer briefing · April',
  'title.supertitle': 'Part three', 'title.title': 'The kitchen, rebuilt',
  'section.number': '04', 'section.title': 'Getting around', 'section.body': 'Trains, bikes and the three streets worth walking.',
  'content.supertitle': 'Field notes', 'content.title': 'A title over an empty canvas', 'content.subtitle': 'The rows of the slide go here; this chrome is all the layout gives.', 'content.note': 'Bind only the chrome you need.', 'content.source': 'Source · your own', 'content.legend': '',
  'agenda.supertitle': 'Today', 'agenda.title': 'Five things in thirty minutes', 'agenda.subtitle': 'Questions at the end, or in the thread afterwards.', 'agenda.note': 'Times are a guide; the third item usually runs long.', 'agenda.source': 'Agenda · team meeting, week 12', 'agenda.legend': '',
  // text
  'statement.title': 'Every long meeting is a short memo nobody wrote.', 'statement.caption': 'the thesis',
  'quote.quote': 'We planted in March, harvested in July, and ate the first tomatoes on the steps of the shed.', 'quote.attribution': 'Plot 17 · second season',
  'two-cols.supertitle': 'Housing', 'two-cols.title': 'Renting against buying in a small city', 'two-cols.subtitle': 'Ten years, one household, the same street.', 'two-cols.left': 'Renting keeps the deposit liquid and moves are cheap. The rent rises with the market and the landlord decides on the kitchen.', 'two-cols.right': 'Buying fixes the monthly cost and every repair is yours. The deposit is gone for a decade and a move costs a year of savings.', 'two-cols.note': 'Both columns assume the same commute and the same school.', 'two-cols.source': 'Source · city rent index, 2016–2026', 'two-cols.legend': '',
  'two-cols-header.supertitle': 'Sleep', 'two-cols-header.title': 'What changed when the lights went down at ten', 'two-cols-header.subtitle': 'A four-week household experiment.', 'two-cols-header.header': 'Bedtime moved an hour earlier; nothing else did.', 'two-cols-header.left': 'Mornings got easier within a week. Breakfast happened, the bus was caught, and the first hour at work stopped being lost.', 'two-cols-header.right': 'Evenings got shorter. Television dropped to one episode, reading came back, and the dishwasher ran before dinner instead of after.', 'two-cols-header.note': 'Weekends kept the old schedule and the difference showed by Monday.', 'two-cols-header.source': 'Source · a paper diary, 28 nights', 'two-cols-header.legend': '',
  'comparison.supertitle': 'Commute', 'comparison.title': 'Bike or bus for six kilometres', 'comparison.subtitle': 'Door to desk, measured over a month.', 'comparison.left-head': 'Bike', 'comparison.right-head': 'Bus', 'comparison.left': 'Twenty-two minutes, the same every day. Rain three mornings a month. Arrive awake.', 'comparison.right': 'Eighteen to forty minutes, most of it waiting. Dry. Arrive having read twelve pages.', 'comparison.note': 'The bike wins on time; the bus wins on the book.', 'comparison.source': 'Source · phone timer, 20 working days', 'comparison.legend': '',
  // numbers
  'fact.stat': '11 min', 'fact.label': 'saved on the school run by leaving at 7:50 instead of 8:00', 'fact.body': 'The lights on the ring road change at eight. Ten minutes earlier and the whole run is green.',
  'stat.supertitle': 'Library', 'stat.title': 'Most borrowed books are picked up on a Saturday', 'stat.subtitle': 'Weekend loans against the whole week.', 'stat.stat': '58%', 'stat.caption': 'of loans, Saturdays, last twelve months', 'stat.note': 'Opening on Sunday would spread the queue, not grow it.', 'stat.source': 'Source · loan desk counts, twelve months', 'stat.legend': '',
  'kpi-grid.supertitle': 'Bakery', 'kpi-grid.title': 'The first month with the second oven', 'kpi-grid.subtitle': 'Three numbers, against the month before.', 'kpi-grid.body': 'More loaves before nine, fewer sold out by noon, and the Saturday queue is gone.', 'kpi-grid.note': 'Flour cost rose in the same month and is not in these numbers.', 'kpi-grid.source': 'Source · till and oven log, March', 'kpi-grid.legend': '● March  ● February',
  'kpi-grid-4.supertitle': 'Swimming pool', 'kpi-grid-4.title': 'Summer opening, in four numbers', 'kpi-grid-4.subtitle': 'June to August, against last summer.', 'kpi-grid-4.body': 'Attendance rose with the early lane sessions; lessons filled a week after booking opened.', 'kpi-grid-4.note': 'The heatwave week is in the attendance figure.', 'kpi-grid-4.source': 'Source · turnstile counts, June–August', 'kpi-grid-4.legend': '● this summer  ● last summer',
  'chart.supertitle': 'Clinic', 'chart.title': 'Walk-in visits climb through the week', 'chart.subtitle': 'Front-desk count, Monday to Thursday.', 'chart.takeaway': 'Thursday carries half again what Monday does; the second nurse belongs on Thursday, not Monday.', 'chart.source': 'Source · front-desk log, one week', 'chart.legend': '● walk-ins',
  // diagrams
  'process-steps.supertitle': 'Recipe', 'process-steps.title': 'Sourdough in four steps and two days', 'process-steps.subtitle': 'Mix on Friday night, bake on Sunday morning.', 'process-steps.body': 'Every step is a wait; the work itself is twenty minutes across the weekend.', 'process-steps.note': 'A colder kitchen adds a few hours to the second step.', 'process-steps.source': 'Source · a well-thumbed notebook', 'process-steps.legend': '',
  'diagram.supertitle': 'Rainwater', 'diagram.title': 'From the roof to the beds', 'diagram.subtitle': 'Three parts, two hoses, no pump.', 'diagram.caption': 'The roof fills the butt; the butt feeds the beds by gravity, so the butt sits higher than the beds.', 'diagram.note': '', 'diagram.source': 'Source · the garden plan', 'diagram.legend': '',
  'timeline.supertitle': 'Renovation', 'timeline.title': 'One kitchen, four dates', 'timeline.subtitle': 'Order placed to first dinner.', 'timeline.note': 'The gap between the second and third dates is the plasterer.', 'timeline.source': 'Source · the builder\'s schedule', 'timeline.legend': '',
  // images
  'image-left.supertitle': 'Museum', 'image-left.title': 'The east gallery, reopened', 'image-left.subtitle': 'Daylight through the new roof.', 'image-left.body': 'Twelve rooms, one route, benches in every third room. The café moved to the courtyard.', 'image-left.note': 'Photographed on the opening morning.', 'image-left.source': 'Source · the museum', 'image-left.legend': '',
  'image-right.supertitle': 'Trail', 'image-right.title': 'The ridge path in October', 'image-right.subtitle': 'Eleven kilometres, one climb, one pub.', 'image-right.body': 'Start at the station, finish at the other station. The climb is in the first hour; the rest is along the top.', 'image-right.note': 'Boots, not trainers, after rain.', 'image-right.source': 'Source · a walking club', 'image-right.legend': '',
  // closers
  'cta.title': 'Come on Saturday.', 'cta.body': 'Ten till two, bring gloves. Tea is provided, cake is negotiable.', 'cta.button-label': 'Sign up for a plot',
  'end.title': 'Thank you', 'end.body': 'hello@example.org · the shed, plot 1', 'end.caption': 'Slides made with decklet · MIT',
};
const ITEMS = ['Where we are', 'What changed', 'What it cost', 'What is next', 'Questions'];
const STEPS = ['Mix the starter', 'Fold and rest', 'Shape and prove', 'Bake hot'];
const EVENTS = ['Order placed', 'Old kitchen out', 'Plaster dry', 'First dinner'];
const DATES = ['Mar', 'May', 'Jun', 'Jul'];
const KPIS = [['640', 'loaves a week'], ['3', 'sell-outs'], ['12 min', 'longest queue'], ['9', 'lane sessions']];
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
    if ((m = /^kpi(\d)-delta$/.exec(slot))) return { slot, text: ['↑ 12%', '↓ 2', '↑ 4 min', 'new'][m[1] - 1] };
    if ((m = /^kpi(\d)-label$/.exec(slot))) return { slot, text: KPIS[m[1] - 1][1] };
    if ((m = /^kpi(\d)$/.exec(slot))) return { slot, text: KPIS[m[1] - 1][0] };
    return { slot, text: TEXT[`${name}.${slot}`] ?? TEXT[slot] ?? slot };
  });
  if (name === 'diagram') {   // a figure inside the frame: three boxes, two connectors
    const box = (x, t) => ({ x, y: 250, w: 200, h: 72, box: 1, role: 'H2', text: t });
    els.push(box(80, 'Roof'), { x: 280, y: 286, line: [340, 286], h: 2.5, bg: 'var(--fg)', arrow: 'end', head: 'triangle' }, box(340, 'Water butt'), { x: 540, y: 286, line: [600, 286], h: 2.5, bg: 'var(--fg)', arrow: 'end', head: 'triangle' }, box(600, 'Beds'));
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
