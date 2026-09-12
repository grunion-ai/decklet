// ROADMAP P1.1: the three version fields and the CHANGELOG agree. CI checked none of them; package.json said 0.6.1 while
// plugin.json and marketplace.json still said 0.4.0.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('package.json, plugin.json and marketplace.json carry one version', () => {
  const pkg = JSON.parse(read('package.json')).version;
  assert.match(pkg, /^\d+\.\d+\.\d+$/);
  assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, pkg, '.claude-plugin/plugin.json');
  assert.equal(JSON.parse(read('.claude-plugin/marketplace.json')).plugins.find(p => p.name === 'decklet').version, pkg, '.claude-plugin/marketplace.json');
});

test('CHANGELOG.md has a heading for the package version', () => {
  const pkg = JSON.parse(read('package.json')).version;
  assert.match(read('CHANGELOG.md'), new RegExp(`^## ${pkg.replace(/\./g, '\\.')}\\b`, 'm'), `CHANGELOG.md needs a "## ${pkg}" heading`);
});

// ROADMAP P1.2: llms.txt named a /*TITLE*/ marker that never existed and omitted LOG and VERSIONS.
test('llms.txt names exactly the markers create.mjs fills, and every marker it names exists in template.html', () => {
  const tpl = read('template.html'), named = new Set((read('llms.txt').match(/\/\*([A-Z]+)\*\//g) || []).map(m => m.slice(2, -2)));
  for (const m of named) assert.ok(tpl.includes(`/*${m}*/`), `llms.txt names /*${m}*/ but template.html has no such marker`);
  const filled = new Set(read('bin/create.mjs').split('\n').filter(l => /\bput(Block)?\(/.test(l)).flatMap(l => [...l.matchAll(/'([A-Z]{3,})'/g)].map(m => m[1])));
  for (const m of filled) assert.ok(named.has(m), `create.mjs fills /*${m}*/ but llms.txt does not name it`);
});
