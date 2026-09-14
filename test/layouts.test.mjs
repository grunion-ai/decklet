// decklet layout library gate — the catalogue is an accelerant, never a fence: a slide may use a library layout, a deck
// layout or free rows, and may mix library slots with extra free rows. Nothing that worked before the library may stop.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validate, ROLES} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {verify} from '../bin/verify.mjs';
import {LIBRARY, GROUPS, DENSE, COUNTER, NEUTRAL_LH, libraryFor, catalogue, densityReport, freeArea} from '../lib/layouts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-lib-'));

export const NAMES = ['cover', 'agenda', 'section', 'content', 'title', 'statement', 'fact', 'quote', 'two-cols', 'two-cols-header', 'bullets', 'image-left', 'image-right',
  'bento-grid', 'image-hero-overlay', 'image-split', 'annotated-shot', 'three-up-cards', 'dashboard-composite', 'table-insight', 'proof-strip', 'team-grid',
  'kpi-grid', 'kpi-grid-4', 'stat', 'chart', 'comparison', 'process-steps', 'diagram', 'timeline', 'cta', 'end'];
const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#5B9CF6"/></svg>');
// one slide per library layout, every slot bound with plausible content
export const fill = (name, k = 0) => {
  const lay = LIBRARY[name];
  // `body` and b1…bn are alternatives — a column carries the paragraph or the points, and validate errors on the pair, so the
  // image layouts fill as their paragraph here; the bullets-beside-an-image slide is its own test below.
  const els = Object.entries(lay.slots).filter(([slot]) => !(/^b\d$/.test(slot) && lay.slots.body)).map(([slot, sl]) => {
    if (slot === 'image') return {slot, img: IMG, fit: 'cover'};
    if (slot === 'chart') return {slot, bg: 'var(--box)'};   // a painted stand-in until the chart row lands
    if (!sl.role) return {slot};                              // paint slots (rule, dots, button): the slot carries the paint
    const text = {Title: 'Two lines of display headline', Supertitle: 'Kicker', H1: 'A content-slide title', H2: 'A second-level heading',
      Body: 'Body copy, two short sentences at most. Enough to wrap once.', Caption: 'Source · caption text', Label: 'Label', Stat: '63%', Stat2: '$1.2M'}[sl.role];
    return {slot, text: /^(n\d|t\d)$/.test(slot) ? '0' + (slot.slice(1)) : /delta/.test(slot) ? '↑ 8 pts' : /label/.test(slot) ? 'Renewals' : /value/.test(slot) ? '$86K' : text};
  });
  return {name: `${name}-${k}`, layout: name, els, ...(name === 'image-hero-overlay' ? {hide: ['foot']} : {})};   // a full-bleed hero hides the footer
};
export const everyLayout = (w = 960, h = 540) => ({w, h, title: 'library', styles: {margin: 60}, master: [{id: 'foot', footer: 1, x: 60, y: 500, w: 300, role: 'Label', text: 'library'}],
  slides: NAMES.map((n, k) => fill(n, k))});

test('library: diagram — title chrome, one 840×320 figure frame, a caption that states the claim', () => {
  const d = LIBRARY.diagram;
  assert.equal(d.group, 'diagrams');
  assert.deepEqual(d.slots.figure, {x: 60, y: 130, w: 840, h: 320}, 'the figure frame is media: geometry, no role, no paint — rows are placed inside it');
  assert.deepEqual(d.slots.caption, {x: 60, y: 470, w: 840, role: 'Caption'});
  assert.equal(d.slots.title.role, 'H1'); assert.equal(d.slots.supertitle.role, 'Supertitle');
});

