// library.html is the whole slide library built from templates/build-sheet.mjs — served beside deck.html on Pages.
// It is a build artifact, so the gate checks it is current: rebuilding the sheet must reproduce it byte for byte.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {create} from '../bin/create.mjs';
import {loadChecker} from '../lib/spell.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('library.html == create(build-sheet): every template and layout, by kind, current', async () => {
  const r = spawnSync(process.execPath, [path.join(root, 'templates/build-sheet.mjs')], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  const model = JSON.parse(fs.readFileSync(path.join(root, 'templates/candidates.model.json'), 'utf8'));
  assert.equal(model.slides.filter(s => !/^kind-/.test(s.name)).length, 89, '67 templates + 22 layouts');
  assert.ok(model.slides.some(s => s.name === 'kind-figures'), 'a Figures kind divider');
  const names = model.slides.map(s => s.name);
  assert.ok(names.indexOf('kind-figures') < names.indexOf('figure-decision') && names.indexOf('figure-layers') < names.indexOf('layout-diagram'), 'the nine figures sit under Figures, the bare diagram layout after them');
  assert.equal(create(model, {title: 'decklet library', spell: await loadChecker('en')}).html, fs.readFileSync(path.join(root, 'library.html'), 'utf8'), 'library.html needs a rebuild: npm run build:library');
});
