// decklet saved dot: a green dot on the save button's corner says "autosave is on and the file has every edit". It shows only
// on a route that writes the file (the host, or a File System Access handle) and only while nothing is pending: no unsaved
// edit, no write in flight, no rebase, no agent lease. The moment an edit registers it goes (the capture drop plays, the state
// turns busy/local) and it comes back when the write is confirmed. The store route (edits in this browser only) and the tab
// route never show it. Kyle's UAT request, v0.14.0. Live in every project of the browser matrix (test/helpers/projects.mjs).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {withBrowser} from './helpers/browser.mjs';
import {projects, withProject} from './helpers/projects.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tpl = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-saved-dot-'));
const model = () => ({w: 960, h: 540, title: 'dot', slides: [{els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}]}, {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Two'}]}]});
const write = (name) => { const f = path.join(tmp, name); fs.writeFileSync(f, create(model()).html); return f; };
async function start(file) {
  const child = spawn(process.execPath, [path.join(root, 'bin', 'serve.mjs'), file], {stdio: ['ignore', 'pipe', 'inherit']});
  const line = await new Promise(ok => { let out = ''; child.stdout.on('data', c => { out += c; if (out.includes('\n')) ok(out.trim()); }); });
  return {child, origin: line.replace(/\/$/, '')};
}
// the dot as the page shows it: the attribute tests read, whether the element paints, and the tooltip
const dot = p => p.evaluate(() => { const a = document.getElementById('autosave'), d = a.querySelector('.fok');
  return {saved: a.dataset.saved || null, shown: !!d && getComputedStyle(d).display !== 'none', state: a.dataset.state, tip: a.dataset.tip, route: route()}; });
const edit = (p, text) => p.evaluate(t => { snap(); deck.slides[0].els[0].text = t; save(); render(); }, text);
const refuse = () => { for (const k of ['localStorage', 'indexedDB']) Object.defineProperty(window, k, {get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }}); };

test('saved dot: its own element in the corner, green with a ring in the HUD background, never the badge slot', () => {
  assert.match(tpl, /<i class="drop" aria-hidden="true"><\/i><i class="fok" aria-hidden="true"><\/i>/, 'a separate element beside the capture drop');
  assert.match(tpl, /#autosave \.fok\{display:none;position:absolute;[^}]*width:7px;height:7px;border-radius:50%;background:#3fb950;box-shadow:0 0 0 2px var\(--card\)/, '7px, #3fb950, a 2px ring in the HUD button background');
  assert.match(tpl, /#autosave\[data-saved=file\] \.fok\{display:block\}/, 'shown only through data-saved');
  assert.doesNotMatch(tpl, /savebad[^;]*3fb950/, 'the badge slot keeps amber and red');
});

for (const bn of projects()) live(`saved dot (${bn}): hosted, green after load, gone while an edit is pending or an agent holds the lease, back once the host confirms`, async () => {
  const dir = path.join(tmp, 'host-' + bn); fs.mkdirSync(dir); const f = path.join(dir, 'deck.html'); fs.writeFileSync(f, create(model()).html);
  const s = await start(f);
  try { await withProject(pw, bn, async ({context}) => { const ctx = await context();
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(s.origin + '/');
    await p.waitForFunction(() => typeof HOST !== 'undefined' && HOST && HOST.on && document.getElementById('autosave').dataset.state === 'ok', null, {timeout: 4000});
    const d0 = await dot(p);
    assert.deepEqual([d0.route, d0.saved, d0.shown], ['host', 'file', true], 'green after load: the host has the file and nothing is pending');
    assert.match(d0.tip, /^Saved to deck\.html · \d\d:\d\d:\d\d$/);
    let release, caught; const held = new Promise(r => { release = r; }), put = new Promise(r => { caught = r; });
    await p.route('**/__decklet/file', async route => { caught(); await held; await route.continue(); });
    await edit(p, 'Edited');
    const d1 = await dot(p);
    assert.deepEqual([d1.saved, d1.shown], [null, false], 'gone the moment the edit registers');
    await put;
    const d2 = await dot(p);
    assert.deepEqual([d2.state, d2.saved, d2.shown], ['busy', null, false], 'absent while the write is in flight');
    release();
    await p.waitForFunction(() => document.getElementById('autosave').dataset.saved === 'file', null, {timeout: 3000});
    const d3 = await dot(p);
    assert.deepEqual([d3.state, d3.shown], ['ok', true], 'back once the host confirms');
    assert.match(d3.tip, /^Saved to deck\.html · \d\d:\d\d:\d\d$/);
    await p.unroute('**/__decklet/file');
    await p.evaluate(() => setLease({by: 'Claude', since: Date.now(), until: Date.now() + 9e5}));
    assert.deepEqual((await dot(p)).shown, false, 'an agent lease: no green');
    await p.evaluate(() => setLease(null));
    assert.deepEqual((await dot(p)).shown, true, 'checkin with nothing pending: green again');
    assert.deepEqual(errs, []);
  }, {timeout: 60000}); } finally { await new Promise(r => { s.child.on('exit', r); s.child.kill('SIGTERM'); }); }
});

for (const bn of projects()) live(`saved dot (${bn}): no host and no file handle, never green; the store tooltip says where the edits live and the way to the file`, async () => withProject(pw, bn, async ({context}) => {
  const name = `store-${bn}.html`, f = write(name);
  const ctx = await context(); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForFunction(() => document.getElementById('autosave').dataset.state !== 'busy', null, {timeout: 4000});
  const d0 = await dot(p);
  assert.ok(['store', 'tab'].includes(d0.route), d0.route);
  assert.deepEqual([d0.saved, d0.shown], [null, false], 'no file is written, so no green');
  if (d0.route === 'store') {
    const fsa = await p.evaluate(() => FSA);
    assert.match(d0.tip, fsa ? /^Saved in this browser only · \d\d:\d\d:\d\d · ⌘S links the file$/ : new RegExp(`^Saved in this browser only · \\d\\d:\\d\\d:\\d\\d · host it: node bin/serve\\.mjs ${name.replace('.', '\\.')}$`));
  }
  await edit(p, 'Edited'); await p.waitForTimeout(400);
  assert.deepEqual((await dot(p)).shown, false, 'an edit kept in this browser: still no green');
  assert.deepEqual(errs, []);
}));

for (const bn of projects()) live(`saved dot (${bn}): the tab route keeps its amber Not saving pill and never shows green`, async () => withProject(pw, bn, async ({context}) => {
  const f = write(`tab-${bn}.html`);
  const ctx = await context(); await ctx.addInitScript(refuse); const p = await ctx.newPage();
  await p.goto(pathToFileURL(f).href); await p.waitForFunction(() => document.getElementById('autosave').dataset.state !== 'busy', null, {timeout: 4000});
  const d0 = await dot(p);
  assert.deepEqual([d0.route, d0.state, d0.saved, d0.shown], ['tab', 'tab', null, false]);
  await edit(p, 'Edited'); await p.waitForTimeout(400);
  assert.deepEqual((await dot(p)).shown, false);
}));

live('saved dot (chromium): the file-handle route goes green once the file is written, and its tooltip names the file', async () => withBrowser(pw.chromium, async (b) => {
  const f = write('handle.html');
  const ctx = await b.newContext(); await ctx.addInitScript(() => {
    window.__writes = []; let mod = 1; const h = {kind: 'file', name: 'handle.html', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      getFile: async () => ({lastModified: mod, text: async () => window.__writes.at(-1) || document.documentElement.outerHTML}),
      createWritable: async () => ({write: async s => { window.__writes.push(s); }, close: async () => { mod++; }})};
    window.showOpenFilePicker = async () => [h];
  });
  const p = await ctx.newPage(); await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => document.getElementById('autosave').dataset.state !== 'busy');
  assert.equal((await dot(p)).shown, false, 'not linked yet: the store route');
  await p.click('#autosave'); await p.waitForFunction(() => document.getElementById('autosave').dataset.saved === 'file', null, {timeout: 3000});
  const d0 = await dot(p);
  assert.deepEqual([d0.route, d0.state, d0.shown], ['file', 'ok', true]);
  assert.match(d0.tip, /^Saved to handle\.html · \d\d:\d\d:\d\d$/, 'the file-handle route names the file the way the host route does');
  await edit(p, 'Edited');
  assert.equal((await dot(p)).shown, false, 'pending: gone');
  await p.waitForFunction(() => document.getElementById('autosave').dataset.saved === 'file', null, {timeout: 3000});
  assert.equal(await p.evaluate(() => unsynced), 0);
}));

test.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
