// K22: a template graphic that encodes a quantity (a bar's length, a fill, a position, a count) takes its value from a
// named fill key on one scale, never from the template's own sample. v4's one-shot agent refused benchmark-table,
// table-insight and exec-summary rather than ship their sample bars under its own rows. The guard: a FILLED template
// whose quantity key is not filled fails expansion with a message naming the key, unless the graphic is optional, in
// which case it is dropped; a template whose graphic no key reaches yet (SAMPLE_BOUND) refuses any fill.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TEMPLATE, TEMPLATES, templateVals, templateFixed, templateCatalogue, fillErrors, expandTemplates, SAMPLE_BOUND} from '../lib/templates.mjs';
import {validate} from '../bin/validate.mjs';
import {initials} from '../lib/assets.mjs';

const deck = slides => ({w: 960, h: 540, title: 'values', slides});
const rows = (id, fill) => { const d = deck([{template: id, fill}]); expandTemplates(d); assert.equal(d.slides[0].template, undefined, `${id} expanded: ${fillErrors(id, fill).join(' | ')}`); return d.slides[0].els; };
const keys = id => templateVals(id).map(v => v.key);
const errs = (id, fill) => fillErrors(id, fill);
const texts = els => els.filter(r => r.text != null).map(r => r.text);

test('K22: every audited template declares its quantities as value keys', () => {
  assert.deepEqual(keys('stat-hero'), ['hours']);
  assert.deepEqual(keys('stat-row-3'), ['was1', 'now1', 'was2', 'now2', 'was3', 'now3']);
  assert.deepEqual(keys('stat-row-4'), ['was1', 'now1', 'was2', 'now2', 'was3', 'now3', 'was4', 'now4']);
  assert.deepEqual(keys('kpi-scorecard'), ['s1', 's2', 's3', 's4', 's5', 's6']);
  assert.deepEqual(keys('stat-plus-chart'), ['data']);
  assert.deepEqual(keys('delta-pair'), ['was', 'now']);
  assert.deepEqual(keys('benchmark-table'), ['highlight', 'bar1', 'bar2', 'bar3', 'bar4']);
  assert.deepEqual(keys('table-insight'), ['highlight', 'bar1', 'bar2', 'bar3', 'bar4']);
  assert.deepEqual(keys('bento-grid'), ['data']);
  assert.deepEqual(keys('dashboard-composite'), ['data']);
  assert.deepEqual(keys('exec-summary'), ['l1', 'l2', 'l3']);
});

// ── each quantity graphic follows its key
const pairsOf = (els, h) => els.filter(r => r.h === h && r.radius === 3 && r.text == null && (r.bg === 'var(--line)' || r.bg === 'var(--accent)') && r.w !== 840);

test('K22: stat-hero lights the filled hours of the week, and drops the week when hours is not filled', () => {
  const lit = els => els.filter(r => r.bg === 'var(--accent)' && r.h === 22 && r.x >= 650).reduce((n, r) => n + r.w, 0);
  assert.equal(lit(rows('stat-hero', {hours: 20})), 600, '20 hours at 30px an hour');
  assert.equal(lit(rows('stat-hero', {hours: 0})), 0);
  const bare = rows('stat-hero', {t3: '4.2 hrs'});
  assert.equal(bare.filter(r => r.x >= 650 && r.h === 22).length, 0, 'the week bars drop');
  assert.ok(!texts(bare).some(s => /8-hour day|40-hour week/.test(s)), 'and their captions with them');
  assert.ok(errs('stat-hero', {t3: '4.2 hrs', t5: 'One bar, one day'}).some(m => /"t5"/.test(m) && /hours/.test(m)), 'a caption of a dropped graphic is refused');
});

