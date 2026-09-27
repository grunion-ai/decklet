// decklet chart row gate — `{chart:{mark,data,…}}` expands at create time into the ordinary rows the agents were hand-building
// (rects, lines, dots, labels), with the drawing rules baked in. The output deck stays hand-editable; the runtime has no chart code.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {verify, modelOf} from '../bin/verify.mjs';
import {chartRows, expandCharts, checkChart, hbarGeometry} from '../lib/chart.mjs';
import {logoGeom} from '../lib/logo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-chart-'));
const roles = create({slides: [{els: []}]}).deck.styles.roles;   // the neutral scale (Label 11/14, Caption 13/18)
const BOX = {x: 60, y: 136, w: 840, h: 276};
const bars = {mark: 'bar', data: [{label: 'Jun', value: 380}, {label: 'Jul', value: 410}, {label: 'Aug', value: 450, muted: true}, {label: 'Sep', value: 520}], source: 'Renewal Radar, Q3'};
const rising = {mark: 'line', data: [38, 41, 44, 46, 49, 53, 57, 60, 63].map((v, k) => ({label: 'M' + (k + 1), value: v})), annotations: [{at: 4, text: 'Radar switched on'}], source: 'Renewals by month'};
// exact segment × rect intersection (Liang–Barsky), independent of the sampler the library uses
const hits = (seg, r, m = 0) => { const [x0, y0, x1, y1] = seg, L = r.x - m, R = r.x + r.w + m, T = r.y - m, B = r.y + r.h + m;
  let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 - L], [dx, R - x0], [-dy, y0 - T], [dy, B - y0]]) { if (p === 0) { if (q < 0) return false; continue; } const t = q / p; if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); if (t0 > t1) return false; }
  return true; };

test('chart: a bar chart expands to bars from a zero baseline, direct value labels, axis labels, one explicit scale, a dashed grey baseline and a source line', () => {
  const rows = chartRows({...BOX, chart: bars}, roles);
  const n = bars.data.length;
  assert.equal(rows.length, 4 + 3 * n + 1, 'baseline + max tick + max label + zero label, three rows per bar, source');
  const barRows = rows.filter(r => r.bar), base = rows.find(r => r.line && r.dash);
  assert.equal(barRows.length, n);
  assert.ok(base && base.bg === 'var(--muted)' && base.h === 1, 'grey dashed baseline');
  for (const b of barRows) assert.equal(b.y + b.h, base.y, 'every bar stands on the baseline: bars start at zero');
  const top = Math.max(...barRows.map(b => b.h)), tallest = barRows.find(b => b.h === top);
  assert.equal(tallest.bg, 'var(--accent)', 'first series is the full accent');
  assert.deepEqual([barRows[2].bg, barRows[2].op], ['var(--muted)', 0.6], 'muted:true is grey');
  const maxLabel = rows.find(r => r.role === 'Label' && r.align === 'right' && /^\d/.test(r.text));
  assert.ok(maxLabel && +maxLabel.text.replace(/,/g, '') >= 520, 'a max label states the scale: ' + maxLabel.text);
  assert.equal(base.y - tallest.y, Math.round((base.y - (BOX.y + roles.Label.lh + 6)) * 520 / +maxLabel.text.replace(/,/g, '')), 'the tallest bar is drawn against that explicit max');
  const values = rows.filter(r => r.role === 'Label' && r.color === 'var(--fg)');
  assert.deepEqual(values.map(r => r.text), ['380', '410', '450', '520'], 'direct value labels, no legend');
  for (const [k, v] of values.entries()) assert.ok(v.y + roles.Label.lh <= barRows[k].y, 'the value sits above its bar');
  assert.deepEqual(rows.filter(r => r.role === 'Label' && r.text && /^[A-Z]/.test(r.text) && r.nowrap).map(r => r.text), ['Jun', 'Jul', 'Aug', 'Sep'], 'axis labels');
  const src = rows.at(-1); assert.deepEqual([src.role, src.text, src.y + roles.Caption.lh], ['Caption', bars.source, BOX.y + BOX.h], 'source in Caption at the bottom');
  for (const r of rows) assert.ok(r.x >= BOX.x && (r.x + (r.line ? 0 : r.w)) <= BOX.x + BOX.w + 0.5, 'inside the box: ' + JSON.stringify(r));
  assert.ok(!rows.some(r => r.chart), 'nothing left for the runtime to draw');
});

