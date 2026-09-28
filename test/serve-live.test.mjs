// decklet serve, live: the page against a real `node bin/serve.mjs` child, in every project of the browser matrix (Chromium,
// WebKit, Firefox and the embedded Chromium pane: test/helpers/projects.mjs; Safari and the panes have no File System Access,
// which is the reason the host exists). An edit reaches the file within 2 s; a reload mid-edit and a closed window keep
// the edit (the store is the journal, re-sent on the next open); an agent's `create --from` landing while the page holds an
// unacknowledged edit ends with both changes in the file and a history copy; the dot plays `cap` on the edit and settles on ok.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {create} from '../bin/create.mjs';
import {blockOf} from '../lib/edits.mjs';
import {serve} from '../bin/serve.mjs';
import {loadChecker} from '../lib/spell.mjs';
import {projects, withProject} from './helpers/projects.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-serve-live-'));
const model = (two = 'Two') => ({w: 960, h: 540, title: 'hosted', slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: two}]},
]});
async function start(file) {
  const child = spawn(process.execPath, [path.join(root, 'bin', 'serve.mjs'), file], {stdio: ['ignore', 'pipe', 'inherit']});
  const line = await new Promise(ok => { let out = ''; child.stdout.on('data', c => { out += c; if (out.includes('\n')) ok(out.trim()); }); });
  return {child, origin: line.replace(/\/$/, '')};
}
const disk = f => blockOf(fs.readFileSync(f, 'utf8'), 'DECK');
async function diskHas(f, pred, ms = 2000) {
  const t0 = Date.now(); for (;;) { try { if (pred(disk(f))) return Date.now() - t0; } catch {} if (Date.now() - t0 > ms) assert.fail('file never took the edit: ' + JSON.stringify(disk(f).slides.map(s => s.els[0].text))); await new Promise(r => setTimeout(r, 50)); }
}
const hostOn = p => p.waitForFunction(() => typeof HOST !== 'undefined' && HOST && HOST.on, null, {timeout: 4000});
const editRow = (p, n, text) => p.evaluate(([n, text]) => { snap(); deck.slides[n].els[0].text = text; save(); return document.getElementById('autosave').classList.contains('cap'); }, [n, text]);
const texts = p => p.evaluate(() => deck.slides.map(s => s.els[0].text));

