import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {suggest, ROUTES} from '../lib/suggest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('suggest: every row of the SKILL.md routing table finds its layout in the top three (#207)', () => {
  assert.ok(ROUTES.length >= 12, `read ${ROUTES.length} routing rows from SKILL.md`);
  for (const {phrase, layouts} of ROUTES) {
    const top = suggest(phrase).slice(0, 3).map(s => s.name);
    assert.ok(top.includes(layouts[0]), `"${phrase}" → ${layouts[0]}, got ${top.join(', ')}`);
  }
});

test('suggest: a template is found by its own note, and each result names its kind, density and keys (#207)', () => {
  const r = suggest('executive summary with before and after bars');
  assert.ok(r.slice(0, 5).some(s => s.name === 'exec-summary'), r.map(s => s.name).join(', '));
  for (const s of r) {
    assert.ok(['layout', 'template'].includes(s.kind));
    assert.ok(Array.isArray(s.keys) && s.keys.length > 0, `${s.name} names its keys`);
    assert.ok(s.density);
  }
});

test('suggest: unknown words still answer five results, and the CLI prints them (#207)', () => {
  assert.equal(suggest('zzz qqq').length, 5);
  const r = spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), '--suggest', 'three or four numbers with movement'], {encoding: 'utf8'});
  assert.equal(r.status, 0);
  assert.match(r.stdout.split('\n')[0], /^1\s+kpi-grid\s+layout/);
});
