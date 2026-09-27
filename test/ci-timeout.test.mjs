// K7: a CI run with no timeout hung and needed a hand cancel. Guard that the
// test job, and any step that can hang (the playwright install), carry a cap.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const yml = fs.readFileSync(path.join(root, '.github/workflows/test.yml'), 'utf8');

test('test.yml: the gate job has a timeout-minutes cap', () => {
  const jobMatch = yml.match(/jobs:\s*\n\s*gate:\n([\s\S]*)/);
  assert.ok(jobMatch, 'gate job block not found');
  assert.match(jobMatch[1], /^\s*timeout-minutes:\s*\d+/m, 'gate job missing timeout-minutes');
});

test('test.yml: the playwright install step has a timeout-minutes cap', () => {
  const lines = yml.split('\n');
  const idx = lines.findIndex(l => /playwright install/.test(l));
  assert.ok(idx !== -1, 'playwright install step not found');
  // the step is a `- run: ...` block; a sibling `timeout-minutes:` line lives
  // right above or below it, indented at the same level as `run:`.
  const window = lines.slice(Math.max(0, idx - 2), idx + 2).join('\n');
  assert.match(window, /timeout-minutes:\s*\d+/, 'playwright install step missing timeout-minutes');
});
