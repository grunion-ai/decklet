// decklet layout library gate — the catalogue is an accelerant, never a fence: a slide may use a library layout, a deck
// layout or free rows, and may mix library slots with extra free rows. Nothing that worked before the library may stop.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validate, ROLES} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {verify} from '../bin/verify.mjs';
import {LIBRARY, GROUPS, libraryFor, catalogue} from '../lib/layouts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-lib-'));

export const NAMES = ['cover', 'agenda', 'section', 'statement', 'fact', 'quote', 'two-cols', 'two-cols-header', 'image-left', 'image-right',
  'kpi-grid', 'kpi-grid-4', 'stat', 'chart', 'comparison', 'process-steps', 'timeline', 'cta', 'end'];
const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#5B9CF6"/></svg>');
// one slide per library layout, every slot bound with plausible content
export const fill = (name, k = 0) => {
  const lay = LIBRARY[name];
  const els = Object.entries(lay.slots).map(([slot, sl]) => {
    if (slot === 'image') return {slot, img: IMG, fit: 'cover'};
    if (slot === 'chart') return {slot, bg: 'var(--box)'};   // a painted stand-in until the chart row lands
    if (!sl.role) return {slot};                              // paint slots (rule, dots, button): the slot carries the paint
    const text = {Title: 'Two lines of display headline', Supertitle: 'Kicker', H1: 'A content-slide title', H2: 'A second-level heading',
      Body: 'Body copy, two short sentences at most. Enough to wrap once.', Caption: 'Source · caption text', Label: 'Label', Stat: '63%', Stat2: '$1.2M'}[sl.role];
    return {slot, text: /^(n\d|t\d)$/.test(slot) ? '0' + (slot.slice(1)) : /delta/.test(slot) ? '↑ 8 pts' : /label/.test(slot) ? 'Renewals' : text};
  });
  return {name: `${name}-${k}`, layout: name, els};
};
export const everyLayout = (w = 960, h = 540) => ({w, h, title: 'library', styles: {margin: 60}, master: [{id: 'foot', footer: 1, x: 60, y: 500, w: 300, role: 'Label', text: 'library'}],
  slides: NAMES.map((n, k) => fill(n, k))});

test('library: every layout is complete, its slots wear a role from the scale (or carry paint), the names are the catalogue', () => {
  assert.deepEqual(Object.keys(LIBRARY), NAMES, 'the catalogue, in group order');
  for (const [name, lay] of Object.entries(LIBRARY)) {
    assert.ok(GROUPS.includes(lay.group), `${name}: group ${lay.group}`);
    assert.match(lay.use, /^[A-Z].{20,}\.$/, `${name}: one sentence of use`);
    assert.ok(['speaker', 'reading'].includes(lay.density), `${name}: density`);
    assert.ok(Object.keys(lay.slots).length >= 2, `${name}: slots`);
    for (const [slot, sl] of Object.entries(lay.slots)) {
      if (sl.role) assert.ok([...ROLES, 'Stat2'].includes(sl.role), `${name}.${slot}: role ${sl.role}`);
      else assert.ok(sl.h != null || sl.line, `${name}.${slot}: a roleless slot is paint or media and carries h (or a line)`);
      for (const p of ['x', 'y']) assert.equal(typeof sl[p], 'number', `${name}.${slot}.${p}`);
      assert.ok(typeof sl.w === 'number' || sl.w === 'auto', `${name}.${slot}.w`);
      if (typeof sl.w === 'number') assert.ok(sl.x + sl.w <= 900 && sl.x >= 60, `${name}.${slot} inside the 60px margins`);
    }
  }
  assert.ok(Object.keys(LIBRARY['kpi-grid'].slots).filter(s => /^kpi\d$/.test(s)).length === 3 && Object.keys(LIBRARY['kpi-grid-4'].slots).filter(s => /^kpi\d$/.test(s)).length === 4, 'three or four tiles');
  for (const n of ['kpi-grid', 'kpi-grid-4']) for (const k of [1, 2, 3]) for (const s of [`kpi${k}`, `kpi${k}-label`, `kpi${k}-delta`]) assert.ok(LIBRARY[n].slots[s], `${n}.${s}: value + label + delta`);
  for (const s of ['supertitle', 'title', 'chart', 'takeaway', 'source']) assert.ok(LIBRARY.chart.slots[s], 'chart: ' + s);
  assert.equal(LIBRARY.stat.slots.stat.role, 'Stat', 'stat is the hero number');
});