test('library: every layout is complete, its slots wear a role from the scale (or carry paint), the names are the catalogue', () => {
  assert.deepEqual(Object.keys(LIBRARY), NAMES, 'the catalogue, in group order');
  for (const [name, lay] of Object.entries(LIBRARY)) {
    assert.ok(GROUPS.includes(lay.group), `${name}: group ${lay.group}`);
    assert.match(lay.use, /^[A-Z].{20,}\.$/, `${name}: one sentence of use`);
    assert.ok(['speaker', 'reading'].includes(lay.density), `${name}: density`);
    assert.ok(Object.keys(lay.slots).length >= 2, `${name}: slots`);
    for (const [slot, sl] of Object.entries(lay.slots)) {
      if (sl.role) assert.ok([...ROLES, 'Stat2'].includes(sl.role), `${name}.${slot}: role ${sl.role}`);
      else assert.ok(sl.h != null || sl.line, `${name}.${slot}: a roleless slot is paint or media and carries h (or a line)`);
      assert.equal(typeof sl.y, 'number', `${name}.${slot}.y`);
      assert.ok(typeof sl.x === 'number' || typeof sl.right === 'number', `${name}.${slot}: x or right`);
      assert.ok(typeof sl.w === 'number' || sl.w === 'auto', `${name}.${slot}.w`);
      if (typeof sl.w === 'number' && sl.role) assert.ok(sl.x + sl.w <= 900 && sl.x >= 60, `${name}.${slot} inside the 60px margins`);
      else if (typeof sl.w === 'number') assert.ok(sl.x + sl.w <= 960 && sl.x >= 0, `${name}.${slot}: paint or media may bleed to the canvas edge, never past it`);
    }
  }
  assert.ok(Object.keys(LIBRARY['kpi-grid'].slots).filter(s => /^kpi\d$/.test(s)).length === 3 && Object.keys(LIBRARY['kpi-grid-4'].slots).filter(s => /^kpi\d$/.test(s)).length === 4, 'three or four tiles');
  for (const n of ['kpi-grid', 'kpi-grid-4']) for (const k of [1, 2, 3]) for (const s of [`kpi${k}`, `kpi${k}-label`, `kpi${k}-delta`]) assert.ok(LIBRARY[n].slots[s], `${n}.${s}: value + label + delta`);
  for (const s of ['supertitle', 'title', 'chart', 'takeaway', 'source']) assert.ok(LIBRARY.chart.slots[s], 'chart: ' + s);
  assert.equal(LIBRARY.stat.slots.stat.role, 'Stat', 'stat is the hero number');
});

// ── U5.1 / U5.2: the missing starting rungs — a plain bullet page, and points beside an image
const LH = NEUTRAL_LH;   // the neutral scale, one line of each role

test('library: bullets — six Body slots down the left, one line apart, each carrying the engine\'s dot', () => {
  const b = LIBRARY.bullets;
  assert.equal(b.group, 'text'); assert.equal(b.density, 'reading');
  assert.equal(b.slots.title.role, 'H1'); assert.equal(b.slots.supertitle.role, 'Supertitle');
  const keys = Object.keys(b.slots).filter(k => /^b\d$/.test(k));
  assert.deepEqual(keys, ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'], 'four to six points, six slots');
  for (const k of keys) {
    const sl = b.slots[k];
    assert.equal(sl.role, 'Body', k); assert.equal(sl.bullet, 1, k + ': the engine draws its dot');
    assert.equal(sl.x, 96, k + ': indented 36px so the dot (1.25em) clears the margin');
    assert.equal(sl.w, 780, k);
  }
  const ys = keys.map(k => b.slots[k].y);
  assert.deepEqual(ys, [160, 204, 248, 292, 336, 380], 'a 44px pitch: one line of Body and 20px of air');
  assert.ok(ys.at(-1) + LH.Body + 4 <= b.slots.note.y, 'the last point clears the note');
  for (const n of ['image-left', 'image-right']) {
    const lay = LIBRARY[n];
    assert.deepEqual(Object.keys(lay.slots).filter(k => /^b\d$/.test(k)), ['b1', 'b2', 'b3', 'b4'], n + ': four points beside the image');
    assert.ok(lay.slots.body, n + ': the paragraph slot stays');
    for (const k of ['b1', 'b2', 'b3', 'b4']) assert.equal(lay.slots[k].bullet, 1, `${n}.${k}`);
    assert.equal(lay.slots.b1.x, lay.slots.body.x + 36, n + ': the points are indented from the paragraph column');
    assert.ok(lay.slots.b4.y + LH.Body + 4 <= lay.slots.note.y, n + ': four points and a note both fit the panel');
  }
});

test('library: no dense slot collides — subtitle · note · source · legend clear every other slot of their layout', () => {
  const box = sl => {
    if (sl.w === 'auto' || (sl.x == null && sl.right == null)) return null;   // a w:auto slot has no declared width to compare
    const w = sl.w, x = sl.right != null ? 960 - sl.right - w : sl.x;
    return {x, y: sl.y, w, h: sl.h ?? LH[sl.role] ?? 0};
  };
  const hits = (A, B) => Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) > 0.5 && Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) > 0.5;
  for (const [name, lay] of Object.entries(LIBRARY)) for (const k of Object.keys(DENSE)) {
    const A = lay.slots[k] && box(lay.slots[k]); if (!A) continue;
    for (const [n2, sl2] of Object.entries(lay.slots)) {
      if (n2 === k || (lay.slots[k].group != null && lay.slots[k].group === sl2.group)) continue;
      const B = box(sl2); if (!B) continue;
      assert.ok(!hits(A, B), `${name}: dense slot ${k} (${A.x},${A.y} ${A.w}×${A.h}) collides with ${n2} (${B.x},${B.y} ${B.w}×${B.h})`);
    }
  }
});

