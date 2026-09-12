// decklet on a phone — the touch lane (ROADMAP M1.4). Every other live test opens 1280×800 and drives page.mouse; this file
// opens an iPhone-sized, touch-capable, mobile-emulated Chromium and drives real touch input through CDP. Skipped without Playwright.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-touch-'));
const PHONE = {viewport: {width: 390, height: 664}, deviceScaleFactor: 3, isMobile: true, hasTouch: true}; // Playwright's iPhone 13, on Chromium
const model = () => ({w: 960, h: 540, title: 'touch', slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}, {x: 60, y: 300, w: 300, h: 60, bg: 'var(--accent)', radius: 8, href: '#3'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Two'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Three'}]},
]});
const launch = async () => {
  const b = await pw.chromium.launch(); const ctx = await b.newContext(PHONE); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.errs = errs;
  const f = path.join(tmp, 'touch.html'); fs.writeFileSync(f, create(model()).html);
  await p.goto(pathToFileURL(f).href); await p.waitForTimeout(150); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(150);
  const cdp = await ctx.newCDPSession(p);
  // a real finger: CDP touch events, so the page sees touchstart/touchend (and the synthetic mouse events that follow)
  p.swipe = async (x1, y1, x2, y2) => {
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: x1, y: y1}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: (x1 + x2) / 2, y: (y1 + y2) / 2}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: x2, y: y2}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await p.waitForTimeout(80);
  };
  p.tap = async (x, y) => { await p.touchscreen.tap(x, y); await p.waitForTimeout(120); };
  return {b, p};
};
const at = p => p.evaluate(() => i);

live('phone: the lane is real — a touch-capable, mobile-emulated, phone-sized page with a coarse pointer', async () => {
  const {b, p} = await launch();
  assert.deepEqual(await p.evaluate(() => [navigator.maxTouchPoints > 0, matchMedia('(pointer: coarse)').matches]), [true, true]);
  assert.deepEqual(p.errs, []); await b.close();
});

// ROADMAP M1.1: the shell on a phone. fit() measured innerWidth/innerHeight, which a mobile layout viewport inflates to the
// canvas's own overflow (453 wide for a 390 phone), so the slide was cut off before any interaction; body was 100vh with no
// small-viewport unit; nothing respected the safe area.
live('phone shell: the slide fits the 390×664 viewport, editing and presenting; the layout viewport never grows past the phone', async () => {
  const {b, p} = await launch();
  const box = () => p.evaluate(() => { const r = canvas.getBoundingClientRect(); return [Math.round(r.right), Math.round(r.bottom), innerWidth, document.documentElement.scrollWidth]; });
  let [r, btm, iw, sw] = await box();
  assert.ok(r <= 390 && btm <= 664, `editing: canvas ends at ${r}×${btm} inside 390×664`); assert.equal(iw, 390, 'innerWidth is the phone'); assert.equal(sw, 390, 'nothing overflows');
  await p.evaluate(() => setPresent(true, true)); await p.waitForTimeout(150);
  [r, btm, iw, sw] = await box();
  assert.ok(r <= 390 && btm <= 664, `presenting: canvas ends at ${r}×${btm}`); assert.equal(sw, 390);
  assert.ok(r >= 380, 'and fills the width'); 
  assert.deepEqual(p.errs, []); await b.close();
});

test('phone shell: small-viewport height, viewport-fit=cover, safe-area padding on the HUD, and fit() measures the layout viewport', () => {
  const tpl = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'template.html'), 'utf8');
  assert.match(tpl, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.match(tpl, /body\{[^}]*height:100vh;height:100svh[^}]*\}/, 'vh first, svh for the browsers that have it');
  assert.match(tpl, /#hud\{[^}]*padding:8px 16px calc\(8px \+ env\(safe-area-inset-bottom\)\)/, 'the HUD clears the home indicator');
  assert.match(tpl, /body\.present\.peek #hud\{[^}]*bottom:calc\(12px \+ env\(safe-area-inset-bottom\)\)/, 'so does the peek pill');
  assert.match(tpl, /function fit\(\)\{const vw=document\.documentElement\.clientWidth,vh=document\.documentElement\.clientHeight/, 'fit() reads the layout viewport, never innerWidth/innerHeight');
  assert.doesNotMatch(tpl.slice(tpl.indexOf('function fit()'), tpl.indexOf('\n', tpl.indexOf('function fit()'))), /innerWidth|innerHeight/);
});

