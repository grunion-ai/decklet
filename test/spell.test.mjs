// decklet spell (option C): the build flags misspelt words once, the deck carries the list, the editor underlines them on
// every slide through the CSS Highlight API — in Chrome, Safari and an embedded pane alike — and the toggle clears them.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {flags, textsOf, checkable, loadChecker} from '../lib/spell.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tpl = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-spell-'));
const OK = new Set(['the', 'plan', 'for', 'and', 'risk', 'portfolio', 'renewals', 'body', 'one', 'two', 'read', 'linked', 'run', 'here', 'fine', 'team', "team's", 'slide', 'with', 'typo']);
const correct = w => OK.has(w.toLowerCase());
const model = () => ({w: 960, h: 540, title: 'spell', master: [{id: 'foot', x: 60, y: 500, w: 800, role: 'Label', text: 'fotter with a typo'}], slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Portfolio renewls, risk and the plan'}, {x: 60, y: 200, w: 800, role: 'Body', html: 'Read the <b>linkd</b> run here &amp; fine'}, {x: 100, y: 300, line: [400, 300], arrow: 'end', h: 3}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Slide two'}]},
]});

test('spell: the tokeniser skips what a dictionary cannot judge — short, shouting, inner-capital and digit-bearing tokens', () => {
  for (const w of ['renewls', 'plan', "team's", 'Portfolio']) assert.ok(checkable(w), w);
  for (const w of ['Q4', 'MCA', 'PDF', 'LinkedIn', 'iPhone', 'a', 'of']) assert.ok(!checkable(w), w);
  assert.deepEqual(textsOf(model()).length, 4, 'master + two text rows + the html row; the line carries no words');
  assert.deepEqual(flags(model(), correct), ['fotter', 'linkd', 'renewls'], 'tags and entities are stripped; the result is sorted, lowercase, unique');
  assert.deepEqual(flags({...model(), spell: {ignore: ['Fotter']}}, correct), ['linkd', 'renewls'], 'the ignore list is case-blind');
});

