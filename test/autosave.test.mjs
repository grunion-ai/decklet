// decklet autosave — 0.9.0: the version history left the file (it lives in weave now); what stays is a deck that saves itself,
// everywhere. Static gates on the template, then live proofs (Playwright, skipped when absent): continuous write-back with no
// ⌘S, the storage tier chain (localStorage → IndexedDB → memory) in Chromium and WebKit, and two windows of one browser converging.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import http from 'node:http';
import {create} from '../bin/create.mjs';
import {blockOf, hasBlock} from '../lib/edits.mjs';
import {edits} from '../bin/edits.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tpl = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-autosave-'));
const model = () => ({w: 960, h: 540, title: 'probe', slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}, {x: 60, y: 200, w: 400, role: 'Body', text: 'body one'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Two'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Three'}]},
]});
const write = (name, html) => { const f = path.join(tmp, name); fs.writeFileSync(f, html); return f; };
const watch = p => { p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') p.errs.push('console: ' + m.text()); }); return p; };
// the dot settles once the store has answered: at once on localStorage, after the IndexedDB read (or its 2 s timeout) without it
const settled = async p => { await p.waitForFunction(() => document.getElementById('autosave').dataset.state !== 'busy', null, {timeout: 4000}); return p.evaluate(() => document.getElementById('autosave').dataset.state); };
const until = (p, fn, ms = 2000) => p.waitForFunction(fn, null, {timeout: ms});

// ── static: the shape of the file ──
test('0.9.0: no version history in the file — no VERSIONS marker, no history control; the save button is its own HUD button', () => {
  assert.ok(!tpl.includes('/*VERSIONS*/'), 'the VERSIONS marker is gone');
  assert.ok(!/id="vers"|#versmenu|versRender|function pin\(|function restore\(/.test(tpl), 'no history popover, pin or restore');
  assert.match(tpl, /<button id="autosave" class="mi mi-save" data-ms="\d+" data-state="ok" data-tip="[^"]+" aria-label="[^"]+"><svg [^]*?<\/svg><span id="savebad" role="status" hidden><\/span><\/button>/, 'save is a HUD button wearing the save glyph and its state badge');
  assert.ok(tpl.indexOf('id="autosave"') < tpl.indexOf('id="addbtn"') && tpl.indexOf('class="spacer"') < tpl.indexOf('id="autosave"'), 'save state leads the right-hand cluster');
  assert.match(tpl, /\$\('autosave'\)\.onclick=saveFile/, 'a tap on the dot is the ⌘S door (a phone has no ⌘)');
  assert.doesNotMatch(tpl, /pin\('⌘S'\)/, '⌘S pins nothing');
  assert.ok(tpl.includes('then every edit writes itself'), 'the ⓘ popover says the file writes itself');
});

test('write-back is continuous: every save schedules a trailing debounced write (WB=800); ⌘S, a hidden tab and pagehide flush it now', () => {
  assert.match(tpl, /const WB=800;/);
  assert.match(tpl, /if\(fileH\)\{clearTimeout\(wbT\);wbT=setTimeout\(writeBack,WB\)\}/, 'save() arms the debounce');
  assert.match(tpl, /const flush=\(\)=>\{if\(fileH&&wbT\)\{clearTimeout\(wbT\);wbT=null;writeBack\(\)\}\}/);
  assert.match(tpl, /addEventListener\('pagehide',\(\)=>\{commitEdit\(\);[^\n]*flush\(\)\}\)/, 'pagehide flushes');
  assert.match(tpl, /visibilitychange',\(\)=>\{if\(document\.hidden\)\{commitEdit\(\);flush\(\)\}\}/, 'a hidden tab flushes');
  assert.match(tpl, /async function writeBack\(\)\{\n  clearTimeout\(wbT\);wbT=null;/, 'a write clears the pending one');
});

test('storage is a tier chain — localStorage → IndexedDB → memory — and sync listens on storage + BroadcastChannel and never writes on receive', () => {
  assert.match(tpl, /const LS=\(\(\)=>\{try\{localStorage\.setItem\('decklet:probe','1'\)/, 'localStorage is probed once');
  assert.match(tpl, /let TIER=LS\?'local':'mem';/); assert.match(tpl, /indexedDB\.open\('decklet',2\)/, 'one db, bumped to v2 for the kv store');
  assert.match(tpl, /for\(const s of \['h','kv'\]\)if\(!r\.result\.objectStoreNames\.contains\(s\)\)r\.result\.createObjectStore\(s\)/, 'the handle store and the kv store');
  assert.match(tpl, /async function idbLoad\(\)/); assert.match(tpl, /if\(LS\)settle\(\);else\{autosave\('busy','Loading…'\);idbLoad\(\)\.then\(settle\)\}/, 'the deck draws from DECK first, the IndexedDB copy lands after');
  assert.match(tpl, /new BroadcastChannel\(NS\)/); assert.match(tpl, /addEventListener\('storage',e=>\{if\(e\.key===KEY\)receive/);
  const recv = tpl.slice(tpl.indexOf('function receive(m){'), tpl.indexOf('const slide=()=>'));
  assert.ok(!/store\.set\(|LS\.setItem|localStorage\.setItem|tell\(/.test(recv), 'receive() writes nothing and tells no one: ' + recv);
  assert.match(recv, /commitEdit\(\)/, 'an edit in flight is committed on top of what was heard');
  assert.doesNotMatch(tpl, /CANSTORE/, 'the old one-shot probe is gone');
});

test('create --from reads past the VERSIONS block a 0.5–0.8 file carries; the new file has none; edits --json has no versions', () => {
  const v1 = create(model(), {});
  const old = v1.html.replace(/(const LOG0=\/\*LOG\*\/\[\]\/\*\/LOG\*\/;)/, `$1const VERS0=/*VERSIONS*/${JSON.stringify([{rev: 'r0', t: 't', by: 'agent', label: 'before', deck: v1.deck}])}/*/VERSIONS*/;`);
  assert.ok(hasBlock(old, 'VERSIONS'), 'fixture: an older file with a history block');
  const f = write('old.html', old);
  const m2 = model(); m2.slides[0].els[1].w = 500;
  const v2 = create(m2, {from: f});
  assert.equal(v2.deck.id, v1.deck.id, 'id inherited'); assert.equal(v2.deck.slides[0].els[1].w, 500);
  assert.ok(!hasBlock(v2.html, 'VERSIONS'), 'the history is not carried'); assert.deepEqual(blockOf(v2.html, 'LOG'), []);
  assert.deepEqual(Object.keys(edits(v2.html)).sort(), ['id', 'log', 'rev', 'title']);
  assert.throws(() => blockOf(v2.html, 'VERSIONS'), {message: 'marker VERSIONS missing'});
});

// ── live ──
const fsaInit = () => { // File System Access, mocked: a granted handle whose writes land in window.__writes
  window.__writes = []; const h = {kind: 'file', name: 'wb.html', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    createWritable: async () => ({write: async s => { window.__writes.push(s); }, close: async () => {}})};
  window.showOpenFilePicker = async () => [h];
};
live('continuous write-back: the dot links the file once; a burst of edits is ONE write ~800 ms later, no ⌘S; a hidden tab writes at once', async () => {
  const b = await pw.chromium.launch(); const f = write('wb.html', create(model()).html);
  const ctx = await b.newContext(); await ctx.addInitScript(fsaInit);
  const p = watch(await ctx.newPage()); await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload(); await settled(p);
  await p.click('#autosave'); await p.waitForTimeout(200); // the dot is the ⌘S door: links the file and writes it
  assert.equal(await p.evaluate(() => window.__writes.length), 1, 'the first press wrote the file');
  await p.evaluate(() => { snap(); slide().els[1].x = 100; save(); slide().els[1].x = 110; save(); slide().els[1].x = 120; save(); });
  await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.__writes.length), 1, 'nothing yet: the write is debounced');
  assert.equal(await p.evaluate(() => document.getElementById('autosave').dataset.state), 'local', 'amber while the write is pending');
  await p.waitForTimeout(900);
  assert.equal(await p.evaluate(() => window.__writes.length), 2, 'one write for the burst');
  assert.equal(blockOf(await p.evaluate(() => window.__writes.at(-1)), 'DECK').slides[0].els[1].x, 120, 'the file carries the last value');
  assert.equal(await p.evaluate(() => [document.getElementById('autosave').dataset.state, unsynced].join()), 'ok,0', 'green: the file has everything');
  assert.match(await p.getAttribute('#autosave', 'data-tip'), /^Saved to file · \d\d:\d\d:\d\d$/);
  // a tab going to the background does not wait out the debounce
  await p.evaluate(() => { snap(); slide().els[1].y = 250; save(); Object.defineProperty(document, 'hidden', {get: () => true, configurable: true}); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => window.__writes.length), 3, 'hidden → flushed now');
  assert.equal(blockOf(await p.evaluate(() => window.__writes.at(-1)), 'DECK').slides[0].els[1].y, 250);
  assert.ok(!(await p.evaluate(() => window.__writes.at(-1))).includes('/*VERSIONS*/'), 'the written file carries no history block');
  assert.deepEqual(p.errs, []); await b.close();
});

for (const bn of ['chromium', 'webkit']) live(`storage tier 2 (${bn}): localStorage refused, IndexedDB open — edits persist across a reload, the dot is never red`, async () => {
  const b = await pw[bn].launch(); const f = write(`idb-${bn}.html`, create(model()).html);
  const ctx = await b.newContext(); await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', {get() { throw new Error('blocked'); }}); });
  const p = watch(await ctx.newPage()); await p.goto(pathToFileURL(f).href);
  assert.equal(await settled(p), 'ok', 'green once the IndexedDB copy is in');
  assert.deepEqual(await p.evaluate(() => [TIER, document.body.classList.contains('nostore')]), ['idb', false]);
  await p.evaluate(() => { snap(); slide().els[1].x = 321; save(); nav(1); });
  await p.waitForTimeout(200);
  await p.reload(); assert.equal(await settled(p), 'local', 'amber: saved here, not yet in a file');
  assert.deepEqual(await p.evaluate(() => [deck.slides[0].els[1].x, log.length, TIER, i]), [321, 1, 'idb', 1], 'the edit and its log entry came back from IndexedDB; the slide too (sessionStorage)');
  assert.deepEqual(p.errs, []); await b.close();
});

live('storage tier 3 (webkit): nothing persists (Safari on file://) — red at load, Save a copy shows, edits hold for the session, no errors', async () => {
  const b = await pw.webkit.launch(); const f = write('mem.html', create(model()).html);
  const ctx = await b.newContext(); await ctx.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {get() { throw new Error('blocked'); }});
    Object.defineProperty(window, 'indexedDB', {get() { throw new Error('blocked'); }});
  });
  const p = watch(await ctx.newPage()); await p.goto(pathToFileURL(f).href);
  assert.equal(await settled(p), 'bad', 'red: nothing persists');
  assert.deepEqual(await p.evaluate(() => [TIER, document.body.classList.contains('nostore'), !$('savebad').hidden]), ['mem', true, true], 'the save button wears its red ! — the copy door is that button');
  assert.match(await p.getAttribute('#autosave', 'aria-label'), /blocks storage for local files/, 'the full sentence names the cause and the way out');
  await p.evaluate(() => { snap(); slide().els[1].x = 7; save(); nav(1); nav(-1); });
  assert.equal(await p.evaluate(() => slide().els[1].x), 7, 'edits still hold in memory for the session');
  assert.deepEqual(p.errs, []); await b.close();
});

// two windows share storage only on one origin: served over http (WebKit hands every file:// load its own origin, so neither a storage event nor a channel crosses windows there)
const served = create(model()).html, server = http.createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(served); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); test.after(() => server.close());
for (const bn of ['chromium', 'webkit']) live(`two windows (${bn}): an edit in one shows in the other with no reload, the reader writes nothing, logs converge; an edit in flight lands on top`, async () => {
  const b = await pw[bn].launch(); const url = `http://127.0.0.1:${server.address().port}/sync.html`; const ctx = await b.newContext();
  const A = watch(await ctx.newPage()); await A.goto(url); await A.evaluate(() => localStorage.clear()); await A.reload(); await settled(A);
  const B = watch(await ctx.newPage()); await B.goto(url); await settled(B);
  await B.evaluate(() => { window.__sets = 0; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (...a) { if (this === localStorage) window.__sets++; return o.apply(this, a); }; });
  await B.evaluate(() => nav(1)); // B sits on slide 2: its position is its own
  await A.evaluate(() => { snap(); slide().els[1].x = 123; save(); });
  await until(B, () => deck.slides[0].els[1].x === 123);
  assert.deepEqual(await B.evaluate(() => [log.length, window.__sets, i, document.getElementById('autosave').dataset.state]), [1, 0, 1, 'local'], 'B heard it, wrote nothing, kept its slide');
  assert.equal(await A.evaluate(() => log.length), 1, 'no echo: A\'s log did not grow');
  assert.equal(JSON.parse(await A.evaluate(() => localStorage.getItem(LKEY))).length, 1, 'one entry in the store');
  // B is typing when A saves again: A's model lands, B's words land on top of it, and both windows end on the same deck
  await B.evaluate(() => { nav(-1); sel.clear(); sel.add(0); render(); edit(0); }); await B.keyboard.type('typed in B'); // edit() selects the row's text: typing replaces it
  await A.evaluate(() => { snap(); slide().els[1].y = 250; save(); });
  await until(B, () => deck.slides[0].els[1].y === 250);
  assert.deepEqual(await B.evaluate(() => [slide().els[0].text, slide().els[1].x, slide().els[1].y]), ['typed in B', 123, 250], 'B: its words on A\'s geometry');
  await until(A, () => deck.slides[0].els[0].text === 'typed in B');
  assert.deepEqual(await A.evaluate(() => [slide().els[1].x, slide().els[1].y, log.length]), [123, 250, 3], 'A converged; three entries, every one of them once');
  assert.deepEqual(await B.evaluate(() => [log.length, canvas.querySelector('.el[contenteditable="true"]')]), [3, null], 'B: same log, the edit committed');
  assert.deepEqual(JSON.parse(await A.evaluate(() => localStorage.getItem(KEY))).slides[0].els.map(e => [e.text, e.x, e.y]).slice(0, 2), [['typed in B', 60, 80], ['body one', 123, 250]], 'the store has both windows\' edits');
  assert.deepEqual([...A.errs, ...B.errs], []); await b.close();
});
