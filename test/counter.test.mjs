// `counter: 0` on the deck draws no page counter — canvas and print pages alike. Default still draws one.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {validate} from '../bin/validate.mjs';
import {verify} from '../bin/verify.mjs';
import {TEMPLATE} from '../lib/templates.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const tpl = fs.readFileSync(new URL('../template.html', import.meta.url), 'utf8');
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-counter-'));
const model = (extra = {}) => ({w: 816, h: 1056, title: 'counter', format: 'document-letter', ...extra, slides: [
  {els: [{x: 46, y: 46, w: 724, role: 'H1', text: 'Letter'}, {x: 46, y: 120, w: 724, role: 'Body', text: 'Dear reader,'}]},
]});
const count = async (b, m, name) => {
  const f = path.join(tmp, name); fs.writeFileSync(f, create(m).html);
  const p = await b.newPage(); await p.goto(pathToFileURL(f).href); await p.waitForTimeout(150);
  const canvas = await p.locator('#canvas .num').count();
  await p.emulateMedia({media: 'print'}); await p.evaluate(() => dispatchEvent(new Event('beforeprint')));
  const print = await p.locator('#print .num').count();
  await p.close(); return {canvas, print};
};
live('counter:0 draws no page counter on the canvas or the print pages; the default still does', async () => {
  const b = await pw.chromium.launch();
  assert.deepEqual(await count(b, model({counter: 0}), 'off.html'), {canvas: 0, print: 0});
  const on = await count(b, model(), 'on.html');
  assert.equal(on.canvas, 1); assert.equal(on.print, 1);
  await b.close();
});
test('counter:0 survives create into the deck model', () => {
  const html = create(model({counter: 0})).html;
  assert.match(html, /"counter":0/);
});

// ── the counter owns the corner (ROADMAP L3): right edge on the margin on EVERY slide, whichever edge the footer row is anchored to
const H1 = t => ({x: 60, y: 60, w: 840, role: 'H1', text: t});
const corner = (foot = {}, third = []) => ({w: 960, h: 540, title: 'corner', styles: {margin: 60},
  master: [{id: 'foot', footer: 1, x: 60, y: 506, w: 340, role: 'Label', text: 'deck name', ...foot}],
  slides: [{els: [H1('One')]}, {hide: ['foot'], els: [H1('Two')]}, {els: [{override: 'foot', text: 'a longer footer text on slide three'}, H1('Three'), ...third]}]});
