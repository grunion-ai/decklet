// decklet new.mjs — the starter model. S3 exists because every run of the parity study hand-assembled the deck's top
// level and four of four failed their first validate on `deck.w`. What this gate holds is the promise in the story:
// what the command writes passes `validate --strict` and `verify --strict` untouched, at more than one slide count and
// more than one density, and it ships a MANIFEST.md the author fills rather than invents.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {create} from '../bin/create.mjs';
import {verify} from '../bin/verify.mjs';
import {LIBRARY} from '../lib/layouts.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-new-'));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// `validate --strict` the way an author runs it: the CLI, which inherits the template's neutral roles when the model
// names no scale of its own, and resolves the canvas from `format` before the library layouts are cut to it
function strict(model, style) {
  const r = spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), model, '--strict', ...(style ? ['--style', style] : [])], {encoding: 'utf8'});
  return {ok: r.status === 0, said: r.stderr.split('\n').filter(l => /^(ERROR|warning)/.test(l)).join(' | ')};
}

// one run of the command in its own directory, the way an author runs it
function run(args, dir = fs.mkdtempSync(path.join(tmp, 'run-'))) {
  const out = path.join(dir, 'model.json');
  const r = spawnSync(process.execPath, [path.join(root, 'bin/new.mjs'), '--out', out, ...args], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  return {dir, out, stdout: r.stdout, model: JSON.parse(fs.readFileSync(out, 'utf8'))};
}

test('new: what it writes is a deck top level — format, canvas, margin and a master footer anchored to the right foot', () => {
  const {model: m} = run(['--slides', '8', '--density', 'reading']);
  assert.equal(m.format, 'slides');
  assert.deepEqual([m.w, m.h], [960, 540], 'the canvas is written out, not left to the preset');
  assert.equal(m.styles.margin, 60);
  assert.equal(m.density, 'reading');
  const foot = m.master.find(r => r.footer === 1);
  assert.ok(foot, 'exactly one master row carries footer:1');
  assert.equal(m.master.filter(r => r.footer === 1).length, 1);
  assert.deepEqual([foot.right, foot.w, foot.nowrap, foot.role], [60, 'auto', 1, 'Label'],
    'the anchoring SKILL.md Master discipline prescribes: right-anchored, width from the text, one line');
  assert.ok(foot.y > m.h - 60 && foot.y < m.h, 'it sits in the foot: ' + foot.y);
  assert.doesNotMatch(String(foot.text), /\d+\s*\/\s*\d+/, 'never type the counter into a row');
  const {model: sp} = run(['--slides', '8', '--density', 'reading', '--space', '1080x1080']);
  assert.deepEqual([sp.w, sp.h], [1080, 1080], '--space writes the canvas it names');
});

test('new: the slide run climbs the shape ladder instead of repeating one layout, and scales from 3 to 12', () => {
  const at = n => run(['--slides', String(n), '--density', 'reading']).model.slides.map(s => s.layout);
  assert.deepEqual(at(8), ['cover', 'agenda', 'kpi-grid', 'chart', 'process-steps', 'diagram', 'comparison', 'end'],
    'opener · agenda · stats · chart · process · figure · comparison · close');
  assert.deepEqual(at(3), ['cover', 'kpi-grid', 'end'], 'the shortest deck keeps the opener and the close');
  for (const n of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const run_ = at(n);
    assert.equal(run_.length, n, n + ' slides asked for, ' + run_.length + ' written');
    assert.equal(run_[0], 'cover'); assert.equal(run_[n - 1], 'end');
    assert.equal(new Set(run_).size, n, 'no layout is used twice: ' + run_.join(','));
    for (const l of run_) assert.ok(LIBRARY[l], l + ' is a library layout');
  }
  const bad = spawnSync(process.execPath, [path.join(root, 'bin/new.mjs'), '--out', path.join(tmp, 'x.json'), '--slides', '13'], {encoding: 'utf8'});
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--slides/, 'it says what it can do rather than writing a deck that repeats itself');
});