test('library: a bullet page binds only the points it has — four bullets, four dot-bearing rows, no fifth', () => {
  const m = {w: 960, h: 540, slides: [{layout: 'bullets', els: [{slot: 'supertitle', text: 'The close'}, {slot: 'title', text: 'Four things the close waits on'},
    {slot: 'subtitle', text: 'Each one is a person waiting for a file.'},
    {slot: 'b1', text: 'The bank feed posts overnight.'}, {slot: 'b2', text: 'Card statements land on the third day.'},
    {slot: 'b3', text: 'Two subsidiaries send spreadsheets.'}, {slot: 'b4', text: 'Sign-off needs two directors.'},
    {slot: 'source', text: 'Source · close log, six months'}]}]};
  const {deck: d} = create(m);
  const v = validate(d);
  assert.deepEqual(v.errors, []); assert.deepEqual(v.warnings, []);
  const rows = d.slides[0].els.filter(r => /^b\d$/.test(r.slot || ''));
  assert.equal(rows.length, 4, 'four bound bullets');
  assert.ok(!d.slides[0].els.some(r => r.slot === 'b5' || r.slot === 'b6'), 'no fifth or sixth row exists to carry a fifth dot');
  for (const r of rows) assert.equal(d.layouts.bullets[r.slot].bullet, 1, r.slot + ': the slot carries the marker');
  assert.equal(d.layouts.bullets.b5.bullet, 1, 'b5 still declares its marker — unbound, it draws nothing at all');
});

test('library: a column carries the paragraph or the points — binding both is an error', () => {
  const both = {w: 960, h: 540, slides: [{layout: 'image-left', els: [{slot: 'title', text: 'Built for the hour before work.'},
    {slot: 'body', text: 'A paragraph beside the photo.'}, {slot: 'b1', text: 'And a point beside it too.'}]}]};
  const v = validate(create(both).deck);
  assert.ok(v.errors.some(m => /binds "body" and b1/.test(m)), v.errors.join(' | '));
  const points = {w: 960, h: 540, slides: [{layout: 'image-left', els: [{slot: 'title', text: 'Built for the hour before work.'},
    {slot: 'b1', text: 'Most runs start before half past six.'}, {slot: 'b2', text: 'A median run is thirty-four minutes.'},
    {slot: 'b3', text: 'One buzz a kilometre, no screen.'}, {slot: 'source', text: 'Source · activity log'}]}]};
  assert.deepEqual(validate(create(points).deck).errors, []);
});

