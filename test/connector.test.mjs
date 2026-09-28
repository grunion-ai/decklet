// the connector row (K3, K4, K16): {from, to, style:'arrow'|'dashed'|'blocked', gap}. The engine routes between the two rows'
// edges and insets both ends by the gap; a hand-drawn arrow that starts or ends flush on a painted box fails validate; the
// process-flow templates use connectors, so their arrows clear both boxes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {route, markerSize, CGAP} from '../lib/connector.mjs';
import {TEMPLATE} from '../lib/templates.mjs';
import {LIBRARY} from '../lib/layouts.mjs';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {modelOf} from '../bin/verify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tpl = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-connector-'));
const styles = modelOf(tpl).styles;
const deckOf = (els, extra = {}) => ({w: 960, h: 540, styles: {...styles, ...extra}, slides: [{els}]});
const A = {id: 'a', x: 100, y: 200, w: 200, h: 100, bg: 'var(--card)', bd: '1px solid var(--line)'};
const B = {id: 'b', x: 400, y: 220, w: 200, h: 100, bg: 'var(--card)', bd: '1px solid var(--line)'};

test('route: side by side runs across the shared band, inset by the gap at both ends', () => {
  const r = route(A, B, 6);
  assert.deepEqual([r.x, r.y, ...r.line], [306, 260, 394, 260]);
  const back = route(B, A, 6);
  assert.deepEqual([back.x, back.line[0]], [394, 306], 'right to left insets the same way');
  const down = route({x: 100, y: 100, w: 200, h: 60}, {x: 150, y: 260, w: 200, h: 60}, 8);
  assert.deepEqual([down.x, down.y, ...down.line], [225, 168, 225, 252], 'stacked runs down the shared width');
  assert.equal(route(A, {...B, x: 250}, 6), null, 'overlapping boxes have no gutter');
  assert.ok(markerSize(20) >= 14 && markerSize(400) <= 40 && markerSize(50) === 30, 'the blocked marker follows the run, within 14..40');
});

test('route: template.html routes with the same arithmetic as lib/connector.mjs', () => {
  const m = tpl.match(/const ROUTE=(\(A,B,g\)=>\{[\s\S]*?\n\};)/);
  assert.ok(m, 'template.html defines ROUTE');
  const ROUTE = new Function('return ' + m[1].replace(/;$/, ''))();
  const boxes = [[A, B], [B, A], [{x: 0, y: 0, w: 50, h: 50}, {x: 0, y: 300, w: 80, h: 40}], [{x: 0, y: 0, w: 50, h: 50}, {x: 300, y: 300, w: 80, h: 40}], [A, {...B, x: 250}]];
  for (const [p, q] of boxes) for (const g of [0, 6, 10]) assert.deepEqual(ROUTE(p, q, g), route(p, q, g));
});

test('validate: a connector row between two boxes passes; bad style, unknown ends, a stated line and a narrow gutter fail', () => {
  assert.deepEqual(validate(deckOf([A, B, {from: 'a', to: 'b', style: 'arrow', h: 2.5}])).errors, []);
  assert.deepEqual(validate(deckOf([A, B, {from: 'a', to: 'b', style: 'blocked', h: 2}])).errors, []);
  const err = els => validate(deckOf(els)).errors.join('\n');
  assert.match(err([A, B, {from: 'a', to: 'b', style: 'zigzag'}]), /style "zigzag" not one of arrow\|dashed\|blocked/);
  assert.match(err([A, B, {from: 'a', to: 'nope', style: 'arrow'}]), /to "nope" is not a row id/);
  assert.match(err([A, B, {to: 'b', style: 'arrow'}]), /connector needs both from and to/);
  assert.match(err([A, {...B, x: 310}, {from: 'a', to: 'b', style: 'arrow'}]), /gutter .* too narrow/);
  assert.match(err([A, B, {from: 'a', to: 'b', style: 'arrow', gap: 'x'}]), /gap must be a number/);
});

test('validate: the connector gap defaults to styles.gap, then 6', () => {
  // a 14px gutter fits 6 + 2 + 6 but not 10 + 2 + 10 (styles.gap = 10)
  const tight = [A, {...B, x: 314}, {from: 'a', to: 'b', style: 'arrow'}];
  assert.equal(CGAP, 6);
  assert.deepEqual(validate({...deckOf(tight), styles: {...styles, gap: undefined}}).errors, []);
  assert.match(validate(deckOf(tight, {gap: 10})).errors.join('\n'), /too narrow/);
});