const boxes = async (b, m, name) => {   // per slide: the footer row and the counter, in canvas px
  const f = path.join(tmp, name); fs.writeFileSync(f, create(m).html);
  const p = await b.newPage({viewport: {width: 1100, height: 700}}); await p.goto(pathToFileURL(f).href); await p.waitForTimeout(150);
  await p.addStyleTag({content: '#canvas{transform:none!important;border:0!important;position:absolute!important;left:0;top:0}'});
  const out = [];
  for (let k = 0; k < m.slides.length; k++) {
    await p.evaluate(k => { i = k; sel.clear(); render(); }, k); await p.waitForTimeout(60);
    out.push(await p.evaluate(() => { const cv = canvas.getBoundingClientRect(), R = e => e && (r => ({left: r.left - cv.left, right: r.right - cv.left, top: r.top - cv.top, h: r.height}))(e.getBoundingClientRect());
      const f = canvas.querySelector('[data-footer]'), c = canvas.querySelector('.num');
      return {foot: R(f), footText: f && f.textContent, num: R(c), cls: c && c.className, inFoot: !!(f && c && f.contains(c)), font: c && getComputedStyle(c).fontFamily, footFont: f && getComputedStyle(f).fontFamily}; }));
  }
  await p.close(); return out;
};
live('the corner is the counter\'s: a left-anchored footer keeps its text at the left, the counter sits at the right margin on the same top — Chromium and WebKit', async () => {
  for (const eng of ['chromium', 'webkit']) {
    const b = await pw[eng].launch();
    const [one, two, three] = await boxes(b, corner(), `corner-${eng}.html`);
    assert.equal(one.footText, 'deck name', eng + ': the footer text carries no inline counter');
    assert.equal(Math.round(one.foot.left), 60, eng + ': footer at the left margin');
    assert.equal(one.cls, 'num corner'); assert.equal(one.inFoot, false, eng + ': the counter is detached from the row');
    assert.equal(Math.round(one.num.right), 900, eng + ': counter right edge on the margin'); assert.equal(Math.round(one.num.top), 506, eng + ': same top as the footer');
    assert.equal(one.font, one.footFont, eng + ': the counter wears the footer\'s font');
    assert.equal(two.foot, null); assert.equal(two.cls, 'num pin', eng + ': a hidden footer leaves the generic pin');
    assert.equal(three.footText, 'a longer footer text on slide three'); assert.equal(Math.round(three.num.right), 900); assert.equal(Math.round(three.num.top), 506, eng + ': an override of the text moves nothing');
    // a right-anchored footer keeps the inline counter: one box, its right edge on the margin
    const [r1] = await boxes(b, corner({x: 660, w: 240, align: 'right'}), `inline-${eng}.html`);
    assert.equal(r1.inFoot, true); assert.equal(r1.cls, 'num'); assert.match(r1.footText, /^deck name · 1 \/ 3$/); assert.equal(Math.round(r1.num.right), 900);
    await b.close();
  }
});
live('verify: the counter box is the same on every slide but a declared hide; a slide that moves the footer fails parity on the counter', async () => {
  const ok = path.join(tmp, 'v-ok.html'); fs.writeFileSync(ok, create(corner()).html);
  const r = await verify(ok, {out: path.join(tmp, 'v-ok'), log: () => {}});
  assert.deepEqual(r.errors, [], JSON.stringify(r.parity));
  assert.deepEqual(r.parity[0].counter, r.parity[2].counter, 'slides 1 and 3 share the counter box');
  assert.equal(r.parity[0].counter.right, 900); assert.equal(r.parity[0].counter.top, 506);
  assert.notDeepEqual(r.parity[1].counter, r.parity[0].counter, 'the hidden-footer slide draws the pin instead, and is exempt');
  const bad = path.join(tmp, 'v-bad.html'); fs.writeFileSync(bad, create(corner({}, [])).html.replace('"override":"foot","text"', '"override":"foot","y":400,"text"'));
  const rb = await verify(bad, {out: path.join(tmp, 'v-bad'), log: () => {}});
  assert.ok(rb.errors.includes('layout parity failed on 3'), rb.errors.join(' | '));
  assert.equal(rb.parity[2].pass, false); assert.equal(rb.parity[2].rows[0].n, 'counter'); assert.match(rb.parity[2].rows[0].problems[0], /counter box .* differs from slide 1/);
});
test('validate: the gap gate knows the corner — a row in the counter\'s box collides with it (estimated, so a ~ warning); the old legend spot 18px above is clear', () => {
  const at = y => validate(create(corner({}, [{right: 60, y, w: 'auto', role: 'Label', text: 'legend', nowrap: 1}])).deck);
  const hit = at(506); assert.deepEqual(hit.errors, []); assert.ok(hit.warnings.some(w => /slides\[2\].*counter/.test(w)), hit.warnings.join(' | '));
  const clear = at(474); assert.deepEqual(clear.errors, []); assert.deepEqual(clear.warnings.filter(w => /counter/.test(w)), []);
  const inline = validate(create(corner({x: 660, w: 240, align: 'right'})).deck); assert.deepEqual(inline.warnings.filter(w => /counter/.test(w)), [], 'a right-anchored footer carries the counter inline: no second box');
});

// ── U6: the anchoring SKILL.md recommends — `right:` with no `x` — is right-anchored everywhere (ROADMAP U6)
// The reading-density subject wrote {right: 60, w: 'auto'} and got a counter warning per slide, a footer rendered bottom-LEFT,
// and no counter in any screenshot. Both `footRight` tests read `x` and `w` only, so a row with no `x` read as left-anchored.
const RIGHTFOOT = {id: 'foot', footer: 1, right: 60, y: 506, w: 'auto', role: 'Label', text: 'deck name', nowrap: 1};
const rightAnchored = (extra = {}) => ({w: 960, h: 540, title: 'u6', styles: {margin: 60}, master: [{...RIGHTFOOT, ...extra}],
  slides: [{name: 'one', els: [H1('One')]}, {name: 'two', els: [H1('Two')]}]});