test('library: the bullets layout answers to both densities — three points at speaker, six at reading', () => {
  const slide = n => ({layout: 'bullets', els: [{slot: 'supertitle', text: 'The close'}, {slot: 'title', text: 'What the close waits on'},
    ...Array.from({length: n}, (_, i) => ({slot: `b${i + 1}`, text: `A wait on somebody else, number ${i + 1}.`}))]});
  assert.equal(densityReport(slide(3), LIBRARY, 'speaker'), null, 'three points is a speaker slide');
  assert.ok(densityReport(slide(4), LIBRARY, 'speaker'), 'four points is not');
  const dense = slide(6); dense.els.push({slot: 'source', text: 'Source · close log'});
  assert.equal(densityReport(dense, LIBRARY, 'reading'), null, 'six points with a source is a reading slide');
});

test('library: a deck using every layout validates clean — and a deck-defined layout of the same name wins', () => {
  const v = validate(create(everyLayout()).deck);
  assert.deepEqual(v.errors, []); assert.deepEqual(v.warnings, []);
  const own = {w: 960, h: 540, layouts: {cover: {title: {x: 10, y: 10, w: 500, role: 'H1'}}}, slides: [{layout: 'cover', els: [{slot: 'title', text: 'mine'}]}]};
  const d = create(own).deck;
  assert.deepEqual(d.layouts.cover, own.layouts.cover, 'the deck keeps its own cover');
  assert.deepEqual(Object.keys(d.layouts), ['cover'], 'only referenced names are merged');
  assert.deepEqual(validate(d).errors, []);
});

test('library: create merges only the layouts a slide references, scaled to the canvas', () => {
  const d = create({w: 960, h: 540, slides: [{layout: 'two-cols', els: [{slot: 'title', text: 'x'}]}]}).deck;
  assert.deepEqual(Object.keys(d.layouts), ['two-cols']);
  assert.deepEqual(d.layouts['two-cols'].right, LIBRARY['two-cols'].slots.right);
  const big = create({slides: [{layout: 'two-cols', els: [{slot: 'title', text: 'x'}]}]}, {space: '1600x900'}).deck;
  const s = LIBRARY['two-cols'].slots.right, b = big.layouts['two-cols'].right;
  assert.deepEqual([b.x, b.y, b.w], [s.x, s.y, s.w].map(v => Math.round(v * 1600 / 960)), '1600×900 scales the geometry 1.67×');
  assert.equal(b.role, s.role);
  assert.deepEqual(libraryFor({w: 960, h: 540, slides: [{els: []}]}), {}, 'nothing referenced → nothing merged');
});

test('library: an unknown layout still errors, and the error lists the library names', () => {
  const v = validate(create({w: 960, h: 540, slides: [{layout: 'hero-bento', els: []}]}).deck);
  assert.equal(v.errors.length, 1);
  assert.match(v.errors[0], /layout "hero-bento" not in deck\.layouts or the library \(cover, agenda, .*, end\)/);
});

test('library: a slide mixes a library layout with free rows (and nudges a slot with its own x/y)', () => {
  const m = {w: 960, h: 540, slides: [{layout: 'kpi-grid', els: [
    {slot: 'title', text: 'Renewals'},
    {slot: 'kpi1', text: '63%'}, {slot: 'kpi1-label', text: 'renewed'},
    {slot: 'kpi2', text: '41'}, {slot: 'kpi2-label', text: 'days early', y: 296},
    {x: 60, y: 400, w: 400, role: 'Caption', text: 'a free caption row beside the tiles'},
    {x: 500, y: 400, line: [900, 400], h: 1, bg: 'var(--line)'},
  ]}]};
  const v = validate(create(m).deck);
  assert.deepEqual(v.errors, []); assert.deepEqual(v.warnings, []);
});

test('library: the catalogue printer lists every layout with its group, use and slots; validate --layouts prints it', () => {
  const c = catalogue();
  for (const g of GROUPS) assert.ok(c.includes(g), g);
  for (const [name, lay] of Object.entries(LIBRARY)) {
    assert.ok(c.includes(name), name); assert.ok(c.includes(lay.use), name + ' use');
    for (const s of Object.keys(lay.slots)) assert.ok(c.includes(s), `${name}.${s}`);
  }
  const r = spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), '--layouts'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, c + '\n');
});

