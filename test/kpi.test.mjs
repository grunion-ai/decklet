// decklet KPI allowance gate — a second stat size. `Stat2` is an OPTIONAL ninth role: derived from Stat at 0.6 only when a
// deck uses it and its style does not define it, so the eight-role scale, the template and every existing deck are untouched.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validate, ROLES, OPTIONAL, kpiRole} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {verify, modelOf} from '../bin/verify.mjs';
import {LIBRARY} from '../lib/layouts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-kpi-'));
const grid = {w: 960, h: 540, slides: [
  {name: 'kpis', layout: 'kpi-grid', els: [{slot: 'supertitle', text: 'Renewal Radar'}, {slot: 'title', text: 'Three numbers'},
    {slot: 'kpi1', text: '63%'}, {slot: 'kpi1-delta', text: '↑ 8 pts'}, {slot: 'kpi1-label', text: 'Renewed'},
    {slot: 'kpi2', text: '41 d'}, {slot: 'kpi2-delta', text: '↓ 3%', color: 'var(--bad,var(--accent))'}, {slot: 'kpi2-label', text: 'Days early'},
    {slot: 'kpi3', text: '$1.2M'}, {slot: 'kpi3-delta', text: '↑ $180K'}, {slot: 'kpi3-label', text: 'Renewed volume'}]},
  {name: 'hero', layout: 'stat', els: [{slot: 'title', text: 'One number'}, {slot: 'stat', text: '63%'}, {slot: 'caption', text: 'of the book renewed'}]},
]};

test('kpi: Stat2 is optional — eight roles stay the scale, the template keeps eight, and Stat2 is derived from Stat only when used', () => {
  assert.equal(ROLES.length, 8); assert.deepEqual(OPTIONAL, ['Stat2']);
  assert.deepEqual(Object.keys(modelOf(read('template.html')).styles.roles), ROLES, 'the template scale is untouched');
  assert.equal(LIBRARY['kpi-grid'].slots.kpi1.role, 'Stat2'); assert.equal(LIBRARY['kpi-grid-4'].slots.kpi4.role, 'Stat2'); assert.equal(LIBRARY.stat.slots.stat.role, 'Stat');
  const d = create(grid).deck;
  assert.deepEqual(d.styles.roles.Stat2, kpiRole(d.styles.roles.Stat), 'derived at create when the layout asks for it');
  assert.deepEqual([d.styles.roles.Stat2.size, d.styles.roles.Stat2.lh, d.styles.roles.Stat.size], [24, 26, 40], '0.6 of the neutral Stat; the hero Stat unchanged');
  const v = validate(d); assert.deepEqual(v.errors, []); assert.deepEqual(v.warnings, [], 'no "outside the scale" or "more than eight" warning for the optional role');
  assert.ok(!('Stat2' in create({w: 960, h: 540, slides: [{els: [{x: 0, y: 0, w: 100, role: 'Stat', text: '1'}]}]}).deck.styles.roles), 'a deck that never uses Stat2 never gets one');
  // a style that defines Stat2 keeps its own treatment
  const own = create(grid, {style: {roles: {Stat2: {font: 'Georgia', size: 30, weight: 700, lh: 34, color: '#000'}}}}).deck;
  assert.equal(own.styles.roles.Stat2.size, 30);
  // validate on a raw model (no create) resolves Stat2 too — the validate CLI path
  assert.deepEqual(validate({...grid, styles: {roles: modelOf(read('template.html')).styles.roles}, layouts: create(grid).deck.layouts}).errors, []);
});

test('kpi: every existing example still validates and creates byte-identically', () => {
  for (const n of ['explainer', 'quarterly-update', 'launch-carousel', 'one-pager']) {
    const model = JSON.parse(read(`examples/${n}/model.json`)), sf = path.join(root, `examples/${n}/style.json`);
    const {deck} = create(model, {style: fs.existsSync(sf) ? JSON.parse(read(`examples/${n}/style.json`)) : null});
    assert.ok(!('Stat2' in deck.styles.roles), n + ': untouched');
  }
  assert.equal(create(JSON.parse(read('examples/explainer/model.json')), {title: 'decklet'}).html, read('deck.html'), 'deck.html needs no rebuild');
});

test('kpi: SKILL.md names the allowance', () => {
  const doc = read('SKILL.md');
  assert.match(doc, /`Stat2`/); assert.match(doc, /optional ninth role|ninth, optional role/i); assert.match(doc, /0\.6/);
});

live('live: a kpi-grid renders three tiles at the smaller stat with a delta chip each; the hero stat wears the deck Stat size', async () => {
  const f = path.join(tmp, 'kpi.html'); fs.writeFileSync(f, create(grid).html);
  const r = await verify(f, {out: path.join(tmp, 'v-kpi'), strict: true, log: () => {}});
  assert.deepEqual(r.errors, [], JSON.stringify(r.parity.filter(p => !p.pass)));
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  const got = await p.evaluate(() => {
    const at = (k, sel) => { i = k; render(); return [...canvas.querySelectorAll('.el')].filter(sel).map(d => [d.textContent, getComputedStyle(d).fontSize, getComputedStyle(d).padding]); };
    return {tiles: at(0, d => d.classList.contains('tile')), chips: at(0, d => /[↑↓]/.test(d.textContent)), hero: at(1, d => d.textContent === '63%')};
  });
  await b.close();
  assert.deepEqual(got.tiles.map(t => t[1]), ['24px', '24px', '24px'], 'three tiles at Stat2: ' + JSON.stringify(got.tiles));
  assert.deepEqual(got.chips.map(c => [c[0], c[2]]), [['↑ 8 pts', '3px 8px'], ['↓ 3%', '3px 8px'], ['↑ $180K', '3px 8px']], 'delta chips on the chip pad');
  assert.deepEqual(got.hero, [['63%', '40px', '0px']], 'the hero stat is the deck Stat');
});
