// decklet has no groups — every row is its own object. A card is a painted box row plus text rows drawn over it, and each of
// them selects, drags, nudges and deletes ALONE. Nothing in the model links two rows; a multi-row move is the human's own
// selection (⌘-click, a marquee), made on the spot and gone at the next click. This gate holds the absence: the prop is out of
// the contract, out of the library's slots, out of what charts and figures emit, and out of the editor.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {expandCharts} from '../lib/chart.mjs';
import {diagramSlide} from '../lib/diagram.mjs';
import {LIBRARY, libraryFor} from '../lib/layouts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-nogroup-'));
const roles = create({slides: [{els: []}]}).deck.styles.roles;
const base = els => ({w: 960, h: 540, title: 'no groups', styles: {roles}, slides: [{els}]});
// a card: a painted rect with text rows hand-positioned inside it, and one row outside it. Four independent rows, no link.
const card = [
  {x: 100, y: 100, w: 300, h: 200, bg: 'var(--box)', bd: '1px solid var(--line)', radius: 8},
  {x: 116, y: 116, w: 268, role: 'Label', text: 'Watchlist'},
  {x: 116, y: 150, w: 268, role: 'Body', text: 'AAPL  +2.1%'},
  {x: 116, y: 180, w: 268, role: 'Body', text: 'MSFT  +0.8%'},
  {x: 500, y: 100, w: 300, role: 'H1', text: 'Not in the card'},
];

test('no groups: the card of independent rows validates clean', () => {
  assert.equal(validate(base(card)).errors.length, 0);
});

test('no groups: validate refuses a `group` prop and says every row moves on its own', () => {
  const bad = validate(base([{...card[0], group: 'c'}, {...card[1], group: 'c'}]));
  assert.equal(bad.errors.length, 2);
  for (const e of bad.errors) assert.match(e, /`group` is gone — every row moves on its own/);
});

test('no groups: create strips a `group` a stale model still carries, and builds', () => {
  const {deck, html} = create(base(card.map(r => ({...r, group: 'c'}))));
  assert.equal(deck.slides[0].els.filter(r => r.group != null).length, 0, 'no row kept it');
  assert.ok(!/"group"/.test(html.split('/*DECK*/')[1] || ''), 'and none reached the file');
});

test('no groups: SKILL.md no longer documents the prop', () => {
  const skill = read('SKILL.md');
  assert.doesNotMatch(skill, /^\| `group` \| string \|/m, 'no row-table entry');
  assert.doesNotMatch(skill, /sharing one `group`/, 'no card-by-group idiom');
});