// U2.2 — an agent placing a free row beside a bound slot reads the printed geometry, never lib/layouts.mjs
test('library: the catalogue prints every slot box and the free band under the chrome', () => {
  const c = catalogue();
  for (const [name, lay] of Object.entries(LIBRARY)) {
    const fa = freeArea(lay);
    assert.ok(c.includes(`free: x ${fa.x} y ${fa.y} w ${fa.w} h ${fa.h}`), name + ' free band');
    for (const [s, sl] of Object.entries(lay.slots)) {
      const x = sl.right != null ? 'r' + sl.right : String(sl.x ?? 0);
      assert.match(c, new RegExp('^ +' + s + ' +\\S+ +' + x + ' +' + (sl.y ?? 0) + ' +' + String(sl.w ?? '-').replace(/[-]/g, '\\-'), 'm'), `${name}.${s} box`);
    }
  }
  assert.match(c, /960×540 cut/, 'the cut the numbers are in');
});

test('library: the free band starts under the lowest chrome slot and ends at the foot', () => {
  const content = freeArea(LIBRARY.content);
  assert.deepEqual(content, {x: 60, y: DENSE.subtitle.y + NEUTRAL_LH.H2, w: 840, h: DENSE.note.y - (DENSE.subtitle.y + NEUTRAL_LH.H2)},
    'a dense layout: under the subtitle, above the note');
  for (const [name, lay] of Object.entries(LIBRARY)) {
    const fa = freeArea(lay);
    assert.ok(fa.h > 0, name + ' has a band');
    for (const n of ['supertitle', 'title', 'subtitle']) if (lay.slots[n]) assert.ok(lay.slots[n].y < fa.y, `${name}.${n} is chrome, above the band`);
    for (const n of ['note', 'source', 'legend', 'footer']) if (lay.slots[n]) assert.ok(lay.slots[n].y >= fa.y + fa.h, `${name}.${n} is foot, below the band`);
  }
});

