// K15: benchmark-table used to tint one row (hardcoded to a y-position) and bold a different one (hardcoded to a
// row index) — v1 and v3 both shipped the mismatch. One fill key, `highlight`, now drives both, so they always
// name the same row; the sample defaults to none, so the library's own sample carries no highlight.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TEMPLATE, templateVals, fillErrors, expandTemplates} from '../lib/templates.mjs';

const deck = (slides) => ({w: 960, h: 540, title: 'bench', slides});
// the fixed highlight band: the one full-width rect with no text, present (transparent or tinted) on every render
const tint = els => els.find(e => e.w === 840 && e.h === 40 && e.text == null && e.bg != null);
// the row index a bold text cell sits on, by its y (rows start at 208, 40px apart)
const boldRows = els => [...new Set(els.filter(e => e.weight === 700).map(e => Math.round((e.y - 218) / 40)))];

test('bench: benchmark-table declares one value key naming the highlighted row, defaulting to none', () => {
  const vals = templateVals('benchmark-table');
  assert.equal(vals.filter(v => !/^bar[1-4]$/.test(v.key)).length, 1, 'exactly one value key names the row (bar1..bar4 size the bars, K22)');
  assert.equal(vals[0].key, 'highlight');
  assert.equal(vals[0].sample, -1, 'the sample carries no highlight');
  assert.deepEqual(vals[0].range, [-1, 3]);
});

test('bench: the sample (no fill) tints and bolds nothing', () => {
  const t = TEMPLATE['benchmark-table'];
  assert.equal(tint(t.els).bg, 'transparent', 'the highlight band is present but invisible by default');
  assert.deepEqual(boldRows(t.els), [], 'no row is bold by default');
});

test('bench: fill {highlight: N} tints and bolds the SAME row N, for every row', () => {
  for (let hi = 0; hi <= 3; hi++) {
    const d = deck([{template: 'benchmark-table', fill: {highlight: hi}}]);
    assert.deepEqual(fillErrors('benchmark-table', {highlight: hi}), []);
    expandTemplates(d);
    const els = d.slides[0].els;
    const band = tint(els);
    assert.equal(band.bg, 'var(--box)', `row ${hi}: tint visible`);
    assert.equal(band.y, 208 + hi * 40, `row ${hi}: tint sits on the same row the text bolds`);
    assert.deepEqual(boldRows(els), [hi], `row ${hi}: only that row is bold`);
  }
});

test('bench: fill {highlight: -1} is explicit "none" — same as the sample', () => {
  const d = deck([{template: 'benchmark-table', fill: {highlight: -1}}]);
  expandTemplates(d);
  const els = d.slides[0].els;
  assert.equal(tint(els).bg, 'transparent');
  assert.deepEqual(boldRows(els), []);
});

test('bench: fill rejects a row outside the table', () => {
  const errs = fillErrors('benchmark-table', {highlight: 4});
  assert.ok(errs.some(m => /highlight/.test(m) && /0\.\.3|-1\.\.3/.test(m)), errs.join(' | '));
});
