// decklet template library gate — the 58 candidates plus the nine figures ship in the engine as `template:` slides. A template is a finished
// slide's rows with sample content; the deck names one, fills its text keys, and create() expands it into ordinary
// rows (like a chart row). Nothing here is a fence: a template slide may add free rows, and every template validates
// with zero errors under the neutral scale.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {TEMPLATES, TEMPLATE, templateKeys, templateFixed, expandTemplates, templateCatalogue} from '../lib/templates.mjs';
import {RING} from '../lib/templates/kit.mjs';
import {LIBRARY} from '../lib/layouts.mjs';
import {diagramLayout} from '../lib/diagram.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const v = m => validate(create(m).deck);   // validate what create() judges: the neutral roles filled in
const deck = (slides, extra = {}) => ({w: 960, h: 540, title: 'tpl', ...extra, slides});

test('templates: 109 ship, every id unique, every one names a tier, a category and a density', () => {
  assert.equal(TEMPLATES.length, 109);
  assert.equal(new Set(TEMPLATES.map(t => t.id)).size, 109);
  for (const t of TEMPLATES) {
    assert.ok(['core', 'standard', 'fringe'].includes(t.tier), t.id + ' tier');
    assert.ok(t.cat && t.note, t.id + ' cat + note');
    assert.ok(['speaker', 'reading'].includes(t.density), t.id + ' density');
    assert.equal(TEMPLATE[t.id], t);
  }
});

test('templates: the chrome layouts the templates bind (content, title) are in the layout library', () => {
  assert.ok(LIBRARY.content && LIBRARY.content.slots.supertitle && LIBRARY.content.slots.title, 'content');
  assert.ok(LIBRARY.title && LIBRARY.title.slots.title, 'title');
});

test('templates: keys — every text row gets t1..tn in row order; the catalogue prints each with its sample', () => {
  const k = templateKeys('three-up-cards');
  assert.ok(k.length >= 5, 'three cards carry a number, a head and a body each');
  assert.equal(k[0].key, 't1');
  assert.ok(k.every((e, i) => e.key === 't' + (i + 1) && typeof e.text === 'string' && e.role), 'ordered, sampled, roled');
  const cat = templateCatalogue();
  assert.match(cat, /three-up-cards/); assert.match(cat, /t1/); assert.match(cat, /Three things, priced as one\./);
  for (const t of TEMPLATES) assert.match(cat, new RegExp(t.id.replace(/[-]/g, '\\-')), t.id + ' in the catalogue');
});

// U2.1 — a template reads as fully fillable until the catalogue says which rows carry the sample's values
test('templates: the catalogue names the rows fill cannot reach, per template', () => {
  assert.deepEqual(templateFixed('harvey-balls'), ['4 rules'], 'the twelve balls are value keys since U4.1 — only the rules are fixed');
  assert.deepEqual(templateFixed('progress-tracker'), ['4 shapes'], 'the bar fills follow p1…p4; the tracks behind them are fixed');
  assert.deepEqual(templateFixed('statement'), [], 'a text-only template has nothing fixed');
  assert.ok(templateFixed('stat-plus-chart').some(s => /bars?$/.test(s)), 'a template whose series is literal names its bars');
  assert.deepEqual(templateFixed('chart-column'), [], 'a chart template whose series is a `data` key has nothing fixed (U4.2)');
  assert.equal(templateFixed('no-such'), null);
  assert.deepEqual(templateFixed('scorecard-grid'), ['5 rules'], 'a cell\'s rating ring is a key, so only the rules are fixed');
  const cat = templateCatalogue();
  for (const t of TEMPLATES) {
    const fixed = templateFixed(t.id);
    const counted = fixed.reduce((n, s) => n + Number(s.split(' ')[0]), 0), unkeyed = t.els.length - templateKeys(t.id).length;
    if (t.vals) assert.ok(counted < unkeyed, t.id + ': the rows a value key drives are not counted as fixed');   // U4
    else assert.equal(counted, unkeyed, t.id + ': every row a key does not reach is counted');
    assert.ok(cat.includes('    fixed: ' + (fixed.length ? fixed.join(' · ') : 'none — every row fills')), t.id + ' fixed line');
  }
  assert.match(cat, /^ {4}fixed: none — every row fills$/m, 'a fully fillable template says so');
});