for (const engine of projects()) live(`${engine}: hosted deck, edits reach the file, survive reload and close, and ride on top of an agent rebuild`, async () => {
  const dir = path.join(tmp, engine); fs.mkdirSync(dir); const f = path.join(dir, 'deck.html'); fs.writeFileSync(f, create(model()).html);
  const s = await start(f);
  try { await withProject(pw, engine, async ({context}) => { const ctx = await context();
    let p = await ctx.newPage(); await p.goto(s.origin + '/'); await hostOn(p);
    assert.equal(await p.evaluate(() => route()), 'host', 'served: the host route, whatever the browser can or cannot do');
    assert.equal(await p.evaluate(() => !!document.querySelector('meta[name="decklet-host"]')), false, 'the page takes the token and drops the meta, so no copy ever carries it');
    await new Promise(r => setTimeout(r, 1000));
    assert.equal(fs.existsSync(path.join(dir, '.decklet-history')), false, 'opening the deck writes nothing');

    // an edit: the capture plays, the file has it within 2 s, the dot settles on ok and names the file
    assert.equal(await editRow(p, 0, 'Edit one'), true, 'cap plays on the registered edit');
    await diskHas(f, d => d.slides[0].els[0].text === 'Edit one');
    await p.waitForFunction(() => { const a = document.getElementById('autosave'); return a.dataset.state === 'ok' && !a.classList.contains('cap'); }, null, {timeout: 2000});
    assert.match(await p.evaluate(() => document.getElementById('autosave').getAttribute('aria-label')), /^Saved to deck\.html · \d\d:\d\d:\d\d$/);
    assert.equal(blockOf(fs.readFileSync(f, 'utf8'), 'LOG').filter(e => !e.rev).length, 0, 'the file stamps every entry it carries');

    // the file the page would write and the file the host spliced agree on the script, byte for byte
    const pageScript = await p.evaluate(() => { const h = fileHtml(); return h.slice(h.lastIndexOf('<script>'), h.lastIndexOf('</' + 'script>')); });
    const diskHtml = fs.readFileSync(f, 'utf8');
    assert.equal(pageScript, diskHtml.slice(diskHtml.lastIndexOf('<script>'), diskHtml.lastIndexOf('</' + 'script>')));

    // reload mid-edit (before the write-back debounce): the edit is on screen after the reload and in the file after it
    await editRow(p, 0, 'Edit two'); await p.reload(); await hostOn(p);
    assert.equal((await texts(p))[0], 'Edit two');
    await diskHas(f, d => d.slides[0].els[0].text === 'Edit two');

    // close the window right after an edit: on disk already, or re-sent on the next open
    await editRow(p, 0, 'Edit three'); await p.close();
    p = await ctx.newPage(); await p.goto(s.origin + '/'); await hostOn(p);
    await diskHas(f, d => d.slides[0].els[0].text === 'Edit three');

    // the agent rebuilds (create --from, a different row) while the page holds an unacknowledged edit: the first PUT is held
    // until the agent's file is on disk, so it meets a 412; the page takes the agent's version, replays its edit, PUTs again.
    // Idle first: the reopened page re-sends its journal on open, and a re-send caught by the route would be the held PUT.
    await p.waitForFunction(() => !writing && !unsynced, null, {timeout: 3000});
    let release, first = true, caught; const held = new Promise(r => { release = r; }), put = new Promise(r => { caught = r; });
    await p.route('**/__decklet/file', async route => { if (first) { first = false; caught(); await held; } await route.continue(); });
    await editRow(p, 0, 'Edit four');
    await put;
    assert.deepEqual(await p.evaluate(() => [document.getElementById('autosave').dataset.state, writing]), ['busy', true], 'one write in flight: the flag is up and the button pulses until it answers');
    await editRow(p, 1, 'Two, typed during the write');
    await new Promise(r => setTimeout(r, 1000));
    assert.equal(await p.evaluate(() => wq), 1, 'an edit during the write queues one more write instead of starting a second PUT');
    await editRow(p, 1, 'Two');
    const hist0 = fs.existsSync(path.join(dir, '.decklet-history')) ? fs.readdirSync(path.join(dir, '.decklet-history')).length : 0;
    fs.writeFileSync(f, create(model('Two, by the agent'), {from: f}).html);
    const agentRev = disk(f).rev;
    release();
    await diskHas(f, d => d.slides[0].els[0].text === 'Edit four' && d.slides[1].els[0].text === 'Two, by the agent', 4000);
    assert.equal(disk(f).rev, agentRev, 'the page wrote on top of the agent\'s version');
    assert.deepEqual(await texts(p), ['Edit four', 'Two, by the agent'], 'the page shows both');
    assert.ok(fs.readdirSync(path.join(dir, '.decklet-history')).length > hist0, 'the agent\'s file went to history before the page wrote over it');
    await p.waitForFunction(() => document.getElementById('autosave').dataset.state === 'ok', null, {timeout: 2000});

    // no edit pending: an agent write simply shows up (SSE), and the page writes nothing back
    await p.unroute('**/__decklet/file');
    const hist1 = fs.readdirSync(path.join(dir, '.decklet-history')).length;
    fs.writeFileSync(f, create(model('Two, again'), {from: f}).html);
    await p.waitForFunction(() => deck.slides[1].els[0].text === 'Two, again', null, {timeout: 3000});
    assert.equal((await texts(p))[0], 'Edit four', 'the human edit rides along (create --from replayed it)');
    await new Promise(r => setTimeout(r, 1200));
    assert.equal(fs.readdirSync(path.join(dir, '.decklet-history')).length, hist1, 'nothing written back');
  }, {timeout: 90000}); } finally { await new Promise(r => { s.child.on('exit', r); s.child.kill('SIGTERM'); }); }
});