test('K22: stat-row-3 and stat-row-4 draw each before/after pair from its own keys', () => {
  for (const [id, n, h] of [['stat-row-3', 3, 22], ['stat-row-4', 4, 18]]) {
    const fill = Object.fromEntries(Array.from({length: n}, (_, i) => [[`was${i + 1}`, 10 * (i + 1)], [`now${i + 1}`, 40]]).flat());
    const els = rows(id, fill), ps = pairsOf(els, h);
    assert.equal(ps.length, 2 * n, `${id}: two bars a column`);
    const colW = Math.max(...ps.map(r => r.w));
    for (let i = 0; i < n; i++) {
      assert.equal(ps[2 * i].w, Math.round(colW * 10 * (i + 1) / 40), `${id} column ${i + 1}: the before bar is its share of the larger`);
      assert.equal(ps[2 * i + 1].w, colW, `${id} column ${i + 1}: the after bar is the larger`);
    }
    // a column left unfilled drops its pair; the others keep theirs
    const some = rows(id, {was1: 5, now1: 10});
    assert.equal(pairsOf(some, h).length, 2, `${id}: only column 1 draws`);
    assert.equal(pairsOf(rows(id, {t1: 'x'}), h).length, 0, `${id}: no numbers, no pairs`);
    assert.ok(errs(id, {was2: 5}).some(m => /"now2"/.test(m)), `${id}: half a pair names the missing key`);
  }
});

// exec-summary's graphic needs no number: each column names its players with up to four logos (l1..l3)
test('K22: exec-summary draws each column\'s logo group from its key, and drops a column left out', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=', logosOf = els => els.filter(r => r.logo != null);
  assert.equal(logosOf(TEMPLATE['exec-summary'].els).length, 11, 'the sample draws the fictional camps as monogram chips');
  const els = rows('exec-summary', {l1: [{logo: PNG, aspect: 3, alt: 'Acme'}], l3: [{logo: '', alt: 'Beta Works'}, {logo: '', alt: 'Gamma'}]});
  const L = logosOf(els);
  assert.deepEqual(L.map(r => r.alt), ['Acme', 'Beta Works', 'Gamma'], 'only the filled logos draw');
  assert.equal(L[0].logo, PNG); assert.equal(L[0].aspect, 3);
  assert.equal(L[1].monogram, initials('Beta Works'), "logo '' draws the monogram of alt");
  assert.equal(L[1].y, L[2].y, 'a group fills its 2×2 grid row by row');
  const lines = els.filter(r => r.role === 'Body' && r.y > 250).map(r => r.y);
  assert.deepEqual(lines, [392, 284, 392], 'the column left out moves its line up under the rule');
  assert.equal(logosOf(rows('exec-summary', {t1: 'x'})).length, 0, 'no logos, no groups');
  assert.ok(errs('exec-summary', {l1: []}).some(m => /"l1"/.test(m) && /1–4/.test(m)), 'an empty group is refused');
  assert.ok(errs('exec-summary', {l1: [{logo: PNG}]}).some(m => /alt/.test(m)), 'a logo names its company');
  assert.ok(errs('exec-summary', {l1: [{icon: 'factory', alt: 'x'}]}).some(m => /l1\[0\]/.test(m)), 'a group takes logos only');
});

test('K22: kpi-scorecard draws each sparkline from its series, on that series\' own range', () => {
  const data = [0, 100, 0, 100, 0].map((value, i) => ({label: 'M' + i, value}));
  const els = rows('kpi-scorecard', {s1: data});
  const seg = els.filter(r => r.line && r.butt);
  assert.equal(seg.length, 4, 'one card draws: four segments');
  assert.deepEqual(seg.map(r => r.y), [278, 258, 278, 258], 'low · high · low · high, 20px apart');
  assert.equal(rows('kpi-scorecard', {t1: 'x'}).filter(r => r.line && r.butt).length, 0, 'no series, no sparklines');
});

test('K22: stat-plus-chart and dashboard-composite hand their series to a chart row, and need it', () => {
  const data = [{label: 'Q1', value: 5}, {label: 'Q2', value: 9}];
  for (const id of ['stat-plus-chart', 'dashboard-composite']) {
    const c = rows(id, {data}).find(r => r.chart);
    assert.deepEqual(c.chart.data, data, id);
    assert.ok(errs(id, {t1: 'x'}).some(m => /"data"/.test(m) && /not filled/.test(m)), `${id}: ${errs(id, {t1: 'x'}).join(' | ')}`);
  }
});