test('templates: expand — a template slide becomes the template rows, fill overrides by key, free rows are kept after', () => {
  const d = deck([{template: 'three-up-cards', fill: {t2: 'Three things, one price.'}, els: [{x: 60, y: 480, w: 800, role: 'Caption', text: 'free row'}]}]);
  expandTemplates(d);
  const s = d.slides[0];
  assert.equal(s.template, undefined, 'consumed');
  assert.equal(s.layout, 'content', 'the template\'s chrome layout');
  assert.equal(s.els.at(-1).text, 'free row', 'free rows follow the template rows');
  const texts = s.els.filter(e => e.text != null).map(e => e.text);
  assert.ok(texts.includes('Three things, one price.'), 'fill replaced t2');
  assert.ok(!texts.includes('Three things, priced as one.'), 'the sample is gone');
  assert.ok(s.els.some(e => e.line), 'the paint rows came along');
});

test('templates: expand scales the 960×540 cut to the canvas', () => {
  const d = deck([{template: 'stat-hero'}], {w: 1600, h: 900});
  expandTemplates(d);
  const xs = d.slides[0].els.filter(e => typeof e.x === 'number').map(e => e.x);
  assert.ok(xs.every(x => x >= 100 || x === 0), 'x scaled by 1.667: ' + xs.join(','));
  assert.ok(!d.slides[0].els.some(e => e.x === 60), 'no unscaled margin');
});

// a template whose sample carries a stand-in mark is a draft until the mark is replaced — that is the guard, not a defect
const hasStandIn = t => t.els.some(r => r.placeholder != null);

test('templates: every template validates with zero errors under the neutral scale, and creates', () => {
  for (const t of TEMPLATES) {
    const r = v(deck([{template: t.id}], hasStandIn(t) ? {draft: 1} : {}));
    assert.deepEqual(r.errors, [], t.id + ': ' + r.errors.join(' | '));
    const {html} = create(deck([{template: t.id}], hasStandIn(t) ? {draft: 1} : {}));
    assert.ok(html.includes('/*DECK*/'), t.id + ' creates');
  }
});

// ── U5.3 / U5.4: the block-arrow flow at three lengths, and a stats page a presenter can stand beside
test('templates: process-flow-3 · -4 · -5 are one shape — the box width falls out of the count, and the four-box cut is the one that shipped', () => {
  for (const [id, n, w] of [['process-flow-3', 3, 251], ['process-flow-4', 4, 180], ['process-flow-5', 5, 138]]) {
    const t = TEMPLATE[id]; assert.ok(t, id + ' ships');
    assert.equal(t.layout, 'content'); assert.equal(t.cat, 'Process'); assert.equal(t.tier, 'core');
    const boxes = t.els.filter(e => /^st\d$/.test(e.id || '')), arrows = t.els.filter(e => e.arrow === 'end' && e.to);
    assert.equal(boxes.length, n, id + ': one box per step');
    assert.equal(arrows.length, n - 1, id + ': an arrow between each pair, none after the last');
    for (const b of boxes) { assert.equal(b.w, w, `${id}: ${w}px boxes`); assert.equal(b.y, 200); assert.equal(b.h, 132); }
    for (let i = 0; i < n; i++) assert.equal(boxes[i].x, 60 + i * (w + 32), `${id}: box ${i} on the ${w + 32}px pitch`);
    for (let i = 0; i < n - 1; i++) {
      assert.equal(arrows[i].to, `st${i + 1}`, `${id}: arrow ${i} terminates on the next box`);
      assert.equal(arrows[i].x, boxes[i].x + w, `${id}: arrow ${i} leaves the box border`);
      assert.equal(arrows[i].line[0], boxes[i + 1].x, `${id}: arrow ${i} reaches the next border`);
    }
    assert.ok(boxes.at(-1).x + w <= 900, `${id}: the row stays inside the margins (ends ${boxes.at(-1).x + w})`);
    assert.equal(t.els[0].slot, 'supertitle'); assert.equal(t.els[1].slot, 'title');
    assert.ok(t.els.some(e => e.line && !e.arrow) && t.els.at(-1).role === 'Label', id + ': the rule and the one-line reading close it');
  }
  const four = TEMPLATE['process-flow-4'].els.filter(e => /^st\d$/.test(e.id || ''));
  assert.deepEqual(four.map(b => b.x), [60, 272, 484, 696], 'the four-box geometry is unchanged, so every model built on it still builds');
});

