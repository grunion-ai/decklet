import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {finalize, receiptPath, checkReceipt} from '../bin/finalize.mjs';
import {writeDeck} from '../bin/create.mjs';
import {verify} from '../bin/verify.mjs';
import {validateModel} from '../bin/validate.mjs';
import {raceOrExit} from './helpers/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-finalize-'));
const sha = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write = (name, obj) => { const f = path.join(tmp, name); fs.writeFileSync(f, JSON.stringify(obj)); return f; };
const quiet = () => {};

const model = (text = 'Revenue grew in three regions', extra = {}) => ({
  format: 'slides', density: 'speaker', title: 'finalize probe',
  master: [{id: 'foot', footer: 1, right: 60, y: 506, w: 'auto', role: 'Label', nowrap: 1, text: 'PROBE'}],
  slides: [{textOnly: true, els: [{x: 60, y: 200, w: 300, role: 'Body', nowrap: 1, text, ...extra}]}],
});
const kit = JSON.parse(fs.readFileSync(path.join(root, 'examples/styles/dark/style.json'), 'utf8'));
const bigBody = structuredClone(kit); bigBody.roles.Body = {...bigBody.roles.Body, size: 34, lh: 40};
const passVerify = async () => ({ok: true, errors: [], warnings: [], skipped: [], parity: [{slide: 1, pass: true}]});

test('finalize: the style trap — standalone validate without --style passes, finalize measures with the style and stops at validate', async () => {
  const m = write('trap.model.json', model()), s = write('big.style.json', bigBody), out = path.join(tmp, 'trap.html');
  assert.equal(validateModel(model(), null).warnings.length, 0, 'measured against the neutral roles the row fits');
  const r = await finalize(m, {style: s, out, verifyFn: passVerify, log: quiet});
  assert.equal(r.ok, false);
  assert.deepEqual(r.stages.map(x => [x.stage, x.status]), [['validate', 'fail'], ['create', 'not-run'], ['verify', 'not-run']]);
  assert.match(r.stages[0].warnings.join('\n'), /nowrap text "Revenue grew in three regions" likely wider/);
  assert.equal(fs.existsSync(out), false, 'no deck is written when validate fails');
  const onDisk = JSON.parse(fs.readFileSync(receiptPath(out), 'utf8'));
  assert.equal(onDisk.ok, false);
  assert.equal(onDisk.style.sha256, sha(s));
  assert.equal(onDisk.deck, null);
});

test('finalize: an invalid model stops at validate with its error', async () => {
  const m = write('bad.model.json', model('Fine', {anim: 'spin'})), out = path.join(tmp, 'bad.html');
  const r = await finalize(m, {out, verifyFn: passVerify, log: quiet});
  assert.equal(r.stages[0].status, 'fail');
  assert.ok(r.stages[0].errors.length > 0);
  assert.equal(r.stages[1].status, 'not-run');
  assert.equal(fs.existsSync(out), false);
});

test('finalize: a passing model writes the deck, and the receipt binds the model, style and deck bytes', async () => {
  const m = write('ok.model.json', model('Short line')), s = write('kit.style.json', kit), out = path.join(tmp, 'ok.html');
  const r = await finalize(m, {style: s, out, verifyFn: passVerify, log: quiet});
  assert.equal(r.ok, true, JSON.stringify(r.stages));
  assert.deepEqual(r.stages.map(x => x.status), ['pass', 'pass', 'pass']);
  assert.equal(r.deck.sha256, sha(out));
  assert.equal(r.model.sha256, sha(m));
  assert.equal(r.engine, JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version);
  assert.deepEqual(JSON.parse(fs.readFileSync(receiptPath(out), 'utf8')), r);
});

test('finalize: verify that could not render is skipped, and a skipped gate is not a pass', async () => {
  const m = write('skip.model.json', model('Short line')), out = path.join(tmp, 'skip.html');
  const noBrowser = async () => ({ok: true, errors: [], warnings: [], parity: [], skipped: ['layout parity + AE: Playwright not installed (npm i -D playwright && npx playwright install chromium)']});
  const r = await finalize(m, {out, verifyFn: noBrowser, log: quiet});
  assert.equal(r.stages[2].status, 'skipped');
  assert.equal(r.ok, false);
});