test('new: every model it writes is validate --strict clean, at both densities and every slide count', () => {
  for (const density of ['reading', 'speaker']) for (const n of [3, 5, 8, 12]) {
    const {out} = run(['--slides', String(n), '--density', density]);
    const v = strict(out);
    assert.ok(v.ok, `${n} slides at ${density} density: ${v.said}`);
  }
});

test('new: --style copies the kit beside the model, and the model is strict-clean against it', () => {
  const {dir, out} = run(['--slides', '8', '--density', 'reading', '--style', 'warm']);
  const style = JSON.parse(fs.readFileSync(path.join(dir, 'style.json'), 'utf8'));
  assert.ok(style.roles.Title, 'the kit is a style file the author passes to validate and create');
  const v = strict(out, path.join(dir, 'style.json'));
  assert.ok(v.ok, 'strict-clean against the scale it will be built with: ' + v.said);
  const bad = spawnSync(process.execPath, [path.join(root, 'bin/new.mjs'), '--out', path.join(tmp, 'y.json'), '--style', 'no-such-kit'], {encoding: 'utf8'});
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /warm/, 'an unknown kit lists the shelf');
});

test('new: the placeholder is a fictional company and it says so on every slide, so nobody ships it by accident', () => {
  const {model} = run(['--slides', '12', '--density', 'reading']);
  assert.match(String(model.master.find(r => r.footer === 1).text), /PLACEHOLDER/, 'the footer carries the word on every slide');
  for (const s of model.slides) {
    const texts = s.els.filter(r => r.text != null).map(r => String(r.text));
    assert.ok(texts.some(t => /^Replace |PLACEHOLDER/.test(t)), `${s.layout}: no row tells the author what to replace — ${texts.join(' / ')}`);
  }
});

test('new: MANIFEST.md is the coverage table docs/building.md asks for, with its columns, its two rules and empty rows', () => {
  const {dir} = run(['--slides', '8', '--density', 'reading']);
  const man = fs.readFileSync(path.join(dir, 'MANIFEST.md'), 'utf8');
  assert.match(man, /^# Coverage manifest/m);
  assert.match(man, /\| Must-include \| Slide \| Shape \| Checked \|/, 'the four columns');
  assert.match(man, /The brief's slide count is the deck's slide count/, 'rule one');
  assert.match(man, /Every number in the brief gets a manifest line and a slide/, 'rule two');
  assert.equal((man.match(/^\| *\| *\d+ \|/gm) || []).length, 8, 'one empty row per slide, numbered, ready to fill');
  assert.match(man, /docs\/building\.md/, 'it points back at the loop it belongs to');
});

test('new: the command is the first thing the build loop tells an author to run', () => {
  const b = read('docs/building.md');
  assert.match(b, /node bin\/new\.mjs --out model\.json --slides 8 --density reading/, 'the loop opens with the command');
  assert.ok(b.indexOf('bin/new.mjs') < b.indexOf('## 2.'), 'in step 1, before the shape step');
  assert.match(read('README.md'), /node bin\/new\.mjs --out model\.json/, 'README\'s loop block leads with it');
  assert.match(read('llms.txt'), /bin\/new\.mjs/, 'and the machine summary names it');
});

live('live: the deck the command writes verifies PASS untouched — two slide counts, two densities', async () => {
  for (const [n, density] of [[8, 'reading'], [5, 'speaker']]) {
    const {model} = run(['--slides', String(n), '--density', density]);
    const f = path.join(tmp, `new-${n}-${density}.html`);
    fs.writeFileSync(f, create(structuredClone(model)).html);
    const r = await verify(f, {out: path.join(tmp, `v-${n}-${density}`), strict: true, log: () => {}});
    assert.equal(r.ok, true, `${n} slides at ${density}: ${JSON.stringify(r.parity?.filter(p => !p.ok) || r)}`);
    assert.equal(r.parity.length, n);
  }
});
