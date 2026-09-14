// library.html is the whole slide library built from templates/build-sheet.mjs — served beside deck.html on Pages.
// It is a build artifact, so the gate checks it is current: rebuilding the sheet must reproduce it byte for byte.
// The sheet builds under templates/candidates.style.json (the neutral tokens + every kit's prefixed set, written by build-sheet).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {create} from '../bin/create.mjs';
import {TEMPLATES} from '../lib/templates.mjs';
import {loadChecker} from '../lib/spell.mjs';
import {KITS} from '../examples/styles/index.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('library.html == create(build-sheet): every template and layout, by kind, current', async () => {
  const r = spawnSync(process.execPath, [path.join(root, 'templates/build-sheet.mjs')], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  const model = JSON.parse(fs.readFileSync(path.join(root, 'templates/candidates.model.json'), 'utf8'));
  const styled = 6 * KITS.length;   // the Styles section: the same six templates under every kit on the shelf
  assert.equal(model.slides.filter(s => !/^kind-/.test(s.name)).length, 132 + styled, `109 templates + 23 layouts + ${styled} styled`);
  const style = JSON.parse(fs.readFileSync(path.join(root, 'templates/candidates.style.json'), 'utf8'));
  assert.ok(model.slides.some(s => s.name === 'kind-figures'), 'a Figures kind divider');
  const names = model.slides.map(s => s.name);
  assert.ok(names.indexOf('kind-figures') < names.indexOf('figure-decision') && names.indexOf('figure-layers') < names.indexOf('layout-diagram'), 'the nine figures sit under Figures, the bare diagram layout after them');
  assert.equal(create(model, {style, title: 'decklet library', spell: await loadChecker('en')}).html, fs.readFileSync(path.join(root, 'library.html'), 'utf8'), 'library.html needs a rebuild: npm run build:library');
});

// ROADMAP L4: one foot band on the sheet — left the source line (kind · id / template · id / layout · id) in the master foot, right the
// counter (the engine's, since the foot is left-anchored). A template's own sample chrome never enters the band; the two full-bleed
// image slides (hero, split — the corner is inside the photo) hide the foot, template and layout alike, and carry nothing there.
// the source line, from the slide name: kind · id, layout · id, template · id — and on the Styles section, style · kit · template
const SIX = ['cover-hero', 'statement', 'benchmark-table', 'chart-column', 'process-flow-4', 'closing-cta'];
const sourceLine = n => { const m = new RegExp(`^style-(.+)-(${SIX.join('|')})$`).exec(n); return m ? `style · ${m[1]} · ${m[2]}` : /^(kind|layout)-/.test(n) ? n.replace(/^(kind|layout)-/, '$1 · ') : `template · ${n}`; };
test('sheet: every slide\'s foot band (y ≥ 496) carries the same set of rows — the foot override with its source line, nothing else; only the full-bleed image slides hide it', () => {
  const model = JSON.parse(fs.readFileSync(path.join(root, 'templates/candidates.model.json'), 'utf8'));
  const foot = model.master.find(m => m.footer);
  assert.ok(foot.x + foot.w / 2 < model.w / 2, 'the foot is left-anchored, so the counter takes the corner');
  // A template may put its OWN mark in the band — but only by declaring `foot: {x}`, which insets the source line past it.
  // Undeclared chrome in the band is still drift, which is what this asserts.
  const inset = new Map(TEMPLATES.filter(t => t.foot).map(t => [t.id, t.foot]));
  const band = s => s.els.filter(e => e.override === foot.id || (e.role && e.y != null && e.y + (e.h || 0) >= 496))
    .filter(e => !(inset.has(s.name) && !e.override))
    .map(e => e.override ? `override:${e.override}` : `row@${e.y}`);
  const shown = model.slides.filter(s => !(s.hide || []).includes(foot.id)), hidden = model.slides.filter(s => (s.hide || []).includes(foot.id));
  assert.deepEqual(hidden.map(s => s.name).sort(), ['image-hero-overlay', 'image-split'], 'the modern nine review as their templates, so these are the only two');
  for (const s of hidden) assert.deepEqual(band(s), [], `${s.name}: a hidden foot leaves the band empty`);
  assert.deepEqual([...new Set(shown.map(s => JSON.stringify(band(s))))], ['["override:foot"]'], 'one set of rows in the band on every shown slide');
  for (const s of shown) {
    const o = s.els.find(e => e.override === foot.id);
    assert.equal(o.text, sourceLine(s.name), `${s.name}: the foot is the source line`);
    if (inset.has(s.name)) assert.equal(o.x, inset.get(s.name).x, `${s.name}: the source line starts past the slide's own chrome`);
    else assert.equal(o.x, undefined, `${s.name}: an undeclared slide leaves the foot on the margin`);
    const allow = inset.has(s.name) ? ['color', 'op', 'x', 'w'] : ['color', 'op'];   // a declared inset moves the LINE; the counter's corner is pinned either way
    assert.deepEqual(Object.keys(o).filter(k => !allow.includes(k)).sort(), ['override', 'text'], `${s.name}: the override changes the text (its paint, and its x only when the template declares an inset) — never the counter`);
  }
});
