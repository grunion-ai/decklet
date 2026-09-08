// decklet group gate — a card is a tile plus its rows sharing one `group`. The model stays flat (canvas-space x/y on every
// row); the editor treats a group as ONE drag/nudge/marquee unit, ⌘-click takes a member alone. Charts and the library's
// composite slots (kpi tiles, process steps, timeline events, the cta button) are born grouped.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {expandCharts} from '../lib/chart.mjs';
import {LIBRARY, libraryFor} from '../lib/layouts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-group-'));
const roles = create({slides: [{els: []}]}).deck.styles.roles;
const base = els => ({w: 960, h: 540, title: 'group', styles: {roles}, slides: [{els}]});
// the reported shape: a bg+bd+radius rect plus text rows hand-positioned inside it, and one row outside the card
const card = [
  {x: 100, y: 100, w: 300, h: 200, bg: 'var(--box)', bd: '1px solid var(--line)', radius: 8, group: 'c'},
  {x: 116, y: 116, w: 268, role: 'Label', text: 'Watchlist', group: 'c'},
  {x: 116, y: 150, w: 268, role: 'Body', text: 'AAPL  +2.1%', group: 'c'},
  {x: 116, y: 180, w: 268, role: 'Body', text: 'MSFT  +0.8%', group: 'c'},
  {x: 500, y: 100, w: 300, role: 'H1', text: 'Not in the card'},
];

test('group: validate accepts a string group id and rejects anything else', () => {
  assert.equal(validate(base(card)).errors.length, 0);
  const bad = validate(base([{...card[0], group: 3}, {...card[1], group: {id: 'c'}}]));
  assert.equal(bad.errors.length, 2); for (const e of bad.errors) assert.match(e, /group must be a string/);
});

test('group: SKILL.md documents the prop in the row table and the card idiom', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /^\| `group` \| string \|/m, 'a row-table entry');
  assert.match(skill, /a card is a tile plus its rows sharing one `group`/, 'the card idiom');
});

test('group: a chart expands to rows that share one group id — the author\'s when the chart row carries one', () => {
  const chart = {mark: 'bar', data: [{label: 'A', value: 1}, {label: 'B', value: 2}]};
  const d = expandCharts({...base([{x: 60, y: 136, w: 840, h: 276, chart}, {x: 60, y: 136, w: 840, h: 276, chart, group: 'mine'}])});
  const rows = d.slides[0].els, mine = rows.filter(r => r.group === 'mine'), auto = rows.filter(r => r.group !== 'mine');
  assert.ok(mine.length > 4 && auto.length > 4, 'both charts expanded');
  assert.equal(new Set(auto.map(r => r.group)).size, 1, 'one generated id for the whole chart');
  assert.equal(typeof auto[0].group, 'string'); assert.notEqual(auto[0].group, 'mine');
});

test('group: the library\'s composite slots are born grouped, and the group survives scaling', () => {
  for (const n of ['kpi-grid', 'kpi-grid-4']) for (const k of [1, 2, 3]) {
    const g = [`kpi${k}`, `kpi${k}-delta`, `kpi${k}-label`].map(s => LIBRARY[n].slots[s].group);
    assert.equal(typeof g[0], 'string'); assert.equal(new Set(g).size, 1, `${n}: tile ${k} is one unit`);
  }
  assert.notEqual(LIBRARY['kpi-grid'].slots.kpi1.group, LIBRARY['kpi-grid'].slots.kpi2.group, 'tiles are distinct units');
  for (const k of [1, 2, 3, 4]) assert.equal(LIBRARY['process-steps'].slots[`n${k}`].group, LIBRARY['process-steps'].slots[`step${k}`].group, 'number + step');
  for (const k of [1, 2, 3, 4]) assert.equal(new Set([`d${k}`, `t${k}`, `e${k}`].map(s => LIBRARY.timeline.slots[s].group)).size, 1, 'dot + date + event');
  assert.equal(LIBRARY.cta.slots.button.group, LIBRARY.cta.slots['button-label'].group, 'button + label');
  const lay = libraryFor({w: 1600, h: 900, slides: [{layout: 'kpi-grid'}]})['kpi-grid'];
  assert.equal(lay.kpi1.group, LIBRARY['kpi-grid'].slots.kpi1.group, 'scaling keeps the group');
  assert.equal(validate(create({w: 960, h: 540, slides: [{layout: 'kpi-grid', els: [{slot: 'kpi1', text: '63%'}, {slot: 'kpi1-label', text: 'Renewals'}]}]}).deck).errors.length, 0);
});

