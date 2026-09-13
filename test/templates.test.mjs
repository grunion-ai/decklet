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
import {LIBRARY} from '../lib/layouts.mjs';
import {diagramLayout} from '../lib/diagram.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const v = m => validate(create(m).deck);   // validate what create() judges: the neutral roles filled in
const deck = (slides, extra = {}) => ({w: 960, h: 540, title: 'tpl', ...extra, slides});

test('templates: 69 ship, every id unique, every one names a tier, a category and a density', () => {
  assert.equal(TEMPLATES.length, 69);
  assert.equal(new Set(TEMPLATES.map(t => t.id)).size, 69);
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
  assert.deepEqual(templateFixed('harvey-balls'), ['12 rings', '4 rules'], 'twelve rating rings are literals in els');
  assert.deepEqual(templateFixed('statement'), [], 'a text-only template has nothing fixed');
  assert.ok(templateFixed('chart-column').some(s => /bars?$/.test(s)), 'a chart template names its bars');
  assert.equal(templateFixed('no-such'), null);
  assert.deepEqual(templateFixed('scorecard-grid'), ['5 rules'], 'a cell\'s rating ring is a key, so only the rules are fixed');
  const cat = templateCatalogue();
  for (const t of TEMPLATES) {
    const fixed = templateFixed(t.id);
    assert.equal(fixed.reduce((n, s) => n + Number(s.split(' ')[0]), 0), t.els.length - templateKeys(t.id).length, t.id + ': every row a key does not reach is counted');
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

test('templates: every template validates with zero errors under the neutral scale, and creates', () => {
  for (const t of TEMPLATES) {
    const r = v(deck([{template: t.id}]));
    assert.deepEqual(r.errors, [], t.id + ': ' + r.errors.join(' | '));
    const {html} = create(deck([{template: t.id}]));
    assert.ok(html.includes('/*DECK*/'), t.id + ' creates');
  }
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
    assert.ok(t.els.some(e => e.line && e.arrow === 'end' && e.to) || t.els.some(e => e.group === 'timeline'), id + ': a headed connector or a timeline rule');
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
// own run. A label that does not fit lifts to Y(tops)-22, which is where a group's label sits (Y(g.y)+6): the channels
// are cut so none of them lifts.
test('templates: figure-boundaries-6 — three zones, seven nodes, six labelled edges, no label lifted onto a group label', () => {
  const t = TEMPLATE['figure-boundaries-6'];
  assert.ok(t, 'figure-boundaries-6 ships');
  const rows = t.els;
  const groups = new Set(rows.filter(r => /^g:/.test(r.group || '')).map(r => r.group));
  const nodes = new Set(rows.filter(r => r.group && !/^[ge]:|^tick:|^note$|^timeline$/.test(r.group)).map(r => r.group));
  const edges = new Set(rows.filter(r => /^e:/.test(r.group || '')).map(r => r.group));
  assert.equal(groups.size, 3, [...groups].join(' '));
  assert.equal(nodes.size, 7, [...nodes].join(' '));
  assert.equal(edges.size, 6, [...edges].join(' '));
  const edgeLabels = rows.filter(r => /^e:/.test(r.group || '') && r.role === 'Label');
  assert.equal(edgeLabels.length, 6, 'every edge carries a label');
  // a Label's line box is 14px; two labels are legal when they sit styles.gap (4) apart on either axis
  const groupLabels = rows.filter(r => /^g:/.test(r.group || '') && r.role === 'Label');
  assert.equal(groupLabels.length, 3);
  for (const a of edgeLabels) for (const b of groupLabels) {
    const apart = a.x + a.w + 4 <= b.x || b.x + b.w + 4 <= a.x || a.y + 18 <= b.y || b.y + 18 <= a.y;
    assert.ok(apart, `"${a.text}" lifted onto the group label "${b.text}" (${a.x},${a.y} vs ${b.x},${b.y})`);
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
  assert.ok(sample.length && sample.every(e => e.w === 36 && /^var\(--/.test(e.color)), 'the sample rings are the harvey-balls shape');
  const d = deck([{template: 'scorecard-grid', fill: {[ring.key]: 'n/a', [txt.key]: 1}}]);
  expandTemplates(d);
  const els = d.slides[0].els;
  assert.ok(els.some(e => e.text === 'n/a' && e.role === 'Label' && !e.donut), 'a string on a rating cell writes text');
  const filled = els.find(e => e.donut === 25);   // no sample cell scores 1, so this ring is the one the fill drew
  assert.ok(filled && filled.w === 36, 'a 1 on a text cell draws a quarter ring the harvey-balls way');
  const box = filled.cell;   // the cell keeps its column box, so the ring centres in the column it replaced
  assert.equal(filled.x, box[0] + (box[2] - 36) / 2);
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
