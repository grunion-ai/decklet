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
  assert.match(templateCatalogue(), /sample-bound/);
});

// the net under the audit: no template outside SAMPLE_BOUND keeps a bar, ring or chart series fill cannot reach
test('K22: every template keys its bars, rings and chart series, or is listed sample-bound', () => {
  for (const t of TEMPLATES) {
    if (SAMPLE_BOUND[t.id] || t.cat === 'Logo') continue;   // the Logo shelf's rings are placeholder marks, not quantities
    const f = templateFixed(t.id).filter(s => /ring|bar|chart/.test(s));
    assert.deepEqual(f, [], t.id);
  }
});