test('finalize: a failing verify fails the run and keeps the deck for inspection', async () => {
  const m = write('vfail.model.json', model('Short line')), out = path.join(tmp, 'vfail.html');
  const failing = async () => ({ok: false, errors: ['layout parity failed on 1'], warnings: [], skipped: [], parity: [{slide: 1, pass: false}]});
  const r = await finalize(m, {out, verifyFn: failing, log: quiet});
  assert.equal(r.stages[2].status, 'fail');
  assert.deepEqual(r.stages[2].errors, ['layout parity failed on 1']);
  assert.equal(r.ok, false);
  assert.ok(fs.existsSync(out));
});

test('finalize CLI: usage on missing --out exits 2; a failing run exits 1 and prints FINALIZE FAIL', () => {
  const bin = path.join(root, 'bin/finalize.mjs');
  assert.equal(spawnSync(process.execPath, [bin, 'x.json'], {encoding: 'utf8'}).status, 2);
  const m = write('cli.model.json', model()), s = write('cli.style.json', bigBody);
  const r = spawnSync(process.execPath, [bin, m, '--style', s, '--out', path.join(tmp, 'cli.html')], {encoding: 'utf8'});
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FINALIZE FAIL/);
  assert.match(r.stdout, /receipt .*cli\.finalize\.json/);
});

test('live: finalize takes the explainer model to FINALIZE PASS in a real browser', {skip: !pw && 'Playwright not installed'}, async () => {
  const out = path.join(tmp, 'explainer.html');
  const r = await raceOrExit(finalize(path.join(root, 'examples/explainer/model.json'), {out, title: 'decklet', webkit: false, verifyOut: path.join(tmp, 'v-explainer'), log: quiet}), 120000, 'finalize explainer');
  assert.equal(r.ok, true, JSON.stringify(r.stages, null, 1));
  assert.equal(r.deck.sha256, sha(out));
});

test('finalize --check: a receipt vouches only for the bytes it hashed (#200)', async () => {
  const m = write('check.model.json', model('Short line')), out = path.join(tmp, 'check.html');
  await finalize(m, {out, verifyFn: passVerify, log: quiet});
  assert.deepEqual(checkReceipt(out).ok, true);
  const bin = path.join(root, 'bin/finalize.mjs');
  assert.equal(spawnSync(process.execPath, [bin, '--check', out], {encoding: 'utf8'}).status, 0);
  const before = sha(out);
  fs.appendFileSync(out, ' ');
  const c = checkReceipt(out);
  assert.equal(c.ok, false);
  assert.match(c.message, new RegExp(`receipt is for ${before.slice(0, 12)}.*file is ${sha(out).slice(0, 12)}`));
  const r = spawnSync(process.execPath, [bin, '--check', out], {encoding: 'utf8'});
  assert.equal(r.status, 1);
  assert.match(r.stderr, /rerun finalize/);
  assert.match(checkReceipt(path.join(tmp, 'never-built.html')).message, /no receipt/);
});

test('finalize --check: a receipt whose run failed never vouches, even for unchanged bytes (#200)', async () => {
  const m = write('checkfail.model.json', model('Short line')), out = path.join(tmp, 'checkfail.html');
  await finalize(m, {out, verifyFn: async () => ({ok: false, errors: ['x'], warnings: [], skipped: [], parity: []}), log: quiet});
  const c = checkReceipt(out);
  assert.equal(c.ok, false);
  assert.match(c.message, /did not pass/);
});

test('writeDeck: the deck lands whole through a temp file and a rename, leaving no temp file behind (#200)', () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'atomic-')), f = path.join(dir, 'deck.html');
  writeDeck(f, '<!doctype html>one');
  writeDeck(f, '<!doctype html>two');
  assert.equal(fs.readFileSync(f, 'utf8'), '<!doctype html>two');
  assert.deepEqual(fs.readdirSync(dir), ['deck.html']);
});

test('live: verify results carry the sha256, id and rev of the deck they measured (#200)', {skip: !pw && 'Playwright not installed'}, async () => {
  const m = write('vbytes.model.json', model('Short line')), out = path.join(tmp, 'vbytes.html'), vout = path.join(tmp, 'v-bytes');
  await finalize(m, {out, verifyFn: passVerify, log: quiet});
  const r = await raceOrExit(verify(out, {out: vout, webkit: false, log: quiet}), 60000, 'verify bytes');
  assert.equal(r.deck.sha256, sha(out));
  assert.match(r.deck.id, /^[0-9a-f]{10}$/);
  assert.match(r.deck.rev, /^[0-9a-f]{10}$/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(vout, 'results.json'), 'utf8')).deck, r.deck);
});