test('chart: a rising line is one stroke with dots, the annotation a green dot + words + hairline leader, and no value label touches the stroke', () => {
  const rows = chartRows({...BOX, chart: rising}, roles);
  const segs = rows.filter(r => r.line && !r.dash && r.h === 2.5), dots = rows.filter(r => r.radius && r.w <= 10);
  assert.equal(segs.length, 8); assert.equal(dots.length, 9);
  assert.ok(segs.every(s => s.bg === 'var(--accent)'), 'one series, one colour');
  assert.ok(dots[4].bg === 'var(--ok,var(--accent))' && dots.filter(d => d.bg === 'var(--ok,var(--accent))').length === 1, 'the annotated point is the one green dot');
  const words = rows.find(r => r.text === 'Radar switched on'); assert.equal(words.role, 'Caption');
  const leader = rows.find(r => r.line && r.h === 1 && !r.dash && r.line[0] === r.x); assert.ok(leader, 'a hairline leader');
  assert.equal(leader.x, leader.line[0], 'the leader is vertical, from the words to the dot');
  assert.ok(leader.line[1] < dots[4].y, 'and stops clear of the dot');
  const labels = rows.filter(r => r.role === 'Label' && r.color === 'var(--fg)');
  assert.deepEqual(labels.map(l => l.text), rising.data.map(d => String(d.value)));
  const L = roles.Label.lh, rect = l => ({x: l.x, y: l.y, w: l.w, h: L});
  for (const l of labels) {
    for (const s of segs) assert.ok(!hits([s.x, s.y, ...s.line], rect(l), 3), `label ${l.text} collides with the segment from ${s.x},${s.y}`);
    assert.ok(!hits([leader.x, leader.y, ...leader.line], rect(l), 2), `label ${l.text} sits on the leader`);
    for (const o of labels) if (o !== l) assert.ok(!(Math.min(l.x + l.w, o.x + o.w) - Math.max(l.x, o.x) > 0 && Math.min(l.y + L, o.y + L) - Math.max(l.y, o.y) > 0), `labels ${l.text} and ${o.text} overlap`);
    assert.ok(!l.over, 'placed clear, not declared as an overlay');
  }
  assert.equal(rows.length, 4 + 8 + 9 + 9 + 9 + 2 + 1, 'scale(3)+baseline, segments, dots, values, axis, annotation words+leader, source');
});

// the landscape deck's AI-CAD funding slide, hand-built there: ranked horizontal bars with a label column, one hot bar
const funding = {mark: 'hbar', sort: 'desc', data: [{label: 'Zoo', value: 10.1, text: '$10.1M'}, {label: 'Vizcom', value: 52, text: '$52M'}, {label: 'Adam', value: 4.1, text: '$4.1M'}, {label: 'Backflip', value: 30, text: '$30M', highlight: true}, {label: 'Leo AI', value: 9.7, text: '$9.7M'}], source: 'Crunchbase, 2026'};

