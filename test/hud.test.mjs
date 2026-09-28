// decklet HUD — the toolbar is four groups (navigate · save state · edit · file · view), every control names itself on
// hover with its key, the autosave dot is its own button (a tap saves the file), duplicate is a button, and C / G are the sheet / guides.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {withBrowser} from './helpers/browser.mjs';
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
  assert.deepEqual(ids, ['prev', 'next', 'autosave', 'addbtn', 'dup', 'undobtn', 'delbtn', 'snap', 'spell', 'spellbad', 'pdf', 'grid-btn', 'fs', 'help', 'bug'], 'the spell count badge is a button of its own; save is ONE button, not two');
  assert.equal((hud.match(/class="sep"/g) || []).length, 3, 'three dividers = four groups after the spacer');
  assert.ok(hud.indexOf('class="spacer"') < hud.indexOf('id="autosave"'), 'the save-state button leads the right-hand cluster');
});

test('hud: every control names itself and its key on hover through data-tip, never the OS title delay', () => {
  const btns = [...hud.matchAll(/<button [^>]*>/g)].map(m => m[0]).filter(b => !/id="(add-text|add-box|sadd)"/.test(b));
  for (const b of btns) { assert.match(b, /data-tip="/, b.slice(0, 60)); assert.doesNotMatch(b, / title="/, b.slice(0, 60)); }
  assert.match(hud, /id="fs"[^>]*data-tip="Full screen · F"/);
  assert.match(hud, /id="grid-btn"[^>]*data-tip="Contact sheet · C"/);
  assert.match(hud, /id="snap"[^>]*data-tip="Guides \+ snap · off · G"/);
  assert.match(hud, /id="undobtn"[^>]*data-tip="Undo · ⌘Z" aria-label="Undo · ⌘Z"/);
  assert.match(hud, /id="delbtn"[^>]*data-tip="Delete selection · ⌫" aria-label="Delete selection · ⌫"/);
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
  assert.match(await p.getAttribute('#autosave', 'data-tip'), /^Saved in this browser only · \d\d:\d\d:\d\d · ⌘S links the file$/, 'the tooltip is the state, its time and the way to the file');
  assert.match(await p.getAttribute('#autosave', 'aria-label'), /^Saved in this browser only · \d\d:\d\d:\d\d · ⌘S links the file$/, 'the full sentence stays on the dot for screen readers');
  await p.evaluate(() => { snap(); slide().els[1].x = 99; save(); }); await p.waitForTimeout(300);
  assert.match(await p.getAttribute('#autosave', 'data-tip'), /^Saved in this browser · 1 not in the file · ⌘S$/, 'amber names the pending count and the door');
  assert.deepEqual(p.errs, []); await b.close();
});

// UAT, Safari 18.5, v0.14.0: C opened the sheet and a second C did nothing, though the tooltip reads "Contact sheet · C".
// Inside the sheet every key goes to sheetKey(), which knew Escape and Enter but not C. A bare C now closes it the way Esc
// does; ⌘C (Ctrl+C) still copies the selected slides and leaves the sheet open.
for (const engine of ['chromium', 'webkit']) live(`hud: C toggles the contact sheet, and ⌘C inside it still copies (${engine})`, {timeout: 60000}, async () => {
  await withBrowser(pw[engine], async (b) => {
    const p = await open(b);
    const hidden = () => p.evaluate(() => sheet.hidden);
    await p.keyboard.press('c'); assert.equal(await hidden(), false, 'C opens the sheet');
    await p.keyboard.press('c'); assert.equal(await hidden(), true, 'C again closes it');
    assert.equal(await p.evaluate(() => i), 0, 'closing with C stays on the slide, as Esc does');
    await p.keyboard.press('c'); assert.equal(await hidden(), false);
    await p.keyboard.press('ControlOrMeta+c');
    assert.equal(await hidden(), false, '⌘C inside the sheet leaves it open');
    assert.equal(await p.evaluate(() => clip && clip.length), 1, '⌘C copied the selected slide');
    await p.keyboard.press('Shift+C'); assert.equal(await hidden(), true, 'a capital C closes it too');
    assert.deepEqual(p.errs, []);
  }, {timeout: 50000});
});

