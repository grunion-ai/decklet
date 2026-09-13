// decklet HUD — the toolbar is four groups (navigate · save state · edit · file · view), every control names itself on
// hover with its key, the autosave dot is its own button (a tap saves the file), duplicate is a button, and C / G are the sheet / guides.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tpl = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
const hud = tpl.slice(tpl.indexOf('<div id="hud">'), tpl.indexOf('<div id="sheet"'));
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-hud-'));
const model = () => ({w: 960, h: 540, title: 'hud', slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}, {x: 60, y: 200, w: 400, role: 'Body', text: 'body one'}, {x: 100, y: 300, line: [400, 300], arrow: 'end', h: 3}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Two'}]},
]});
const open = async (b) => {
  const f = path.join(tmp, 'hud.html'); fs.writeFileSync(f, create(model()).html);
  const p = await b.newPage({viewport: {width: 1280, height: 800}}); p.errs = []; p.on('pageerror', e => p.errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(150); return p;
};

test('hud: the buttons run navigate · save state · edit · file · view, in that order, with a divider between groups', () => {
  const ids = [...hud.matchAll(/<button id="([^"]+)"/g)].map(m => m[1]).filter(id => !['add-text', 'add-box', 'sadd'].includes(id));
  assert.deepEqual(ids, ['prev', 'next', 'autosave', 'addbtn', 'dup', 'snap', 'spell', 'spellbad', 'pdf', 'grid-btn', 'fs', 'help', 'bug'], 'the spell count badge is a button of its own; save is ONE button, not two');
  assert.equal((hud.match(/class="sep"/g) || []).length, 3, 'three dividers = four groups after the spacer');
  assert.ok(hud.indexOf('class="spacer"') < hud.indexOf('id="autosave"'), 'the save-state button leads the right-hand cluster');
});

test('hud: every control names itself and its key on hover through data-tip, never the OS title delay', () => {
  const btns = [...hud.matchAll(/<button [^>]*>/g)].map(m => m[0]).filter(b => !/id="(add-text|add-box|sadd)"/.test(b));
  for (const b of btns) { assert.match(b, /data-tip="/, b.slice(0, 60)); assert.doesNotMatch(b, / title="/, b.slice(0, 60)); }
  assert.match(hud, /id="fs"[^>]*data-tip="Full screen · F"/);
  assert.match(hud, /id="grid-btn"[^>]*data-tip="Contact sheet · C"/);
  assert.match(hud, /id="snap"[^>]*data-tip="Guides \+ snap · off · G"/);
  assert.match(tpl, /#hud \[data-tip\]:hover::before\{display:block\}/, 'one tooltip rule for the whole HUD');
});

test('hud: the autosave dot is its own button, and the shortcuts popover drops ⌘P, ⌘D and the old G', () => {
  assert.match(hud, /<button id="autosave" class="mi mi-save"[^>]*data-state="ok"[^>]*><svg /, 'save is a button of its own, wearing an icon');
  const help = hud.slice(hud.indexOf('id="helpmenu"'));
  for (const gone of ['⌘P', '⌘D', '<kbd>Esc · G</kbd>', '✓ button']) assert.ok(!help.includes(gone), gone + ' is gone');
  assert.match(help, /<kbd>C · Esc<\/kbd> contact sheet/);
  assert.match(help, /<kbd>G<\/kbd> guides/);
  assert.equal((help.match(/class="col"/g) || []).length, 3, 'three columns: slides · rows · file');
});

live('hud: C opens the sheet, G toggles guides, the dot\'s tooltip carries the save state', async () => {
  const b = await pw.chromium.launch(); const p = await open(b);
  await p.keyboard.press('g'); assert.equal(await p.getAttribute('#snap', 'aria-pressed'), 'true', 'G turns guides on');
  assert.equal(await p.getAttribute('#snap', 'data-tip'), 'Guides + snap · on · G');
  await p.keyboard.press('g'); assert.equal(await p.getAttribute('#snap', 'aria-pressed'), 'false');
  await p.keyboard.press('c'); assert.equal(await p.evaluate(() => sheet.hidden), false, 'C opens the contact sheet');
  await p.keyboard.press('Escape'); assert.equal(await p.evaluate(() => sheet.hidden), true);
  assert.match(await p.getAttribute('#autosave', 'data-tip'), /^Autosaved · \d\d:\d\d:\d\d$/, 'the tooltip is the state and its time');
  assert.match(await p.getAttribute('#autosave', 'aria-label'), /^Autosaved · \d\d:\d\d:\d\d$/, 'the full sentence stays on the dot for screen readers');
  await p.evaluate(() => { snap(); slide().els[1].x = 99; save(); }); await p.waitForTimeout(300);
  assert.match(await p.getAttribute('#autosave', 'data-tip'), /^Saved in this browser · 1 not in the file · ⌘S$/, 'amber names the pending count and the door');
  assert.deepEqual(p.errs, []); await b.close();
});

live('hud: duplicate copies the selected rows offset 16px and selects the copies; with nothing selected it copies the slide', async () => {
  const b = await pw.chromium.launch(); const p = await open(b);
  await p.evaluate(() => { sel.clear(); sel.add(1); sel.add(2); render(); });
  await p.click('#dup');
  const s = await p.evaluate(() => ({n: slide().els.length, sel: [...sel], a: slide().els[3], c: slide().els[4]}));
  assert.equal(s.n, 5); assert.deepEqual(s.sel, [3, 4]);
  assert.deepEqual([s.a.x, s.a.y, s.a.text], [76, 216, 'body one']);
  assert.deepEqual([s.c.x, s.c.y, s.c.line], [116, 316, [416, 316]], 'a connector moves both ends');
  await p.evaluate(() => { sel.clear(); render(); });
  await p.click('#dup');
  const d = await p.evaluate(() => ({n: deck.slides.length, i, ids: deck.slides.map(x => x.id), texts: deck.slides.map(x => x.els[0].text)}));
  assert.equal(d.n, 3); assert.equal(d.i, 1); assert.deepEqual(d.texts, ['One', 'One', 'Two']);
  assert.equal(new Set(d.ids).size, 3, 'the copy gets its own slide id');
  await p.keyboard.press('c'); await p.click('#dup');
  assert.equal(await p.evaluate(() => deck.slides.length), 4, 'in the sheet, duplicate copies the selected slides');
  assert.deepEqual(p.errs, []); await b.close();
});

// ── the save control: one door, and an icon you can read ──────────────────────────────────────────────────────────────
// "Save a copy" was a second button that #hud button{display:inline-flex} (1,0,1) beat #savecopy{display:none} (1,0,0) into
// showing in every browser, wearing a tooltip that lied wherever storage worked. The autosave button already does that job —
// a click runs saveFile(), which falls to saveCopy() when there is no file handle — so it is the only door now, and it wears
// a real icon at the same footprint as its siblings, carrying its state in colour and a corner badge.
test('hud: save is one button — a Lucide glyph the size of its siblings, state in colour and a corner badge, no second copy button', () => {
  assert.match(hud, /<button id="autosave" class="mi mi-save" data-ms="\d+" data-state="ok"[^>]*><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"[^>]*>[\s\S]*?data-mi="[^"]+"[\s\S]*?<\/svg><span id="savebad" role="status" hidden><\/span><\/button>/, 'the save glyph on the 24 grid, its motion part, and the count badge');
  assert.doesNotMatch(tpl, /id="savecopy"|#savecopy|\$\('savecopy'\)/, 'the second button is gone — markup, CSS and handler');
  assert.match(tpl, /function saveCopy\(\)\{/, 'the copy itself stays: saveFile falls to it when there is no file handle');
  assert.match(tpl, /#autosave\[data-state=local\]\{color:#d29922\}/, 'amber: edits not in the file yet');
  assert.match(tpl, /#autosave\[data-state=bad\]\{color:#f85149\}/, 'red: nothing persists');
  assert.match(tpl, /#autosave\[data-state=busy\]\{[^}]*animation:asave \.6s ease-in-out infinite alternate/, 'the pulse while a write is in flight survives');
  assert.match(tpl, /bad:'Save a copy · ⌘S — this browser blocks storage, so edits only survive in a copy'/, 'the red state says the way out, where the lost button used to say it');
  assert.doesNotMatch(tpl, /#autosave i\{/, 'the bare dot is gone');
});

live('hud: the save button reads its state — calm with no badge, amber with the unsynced count, red with ! — and its box matches its siblings', async () => {
  const b = await pw.chromium.launch(); try {
    const p = await open(b);
    const read = () => p.evaluate(() => { const a = $('autosave'), s = $('savebad'), r = a.getBoundingClientRect(), d = $('dup').getBoundingClientRect();
      return {state: a.dataset.state, badge: s.hidden ? null : s.textContent, tip: a.dataset.tip, svg: !!a.querySelector('svg'), box: [Math.round(r.width), Math.round(r.height)], sibling: [Math.round(d.width), Math.round(d.height)]}; });
    const ok = await read();
    assert.equal(ok.state, 'ok'); assert.equal(ok.badge, null, 'the resting state is calm: no badge');
    assert.ok(ok.svg, 'it draws an icon, not a dot'); assert.deepEqual(ok.box, ok.sibling, 'same footprint as the duplicate button');
    await p.evaluate(() => { snap(); slide().els[1].x = 99; save(); }); await p.waitForTimeout(350);
    const local = await read();
    assert.equal(local.state, 'local'); assert.equal(local.badge, '1', 'amber wears the count of edits not in the file');
    await p.evaluate(() => { unsynced = 0; autosave('bad'); }); await p.waitForTimeout(50);
    const bad = await read();
    assert.equal(bad.badge, '!', 'red wears a mark, not a number');
    assert.deepEqual(p.errs, []);
  } finally { await b.close(); }
});

live('hud: storage blocked (Safari on file://) — red, the copy sentence, and a click still writes the copy', async () => {
  const b = await pw.webkit.launch(); try {
    const f = path.join(tmp, 'blocked.html'); fs.writeFileSync(f, create(model()).html);
    const ctx = await b.newContext();
    await ctx.addInitScript(() => { for (const k of ['localStorage', 'indexedDB']) Object.defineProperty(window, k, {get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }}); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
    await p.waitForFunction(() => document.getElementById('autosave').dataset.state !== 'busy');
    const s = await p.evaluate(() => ({state: $('autosave').dataset.state, tip: $('autosave').dataset.tip, full: $('autosave').getAttribute('aria-label'), badge: $('savebad').hidden ? null : $('savebad').textContent}));
    assert.equal(s.state, 'bad'); assert.equal(s.badge, '!');
    assert.equal(s.tip, 'Save a copy · ⌘S — this browser blocks storage, so edits only survive in a copy', 'the tooltip the lost button carried now rides the only button left');
    assert.match(s.full, /blocks storage for local files/, 'the full sentence still names the cause');
    const copy = await p.evaluate(async () => { let blob = null; URL.createObjectURL = x => { blob = x; return 'blob:x'; }; HTMLAnchorElement.prototype.click = () => {};
      document.getElementById('autosave').click(); await new Promise(r => setTimeout(r, 200)); return blob ? (await blob.text()).slice(0, 200) : null; });
    assert.match(String(copy), /^<!DOCTYPE html>/, 'a click in the blocked state downloads the deck as a copy — the Safari path');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
});
