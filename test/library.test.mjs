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

// ROADMAP L4: one foot band on the sheet — left the source line (kind · id / template · id / layout · id) in the master foot, right the
// counter (the engine's, since the foot is left-anchored). A template's own sample chrome never enters the band; the two full-bleed
// image slides (hero, split — the corner is inside the photo) hide the foot, template and layout alike, and carry nothing there.
test('sheet: every slide\'s foot band (y ≥ 496) carries the same set of rows — the foot override with its source line, nothing else; only the full-bleed image slides hide it', () => {
  const model = JSON.parse(fs.readFileSync(path.join(root, 'templates/candidates.model.json'), 'utf8'));
  const foot = model.master.find(m => m.footer);
  assert.ok(foot.x + foot.w / 2 < model.w / 2, 'the foot is left-anchored, so the counter takes the corner');
  const band = s => s.els.filter(e => e.override === foot.id || (e.role && e.y != null && e.y + (e.h || 0) >= 496)).map(e => e.override ? `override:${e.override}` : `row@${e.y}`);
  const shown = model.slides.filter(s => !(s.hide || []).includes(foot.id)), hidden = model.slides.filter(s => (s.hide || []).includes(foot.id));
  assert.deepEqual(hidden.map(s => s.name).sort(), ['image-hero-overlay', 'image-split'], 'the modern nine review as their templates, so these are the only two');
  for (const s of hidden) assert.deepEqual(band(s), [], `${s.name}: a hidden foot leaves the band empty`);
  assert.deepEqual([...new Set(shown.map(s => JSON.stringify(band(s))))], ['["override:foot"]'], 'one set of rows in the band on every shown slide');
  for (const s of shown) {
    const o = s.els.find(e => e.override === foot.id);
    assert.match(o.text, /^(kind|template|layout) · [a-z0-9-]+$/, `${s.name}: the foot is the source line`);
    assert.equal(o.text.split(' · ')[1], s.name.replace(/^(kind|layout)-/, ''), `${s.name}: the source line names the slide`);
    assert.deepEqual(Object.keys(o).filter(k => !['color', 'op'].includes(k)).sort(), ['override', 'text'], `${s.name}: the override changes the text (and at most its paint) — never geometry, so the counter stays where the master puts it`);
  }
});
