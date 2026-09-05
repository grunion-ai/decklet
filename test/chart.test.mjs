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
import {chartRows, expandCharts, checkChart} from '../lib/chart.mjs';

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

test('chart: SKILL.md carries the drawing rules', () => {
  const doc = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  const sec = doc.slice(doc.indexOf('## CHART ROW'));
  assert.ok(sec.length > 500);
  for (const re of [/start at zero/, /max label/, /[Dd]irect value labels/, /dashed/, /60%/, /muted:true/, /annotations/, /source/, /rising/]) assert.match(sec, re);
});
