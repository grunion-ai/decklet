import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {TEMPLATES, TEMPLATE, SAMPLE_BOUND, templateKeys, templateVals, expandTemplates} from '../lib/templates.mjs';
import {STATUS_COLORS, STATUS_INK} from '../lib/templates/cat-status.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IDS = ['status-rail', 'status-hero', 'status-title-block', 'status-title-strip', 'status-margin-notes', 'status-columns', 'status-filled',
  'status-split', 'status-corner-lamp', 'status-stage-rail', 'status-trajectory', 'status-decision', 'status-owner-note', 'status-roster-rail'];
const deck = slides => ({w: 960, h: 540, title: 'status', slides});
const rowsOf = (id, fill) => expandTemplates(deck([{template: id, ...(fill ? {fill} : {})}])).slides[0];
const sampleFill = id => Object.fromEntries(templateVals(id).map(v => [v.key, v.sample]));
const paint = r => `${r.bg || ''} ${r.bd || ''} ${r.color || ''}`;

test('status: fourteen templates ship in one Status category', () => {
  const got = TEMPLATES.filter(t => t.cat === 'Status').map(t => t.id);
  assert.deepEqual(got, IDS);
  for (const id of IDS) assert.ok(TEMPLATE[id].note && TEMPLATE[id].tier, id);
});

test('status: every template declares a lamp state key and no template is sample-bound', () => {
  assert.deepEqual(SAMPLE_BOUND, {});
  for (const id of IDS) {
    const vals = templateVals(id);
    assert.ok(vals.some(v => v.range && v.range[0] <= 0 && v.range[1] === 3 && /not started/.test(v.of) && /green/.test(v.of) && /amber/.test(v.of) && /red/.test(v.of)), `${id} names the four lamp states on a value key`);
    assert.ok(templateKeys(id).length >= 3, `${id} has text keys`);
  }
});

test('status: every sample validates with zero errors, unfilled and filled with its own values', () => {
  for (const id of IDS) {
    for (const fill of [null, sampleFill(id)]) {
      const r = validate(create(deck([{template: id, ...(fill ? {fill} : {})}])).deck);
      assert.deepEqual(r.errors, [], `${id} ${fill ? 'filled' : 'unfilled'}`);
    }
  }
});

test('status: graphics are native painted rows, never an svg row', () => {
  assert.ok(rowsOf('status-rail').els.some(r => r.radius && r.bg && r.text == null), 'a lamp is a round painted box');
  for (const id of IDS) {
    const s = rowsOf(id);
    assert.equal(s.template, undefined, `${id} expands`);
    assert.ok(!s.els.some(r => r.svg != null), `${id} draws no svg row`);
    assert.ok(s.els.some(r => r.text == null && /--(ok|warn|stop|idle)/.test(paint(r))), `${id} draws its status as a painted box`);
  }
});

test('status: the four lamp states read the themable tokens with the approved defaults', () => {
  assert.deepEqual(STATUS_COLORS, ['var(--idle,#4B5563)', 'var(--ok,#34D399)', 'var(--warn,#FBBF24)', 'var(--stop,#F87171)']);
  assert.equal(STATUS_INK, 'var(--on-status,#0B0F17)');
  const all = id => rowsOf(id).els.map(paint).join(' ');
  for (const [state, token] of [[1, '--ok'], [2, '--warn'], [3, '--stop']]) {
    const s = rowsOf('status-rail', {...sampleFill('status-rail'), state});
    assert.ok(s.els.some(r => r.radius && String(r.bg).includes(token)), `state ${state} lights ${token}`);
  }
  const idle = rowsOf('status-rail', {...sampleFill('status-rail'), state: 0});
  assert.ok(idle.els.some(r => r.radius && String(r.bd).includes('--idle') && !r.bg), 'not started draws a hollow lamp');
  assert.match(all('status-filled'), /--on-status/);
});

test('status: the same keys serve a project, a program and a system', () => {
  const words = ['Amber', 'Degraded', 'Up'];
  for (const id of IDS.filter(id => !['status-columns', 'status-stage-rail'].includes(id))) {
    const key = templateKeys(id).find(k => /^(Green|Amber|Red|Up|Degraded|Down)$/.test(k.text));
    assert.ok(key, `${id} carries a free-text status word`);
    for (const w of words) {
      const s = rowsOf(id, {...sampleFill(id), [key.key]: w});
      assert.ok(s.els.some(r => r.text === w), `${id} takes the word ${w}`);
    }
  }
});

test('status: status-rail fills its rail with the status colour on request', () => {
  const plain = rowsOf('status-rail', {...sampleFill('status-rail'), fill: 0, state: 2});
  const filled = rowsOf('status-rail', {...sampleFill('status-rail'), fill: 1, state: 2});
  const rail = s => s.els.find(r => r.x === 0 && r.y === 0 && r.h === 540);
  assert.ok(!String(rail(plain).bg).includes('--warn'));
  assert.ok(String(rail(filled).bg).includes('--warn'));
  assert.ok(filled.els.some(r => r.text != null && String(r.color).includes('--on-status')), 'dark ink on the filled rail');
});

