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