test('no groups: the engine has no group selection, no group box', () => {
  const tpl = read('template.html');
  assert.doesNotMatch(tpl, /\bgrp\(/, 'no group expansion on select');
  assert.doesNotMatch(tpl, /gbox/, 'no union box round a "unit"');
});

test('no groups: a chart expands to plain rows', () => {
  const chart = {mark: 'bar', data: [{label: 'A', value: 1}, {label: 'B', value: 2}]};
  const d = expandCharts({...base([{x: 60, y: 136, w: 840, h: 276, chart}])});
  const rows = d.slides[0].els;
  assert.ok(rows.length > 4, 'the chart expanded');
  assert.equal(rows.filter(r => r.group != null).length, 0, 'every bar, label and rule stands alone');
});

test('no groups: a figure expands to plain rows', () => {
  const s = diagramSlide({w: 840, h: 300, label: 'One leads to Two', nodes: [{id: 'a', x: 8, y: 8, w: 160, h: 60, title: 'One'}, {id: 'b', x: 300, y: 8, w: 160, h: 60, title: 'Two'}],
    edges: [{from: 'a', to: 'b', label: 'then'}], groups: [{x: 4, y: 4, w: 480, h: 90, label: 'Zone'}]}, {title: 'A figure', caption: 'One leads to Two.'});
  assert.ok(s.els.length > 4, 'the figure expanded');
  assert.equal(s.els.filter(r => r.group != null).length, 0, 'node, title, connector and chip each stand alone');
});

test('no groups: no library slot carries one, at any canvas size', () => {
  const slotted = Object.entries(LIBRARY).flatMap(([n, d]) => Object.entries(d.slots || {}).map(([k, sl]) => [`${n}.${k}`, sl]));
  assert.ok(slotted.length > 100, 'the catalogue was read');
  assert.deepEqual(slotted.filter(([, sl]) => sl && sl.group != null).map(([n]) => n), []);
  const lay = libraryFor({w: 1600, h: 900, slides: [{layout: 'kpi-grid'}]})['kpi-grid'];
  assert.deepEqual(Object.entries(lay).filter(([, sl]) => sl && sl.group != null).map(([n]) => n), [], 'scaling invents none');
  // the catalogue's own `group` — the shelf a layout is filed under — is a different thing and stays
  assert.equal(LIBRARY['kpi-grid'].group, 'numbers');
});

live('live: a card\'s tile drags alone; the text rows stay where they are', async () => {
  const f = path.join(tmp, 'nogroup.html'); fs.writeFileSync(f, create(base(card)).html);
  const b = await pw.chromium.launch();
  try {
  const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForTimeout(150); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(150);
  const xy = () => p.evaluate(() => slide().els.map(e => [e.x, e.y]));
  const selKeys = () => p.evaluate(() => [...sel].sort());
  const centre = async n => p.evaluate(n => { const r = canvas.querySelector(`[data-n="${n}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, n);
  // the tile's own centre is covered by the text rows drawn over it (row order is z-order), so grab it low, under the copy
  const low = async n => p.evaluate(n => { const r = canvas.querySelector(`[data-n="${n}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.85]; }, n);
  const scale = await p.evaluate(() => canvas.getBoundingClientRect().width / W);
  const dragFrom = async ([x, y], dx, dy) => { await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + dx * scale, y + dy * scale, {steps: 4}); await p.mouse.up(); };
  const start = await xy();
  const near = (a, b, msg) => assert.ok(a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) <= 1), `${msg}: ${a} vs ${b}`);
  // 1. grab the tile: it alone is selected, it alone travels
  await dragFrom(await low(0), 30, 20);
  assert.deepEqual(await selKeys(), [0], 'the tile was taken alone');
  let now = await xy();
  near(now[0], [start[0][0] + 30, start[0][1] + 20], 'the tile travelled');
  for (const n of [1, 2, 3, 4]) assert.deepEqual(now[n], start[n], `row ${n} stayed`);
  assert.equal(await p.evaluate(() => canvas.querySelectorAll('.gbox').length), 0, 'nothing draws a unit box');
  // 2. nudge moves only the selected row
  await p.keyboard.press('ArrowRight'); const nudged = await xy();
  assert.deepEqual(nudged[0], [now[0][0] + 1, now[0][1]], 'the tile nudged');
  for (const n of [1, 2, 3, 4]) assert.deepEqual(nudged[n], start[n], `row ${n} stayed`);
  now = nudged;
  // 3. a text row inside the card drags out of it — nothing holds it
  await p.mouse.click(1200, 700); assert.deepEqual(await selKeys(), [], 'click-off cleared');
  await dragFrom(await centre(2), 0, 220);
  assert.deepEqual(await selKeys(), [2], 'the text row was taken alone');
  const moved = await xy();
  near(moved[2], [start[2][0], start[2][1] + 220], 'it left the card');
  for (const n of [0, 1, 3, 4]) assert.deepEqual(moved[n], now[n], `row ${n} stayed`);
  // 4. a marquee is still a multi-row selection — the human's, made on the spot
  await p.mouse.click(1200, 700);
  const cr = await p.evaluate(() => { const r = canvas.getBoundingClientRect(); return [r.left, r.top]; });
  const at = (x, y) => [cr[0] + x * scale, cr[1] + y * scale];   // model px → screen px
  const m = at(104, 88), m2 = at(470, 344);                      // round the card as it now stands: the tile, its label and its second line
  await p.mouse.move(m[0], m[1]); await p.mouse.down(); await p.mouse.move(m2[0], m2[1], {steps: 4}); await p.mouse.up();
  assert.deepEqual(await selKeys(), [0, 1, 3], 'the band took the rows it contains — the one dragged out is not among them');
  // 5. undo walks back the three moves
  await p.mouse.click(1200, 700);
  for (let k = 0; k < 3; k++) await p.keyboard.press('Meta+z');
  assert.deepEqual(await xy(), start, 'undo restored every row');
  assert.deepEqual(errs, []);
  } finally { await b.close(); }   // a failure must not leave a browser open: the suite would hang on the handle
});
