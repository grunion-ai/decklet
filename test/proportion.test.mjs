// K10 / K19 — proportional number templates. Market numbers used to route to stat-row-4 (four tiles), which read as visually
// weak; the hand-built v2 slide drew each value as a circle whose AREA is the value, a dashed ring for a high estimate or a
// forecast, and a 100-cell waffle for a share. These templates compute that geometry from the filled values: area-bubbles
// (2–5 values), waffle (one percentage), range-bar (low–high ranges on one axis, a marker each), each with a reading and a
// speaker cut on the one-line foot (K17).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {create} from '../bin/create.mjs';
import {validate} from '../bin/validate.mjs';
import {TEMPLATE, fillErrors, expandTemplates} from '../lib/templates.mjs';
import {FOOT} from '../lib/layouts.mjs';

const IDS = ['area-bubbles', 'area-bubbles-speaker', 'waffle', 'waffle-speaker', 'range-bar', 'range-bar-speaker'];
const deck = (slides, extra = {}) => ({w: 960, h: 540, title: 'prop', ...extra, slides});
const rows = (id, fill) => expandTemplates(deck([{template: id, fill}])).slides[0].els;
const circles = els => els.filter(r => r.w === r.h && r.radius >= r.w && r.bg && !r.bd && r.w > 12);
const rings = els => els.filter(r => r.w === r.h && r.radius >= r.w && /dashed/.test(r.bd || ''));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

test('K10: six proportion templates ship under Numbers — a reading and a speaker cut of each', () => {
  for (const id of IDS) {
    const t = TEMPLATE[id]; assert.ok(t, id + ' ships');
    assert.equal(t.cat, 'Numbers'); assert.equal(t.layout, 'content');
    assert.equal(t.density, id.endsWith('-speaker') ? 'speaker' : 'reading', id + ' density');
  }
  for (const id of ['area-bubbles', 'waffle', 'range-bar']) {
    const slots = t => new Set(TEMPLATE[t].els.filter(r => r.slot).map(r => r.slot));
    assert.ok(slots(id).has('subtitle') && slots(id).has('source'), id + ': the reading cut binds subtitle and source (the foot line)');
    assert.ok(!slots(id + '-speaker').has('subtitle') && !slots(id + '-speaker').has('source'), id + '-speaker: title, visual and labels only');
  }
});

test('K10: area-bubbles — every circle is area-true to its value, every dashed ring to its own', () => {
  const data = [{label: 'A', value: 100}, {label: 'B', value: 25, ring: 64}, {label: 'C', value: 4, ring: 9}];
  for (const id of ['area-bubbles', 'area-bubbles-speaker']) {
    const els = rows(id, {data}), cs = circles(els), rs = rings(els);
    assert.equal(cs.length, 3, id + ': one circle per value'); assert.equal(rs.length, 2, id + ': one ring per ring value');
    const d0 = cs[0].w;
    near(cs[1].w, d0 * Math.sqrt(25 / 100), 1, id + ' B diameter');
    near(cs[2].w, d0 * Math.sqrt(4 / 100), 1, id + ' C diameter');
    near(rs[0].w, d0 * Math.sqrt(64 / 100), 1, id + ' B ring');
    near(rs[1].w, d0 * Math.sqrt(9 / 100), 1, id + ' C ring');
    // a ring is concentric with its circle
    near(rs[0].x + rs[0].w / 2, cs[1].x + cs[1].w / 2, 1, id + ' ring centred x'); near(rs[0].y + rs[0].h / 2, cs[1].y + cs[1].h / 2, 1, id + ' ring centred y');
    const texts = els.filter(r => r.text != null).map(r => r.text);
    assert.ok(texts.includes('100') && texts.includes('25'), id + ': an unformatted value prints as the figure');
  }
  // the ring can be the largest mark: the scale is set by it, so nothing outgrows its column
  const big = circles(rows('area-bubbles', {data: [{label: 'A', value: 10, ring: 40}, {label: 'B', value: 20}]}));
  near(big[1].w * big[1].w / (big[0].w * big[0].w), 2, 0.1, 'area ratio 20:10');
  for (const n of [2, 5]) assert.equal(circles(rows('area-bubbles-speaker', {data: Array.from({length: n}, (_, i) => ({label: 'v' + i, value: i + 1}))})).length, n, n + ' values');
  assert.ok(fillErrors('area-bubbles', {data: Array.from({length: 6}, (_, i) => ({label: 'v' + i, value: i + 1}))}).some(m => /2–5/.test(m)), 'six values refused');
  assert.ok(fillErrors('area-bubbles', {data: [{label: 'a', value: 1}, {label: 'b', value: 0}]}).some(m => /positive/.test(m)), 'a zero value has no area');
  assert.ok(fillErrors('area-bubbles', {data: [{label: 'a', value: 1, ring: 'x'}, {label: 'b', value: 2}]}).some(m => /ring/.test(m)), 'a ring is a number');
});

