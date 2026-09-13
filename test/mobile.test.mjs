// decklet on a phone — live proofs under device emulation (Playwright, skipped when absent): Chromium as a Pixel 7, WebKit as an
// iPhone 14 (touch, phone viewport, mobile UA). A touch edit persists across a reload, an app switch (the tab hides) commits
// and stores the edit in flight, and a phone browser that refuses storage on file:// says so in red with no errors.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';

let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-mobile-'));
const model = () => ({w: 960, h: 540, title: 'phone', slides: ['One', 'Two', 'Three', 'Four'].map(t => ({els: [{x: 60, y: 80, w: 800, role: 'H1', text: t}]}))});
const write = (name, html) => { const f = path.join(tmp, name); fs.writeFileSync(f, html); return f; };
const watch = p => { p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') p.errs.push('console: ' + m.text()); }); return p; };
const settled = async p => { await p.waitForFunction(() => document.getElementById('autosave').dataset.state !== 'busy', null, {timeout: 4000}); return p.evaluate(() => document.getElementById('autosave').dataset.state); };
const phones = [['chromium', 'Pixel 7'], ['webkit', 'iPhone 14']];
const center = (p, sel) => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
// a finger on the contact sheet: the same pointer events a touch drag fires (pointerType touch), through the sheet's own handlers
const touchDrag = (p, from, to) => p.evaluate(([from, to]) => {
  const cells = [...grid.children], at = n => { const r = cells[n].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const [x0, y0] = at(from), [x1, y1] = at(to), ev = (t, x, y, el) => el.dispatchEvent(new PointerEvent(t, {bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0}));
  ev('pointerdown', x0, y0, cells[from]); ev('pointermove', x0 + 12, y0 + 2, cells[from]); ev('pointermove', x1 + 20, y1, cells[from]); ev('pointerup', x1 + 20, y1, cells[from]);
}, [from, to]);

for (const [bn, dev] of phones) live(`${dev} (${bn}): a touch edit persists — tap adds a slide, a finger reorders the sheet, both survive a reload`, async () => {
  const b = await pw[bn].launch(); const f = write(`touch-${bn}.html`, create(model()).html);
  const ctx = await b.newContext({...pw.devices[dev]}); const p = watch(await ctx.newPage());
  await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload(); await settled(p);
  assert.equal(await p.evaluate(() => matchMedia('(pointer: coarse)').matches), true, 'the page sees a touch device');
  // + Slide, by finger: the add menu, then its Slide row
  let [x, y] = await center(p, '#addbtn'); await p.touchscreen.tap(x, y); await p.waitForTimeout(80);
  [x, y] = await center(p, '#sadd'); await p.touchscreen.tap(x, y); await p.waitForTimeout(80);
  assert.equal(await p.evaluate(() => deck.slides.length), 5, 'a tap added a slide');
  // the contact sheet, by finger: open it, drag slide 1 (One) to after slide 3 — the new slide sits at 2, after the slide it was added from
  [x, y] = await center(p, '#grid-btn'); await p.touchscreen.tap(x, y); await p.waitForTimeout(80);
  assert.equal(await p.evaluate(() => sheet.hidden), false, 'a tap opened the sheet');
  await touchDrag(p, 0, 2); await p.waitForTimeout(250);
  assert.deepEqual(await p.evaluate(() => deck.slides.map(s => s.els[0].text)), ['New slide', 'Two', 'One', 'Three', 'Four'], 'a finger reordered the sheet');
  await p.waitForTimeout(300); await p.reload(); await settled(p);
  assert.deepEqual(await p.evaluate(() => [deck.slides.length, deck.slides.map(s => s.els[0].text), log.length]), [5, ['New slide', 'Two', 'One', 'Three', 'Four'], 2], 'both edits came back after the reload');
  assert.deepEqual(p.errs, []); await b.close();
});

for (const [bn, dev] of phones) live(`${dev} (${bn}): switching apps (the tab hides) commits the text being typed and stores it before the page can die`, async () => {
  const b = await pw[bn].launch(); const f = write(`hide-${bn}.html`, create(model()).html);
  const ctx = await b.newContext({...pw.devices[dev]}); const p = watch(await ctx.newPage());
  await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload(); await settled(p);
  await p.evaluate(() => { sel.clear(); sel.add(0); render(); edit(0); }); await p.keyboard.type('On a phone'); // edit() selects the row's text: typing replaces it
  assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem(KEY))).slides[0].els[0].text, 'One', 'not stored while typing');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', {get: () => true, configurable: true}); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(100);
  assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem(KEY))).slides[0].els[0].text, 'On a phone', 'hidden → committed and stored');
  assert.equal(await p.evaluate(() => canvas.querySelector('.el[contenteditable="true"]')), null, 'the row left edit mode');
  assert.deepEqual(p.errs, []); await b.close();
});

live('iPhone 14 (webkit): file:// with storage refused — red at load, Save a copy shows, a touch edit still holds for the session, no errors', async () => {
  const b = await pw.webkit.launch(); const f = write('blocked-iphone.html', create(model()).html);
  const ctx = await b.newContext({...pw.devices['iPhone 14']});
  await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', {get() { throw new Error('blocked'); }}); Object.defineProperty(window, 'indexedDB', {get() { throw new Error('blocked'); }}); });
  const p = watch(await ctx.newPage()); await p.goto(pathToFileURL(f).href);
  assert.equal(await settled(p), 'bad');
  assert.deepEqual(await p.evaluate(() => [document.body.classList.contains('nostore'), !$('savebad').hidden]), [true, true], 'the honest state: the save button red and marked, and it is the copy door');
  const [x, y] = await center(p, '#addbtn'); await p.touchscreen.tap(x, y); await p.waitForTimeout(80);
  const [x2, y2] = await center(p, '#sadd'); await p.touchscreen.tap(x2, y2); await p.waitForTimeout(80);
  assert.equal(await p.evaluate(() => deck.slides.length), 5, 'the edit holds in memory');
  assert.deepEqual(p.errs, []); await b.close();
});
