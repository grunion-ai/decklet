// bin/*.mjs decide "am I the entry point" by comparing import.meta.url against process.argv[1]. When the checkout
// itself is a symlink (e.g. ~/Documents/decklet -> ~/Documents/decklet.nosync), the two paths differ literally and
// the guard is skipped: the bin exits 0 and writes nothing, silently. lib/is-main.mjs fixes this by comparing
// fs.realpathSync of both sides. This spawns a bin THROUGH a temporary symlinked directory and asserts it still runs.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {isMain} from '../lib/is-main.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('isMain: true when argv[1] resolves to the calling module, even through a symlink', () => {
  const self = fileURLToPath(import.meta.url);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-symlink-'));
  const linked = path.join(tmp, 'is-main.test.mjs');
  fs.symlinkSync(self, linked, 'file');
  const savedArgv1 = process.argv[1];
  process.argv[1] = linked;
  try {
    assert.equal(isMain(import.meta.url), true);
  } finally {
    process.argv[1] = savedArgv1;
    fs.rmSync(tmp, {recursive: true, force: true});
  }
});

test('isMain: false for an unrelated argv[1]', () => {
  const savedArgv1 = process.argv[1];
  process.argv[1] = path.join(root, 'package.json');
  try {
    assert.equal(isMain(import.meta.url), false);
  } finally {
    process.argv[1] = savedArgv1;
  }
});

test('isMain: false when argv[1] is missing', () => {
  const savedArgv1 = process.argv[1];
  process.argv[1] = undefined;
  try {
    assert.equal(isMain(import.meta.url), false);
  } finally {
    process.argv[1] = savedArgv1;
  }
});

test('bin/validate.mjs run through a symlinked checkout still produces output (K13)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-symlink-'));
  const linked = path.join(tmp, 'decklet-link');
  fs.symlinkSync(root, linked, 'dir');
  try {
    const out = execFileSync('node', [path.join(linked, 'bin', 'validate.mjs'), '--icons'], {encoding: 'utf8'});
    assert.ok(out.trim().length > 0, 'expected icon names on stdout, got nothing');
    assert.match(out, /\bsquare\b/);
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
});

test('bin/edits.mjs run through a symlinked checkout still produces output (K13)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-symlink-'));
  const linked = path.join(tmp, 'decklet-link');
  fs.symlinkSync(root, linked, 'dir');
  try {
    const out = execFileSync('node', [path.join(linked, 'bin', 'edits.mjs'), path.join(root, 'deck.html')], {encoding: 'utf8'});
    assert.ok(out.trim().length > 0, 'expected deck summary on stdout, got nothing');
    assert.match(out, /rev /);
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
});
