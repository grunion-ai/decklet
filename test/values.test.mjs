// decklet VALUE KEYS gate (ROADMAP U4) — a template's numbers are fill keys, not literals in its source.
// `fill` used to reach text and nothing else, so a filled `harvey-balls` shipped the sample's ratings under the author's
// criteria and `verify` said PASS. Every rating, progress and gauge template now declares its values (`r1c1…r3c4`, `p1…p4`,
// `v1`), `validate` range-checks them, and `--templates` prints them beside the text keys.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {TEMPLATE, templateKeys, templateVals, expandTemplates, templateCatalogue} from '../lib/templates.mjs';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {verify, modelOf} from '../bin/verify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-values-'));
const ROLES = modelOf(read('template.html')).styles.roles;
const deckOf = (slides) => ({w: 960, h: 540, styles: {roles: ROLES}, slides});
const donuts = s => s.els.filter(r => r.donut != null);

// the twelve ratings of the gate's scorecard: 4 criteria × 3 options, every level of the 0–4 scale used
const RATINGS = {r1c1: 4, r1c2: 3, r1c3: 2, r1c4: 1, r2c1: 0, r2c2: 4, r2c3: 3, r2c4: 2, r3c1: 1, r3c2: 0, r3c3: 4, r3c4: 3};

test('values: the rating, progress and gauge templates declare their numbers as keys with a range', () => {
  const decl = id => Object.fromEntries(templateVals(id).map(v => [v.key, v]));
  const hb = decl('harvey-balls');
  assert.deepEqual(Object.keys(hb), Object.keys(RATINGS), 'twelve ratings, row-major');
  for (const v of Object.values(hb)) { assert.deepEqual(v.range, [0, 4], 'a Harvey ball is quartered'); assert.ok(v.of, 'each names the cell it fills'); }
  assert.deepEqual(templateVals('progress-tracker').map(v => v.key), ['p1', 'p2', 'p3', 'p4']);
  for (const v of templateVals('progress-tracker')) assert.deepEqual(v.range, [0, 100]);
  assert.deepEqual(templateVals('chart-gauge').map(v => v.key), ['v1']);
  assert.deepEqual(templateVals('chart-donut').map(v => v.key), ['v1']);
  assert.deepEqual(templateVals('chart-donut-row').map(v => v.key), ['v1', 'v2', 'v3']);
  assert.deepEqual(templateVals('three-up-cards'), [], 'a template with no numbers of its own declares none');
  // the sample still renders from the declared samples: TEMPLATES.els is what the sheet and the catalogue read
  assert.deepEqual(donuts(TEMPLATE['harvey-balls']).map(r => r.donut), [75, 50, 25, 100, 50, 25, 50, 50, 100, 100, 100, 75], 'the shipped sample is unchanged');
});

test('values: a filled harvey-balls carries the filled ratings, not the sample\'s', () => {
  const deck = expandTemplates(deckOf([{template: 'harvey-balls', fill: {t3: 'Coverage', t6: 'Support', ...RATINGS}}]));
  const s = deck.slides[0];
  assert.equal(s.template, undefined, 'consumed');
  assert.deepEqual(donuts(s).map(r => r.donut), Object.values(RATINGS).map(v => v * 25), 'every ring is the rating the author gave it');
  assert.ok(s.els.some(r => r.text === 'Coverage') && s.els.some(r => r.text === 'Support'), 'the text keys still fill');
  // a rating left out keeps the sample's — the same rule text keys follow
  const one = expandTemplates(deckOf([{template: 'harvey-balls', fill: {r1c1: 0}}]));
  assert.deepEqual(donuts(one.slides[0]).map(r => r.donut), [0, 50, 25, 100, 50, 25, 50, 50, 100, 100, 100, 75]);
});

test('values: validate range-checks a value key and lists them when a fill key is unknown', () => {
  const err = fill => validate(deckOf([{template: 'harvey-balls', fill}])).errors;
  assert.ok(err({r1c1: 7}).some(m => /r1c1/.test(m) && /0..4/.test(m)), err({r1c1: 7}).join(' | '));
  assert.ok(err({r1c1: -1}).some(m => /r1c1/.test(m)), 'below the floor too');
  assert.ok(err({r1c1: 'four'}).some(m => /r1c1/.test(m) && /number/.test(m)), 'a rating is a number');
  assert.ok(err({p1: 50}).some(m => /fill key "p1"/.test(m) && /r1c1/.test(m)), 'the message names the value keys: ' + err({p1: 50}).join(' | '));
  assert.deepEqual(err({...RATINGS, r2c1: 0}), [], 'zero is a legal rating');
  assert.ok(validate(deckOf([{template: 'progress-tracker', fill: {p2: 140}}])).errors.some(m => /p2/.test(m) && /0..100/.test(m)));
  assert.deepEqual(validate(deckOf([{template: 'chart-gauge', fill: {v1: 12}}])).errors, []);
});