// Issue #83: F did nothing on the contact sheet and ⛶ was disabled there. Full screen changes how the deck is shown, not
// which slide is current, so it stays live on the sheet: pick a slide, press F (or ⛶), and presenting starts from it;
// presenting with the sheet open, F leaves full screen from the sheet with no detour through the canvas.
for (const engine of ['chromium', 'webkit']) live(`hud: F and ⛶ toggle full screen from the contact sheet, presenting from the picked slide (${engine})`, {timeout: 60000}, async () => {
  await withBrowser(pw[engine], async (b) => {
    const p = await open(b);
    const st = () => p.evaluate(() => ({present: present(), sheet: !sheet.hidden, i}));
    await p.keyboard.press('c');
    assert.equal(await p.evaluate(() => $('fs').disabled), false, '⛶ is live on the sheet');
    assert.deepEqual(await p.evaluate(() => ['prev', 'next'].map(k => $(k).disabled)), [true, true], '‹ › stay disabled: the sheet is the navigator');
    await p.click('#grid .cell[data-n="1"]');
    await p.keyboard.press('Alt+f'); assert.deepEqual(await st(), {present: false, sheet: true, i: 0}, 'a modified F is not the shortcut');
    await p.keyboard.press('f'); await p.waitForFunction(() => present());
    assert.deepEqual(await st(), {present: true, sheet: false, i: 1}, 'F on the sheet presents from the picked slide');
    await p.keyboard.press('c'); assert.equal(await p.evaluate(() => !sheet.hidden), true, 'presenting, C opens the sheet');
    await p.keyboard.press('f'); await p.waitForFunction(() => !present());
    assert.deepEqual(await st(), {present: false, sheet: false, i: 1}, 'F on the sheet leaves full screen');
    await p.keyboard.press('c'); await p.click('#grid .cell[data-n="0"]'); await p.click('#fs'); await p.waitForFunction(() => present());
    assert.deepEqual(await st(), {present: true, sheet: false, i: 0}, '⛶ on the sheet presents from the picked slide too');
    assert.deepEqual(p.errs, []);
  }, {timeout: 50000});
});