test('K22: delta-pair sizes both bars from was and now', () => {
  const bars = els => els.filter(r => r.h === 44 && r.y === 380);
  assert.deepEqual(bars(rows('delta-pair', {was: 10, now: 40})).map(r => r.w), [75, 300]);
  assert.deepEqual(bars(rows('delta-pair', {was: 40, now: 10})).map(r => r.w), [300, 75]);
  assert.equal(bars(rows('delta-pair', {t3: '9 days'})).length, 0, 'unfilled: the pair drops');
});

test('K22: benchmark-table and table-insight size each row bar from bar1..bar4 on one scale', () => {
  const bars = (els, h) => els.filter(r => r.h === h && r.radius === 3 && r.text == null);
  assert.deepEqual(bars(rows('benchmark-table', {bar1: 10, bar2: 20, bar3: 40, bar4: 0}), 20).map(r => r.w), [28, 55, 110, 2], 'the largest fills 110px');
  assert.equal(bars(rows('benchmark-table', {t1: 'x'}), 20).length, 0, 'no figures, no bars');
  assert.deepEqual(bars(rows('table-insight', {bar1: 50, bar2: 100, bar3: 25, bar4: 0}), 18).map(r => r.w), [28, 56, 14], 'percent of 56px; zero draws none');
  assert.equal(bars(rows('table-insight', {t1: 'x'}), 18).length, 0);
  assert.ok(errs('table-insight', {bar1: 50}).some(m => /"bar2"/.test(m)), 'the four bars are one set');
});

test('K22: table-insight bolds the filled highlight row, and none when it is not filled', () => {
  const bold = els => [...new Set(els.filter(r => r.weight === 700).map(r => r.y))];
  assert.equal(bold(TEMPLATE['table-insight'].els).length, 1, 'the sample bolds its 2025 row');
  assert.deepEqual(bold(rows('table-insight', {t1: 'x'})), [], 'a filled slide bolds nothing it was not told to');
  assert.deepEqual(bold(rows('table-insight', {highlight: 0})), [218]);
});

test('K22: bento-grid draws its hero bars from data, or none', () => {
  const bars = els => els.filter(r => r.bar);
  const els = rows('bento-grid', {data: [{label: 'a', value: 1}, {label: 'b', value: 2}]});
  assert.deepEqual(bars(els).map(r => r.h), [75, 150], 'the larger fills 150px');
  assert.equal(bars(rows('bento-grid', {t1: 'x'})).length, 0);
});

// ── the guard, across every template with value keys
test('K22: a filled template with a required value key left out fails expansion, naming the key', () => {
  for (const t of TEMPLATES) for (const v of templateVals(t.id)) {
    if (v.optional) continue;
    const fill = {t1: 'Filled', ...Object.fromEntries(templateVals(t.id).filter(w => w.key !== v.key).map(w => [w.key, w.sample]))};
    const e = errs(t.id, fill);
    assert.ok(e.some(m => m.includes(`"${v.key}"`) && /not filled/.test(m)), `${t.id} without ${v.key}: ${e.join(' | ')}`);
    const d = deck([{template: t.id, fill}]); expandTemplates(d);
    assert.equal(d.slides[0].template, t.id, `${t.id}: the slide keeps its template for validate to report`);
  }
  const r = validate(deck([{template: 'harvey-balls', fill: {r1c1: 0}}]));
  assert.ok(r.errors.some(m => /"r1c2"/.test(m)), r.errors.join(' | '));
});

test('K22: an unfilled template is the sample, whatever it declares', () => {
  for (const t of TEMPLATES) assert.deepEqual(errs(t.id, {}), [], t.id);
});

test('K22: a template whose graphic no key reaches yet refuses a fill, naming the graphic', () => {
  for (const [id, what] of Object.entries(SAMPLE_BOUND)) {
    assert.ok(TEMPLATE[id], id);
    const e = errs(id, {t1: 'x'});
    assert.ok(e.some(m => m.includes(id) && m.includes(what) && /sample/.test(m)), `${id}: ${e.join(' | ')}`);
    assert.deepEqual(errs(id, {}), [], `${id}: the bare sample still expands`);
  }
  assert.equal(/sample-bound/.test(templateCatalogue()), Object.keys(SAMPLE_BOUND).length > 0, 'the catalogue names a sample-bound template, and only then');
});