test('chart: an hbar expands to ranked horizontal bars on one scale, a label column, value labels at the bar ends and a zero baseline', () => {
  const rows = chartRows({...BOX, chart: {...funding, sort: undefined}}, roles), n = funding.data.length, L = roles.Label.lh;
  const bs = rows.filter(r => r.bar), base = rows.find(r => r.line && r.dash);
  assert.equal(bs.length, n);
  assert.ok(base && base.bg === 'var(--muted)' && base.x === base.line[0], 'a grey dashed vertical zero baseline');
  for (const b of bs) assert.equal(b.x, base.x, 'every bar starts at zero, on the baseline');
  assert.equal(new Set(bs.map(b => b.h)).size, 1, 'one bar thickness');
  for (let k = 1; k < n; k++) assert.ok(bs[k].y >= bs[k - 1].y + bs[k - 1].h + 4, 'bars stack top to bottom with air');
  const maxLabel = rows.find(r => r.role === 'Label' && /^\d/.test(r.text) && r.y > bs.at(-1).y + bs.at(-1).h && r.text !== '0');
  const max = +maxLabel.text.replace(/,/g, ''); assert.equal(max, 60, 'the one explicit scale is the nice max above 52, stated in a label');
  const pw = maxLabel.x + maxLabel.w / 2 - base.x;
  for (const [k, b] of bs.entries()) assert.ok(Math.abs(b.w - pw * funding.data[k].value / max) <= 1, `bar ${k} is drawn against that one scale`);
  const vals = rows.filter(r => r.role === 'Label' && r.color === 'var(--fg)');
  assert.deepEqual(vals.map(v => v.text), funding.data.map(d => d.text), 'direct value labels, text overrides');
  for (const [k, v] of vals.entries()) { const b = bs[k]; assert.ok(v.x >= b.x + b.w + 4 && v.x <= b.x + b.w + 8, 'the value sits at the bar end'); assert.ok(Math.abs(v.y + L / 2 - (b.y + b.h / 2)) <= 1, 'centred on the bar'); }
  const names = rows.filter(r => r.role === 'Label' && r.align === 'left' && r.color !== 'var(--fg)');
  assert.deepEqual(names.map(r => r.text), funding.data.map(d => d.label), 'a label column, one name per bar');
  for (const [k, t] of names.entries()) { assert.ok(t.x === BOX.x && t.x + t.w <= base.x - 4, 'names sit in the column left of the baseline'); assert.ok(Math.abs(t.y + L / 2 - (bs[k].y + bs[k].h / 2)) <= 1); }
  const src = rows.at(-1); assert.deepEqual([src.role, src.text, src.y + roles.Caption.lh], ['Caption', funding.source, BOX.y + BOX.h]);
  for (const r of rows) assert.ok(r.x >= BOX.x && r.x + (r.line ? 0 : r.w) <= BOX.x + BOX.w + 0.5 && r.y >= BOX.y && r.y + (r.line ? 0 : r.h || L) <= BOX.y + BOX.h + 0.5, 'inside the box: ' + JSON.stringify(r));
  assert.equal(rows.length, 1 + 2 + 3 * n + 1, 'baseline + two scale labels, three rows per datum, source');
});

test('chart: hbar sort ranks the data, and one highlighted bar carries the accent while the rest go grey', () => {
  const rank = s => chartRows({...BOX, chart: {...funding, sort: s}}, roles).filter(r => r.role === 'Label' && r.align === 'left' && r.color !== 'var(--fg)').map(r => r.text);
  assert.deepEqual(rank('desc'), ['Vizcom', 'Backflip', 'Zoo', 'Leo AI', 'Adam']);
  assert.deepEqual(rank('asc'), ['Adam', 'Leo AI', 'Zoo', 'Backflip', 'Vizcom']);
  assert.deepEqual(rank(undefined), funding.data.map(d => d.label), 'no sort keeps the model order');
  const bs = chartRows({...BOX, chart: funding}, roles).filter(r => r.bar);
  assert.deepEqual(bs.map(b => b.bg), ['var(--muted)', 'var(--accent)', 'var(--muted)', 'var(--muted)', 'var(--muted)'], 'Backflip, ranked second, is the one accent bar');
  assert.ok(bs.every(b => b.bg === 'var(--accent)' ? b.op == null : b.op === 0.6));
  const plain = chartRows({...BOX, chart: {...funding, data: funding.data.map(({highlight, ...d}) => d)}}, roles).filter(r => r.bar);
  assert.ok(plain.every(b => b.bg === 'var(--accent)'), 'no highlight: every bar is the accent');
  assert.equal(funding.data[0].label, 'Zoo', 'sorting never reorders the model');
});

