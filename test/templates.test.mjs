// decklet template library gate — the 58 candidates ship in the engine as `template:` slides. A template is a finished
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
import {TEMPLATES, TEMPLATE, templateKeys, expandTemplates, templateCatalogue} from '../lib/templates.mjs';
import {LIBRARY} from '../lib/layouts.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const v = m => validate(create(m).deck);   // validate what create() judges: the neutral roles filled in
const deck = (slides, extra = {}) => ({w: 960, h: 540, title: 'tpl', ...extra, slides});

test('templates: 58 ship, every id unique, every one names a tier, a category and a density', () => {
  assert.equal(TEMPLATES.length, 58);
  assert.equal(new Set(TEMPLATES.map(t => t.id)).size, 58);
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

test('templates: validate --templates prints the catalogue', () => {
  const out = spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), '--templates'], {encoding: 'utf8'});
  assert.equal(out.status, 0); assert.match(out.stdout, /cycle-loop/); assert.match(out.stdout, /t1/);
});

test('templates: SKILL.md names the template library, the fill contract and the catalogue command', () => {
  const doc = read('SKILL.md');
  assert.match(doc, /## TEMPLATE LIBRARY/); assert.match(doc, /`template:`|template:/); assert.match(doc, /fill/); assert.match(doc, /--templates/);
});
