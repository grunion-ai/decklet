// decklet after-anchor gate — `after: '<rowId>'` puts a row's x at the named row's rendered right edge + `gap` (10 by default),
// on the named row's top unless the row states y. A text row, an arrow and a chip chain on one line with no guessed x, and each
// keeps its gap when the text before it grows (Kyle's review: arrows touching the chips they join, FRICTION F13).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {verify, modelOf} from '../bin/verify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-after-'));
const styles = modelOf(read('template.html')).styles;
const deckOf = els => ({w: 960, h: 540, styles, slides: [{els}]});
// the chain under test: text, then an arrow after it, then a chip after the arrow
const chain = (text = 'Autodesk Fusion') => [
  {id: 't', x: 60, y: 100, w: 'auto', role: 'Body', nowrap: 1, text},
  {id: 'a', after: 't', x: 0, y: 112, line: [60, 112], arrow: 'end', h: 3},
  {id: 'c', after: 'a', y: 100, w: 'auto', role: 'Label', p: 'chip', nowrap: 1, bg: 'var(--box)', radius: 4, text: 'acquired 2024'},
];

test('after: validate accepts the text → arrow → chip chain', () => {
  const v = validate(deckOf(chain()));
  assert.deepEqual(v.errors, []);
});

test('after: unknown ids, cycles, after+right and after+x on a box row are errors; a bad gap is an error', () => {
  assert.match(validate(deckOf([{after: 'nope', y: 10, w: 'auto', role: 'Body', text: 'x'}])).errors.join('\n'), /after "nope" is not a row id/);
  const cyc = validate(deckOf([
    {id: 'p', after: 'q', y: 10, w: 'auto', role: 'Body', text: 'p'},
    {id: 'q', after: 'p', y: 60, w: 'auto', role: 'Body', text: 'q'},
  ])).errors.join('\n');
  assert.match(cyc, /after cycle: p → q → p/);
  const base = {id: 'b', x: 60, y: 10, w: 100, h: 20, bg: '#000'};
  assert.match(validate(deckOf([base, {after: 'b', right: 60, y: 10, w: 'auto', role: 'Body', text: 'x'}])).errors.join('\n'), /after and right are exclusive/);
  assert.match(validate(deckOf([base, {after: 'b', x: 300, y: 10, w: 'auto', role: 'Body', text: 'x'}])).errors.join('\n'), /after and x are exclusive/);
  assert.match(validate(deckOf([base, {after: 'b', gap: '8', y: 10, w: 'auto', role: 'Body', text: 'x'}])).errors.join('\n'), /gap must be a number/);
});

test('after: the gap gate places an after row — exact after a declared width, ~ after an estimated one', () => {
  // b spans 60..160, so a 50px box after it sits at 170..220; a row at 200 collides on declared geometry: an error, not a guess
  const hit = validate(deckOf([
    {id: 'b', x: 60, y: 10, w: 100, h: 20, bg: '#000'},
    {id: 'k', after: 'b', w: 50, h: 20, bg: '#111', role: 'Label', text: 'k'},
    {x: 200, y: 10, w: 40, h: 20, bg: '#222', role: 'Label', text: 'z'},
  ]));
  assert.ok(hit.errors.some(m => /els\[1\].*overlaps.*els\[2\]/.test(m) && !/~/.test(m)), hit.errors.join('\n'));
  // after an auto-width text row the x is an estimate: the same collision is a ~ warning
  const est = validate(deckOf([
    {id: 't', x: 60, y: 10, w: 'auto', role: 'Body', nowrap: 1, text: 'Autodesk'},
    {id: 'k', after: 't', w: 200, h: 100, bg: '#111', role: 'Label', text: 'k'},
    {x: 300, y: 10, w: 200, h: 100, bg: '#222', role: 'Label', text: 'z'},
  ]));
  assert.ok(est.warnings.some(m => /els\[1\].*~/.test(m)), est.warnings.join('\n'));
});

live('live: text → arrow → chip each keep the gap, follow a longer text, and a drag converts after to x', async () => {
  const f = path.join(tmp, 'after.html'); fs.writeFileSync(f, create(deckOf(chain())).html);
  const r = await verify(f, {out: path.join(tmp, 'v-after'), strict: true, log: () => {}});
  assert.deepEqual(r.errors, [], JSON.stringify(r.parity.filter(p => !p.pass)));
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  await p.evaluate(async () => { localStorage.clear(); canvas.style.transform = 'none'; await document.fonts.ready; render(); });
  const cv = await p.locator('#canvas').boundingBox();
  const box = n => p.locator(`#canvas .el[data-n="${n}"]`).boundingBox();
  const edges = async () => {
    const t = await box(0), a = await box(1), head = await p.locator('#canvas .el[data-n="1"] svg.ar').boundingBox(), c = await box(2);
    return {tRight: t.x + t.width - cv.x, aLeft: a.x - cv.x, aRight: head.x + head.width - cv.x, cLeft: c.x - cv.x, cTop: c.y - cv.y};
  };
  const near = (a, b, m) => assert.ok(Math.abs(a - b) <= 1, `${m}: ${a} vs ${b}`);
  let e = await edges();
  near(e.aLeft - e.tRight, 10, 'arrow tail 10px after the text');
  near(e.aRight - e.aLeft, 60, 'the arrow keeps its authored 60px run');
  near(e.cLeft - e.aRight, 10, 'chip 10px after the arrow head');
  near(e.cTop, 100, 'the chip keeps its stated y');
  // a longer text pushes the whole chain right, every gap held
  await p.evaluate(() => { slide().els[0].text = 'Autodesk Fusion 360 with Generative Design'; render(); });
  const e2 = await edges();
  assert.ok(e2.tRight > e.tRight + 100, 'the text grew');
  near(e2.aLeft - e2.tRight, 10, 'arrow still 10px after the text');
  near(e2.cLeft - e2.aRight, 10, 'chip still 10px after the arrow');
  // the contact sheet and print draw into a detached root: the chain still resolves there
  const off = await p.evaluate(() => { const c = document.createElement('div'); drawEls(slide(), c, false); return c.isConnected ? -1 : parseFloat(c.querySelector('[data-n="2"]').style.left); });
  near(off, e2.cLeft, 'a detached root places the chip the same');
  // drag the chip 20px right: after is gone, x is the placed x + 20, and it does not move again when the text changes
  const c = await box(2), cx = c.x + c.width / 2, cy = c.y + c.height / 2;
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 10, cy); await p.mouse.move(cx + 20, cy); await p.mouse.up();
  const row = n => p.evaluate(k => structuredClone(slide().els[k]), n);
  const moved = await row(2);
  assert.equal(moved.after, undefined, 'after removed');
  assert.ok(Math.abs(moved.x - (e2.cLeft + 20)) <= 1, `x = placed + 20: ${moved.x} vs ${e2.cLeft + 20}`);
  assert.equal(moved.y, 100);
  // the arrow-key nudge converts the arrow the same way: its x and its line travel together from the placed geometry
  await p.evaluate(() => { sel.clear(); sel.add(1); render(); });
  await p.keyboard.press('ArrowRight');
  const arrow = await row(1);
  assert.equal(arrow.after, undefined, 'the nudged arrow is absolute');
  near(arrow.x, e2.aLeft + 1, 'arrow x = placed + 1');
  near(arrow.line[0] - arrow.x, 60, 'the run is unchanged');
  assert.deepEqual(errs, []);
  await b.close();
});