// ── the 20 templates PR #133 left sample-bound: every bar, ring, point, cell and series now comes from the fill
const FORMER_BOUND = ['chart-stacked-100', 'chart-area-band', 'chart-waterfall', 'chart-scatter', 'chart-heatmap', 'chart-histogram', 'chart-slope',
  'chart-dumbbell', 'chart-small-multiples', 'chart-marimekko', 'chart-pareto', 'funnel-stages', 'gantt-lanes', 'quad-growth-share', 'quad-movement',
  'quad-risk-heat', 'quad-with-panel', 'pad-default-60', 'density-reading', 'chrome-dots'];
const sampleOf = id => Object.fromEntries(templateVals(id).map(v => [v.key, v.sample]));
const fillOf = (id, over) => rows(id, {...sampleOf(id), ...over});
const centreOf = r => [r.x + r.w / 2, r.y + r.h / 2];
const round = n => Math.round(n);

test('K22: nothing is sample-bound any more, and each former one declares value keys', () => {
  assert.deepEqual(SAMPLE_BOUND, {});
  for (const id of FORMER_BOUND) {
    assert.ok(templateVals(id).length, `${id} declares value keys`);
    assert.deepEqual(errs(id, {t1: 'Filled', ...sampleOf(id)}), [], `${id}: its own sample fills clean`);
  }
});

test('K22: chart-stacked-100 draws each column as the shares of its own c#s# keys', () => {
  assert.deepEqual(keys('chart-stacked-100'), [1, 2, 3, 4].flatMap(c => [1, 2, 3].map(s => `c${c}s${s}`)));
  const fill = Object.fromEntries([1, 2, 3, 4].flatMap(c => [[`c${c}s1`, 1], [`c${c}s2`, 1], [`c${c}s3`, 2]]));
  const els = rows('chart-stacked-100', fill), segs = els.filter(r => r.w === 108 && r.h != null && r.text == null);
  assert.equal(segs.length, 12);
  assert.deepEqual(segs.slice(0, 3).map(r => r.h), [53, 53, 105], 'a quarter, a quarter, a half of 210px');
  assert.ok(texts(els).includes('50%') && texts(els).includes('25%'), 'the labels read the shares');
});

test('K22: chart-area-band draws the band and the median line from data, on one scale', () => {
  const data = [10, 20, 30, 40, 50, 60].map((m, i) => ({label: 'P' + (i + 1), value: m, low: m - 5, high: m + 5}));
  const els = rows('chart-area-band', {data}), band = els.filter(r => r.op === 0.16);
  const Y = v => 400 - 210 * v / 65;
  assert.equal(band.length, 6);
  assert.equal(round(band[5].y), round(Y(65)), 'the highest high reaches the top of the plot');
  assert.equal(round(band[0].h), round(Y(5) - Y(15)), 'each band spans low to high');
  const med = els.filter(r => Array.isArray(r.line) && r.bg === 'var(--accent)');
  assert.equal(round(med[0].y), round(Y(10)));
  assert.ok(texts(els).includes('P6'), 'the axis reads the data labels');
  assert.ok(errs('chart-area-band', {data: data.slice(0, 5)}).some(m => /6/.test(m)), 'six periods');
  assert.ok(errs('chart-area-band', {data: data.map(p => ({...p, low: p.high + 1}))}).some(m => /low/.test(m)));
});