// ── issue 86: a word typed after the build reaches the badge, the wash, the thumbnails and the panel. The page asks
// bin/serve.mjs about the words of a row when the edit commits (debounced, never per keystroke); the server runs the build's
// own lib/spell.mjs; the answer merges into the set the editor already paints, and the next PUT writes it into the file.
// timeouts: the server loads the dictionary on the probe (about 3 s) and nspell's suggest() can take a second for one word
const TIP = ' · words from the last build only; a deck served by bin/serve.mjs also checks what you type';
const spellState = p => p.evaluate(() => ({
  badge: $('spellbad').hidden ? null : +$('spellbad').textContent,
  marks: [...(CSS.highlights.get('spell') || [])].map(r => r.toString()).sort(),
  tip: $('spell').dataset.tip,
}));
const typeInto = async (p, n, text) => { await p.evaluate(n => { commitEdit(); sel.clear(); sel.add(n); render(); edit(n); }, n); await p.keyboard.type(text); };
for (const engine of projects()) live(`${engine}: a served deck checks the words typed into a row — badge, wash, thumbnails, panel with suggestions — and they clear when the word is fixed`, async () => {
  if (!await loadChecker('en')) return; // the dictionary is an optional peer; its absence is proved below
  const dir = path.join(tmp, 'spell-' + engine); fs.mkdirSync(dir); const f = path.join(dir, 'deck.html'); fs.writeFileSync(f, create(model()).html);
  const s = await start(f);
  try { await withProject(pw, engine, async ({context}) => { const ctx = await context();
    const p = await ctx.newPage(); const asked = [], errs = []; p.on('pageerror', e => errs.push(String(e)));
    p.on('request', r => { if (r.url().endsWith('/__decklet/spell')) asked.push(JSON.parse(r.postData()).words); });
    await p.goto(s.origin + '/'); await hostOn(p);
    await p.waitForFunction(() => SPELLON, null, {timeout: 15000});
    assert.deepEqual(asked, [[]], 'the editor finds the checker by a probe of the endpoint');
    assert.equal((await spellState(p)).tip, 'Spellcheck · on', 'a served deck with a dictionary makes no build-only caveat');

    await typeInto(p, 0, 'Untityled dekjck'); await p.waitForTimeout(500);
    assert.equal(asked.length, 1, 'no request while typing');
    await p.evaluate(() => commitEdit());
    await p.waitForFunction(() => +$('spellbad').textContent === 2 && !$('spellbad').hidden, null, {timeout: 15000});
    assert.deepEqual(asked.slice(1), [['Untityled', 'dekjck']], 'one request on commit, carrying the words of that row only');
    assert.deepEqual(await spellState(p), {badge: 2, marks: ['Untityled', 'dekjck'], tip: 'Spellcheck · on · 2 flagged on this slide'});
    await p.click('#spellbad');
    const panel = await p.evaluate(() => [...document.querySelectorAll('#spellmenu .w')].map(w => [w.querySelector('b').textContent, [...w.querySelectorAll('.sg')].map(b => b.textContent)]));
    assert.deepEqual(panel.map(x => x[0]), ['untityled', 'dekjck'], 'the panel lists the typed words');
    assert.ok(panel[0][1].includes('untitled'), 'with the dictionary\'s suggestions: ' + JSON.stringify(panel));
    await p.keyboard.press('Escape'); await p.keyboard.press('c');
    await p.waitForFunction(() => !document.getElementById('sheet').hidden, null, {timeout: 2000});
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#grid .cell .spellbad')].map(b => b.hidden ? null : +b.textContent)), [2, null], 'the thumbnail counts them');
    await p.keyboard.press('Escape'); await p.waitForFunction(() => document.getElementById('sheet').hidden, null, {timeout: 2000});

    // the next save writes them into the file: a reload shows them before any new request
    await diskHas(f, d => d.slides[0].els[0].text === 'Untityled dekjck');
    const t0 = Date.now(); while (!('untityled' in blockOf(fs.readFileSync(f, 'utf8'), 'SPELL')) && Date.now() - t0 < 5000) await new Promise(r => setTimeout(r, 50));
    assert.deepEqual(Object.keys(blockOf(fs.readFileSync(f, 'utf8'), 'SPELL')), ['dekjck', 'untityled'], 'the file carries the live flags');
    await p.route('**/__decklet/spell', r => r.abort());
    await p.reload(); await hostOn(p);
    assert.deepEqual((await spellState(p)).marks, ['Untityled', 'dekjck'], 'reloaded: flagged from the file alone');
    await p.unroute('**/__decklet/spell');

    // the fix: typed over, committed — every surface clears, and the file drops the words
    await p.reload(); await hostOn(p); await p.waitForFunction(() => SPELLON, null, {timeout: 15000});
    await p.evaluate(() => { sel.clear(); sel.add(0); render(); edit(0); }); await p.keyboard.type('Untitled deck'); await p.evaluate(() => commitEdit());
    await p.waitForFunction(() => $('spellbad').hidden, null, {timeout: 4000});
    assert.deepEqual(await spellState(p), {badge: null, marks: [], tip: 'Spellcheck · on'});
    await p.keyboard.press('c'); await p.waitForFunction(() => !document.getElementById('sheet').hidden, null, {timeout: 2000});
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#grid .cell .spellbad')].map(b => b.hidden ? null : +b.textContent)), [null, null]);
    await diskHas(f, d => d.slides[0].els[0].text === 'Untitled deck');
    const t1 = Date.now(); while (Object.keys(blockOf(fs.readFileSync(f, 'utf8'), 'SPELL')).length && Date.now() - t1 < 5000) await new Promise(r => setTimeout(r, 50));
    assert.deepEqual(blockOf(fs.readFileSync(f, 'utf8'), 'SPELL'), {}, 'the file drops the fixed words');
    assert.deepEqual(errs, []);
  }, {timeout: 90000}); } finally { await new Promise(r => { s.child.on('exit', r); s.child.kill('SIGTERM'); }); }
});

live('a served deck whose server has no dictionary keeps build-time checking: one probe, no request on commit, and the file:// tip', async () => {
  const dir = path.join(tmp, 'spell-none'); fs.mkdirSync(dir); const f = path.join(dir, 'deck.html'); fs.writeFileSync(f, create(model()).html);
  const s = await serve(f, {checker: async () => null});
  try { await withProject(pw, 'chromium', async ({context}) => { const ctx = await context();
    const p = await ctx.newPage(); const asked = []; p.on('request', r => { if (r.url().endsWith('/__decklet/spell')) asked.push(r.postData()); });
    await p.goto(s.url); await hostOn(p);
    await p.waitForFunction(() => SPELLON === false, null, {timeout: 4000});
    assert.equal(asked.length, 1, 'the probe');
    await typeInto(p, 0, 'Untityled'); await p.evaluate(() => commitEdit()); await p.waitForTimeout(800);
    assert.equal(asked.length, 1, 'no request after the probe said no');
    assert.equal(await p.evaluate(() => SPELLON), false);
    assert.equal((await spellState(p)).tip, 'Spellcheck · on' + TIP, 'the same tip a file:// deck shows');
  }); } finally { await s.close(); }
});

test.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