test('chart: hbarGeometry reserves a lead box per datum (the logo hook) and the label column moves over for it', () => {
  const g = hbarGeometry({...BOX, chart: {...funding, lead: 60}}, roles);
  assert.deepEqual(g.map(d => d.datum.label), ['Vizcom', 'Backflip', 'Zoo', 'Leo AI', 'Adam']);
  for (const d of g) {
    assert.equal(d.lead.x, BOX.x); assert.equal(d.lead.w, 60);
    assert.ok(d.label.x >= d.lead.x + d.lead.w + 4 && d.label.x + d.label.w <= d.bar.x - 4, 'label after the lead, before the bar');
    assert.ok(Math.abs(d.lead.y + d.lead.h / 2 - (d.bar.y + d.bar.h / 2)) <= 1 && d.lead.h >= d.bar.h, 'the lead box is centred on its bar row');
  }
  for (let k = 1; k < g.length; k++) assert.ok(g[k].lead.y >= g[k - 1].lead.y + g[k - 1].lead.h, 'lead boxes do not overlap');
  const rows = chartRows({...BOX, chart: {...funding, lead: 60}}, roles);
  assert.equal(rows.length, 1 + 2 + 3 * 5 + 1, 'the lead is reserved space: no row is drawn in it yet');
  assert.deepEqual(hbarGeometry({...BOX, chart: funding}, roles)[0].lead.w, 0, 'no lead by default');
});

const XOM = 'data:image/svg+xml;base64,PHN2Zy8+', VIZ = 'data:image/png;base64,iVBORw0KGgo=';

test('chart: an hbar datum with a logo draws it in the lead box, sized and plated by the logo row — the value/label rows are untouched', () => {
  const c = {...funding, sort: undefined, lead: 60, data: funding.data.map((d, k) => k === 1 ? {...d, logo: VIZ} : d)};
  const rows = chartRows({...BOX, chart: c}, roles), g = hbarGeometry({...BOX, chart: c}, roles);
  const ld = g.find(d => d.datum.label === 'Vizcom').lead;
  const want = logoGeom({logo: VIZ, h: ld.h, col: ld.w, gap: 0}, 0);
  const plate = rows.find(r => r.bg === '#FFFFFF' && r.radius);
  assert.ok(plate, 'a plate row for the logo, same paint as a logo row');
  assert.deepEqual([plate.x, plate.y, plate.w, plate.h], [ld.x + want.plate.x, ld.y + want.plate.y, want.plate.w, want.plate.h]);
  const img = rows.find(r => r.img === VIZ);
  assert.ok(img && img.fit === 'contain', 'contain-fit image, value passed through untouched');
  assert.deepEqual([img.x, img.y, img.w, img.h], [ld.x + want.img.x, ld.y + want.img.y, want.img.w, want.img.h]);
  assert.equal(rows.filter(r => r.img).length, 1, 'only the one datum with a logo draws one');
  const vals = rows.filter(r => r.role === 'Label' && r.color === 'var(--fg)');
  assert.deepEqual(vals.map(v => v.text), funding.data.map(d => d.text), 'value labels unaffected by the logo');
});

test('chart: an hbar logo can be an asset "#id" reference — chart.mjs passes it through untouched, no data: URI check', () => {
  const c = {...funding, lead: 60, data: funding.data.map((d, k) => k === 0 ? {...d, logo: '#xometry'} : d)};
  assert.deepEqual(checkChart(c), []);
  const rows = chartRows({...BOX, chart: c}, roles);
  assert.ok(rows.find(r => r.img === '#xometry'), 'the asset ref lands verbatim on the img row');
});

