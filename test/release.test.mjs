import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {updateCheck, PACKAGE_URL} from '../lib/release.mjs';
import {finalize} from '../bin/finalize.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-release-'));
const pkg = v => JSON.stringify({name: '@grunion/decklet', version: v});
const counting = body => { const f = async url => { f.calls.push(url); if (body instanceof Error) throw body; return body; }; f.calls = []; return f; };
const cacheAt = name => path.join(tmp, name, 'update.json');

test('update: a newer version on main sets noticeRequired, read from package.json on main (#206)', async () => {
  const fetchText = counting(pkg('0.16.0'));
  const u = await updateCheck({installed: '0.14.0', fetchText, cacheFile: cacheAt('newer'), env: {}});
  assert.deepEqual(fetchText.calls, [PACKAGE_URL]);
  assert.match(PACKAGE_URL, /^https:\/\/raw\.githubusercontent\.com\/grunion-ai\/decklet\/main\/package\.json$/);
  assert.deepEqual({...u, checkedAt: undefined}, {installed: '0.14.0', available: '0.16.0', noticeRequired: true, source: 'network', checkedAt: undefined});
});

test('update: the same or an older version needs no notice (#206)', async () => {
  for (const v of ['0.14.0', '0.13.2']) {
    const u = await updateCheck({installed: '0.14.0', fetchText: counting(pkg(v)), cacheFile: cacheAt('same-' + v), env: {}});
    assert.equal(u.noticeRequired, false, v);
  }
});

test('update: a failed or garbled fetch is unavailable, never a throw (#206)', async () => {
  for (const [name, body] of [['err', new Error('timeout')], ['junk', 'not json'], ['nover', '{}']]) {
    const u = await updateCheck({installed: '0.14.0', fetchText: counting(body), cacheFile: cacheAt(name), env: {}});
    assert.deepEqual([u.source, u.available, u.noticeRequired], ['unavailable', null, false], name);
  }
});

test('update: a check within 24 hours answers from the cache and makes no request (#206)', async () => {
  const cacheFile = cacheAt('cache'), now = Date.parse('2026-11-08T12:00:00Z');
  await updateCheck({installed: '0.14.0', fetchText: counting(pkg('0.15.0')), cacheFile, env: {}, now});
  const again = counting(pkg('0.99.0'));
  const u = await updateCheck({installed: '0.14.0', fetchText: again, cacheFile, env: {}, now: now + 23 * 3600e3});
  assert.deepEqual(again.calls, []);
  assert.deepEqual([u.source, u.available, u.noticeRequired], ['cache', '0.15.0', true]);
  const later = counting(pkg('0.16.0'));
  assert.equal((await updateCheck({installed: '0.14.0', fetchText: later, cacheFile, env: {}, now: now + 25 * 3600e3})).available, '0.16.0');
  assert.equal(later.calls.length, 1);
});

test('update: DECKLET_NO_UPDATE_CHECK=1 turns the check off (#206)', async () => {
  const fetchText = counting(pkg('9.0.0'));
  assert.equal(await updateCheck({installed: '0.14.0', fetchText, cacheFile: cacheAt('off'), env: {DECKLET_NO_UPDATE_CHECK: '1'}}), null);
  assert.deepEqual(fetchText.calls, []);
});

test('update: finalize records the check in its receipt when asked, and its gates alone decide ok (#206)', async () => {
  const m = path.join(tmp, 'm.json');
  fs.writeFileSync(m, JSON.stringify({format: 'slides', density: 'speaker', title: 'u', slides: [{textOnly: true, els: [{x: 60, y: 200, w: 600, role: 'H1', text: 'Fine'}]}]}));
  const verifyFn = async () => ({ok: true, errors: [], warnings: [], skipped: [], parity: [{slide: 1, pass: true}]});
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const r = await finalize(m, {out: path.join(tmp, 'u.html'), verifyFn, log: () => {}, update: {fetchText: counting(new Error('offline')), cacheFile: cacheAt('fin'), env: {}}});
  assert.equal(r.ok, true);
  assert.deepEqual([r.update.installed, r.update.source], [version, 'unavailable']);
  const plain = await finalize(m, {out: path.join(tmp, 'u2.html'), verifyFn, log: () => {}});
  assert.equal(plain.update, undefined, 'the API makes no request unless asked; the CLI asks');
});
