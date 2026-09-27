// decklet with no host, in any browser: the save route is chosen at load by capability (host → file handle → durable store →
// tab only), never by browser name. Live proofs (Playwright, skipped when absent), in every project of the browser matrix
// (test/helpers/projects.mjs: Chromium, WebKit, Firefox, the embedded pane) with storage refused:
// the tab route says "Not saving" on the save button and in a one-time banner, keeps the working copy in window.name (and
// history.state) so a reload in the same tab restores it, ignores a window.name another deck left, and asks before leaving
// while edits are not durable. The file-handle route checks lastModified before every write: a file someone else rewrote is
// read and rebased onto (the host route's rebase), never overwritten.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {blockOf} from '../lib/edits.mjs';
import {withBrowser} from './helpers/browser.mjs';
import {projects, withProject} from './helpers/projects.mjs';

let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-tab-'));
const model = (one = 'One', two = 'Two', title = 'tab') => ({w: 960, h: 540, title, slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: one}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: two}]},
]});
const write = (name, html) => { const f = path.join(tmp, name); fs.writeFileSync(f, html); return f; };
const watch = p => { p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') p.errs.push('console: ' + m.text()); }); p.on('dialog', d => d.accept()); return p; };
const settled = async p => { await p.waitForFunction(() => document.getElementById('autosave').dataset.state !== 'busy', null, {timeout: 4000}); return p.evaluate(() => document.getElementById('autosave').dataset.state); };
const refuse = () => { for (const k of ['localStorage', 'indexedDB']) Object.defineProperty(window, k, {get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }}); };
const TABMSG = f => `This browser cannot save here. Edits survive reload in this tab only. Host it: node bin/serve.mjs ${f}`;
const text0 = p => p.evaluate(() => deck.slides[0].els[0].text);

for (const bn of projects()) live(`tab route (${bn}): storage refused, "Not saving" pill and banner, a reload restores the edit from window.name or history.state, another deck's copy is ignored`, async () => withProject(pw, bn, async ({context}) => { const f = write(`tab-${bn}.html`, create(model()).html), g = write(`other-${bn}.html`, create(model('Other one', 'Other two', 'other')).html);
  const ctx = await context(); await ctx.addInitScript(refuse);
  const p = watch(await ctx.newPage()); await p.goto(pathToFileURL(f).href);
  assert.equal(await settled(p), 'tab', 'the amber tab state, never red');
  const ui = () => p.evaluate(() => { const a = $('autosave'), nb = $('nosave');
    return {route: route(), label: getComputedStyle(a.querySelector('.nos')).display !== 'none' ? a.querySelector('.nos').textContent : null, tip: a.dataset.tip, aria: a.getAttribute('aria-label'), badge: !$('savebad').hidden, banner: nb.hidden ? null : nb.querySelector('span').textContent}; });
  const s0 = await ui();
  assert.deepEqual(s0, {route: 'tab', label: 'Not saving', tip: TABMSG(`tab-${bn}.html`), aria: TABMSG(`tab-${bn}.html`), badge: false, banner: TABMSG(`tab-${bn}.html`)});
  assert.equal(await p.evaluate(() => getComputedStyle($('autosave')).color), await p.evaluate(() => { const d = document.createElement('i'); d.style.color = '#d29922'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }), 'amber');

  // an edit: the tab copy is written, and leaving asks first (best-effort; embedded browsers suppress the prompt)
  await p.evaluate(() => { snap(); deck.slides[0].els[0].text = 'Kept in the tab'; save(); });
  const copies = await p.evaluate(() => [window.name.slice(0, 9), typeof window.history.state?.decklet]);
  assert.deepEqual(copies, ['decklet:{', 'string'], 'window.name and history.state both carry the copy');
  assert.equal(await p.evaluate(() => { const e = new Event('beforeunload', {cancelable: true}); dispatchEvent(e); return e.defaultPrevented; }), bn !== 'embedded', 'unsaved edits: the page asks before it goes (the embedded pane ignores beforeunload, which is fine)');
  await p.reload(); assert.equal(await settled(p), 'tab');
  assert.deepEqual([await text0(p), await p.evaluate(() => log.length)], ['Kept in the tab', 1], 'the reload restored the edit and its log entry from window.name');
  assert.notEqual((await ui()).banner, null, 'the banner shows until it is dismissed');
  await p.click('#nosave button'); assert.equal((await ui()).banner, null);
  await p.reload(); await settled(p);
  assert.equal((await ui()).banner, null, 'dismissed once, stays dismissed in this tab');

  // window.name gone (another page overwrote it): history.state still carries this deck
  await p.evaluate(() => { window.name = ''; }); await p.reload(); await settled(p);
  assert.equal(await text0(p), 'Kept in the tab', 'restored from history.state');

  // a window.name another deck left is ignored, and so is a copy with no deck id
  await p.evaluate(() => { const other = JSON.parse(window.history.state.decklet); window.name = 'decklet:' + JSON.stringify({...other, id: 'decklet:someone-else'}); window.history.replaceState(null, ''); });
  await p.reload(); await settled(p);
  assert.deepEqual([await text0(p), await p.evaluate(() => log.length)], ['One', 0], 'not this deck\'s copy: the file as built');
  await p.evaluate(() => { snap(); deck.slides[0].els[0].text = 'Deck A edit'; save(); });
  await p.goto(pathToFileURL(g).href); await settled(p);
  assert.deepEqual([await text0(p), await p.evaluate(() => log.length)], ['Other one', 0], 'a different deck in the same tab ignores deck A\'s window.name');
  assert.equal(await p.evaluate(() => { const e = new Event('beforeunload', {cancelable: true}); dispatchEvent(e); return e.defaultPrevented; }), false, 'nothing unsaved here: no prompt');
  assert.deepEqual(p.errs, []);
}, {timeout: 60000}));