test('values: progress and gauge fills move the fill AND the number printed on it', () => {
  const p = expandTemplates(deckOf([{template: 'progress-tracker', fill: {p1: 50, p3: 100}}])).slides[0];
  const fills = p.els.filter(r => r.bg === 'var(--accent)' && r.h === 16).map(r => r.w);
  assert.deepEqual(fills, [260, 520 * 0.94, 520, 520 * 0.92].map(Math.round), 'the bar is the value: ' + fills.join(','));
  assert.ok(p.els.some(r => r.text === '50%') && p.els.some(r => r.text === '100%'), 'the label agrees with the bar');
  const g = expandTemplates(deckOf([{template: 'chart-gauge', fill: {v1: 71}}])).slides[0];
  assert.deepEqual(donuts(g).map(r => r.donut), [71]);
  assert.ok(g.els.some(r => r.text === '71%'), 'the number in the ring follows the ring');
  const d = expandTemplates(deckOf([{template: 'chart-donut-row', fill: {v2: 12}}])).slides[0];
  assert.deepEqual(donuts(d).map(r => r.donut), [94, 12, 38]);
});

test('values: --templates prints the value keys with their range beside the text keys', () => {
  const cat = templateCatalogue();
  const block = cat.slice(cat.indexOf('  harvey-balls')).split('\n').slice(0, 30);
  assert.ok(block.some(l => /^\s+t1\s/.test(l)), 'text keys still print');
  assert.ok(block.some(l => /^\s+r1c1\s+0–4\s/.test(l)), 'the rating keys print their range: ' + block.join('\n'));
  assert.ok(block.some(l => /r3c4\s+0–4/.test(l)), 'all twelve');
  assert.match(cat, /p4\s+0–100/);
  assert.match(cat, /v1\s+0–100/);
});

test('values: a Harvey ball is a filled ball, not a hairline ring — `hole` is a row prop the runtime honours', () => {
  const balls = donuts(TEMPLATE['harvey-balls']);
  assert.ok(balls.every(r => r.hole === 0), 'hole 0 = a filled pie, the Harvey-ball convention');
  assert.ok(balls.every(r => r.w >= 40), 'and big enough to read at 960: w=' + balls[0].w);
  assert.ok(donuts(TEMPLATE['chart-donut']).every(r => r.hole == null), 'a donut is still a donut');
  const bad = validate(deckOf([{els: [{x: 0, y: 0, w: 40, donut: 50, hole: 120}]}])).errors;
  assert.ok(bad.some(m => /hole/.test(m)), bad.join(' | '));
  assert.ok(validate(deckOf([{els: [{x: 0, y: 0, w: 40, hole: 0}]}])).errors.some(m => /hole/.test(m) && /donut/.test(m)), 'hole needs a donut to make a hole in');
  assert.match(read('SKILL.md'), /\| `hole` \|/, 'the row prop table carries it');
});

live('live: the four Harvey-ball levels paint as four different balls at 960px', async () => {
  const f = path.join(tmp, 'balls.html');
  fs.writeFileSync(f, create(deckOf([{template: 'harvey-balls', fill: RATINGS}])).html);
  // not --strict: a bare template slide still trips the reading-density warning the library ships with (ROADMAP U7.2)
  const r = await verify(f, {out: path.join(tmp, 'v-balls'), log: () => {}});
  assert.deepEqual(r.errors, [], JSON.stringify(r.parity.filter(p => !p.pass)));
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  const got = await p.evaluate(() => [...canvas.querySelectorAll('.el')].filter(d => getComputedStyle(d).backgroundImage.includes('conic'))
    .map(d => { const c = getComputedStyle(d); return {w: d.getBoundingClientRect().width, img: c.backgroundImage, mask: c.webkitMaskImage || c.maskImage}; }));
  await b.close();
  assert.equal(got.length, 12, 'twelve balls');
  assert.ok(got.every(g => g.w >= 40), 'each at least 40px across: ' + got.map(g => g.w).join(','));
  assert.ok(got.every(g => g.mask === 'none'), 'filled, not masked into a ring: ' + got[0].mask);
  const cut = got.map(g => (g.img.match(/(\d+(?:\.\d+)?)%/) || [])[1]);
  assert.deepEqual(cut, Object.values(RATINGS).map(v => String(v * 25)), 'each ball is cut at its own rating: ' + cut.join(','));
});

// ── U4.2: a chart template's series is a value key too. `data` takes the `chart` row's own array and the template hands it
// to that row, so the numbers arrive through the expansion path the engine already draws with.
const QUARTERS = [{label: 'Q1', value: 41}, {label: 'Q2', value: 58}, {label: 'Q3', value: 52}, {label: 'Q4', value: 77}];
const chartOf = s => s.els.find(r => r.chart);