test('templates: stat-row-3 is the speaker cut — three Stat tiles, three labels, no paragraph', () => {
  const t = TEMPLATE['stat-row-3'];
  assert.ok(t, 'stat-row-3 ships');
  assert.equal(t.density, 'speaker', 'every other numbers template is reading');
  assert.equal(t.cat, 'Numbers'); assert.equal(t.layout, 'content');
  const tiles = t.els.filter(e => e.tile && e.role === 'Stat'), labels = t.els.filter(e => e.role === 'Label' && !e.slot);
  assert.equal(tiles.length, 3, 'three numbers'); assert.equal(labels.length, 3, 'one label each');
  assert.ok(!t.els.some(e => e.role === 'Body'), 'no paragraph — that is what makes it a speaker slide');
  for (const [i, tl] of tiles.entries()) { assert.equal(tl.y, 200); assert.equal(tl.h, 150); assert.equal(labels[i].y, 366); assert.ok(tl.x + tl.w <= 900); }
  const r = v(deck([{template: 'stat-row-3'}], {density: 'speaker'}));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.filter(m => /density/.test(m)), [], 'within the speaker budget: 3 points, under 40 words');
});

test('templates: an unknown template is an error that lists the library; a fill key that does not exist is an error', () => {
  const r = v(deck([{template: 'no-such'}]));
  assert.ok(r.errors.some(m => /template "no-such"/.test(m) && /three-up-cards/.test(m)), r.errors.join(' | '));
  const r2 = v(deck([{template: 'statement', fill: {t9: 'x'}}]));
  assert.ok(r2.errors.some(m => /fill key "t9"/.test(m)), r2.errors.join(' | '));
});

test('templates: validate --templates prints the catalogue, the nine figures under Figures', () => {
  const out = spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), '--templates'], {encoding: 'utf8'});
  assert.equal(out.status, 0); assert.match(out.stdout, /cycle-loop/); assert.match(out.stdout, /t1/);
  assert.match(out.stdout, /^Figures$/m);
  for (const id of FIGURES) assert.match(out.stdout, new RegExp('^  ' + id + ' ', 'm'), id + ' printed');
});

// the figure kinds (ROADMAP L9.2, plus the six-node boundaries figure of U5.6): each is diagramRows() output on the `diagram` layout, reading density, no client residue
const FIGURES = ['figure-decision', 'figure-flow', 'figure-before-after', 'figure-data-model', 'figure-states', 'figure-release', 'figure-boundaries', 'figure-boundaries-6', 'figure-tree', 'figure-layers'];
test('templates: the nine figures — Figures category, diagram layout, reading density, chrome + figure rows + caption, every key filled', () => {
  for (const id of FIGURES) {
    const t = TEMPLATE[id];
    assert.ok(t, id + ' ships');
    assert.equal(t.cat, 'Figures'); assert.equal(t.layout, 'diagram'); assert.equal(t.density, 'reading');
    assert.deepEqual([t.els[0].slot, t.els[1].slot, t.els.at(-1).slot], ['supertitle', 'title', 'caption'], id + ': chrome around the figure');
    assert.ok(t.els.some(e => e.line && e.arrow === 'end' && e.to) || t.els.some(e => e.line && !e.to && !e.from), id + ': a headed connector or a timeline rule');
    const keys = templateKeys(id);
    assert.ok(keys.length >= 5 && keys.every(k => String(k.text).trim()), id + ': every key carries sample text');
    const {frame} = diagramLayout('960x540');
    for (const e of t.els.filter(e => typeof e.x === 'number' && typeof e.w === 'number' && typeof e.h === 'number')) assert.ok(e.x >= frame.x && e.x + e.w <= frame.x + frame.w && e.y >= frame.y && e.y + e.h <= frame.y + frame.h, `${id}: box at ${e.x},${e.y} ${e.w}×${e.h} inside the frame`);
    for (const e of t.els.filter(e => typeof e.x === 'number' && typeof e.w === 'number')) assert.ok(e.x >= 0 && e.x + e.w <= 960, `${id}: row at x=${e.x} w=${e.w} on the canvas`);   // a tick label centres on its dot and may overhang the frame
  }
  const d = deck([{template: 'figure-tree', fill: {t2: 'Two questions per refund'}}]);
  expandTemplates(d);
  assert.equal(d.slides[0].layout, 'diagram');
  assert.ok(d.slides[0].els.some(e => e.svg && /polygon/.test(e.svg)), 'the diamond keeps its paint as an svg row');
  assert.ok(d.slides[0].els.some(e => e.text === 'Two questions per refund'), 'fill replaced the title');
});