// durable store: the route says so and never asks before leaving
for (const bn of projects()) live(`store route (${bn}): localStorage works on file:// — route store whether or not File System Access exists, no banner, no prompt, the edit survives a reload`, async () => withProject(pw, bn, async ({context}) => { const f = write(`store-${bn}.html`, create(model()).html);
  const p = watch(await (await context()).newPage()); await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload();
  assert.equal(await settled(p), 'ok');
  await p.evaluate(() => { snap(); deck.slides[0].els[0].text = 'Stored'; save(); });
  assert.deepEqual(await p.evaluate(() => { const e = new Event('beforeunload', {cancelable: true}); dispatchEvent(e); return [route(), $('nosave').hidden, e.defaultPrevented, window.name]; }), ['store', true, false, ''], 'durable: no tab copy, no banner, no prompt');
  assert.equal(await p.evaluate(() => 'showOpenFilePicker' in window), bn === 'chromium', 'the capability differs by project (only desktop Chromium has File System Access); the route does not, because no file is linked');
  await p.reload(); await settled(p);
  assert.equal(await text0(p), 'Stored', 'no edit lost on reload');
  assert.deepEqual(p.errs, []);
}, {timeout: 60000}));

// localStorage that stops taking writes (a full quota): the edit goes to the tab copy, and the next load puts it back in the store
for (const bn of projects()) live(`store full (${bn}): a write localStorage refuses lands on the tab copy; the reload restores it into localStorage and drops the copy`, async () => withProject(pw, bn, async ({context}) => {
  const f = write(`full-${bn}.html`, create(model()).html);
  const p = watch(await (await context()).newPage()); await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload();
  assert.equal(await settled(p), 'ok');
  await p.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); }; snap(); deck.slides[0].els[0].text = 'Past the quota'; save(); });
  await p.waitForFunction(() => document.getElementById('autosave').dataset.state === 'tab');
  assert.equal(await p.evaluate(() => window.name.startsWith('decklet:{')), true);
  await p.reload(); await settled(p);
  assert.deepEqual(await p.evaluate(() => [deck.slides[0].els[0].text, JSON.parse(localStorage.getItem(KEY)).slides[0].els[0].text, window.name, route()]), ['Past the quota', 'Past the quota', '', 'store']);
  assert.deepEqual(p.errs, []);
}, {timeout: 60000}));

// file handle: File System Access mocked; the mock file changes under the page the way an agent's create --from would
const fsaMock = () => {
  window.__writes = []; window.__file = {text: '', lastModified: 1000};
  const h = {kind: 'file', name: 'deck.html', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    getFile: async () => { const f = window.__file; return {lastModified: f.lastModified, text: async () => f.text}; },
    createWritable: async () => { let buf = ''; return {write: async s => { buf += s; }, close: async () => { window.__writes.push(buf); window.__file = {text: buf, lastModified: window.__file.lastModified + 1}; }}; }};
  window.showOpenFilePicker = async () => [h];
};
live('file route (chromium): the file changed on disk since the last write → no stale write; the page reads it, rebases, and writes both edits', async () => withBrowser(pw.chromium, async b => { const html = create(model()).html, f = write('fsa.html', html);
  const ctx = await b.newContext(); await ctx.addInitScript(fsaMock);
  const p = watch(await ctx.newPage()); await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload(); await settled(p);
  await p.evaluate(h => { window.__file = {text: h, lastModified: 1000}; }, html);
  await p.click('#autosave'); await p.waitForFunction(() => window.__writes.length === 1);
  assert.equal(await p.evaluate(() => route()), 'file');
  await p.evaluate(() => { snap(); deck.slides[0].els[0].text = 'Human edit'; save(); });
  await p.waitForFunction(() => window.__writes.length === 2, null, {timeout: 3000});

  // the agent rebuilds from the file as the page last wrote it, changing slide 2
  const g = write('fsa-agent-base.html', await p.evaluate(() => window.__writes.at(-1)));
  const agent = create(model('One', 'Two, by the agent'), {from: g}).html;
  assert.equal(blockOf(agent, 'DECK').slides[0].els[0].text, 'Human edit', 'fixture: create --from replayed the human edit');
  await p.evaluate(h => { window.__file = {text: h, lastModified: window.__file.lastModified + 5000}; }, agent);

  await p.evaluate(() => { snap(); deck.slides[0].els[0].text = 'Human edit two'; save(); });
  await p.waitForFunction(() => window.__writes.length === 3, null, {timeout: 3000});
  await p.waitForTimeout(1200);
  const w = await p.evaluate(() => window.__writes);
  assert.equal(w.length, 3, 'one write for the edit, and it was the merged file');
  assert.deepEqual(blockOf(w[2], 'DECK').slides.map(s => s.els[0].text), ['Human edit two', 'Two, by the agent'], 'the write carries the agent\'s change and the human\'s');
  assert.equal(blockOf(w[2], 'DECK').rev, blockOf(agent, 'DECK').rev, 'written on top of the agent\'s version');
  assert.deepEqual(await p.evaluate(() => deck.slides.map(s => s.els[0].text)), ['Human edit two', 'Two, by the agent'], 'the page shows both');
  assert.equal(await p.evaluate(() => document.getElementById('autosave').dataset.state), 'ok');
  assert.deepEqual(p.errs, []);
}, {timeout: 60000}));

test.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
