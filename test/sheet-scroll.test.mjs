// UAT, v0.14: in a 40-slide deck a contact-sheet drag could not reach a slot outside the viewport. The sheet now scrolls itself
// while a dragged thumbnail sits within 64px of its top or bottom edge (the HUD's top edge when the HUD is pinned over it):
// a requestAnimationFrame loop, faster the deeper the pointer, 20px a frame at the edge, half that under reduced motion. The
// drop target is recomputed every frame from the last pointer position, so a still pointer tracks the moving thumbnails, and a
// wheel scroll mid-drag moves the target too. Escape or pointercancel drops nothing. Live, on every project in
// test/helpers/projects.mjs, mouse and finger. Skipped without Playwright.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {projects, withProject} from './helpers/projects.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-sheet-scroll-'));
const deck40 = () => ({w: 960, h: 540, title: 'scroll', slides: Array.from({length: 40}, (_, n) => ({els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Slide ' + (n + 1)}]}))});
const DESK = {viewport: {width: 1280, height: 800}};
const watch = p => { p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); return p; };
const settled = async p => { await p.waitForFunction(() => document.getElementById('autosave').dataset.state !== 'busy', null, {timeout: 4000}); };
const openSheet = async (context, name, opts = DESK) => {
  const f = path.join(tmp, name); fs.writeFileSync(f, create(deck40()).html);
  const ctx = await context(opts); const p = watch(await ctx.newPage());
  await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload(); await settled(p);
  await p.evaluate(() => sheetOpen()); await p.waitForTimeout(80);
  return p;
};
const order = p => p.evaluate(() => deck.slides.map(s => s.els[0].text.replace('Slide ', '') | 0));
const cell = (p, n) => p.evaluate(n => { const r = grid.children[n].getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, r: r.right, t: r.top, b: r.bottom}; }, n);
// a slot's on-screen rect mid-drag: the grid position the drop target measures (pd.rects at lift, moved by the scroll since),
// never the cell's current rect, which is FLIPped aside to where it will land
const slot = (p, n) => p.evaluate(n => { const o = sheet.scrollTop - pd.s0, r = pd.rects[n]; return {x: r.left + r.width / 2, y: r.top - o + r.height / 2, l: r.left, r: r.right}; }, n);
const top = p => p.evaluate(() => sheet.scrollTop);
const max = p => p.evaluate(() => sheet.scrollHeight - sheet.clientHeight);
// the visible bottom of the sheet: the pinned HUD's top edge
const bottom = p => p.evaluate(() => Math.min(sheet.getBoundingClientRect().bottom, document.getElementById('hud').getBoundingClientRect().top));
const delta = async (p, ms = 200) => { const a = await top(p); await p.waitForTimeout(ms); return (await top(p)) - a; };
// the per-frame step, read in the page: the median of ten consecutive frame-to-frame scrollTop differences
const step = p => p.evaluate(() => new Promise(res => { const d = []; let last = sheet.scrollTop; const f = () => { const t = sheet.scrollTop; d.push(Math.abs(t - last)); last = t; if (d.length < 11) requestAnimationFrame(f); else { d.shift(); d.sort((a, b) => a - b); res(d[5]); } }; requestAnimationFrame(f); }));
const grab = async (p, n) => { const c = await cell(p, n); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x + 10, c.y + 10, {steps: 2}); return c; };
// the drag's state, for a failure message: is it live, where the page thinks the pointer is, the speed there, the loop, the edges
const why = p => p.evaluate(() => JSON.stringify({on: !!(pd && pd.on), ly: pd && pd.ly, v: pd && pd.on ? asSpeed(pd.ly) : null, loop: asId, max: pd && pd.max, top: sheet.scrollTop, sh: sheet.scrollHeight, ch: sheet.clientHeight, sheet: sheet.getBoundingClientRect().bottom, hud: document.getElementById('hud').getBoundingClientRect().top, ih: innerHeight}));
// headless WebKit on the Linux runner can hold a frame past 250ms (CI, #148: one 19px frame, then nothing for a quarter second), so
// the proofs that the sheet moves wait for movement on a timer, and the speed proofs count frames, never milliseconds
const moved = (p, dir) => p.evaluate(dir => new Promise(res => { const s0 = sheet.scrollTop, t0 = Date.now(), f = () => { const d = (sheet.scrollTop - s0) * dir; d > 0 || Date.now() - t0 > 5000 ? res(d) : setTimeout(f, 20); }; f(); }), dir);
// the distance scrolled over twelve frames (about 200ms at 60Hz), read in the page
const span = p => p.evaluate(() => new Promise(res => { const s0 = sheet.scrollTop; let n = 0; const f = () => ++n < 12 ? requestAnimationFrame(f) : res(sheet.scrollTop - s0); requestAnimationFrame(f); }));
const lifted = p => p.evaluate(() => !!document.querySelector('.cell.lift'));

for (const bn of projects()) {
  live(`sheet auto-scroll (${bn}): a still pointer in the bottom zone scrolls to the end and stops there; the drop lands last and survives a reload`, async () => withProject(pw, bn, async ({context}) => {
    const p = await openSheet(context, `down-${bn}.html`);
    assert.equal(await top(p), 0, 'the sheet opens at the top');
    const c = await grab(p, 0); const y = (await bottom(p)) - 4;
    await p.mouse.move(c.x, y, {steps: 4}); const ins0 = await p.evaluate(() => ins);
    const d1 = await moved(p, 1); assert.ok(d1 > 0, `the sheet scrolls under a still pointer ${d1 > 0 ? '' : await why(p)}`);
    const d2 = await moved(p, 1); assert.ok(d2 > 0, `and keeps scrolling ${d2 > 0 ? '' : await why(p)}`);
    await p.waitForFunction(() => sheet.scrollTop > 400, null, {timeout: 40000, polling: 50}); // past a row, so the slot under the pointer has changed
    const ghost = await p.evaluate(() => { const r = document.querySelector('.cell.lift').getBoundingClientRect(); return r.top + r.height / 2; });
    assert.ok(Math.abs(ghost - y) < 4, `the lifted thumbnail stays under the pointer (${ghost} vs ${y})`);
    assert.notEqual(await p.evaluate(() => ins), ins0, 'the insertion slot tracks the thumbnails moving under the still pointer');
    const end = await max(p);
    await p.waitForFunction(m => sheet.scrollTop >= m - 0.5, end, {timeout: 40000, polling: 50});
    { const d = await delta(p, 200); assert.equal(d, 0, `it stops at the end (${d}px after reaching ${end}; now ${await top(p)})`); }
    const last = await slot(p, 39); await p.mouse.move(last.r - 10, last.y, {steps: 3}); await p.mouse.up(); await p.waitForTimeout(400);
    const o = await order(p); assert.equal(o.at(-1), 1, `slide 1 landed last: ${o.slice(-3)}`); assert.equal(o[0], 2);
    await settled(p); await p.reload(); await settled(p);
    assert.equal((await order(p)).at(-1), 1, 'the new order survives a reload');
    assert.deepEqual(p.errs, []);
  }, {timeout: 150000}));

  live(`sheet auto-scroll (${bn}): from the bottom, the last slide dragged into the top zone scrolls up and drops first`, async () => withProject(pw, bn, async ({context}) => {
    const p = await openSheet(context, `up-${bn}.html`);
    await p.evaluate(() => { sheet.scrollTop = sheet.scrollHeight; }); await p.waitForTimeout(60);
    assert.ok(await top(p) > 1000, 'the sheet starts at the bottom');
    const c = await grab(p, 39);
    await p.mouse.move(c.x, 4, {steps: 4});
    { const d = await moved(p, -1); assert.ok(d > 0, `the sheet scrolls up under a still pointer ${d > 0 ? '' : await why(p)}`); }
    await p.waitForFunction(() => sheet.scrollTop <= 0, null, {timeout: 40000, polling: 50});
    assert.equal(await delta(p, 200), 0, 'it stops at the top');
    const first = await slot(p, 0); await p.mouse.move(first.l + 10, first.y, {steps: 3}); await p.mouse.up(); await p.waitForTimeout(400);
    const o = await order(p); assert.equal(o[0], 40, `slide 40 landed first: ${o.slice(0, 3)}`); assert.equal(o.at(-1), 39);
    assert.deepEqual(p.errs, []);
  }, {timeout: 150000}));

  live(`sheet auto-scroll (${bn}): speed ramps with depth, 20px a frame at the edge, half under reduced motion; leaving the zone or Escape stops it`, async () => withProject(pw, bn, async ({context}) => {
    const p = await openSheet(context, `ramp-${bn}.html`);
    const c = await grab(p, 0); const b = await bottom(p);
    await p.mouse.move(c.x, b - 64 + 6, {steps: 4}); await p.waitForTimeout(60);
    const shallow = await span(p);
    await p.mouse.move(c.x, b + 20, {steps: 2}); await p.waitForTimeout(60);
    const deep = await span(p);
    assert.ok(shallow > 0, `the zone's inner edge scrolls slowly (${shallow}px in 12 frames)`);
    assert.ok(deep > shallow * 3, `the edge is faster: ${deep} vs ${shallow} in 12 frames`);
    const s = await step(p); assert.ok(s >= 18 && s <= 20, `past the edge the step is about 20px a frame (${s})`);
    // leave the zone: the loop ends with the pointer still
    await p.mouse.move(c.x, 400, {steps: 3}); await p.waitForTimeout(60);
    assert.equal(await delta(p), 0, 'out of the zone, the sheet holds still');
    assert.ok(await lifted(p), 'and the drag is still live');
    // back in, then Escape: scrolling stops, nothing moves, the sheet stays open
    await p.mouse.move(c.x, b - 2, {steps: 2}); assert.ok((await moved(p, 1)) > 0, 'back in the zone, it scrolls again');
    await p.keyboard.press('Escape'); await p.waitForTimeout(40);
    assert.equal(await delta(p), 0, 'Escape stops the scroll');
    assert.equal(await lifted(p), false, 'Escape puts the thumbnail back');
    await p.mouse.up(); await p.waitForTimeout(300);
    assert.deepEqual(await order(p), Array.from({length: 40}, (_, n) => n + 1), 'Escape leaves the order unchanged');
    assert.equal(await p.evaluate(() => sheet.hidden), false, 'Escape during a drag cancels the drag, not the sheet');
    // reduced motion: the same edge, half the speed
    await p.emulateMedia({reducedMotion: 'reduce'}); await p.evaluate(() => { sheet.scrollTop = 0; });
    const c2 = await grab(p, 0); await p.mouse.move(c2.x, (await bottom(p)) + 20, {steps: 2}); await p.waitForTimeout(60);
    const r = await step(p); assert.ok(r >= 8 && r <= 10, `reduced motion caps the step near 10px a frame (${r})`);
    await p.mouse.up();
    assert.deepEqual(p.errs, []);
  }, {timeout: 150000}));

  live(`sheet auto-scroll (${bn}): a wheel scroll mid-drag moves the drop target under a still pointer`, async () => withProject(pw, bn, async ({context}) => {
    const p = await openSheet(context, `wheel-${bn}.html`);
    const c = await grab(p, 0); const mid = await cell(p, 4);
    await p.mouse.move(mid.r - 20, mid.y, {steps: 3}); const a = await p.evaluate(() => ins);
    assert.equal(await delta(p, 150), 0, 'mid-sheet, nothing auto-scrolls');
    await p.mouse.wheel(0, 700); await p.waitForFunction(() => sheet.scrollTop > 500, null, {timeout: 3000, polling: 50}); await p.waitForTimeout(100);
    const b = await p.evaluate(() => ins); assert.ok(b > a + 3, `the wheel moved the target: ${a} → ${b}`);
    await p.mouse.up(); await p.waitForTimeout(400);
    const o = await order(p); assert.equal(o.indexOf(1), b - 1, `slide 1 landed at the wheeled slot (${o.indexOf(1)})`);
    assert.deepEqual(p.errs, []);
  }, {timeout: 150000}));

  // the finger: the pointer events a touch drag fires (pointerType touch), dispatched through the sheet's own handlers
  live(`sheet auto-scroll (${bn}): a finger held in the bottom zone scrolls the sheet and drops at the end`, async () => withProject(pw, bn, async ({context}) => {
    const p = await openSheet(context, `finger-${bn}.html`, {viewport: {width: 412, height: 839}, hasTouch: true});
    const ev = (t, x, y) => p.evaluate(([t, x, y]) => { window.__f ||= grid.children[0]; __f.dispatchEvent(new PointerEvent(t, {bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0})); }, [t, x, y]);
    const c = await cell(p, 0); const y = (await bottom(p)) - 3;
    await ev('pointerdown', c.x, c.y); await ev('pointermove', c.x + 12, c.y + 2); await ev('pointermove', c.x, y);
    assert.ok((await moved(p, 1)) > 0, 'the held finger scrolls the sheet');
    await p.waitForFunction(() => sheet.scrollTop >= sheet.scrollHeight - sheet.clientHeight - 1, null, {timeout: 40000, polling: 50});
    const last = await slot(p, 39); await ev('pointermove', last.r - 4, last.y); await ev('pointerup', last.r - 4, last.y); await p.waitForTimeout(400);
    assert.equal((await order(p)).at(-1), 1, 'slide 1 landed last');
    assert.deepEqual(p.errs, []);
  }, {timeout: 150000}));
}

// a real finger (CDP touch, Chromium): the sheet scrolls, the page and body never do
if (projects(['chromium']).length) live('sheet auto-scroll (chromium, CDP touch): a real finger scrolls the sheet and never the page', async () => withProject(pw, 'chromium', async ({context}) => {
  const p = await openSheet(context, 'cdp.html', {viewport: {width: 412, height: 839}, hasTouch: true, isMobile: true, deviceScaleFactor: 2});
  const cdp = await p.context().newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y}]});
  const c = await cell(p, 0); const y = (await bottom(p)) - 3;
  await touch('touchStart', c.x, c.y); await touch('touchMove', c.x + 8, c.y + 8); await touch('touchMove', c.x, (c.y + y) / 2); await touch('touchMove', c.x, y);
  const d = await moved(p, 1); assert.ok(d > 0, `the finger's zone scrolls the sheet (${d})`);
  assert.deepEqual(await p.evaluate(() => [scrollY, document.documentElement.scrollTop, document.body.scrollTop]), [0, 0, 0], 'the page never scrolls');
  await p.waitForFunction(() => sheet.scrollTop >= sheet.scrollHeight - sheet.clientHeight - 1, null, {timeout: 40000, polling: 50});
  const l2 = await slot(p, 39); await touch('touchMove', l2.r - 4, l2.y); await touch('touchEnd'); await p.waitForTimeout(400);
  assert.equal((await order(p)).at(-1), 1, 'slide 1 landed last');
  assert.deepEqual(p.errs, []);
}, {timeout: 150000}));

test('sheet auto-scroll: a requestAnimationFrame loop, 64px zones, 20px a frame, halved under reduced motion; no CSS smooth scroll', () => {
  const tpl = fs.readFileSync(new URL('../template.html', import.meta.url), 'utf8');
  assert.match(tpl, /const EDGE=64,VMAX=20;/);
  assert.match(tpl, /RM\.matches\?VMAX\/2:VMAX/, 'reduced motion halves the cap');
  assert.match(tpl, /requestAnimationFrame\(asTick\)/);
  assert.match(tpl, /sheet\.addEventListener\('scroll',/, 'a wheel or trackpad scroll re-runs the drop target');
  assert.doesNotMatch(tpl, /scroll-behavior:\s*smooth/);
});