// U5.6: the advanced architecture as a template — three zones, seven nodes, six labelled edges, and every label on its
// own run. A label that does not fit lifts to Y(tops)-22, which is where a zone's label sits (Y(g.y)+6): the channels
// are cut so none of them lifts. No row carries a link to another, so the parts are read back out of the rows themselves:
// a zone is a dashed over:1 box, a node is a row with an id, an edge is a run of `line` rows, an edge label is a chip.
test('templates: figure-boundaries-6 — three zones, seven nodes, six labelled edges, no label lifted onto a zone label', () => {
  const t = TEMPLATE['figure-boundaries-6'];
  assert.ok(t, 'figure-boundaries-6 ships');
  const rows = t.els;
  const zoneAt = rows.map((r, i) => [r, i]).filter(([r]) => r.over === 1 && /dashed/.test(r.bd || ''));
  const zoneLabels = zoneAt.map(([, i]) => rows[i + 1]).filter(r => r && r.role === 'Label' && !r.bg);
  const nodes = rows.filter(r => r.id != null);
  let edges = 0; for (const r of rows) if (r.line && r.to) edges++;   // one row per edge carries `to`: the last run of it
  assert.equal(zoneAt.length, 3, 'three dashed zones');
  assert.equal(nodes.length, 7, 'seven node boxes');
  assert.equal(edges, 6, 'six edges land on a node');
  const edgeLabels = rows.filter(r => r.role === 'Label' && r.bg === 'var(--card)');
  assert.equal(edgeLabels.length, 6, 'every edge carries a label chip');
  // a Label's line box is 14px; two labels are legal when they sit styles.gap (4) apart on either axis
  assert.equal(zoneLabels.length, 3);
  for (const a of edgeLabels) for (const b of zoneLabels) {
    const apart = a.x + a.w + 4 <= b.x || b.x + b.w + 4 <= a.x || a.y + 18 <= b.y || b.y + 18 <= a.y;
    assert.ok(apart, `"${a.text}" lifted onto the zone label "${b.text}" (${a.x},${a.y} vs ${b.x},${b.y})`);
  }
  const r = v(deck([{template: 'figure-boundaries-6'}]));
  assert.deepEqual(r.errors, [], r.errors.join(' | '));
  assert.deepEqual(r.warnings, [], 'the gap gate is clean too: ' + r.warnings.join(' | '));
});