test('values: the chart templates the chart row can draw declare `data`, with the mark it draws', () => {
  for (const [id, mark, n] of [['chart-column', 'bar', 4], ['chart-grouped', 'bar', 4], ['chart-line-trend', 'line', 6]]) {
    const [v, ...rest] = templateVals(id);
    assert.deepEqual(rest, [], id + ': one value key');
    assert.equal(v.key, 'data'); assert.equal(v.kind, 'data'); assert.equal(v.mark, mark);
    assert.equal(v.sample.length, n, id + ': the sample is the series the sheet shows');
    assert.equal(chartOf(TEMPLATE[id]).chart.mark, mark, id + ': the sample already goes through the chart row');
  }
  assert.deepEqual(templateVals('chart-grouped')[0].series, ['Actual', 'Plan'], 'two series: value and compare');
  assert.deepEqual(templateVals('chart-waterfall'), [], 'a chart the chart row cannot draw keeps its rows fixed');
});

test('values: a filled chart-column expands into bars carrying the filled points', () => {
  const d = deckOf([{template: 'chart-column', fill: {t3: 'Signed bookings · $000s', data: QUARTERS}}]);
  assert.deepEqual(validate(structuredClone(d)).errors, []);
  const rows = validate(d) && d.slides[0].els;   // validate() expands templates then charts, as create() does
  const bars = rows.filter(r => r.bar), labels = rows.filter(r => r.role === 'Label').map(r => r.text);
  assert.equal(bars.length, 4, 'four points, four bars');
  const tops = bars.map(b => b.y);
  assert.deepEqual(tops.map((y, i) => y < tops[0] === (QUARTERS[i].value > 41)), [true, true, true, true], 'bar height follows the value');
  for (const p of QUARTERS) { assert.ok(labels.includes(String(p.value)), 'the value label ' + p.value); assert.ok(labels.includes(p.label), 'the axis label ' + p.label); }
  assert.ok(!labels.includes('62') && !labels.includes('$62K'), 'and none of the sample: ' + labels.join(' '));
  assert.ok(rows.some(r => r.text === 'Signed bookings · $000s'), 'the text keys still fill');
  // two series: value and compare, eight bars
  const g = deckOf([{template: 'chart-grouped', fill: {data: QUARTERS.map((p, i) => ({...p, compare: 60 + i}))}}]);
  validate(g);
  assert.equal(g.slides[0].els.filter(r => r.bar).length, 8, 'four pairs');
});

test('values: a data fill the chart row refuses is a validate error, named on the key', () => {
  const bad = fill => validate(deckOf([{template: 'chart-column', fill}])).errors;
  assert.ok(bad({data: [{label: 'Q1', value: 41}]}).some(m => /"data"/.test(m) && /two data points/.test(m)), bad({data: [{label: 'Q1', value: 41}]}).join(' | '));
  assert.ok(bad({data: [{label: 'Q1', value: 'lots'}, {label: 'Q2', value: 2}]}).some(m => /"data"/.test(m) && /must be a number/.test(m)));
  assert.ok(bad({data: 'four quarters'}).some(m => /"data"/.test(m)));
  assert.deepEqual(bad({data: QUARTERS}), []);
});

test('values: --templates says which chart templates take data, and the rest keep their series fixed', () => {
  const cat = templateCatalogue();
  const block = id => cat.slice(cat.indexOf('  ' + id.padEnd(22))).split('\n').slice(0, 8);
  assert.ok(block('chart-column').some(l => /^\s+data\s+bar data\s/.test(l)), block('chart-column').join('\n'));
  assert.ok(block('chart-line-trend').some(l => /^\s+data\s+line data\s/.test(l)), 'the line chart names its mark');
  assert.ok(block('chart-column').some(l => /fixed: none — every row fills/.test(l)), 'nothing left fixed: ' + block('chart-column').join('\n'));
  assert.ok(block('chart-waterfall').some(l => /fixed: 5 rules · 5 shapes/.test(l)), 'a chart without a data key still says its rows are fixed');
});

live('live: a filled chart-column deck verifies, and the bars on the page are the filled numbers', async () => {
  const f = path.join(tmp, 'chart.html');
  fs.writeFileSync(f, create(deckOf([{template: 'chart-column', fill: {data: QUARTERS}}])).html);
  const r = await verify(f, {out: path.join(tmp, 'v-chart'), log: () => {}});
  assert.deepEqual(r.errors, [], JSON.stringify(r.parity.filter(p => !p.pass)));
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  const got = await p.evaluate(() => [...canvas.querySelectorAll('.el')].map(d => d.textContent).filter(t => /^\d+$/.test(t)));
  await b.close();
  assert.deepEqual(got.filter(t => QUARTERS.some(q => String(q.value) === t)).sort(), ['41', '52', '58', '77'], 'every point is painted: ' + got.join(','));
});