test('chart: an hbar datum logo as deck.assets "#id" validates clean end to end, expands, and resolves against the asset table', () => {
  const m = {w: 960, h: 540, assets: {xometry: XOM}, slides: [{els: [{...BOX, chart: {...funding, lead: 60, sort: undefined, data: funding.data.map((d, k) => k === 0 ? {...d, logo: '#xometry'} : d)}}]}]};
  const {deck} = create(m);
  assert.deepEqual(validate(deck).errors, []);
  assert.ok(deck.slides[0].els.some(e => e.img === '#xometry'), 'the datum logo survives expansion as an ordinary #id img row');
});

test('chart: a bar datum with a logo draws it under the bar, in the band reserved by lead, sized like a logo row', () => {
  const data = [{label: 'Zoo', value: 10}, {label: 'Vizcom', value: 52, logo: VIZ}, {label: 'Adam', value: 4}, {label: 'Backflip', value: 30}];
  const c = {mark: 'bar', data, lead: 40};
  const rows = chartRows({...BOX, chart: c}, roles);
  const cat = rows.find(r => r.role === 'Label' && r.text === 'Vizcom');
  const plate = rows.find(r => r.bg === '#FFFFFF' && r.radius);
  const img = rows.find(r => r.img === VIZ);
  assert.ok(plate && img, 'plate + contain-fit image drawn for the one datum with a logo');
  assert.equal(img.fit, 'contain');
  assert.ok(img.y > cat.y + roles.Label.lh, 'the logo sits below the category label');
  assert.ok(img.y + img.h <= BOX.y + BOX.h + 0.5, 'the logo stays inside the chart box');
  assert.equal(rows.filter(r => r.img).length, 1, 'only the datum with a logo draws one');
  assert.ok(!rows.some(r => r.chart), 'nothing left for the runtime to draw');
});

test('chart: validate refuses a datum logo with no lead reserved, a non-string logo, a bad aspect/plate, or a logo on a line', () => {
  const one = c => checkChart(c);
  assert.deepEqual(one({...funding, lead: 60, data: funding.data.map((d, k) => k ? d : {...d, logo: XOM})}), []);
  for (const [c, re] of [
    [{...funding, data: funding.data.map((d, k) => k ? d : {...d, logo: XOM})}, /lead/],
    [{...funding, lead: 60, data: funding.data.map((d, k) => k ? d : {...d, logo: 5})}, /logo.*string/],
    [{...funding, lead: 60, data: funding.data.map((d, k) => k ? d : {...d, logo: XOM, aspect: 0})}, /aspect/],
    [{...funding, lead: 60, data: funding.data.map((d, k) => k ? d : {...d, logo: XOM, plate: 'neon'})}, /plate/],
    [{mark: 'line', lead: 40, data: rising.data.map((d, k) => k ? d : {...d, logo: XOM})}, /line.*logo|logo.*line/],
  ]) { const e = one(c); assert.ok(e.some(m => re.test(m)), String(re) + ' — ' + JSON.stringify(e)); }
});

test('chart: hbar validates clean in a deck, and validate refuses a bad sort, two highlights or a compare series', () => {
  const one = c => validate(create({w: 960, h: 540, slides: [{els: [{...BOX, chart: c}]}]}).deck);
  const ok = one(funding); assert.deepEqual(ok.errors, []); assert.deepEqual(ok.warnings, []);
  assert.deepEqual(one({...funding, lead: 60}).errors, []);
  for (const [c, re] of [
    [{...funding, sort: 'up'}, /sort/],
    [{...funding, data: funding.data.map(d => ({...d, highlight: true}))}, /highlight/],
    [{...funding, data: funding.data.map(d => ({...d, compare: 1}))}, /compare/],
    [{...funding, lead: -5}, /lead/],
  ]) { const e = one(c).errors; assert.ok(e.some(m => re.test(m)), String(re) + ' — ' + JSON.stringify(e)); }
});

