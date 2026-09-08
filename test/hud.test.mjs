// decklet HUD — the toolbar is four groups (navigate · save state · edit · file · view), every control names itself on
// hover with its key, versions and the autosave dot are one button, duplicate is a button, and C / G are the sheet / guides.
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
  assert.deepEqual(ids, ['prev', 'next', 'vers', 'addbtn', 'dup', 'snap', 'spell', 'savecopy', 'pdf', 'grid-btn', 'fs', 'help']);
  assert.equal((hud.match(/class="sep"/g) || []).length, 3, 'three dividers = four groups after the spacer');
  assert.ok(hud.indexOf('class="spacer"') < hud.indexOf('id="vers"'), 'the save-state button leads the right-hand cluster');
});

test('hud: every control names itself and its key on hover through data-tip, never the OS title delay', () => {
  const btns = [...hud.matchAll(/<button [^>]*>/g)].map(m => m[0]).filter(b => !/id="(add-text|add-box|sadd)"/.test(b));
  for (const b of btns) { assert.match(b, /data-tip="/, b.slice(0, 60)); assert.doesNotMatch(b, / title="/, b.slice(0, 60)); }
  assert.match(hud, /id="fs"[^>]*data-tip="Full screen · F"/);
  assert.match(hud, /id="grid-btn"[^>]*data-tip="Contact sheet · C"/);
  assert.match(hud, /id="snap"[^>]*data-tip="Guides \+ snap · off · G"/);
  assert.match(tpl, /#hud \[data-tip\]:hover::before\{display:block\}/, 'one tooltip rule for the whole HUD');
});

test('hud: the autosave dot is a badge on the versions button, and the shortcuts popover drops ⌘P, ⌘D and the old G', () => {
  assert.match(hud, /<button id="vers"[\s\S]*?<span id="autosave"[\s\S]*?<\/button>/, 'the dot lives inside the versions button');
  const help = hud.slice(hud.indexOf('id="helpmenu"'));
  for (const gone of ['⌘P', '⌘D', '<kbd>Esc · G</kbd>', '✓ button']) assert.ok(!help.includes(gone), gone + ' is gone');
  assert.match(help, /<kbd>C · Esc<\/kbd> contact sheet/);
  assert.match(help, /<kbd>G<\/kbd> guides/);
  assert.equal((help.match(/class="col"/g) || []).length, 3, 'three columns: slides · rows · file');
});

live('hud: C opens the sheet, G toggles guides, the versions tooltip carries the save state, and the menu has a Save row', async () => {
  const b = await pw.chromium.launch(); const p = await open(b);
  await p.keyboard.press('g'); assert.equal(await p.getAttribute('#snap', 'aria-pressed'), 'true', 'G turns guides on');
  assert.equal(await p.getAttribute('#snap', 'data-tip'), 'Guides + snap · on · G');
  await p.keyboard.press('g'); assert.equal(await p.getAttribute('#snap', 'aria-pressed'), 'false');
  await p.keyboard.press('c'); assert.equal(await p.evaluate(() => sheet.hidden), false, 'C opens the contact sheet');
  await p.keyboard.press('Escape'); assert.equal(await p.evaluate(() => sheet.hidden), true);
  assert.match(await p.getAttribute('#vers', 'data-tip'), /^Versions · autosaved \d\d:\d\d:\d\d$/, 'the tooltip is short: the control, then the state');
  assert.match(await p.getAttribute('#autosave', 'aria-label'), /^Autosaved · \d\d:\d\d:\d\d$/, 'the full sentence stays on the dot for screen readers');
  await p.click('#vers'); assert.ok(await p.$('#versmenu button[data-save]'), 'the versions menu carries the Save ⌘S row');
  assert.match(await p.textContent('#versmenu .v:first-child span'), /^Autosaved · \d\d:\d\d:\d\d$/, 'its first row is the full save status');
  assert.equal(await p.evaluate(() => getComputedStyle($('vers'), '::before').display), 'none', 'no tooltip while the menu is open');
  const r = await p.evaluate(() => { const b = versmenu.getBoundingClientRect(); return [b.left >= 0, b.right <= innerWidth]; }); assert.deepEqual(r, [true, true], 'the menu fits inside the window');
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
