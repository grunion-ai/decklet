import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {create} from '../bin/create.mjs';
import {validateModel} from '../bin/validate.mjs';
import {newModel} from '../bin/new.mjs';
import {CANVAS, libraryFor, mapRow, densityReport, footTop} from '../lib/layouts.mjs';

const model = extra => ({format: 'slides', ...extra, slides: [{layout: 'content', els: [{slot: 'title', text: 'Hello'}]}]});

test('canvas: an absent canvas and medium build the same geometry', () => {
  const a = create(model({})).deck, b = create(model({canvas: 'medium'})).deck;
  assert.deepEqual([a.w, a.h, a.styles.roles], [b.w, b.h, b.styles.roles]);
  assert.deepEqual(a.layouts, b.layouts);
  assert.equal(a.canvas, undefined);
});

test('canvas: low is smaller with larger type, high is larger with smaller type and tighter margins', () => {
  const low = create(model({canvas: 'low'})).deck, med = create(model({})).deck, high = create(model({}), {canvas: 'high'}).deck;
  assert.deepEqual([low.w, low.h, high.w, high.h], [720, 405, 1280, 720]);
  const reads = d => d.styles.roles.Body.size * 960 / d.w;
  assert.ok(reads(low) > reads(med) && reads(med) > reads(high));
  const inset = d => d.styles.margin / d.w;
  assert.ok(inset(low) > inset(med) && inset(med) > inset(high));
  assert.equal(low.layouts.content.title.x, 56);
  assert.equal(high.layouts.content.title.x, 32);
});

test('canvas: a built deck validates without scaling its roles twice', () => {
  const {deck} = create(model({canvas: 'high'})), size = deck.styles.roles.Body.size;
  validateModel(deck);
  assert.equal(create(deck).deck.styles.roles.Body.size, size);
});

test('canvas: a full-bleed row stays full bleed and content stays inside the margins', () => {
  for (const name of ['low', 'high']) {
    const c = CANVAS[name], bleed = mapRow({x: 0, y: 0, w: 960, h: 540}, c), body = mapRow({x: 60, w: 840}, c);
    assert.deepEqual([bleed.x, bleed.y, bleed.w, bleed.h], [0, 0, c.w, c.h]);
    assert.deepEqual([body.x, body.w], [c.margin, c.w - 2 * c.margin]);
  }
});

test('canvas: the foot band and the caps follow the tier', () => {
  assert.equal(footTop({canvas: 'high'}, 720), 664);
  assert.equal(footTop({}, 540), 472);
  const s = {els: Array.from({length: 9}, (_, k) => ({x: 0, y: k * 30, w: 100, role: 'Body', text: 'point'}))};
  assert.match(densityReport(s, {}, 'reading') || '', /≤ 8 points/);
  assert.equal(densityReport(s, {}, 'reading', null, 'high'), null);
  assert.match(densityReport(s, {}, 'reading', null, 'low') || '', /≤ 4 points/);
});

test('canvas: library layouts cut to the tier only when a deck names it', () => {
  const slides = [{layout: 'content'}];
  assert.equal(libraryFor({w: 960, h: 540, slides}).content.title.x, 60);
  assert.equal(libraryFor({w: 1280, h: 720, canvas: 'high', slides}).content.title.x, 32);
});

test('canvas: an unknown tier and a non-slides format are errors', () => {
  assert.ok(validateModel(model({canvas: 'huge'})).errors.some(m => /unknown canvas/.test(m)));
  assert.ok(validateModel({...model({canvas: 'high'}), format: 'carousel'}).errors.some(m => /slides only/.test(m)));
});

test('canvas: new --canvas high scaffolds a clean deck', () => {
  const r = validateModel(newModel({slides: 8, canvas: 'high'}));
  assert.deepEqual([r.errors, r.warnings], [[], []]);
});

test('canvas: a viewer that blocks scripts is told so instead of showing markup', () => {
  const tpl = fs.readFileSync(new URL('../template.html', import.meta.url), 'utf8');
  assert.match(tpl, /#canvas>noscript\{display:none\}#canvas>noscript:has\(>\.still\)\{display:contents\}/);
  assert.match(tpl, /#canvas:has\(>noscript\)::before\{content:"This viewer blocks scripts/);
  assert.ok(tpl.indexOf('#canvas:has(>noscript>.still)::before{content:none}') > 0);
});