test('validate: a hand-drawn arrow flush on a painted box is an error; butt:1 names a rule that butts a frame', () => {
  const flush = {x: 300, y: 250, line: [400, 250], h: 2.5, arrow: 'end'};   // tail on A's right edge, head on B's left edge
  assert.match(validate(deckOf([A, B, flush])).errors.join('\n'), /els\[2\].*touches/);
  // the same arrow onto a chip (a text row with a fill) — K3's "3D SYSTEMS → HG"; an auto-width chip is a ~ warning, its width a guess
  const chip = {x: 400, y: 238, w: 60, h: 24, role: 'Label', nowrap: 1, bg: 'var(--box)', text: 'HUBS'};
  assert.match(validate(deckOf([A, chip, {x: 306, y: 250, line: [400, 250], h: 2.5, arrow: 'end'}])).errors.join('\n'), /els\[2\] \(line\) ends 0px from els\[1\] "HUBS" — an arrow or connector end touches/);
  assert.match(validate(deckOf([A, {...chip, w: 'auto', h: undefined}, {x: 306, y: 250, line: [400, 250], h: 2.5, arrow: 'end'}])).warnings.join('\n'), /ends ~0px from els\[1\]/);
  // clear of both ends: fine
  assert.deepEqual(validate(deckOf([A, B, {x: 310, y: 250, line: [390, 250], h: 2.5, arrow: 'end'}])).errors, []);
  // a to:/from: stroke is terminated by the engine with air — unless it asks for gap:0
  assert.deepEqual(validate(deckOf([A, B, {x: 300, y: 250, line: [450, 250], h: 2.5, arrow: 'end', from: 'a', to: 'b'}])).errors, []);
  assert.match(validate(deckOf([A, B, {x: 300, y: 250, line: [450, 250], h: 2.5, arrow: 'end', from: 'a', to: 'b', gap: 0}])).errors.join('\n'), /touches/);
  // the named exemption: a stroke that deliberately butts a frame
  assert.deepEqual(validate(deckOf([A, B, {...flush, butt: 1}])).errors, []);
});

test('templates: every process-flow arrow is a connector from box i to box i+1, and it clears both boxes', () => {
  for (const id of ['process-flow-3', 'process-flow-4', 'process-flow-5']) {
    const els = TEMPLATE[id].els, conns = els.filter(r => r.style);
    const boxes = els.filter(r => /^st\d$/.test(r.id || ''));
    assert.equal(conns.length, boxes.length - 1, id);
    assert.ok(!els.some(r => r.arrow), `${id}: no hand-placed arrows left`);
    conns.forEach((c, i) => {
      assert.deepEqual([c.from, c.to, c.style], [`st${i}`, `st${i + 1}`, 'arrow'], id);
      const r = route(boxes[i], boxes[i + 1], c.gap ?? CGAP);
      assert.ok(r.x - (boxes[i].x + boxes[i].w) >= CGAP && boxes[i + 1].x - r.line[0] >= CGAP, `${id}: arrow ${i} clears both boxes`);
    });
    const v = validate({w: 960, h: 540, styles, slides: [{template: id}]});
    assert.deepEqual(v.errors, [], id);
  }
});

// #163: an annotation leader (`<p>-leader`, by id or slot) runs to its marker (`<p>-dot`); validate, and so verify, fail an end
// more than 1px off the marker. The annotated-shot template and layout draw each leader from the callout's edge to its dot.
test('leaders: every annotated-shot leader runs from its callout\'s edge to its marker, and validate fails one that stops short', () => {
  const near = (px, py, b) => Math.hypot(Math.max(b.x - px, px - (b.x + b.w), 0), Math.max(b.y - py, py - (b.y + b.h), 0));
  const ends = r => [[r.x, r.y], r.line];
  const els = TEMPLATE['annotated-shot'].els;
  for (const i of [0, 1, 2]) {
    const L = els.find(r => r.id === `c${i}-leader`), D = els.find(r => r.id === `c${i}-dot`), C = els.find(r => r.id === `c${i}`);
    assert.ok(L && D && C, `template: callout ${i} names its leader and dot`);
    assert.ok(ends(L).some(([x, y]) => near(x, y, D) <= 1), `template: leader ${i} reaches its dot`);
    assert.ok(ends(L).some(([x, y]) => near(x, y, C) <= 1), `template: leader ${i} starts on its callout`);
  }
  const lay = LIBRARY['annotated-shot'].slots;
  for (const n of [1, 2, 3]) {
    const L = lay[`callout${n}-leader`], D = lay[`callout${n}-dot`], C = lay[`callout${n}`];
    assert.ok(ends(L).some(([x, y]) => near(x, y, D) <= 1), `layout: leader ${n} reaches its dot`);
    assert.ok(ends(L).some(([x, y]) => near(x, y, C) <= 1), `layout: leader ${n} starts on its callout`);
  }
  assert.deepEqual(validate({w: 960, h: 540, styles, slides: [{template: 'annotated-shot'}]}).errors, []);
  const dot = {id: 'm-dot', x: 175, y: 215, w: 10, h: 10, radius: 10, bg: 'var(--accent)'};
  assert.deepEqual(validate(deckOf([dot, {id: 'm-leader', x: 660, y: 220, line: [185, 220], h: 1, bg: 'var(--line)'}])).errors, []);
  assert.match(validate(deckOf([dot, {id: 'm-leader', x: 660, y: 220, line: [590, 220], h: 1, bg: 'var(--line)'}])).errors.join('\n'),
    /leader "m-leader" ends 405px from its marker "m-dot"/);
  const bound = short => ({w: 960, h: 540, styles, slides: [{layout: 'annotated-shot', els: [{slot: 'callout1-dot'}, {slot: 'callout1-leader', ...(short ? {x: 590, line: [650, 220]} : {})}]}]});   // the old 590..650 stub
  assert.deepEqual(validate(bound()).errors, []);
  assert.match(validate(bound(1)).errors.join('\n'), /leader "callout1-leader" ends 405px from its marker "callout1-dot"/);
});

