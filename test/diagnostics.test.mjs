import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validate, validateModel, FIXES} from '../bin/validate.mjs';
import {finalize} from '../bin/finalize.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'bin/validate.mjs'), 'utf8');
const CALL = /(\(est \? Wn : E\)\(|\b(?:E|Wn)\()(?=[`'])/g;
const CODE = /^'([a-z]+)\/([a-z0-9-]+)', /;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-diag-'));
const overflow = (extra = {}) => ({format: 'slides', density: 'speaker', title: 'diag',
  master: [{id: 'foot', footer: 1, right: 60, y: 506, w: 'auto', role: 'Label', nowrap: 1, text: 'DIAG'}],
  slides: [{textOnly: true, els: [{id: 'hero', x: 60, y: 200, w: 120, role: 'Body', nowrap: 1, text: 'Revenue grew in three regions', ...extra}]}]});
const examples = fs.readdirSync(path.join(root, 'examples'), {withFileTypes: true}).filter(d => d.isDirectory() && fs.existsSync(path.join(root, 'examples', d.name, 'model.json'))).map(d => path.join(root, 'examples', d.name, 'model.json'));

test('diagnostics: every validate call site passes a family/code literal first (#201)', () => {
  const sites = [...src.matchAll(CALL)];
  assert.ok(sites.length >= 130, `found ${sites.length} call sites`);
  const bad = sites.filter(m => !CODE.test(src.slice(m.index + m[0].length, m.index + m[0].length + 60)));
  assert.deepEqual(bad.map(m => src.slice(0, m.index).split('\n').length), [], 'lines with an uncoded E( or Wn(');
});

test('diagnostics: every code family in validate.mjs is in the docs/verify.md catalogue (#201)', () => {
  const doc = fs.readFileSync(path.join(root, 'docs/verify.md'), 'utf8');
  const fams = new Set([...src.matchAll(CALL)].map(m => CODE.exec(src.slice(m.index + m[0].length, m.index + m[0].length + 60))[1]));
  for (const f of fams) assert.match(doc, new RegExp('`' + f + '/`'), `docs/verify.md lists the ${f}/ family`);
  for (const code of Object.keys(FIXES)) assert.ok(src.includes(`'${code}', `), `FIXES names ${code}, which a call site raises`);
});

test('diagnostics: a nowrap overflow names its code, slide, row, the widths and the fixes (#201)', () => {
  const d = validateModel(overflow(), null).diagnostics.find(x => x.code === 'fit/nowrap-width');
  assert.ok(d, 'fit/nowrap-width raised');
  assert.equal(d.severity, 'warning');
  assert.deepEqual(d.subject, {slide: 1, el: 0, id: 'hero'});
  assert.equal(d.evidence.have, 120);
  assert.ok(d.evidence.need > 120);
  assert.deepEqual(d.fixes, [`w: ${d.evidence.need}`, "w: 'auto'", 'shorten the text']);
  const e = validateModel(overflow({anim: 'spin'}), null).diagnostics.find(x => x.code === 'motion/anim');
  assert.equal(e.severity, 'error');
});

test('diagnostics: the errors and warnings strings are unchanged, one diagnostic per line, on every example and a broken model (#201)', () => {
  for (const f of [...examples, null]) {
    const m = f ? JSON.parse(fs.readFileSync(f, 'utf8')) : {...overflow({anim: 'spin', size: 18}), entities: 'nope'};
    const r = validateModel(m, null);
    assert.deepEqual(r.diagnostics.filter(d => d.severity === 'error').map(d => d.message), r.errors, f || 'broken model');
    assert.deepEqual(r.diagnostics.filter(d => d.severity === 'warning').map(d => d.message), r.warnings, f || 'broken model');
    for (const d of r.diagnostics) assert.match(d.code, /^[a-z]+\/[a-z0-9-]+$/);
  }
  assert.equal(validate(null).diagnostics[0].code, 'contract/model-shape');
});

test('diagnostics: validate --json prints the in-process result and keeps the exit code (#201)', () => {
  const f = path.join(tmp, 'overflow.json'); fs.writeFileSync(f, JSON.stringify(overflow()));
  const r = spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), f, '--strict', '--json'], {encoding: 'utf8'});
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.diagnostics, validateModel(overflow(), null).diagnostics);
  assert.equal(spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), f, '--json'], {encoding: 'utf8'}).status, 0, 'warnings fail only with --strict');
});

test('diagnostics: the finalize receipt carries each stage\'s diagnostics (#201)', async () => {
  const f = path.join(tmp, 'receipt.json'); fs.writeFileSync(f, JSON.stringify(overflow()));
  const r = await finalize(f, {out: path.join(tmp, 'receipt.html'), verifyFn: async () => ({ok: true, errors: [], warnings: [], skipped: [], parity: []}), log: () => {}});
  assert.equal(r.stages[0].diagnostics[0].code, 'fit/nowrap-width');
});
