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

test('templates: 115 ship, every id unique, every one names a tier, a category and a density', () => {
  assert.equal(TEMPLATES.length, 115);
  assert.equal(new Set(TEMPLATES.map(t => t.id)).size, 115);
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
  assert.ok(!templateFixed('pad-default-60').some(s => /bars?$/.test(s)), 'pad-default-60 takes its bars from a data key since K22');
  assert.ok(!templateFixed('stat-plus-chart').some(s => /bars?|chart/.test(s)), 'stat-plus-chart hands its series to a chart row since K22');
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
    const boxes = t.els.filter(e => /^st\d$/.test(e.id || '')), arrows = t.els.filter(e => e.style === 'arrow' && e.to);   // connector rows (K16)
    assert.equal(boxes.length, n, id + ': one box per step');
    assert.equal(arrows.length, n - 1, id + ': an arrow between each pair, none after the last');
    for (const b of boxes) { assert.equal(b.w, w, `${id}: ${w}px boxes`); assert.equal(b.y, 200); assert.equal(b.h, 132); }
    for (let i = 0; i < n; i++) assert.equal(boxes[i].x, 60 + i * (w + 32), `${id}: box ${i} on the ${w + 32}px pitch`);
    for (let i = 0; i < n - 1; i++) {
      assert.equal(arrows[i].to, `st${i + 1}`, `${id}: arrow ${i} terminates on the next box`);
      assert.equal(arrows[i].from, `st${i}`, `${id}: arrow ${i} leaves this box — the engine insets both ends`);
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
  for (const [i, tl] of tiles.entries()) { assert.equal(tl.y, 200); assert.equal(tl.h, 130); assert.equal(labels[i].y, 346); assert.ok(tl.x + tl.w <= 900); }
  const bars = t.els.filter(e => e.bg && !e.tile && e.text == null);
  assert.equal(bars.length, 6, 'a before/after pair under each tile — the number drawn at its size (K10)');
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
import {templateMedia, MEDIA_TEMPLATES, SAMPLE_BOUND, templateVals as valsOf} from '../lib/templates.mjs';
import {GAP} from '../lib/logo.mjs';
import {NEUTRAL_LH} from '../lib/layouts.mjs';
import {scale} from '../lib/templates/kit.mjs';
const LIST = ['agenda-ruled', 'stat-row-3', 'stat-row-4', 'kpi-scorecard', 'two-col-compare', 'benchmark-table', 'harvey-balls',
  'scorecard-grid', 'value-chain', 'process-flow-3', 'process-flow-4', 'process-flow-5', 'timeline-horizontal', 'gantt-lanes', 'vertical-steps',
  'funnel-stages', 'three-up-cards', 'table-insight', 'proof-strip'];
const PNG = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><rect width="40" height="20" fill="#123"/></svg>').toString('base64');
const MEDIA = {logo: {logo: PNG, aspect: 2}, img: {img: PNG, fit: 'cover'}, icon: {icon: 'factory'}, monogram: {logo: ''}};
// a filled slide names its quantities (K22), so a media fill carries every value key at its sample; a sample-bound template
// refuses any fill, so the media tests that fill run over the rest
const mediaFill = (id, m) => ({...Object.fromEntries(valsOf(id).map(v => [v.key, v.sample])), ...Object.fromEntries(templateMedia(id).map(e => [e.key, m]))});
const FILLABLE = LIST.filter(id => !SAMPLE_BOUND[id]);

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
  for (const id of FILLABLE) for (const kind of ['icon', 'img']) {
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
  for (const id of FILLABLE) {
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
  for (const id of FILLABLE) {
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

// K11: a logo in a media slot is never under MEDIA_MIN (20px at the 960 cut) and never shrunk by its column: a small `h` is raised,
// a wide mark grows the column (one column per slide, so the names still align), and the rows under a taller item move down.
// K23: a wordmark (3:1 or wider) reads like type, so its floor is WORDMARK_MIN (14px); in a box too narrow beside its text it
// stacks above the text, out of the shared column (test/media-wordmarks.test.mjs).
import {logoGeom, padOf, plateOf} from '../lib/logo.mjs';
import {fillErrors, WORDMARK, WORDMARK_MIN} from '../lib/templates.mjs';
import {MEDIA_MIN} from '../lib/layouts.mjs';
const expanded = (id, fill) => { const d = deck([{template: id, fill}]); expandTemplates(d); return d.slides[0].els; };
test('templates: media — a logo is at least MEDIA_MIN tall and fills its chip: a small h is raised, a wide mark grows the column', () => {
  assert.equal(MEDIA_MIN, 20);
  let refused = 0;
  for (const id of FILLABLE) for (const aspect of [0.5, 1, 2, 6.8]) for (const h of [undefined, 12]) {
    const fill = {...mediaFill(id, null), ...Object.fromEntries(templateMedia(id).map((e, i) => [e.key, {logo: PNG, aspect: i ? aspect : 1, plate: 'light', ...(h ? {h} : {})}]))};
    const tag = `${id} aspect ${aspect} h ${h}`, why = fillErrors(id, fill);
    if (why.length) { assert.match(why.join(' '), /\(6\.8:1 wordmark\) needs \d+px beside .* at 14px tall/, tag); assert.equal(aspect, 6.8, tag + ': only a very wide mark is refused'); refused++; continue; }   // a centred box too narrow: refused, never shrunk
    const logos = expanded(id, fill).filter(r => r.logo != null);
    assert.equal(logos.length, templateMedia(id).length, tag);
    for (const r of logos) {
      const floor = r.aspect >= WORDMARK ? WORDMARK_MIN : MEDIA_MIN;
      assert.ok(r.h >= floor, `${tag}: logo ${r.h}px tall, under ${floor}`);
      const g = logoGeom(r), inner = r.h - 2 * padOf(r.h, plateOf(r.plate));
      assert.ok(g.img.h >= inner - 0.01, `${tag}: the column shrank the mark to ${g.img.h.toFixed(1)}px of ${inner}`);
    }
    const left = logos.filter(r => r.w != null && r.name);   // a stacked wordmark carries no name, so it has no column to share   // a centred pair has no w: it is centred on its own box, so there is no x to share
    assert.ok(new Set(left.map(r => r.col)).size <= 1, `${tag}: one column per slide, so the names align`);
  }
});
test('templates: media — an item taller than its first line moves the rows under it down; the slide still validates clean', () => {
  for (const id of FILLABLE) for (const m of [{logo: PNG, aspect: 6.8, h: 32}, {icon: 'factory', h: 32}]) {
    const tag = `${id} ${Object.keys(m)[0]}`, why = fillErrors(id, mediaFill(id, m));
    if (why.length) { assert.match(why.join(' '), /centred box leaves/, tag); continue; }
    const els = expanded(id, mediaFill(id, m));
    for (const mk of els.filter(r => r.logo != null || r.icon != null)) {
      const bottom = mk.y + mk.h, x1 = mk.x + (mk.col ?? mk.w);
      const under = els.filter(r => r !== mk && typeof r.y === 'number' && r.y > mk.y + mk.h / 2 && r.y < bottom - 0.5 && !r.slot
        && typeof r.x === 'number' && r.x < x1 && r.x + (typeof r.w === 'number' ? r.w : 0) > mk.x && (r.text != null || r.logo != null));
      assert.deepEqual(under.map(r => r.text ?? r.name), [], `${tag}: text starts inside the media box (${mk.y}..${bottom})`);
    }
    const r = v(deck([{template: id, fill: mediaFill(id, m)}]));
    assert.deepEqual(r.errors, [], `${tag}: ${r.errors.join(' | ')}`);
  }
});
// K2: an icon a template places beside text by hand obeys the media rule too: centred on the text's first line, one GAP before it
test('templates: every icon beside text is centred on its first line with one fixed gutter, never top-aligned', () => {
  let n = 0;
  for (const t of TEMPLATES) for (const ic of t.els.filter(r => r.icon && typeof r.y === 'number')) {
    const txt = t.els.find(r => r.text != null && typeof r.x === 'number' && r.x >= ic.x + ic.w && r.x - (ic.x + ic.w) <= 32
      && r.y < ic.y + ic.h && r.y + lhOf(r) > ic.y);
    if (!txt) continue; n++;
    assert.ok(Math.abs((ic.y + ic.h / 2) - (txt.y + lhOf(txt) / 2)) <= 0.5, `${t.id} ${ic.icon}: centre ${ic.y + ic.h / 2} vs first line ${txt.y + lhOf(txt) / 2}`);
    assert.equal(txt.x - (ic.x + ic.w), GAP, `${t.id} ${ic.icon}: gutter`);
  }
  assert.ok(n >= 10, `the icon-beside-text templates are found (${n})`);
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

// ── K14: fill carries geometry. A value may set a point's x/y or a bar's length, and a text row that outgrows its sample
// moves the rows under it down, or validate refuses the fill when that would run the slide off the canvas.
import {templateVals} from '../lib/templates.mjs';
const sampleFill = id => ({...Object.fromEntries(templateKeys(id).map(k => [k.key, k.text.startsWith('rating ') ? Number(k.text.split(' ')[1]) : k.text])),
  ...Object.fromEntries(templateVals(id).map(v => [v.key, v.sample]))});
const rowsOf = (id, fill, extra) => { const d = deck([{template: id, fill}], extra); expandTemplates(d); return d.slides[0].els; };

test('templates: K14 — every template filled with its own sample expands to exactly its unfilled rows', () => {
  for (const t of TEMPLATES) {
    if (SAMPLE_BOUND[t.id]) continue;   // K22: any fill is refused there (template-values.test.mjs)
    const fill = sampleFill(t.id);
    assert.deepEqual(rowsOf(t.id, fill), rowsOf(t.id, undefined), t.id + ': a sample fill changes nothing');
  }
});

test('templates: K14 — two-by-two plots each player at its filled coordinates, and the name follows the dot', () => {
  const vals = templateVals('two-by-two');
  assert.deepEqual(vals.map(v => v.key), ['x1', 'y1', 'x2', 'y2', 'x3', 'y3']);
  for (const v of vals) assert.deepEqual(v.range, [0, 100]);
  const dots = els => els.filter(r => r.radius != null && r.w === r.h && r.bg);
  const centre = r => [r.x + r.w / 2, r.y + r.h / 2];
  const els = rowsOf('two-by-two', {x1: 90, y1: 90, x2: 10, y2: 10, x3: 50, y3: 50});
  const [a, b, c] = dots(els).map(centre);
  assert.deepEqual(a, [768, 201], 'x 90 · y 90 is near the top-right of the 300..820 × 430..176 plot');
  assert.deepEqual(b, [352, 405], 'x 10 · y 10 is near the bottom-left');
  assert.deepEqual(c, [560, 303], '50 · 50 sits on the quadrant lines');
  const name = t => els.find(r => r.text === t);
  const A = name('Incumbent A'), B = name('Incumbent B'), U = name('Us');
  assert.equal(A.y, 201 - 7, 'the name is centred on its dot'); assert.equal(B.y, 405 - 7); assert.equal(U.y, 303 - 7);
  assert.ok(A.x + A.w <= 900, 'a name that would run past the margin flips to the left of its dot: ' + (A.x + A.w));
  assert.ok(A.x + A.w <= a[0], 'and ends before the dot');
  assert.ok(B.x >= 300, 'a left-hand name that would cross the y axis flips to the right of its dot: ' + B.x);
  assert.ok(!templateFixed('two-by-two').some(s => /shape/.test(s)), 'no fixed shapes left: ' + templateFixed('two-by-two').join(' · '));
  const r = v(deck([{template: 'two-by-two', fill: {x1: 90, y1: 90, x2: 10, y2: 10, x3: 50, y3: 50}}]));
  assert.deepEqual(r.errors, [], r.errors.join(' | '));
  assert.ok(v(deck([{template: 'two-by-two', fill: {x1: 120}}])).errors.some(m => /x1/.test(m) && /0\.\.100/.test(m)), 'a coordinate is range-checked');
});

test('templates: K14 — chart-bar-ranked draws every bar from its filled value, on one scale', () => {
  const vals = templateVals('chart-bar-ranked');
  assert.deepEqual(vals.map(v => v.key), ['v1', 'v2', 'v3', 'v4', 'v5']);
  const bars = els => els.filter(r => r.h === 26 && r.w != null && r.bg);
  const sample = bars(rowsOf('chart-bar-ranked')).map(r => r.w);
  assert.deepEqual(sample, [504, 412, 269, 176, 109], 'the sample lengths are unchanged');
  const els = rowsOf('chart-bar-ranked', {v1: 80, v2: 40, v3: 20, v4: 10, v5: 60});
  assert.deepEqual(bars(els).map(r => r.w), [504, 252, 126, 63, 378], 'the largest value fills the track; the rest are in proportion');
  for (const n of [80, 40, 20, 10, 60]) assert.ok(els.some(r => r.text === String(n)), 'the value label reads ' + n);
  const b = bars(els), labs = els.filter(r => /^\d+$/.test(r.text || ''));
  labs.forEach((l, i) => assert.equal(l.x, b[i].x + b[i].w + 12, 'each value label sits past its own bar'));
  assert.ok(!templateFixed('chart-bar-ranked').some(s => /shape/.test(s)), 'the bars are no longer fixed: ' + templateFixed('chart-bar-ranked').join(' · '));
  assert.deepEqual(v(deck([{template: 'chart-bar-ranked', fill: {v1: 1200, v2: 0, v3: 5, v4: 5, v5: 5}}])).errors, [], 'a value over the sample scale, and a zero, are legal');
});

const LONG = 'Who ships design-for-manufacture today';
test('templates: K14 — a cover title that wraps pushes the context and the kicker line down instead of colliding', () => {
  const plain = rowsOf('cover-hero'), long = rowsOf('cover-hero', {t2: LONG});
  const bodyOf = els => els.find(r => r.role === 'Body'), labOf = els => els.find(r => r.role === 'Label');
  assert.equal(bodyOf(long).y - bodyOf(plain).y, 68, 'one more Title line (68px) moves the body down by exactly that');
  assert.equal(labOf(long).y - labOf(plain).y, 68, 'and the row under the body with it');
  assert.equal(long[0].y, plain[0].y, 'the accent rule above the title stays put');
  const r = v(deck([{template: 'cover-hero', fill: {t2: LONG}}]));
  assert.deepEqual(r.errors, [], r.errors.join(' | '));
  assert.deepEqual(r.warnings.filter(m => /overlaps/.test(m)), [], 'no collision: ' + r.warnings.join(' | '));
  const big = rowsOf('cover-hero', {t2: LONG}, {w: 1600, h: 900});
  assert.equal(bodyOf(big).y, Math.round((358 + 68) * 1600 / 960), 'the reflow happens on the 960 cut, then scales');
});

test('templates: K14 — a fill that would push rows past the canvas foot fails validate with a message naming the key', () => {
  const r = v(deck([{template: 'cover-hero', fill: {t2: LONG + ' ' + LONG + ' ' + LONG}}]));
  assert.ok(r.errors.some(m => /fill key "t2"/.test(m) && /lines/.test(m) && /canvas/.test(m)), r.errors.join(' | '));
  const s = v(deck([{template: 'stat-row-4', fill: {t11: 'Units grew with the reseller channel. '.repeat(16)}}]));
  assert.ok(s.errors.some(m => /fill key "t11"/.test(m) && /canvas/.test(m)), s.errors.join(' | '));
});

test('templates: K14 — stat-row-4 with a longer tile body reflows nothing it should not and still validates', () => {
  const fill = {t11: 'Units grew with the reseller channel; install time halved once the gateway shipped paired. CSAT held through both quarters, and churn fell.'};
  const r = v(deck([{template: 'stat-row-4', fill}]));
  assert.deepEqual(r.errors, [], r.errors.join(' | '));
  assert.deepEqual(r.warnings.filter(m => /overlaps/.test(m)), [], r.warnings.join(' | '));
});

// K6/K9 follow-up: the coverage gate asks every words-heavy slide for a graphic. A template either draws one the gate
// counts in its own sample (a chart, a proportional figure, bars, logo marks) or declares textOnly: true in its
// definition — the words-by-nature shelves: statements, lists, text columns, chrome and mark placement. The slide a
// template expands into inherits the mark, so an author never sets it by hand.
const TEXT_ONLY = t => v(deck([{template: t.id}], {draft: 1})).warnings.filter(m => /text only/.test(m));
// Three templates draw the author's own media, so their bare sample is words until it is filled, and the gate is right to say
// so: image-hero-overlay (the photo), proof-strip (the five logos) and three-up-cards (a logo per cohort card, K19). The
// sheet binds a sample photo and monogram chips.
test('templates: every template passes the coverage gate as sampled — a graphic, or textOnly: true in its definition', () => {
  const loud = TEMPLATES.filter(t => TEXT_ONLY(t).length).map(t => t.id);
  assert.deepEqual([...loud].sort(), ['image-hero-overlay', 'proof-strip', 'three-up-cards'], 'text-only warnings on the samples of: ' + loud.join(', '));
  const marks = v(deck([{template: 'proof-strip', fill: Object.fromEntries([1, 2, 3, 4, 5].map(i => ['m' + i, {logo: ''}]))}], {draft: 1}));
  assert.deepEqual(marks.warnings.filter(m => /text only/.test(m)), [], 'five monogram chips are a logo group');
});
test('templates: textOnly is a boolean mark, never on a template whose job is to show a quantity (Numbers, charts, proportion)', () => {
  for (const t of TEMPLATES) if (t.textOnly != null) assert.equal(t.textOnly, true, t.id);
  const shows = TEMPLATES.filter(t => ['Numbers', 'Charts', 'Proportion'].includes(t.cat) && t.textOnly).map(t => t.id);
  assert.deepEqual(shows, [], 'a numbers slide draws its values: ' + shows.join(', '));
});
test('templates: a slide made from a textOnly template inherits the mark; one made from a graphic template does not', () => {
  const words = TEMPLATES.find(t => t.textOnly), shows = TEMPLATES.find(t => t.id === 'stat-row-4');
  const d = expandTemplates(deck([{template: words.id}, {template: shows.id}, {template: words.id, textOnly: false}]));
  assert.equal(d.slides[0].textOnly, true, words.id);
  assert.equal(d.slides[1].textOnly, undefined, 'stat-row-4 draws its bars');
  assert.equal(d.slides[2].textOnly, false, 'a slide that says otherwise keeps its own word');
});