live('live: a group drags, nudges, marquees and undoes as one; ⌘-click takes a member alone', async () => {
  const f = path.join(tmp, 'group.html'); fs.writeFileSync(f, create(base(card)).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForTimeout(150); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(150);
  const xy = () => p.evaluate(() => slide().els.map(e => [e.x, e.y]));
  const selKeys = () => p.evaluate(() => [...sel].sort());
  const centre = async n => p.evaluate(n => { const r = canvas.querySelector(`[data-n="${n}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, n);
  const scale = await p.evaluate(() => canvas.getBoundingClientRect().width / W);
  const dragFrom = async ([x, y], dx, dy, mods = []) => { await p.mouse.move(x, y); for (const m of mods) await p.keyboard.down(m); await p.mouse.down(); await p.mouse.move(x + dx * scale, y + dy * scale, {steps: 4}); await p.mouse.up(); for (const m of mods) await p.keyboard.up(m); };
  const start = await xy();
  const near = (a, b, msg) => assert.ok(a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) <= 1), `${msg}: ${a} vs ${b}`); // mouse pixels round through the canvas scale
  // 1. drag the tile by 30,20 (model px): every member moves by 30,20; the outside row stays
  await dragFrom(await centre(0), 30, 20);
  assert.deepEqual(await selKeys(), [0, 1, 2, 3], 'grabbing the tile selected the whole card');
  let now = await xy();
  for (const n of [0, 1, 2, 3]) near(now[n], [start[n][0] + 30, start[n][1] + 20], `member ${n} travelled with the tile`);
  assert.equal(new Set([0, 1, 2, 3].map(n => `${now[n][0] - start[n][0]},${now[n][1] - start[n][1]}`)).size, 1, 'one delta for every member');
  assert.deepEqual(now[4], start[4], 'the outside row stayed');
  assert.equal(await p.evaluate(() => canvas.querySelectorAll('.gbox').length), 1, 'the selection shows the group as one box');
  const gb = await p.evaluate(() => { const g = canvas.querySelector('.gbox').getBoundingClientRect(), t = canvas.querySelector('[data-n="0"]').getBoundingClientRect(); return [g.left <= t.left + 1, g.top <= t.top + 1, g.right >= t.right - 1, g.bottom >= t.bottom - 1]; });
  assert.deepEqual(gb, [true, true, true, true], 'the group box spans the union');
  // 2. nudge: ArrowRight moves all four by 1
  const now0 = now; await p.keyboard.press('ArrowRight'); now = await xy();
  for (const n of [0, 1, 2, 3]) assert.deepEqual(now[n], [now0[n][0] + 1, now0[n][1]], `member ${n} nudged`);
  assert.deepEqual(now[4], start[4]);
  // 3. marquee wholly containing the tile alone still takes the group
  await p.mouse.click(1200, 700); assert.deepEqual(await selKeys(), [], 'click-off cleared');
  const cr = await p.evaluate(() => { const r = canvas.getBoundingClientRect(); return [r.left, r.top]; });
  const tile = now[0], m = [cr[0] + (tile[0] - 6) * scale, cr[1] + (tile[1] - 6) * scale];
  await p.mouse.move(m[0], m[1]); await p.mouse.down(); await p.mouse.move(m[0] + 312 * scale, m[1] + 212 * scale, {steps: 4}); await p.mouse.up();
  assert.deepEqual(await selKeys(), [0, 1, 2, 3], 'a band around the tile took the whole card');
  // 4. ⌘-click a member selects only it, and a drag moves only it
  await p.mouse.click(1200, 700);
  const c1 = await centre(1); await p.keyboard.down('Meta'); await p.mouse.click(c1[0], c1[1]); await p.keyboard.up('Meta');
  assert.deepEqual(await selKeys(), [1], '⌘-click took the member alone');
  await dragFrom(await centre(1), 0, 15);
  const solo = await xy();
  near(solo[1], [now[1][0], now[1][1] + 15], 'the member moved alone');
  for (const n of [0, 2, 3, 4]) assert.deepEqual(solo[n], now[n], `row ${n} stayed`);
  // 5. undo: the solo move, the nudge, then the drag — all four back where they started
  await p.mouse.click(1200, 700);
  for (let k = 0; k < 3; k++) await p.keyboard.press('Meta+z');
  assert.deepEqual(await xy(), start, 'undo restored every member');
  assert.deepEqual(errs, []); await b.close();
});