// Issue #80: the button duplicated the selected rows when rows were selected, and the slide otherwise, so the same click
// meant two things depending on the canvas. It duplicates slides only: the current slide on the canvas, the selected slides
// in the sheet. Rows are copied with ⌘C / ⌘V (#79).
test('hud: the duplicate button is named for the slide', () => {
  assert.match(hud, /<button id="dup"[^>]*data-tip="Duplicate slide" aria-label="Duplicate slide"/);
});
live('hud: duplicate copies the slide whatever rows are selected; in the sheet it copies the selected slides', async () => {
  const b = await pw.chromium.launch(); try { const p = await open(b);
  await p.evaluate(() => { sel.clear(); sel.add(1); sel.add(2); render(); });
  await p.click('#dup');
  const d = await p.evaluate(() => ({n: deck.slides.length, i, rows: deck.slides.map(x => x.els.length), ids: deck.slides.map(x => x.id), texts: deck.slides.map(x => x.els[0].text), sel: [...sel]}));
  assert.deepEqual([d.n, d.i, d.rows, d.texts, d.sel], [3, 1, [3, 3, 1], ['One', 'One', 'Two'], []], 'a slide copy after the current one, no row copies, nothing selected on the copy');
  assert.equal(new Set(d.ids).size, 3, 'the copy gets its own slide id');
  await p.keyboard.press('ControlOrMeta+z'); assert.equal(await p.evaluate(() => deck.slides.length), 2, '⌘Z takes it back');
  await p.keyboard.press('c'); await p.click('#dup');
  assert.equal(await p.evaluate(() => deck.slides.length), 3, 'in the sheet, duplicate copies the selected slides');
  assert.deepEqual(p.errs, []); } finally { await b.close(); }
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
  assert.match(tpl, /#autosave\[data-state=tab\]\{color:#d29922\}/, 'amber, labelled: nothing persists here, the tab keeps the edits');
  assert.doesNotMatch(tpl, /data-state=bad|autosave\('bad'\)/, 'the red state is gone: tab replaced it');
  assert.match(tpl, /#autosave\[data-state=busy\]\{[^}]*animation:asave \.6s ease-in-out infinite alternate/, 'the pulse while a write is in flight survives');
  assert.equal((tpl.match(/tab:TABMSG\(\)/g) || []).length, 2, 'the tab state says the way out (host it), as tooltip and aria-label');
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
    await p.evaluate(() => { unsynced = 0; autosave('tab'); }); await p.waitForTimeout(50);
    const tab = await read();
    assert.equal(tab.badge, null, 'the tab state says "Not saving" in words, so it wears no badge');
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
    assert.equal(s.state, 'tab'); assert.equal(s.badge, null);
    assert.equal(s.tip, 'This browser cannot save here. Edits survive reload in this tab only. Host it: node bin/serve.mjs blocked.html', 'the tooltip names the cause and the fix');
    assert.equal(s.full, s.tip, 'the full sentence is the same one');
    const copy = await p.evaluate(async () => { let blob = null; URL.createObjectURL = x => { blob = x; return 'blob:x'; }; HTMLAnchorElement.prototype.click = () => {};
      document.getElementById('autosave').click(); await new Promise(r => setTimeout(r, 200)); return blob ? (await blob.text()).slice(0, 200) : null; });
    assert.match(String(copy), /^<!DOCTYPE html>/, 'a click in the blocked state downloads the deck as a copy — the Safari path');
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
});

// ── undo and delete as buttons (#167): on a phone ⌘Z and ⌫ do not exist, so the HUD carries both, on every pointer ──────
// Each click runs the code its key runs; each is disabled exactly when its key would do nothing. The present-mode pill has neither.
test('hud: undo and delete sit in the edit group, and the present-mode pill leaves them out', () => {
  const edit = hud.slice(hud.indexOf('id="addwrap"'), hud.indexOf('id="pdf"'));
  assert.ok(edit.includes('id="undobtn"') && edit.includes('id="delbtn"'), 'both live between + and the file group');
  assert.match(tpl, /body\.present\.peek #hud #undobtn,body\.present\.peek #hud #delbtn\{display:none\}/);
  assert.match(tpl, /\$\('undobtn'\)\.onclick=/); assert.match(tpl, /\$\('delbtn'\)\.onclick=/);
});

live('hud: undo and delete follow the selection and the undo stack, on the canvas and in the sheet', async () => {
  const b = await pw.chromium.launch(); try {
    const p = await open(b);
    const st = () => p.evaluate(() => ({u: $('undobtn').disabled, d: $('delbtn').disabled, h: history.length, rows: slide().els.length, slides: deck.slides.length}));
    let s = await st();
    assert.equal(s.h, 0); assert.equal(s.u, true, 'nothing to undo: Undo is disabled'); assert.equal(s.d, true, 'nothing selected: Delete is disabled');
    await p.click('.el[data-n="1"]'); s = await st();
    assert.equal(s.d, false, 'a selected row enables Delete'); assert.equal(s.u, s.h === 0);
    await p.click('#delbtn'); s = await st();
    assert.equal(s.rows, 2, 'Delete removed the selected row'); assert.equal(s.d, true, 'the selection went with it'); assert.equal(s.u, false, 'and there is something to undo');
    await p.click('#undobtn'); s = await st();
    assert.equal(s.rows, 3, 'Undo put it back'); assert.equal(s.u, s.h === 0, 'Undo is enabled exactly while the stack holds a snapshot');
    await p.evaluate(() => { history.length = 0; hsave(); render(); }); assert.equal((await st()).u, true);
    // while a row is being edited the keys belong to the text (⌘Z is the browser's text undo), and so do the buttons
    await p.dblclick('.el[data-n="0"]'); await p.keyboard.type('Uno');
    assert.equal(await p.evaluate(() => document.activeElement.textContent), 'Uno');
    await p.click('#undobtn');
    const [open1, t1] = await p.evaluate(() => [document.activeElement.isContentEditable, document.activeElement.textContent]);
    assert.equal(open1, true, 'the row stays open: Undo did not commit the edit or pop the deck snapshot');
    assert.ok(t1 !== 'Uno' && ('Uno'.startsWith(t1) || t1 === 'One'), `Undo stepped the typing back, as ⌘Z does: ${t1}`);
    await p.evaluate(() => { commitEdit(); sel.clear(); history.length = 0; hsave(); render(); });
    await p.keyboard.press('c'); s = await st();
    assert.equal(s.d, false, 'the sheet selects the current slide, so Delete is live');
    await p.click('#delbtn'); s = await st();
    assert.equal(s.slides, 1, 'Delete removed the selected slide'); assert.equal(s.d, true, 'one slide left: Delete is disabled, the key would do nothing');
    await p.click('#undobtn'); s = await st();
    assert.equal(s.slides, 2, 'Undo in the sheet brought the slide back'); assert.equal(await p.evaluate(() => sheet.hidden), false, 'and the sheet stays open');
    assert.deepEqual(p.errs, []);
  } finally { await b.close(); }
});