test('chart: adjacent axis and value label boxes never overlap — a label box is the column pitch, not the slot rounded up', () => {
  // the library sheet's own chart geometry. chart-column is 770 wide over four quarters: a 718px plot at a 179.5px slot,
  // whose boxes used to be rounded UP to 180 and so overran the next column by a pixel on every style kit in library.html.
  const geos = [[{x: 150, y: 176, w: 770, h: 244}, 4], [{x: 230, y: 176, w: 690, h: 244}, 4], [{x: 230, y: 176, w: 690, h: 250}, 6], [{x: 60, y: 136, w: 840, h: 276}, 7]];
  const flat = n => Array.from({length: n}, (_, k) => ({label: 'Q' + (k + 1), value: 60}));   // equal values put every value label in one band
  for (const [box, n] of geos) for (const mark of ['bar', 'line']) {
    const where = `${mark} ${box.w}x${n}`, rows = chartRows({...box, chart: {mark, data: flat(n)}}, roles);
    const bands = new Map();
    for (const r of rows.filter(r => r.role === 'Label' && r.align === 'center')) { const b = bands.get(r.y) || []; b.push(r); bands.set(r.y, b); }
    assert.ok(bands.size, where + ': no centred label rows to judge');
    for (const band of bands.values()) {
      band.sort((a, b) => a.x - b.x);
      for (let k = 1; k < band.length; k++) assert.ok(band[k].x >= band[k - 1].x + band[k - 1].w, `${where}: "${band[k - 1].text}" (${band[k - 1].x}+${band[k - 1].w}) runs into "${band[k].text}" at ${band[k].x}`);
      assert.ok(band.at(-1).x + band.at(-1).w <= box.x + box.w + 0.5, where + ': the last label box leaves the chart');
    }
  }
});

test('chart: the library sheet geometry validates clean — the sheet wears the rows UNGROUPED, so the gate judges every pair', () => {
  // templates/build-sheet.mjs expands a chart row itself (`chartRows(r, NEUTRAL)`) before the kit is worn, and that row carries
  // the gap gate compares label to label: no row is ever waved through on the strength of a link to another one.
  const q = [{label: 'Q1', value: 62, text: '$62K'}, {label: 'Q2', value: 71, text: '$71K'}, {label: 'Q3', value: 78, text: '$78K'}, {label: 'Q4', value: 92, text: '$92K'}];
  const els = chartRows({x: 150, y: 176, w: 770, h: 244, chart: {mark: 'bar', data: q}}, roles);
  assert.ok(!els.some(e => e.group), 'ungrouped, as the sheet writes them');
  assert.deepEqual(validate(create({w: 960, h: 540, slides: [{els}]}).deck).errors, []);
});

test('chart: validate refuses a chart with no numbers, fewer than two points, non-numeric values, a bad mark or an annotation off the data', () => {
  const one = c => validate(create({w: 960, h: 540, slides: [{els: [{...BOX, chart: c}]}]}).deck).errors;
  assert.deepEqual(one(bars), []); assert.deepEqual(one(rising), []);
  for (const [c, re] of [
    [{mark: 'bar', data: [{label: 'a'}, {label: 'b'}]}, /no numbers/],
    [{mark: 'bar', data: [{label: 'a', value: 1}]}, /at least two/],
    [{mark: 'bar'}, /at least two/],
    [{mark: 'line', data: [{label: 'a', value: 1}, {label: 'b', value: 'two'}]}, /value must be a number/],
    [{mark: 'pie', data: [{label: 'a', value: 1}, {label: 'b', value: 2}]}, /mark "pie"/],
    [{mark: 'line', data: [{label: 'a', value: 1}, {label: 'b', value: 2}], annotations: [{at: 5, text: 'x'}]}, /annotation at 5/],
  ]) { const e = one(c); assert.ok(e.some(m => re.test(m)), String(re) + ' — ' + JSON.stringify(e)); }
  assert.deepEqual(checkChart(bars), []);
  const cli = spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), (() => { const f = path.join(tmp, 'nonum.json'); fs.writeFileSync(f, JSON.stringify({w: 960, h: 540, slides: [{els: [{...BOX, chart: {mark: 'bar', data: [{label: 'a'}, {label: 'b'}]}}]}]})); return f; })()], {encoding: 'utf8'});
  assert.equal(cli.status, 1); assert.match(cli.stderr, /no numbers/);
});