test('K22: chart-waterfall builds the bridge from a start, three drivers and an end', () => {
  const data = [{label: 'Start', value: 100}, {label: 'Up', value: 50}, {label: 'Down', value: -30}, {label: 'Down 2', value: -20}, {label: 'End', value: 100}];
  const els = rows('chart-waterfall', {data}), bars = els.filter(r => r.w === 108 && r.radius === 3);
  const k = 190 / 150, Y = v => 400 - v * k;
  assert.deepEqual(bars.map(r => [round(r.y), round(r.h)]), [[round(Y(100)), round(100 * k)], [round(Y(150)), round(50 * k)],
    [round(Y(150)), round(30 * k)], [round(Y(120)), round(20 * k)], [round(Y(100)), round(100 * k)]]);
  assert.ok(texts(els).includes('+50') && texts(els).includes('−30'), 'drivers print signed');
  assert.ok(errs('chart-waterfall', {data: data.map((p, i) => i === 4 ? {...p, value: 90} : p)}).some(m => /100/.test(m)), 'the end is start plus drivers');
});

test('K22: chart-scatter places, sizes and names its bubbles from x#, y#, s#', () => {
  const fill = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].flatMap(i => [[`x${i}`, i * 10], [`y${i}`, i * 10], [`s${i}`, i === 2 ? 400 : 100]]));
  const els = rows('chart-scatter', fill), dots = els.filter(r => r.radius != null && r.w === r.h);
  const [cx, cy] = centreOf(dots[0]);   // an odd diameter lands the box on a half pixel, which the canvas scale rounds
  assert.ok(Math.abs(cx - round(240 + 10 * 6.6)) <= 1 && Math.abs(cy - round(410 - 10 * 2.34)) <= 1, `${cx},${cy}`);
  const big = dots.filter(r => r.w === 46);
  assert.equal(big.length, 2, 'the largest balance draws at 46px, lit on top');
  assert.equal(dots.find(r => r.w === 23).w, 23, 'a quarter of the area is half the diameter');
  const name = els.find(r => r.text === 'Harbor');
  assert.equal(name.x, centreOf(big[0])[0] + 23 + 13, 'the name follows the largest bubble');
});

test('K22: chart-heatmap tints each cell from its r#c# value', () => {
  const fill = Object.fromEntries([1, 2, 3].flatMap(r => [1, 2, 3, 4, 5].map(c => [`r${r}c${c}`, r === 2 && c === 3 ? 4 : 1])));
  const cells = rows('chart-heatmap', fill).filter(r => r.w === 100 && r.h === 62);
  assert.equal(cells.length, 15);
  assert.equal(cells[7].op, 0.95, 'the largest is the darkest tint');
  assert.equal(cells[0].op, 0.24);
});

test('K22: chart-histogram draws b1..b10 on one scale and the median where it is filled', () => {
  const fill = {...Object.fromEntries(Array.from({length: 10}, (_, i) => [`b${i + 1}`, i === 5 ? 2 : 1])), median: 5.5};
  const els = rows('chart-histogram', fill), bars = els.filter(r => r.w === 64);
  assert.deepEqual(bars.map(r => round(r.h)), [99, 99, 99, 99, 99, 197, 99, 99, 99, 99]);
  assert.equal(bars[5].bg, 'var(--accent)', 'the median bin is lit');
  assert.equal(els.find(r => r.dash && Array.isArray(r.line)).x, round(220 + 5.5 * 68));
});

test('K22: chart-slope draws each line from its two values, and lights the biggest riser', () => {
  const data = [{label: 'A', from: 10, value: 40}, {label: 'B', from: 40, value: 20}, {label: 'C', from: 20, value: 20}];
  const els = rows('chart-slope', {data}), lines = els.filter(r => Array.isArray(r.line) && r.x === 340 && r.h > 2);
  const Y = v => round(400 - 190 * v / 40);
  assert.deepEqual(lines.map(r => [r.y, r.line[1]]), [[Y(10), Y(40)], [Y(40), Y(20)], [Y(20), Y(20)]]);
  assert.equal(lines[0].bg, 'var(--accent)');
  assert.ok(texts(els).includes('40') && texts(els).includes('A'));
});