test('library: NEUTRAL_LH is the template scale — the printed geometry cannot drift from the runtime', () => {
  const roles = JSON.parse(fs.readFileSync(path.join(root, 'template.html'), 'utf8').match(/\/\*DECK\*\/([\s\S]*?)\/\*\/DECK\*\//)[1]).styles.roles;
  for (const [r, v] of Object.entries(roles)) assert.equal(NEUTRAL_LH[r], v.lh, r + ' leading');
});

test('library: the counter owns the corner — COUNTER is the reserve, and no dense or right-anchored slot enters it on any layout', () => {
  assert.deepEqual(COUNTER, {right: 60, y: 466, w: 96, h: 74}, 'the bottom-right corner of the 960×540 cut: the right foot from y 466 down');
  assert.equal(DENSE.legend.right, COUNTER.right + COUNTER.w + 12, 'the legend keeps its right alignment, left of the reserve plus a 12px gap');
  const LH = NEUTRAL_LH;
  const cx = 960 - COUNTER.right - COUNTER.w;
  for (const [name, lay] of Object.entries(LIBRARY)) for (const [slot, sl] of Object.entries(lay.slots)) {
    if (!(slot in DENSE) && sl.right == null) continue;
    const x1 = sl.right != null ? 960 - sl.right : sl.x + sl.w, y1 = sl.y + (sl.h ?? LH[sl.role] ?? 0);
    assert.ok(x1 <= cx || y1 <= COUNTER.y || sl.y >= COUNTER.y + COUNTER.h, `${name}.${slot} enters the counter reserve (ends x ${x1}, y ${y1})`);
  }
  const doc = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  assert.match(doc.slice(doc.indexOf('## LAYOUT LIBRARY')), /`COUNTER`/, 'the layout contract names the reserve');
});

test('library: SKILL.md documents the catalogue and the mixing rule', () => {
  const doc = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  const sec = doc.slice(doc.indexOf('## LAYOUT LIBRARY'));
  assert.ok(sec.length > 500, 'a LAYOUT LIBRARY section');
  for (const n of NAMES) assert.ok(new RegExp('`' + n + '`').test(sec), n + ' in the catalogue table');
  assert.match(sec, /validate\.mjs --layouts/); assert.match(sec, /free rows/); assert.match(sec, /override/);
});

live('live: four bullets draw four dots and no fifth — in chromium and in webkit, the dot outside the row\'s own box', async () => {
  const m = {w: 960, h: 540, title: 'dots', slides: [{layout: 'bullets', els: [{slot: 'title', text: 'Four things the close waits on'},
    ...[1, 2, 3, 4].map(n => ({slot: `b${n}`, text: `A wait on somebody else, number ${n}.`}))]}]};
  const f = path.join(tmp, 'dots.html'); fs.writeFileSync(f, create(m).html);
  for (const name of ['chromium', 'webkit']) {
    const b = await pw[name].launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(pathToFileURL(f).href); await p.waitForTimeout(200);
    const seen = await p.evaluate(() => [...document.querySelectorAll('#canvas .el.bul')].map(el => {
      const m = getComputedStyle(el, '::before');
      return {w: parseFloat(m.width), h: parseFloat(m.height), left: parseFloat(m.left), paints: m.content === '""' && m.position === 'absolute'};
    }));
    assert.equal(seen.length, 4, name + ': one dot-bearing row per bound bullet');
    for (const d of seen) { assert.ok(d.paints, name + ': the marker is drawn'); assert.ok(Math.abs(d.w - 8) < 1 && Math.abs(d.h - 8) < 1, `${name}: an 8px dot at Body, got ${d.w}×${d.h}`); assert.ok(Math.abs(d.left + 20) < 1, `${name}: 20px left of the row box, got ${d.left}`); }
    assert.deepEqual(errs, [], name + ': zero page errors');
    await b.close();
  }
  const r = await verify(f, {out: path.join(tmp, 'v-dots'), strict: true, log: () => {}});
  assert.deepEqual(r.errors, [], JSON.stringify(r.parity.filter(x => !x.pass)));
});

live('live: a deck using every library layout renders — parity holds, zero page errors; so does the mixed slide', async () => {
  for (const [n, m] of [['every-layout', everyLayout()], ['mixed', {w: 960, h: 540, slides: [{layout: 'kpi-grid', els: [
    {slot: 'title', text: 'Renewals'}, {slot: 'kpi1', text: '63%'}, {slot: 'kpi1-label', text: 'renewed'}, {slot: 'kpi1-delta', text: '↑ 8 pts'},
    {x: 60, y: 400, w: 400, role: 'Caption', text: 'a free caption row beside the tiles'}, {x: 500, y: 400, line: [900, 400], h: 1, bg: 'var(--line)'}]}]}]]) {
    const f = path.join(tmp, n + '.html'); fs.writeFileSync(f, create(m).html);
    const r = await verify(f, {out: path.join(tmp, 'v-' + n), strict: true, log: () => {}});
    assert.deepEqual(r.errors, [], n + ': ' + JSON.stringify(r.parity.filter(p => !p.pass)));
    assert.equal(r.parity.length, m.slides.length);
  }
});

// ── S2. A paint slot cannot vanish. A layout's paint slot (`h`, no `role`) draws nothing unless a row binds it, and a
// card's box must be painted BEFORE its own text or it covers it. Two study builds bound a card's text and not its box;
// one shipped a decision slide whose cards were loose text on empty canvas, and both gates passed it.
const decision = (els, extra = {}) => ({w: 960, h: 540, title: 'cards', slides: [{layout: 'three-up-cards', els: [
  {slot: 'title', text: 'Three ways to close the gap'}, ...els], ...extra}]});
const cardText = n => [{slot: `card${n}-number`, text: `0${n}`}, {slot: `card${n}-head`, text: `Option ${n}`}, {slot: `card${n}-body`, text: 'What it costs and what it buys.'}];
const cardBox = n => ({slot: `card${n}`});

test('layouts: binding a card\'s text and not its box is an error that names the row to add', () => {
  const bad = validate(create(decision([...cardText(1), cardBox(2), ...cardText(2)])).deck);
  const m = bad.errors.filter(e => /card1/.test(e));
  assert.equal(m.length, 1, bad.errors.join(' | '));
  assert.match(m[0], /slides\[0\]/);
  assert.match(m[0], /card1-number|card1-head|card1-body/, 'the bound text rows are named: ' + m[0]);
  assert.match(m[0], /\{"slot":\s*"card1"\}/, 'the row to add is spelled out: ' + m[0]);
  assert.ok(!bad.errors.some(e => /card2/.test(e)), 'card2 binds its box and is clean: ' + bad.errors.join(' | '));
  // the fix passes
  const good = validate(create(decision([cardBox(1), ...cardText(1), cardBox(2), ...cardText(2)])).deck);
  assert.deepEqual(good.errors, [], good.errors.join(' | '));
});

test('layouts: a paint slot bound AFTER its own text is a warning — the box would cover the words', () => {
  const late = validate(create(decision([...cardText(1), cardBox(1)])).deck);
  assert.deepEqual(late.errors, [], late.errors.join(' | '));
  const w = late.warnings.filter(m => /card1/.test(m) && /after/.test(m));
  assert.equal(w.length, 1, late.warnings.join(' | '));
  assert.match(w[0], /els\[\d+\]/, 'the message points at the rows: ' + w[0]);
  assert.ok(!validate(create(decision([cardBox(1), ...cardText(1)])).deck).warnings.some(m => /card1/.test(m) && /after/.test(m)));
});

test('layouts: the check only fires where a paint slot provably holds its group\'s text', () => {
  // team-grid's photo sits ABOVE its name, timeline's dot above its label: a missing photo or dot is not text on empty canvas
  const team = validate(create({w: 960, h: 540, title: 't', slides: [{layout: 'team-grid', els: [
    {slot: 'title', text: 'Who is on it'}, {slot: 'name1', text: 'R. Vance'}, {slot: 'role1', text: 'Operations'}]}]}).deck);
  assert.deepEqual(team.errors, [], team.errors.join(' | '));
  const tl = validate(create({w: 960, h: 540, title: 't', slides: [{layout: 'timeline', els: [
    {slot: 'title', text: 'The year'}, {slot: 't1', text: 'March'}, {slot: 'e1', text: 'Pilot opens'}]}]}).deck);
  assert.deepEqual(tl.errors, [], tl.errors.join(' | '));
  // a free row the author paints themselves, carrying the card's group, counts as the box
  const own = validate(create(decision([{x: 60, y: 168, w: 264, h: 240, bg: 'var(--card)', radius: 10, group: 'card1'}, ...cardText(1)])).deck);
  assert.ok(!own.errors.some(e => /card1/.test(e)), own.errors.join(' | '));
});

live('live: the fixed decision slide paints its three cards; the buggy one paints none', async () => {
  const painted = create(decision([cardBox(1), ...cardText(1), cardBox(2), ...cardText(2), cardBox(3), ...cardText(3)])).html;
  const loose = create(decision([...cardText(1), ...cardText(2), ...cardText(3)])).html;
  const boxes = async html => { const f = path.join(tmp, 'cards-' + html.length + '.html'); fs.writeFileSync(f, html);
    const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
    await p.goto(pathToFileURL(f).href); await p.waitForTimeout(200);
    const n = await p.evaluate(() => [...document.querySelectorAll('#canvas .el')].filter(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return !el.textContent.trim() && r.width > 200 && r.height > 150 && s.backgroundColor !== 'rgba(0, 0, 0, 0)';
    }).length);
    await b.close(); return {n, f}; };
  assert.equal((await boxes(painted)).n, 3, 'three card boxes painted');
  assert.equal((await boxes(loose)).n, 0, 'the bug: text on empty canvas');
});
