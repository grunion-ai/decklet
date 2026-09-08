// decklet right-anchor gate — `right: N` puts a row's right edge N px from the canvas right edge, so a `w:'auto'` chip
// (which has no width at authoring time) can sit on a card's right edge without a guessed x. x and right are exclusive.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {verify, modelOf} from '../bin/verify.mjs';
import {LIBRARY, libraryFor} from '../lib/layouts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-anchor-'));
const styles = modelOf(read('template.html')).styles, roles = styles.roles;
const deckOf = els => ({w: 960, h: 540, styles, slides: [{els}]});

test('anchor: validate accepts right alone, rejects x+right and a non-numeric right — on rows and on slots', () => {
  assert.deepEqual(validate(deckOf([{right: 60, y: 100, w: 'auto', role: 'Label', p: 'chip', nowrap: 1, text: '+12%'}])).errors, []);
  const both = validate(deckOf([{x: 138, right: 60, y: 100, w: 'auto', role: 'Label', text: '+12%'}])).errors;
  assert.equal(both.length, 1); assert.match(both[0], /x and right are exclusive/);
  assert.match(validate(deckOf([{right: '60', y: 100, w: 100, role: 'Label', text: 'x'}])).errors[0], /right must be a number/);
  const sl = {w: 960, h: 540, styles: {roles}, layouts: {c: {chip: {x: 10, right: 60, y: 100, w: 'auto', role: 'Label'}}}, slides: [{layout: 'c', els: [{slot: 'chip', text: 'x'}]}]};
  assert.match(validate(sl).errors[0], /layouts\.c\.chip: x and right are exclusive/);
  // a slotted row overrides the slot's x with its own right, the way it overrides x with x — no error
  const ov = {w: 960, h: 540, styles: {roles}, layouts: {c: {chip: {x: 10, y: 100, w: 'auto', role: 'Label'}}}, slides: [{layout: 'c', els: [{slot: 'chip', right: 60, text: 'x'}]}]};
  assert.deepEqual(validate(ov).errors, []);
});

test('anchor: SKILL.md documents right in the row table and names the chip idiom', () => {
  const doc = read('SKILL.md');
  assert.match(doc, /^\| `right` \|/m, 'a `right` row in the row table');
  assert.match(doc, /`right:`, never a guessed `x`/, 'the idiom line');
});

test('anchor: the kpi-grid delta chips anchor to the tile\'s right edge, and the library scales right with x', () => {
  for (const n of ['kpi-grid', 'kpi-grid-4']) for (const [k, sl] of Object.entries(LIBRARY[n].slots)) if (/-delta$/.test(k)) {
    const tile = LIBRARY[n].slots[k.replace('-delta', '')];
    assert.equal(sl.x, undefined, `${n}.${k} carries no x`);
    assert.equal(sl.right, 960 - (tile.x + tile.w) + 12, `${n}.${k}: 12px in from the tile's right edge`);
  }
  const big = libraryFor({w: 1600, h: 900, slides: [{layout: 'kpi-grid', els: []}]})['kpi-grid']['kpi1-delta'];
  assert.equal(big.right, Math.round(LIBRARY['kpi-grid'].slots['kpi1-delta'].right * 1600 / 960));
});

live('live: a w:auto chip with right:60 lands its right edge at 900; a drag writes right, never x; a fixed-w row lands at W-right-w', async () => {
  const model = deckOf([
    {right: 60, y: 100, w: 'auto', role: 'Label', p: 'chip', nowrap: 1, bg: 'var(--box)', radius: 4, text: '+12% vs last quarter'},
    {right: 100, y: 200, w: 200, h: 40, bg: 'var(--box)', bd: '1px solid var(--line)'},
    {x: 60, y: 300, w: 300, role: 'Body', text: 'a plain row, untouched'},
  ]);
  const f = path.join(tmp, 'anchor.html'); fs.writeFileSync(f, create(model).html);
  const r = await verify(f, {out: path.join(tmp, 'v-anchor'), strict: true, log: () => {}});
  assert.deepEqual(r.errors, [], JSON.stringify(r.parity.filter(p => !p.pass)));
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  await p.evaluate(async () => { localStorage.clear(); canvas.style.transform = 'none'; await document.fonts.ready; });
  const cv = await p.locator('#canvas').boundingBox();
  const box = n => p.locator(`#canvas .el[data-n="${n}"]`).boundingBox();
  const row = n => p.evaluate(k => structuredClone(slide().els[k]), n);
  const chip = await box(0);
  assert.ok(Math.abs((chip.x + chip.width) - (cv.x + 900)) <= 1, `chip right edge at 900: ${chip.x + chip.width - cv.x}`);
  assert.ok(chip.width > 60 && chip.width < 300, 'the chip hugs its text');
  const fixed = await box(1);
  assert.ok(Math.abs(fixed.x - cv.x - (960 - 100 - 200)) <= 1, `fixed-w row at W-right-w: ${fixed.x - cv.x}`);
  // drag the chip 20px left: the model's right grows by 20, and no x is written
  const cx = chip.x + chip.width / 2, cy = chip.y + chip.height / 2;
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx - 10, cy); await p.mouse.move(cx - 20, cy); await p.mouse.up();
  const after = await row(0);
  assert.equal(after.right, 80, 'right became 80'); assert.equal(after.x, undefined, 'no x written');
  const moved = await box(0);
  assert.ok(Math.abs((moved.x + moved.width) - (cv.x + 880)) <= 1, `the painted chip followed: ${moved.x + moved.width - cv.x}`);
  // the arrow-key nudge goes through the same path
  await p.evaluate(() => { sel.clear(); sel.add(0); render(); });
  await p.keyboard.press('ArrowRight');
  assert.equal((await row(0)).right, 79, 'nudge right = right - 1'); assert.equal((await row(0)).x, undefined);
  assert.deepEqual(errs, []);
  await b.close();
});