test('library: a deck using every layout validates clean — and a deck-defined layout of the same name wins', () => {
  const v = validate(create(everyLayout()).deck);
  assert.deepEqual(v.errors, []); assert.deepEqual(v.warnings, []);
  const own = {w: 960, h: 540, layouts: {cover: {title: {x: 10, y: 10, w: 500, role: 'H1'}}}, slides: [{layout: 'cover', els: [{slot: 'title', text: 'mine'}]}]};
  const d = create(own).deck;
  assert.deepEqual(d.layouts.cover, own.layouts.cover, 'the deck keeps its own cover');
  assert.deepEqual(Object.keys(d.layouts), ['cover'], 'only referenced names are merged');
  assert.deepEqual(validate(d).errors, []);
});

test('library: create merges only the layouts a slide references, scaled to the canvas', () => {
  const d = create({w: 960, h: 540, slides: [{layout: 'two-cols', els: [{slot: 'title', text: 'x'}]}]}).deck;
  assert.deepEqual(Object.keys(d.layouts), ['two-cols']);
  assert.deepEqual(d.layouts['two-cols'].right, LIBRARY['two-cols'].slots.right);
  const big = create({slides: [{layout: 'two-cols', els: [{slot: 'title', text: 'x'}]}]}, {space: '1600x900'}).deck;
  const s = LIBRARY['two-cols'].slots.right, b = big.layouts['two-cols'].right;
  assert.deepEqual([b.x, b.y, b.w], [s.x, s.y, s.w].map(v => Math.round(v * 1600 / 960)), '1600×900 scales the geometry 1.67×');
  assert.equal(b.role, s.role);
  assert.deepEqual(libraryFor({w: 960, h: 540, slides: [{els: []}]}), {}, 'nothing referenced → nothing merged');
});

test('library: an unknown layout still errors, and the error lists the library names', () => {
  const v = validate(create({w: 960, h: 540, slides: [{layout: 'hero-bento', els: []}]}).deck);
  assert.equal(v.errors.length, 1);
  assert.match(v.errors[0], /layout "hero-bento" not in deck\.layouts or the library \(cover, agenda, .*, end\)/);
});

test('library: a slide mixes a library layout with free rows (and nudges a slot with its own x/y)', () => {
  const m = {w: 960, h: 540, slides: [{layout: 'kpi-grid', els: [
    {slot: 'title', text: 'Renewals'},
    {slot: 'kpi1', text: '63%'}, {slot: 'kpi1-label', text: 'renewed'},
    {slot: 'kpi2', text: '41'}, {slot: 'kpi2-label', text: 'days early', y: 296},
    {x: 60, y: 400, w: 400, role: 'Caption', text: 'a free caption row beside the tiles'},
    {x: 500, y: 400, line: [900, 400], h: 1, bg: 'var(--line)'},
  ]}]};
  const v = validate(create(m).deck);
  assert.deepEqual(v.errors, []); assert.deepEqual(v.warnings, []);
});

test('library: the catalogue printer lists every layout with its group, use and slots; validate --layouts prints it', () => {
  const c = catalogue();
  for (const g of GROUPS) assert.ok(c.includes(g), g);
  for (const [name, lay] of Object.entries(LIBRARY)) {
    assert.ok(c.includes(name), name); assert.ok(c.includes(lay.use), name + ' use');
    for (const s of Object.keys(lay.slots)) assert.ok(c.includes(s), `${name}.${s}`);
  }
  const r = spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), '--layouts'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, c + '\n');
});

test('library: SKILL.md documents the catalogue and the mixing rule', () => {
  const doc = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  const sec = doc.slice(doc.indexOf('## LAYOUT LIBRARY'));
  assert.ok(sec.length > 500, 'a LAYOUT LIBRARY section');
  for (const n of NAMES) assert.ok(new RegExp('`' + n + '`').test(sec), n + ' in the catalogue table');
  assert.match(sec, /validate\.mjs --layouts/); assert.match(sec, /free rows/); assert.match(sec, /override/);
});

live('live: a deck using every library layout renders — parity holds, zero page errors; so does the mixed slide', async () => {
  for (const [n, m] of [['every-layout', everyLayout()], ['mixed', {w: 960, h: 540, slides: [{layout: 'kpi-grid', els: [
    {slot: 'title', text: 'Renewals'}, {slot: 'kpi1', text: '63%'}, {slot: 'kpi1-label', text: 'renewed'}, {slot: 'kpi1-delta', text: '↑ 8 pts'},
    {x: 60, y: 400, w: 400, role: 'Caption', text: 'a free caption row beside the tiles'}, {x: 500, y: 400, line: [900, 400], h: 1, bg: 'var(--line)'}]}]}]]) {
    const f = path.join(tmp, n + '.html'); fs.writeFileSync(f, create(m).html);
    const r = await verify(f, {out: path.join(tmp, 'v-' + n), strict: true, log: () => {}});
    assert.deepEqual(r.errors, [], n + ': ' + JSON.stringify(r.parity.filter(p => !p.pass)));
    assert.equal(r.parity.length, m.slides.length);
  }
});
