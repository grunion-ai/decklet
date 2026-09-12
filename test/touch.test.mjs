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
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}, {x: 60, y: 300, w: 300, h: 60, bg: 'var(--accent)', radius: 8, href: '#3'}, {x: 500, y: 450, line: [860, 450], arrow: 'end', h: 3}]},
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


// ROADMAP M1.3: hit targets under (pointer: coarse). The nibs live INSIDE the scaled canvas (canvas.style.transform=scale(s)),
// so on a phone a 13px nib drew at ~5px on screen. fit() publishes the live scale as --S and the coarse block divides by it:
// 28px on screen whatever the slide's scale. Buttons take Apple's 44. The desktop editor (fine pointer) keeps its 13px nibs.
live('coarse pointer: resize and connector nibs are ≥ 24px on screen and HUD buttons ≥ 44px tall; the desktop editor does not grow', async () => {
  const {b, p} = await launch();
  const rects = sel => p.evaluate(sel => [...document.querySelectorAll(sel)].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; }).filter(([w]) => w > 0), sel);
  assert.ok(await p.evaluate(() => matchMedia('(pointer: coarse)').matches), 'the lane is coarse');
  await p.evaluate(() => { sel.clear(); sel.add(1); render(); });
  let nibs = await rects('.el .h');
  assert.equal(nibs.length, 1, 'the painted box shows its SE resize nib');
  assert.ok(nibs.every(([w, h]) => w >= 24 && h >= 24), `resize nib on screen ≥ 24×24: ${JSON.stringify(nibs)}`);
  await p.evaluate(() => { sel.clear(); sel.add(2); render(); });
  nibs = await rects('#canvas .h.pt');
  assert.ok(nibs.length >= 2, 'the connector shows its point nibs');
  assert.ok(nibs.every(([w, h]) => w >= 24 && h >= 24), `connector point nibs on screen ≥ 24×24: ${JSON.stringify(nibs)}`);
  const buttons = await rects('#hud button');
  assert.ok(buttons.length > 5, 'the HUD is visible');
  assert.ok(buttons.every(([, h]) => h >= 44), `HUD buttons ≥ 44px tall: ${JSON.stringify(buttons)}`);
  const [r, btm, sw] = await p.evaluate(() => { const r = canvas.getBoundingClientRect(); return [Math.round(r.right), Math.round(r.bottom), document.documentElement.scrollWidth]; });
  assert.ok(r <= 390 && btm <= 664 && sw === 390, `the taller HUD still leaves the slide inside the phone: ${r}×${btm}, ${sw}`);
  assert.deepEqual(p.errs, []);
  // the same file on a 1280×800 desktop with a fine pointer: 13px nibs, on screen well under the coarse floor
  const ctx = await b.newContext({viewport: {width: 1280, height: 800}}); const d = await ctx.newPage();
  await d.goto(p.url()); await d.waitForTimeout(150);
  assert.equal(await d.evaluate(() => matchMedia('(pointer: coarse)').matches), false, 'the desktop page is a fine pointer');
  await d.evaluate(() => { sel.clear(); sel.add(1); render(); });
  const [css, [w, h]] = await d.evaluate(() => { const n = document.querySelector('.el .h'); const r = n.getBoundingClientRect(); return [getComputedStyle(n).width, [r.width, r.height]]; });
  assert.equal(css, '13px', 'the desktop nib is still 13px');
  assert.ok(w < 24 && h < 24, `and on screen it stays under the coarse floor: ${w}×${h}`);
  await b.close();
});

test('coarse pointer: fit() publishes the live scale as --S and the coarse block divides by it', () => {
  const tpl = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'template.html'), 'utf8');
  const fit = tpl.slice(tpl.indexOf('function fit()'), tpl.indexOf('\n', tpl.indexOf('function fit()')));
  assert.match(fit, /document\.documentElement\.style\.setProperty\('--S',s\)/, 'fit() sets --S alongside the transform');
  const coarse = tpl.slice(tpl.indexOf('@media (pointer: coarse)'), tpl.indexOf('\n', tpl.indexOf('@media (pointer: coarse)')));
  assert.ok(coarse.length, 'a (pointer: coarse) block exists');
  assert.match(coarse, /\.el \.h\{[^}]*width:calc\(28px\/var\(--S,1\)\);height:calc\(28px\/var\(--S,1\)\);right:calc\(-14px\/var\(--S,1\)\);bottom:calc\(-14px\/var\(--S,1\)\)/, 'the resize nib: 28px on screen, centred on the corner');
  assert.match(coarse, /#canvas \.h\.pt\{[^}]*width:calc\(28px\/var\(--S,1\)\);height:calc\(28px\/var\(--S,1\)\)/, 'the connector point nibs: 28px on screen');
  assert.match(coarse, /#hud button\{[^}]*min-height:44px/, 'HUD buttons: 44');
  assert.match(coarse, /#tb button\{[^}]*min-height:44px/, 'toolbar buttons: 44');
});