live('U6: a footer master anchored with `right:` renders at the RIGHT and carries the counter inline — Chromium and WebKit', async () => {
  for (const eng of ['chromium', 'webkit']) {
    const b = await pw[eng].launch();
    const [one] = await boxes(b, rightAnchored(), `u6-right-${eng}.html`);
    assert.equal(one.inFoot, true, eng + ': a right-anchored footer carries the counter inline');
    assert.equal(one.cls, 'num', eng + ': inline, not detached');
    assert.match(one.footText, /^deck name · 1 \/ 2$/);
    assert.equal(Math.round(one.foot.right), 900, eng + ': the footer row ends on the margin');
    assert.ok(one.foot.left > 600, eng + `: the footer hugs the right edge, not the left (left ${one.foot.left})`);
    assert.equal(Math.round(one.num.right), 900, eng + ': the counter\'s right edge is on the margin');
    await b.close();
  }
});
test('U6: `right:` on the footer master raises no counter warning — the counter is that row\'s own inline child', () => {
  for (const text of ['deck name', 'Coilworks · Flux Bar build review']) {
    const v = validate(create(rightAnchored({text})).deck);
    assert.deepEqual(v.errors, []);
    assert.deepEqual(v.warnings.filter(w => /counter/.test(w)), [], `"${text}": a right-anchored footer adds no second counter box`);
  }
});

// the shot the builder looks at must contain what the parity check measures: decode the PNG on a canvas (no image dep) and
// count the pixels in the right foot that differ from the corner's own background.
const footInk = async (b, png) => { const p = await b.newPage();
  const n = await p.evaluate(async src => await new Promise(res => { const im = new Image(); im.onload = () => {
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(Math.round(im.width * 840 / 960), Math.round(im.height * 495 / 540), Math.round(im.width * 80 / 960), Math.round(im.height * 30 / 540)).data;
    let diff = 0; for (let k = 0; k < d.length; k += 4) if (Math.abs(d[k] - d[0]) + Math.abs(d[k + 1] - d[1]) + Math.abs(d[k + 2] - d[2]) > 30) diff++;
    res(diff); }; im.src = src; }), 'data:image/png;base64,' + fs.readFileSync(png).toString('base64'));
  await p.close(); return n; };

live('U6: verify\'s screenshots carry the counter — in both anchorings, the artifact shows what parity measures', async () => {
  const b = await pw.chromium.launch();
  const leftFoot = (() => { const m = {...RIGHTFOOT, x: 60}; delete m.right; return m; })();
  for (const [label, m] of [['right-anchored', rightAnchored()], ['left-anchored', {...rightAnchored(), master: [leftFoot]}]]) {
    const f = path.join(tmp, `u6-shot-${label}.html`); fs.writeFileSync(f, create(m).html);
    const out = path.join(tmp, `u6-shot-${label}-out`);
    const r = await verify(f, {out, log: () => {}});
    assert.deepEqual(r.errors, [], `${label}: ${JSON.stringify(r.parity)}`);
    assert.equal(r.parity[0].counter.right, 900, `${label}: the counter's right edge is on the margin`);
    assert.ok(await footInk(b, path.join(out, '01-one.png')) > 0, `${label}: the counter is painted into 01-one.png`);
  }
  await b.close();
});
live('U6: a counter off the margin fails parity even when every slide agrees', async () => {
  // both slides put the counter in the same wrong place, so the slide-to-slide check alone would pass it
  const m = {...rightAnchored(), master: [(() => { const x = {...RIGHTFOOT, x: 60}; delete x.right; return x; })()]};
  const f = path.join(tmp, 'u6-offmargin.html'); fs.writeFileSync(f, create(m).html.replace("c.style.right=MG()+'px'", "c.style.right='200px'"));
  const r = await verify(f, {out: path.join(tmp, 'u6-offmargin-out'), log: () => {}});
  assert.ok(r.errors.some(e => /layout parity failed/.test(e)), r.errors.join(' | '));
  assert.ok(r.parity.some(q => q.rows.some(x => x.n === 'counter' && /margin/.test(x.problems[0]))), JSON.stringify(r.parity));
});

// A left-anchored footer starts at max(margin, x). The master keeps the margin; a slide whose own chrome owns the left of
// the band (a rail, a foot mark) overrides x to start past it — and the counter's corner never moves. ROADMAP U6.
test('footer: an override x insets the source line, and leaves the counter alone', () => {
  assert.match(tpl, /d\.style\.left=Math\.max\(MG\(\),r\.x\|\|0\)\+'px'/, 'left-anchored footer honours an explicit x');
  const rail = TEMPLATE['logo-rail-mark'], mark = TEMPLATE['logo-foot-mark'];
  for (const t of [rail, mark]) assert.ok(t.foot && t.foot.x > 60, t.id + ' declares the inset its own chrome needs');
  assert.ok(rail.foot.x >= 64 + 24, 'the rail is 64 wide: the line clears it with a gutter');
});