test('K22: chart-dumbbell places both dots of each row and prints the gap', () => {
  const data = [{label: 'a', value: 10, target: 20}, {label: 'b', value: 0, target: 40}, {label: 'c', value: 30, target: 20}, {label: 'd', value: 5, target: 10}];
  const els = rows('chart-dumbbell', {data}), X = v => round(280 + 480 * v / 40);
  const lines = els.filter(r => Array.isArray(r.line) && r.h === 3);
  assert.deepEqual(lines.map(r => [r.x, r.line[0]]), [[X(10), X(20)], [X(0), X(40)], [X(30), X(20)], [X(5), X(10)]]);
  assert.ok(texts(els).includes('+40') && texts(els).includes('−10'));
  assert.equal(els.find(r => r.text === '+40').color, 'var(--accent)', 'the largest gap is lit');
});

test('K22: chart-small-multiples draws six panels from p1..p6 on one shared scale', () => {
  const s = (...v) => v.map((value, i) => ({label: 'Q' + (i + 1), value}));
  const fill = {p1: s(10, 20, 30, 40), p2: s(80, 80, 80, 80), p3: s(1, 1, 1, 1), p4: s(1, 1, 1, 1), p5: s(1, 1, 1, 1), p6: s(1, 1, 1, 1)};
  const bars = rows('chart-small-multiples', fill).filter(r => r.w === 44);
  assert.deepEqual(bars.slice(0, 8).map(r => r.h), [9, 19, 28, 37, 74, 74, 74, 74], 'the tallest bar of all six fills 74px');
  assert.ok(errs('chart-small-multiples', {...fill, p2: s(1, 2)}).some(m => /4/.test(m)));
});

test('K22: chart-marimekko sizes columns from w# and segments from c#s#', () => {
  const fill = {w1: 1, w2: 1, w3: 1, w4: 1, ...Object.fromEntries([1, 2, 3, 4].flatMap(c => [[`c${c}s1`, 50], [`c${c}s2`, 25], [`c${c}s3`, 25]]))};
  const els = rows('chart-marimekko', fill), segs = els.filter(r => r.bg && r.h != null && r.text == null && r.y >= 190);
  assert.deepEqual([...new Set(segs.map(r => r.w))], [179], 'four equal columns share 740px');
  assert.deepEqual(segs.slice(0, 3).map(r => r.h), [100, 50, 50]);
  assert.ok(texts(els).includes('1 deals'));
});

test('K22: chart-pareto draws bars and the cumulative line from data, lighting the causes up to 80%', () => {
  const data = [50, 30, 10, 5, 3, 2].map((value, i) => ({label: 'c' + i, value}));
  const els = rows('chart-pareto', {data}), bars = els.filter(r => r.w === 92);
  assert.deepEqual(bars.map(r => r.h), [210, 126, 42, 21, 13, 8]);
  assert.deepEqual(bars.map(r => r.bg === 'var(--accent)'), [true, true, false, false, false, false], 'lit until the running total reaches 80%');
  const pts = els.filter(r => r.w === 8 && r.radius === 8).map(r => round(centreOf(r)[1]));
  assert.deepEqual(pts, [50, 80, 90, 95, 98, 100].map(p => round(240 - 1.1 * p)));
  assert.ok(errs('chart-pareto', {data: [...data].reverse()}).some(m => /largest first/.test(m)));
});

test('K22: funnel-stages sizes each band from data and names the biggest drop', () => {
  const data = [{label: 'a', value: 1000}, {label: 'b', value: 900}, {label: 'c', value: 300}, {label: 'd', value: 200}];
  const els = rows('funnel-stages', {data}), bands = els.filter(r => r.h === 52);
  assert.deepEqual(bands.map(r => r.w), [480, 432, 144, 96]);
  const drop = els.find(r => /here$/.test(r.text || ''));
  assert.equal(drop.text, '−67% here', 'the most lost between two stages, as a share of the first');
  assert.equal(drop.y, 176 + 2 * 66 - 8);
  assert.ok(texts(els).includes('1,000'));
});

test('K22: gantt-lanes places each lane bar from start#/span# and the today line from today', () => {
  const els = rows('gantt-lanes', {start1: 0, span1: 1, start2: 1, span2: 4, start3: 4.5, span3: 0.5, today: 1.5});
  const bars = els.filter(r => r.h === 34);
  assert.deepEqual(bars.map(r => [r.x, r.w]), [[308, 104], [428, 464], [848, 44]]);
  assert.equal(els.find(r => r.dash).x, 480);
  assert.ok(errs('gantt-lanes', {...sampleOf('gantt-lanes'), start1: 4, span1: 2}).some(m => /start1/.test(m) && /5/.test(m)), 'a bar ends by the grid\'s last month');
});

