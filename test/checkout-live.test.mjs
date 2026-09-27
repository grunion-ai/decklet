// decklet checkout, live: the page against a real `node bin/serve.mjs` child and the real --checkout / --checkin CLI, in
// Chromium AND WebKit. A checkout turns the page read-only within 1 s (state `agent`: lock + the agent's name, a toast names the
// holder when you try to edit); a rebuild under the lease shows `agent-edit` (bot + dots); checkin rebases the page onto the
// agent's version with the person's earlier edit kept, and the page edits and saves again.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {create} from '../bin/create.mjs';
import {blockOf} from '../lib/edits.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'serve.mjs');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-checkout-live-'));
const model = (two = 'Two') => ({w: 960, h: 540, title: 'checkout', slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: two}]},
]});
async function start(file) {
  const child = spawn(process.execPath, [bin, file], {stdio: ['ignore', 'pipe', 'inherit']});
  const line = await new Promise(ok => { let out = ''; child.stdout.on('data', c => { out += c; if (out.includes('\n')) ok(out.trim()); }); });
  return {child, origin: line.replace(/\/$/, '')};
}
const cli = (...args) => new Promise(r => execFile(process.execPath, [bin, ...args], (err, stdout) => r({code: err ? err.code : 0, stdout})));
const disk = f => blockOf(fs.readFileSync(f, 'utf8'), 'DECK');
async function diskHas(f, pred, ms = 2000) {
  const t0 = Date.now(); for (;;) { try { if (pred(disk(f))) return; } catch {} if (Date.now() - t0 > ms) assert.fail('file never took the edit: ' + JSON.stringify(disk(f).slides.map(s => s.els[0].text))); await new Promise(r => setTimeout(r, 50)); }
}
const hostOn = p => p.waitForFunction(() => typeof HOST !== 'undefined' && HOST && HOST.on, null, {timeout: 4000});
const editRow = (p, n, text) => p.evaluate(([n, text]) => { snap(); deck.slides[n].els[0].text = text; save(); }, [n, text]);
const texts = p => p.evaluate(() => deck.slides.map(s => s.els[0].text));
const stateIs = (p, st, ms) => p.waitForFunction(st => document.getElementById('autosave').dataset.state === st, st, {timeout: ms});

for (const engine of ['chromium', 'webkit']) live(`${engine}: checkout makes the page read-only within 1 s, a rebuild under it shows agent-edit, checkin rebases and keeps the earlier edit`, async () => {
  const dir = path.join(tmp, engine); fs.mkdirSync(dir); const f = path.join(dir, 'deck.html'); fs.writeFileSync(f, create(model()).html);
  const s = await start(f), b = await pw[engine].launch(), ctx = await b.newContext({reducedMotion: 'reduce'});
  try {
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(s.origin + '/'); await hostOn(p);
    await editRow(p, 0, 'Before checkout');
    await diskHas(f, d => d.slides[0].els[0].text === 'Before checkout');
    await stateIs(p, 'ok', 2000);

    const co = await cli(f, '--checkout', '--by', 'Claude', '--ttl', '600');
    assert.equal(co.code, 0); assert.match(co.stdout, /^checked out deck\.html for Claude until \d\d:\d\d\n$/);
    await stateIs(p, 'agent', 1000);
    const pill = await p.evaluate(() => { const a = document.getElementById('autosave'), vis = s => getComputedStyle(a.querySelector(s)).display !== 'none';
      return {who: a.querySelector('.who').textContent, lock: vis('.lk'), bot: vis('.bt'), save: vis('svg:first-child'), tip: a.dataset.tip, label: a.getAttribute('aria-label'), leased: document.body.classList.contains('leased')}; });
    assert.deepEqual([pill.who, pill.lock, pill.bot, pill.save, pill.leased], ['Claude', true, false, false, true], 'the pill: lock glyph and the agent\'s name, in place of the save glyph');
    assert.match(pill.tip, /^Checked out by Claude since \d\d:\d\d · until \d\d:\d\d$/); assert.equal(pill.label, pill.tip);

    // read-only: a double-click opens no editor, an edit that reaches save() is undone, and the toast names the holder
    const box = await p.locator('#canvas .el').first().boundingBox();
    await p.mouse.dblclick(box.x + 20, box.y + box.height / 2);
    assert.equal(await p.evaluate(() => !!canvas.querySelector('[contenteditable="true"]')), false, 'no text editor opens');
    assert.match(await p.evaluate(() => $('toast').hidden ? '' : $('toast').textContent), /Claude/, 'the toast names who holds it');
    await p.evaluate(() => { snap(); deck.slides[0].els[0].text = 'Blocked'; save(); });
    assert.equal((await texts(p))[0], 'Before checkout', 'the edit did not land');
    await p.keyboard.press('Backspace'); await p.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    assert.deepEqual(await texts(p), ['Before checkout', 'Two']);

    // the agent rebuilds under the lease: bot glyph and dots; the page does not rebase yet
    fs.writeFileSync(f, create(model('Two, by Claude'), {from: f}).html);
    await stateIs(p, 'agent-edit', 1000);
    const busy = await p.evaluate(() => { const a = document.getElementById('autosave'), vis = s => getComputedStyle(a.querySelector(s)).display !== 'none';
      return {bot: vis('.bt'), lock: vis('.lk'), dots: vis('.dots'), anim: getComputedStyle(a.querySelector('.dots i')).animationName}; });
    assert.deepEqual(busy, {bot: true, lock: false, dots: true, anim: 'none'}, 'bot + dots; reduced motion holds the dots still');
    assert.deepEqual(await texts(p), ['Before checkout', 'Two'], 'no rebase while the agent holds the deck');

    const ci = await cli(f, '--checkin');
    assert.equal(ci.code, 0); assert.equal(ci.stdout, 'checked in deck.html\n');
    await stateIs(p, 'ok', 3000);
    assert.deepEqual(await texts(p), ['Before checkout', 'Two, by Claude'], 'the page stands on the agent\'s version with the earlier edit');
    assert.equal(await p.evaluate(() => document.body.classList.contains('leased')), false);
    await editRow(p, 1, 'After checkin');
    await diskHas(f, d => d.slides[0].els[0].text === 'Before checkout' && d.slides[1].els[0].text === 'After checkin');
    assert.deepEqual(errs, []);
  } finally { await b.close(); await new Promise(r => { s.child.on('exit', r); s.child.kill('SIGTERM'); }); }
});

test.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