test('spell: create writes the flagged list into the deck; without a checker the list is empty and nothing else changes', () => {
  const withList = create(model(), {spell: correct}).html;
  assert.match(withList, /const SPELL0=\/\*SPELL\*\/\["fotter","linkd","renewls"\]\/\*\/SPELL\*\//, 'the list rides in its own marker block');
  assert.match(create(model()).html, /const SPELL0=\/\*SPELL\*\/\[\]\/\*\/SPELL\*\//, 'no checker → []');
  assert.match(tpl, /::highlight\(spell\)\{text-decoration:underline wavy/, 'the underline is a highlight pseudo, not markup in the row');
  assert.match(tpl, /@media print\{[\s\S]{0,400}?::highlight\(spell\)\{text-decoration:none\}/, 'never on paper');
});

test('spell: the real dictionary, when installed, agrees on plain misspellings and accepts contractions', async () => {
  const c = await loadChecker('en'); if (!c) return; // optional peer: the gate passes without it
  assert.deepEqual(flags(model(), c), ['fotter', 'linkd', 'renewls']);
  assert.equal(await loadChecker('de'), null, 'one dictionary ships: other languages fall back to the browser');
});

live('spell: the editor underlines every flagged word on the live canvas, the toggle clears them, present/print/PDF never paint them', async () => {
  const f = path.join(tmp, 'spell.html'); fs.writeFileSync(f, create(model(), {spell: correct}).html);
  const b = await pw.chromium.launch(); try {
  const p = await b.newPage({viewport: {width: 1280, height: 800}}); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(150);
  const ranges = () => p.evaluate(() => { const h = CSS.highlights.get('spell'); return h ? [...h].map(r => r.toString()).sort() : []; });
  assert.deepEqual(await ranges(), ['fotter', 'linkd', 'renewls'], 'slide 1: the master row, the text row and the html row each carry one flagged word');
  await p.evaluate(() => nav(1)); await p.waitForTimeout(50);
  assert.deepEqual(await ranges(), ['fotter'], 'slide 2: only the master row');
  await p.evaluate(() => nav(-1)); await p.click('#spell'); assert.deepEqual(await ranges(), [], 'off clears the highlight');
  await p.click('#spell'); assert.deepEqual(await ranges(), ['fotter', 'linkd', 'renewls'], 'on repaints');
  await p.evaluate(() => { sel.clear(); sel.add(0); render(); edit(0); }); await p.keyboard.press('End'); await p.keyboard.type(' renewls'); await p.waitForTimeout(250);
  assert.equal((await ranges()).filter(w => w === 'renewls').length, 2, 'typing a flagged word into the row underlines it live');
  await p.evaluate(() => commitEdit());
  await p.evaluate(() => setPresent(true)); await p.waitForTimeout(50); assert.deepEqual(await ranges(), [], 'presenting paints none');
  await p.evaluate(() => setPresent(false)); await p.waitForTimeout(50); assert.equal((await ranges()).length, 4, 'back from present: the three seeded words plus the one typed');
  assert.deepEqual(errs, []);
  } finally { await b.close(); }
});

test('spell: the toggle wears a count badge, every contact-sheet cell carries one, and the HUD manifest names it', () => {
  assert.match(tpl, /<button id="spell"[\s\S]*?<span id="spellbad" role="status" hidden><\/span><\/button>/, 'the badge lives inside the spellcheck button, as the autosave dot lives inside its button');
  assert.match(tpl, /\.cell \.spellbad\{[^}]*right:8px/, 'the cell badge sits top-right, clear of the slide number at the left');
  assert.match(tpl, /\.cell \.n\{[^}]*left:8px/, 'the slide number stays at the left');
  assert.match(fs.readFileSync(path.join(root, 'docs/editor.md'), 'utf8'), /<!-- HUD: [^>]* spell spellbad /, 'the manifest names the badge after its button');
});

live('spell: the badge counts this slide, follows typing and the toggle, and every sheet cell wears its own count', async () => {
  const f = path.join(tmp, 'badge.html'); fs.writeFileSync(f, create(model(), {spell: correct}).html);
  const b = await pw.chromium.launch(); try {
  const p = await b.newPage({viewport: {width: 1280, height: 800}}); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(150);
  const badge = () => p.evaluate(() => { const b = $('spellbad'); return b.hidden ? null : +b.textContent; });
  assert.equal(await badge(), 3, 'slide 1: three flagged words');
  assert.equal(await p.getAttribute('#spell', 'data-tip'), 'Spellcheck · on · 3 flagged on this slide');
  assert.equal(await p.getAttribute('#spellbad', 'aria-label'), '3 flagged words on this slide');
  await p.evaluate(() => nav(1)); await p.waitForTimeout(50); assert.equal(await badge(), 1, 'slide 2: the master row alone');
  await p.evaluate(() => nav(-1)); await p.evaluate(() => { sel.clear(); sel.add(0); render(); edit(0); }); await p.keyboard.press('End'); await p.keyboard.type(' renewls'); await p.waitForTimeout(250);
  assert.equal(await badge(), 4, 'a flagged word typed into a row counts at once'); await p.evaluate(() => commitEdit());
  await p.click('#spell'); assert.equal(await badge(), null, 'off hides the badge'); assert.equal(await p.getAttribute('#spell', 'data-tip'), 'Spellcheck · off');
  await p.click('#spell'); assert.equal(await badge(), 4);
  await p.evaluate(() => setPresent(true)); await p.waitForTimeout(50); assert.equal(await badge(), null, 'presenting shows no badge'); await p.evaluate(() => setPresent(false));
  await p.keyboard.press('c'); await p.waitForTimeout(100);
  const cells = () => p.evaluate(() => [...document.querySelectorAll('#grid .cell')].map(c => { const s = c.querySelector('.spellbad'); return s.hidden ? null : +s.textContent; }));
  assert.deepEqual(await cells(), [4, 1], 'each thumbnail carries its own count');
  assert.equal(await p.getAttribute('#grid .cell .spellbad', 'aria-label'), '4 flagged words on slide 1');
  const [num, bad] = await p.evaluate(() => { const c = document.querySelector('#grid .cell'); return [c.querySelector('.n').getBoundingClientRect(), c.querySelector('.spellbad').getBoundingClientRect()].map(r => [r.left, r.right]); });
  assert.ok(num[1] < bad[0], 'the slide number and the badge never overlap');
  await p.evaluate(() => setSpell(false)); assert.deepEqual(await cells(), [null, null], 'off clears the cells too');
  await p.evaluate(() => setSpell(true)); assert.deepEqual(await cells(), [4, 1]);
  assert.deepEqual(errs, []);
  } finally { await b.close(); }
});