test('status: status-roster-rail drops the rows a shorter roster leaves out and draws a hollow lamp for not started', () => {
  const base = sampleFill('status-roster-rail');
  const {s7, s8, ...six} = base;
  const full = rowsOf('status-roster-rail', base), short = rowsOf('status-roster-rail', {...six, s6: 0, focus: 5});
  const lamps = s => s.els.filter(r => r.radius && r.w === r.h && r.w <= 16 && r.x < 60);
  assert.equal(lamps(full).length, 8);
  assert.equal(lamps(short).length, 6);
  assert.ok(lamps(short).some(r => String(r.bd).includes('--idle')), 'the not-started item is hollow');
  assert.deepEqual(validate(create(deck([{template: 'status-roster-rail', fill: {...six, s6: 0, focus: 5}}])).deck).errors, []);
  const bad = validate(create(deck([{template: 'status-roster-rail', fill: {...six, focus: 8}}])).deck);
  assert.match(bad.errors.join('\n'), /focus/);
});

test('status: a ground that reaches the canvas foot keeps its height when a text inside it wraps', () => {
  const long = 'Outcome: every service answers on the new host by the middle of January';
  const rail = rowsOf('status-roster-rail', {...sampleFill('status-roster-rail'), t10: long}).els.find(r => r.x === 0 && r.y === 0 && r.w === 259);
  assert.equal(rail.h, 540);
  const ground = rowsOf('status-filled', {...sampleFill('status-filled'), t3: 'The feed token expired on the fifth and nobody was told until the close'}).els.find(r => r.x === 0 && r.y === 0 && r.w === 960);
  assert.equal(ground.h, 540);
});

test('status: status-stage-rail takes four or five stages, each with its own state', () => {
  const base = sampleFill('status-stage-rail');
  const {s5, ...four} = base;
  const segs = s => s.els.filter(r => r.x === 29 && r.w === 12 && r.text == null);
  assert.equal(segs(rowsOf('status-stage-rail', base)).length, 5);
  const s = rowsOf('status-stage-rail', {...four, s1: 1, s2: 2, s3: 0, s4: 0, at: 2});
  assert.equal(segs(s).length, 4);
  assert.ok(segs(s)[0].h > segs(rowsOf('status-stage-rail', base))[0].h, 'four stages stand taller than five');
  assert.ok(String(segs(s)[1].bg).includes('--warn'));
});

test('status: status-title-strip draws a phase bar, a tranche bar or a 30-tick uptime strip from the same keys', () => {
  const base = sampleFill('status-title-strip');
  const ticks = s => s.els.filter(r => r.text == null && r.y >= 430 && r.h <= 20 && r.w <= 60 && !r.radius && r.bg && !r.line);
  assert.equal(ticks(rowsOf('status-title-strip', {...base, segs: 5, lit: 2, mark: 0})).length, 5);
  assert.equal(ticks(rowsOf('status-title-strip', {...base, segs: 4, lit: 2, mark: 0})).length, 4);
  const up = rowsOf('status-title-strip', {...base, segs: 30, lit: 30, barState: 1, mark: 14, markState: 2});
  assert.equal(ticks(up).length, 30);
  assert.equal(ticks(up).filter(r => String(r.bg).includes('--warn')).length, 1);
  assert.deepEqual(validate(create(deck([{template: 'status-title-strip', fill: {...base, segs: 30, lit: 30, barState: 1, mark: 14, markState: 2}}])).deck).errors, []);
  const {l5, l6, ...fourLamps} = base;
  const lamps = s => s.els.filter(r => r.radius && r.w === r.h && r.y >= 430 && r.x > 500);
  assert.equal(lamps(rowsOf('status-title-strip', fourLamps)).length, 4);
});

test('status: status-trajectory draws the forecast as a hollow lamp in its state colour', () => {
  const s = rowsOf('status-trajectory', {...sampleFill('status-trajectory'), next: 1});
  assert.ok(s.els.some(r => r.radius && !r.bg && String(r.bd).includes('--ok')));
});

test('status: SKILL.md documents the three lenses and the status tokens', () => {
  const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8'), doc = fs.readFileSync(path.join(root, 'docs/status.md'), 'utf8');
  assert.match(skill, /## Status templates/);
  assert.match(skill, /\(docs\/status\.md\)/);
  for (const text of [skill, doc]) {
    for (const w of ['Project', 'Program', 'System', '`ok`', '`warn`', '`stop`', '`idle`', '`on-status`']) assert.ok(text.includes(w), w);
    for (const id of IDS) assert.ok(text.includes(id), id);
  }
  assert.match(doc, /var\(--ok,#34D399\)/);
});

test('status: one deck of all fourteen passes verify with layout parity', {skip: !fs.existsSync(path.join(root, 'node_modules/playwright'))}, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-status-'));
  const model = path.join(dir, 'model.json'), out = path.join(dir, 'deck.html');
  fs.writeFileSync(model, JSON.stringify({...deck(IDS.map(id => ({template: id}))), master: [{id: 'foot', footer: 1, x: 300, y: 506, w: 340, role: 'Label', text: 'Status report'}]}));
  const c = spawnSync(process.execPath, [path.join(root, 'bin/create.mjs'), '--model', model, '--out', out, '--format', 'slides'], {encoding: 'utf8', timeout: 60000});
  assert.equal(c.status, 0, c.stdout + c.stderr);
  const r = spawnSync(process.execPath, [path.join(root, 'bin/verify.mjs'), out, '--out', path.join(dir, 'verify-out')], {encoding: 'utf8', timeout: 240000, env: {...process.env, DECKLET_PROJECTS: 'chromium'}});
  assert.match(r.stdout + r.stderr, /VERIFY PASS/);
});
