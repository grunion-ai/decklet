// archify vendor gate: vendor/archify is one tagged archify release, byte for byte, and vendor/archify.lock.json says which.
// A hand edit under vendor/archify changes the tree hash and fails here; an upgrade goes through bin/archify-sync.mjs,
// which rewrites the tree, the lock and the CHANGELOG line together.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {treeHash, newer, LOCK, VENDOR} from '../lib/archify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const lock = JSON.parse(read(LOCK));

test('the lock names one tagged release by tag, commit and hashes', () => {
  assert.equal(lock.repo, 'tt-a1i/archify');
  assert.match(lock.tag, /^v\d+\.\d+\.\d+$/);
  assert.match(lock.commit, /^[0-9a-f]{40}$/);
  assert.match(lock.zipSha256, /^[0-9a-f]{64}$/);
  assert.match(lock.treeSha256, /^[0-9a-f]{64}$/);
});

test('vendor/archify is the locked release, unedited', () => {
  assert.equal(treeHash(path.join(root, VENDOR)), lock.treeSha256, 'vendor/archify drifted from the lock: re-run node bin/archify-sync.mjs --tag ' + lock.tag);
  const rel = JSON.parse(read(`${VENDOR}/skill-release.json`));
  assert.equal(rel.channel, 'stable');
  assert.equal(`v${rel.version}`, lock.tag);
  assert.match(read(`${VENDOR}/SKILL.md`), /^---\nname: archify\n/);
});

test('the vendored renderer runs with no install', () => {
  execFileSync(process.execPath, [path.join(root, VENDOR, 'bin/archify.mjs'), 'doctor'], {stdio: 'pipe', env: {...process.env, ARCHIFY_UPDATE_CHECK_DISABLED: '1'}});
});

test('treeHash ignores .DS_Store and changes with any byte', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-'));
  fs.mkdirSync(path.join(d, 'a'));
  fs.writeFileSync(path.join(d, 'a/x.txt'), 'x');
  const h = treeHash(d);
  fs.writeFileSync(path.join(d, '.DS_Store'), 'junk');
  assert.equal(treeHash(d), h);
  fs.writeFileSync(path.join(d, 'a/x.txt'), 'y');
  assert.notEqual(treeHash(d), h);
});

test('newer compares release tags numerically', () => {
  assert.equal(newer('v2.16.0', 'v2.16.0'), false);
  assert.equal(newer('v2.16.0', 'v2.9.0'), false);
  assert.equal(newer('v2.9.0', 'v2.16.0'), true);
  assert.equal(newer('v2.16.0', 'v3.0.0'), true);
});

test('the pin is documented where a reader looks', () => {
  assert.match(read('CHANGELOG.md'), new RegExp(`archify ${lock.tag.replace(/\./g, '\\.')}`), 'CHANGELOG.md must name the vendored archify tag');
  const doc = read('docs/archify.md');
  assert.match(doc, new RegExp(lock.tag.replace(/\./g, '\\.')), 'docs/archify.md must name the vendored tag');
  assert.match(doc, /bin\/archify-sync\.mjs/);
  assert.match(read('docs/figures.md'), /\(archify\.md\)/, 'docs/figures.md must link docs/archify.md');
  assert.ok(JSON.parse(read('package.json')).files.includes('vendor'), 'package.json files must ship vendor/');
});