test('K22: quad-growth-share, quad-risk-heat and quad-with-panel place every mark from x#/y#', () => {
  const g = rows('quad-growth-share', {x1: 50, y1: 50, s1: 100, x2: 0, y2: 0, s2: 25, x3: 100, y3: 100, s3: 25, x4: 25, y4: 75, s4: 25});
  const dots = g.filter(r => r.radius != null && r.w === r.h);
  assert.deepEqual(centreOf(dots[0]), [560, 303]); assert.equal(dots[0].w, 52); assert.equal(dots[1].w, 26);
  const risk = rows('quad-risk-heat', Object.fromEntries([1, 2, 3, 4, 5].flatMap(i => [[`x${i}`, i * 20 - 10], [`y${i}`, 50]])));
  assert.deepEqual(risk.filter(r => r.w === 26 && r.radius).map(r => centreOf(r)), [10, 30, 50, 70, 90].map(x => [round(60 + x * 6.4), 303]));
  assert.deepEqual(risk.filter(r => /^[1-5]$/.test(r.text)).map(r => r.x + 13), [10, 30, 50, 70, 90].map(x => round(60 + x * 6.4)), 'each number rides its disc');
  const p = rows('quad-with-panel', {x1: 0, y1: 0, x2: 50, y2: 50, x3: 100, y3: 100}).filter(r => r.radius != null && r.w === r.h);
  assert.deepEqual(p.map(centreOf), [[60, 420], [320, 298], [580, 176]]);
});

test('K22: quad-movement draws each player from where it was to where it is', () => {
  const els = rows('quad-movement', {fx1: 10, fy1: 10, x1: 30, y1: 30, fx2: 60, fy2: 20, x2: 70, y2: 40, fx3: 90, fy3: 90, x3: 90, y3: 90});
  const arrows = els.filter(r => r.arrow && r.waive);
  assert.equal(arrows.length, 2, 'a player that did not move draws no arrow');
  const ends = els.filter(r => r.radius != null && r.w === r.h && r.w >= 14).map(centreOf);
  assert.deepEqual(ends, [[456, 354], [664, 328], [768, 201]]);
});

test('K22: pad-default-60 and density-reading draw their bars from data, or drop them', () => {
  for (const id of ['pad-default-60', 'density-reading']) {
    const data = [1, 2, 3, 4].map((value, i) => ({label: 'Y' + i, value, text: value + 'x'}));
    const bars = rows(id, {data}).filter(r => r.bar);
    assert.deepEqual(bars.map(r => r.h), [38, 75, 113, 150], id);
    assert.equal(rows(id, {t1: 'x'}).filter(r => r.bar).length, 0, `${id}: no data, no bars`);
  }
  assert.ok(!texts(rows('density-reading', {t1: 'x'})).includes('Late'), 'the legend drops with the bars it explains');
});

test('K22: chrome-dots draws count dots and lights the at-th', () => {
  const dots = rows('chrome-dots', {at: 4, count: 4}).filter(r => r.w === 9);
  assert.equal(dots.length, 4);
  assert.deepEqual(dots.map(r => r.bg === 'var(--accent)'), [false, false, false, true]);
  assert.ok(errs('chrome-dots', {at: 5, count: 4}).some(m => /at/.test(m)));
});

// the net under the audit: no template outside SAMPLE_BOUND keeps a bar, ring or chart series fill cannot reach
test('K22: every template keys its bars, rings and chart series, or is listed sample-bound', () => {
  for (const t of TEMPLATES) {
    if (SAMPLE_BOUND[t.id] || t.cat === 'Logo') continue;   // the Logo shelf's rings are placeholder marks, not quantities
    const f = templateFixed(t.id).filter(s => /ring|bar|chart/.test(s));
    assert.deepEqual(f, [], t.id);
  }
});