// U5.5: scorecard-grid — the criteria × options grid two study subjects hand-built. Every cell is a fill key, and one
// key takes either short text or a 0..4 rating drawn as the harvey-balls ring (0 · 25 · 50 · 75 · 100 percent).
const cellKeys = () => templateKeys('scorecard-grid').filter(k => k.cell);
test('templates: scorecard-grid — twelve cells, each a fill key; a number draws the ring, a string writes text', () => {
  const t = TEMPLATE['scorecard-grid'];
  assert.ok(t, 'scorecard-grid ships'); assert.equal(t.cat, 'Frameworks'); assert.equal(t.density, 'reading');
  const cells = cellKeys();
  assert.equal(cells.length, 12, 'four criteria rows × three option columns');
  const ring = cells.find(k => /^rating /.test(k.text)), txt = cells.find(k => !/^rating /.test(k.text));
  assert.ok(ring && txt, 'the sample shows both cell forms: ' + cells.map(k => k.text).join(' | '));
  const sample = t.els.filter(e => e.donut != null);
  assert.ok(sample.length && sample.every(e => e.w === RING && e.hole === 0 && /^var\(--/.test(e.color)), 'the sample balls are the harvey-balls shape');
  const d = deck([{template: 'scorecard-grid', fill: {[ring.key]: 'n/a', [txt.key]: 1}}]);
  expandTemplates(d);
  const els = d.slides[0].els;
  assert.ok(els.some(e => e.text === 'n/a' && e.role === 'Label' && !e.donut), 'a string on a rating cell writes text');
  const filled = els.find(e => e.donut === 25);   // no sample cell scores 1, so this ring is the one the fill drew
  assert.ok(filled && filled.w === RING && filled.hole === 0, 'a 1 on a text cell draws a quarter ball the harvey-balls way');
  const box = filled.cell;   // the cell keeps its column box, so the ring centres in the column it replaced
  assert.equal(filled.x, box[0] + (box[2] - RING) / 2);
  assert.ok(!els.some(e => e.text === txt.text), 'the sample text is gone: ' + txt.text);
});

test('templates: scorecard-grid — a rating is a whole 0..4, only a cell takes a number, and a cell still takes text', () => {
  const cells = cellKeys();
  const over = v(deck([{template: 'scorecard-grid', fill: {[cells[0].key]: 5}}]));
  assert.ok(over.errors.some(m => /0\.\.4/.test(m)), over.errors.join(' | '));
  const frac = v(deck([{template: 'scorecard-grid', fill: {[cells[0].key]: 2.5}}]));
  assert.ok(frac.errors.some(m => /0\.\.4/.test(m)), frac.errors.join(' | '));
  const wrong = v(deck([{template: 'scorecard-grid', fill: {t2: 3}}]));
  assert.ok(wrong.errors.some(m => /takes text/.test(m)), wrong.errors.join(' | '));
  const ok = v(deck([{template: 'scorecard-grid', fill: {[cells[0].key]: 0, [cells[1].key]: 4, [cells[2].key]: '18 hrs'}}]));
  assert.deepEqual(ok.errors, [], ok.errors.join(' | '));
});

test('templates: SKILL.md names the template library, the fill contract and the catalogue command', () => {
  const doc = read('SKILL.md');
  assert.match(doc, /## TEMPLATE LIBRARY/); assert.match(doc, /`template:`|template:/); assert.match(doc, /fill/); assert.match(doc, /--templates/);
});

test('templates: the logo family ships stand-in marks, and a deck without draft refuses them', () => {
  const marks = TEMPLATES.filter(t => t.els.some(r => r.placeholder != null));
  assert.ok(marks.length >= 6, 'the logo placements carry stand-ins: ' + marks.map(t => t.id).join(','));
  for (const t of marks) assert.equal(t.cat, 'Logo', t.id + ' is a Logo placement');
  const r = v(deck([{template: 'logo-cover-lockup'}]));
  assert.ok(r.errors.some(m => /placeholder mark .* may not ship/.test(m)), 'no draft, no stand-in');
});

// ── F10: per-item media. The list-shaped templates take a logo, an image or an icon per item: `fill: {m1: {logo}, m2: {icon}}`.
// The media sits BESIDE the item's lead text, centred on that text's first line, one fixed gutter (lib/logo.mjs GAP) between;
// a centred lead row keeps the pair centred. A logo turns the lead row into a logo row (docs/logo.md) whose name is the text.
// A template with no media filled expands exactly as before.
import {templateMedia, MEDIA_TEMPLATES} from '../lib/templates.mjs';
import {GAP} from '../lib/logo.mjs';
import {NEUTRAL_LH} from '../lib/layouts.mjs';
import {scale} from '../lib/templates/kit.mjs';
const LIST = ['agenda-ruled', 'exec-summary', 'stat-row-3', 'stat-row-4', 'kpi-scorecard', 'two-col-compare', 'benchmark-table', 'harvey-balls',
  'scorecard-grid', 'value-chain', 'process-flow-3', 'process-flow-4', 'process-flow-5', 'timeline-horizontal', 'gantt-lanes', 'vertical-steps',
  'funnel-stages', 'three-up-cards', 'table-insight', 'proof-strip'];
const PNG = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><rect width="40" height="20" fill="#123"/></svg>').toString('base64');
const MEDIA = {logo: {logo: PNG, aspect: 2}, img: {img: PNG, fit: 'cover'}, icon: {icon: 'factory'}, monogram: {logo: ''}};
const mediaFill = (id, m) => Object.fromEntries(templateMedia(id).map(e => [e.key, m]));

test('templates: media — every list-shaped template declares one media key per item, m1..mn, and the catalogue prints them', () => {
  assert.deepEqual([...MEDIA_TEMPLATES].sort(), [...LIST].sort(), 'the list-shaped templates are exactly the ones that take media');
  for (const id of LIST) {
    const m = templateMedia(id), keys = templateKeys(id);
    assert.ok(m.length >= 2, id + ': a list has at least two items');
    m.forEach((e, i) => { assert.equal(e.key, 'm' + (i + 1)); assert.ok(keys.some(k => k.key === e.on && typeof k.text === 'string'), id + ' ' + e.key + ' rides a text key'); });
  }
  assert.deepEqual(templateMedia('statement'), [], 'a template that is not a list takes no media');
  assert.equal(templateMedia('no-such'), null);
  const cat = templateCatalogue();
  assert.match(cat, /^ {4}m1 {3}media {6}logo · img · icon beside t\d+/m);
});

test('templates: media — no template row carries the item marker, and a template with no media expands exactly to its rows', () => {
  for (const t of TEMPLATES) assert.ok(!t.els.some(r => 'item' in r), t.id + ': the item marker never reaches a deck');
  for (const id of LIST) {
    const d = deck([{template: id}]); expandTemplates(d);
    assert.deepEqual(d.slides[0].els, scale(TEMPLATE[id].els, 1), id + ': unchanged without media');
  }
});

const lhOf = r => NEUTRAL_LH[r.role];
test('templates: media — an icon or image sits beside its item, centred on the first line, one gutter before the text', () => {
  for (const id of LIST) for (const kind of ['icon', 'img']) {
    const d = deck([{template: id, fill: mediaFill(id, MEDIA[kind])}]); expandTemplates(d);
    const els = d.slides[0].els, marks = els.filter(r => r[kind] != null);
    assert.equal(marks.length, templateMedia(id).length, `${id} ${kind}: one per item`);
    for (const mk of marks) {
      const txt = els[els.indexOf(mk) + 1];
      assert.ok(txt && txt.text != null, `${id} ${kind}: the text follows its media`);
      assert.equal(txt.x, mk.x + mk.w + GAP, `${id} ${kind}: one fixed gutter`);
      assert.ok(Math.abs((mk.y + mk.h / 2) - (txt.y + lhOf(txt) / 2)) <= 0.5, `${id} ${kind}: centred on the first line (${mk.y}+${mk.h}/2 vs ${txt.y}+${lhOf(txt)}/2)`);
      assert.ok(!txt.align || txt.align === 'left', `${id} ${kind}: the text starts at the gutter`);
      if (kind === 'icon') { assert.equal(mk.w, mk.h, 'an icon is square'); assert.equal(mk.icon, 'factory'); }
      else assert.equal(mk.fit, 'cover', 'fit rides along');
    }
  }
});

test('templates: media — a logo makes the lead row a logo row; its name is the text, its first line where the text was', () => {
  for (const id of LIST) {
    const plain = deck([{template: id}]); expandTemplates(plain);
    const d = deck([{template: id, fill: mediaFill(id, MEDIA.logo)}]); expandTemplates(d);
    const logos = d.slides[0].els.filter(r => r.logo != null);
    assert.equal(logos.length, templateMedia(id).length, id + ': one logo row per item');
    const names = templateMedia(id).map(e => templateKeys(id).find(k => k.key === e.on).text);
    assert.deepEqual(logos.map(r => r.name), names, id + ': the names are the item texts');
    for (const [i, r] of logos.entries()) {
      const was = plain.slides[0].els.find(e => e.text === names[i]);
      assert.equal(r.gap, GAP); assert.ok(r.col > 0 && r.h > 0); assert.equal(r.text, undefined);
      assert.ok(Math.abs((r.y + r.h / 2) - (was.y + lhOf(was) / 2)) <= 0.5, `${id}: the name's first line stays put`);
      if (was.align !== 'center') assert.equal(r.x, was.x, id + ': a left row keeps its x');
    }
  }
});

test('templates: media — every list template validates with media filled: zero errors, no air finding the plain slide lacks', () => {
  for (const id of LIST) {
    const base = new Set(v(deck([{template: id}])).warnings);
    for (const [kind, m] of Object.entries(MEDIA)) {
      const r = v(deck([{template: id, fill: mediaFill(id, m)}]));
      assert.deepEqual(r.errors, [], `${id} ${kind}: ${r.errors.join(' | ')}`);
      assert.deepEqual(r.warnings.filter(w => !base.has(w)), [], `${id} ${kind}: new warnings`);
    }
  }
});

test('templates: media — a text fill and a media fill on the same item compose; the canvas scale reaches the column', () => {
  const on = templateMedia('benchmark-table')[0].on, d = deck([{template: 'benchmark-table', fill: {[on]: 'Xometry', m1: {logo: PNG, aspect: 3}}}]); expandTemplates(d);
  assert.ok(d.slides[0].els.some(r => r.logo && r.name === 'Xometry'));
  const big = deck([{template: 'benchmark-table', fill: {m1: {logo: PNG}}}], {w: 1600, h: 900}); expandTemplates(big);
  const small = deck([{template: 'benchmark-table', fill: {m1: {logo: PNG}}}]); expandTemplates(small);
  const [a, b] = [big, small].map(x => x.slides[0].els.find(r => r.logo));
  assert.equal(a.col, Math.round(b.col * 1600 / 960)); assert.equal(a.h, Math.round(b.h * 1600 / 960));
});

test('templates: media — fill errors name what a media key takes', () => {
  const bad = [[{m9: {icon: 'factory'}}, /fill key "m9"/], [{m1: 'factory'}, /takes one of \{logo\}, \{img\} or \{icon\}/],
    [{m1: {icon: 'factory', img: PNG}}, /one of/], [{m1: {icon: 'no-such-icon'}}, /icon "no-such-icon"/],
    [{m1: {img: 'https://x/y.png'}}, /data: URI/], [{m1: {img: PNG, fit: 'squash'}}, /fit/], [{m1: {logo: PNG, plate: 'pink'}}, /plate/],
    [{m1: {logo: PNG, h: -3}}, /h must be/], [{m1: {icon: 'factory', size: 3}}, /"size"/]];
  for (const [fill, re] of bad) {
    const r = v(deck([{template: 'agenda-ruled', fill}]));
    assert.ok(r.errors.some(m => re.test(m)), JSON.stringify(fill) + ' → ' + r.errors.join(' | '));
  }
  assert.ok(v(deck([{template: 'statement', fill: {m1: {icon: 'factory'}}}])).errors.some(m => /fill key "m1"/.test(m)), 'no media on a non-list');
  const ok = v(deck([{template: 'proof-strip', fill: {m1: {logo: '#acme', aspect: 3}, m2: {img: '#acme'}}}], {assets: {acme: PNG}}));
  assert.deepEqual(ok.errors, [], 'an asset reference fills a media key: ' + ok.errors.join(' | '));
});
