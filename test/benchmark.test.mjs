import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {check, score, semanticMisses} from '../benchmarks/authoring/benchmark.mjs';
import {raceOrExit} from './helpers/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = path.join(root, 'benchmarks/authoring');
const manifest = JSON.parse(fs.readFileSync(path.join(B, 'manifest.json'), 'utf8'));
let pw = null; try { pw = await import('playwright'); } catch {}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-bench-'));
const passVerify = async () => ({ok: true, errors: [], warnings: [], skipped: [], parity: [{slide: 1, pass: true}], diagnostics: []});
const copyRun = name => { const d = path.join(tmp, name); fs.cpSync(path.join(B, 'reference'), d, {recursive: true}); return d; };

test('benchmark: the shipped manifest passes check, with five cases and every prompt present (#208)', () => {
  const r = check(manifest, B);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(manifest.cases.map(c => c.id), ['pitch', 'qbr', 'one-pager', 'carousel', 'landscape']);
  assert.equal(spawnSync(process.execPath, [path.join(B, 'benchmark.mjs'), 'check'], {encoding: 'utf8'}).status, 0);
});

test('benchmark: check fails a case missing its semantic keys, a bad format, or a missing prompt (#208)', () => {
  const bad = {...manifest, cases: [{id: 'x', prompt: 'prompts/none.md', format: 'slidez', density: 'speaker'}]};
  const p = check(bad, B).problems.join('\n');
  assert.match(p, /x: prompt prompts\/none\.md not found/);
  assert.match(p, /x: format "slidez"/);
  assert.match(p, /x: slides must be \[min, max\]/);
  assert.match(p, /x: entities must be an array/);
  assert.match(p, /x: counts must be an object/);
});

test('benchmark: semantic checks name what a candidate missed (#208)', () => {
  const land = manifest.cases.find(c => c.id === 'landscape');
  const m = JSON.parse(fs.readFileSync(path.join(B, 'reference/landscape/model.json'), 'utf8'));
  assert.deepEqual(semanticMisses(land, m), []);
  const short = {...m, format: 'carousel', entities: m.entities.slice(1), slides: [m.slides[0]]};
  assert.deepEqual(semanticMisses(land, short), ['format carousel, wanted slides', 'slides 1, wanted 2-4', 'entities missing Northwind', 'logo 0, wanted at least 12']);
});

test('benchmark: score marks every reference row passing with a stubbed verify, labelled as no evidence (#208)', async () => {
  const r = await score(copyRun('stub'), {verifyFn: passVerify});
  assert.equal(r.evidence, false);
  assert.deepEqual(r.rows.map(x => [x.case, x.pass, x.misses.length]), manifest.cases.map(c => [c.id, true, 0]));
  assert.deepEqual(r.summary, {passed: 5, total: 5});
  assert.equal(r.rows.find(x => x.case === 'one-pager').repairs, 1);
});

test('benchmark: a missing candidate and a broken one fail with their reasons and top codes (#208)', async () => {
  const d = copyRun('broken');
  fs.rmSync(path.join(d, 'carousel'), {recursive: true});
  const m = JSON.parse(fs.readFileSync(path.join(d, 'qbr/model.json'), 'utf8')); m.slides[0].els.push({x: 60, y: 300, w: 40, role: 'Body', nowrap: 1, text: 'A line much too long for forty pixels'});
  fs.writeFileSync(path.join(d, 'qbr/model.json'), JSON.stringify(m));
  const r = await score(d, {verifyFn: passVerify});
  const row = id => r.rows.find(x => x.case === id);
  assert.deepEqual([row('carousel').pass, row('carousel').status], [false, 'missing']);
  assert.equal(row('qbr').pass, false);
  assert.equal(row('qbr').finalize, false);
  assert.ok(row('qbr').topCodes.includes('fit/nowrap-width'), JSON.stringify(row('qbr').topCodes));
  assert.deepEqual(r.summary, {passed: 3, total: 5});
});

test('benchmark: score --out writes the result file the CLI prints (#208)', () => {
  const d = copyRun('cli'), out = path.join(tmp, 'result.json');
  const r = spawnSync(process.execPath, [path.join(B, 'benchmark.mjs'), 'score', d, '--out', out, '--no-verify'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(j.rows.length, 5);
  assert.match(r.stdout, /0\/5 passed/, 'with --no-verify every finalize is skipped, so nothing passes');
});

test('live: every reference candidate reaches FINALIZE PASS and its semantic keys (#208)', {skip: !pw && 'Playwright not installed'}, async () => {
  const r = await raceOrExit(score(copyRun('live'), {webkit: false}), 240000, 'benchmark live');
  assert.deepEqual(r.rows.filter(x => !x.pass).map(x => [x.case, x.misses, x.topCodes]), []);
});