test('K10: waffle — the filled value lights that many of the 100 cells', () => {
  for (const id of ['waffle', 'waffle-speaker']) for (const pct of [0, 37, 99, 100]) {
    const els = rows(id, {pct}), cells = els.filter(r => r.w === r.h && r.w > 10 && r.w < 40 && r.radius != null && r.radius < r.w / 2);
    assert.equal(cells.length, 100, `${id}: a 10×10 grid`);
    assert.equal(cells.filter(r => r.bg === 'var(--accent)').length, pct, `${id} at ${pct}%`);
    assert.ok(els.some(r => r.text === `${pct}%`), `${id}: the figure reads ${pct}%`);
  }
  assert.ok(fillErrors('waffle', {pct: 120}).length, 'past 100 refused');
});

test('K10: range-bar — each range sits at its low and high on one shared axis, its marker between', () => {
  const data = [{label: 'A', value: 20, high: 50, mark: 30}, {label: 'B', value: 0, high: 100}, {label: 'C', value: 60, high: 80, mark: 75}];
  for (const id of ['range-bar', 'range-bar-speaker']) {
    const els = rows(id, {data}), bars = els.filter(r => r.bar), axis = els.find(r => r.line && r.line[1] === r.y && r.bg === 'var(--fg)');
    assert.equal(bars.length, 3, id + ': one bar per range');
    const x0 = axis.x, span = axis.line[0] - axis.x, max = 100;
    for (const [i, d] of data.entries()) {
      near(bars[i].x, x0 + d.value / max * span, 1, `${id} ${d.label} low`);
      near(bars[i].x + bars[i].w, x0 + d.high / max * span, 1, `${id} ${d.label} high`);
    }
    const marks = els.filter(r => r.w === r.h && r.radius >= r.w && /solid/.test(r.bd || ''));
    assert.equal(marks.length, 2, id + ': one marker per mark value');
    near(marks[0].x + marks[0].w / 2, x0 + 30 / max * span, 1, id + ' marker A'); near(marks[1].x + marks[1].w / 2, x0 + 75 / max * span, 1, id + ' marker C');
  }
  assert.ok(fillErrors('range-bar', {data: [{label: 'a', value: 5, high: 2}, {label: 'b', value: 1, high: 3}]}).some(m => /high/.test(m)), 'high under low refused');
  assert.ok(fillErrors('range-bar', {data: [{label: 'a', value: 1, high: 2, mark: 9}, {label: 'b', value: 1, high: 3}]}).some(m => /mark/.test(m)), 'a marker outside its range refused');
  assert.ok(fillErrors('range-bar', {data: Array.from({length: 5}, (_, i) => ({label: 'v' + i, value: i, high: i + 1}))}).some(m => /2–4/.test(m)), 'the reading cut leaves room for its note: four ranges at most');
  assert.deepEqual(fillErrors('range-bar-speaker', {data: Array.from({length: 5}, (_, i) => ({label: 'v' + i, value: i, high: i + 1}))}), [], 'the speaker cut takes five');
});

test('K10: each validates clean in its density, inside the content area, nothing in the foot band', () => {
  const foot = {id: 'foot', footer: 1, right: 60, y: 506, w: 'auto', role: 'Label', nowrap: 1, text: 'Market · Sep 2026'};
  for (const id of IDS) {
    const density = TEMPLATE[id].density;
    const r = validate(create(deck([{template: id}], {density, master: [foot]})).deck);
    assert.deepEqual(r.errors, [], id + ': ' + r.errors.join(' | '));
    assert.deepEqual(r.warnings.filter(w => /density|foot band|overlap|gap/.test(w)), [], id + ': ' + r.warnings.join(' | '));
    for (const e of TEMPLATE[id].els) if (!e.slot && typeof e.y === 'number') assert.ok(e.y + (e.h || 0) <= FOOT.y, `${id}: row at y ${e.y} ends inside the content area`);
  }
});