test('chart: the `chart` library layout accepts a chart row in its chart slot, and create leaves ordinary rows behind', () => {
  const m = {w: 960, h: 540, slides: [{layout: 'chart', els: [{slot: 'title', text: 'Renewals'}, {slot: 'chart', chart: bars}, {slot: 'takeaway', text: 'Up every month.'}, {slot: 'source', text: 'Renewal Radar'}]}]};
  const {deck, html} = create(m);
  assert.ok(!deck.slides[0].els.some(e => e.chart), 'expanded');
  assert.ok(deck.slides[0].els.filter(e => e.bar).length === 4, 'four bars, sized from the slot geometry');
  const base = deck.slides[0].els.find(e => e.dash); assert.ok(base.x >= 60 && base.line[0] <= 900 && base.y < 412, 'inside the chart slot');
  assert.deepEqual(validate(deck).errors, []); assert.deepEqual(validate(deck).warnings, []);
  assert.ok(!/"chart":\{"mark"/.test(html), 'the runtime sees no chart spec');
  // the pure expander mutates a deck the same way (the validate CLI runs it too)
  const raw = structuredClone(m); raw.layouts = {}; raw.styles = {roles};
  expandCharts({...raw, layouts: create(raw).deck.layouts}); // resolves the slot through the merged layouts
});

live('live: chart rows render with parity and zero page errors, and the expanded rows drag like any other row', async () => {
  const m = {w: 960, h: 540, slides: [
    {name: 'bars', layout: 'chart', els: [{slot: 'title', text: 'Renewals by month'}, {slot: 'chart', chart: bars}, {slot: 'takeaway', text: 'Up every month.'}]},
    {name: 'line', layout: 'chart', els: [{slot: 'title', text: 'Renewal rate'}, {slot: 'chart', chart: rising}, {slot: 'takeaway', text: 'The radar bent the curve.'}]},
    {name: 'hbar', layout: 'chart', els: [{slot: 'title', text: 'AI-CAD funding'}, {slot: 'chart', chart: {...funding, lead: 60}}, {slot: 'takeaway', text: 'Backflip is second.'}]},
  ]};
  const f = path.join(tmp, 'charts.html'); fs.writeFileSync(f, create(m).html);
  const r = await verify(f, {out: path.join(tmp, 'v-charts'), strict: true, log: () => {}});
  assert.deepEqual(r.errors, [], JSON.stringify(r.parity.filter(p => !p.pass)));
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  await p.evaluate(() => { localStorage.clear(); canvas.style.transform = 'none'; });
  const k = modelOf(fs.readFileSync(f, 'utf8')).slides[0].els.findIndex(e => e.bar);
  const bb = await p.locator(`#canvas .el[data-n="${k}"]`).boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + 40, bb.y + 10); await p.mouse.move(bb.x + 80, bb.y + 20); await p.mouse.up();
  const moved = await p.evaluate(k => slide().els[k], k);
  await b.close();
  assert.deepEqual(errs, []);
  assert.ok(moved.bar && moved.x > 60, 'a bar is a plain draggable row after expansion: ' + JSON.stringify(moved));
});

test('chart: docs/charts.md carries the drawing rules, and SKILL.md links it', () => {
  assert.match(fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8'), /\[docs\/charts\.md\]\(docs\/charts\.md\)/, 'GRAPHICS sends the reader to the chart reference');
  const sec = fs.readFileSync(path.join(root, 'docs/charts.md'), 'utf8');
  assert.ok(sec.length > 500);
  for (const re of [/start at zero/, /max label/, /[Dd]irect value labels/, /dashed/, /60%/, /muted:true/, /annotations/, /source/, /rising/, /hbar/, /sort/, /highlight/, /lead/, /hbarGeometry/]) assert.match(sec, re);
});
