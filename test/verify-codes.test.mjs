import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {diagnosticsOf, PARITY_CODES, verify} from '../bin/verify.mjs';
import {create} from '../bin/create.mjs';
import {finalize} from '../bin/finalize.mjs';
import {raceOrExit} from './helpers/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'bin/verify.mjs'), 'utf8');
let pw = null; try { pw = await import('playwright'); } catch {}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-vcodes-'));
const deck = {slides: [{id: 's1', els: [{id: 'hero'}, {id: 'card'}]}, {id: 's2', els: []}], master: [{id: 'foot'}]};
const base = (over = {}) => ({errors: [], warnings: [], skipped: [], parity: [], engines: {}, ae: [], contract: {diagnostics: []}, ...over});

test('verify codes: every problem string verify.mjs can push matches a parity code (#201)', () => {
  const sites = [...src.matchAll(/problems(?:\.push\(|: \[)\s*[`']([^`'$]{6,})/g)].map(m => m[1]);
  assert.ok(sites.length >= 10, `found ${sites.length} problem strings`);
  const lead = s => s.split(' ').slice(0, 2).join(' ');
  for (const s of sites) assert.ok(PARITY_CODES.some(c => c.re.source.replace(/\\/g, '').startsWith('^' + lead(s))), `no code matches "${s}"`);
});

test('verify codes: each parity problem becomes one coded diagnostic with slide, row, id, engine and evidence (#201)', () => {
  const row = (n, ...problems) => ({n, text: 'Revenue grew', problems});
  const q = {slide: 1, name: 'cover', pass: false, crowding: [], rows: [
    row('0', 'overflows its box (412>388)', 'nowrap row renders 2 lines'),
    row('1', 'overlapped by 3', 'straddles 4', 'overlaps text 0', 'under row 5 (img)'),
    row('m:0', 'outside the canvas'),
    row('counter', 'counter right edge 880 is not on the margin (900 = w − styles.margin)'),
  ]};
  const d = diagnosticsOf(base({parity: [q], engines: {chromium: [q], webkit: [{...q, rows: [row('0', 'arrow lands inside 2 — terminate it with to:/from:')]}]}}), deck);
  const codes = d.map(x => `${x.engine}:${x.code}`);
  assert.deepEqual(codes, ['chromium:parity/overflow', 'chromium:parity/nowrap-lines', 'chromium:parity/ink-through-text', 'chromium:parity/straddles-container',
    'chromium:parity/text-over-text', 'chromium:parity/occlusion', 'chromium:parity/outside-canvas', 'chromium:parity/counter-margin', 'webkit:parity/arrow-in-fill']);
  assert.deepEqual(d[0].subject, {slide: 1, el: 0, id: 'hero'});
  assert.deepEqual(d[0].evidence, {need: 412, have: 388});
  assert.deepEqual(d[0].fixes, ['w: 412', "w: 'auto'", 'shorten the text']);
  assert.deepEqual(d[6].subject, {slide: 1, master: 0, id: 'foot'});
  assert.deepEqual(d[7].subject, {slide: 1});
  assert.ok(d.every(x => x.severity === 'error'));
});

test('verify codes: crowding warns, page errors, AE and the network fail, and the contract carries validate\'s codes (#201)', () => {
  const q = {slide: 2, name: 'x', pass: true, rows: [], crowding: [{n: '0', text: 't', snapped: 1, problems: ['source had 3 line(s), renders 2']}]};
  const d = diagnosticsOf(base({parity: [q], engines: {chromium: [q]}, ae: [{slide: 2, name: 'x', pass: false, pctNoChromeNoConflict: 1.2}],
    errors: ['deck references the network', 'page errors: boom'], contract: {diagnostics: [{code: 'fit/nowrap-width', severity: 'warning', message: 'm', subject: {slide: 1}, fixes: []}]}}), deck);
  assert.deepEqual(d.map(x => [x.code, x.severity]), [['fit/nowrap-width', 'warning'], ['deck/network', 'error'], ['parity/page-error', 'error'], ['parity/crowding', 'warning'], ['ae/over-threshold', 'error']]);
  assert.deepEqual(d[4].evidence, {pct: 1.2});
});

test('live: a real overflow comes back as parity/overflow on its row, in the API, results.json and verify --json (#201)', {skip: !pw && 'Playwright not installed'}, async () => {
  const f = path.join(tmp, 'overflow.html'), out = path.join(tmp, 'v');
  const model = {format: 'slides', density: 'speaker', title: 'codes', slides: [{textOnly: true, els: [{id: 'tight', x: 60, y: 200, w: 90, h: 24, role: 'Body', nowrap: 1, css: 'overflow:hidden', text: 'A sentence far too long for ninety pixels'}]}]};
  fs.writeFileSync(f, create(model, {}).html);
  const r = await raceOrExit(verify(f, {out, webkit: false, log: () => {}}), 60000, 'verify codes');
  const hit = r.diagnostics.find(x => x.code === 'parity/overflow' || x.code === 'parity/nowrap-lines');
  assert.ok(hit, JSON.stringify(r.diagnostics.map(x => x.code)));
  assert.equal(hit.subject.id, 'tight');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'results.json'), 'utf8')).diagnostics, r.diagnostics);
  const cli = spawnSync(process.execPath, [path.join(root, 'bin/verify.mjs'), f, '--no-webkit', '--out', path.join(tmp, 'v2'), '--json'], {encoding: 'utf8'});
  assert.equal(cli.status, 1);
  assert.ok(JSON.parse(cli.stdout).diagnostics.some(x => x.subject.id === 'tight'));
});

test('verify codes: the finalize receipt carries verify\'s diagnostics on the verify stage (#201)', async () => {
  const m = path.join(tmp, 'fin.json');
  fs.writeFileSync(m, JSON.stringify({format: 'slides', density: 'speaker', title: 'fin', slides: [{textOnly: true, els: [{x: 60, y: 200, w: 600, role: 'H1', text: 'Fine'}]}]}));
  const coded = {code: 'parity/overflow', severity: 'error', message: 'x', subject: {slide: 1, el: 0}, fixes: []};
  const r = await finalize(m, {out: path.join(tmp, 'fin.html'), verifyFn: async () => ({ok: false, errors: ['layout parity failed on 1'], warnings: [], skipped: [], parity: [], diagnostics: [coded]}), log: () => {}});
  assert.deepEqual(r.stages[2].diagnostics, [coded]);
});
