import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {create} from '../bin/create.mjs';
import {verify} from '../bin/verify.mjs';
import {raceOrExit} from './helpers/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-scope-'));
const deckFile = path.join(tmp, 'three.html');
const slide = (id, t) => ({id, textOnly: true, els: [{x: 60, y: 200, w: 600, role: 'H1', text: t}]});
fs.writeFileSync(deckFile, create({format: 'slides', density: 'speaker', title: 'scope', slides: [slide('intro', 'One'), slide('mid', 'Two'), slide('end', 'Three')]}, {}).html);

test('verify --slides: an unknown slide is refused before any browser starts, naming the ids that exist (#204)', async () => {
  await assert.rejects(verify(deckFile, {slides: ['nope'], log: () => {}}), /no slide "nope".*intro, mid, end/);
  const r = spawnSync(process.execPath, [path.join(root, 'bin/verify.mjs'), deckFile, '--slides', '9'], {encoding: 'utf8'});
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no slide "9"/);
});

test('live: verify --slides measures only the named slides, by id or 1-based number, and records the scope (#204)', {skip: !pw && 'Playwright not installed'}, async () => {
  const r = await raceOrExit(verify(deckFile, {slides: ['end', '1'], webkit: false, out: path.join(tmp, 'v'), log: () => {}}), 60000, 'scoped verify');
  assert.deepEqual(r.parity.map(s => s.slide), [1, 3]);
  assert.deepEqual(r.scope, [1, 3]);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const full = await raceOrExit(verify(deckFile, {webkit: false, out: path.join(tmp, 'v-full'), log: () => {}}), 60000, 'full verify');
  assert.equal(full.parity.length, 3);
  assert.equal(full.scope, undefined);
});