live('live: the rendered connector keeps the gap at both measured edges, follows an auto chip, and a blocked link draws its marker', async () => {
  const chip = {id: 'c', x: 400, y: 238, w: 'auto', role: 'Label', p: 'chip', nowrap: 1, bg: 'var(--box)', text: 'HUBS'};
  const deck = {w: 960, h: 540, styles, slides: [
    {els: [A, B, {from: 'a', to: 'b', style: 'arrow', h: 2.5, gap: 8}]},
    {els: [{...chip, id: 'p', x: 100, text: '3D SYSTEMS'}, {...chip, x: 400}, {from: 'p', to: 'c', style: 'arrow', h: 2.5}]},
    {els: [A, B, {from: 'a', to: 'b', style: 'blocked', h: 2}]},
    {template: 'process-flow-4'},
  ]};
  const f = path.join(tmp, 'conn.html'); fs.writeFileSync(f, create(deck).html);
  const b = await pw.chromium.launch(); try { const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  await p.evaluate(async () => { localStorage.clear(); canvas.style.transform = 'none'; await document.fonts.ready; });
  // [left, right] of every drawn row on slide k, in model px; a connector's right edge is its head's tip
  const spans = k => p.evaluate(k => { i = k; render(); const c = canvas.getBoundingClientRect();
    return [...canvas.querySelectorAll('.el')].map(d => { const r = d.getBoundingClientRect(), h = d.querySelector('svg.ar'), hr = h && h.getBoundingClientRect();
      return {n: d.dataset.n, l: r.left - c.left, r: (hr ? Math.max(r.right, hr.right) : r.right) - c.left, mk: !!d.querySelector('.cmark'), mw: d.querySelector('.cmark')?.getBoundingClientRect().width}; }); }, k);
  const near = (a, b, m) => assert.ok(Math.abs(a - b) <= 1, `${m}: ${a} vs ${b}`);
  let s = await spans(0);
  near(s[2].l - s[0].r, 8, 'tail 8px clear of the box it leaves'); near(s[1].l - s[2].r, 8, 'head 8px clear of the box it points at');
  s = await spans(1);
  near(s[2].l - s[0].r, 6, 'tail 6px after the measured auto chip'); near(s[1].l - s[2].r, 6, 'head 6px before the next chip');
  s = await spans(2);
  assert.ok(s[2].mk, 'blocked link draws a marker'); near(s[2].mw, markerSize(100 - 2 * 6), 'marker sized to the run');
  await spans(3);
  const d = await p.evaluate(() => { const c = canvas.getBoundingClientRect(), all = [...canvas.querySelectorAll('.el')];
    const box = id => { const k = slide().els.findIndex(e => e.id === id); return canvas.querySelector(`[data-n="${k}"]`).getBoundingClientRect(); };
    return slide().els.map((e, k) => [e, k]).filter(([e]) => e.style).map(([e, k]) => { const el = canvas.querySelector(`[data-n="${k}"]`), r = el.getBoundingClientRect(), h = el.querySelector('svg.ar').getBoundingClientRect();
      return {tail: r.left - box(e.from).right, head: box(e.to).left - h.right}; }); });
  assert.equal(d.length, 3);
  for (const g of d) { assert.ok(g.tail >= 5, `tail clear: ${g.tail}`); assert.ok(g.head >= 5, `head clear: ${g.head}`); }
  assert.deepEqual(errs, []);
  } finally { await b.close(); }
});
