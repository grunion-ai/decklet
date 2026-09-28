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
const launch = async (opts = PHONE, m = model()) => {
  const b = await pw.chromium.launch(); const ctx = await b.newContext(opts); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.errs = errs;
  const f = path.join(tmp, 'touch.html'); fs.writeFileSync(f, create(m).html);
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

// ROADMAP M1.2: a phone in present mode could not change slides — no swipe, no tap, and the HUD peeked only on mousemove
live('presenting on a phone: swipe turns the page, a tap advances (left fifth goes back), a tap on a link follows it, a tap at the bottom peeks the HUD and its buttons still work', async () => {
  const {b, p} = await launch(); await p.evaluate(() => setPresent(true, true));
  const W = 390, H = 664;
  await p.swipe(300, 300, 80, 310); assert.equal(await at(p), 1, 'swipe left → next');
  await p.swipe(300, 300, 80, 310); assert.equal(await at(p), 2, 'again');
  await p.swipe(300, 300, 80, 310); assert.equal(await at(p), 2, 'the last slide holds');
  await p.swipe(80, 300, 300, 290); assert.equal(await at(p), 1, 'swipe right → previous');
  await p.swipe(200, 200, 210, 420); assert.equal(await at(p), 1, 'a vertical swipe is not a page turn');
  await p.tap(W * 0.7, H / 2); assert.equal(await at(p), 2, 'tap on the right → next');
  await p.tap(W * 0.1, H / 2); assert.equal(await at(p), 1, 'tap in the left fifth → previous');
  await p.tap(W * 0.1, H / 2); assert.equal(await at(p), 0);
  // the link: the CTA box on slide 1 points at slide 3 — the anchor is the gesture, not the tap-to-advance
  const box = await p.$eval('.el[data-n="1"]', d => { const r = d.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await p.tap(box[0], box[1]); await p.waitForTimeout(150); assert.equal(await at(p), 2, 'the tap followed the link to slide 3'); assert.match(p.url(), /#3$/);
  // the HUD: a tap in the bottom twelfth peeks it; a tap on its prev button works and does not un-peek
  assert.equal(await p.evaluate(() => document.body.classList.contains('peek')), false);
  await p.tap(W / 2, H - 10); assert.equal(await p.evaluate(() => document.body.classList.contains('peek')), true, 'peeked');
  const prev = await p.$eval('#prev', d => { const r = d.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await p.tap(prev[0], prev[1]); assert.equal(await at(p), 1, 'the HUD prev button turned the page');
  assert.equal(await p.evaluate(() => document.body.classList.contains('peek')), true, 'and the HUD stayed');
  await p.tap(W / 2, H / 2); assert.equal(await at(p), 2); assert.equal(await p.evaluate(() => document.body.classList.contains('peek')), false, 'a tap on the slide advances and lets the HUD go');
  assert.equal(await p.evaluate(() => present()), true, 'still presenting');
  assert.deepEqual(p.errs, []); await b.close();
});

// The text toolbar on a 375px phone (toolbar review at 82d0e8d): the role segment did not wrap, so Label and Stat sat past the
// right edge; the 44px button floor stretched the 16px swatches into 16×44 ovals; and the toolbar always sat above the row, over
// the title and supertitle. Under 480px the segments wrap; a swatch is a 44×44 tap target around a round 20px dot; the toolbar
// goes below the row when above would cover a text row or leave the viewport. On a desktop, editing the Body kept hiding the
// Title's second line, and the same rule moves it below there too.
const stack = () => ({w: 960, h: 540, title: 'toolbar', slides: [{els: [
  {x: 60, y: 40, w: 800, role: 'Supertitle', text: 'Quarterly review'},
  {x: 60, y: 90, w: 800, role: 'Title', text: 'A title long enough to wrap onto a second line here'},
  {x: 60, y: 250, w: 800, role: 'Body', text: 'Body copy under the title.'},
]}]});
const tbBoxes = p => p.evaluate(() => {
  edit(2); placeTb();
  const R = e => { const r = e.getBoundingClientRect(); return {l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height}; };
  const sw = [...document.querySelectorAll('#tb .sw')].map(e => { const c = getComputedStyle(e), pad = parseFloat(c.paddingLeft) + parseFloat(c.paddingRight), padV = parseFloat(c.paddingTop) + parseFloat(c.paddingBottom); return {...R(e), clip: c.backgroundClip, dotW: e.getBoundingClientRect().width - pad, dotH: e.getBoundingClientRect().height - padV}; });
  return {vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight, tb: R(tb), roles: [...document.querySelectorAll('#tb-roles button')].map(e => ({n: e.textContent, ...R(e)})),
    sw, rows: [0, 1, 2].map(n => R(canvas.querySelector(`[data-n="${n}"]`)))};
});
const meets = (a, b) => a.r > b.l && a.l < b.r && a.b > b.t && a.t < b.b;
live('phone text toolbar at 375px: every role button is on screen, swatches are round 44px targets, and the toolbar never covers the edited row or the rows above it', async () => {
  const {b, p} = await launch({...PHONE, viewport: {width: 375, height: 667}}, stack()); try {
  const {vw, vh, tb, roles, sw, rows} = await tbBoxes(p);
  assert.equal(roles.length, 8, 'the eight roles');
  for (const r of roles) assert.ok(r.l >= 0 && r.r <= vw && r.t >= 0 && r.b <= vh, `${r.n} inside the ${vw}×${vh} viewport: ${JSON.stringify(r)}`);
  assert.ok(sw.length > 1, 'the deck colours show as swatches');
  for (const s of sw) {
    assert.ok(s.w >= 44 && s.h >= 44, `swatch tap target ≥ 44×44: ${s.w}×${s.h}`);
    assert.equal(s.w, s.h, 'the target is square');
    assert.equal(s.clip, 'content-box', 'the colour fills the dot, not the tap target');
    assert.equal(s.dotW, s.dotH, `the dot is round, not an oval: ${s.dotW}×${s.dotH}`);
  }
  assert.ok(tb.t >= 0 && tb.b <= vh && tb.l >= 0 && tb.r <= vw, `the toolbar is inside the viewport: ${JSON.stringify(tb)}`);
  for (const [n, row] of rows.entries()) assert.ok(!meets(tb, row), `the toolbar does not cover row ${n}: tb ${JSON.stringify(tb)}, row ${JSON.stringify(row)}`);
  assert.deepEqual(p.errs, []); } finally { await b.close(); }
});

live('desktop text toolbar: editing the Body leaves the Title above it uncovered', async () => {
  const {b, p} = await launch({viewport: {width: 1280, height: 800}}, stack()); try {
  const {tb, rows} = await tbBoxes(p);
  for (const [n, row] of rows.entries()) assert.ok(!meets(tb, row), `the toolbar does not cover row ${n}: tb ${JSON.stringify(tb)}, row ${JSON.stringify(row)}`);
  assert.deepEqual(p.errs, []); } finally { await b.close(); }
});

live('editing on a phone: a swipe or a tap never turns the page (that is the present-mode gesture)', async () => {
  const {b, p} = await launch();
  await p.swipe(300, 300, 80, 310); assert.equal(await at(p), 0);
  await p.tap(300, 200); assert.equal(await at(p), 0);
  assert.deepEqual(p.errs, []); await b.close();
});
