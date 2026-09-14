// decklet spell (option C): the build flags misspelt words once, the deck carries the list, the editor underlines them on
// every slide through the CSS Highlight API — in Chrome, Safari and an embedded pane alike — and the toggle clears them.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {create} from '../bin/create.mjs';
import {flags, flagMap, textsOf, checkable, loadChecker} from '../lib/spell.mjs';
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

test('spell: create writes the flagged words AND their suggestions into the deck; without a checker the block is empty', () => {
  const withList = create(model(), {spell: correct}).html;
  assert.match(withList, /const SPELL0=\/\*SPELL\*\/\{"fotter":\[\],"linkd":\[\],"renewls":\[\]\}\/\*\/SPELL\*\//, 'word → suggestions rides in the marker block; a checker with no suggest offers none');
  assert.match(create(model()).html, /const SPELL0=\/\*SPELL\*\/\{\}\/\*\/SPELL\*\//, 'no checker → {}');
  assert.match(tpl, /::highlight\(spell\)\{text-decoration:underline wavy/, 'the underline is a highlight pseudo, not markup in the row');
  assert.match(tpl, /@media print\{[\s\S]{0,400}?::highlight\(spell\)\{text-decoration:none;background-color:transparent\}/, 'never on paper — neither the underline nor the wash');
});

// A. Safari (AppleWebKit 605, the shipping engine) paints NO text-decoration inside ::highlight(); it does paint
// background-color and color. Playwright's WebKit 26.5 paints the underline, so only a rule check catches the regression.
test('spell: the highlight carries a wash as well as the wavy underline, so every engine paints something', () => {
  assert.match(tpl, /::highlight\(spell\)\{text-decoration:underline wavy #f85149;text-decoration-skip-ink:none;background-color:rgba\(248,81,73,\.14\)\}/,
    'one rule, no UA sniffing: the underline for the engines that draw it, the wash for the ones that do not');
});

test('spell: suggestions are capped and come from the dictionary; a word with none is still listed', async () => {
  const c = await loadChecker('en'); if (!c) return;                       // optional peer: the gate passes without it
  const m = flagMap(model(), c);
  assert.deepEqual(Object.keys(m), ['fotter', 'linkd', 'renewls']);
  assert.ok(m.renewls.includes('renewals'), 'the dictionary knows the word that was meant: ' + m.renewls);
  for (const w in m) assert.ok(m[w].length <= 5, w + ' offers at most five');
  assert.deepEqual(flagMap(model(), correct).renewls, [], 'a checker without suggest flags without suggesting');
});

// 0.7–0.9 decks carry a plain array of words. Both doors must keep working: the build (--from) and the runtime.
test('spell: create --from a 0.9 deck (a plain array in the SPELL block) builds and writes the new shape', () => {
  const old = create(model(), {spell: correct}).html.replace(/\/\*SPELL\*\/[\s\S]*?\/\*\/SPELL\*\//, '/*SPELL*/["fotter","linkd","renewls"]/*\/SPELL*/');
  const f = path.join(tmp, 'old-shape.html'); fs.writeFileSync(f, old);
  const {html} = create(model(), {from: f, spell: correct});
  assert.match(html, /const SPELL0=\/\*SPELL\*\/\{"fotter":/, 'the rebuild carries the object shape');
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
  assert.match(tpl, /<div id="spellwrap">\s*<button id="spell"[\s\S]*?<\/button>\s*<button id="spellbad" type="button" data-tip="Flagged words on this slide" aria-haspopup="dialog" aria-expanded="false" hidden><\/button>\s*<\/div>/, 'the badge sits on the toggle as its own button: the icon toggles, the count opens the panel');
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

// ── the words are reachable: the badge opens a panel of them, a click on one in an editing row opens the same panel ──
// Two doors, one panel. The panel replaces every occurrence on the slide and says so; the anchored popover replaces the one
// you clicked. Both run the ordinary edit path, so the change lands in the file and in bin/edits.mjs.
const pmodel = () => ({w: 960, h: 540, title: 'panel', master: [{id: 'foot', x: 60, y: 500, w: 800, role: 'Label', text: 'fotter with a typo'}], slides: [
  {els: [
    {x: 60, y: 80, w: 800, role: 'H1', text: 'Renewls and the plan'},                  // capitalised, so the fix must be too
    {x: 60, y: 200, w: 800, role: 'Body', html: 'Read the <b>linkd</b> run here'},     // inside markup
    {x: 60, y: 300, w: 800, role: 'Body', text: 'one renewls for the team'},           // the second occurrence on this slide
  ]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Slide two'}]},
]});
const ENGINES = ['chromium', 'webkit'];
const open = async (b, name, html) => {
  const f = path.join(tmp, name); fs.writeFileSync(f, html);
  const p = await b.newPage({viewport: {width: 1280, height: 800}}); p.errs = []; p.on('pageerror', e => p.errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200);
  return p;
};
const words = p => p.evaluate(() => [...document.querySelectorAll('#spellmenu .w')].map(w => w.querySelector('b').textContent));
const texts = p => p.evaluate(() => deck.slides[0].els.map(e => e.text ?? e.html));

for (const eng of ENGINES) {
  live(`spell [${eng}]: the badge opens the panel — every flagged word on this slide, its suggestions, and a replace that lands in the log`, async () => {
    const c = await loadChecker('en'); if (!c) return;                       // suggestions need the optional dictionary
    const b = await pw[eng].launch(); try {
      const p = await open(b, `panel-${eng}.html`, create(pmodel(), {spell: c}).html);
      assert.equal(await p.evaluate(() => $('spellmenu').hidden), true, 'closed until asked for');
      await p.click('#spellbad');
      assert.deepEqual(await words(p), ['renewls', 'linkd', 'fotter'], 'every flagged word on this slide, once, in reading order');
      assert.equal(await p.evaluate(() => $('spellmenu').querySelector('.w .x').textContent), '×2', 'a word twice says so');
      assert.match(await p.evaluate(() => $('spellmenu').querySelector('.hd').textContent), /every occurrence on this slide/, 'the panel names its scope');
      assert.ok(await p.evaluate(() => $('spellmenu').contains(document.activeElement)), 'focus moves into the panel');
      assert.ok(await p.evaluate(() => $('spellmenu').querySelector('.w .sg').textContent.length > 0), 'the build shipped suggestions');
      await p.click('#spellmenu .w:nth-child(2) .sg:text-is("renewals")');
      await p.waitForTimeout(150);
      assert.deepEqual(await texts(p), ['Renewals and the plan', 'Read the <b>linkd</b> run here', 'one renewals for the team'],
        'both occurrences on the slide, each in its own case, markup untouched');
      assert.ok(await p.evaluate(() => log.some(e => e.k && e.k.text)), 'the replacement rode the ordinary edit path into the log');
      assert.equal(await p.evaluate(() => +$('spellbad').textContent), 2, 'the badge drops to the two words left');
      assert.deepEqual(await p.evaluate(() => [...(CSS.highlights.get('spell') || [])].map(r => r.toString()).sort()), ['fotter', 'linkd'], 'repainted');
      assert.deepEqual(p.errs, []);
    } finally { await b.close(); }
  });

  live(`spell [${eng}]: a click on a flagged word in an editing row fixes that one occurrence; Escape closes, the badge takes focus back`, async () => {
    const c = await loadChecker('en'); if (!c) return;
    const b = await pw[eng].launch(); try {
      const p = await open(b, `word-${eng}.html`, create(pmodel(), {spell: c}).html);
      await p.evaluate(() => { sel.clear(); sel.add(0); render(); edit(0); }); await p.waitForTimeout(100);
      const box = await p.evaluate(() => { const h = [...CSS.highlights.get('spell')].find(r => r.toString().toLowerCase() === 'renewls' && r.startContainer.parentElement.closest('[contenteditable="true"]')); const q = h.getBoundingClientRect(); return {x: q.left + q.width / 2, y: q.top + q.height / 2}; });
      await p.mouse.click(box.x, box.y); await p.waitForTimeout(120);
      assert.deepEqual(await words(p), ['renewls'], 'the popover carries the one word you clicked');
      assert.match(await p.evaluate(() => $('spellmenu').querySelector('.hd').textContent), /this one/, 'and says it fixes only that occurrence');
      await p.click('#spellmenu .sg');
      await p.waitForTimeout(150);
      const t = await texts(p);
      assert.equal(t[0], 'Renewals and the plan', 'the clicked occurrence is fixed, in its own case');
      assert.equal(t[2], 'one renewls for the team', 'the other occurrence on the slide is untouched');
      await p.click('#spellbad'); assert.equal(await p.evaluate(() => $('spellmenu').hidden), false);
      await p.keyboard.press('Escape');
      assert.equal(await p.evaluate(() => $('spellmenu').hidden), true, 'Escape closes it');
      assert.equal(await p.evaluate(() => document.activeElement.id), 'spellbad', 'and hands focus back to the door it came from');
      assert.deepEqual(p.errs, []);
    } finally { await b.close(); }
  });

  live(`spell [${eng}]: "Ignore in this deck" writes deck.spell.ignore and repaints; the wash marks the word with no underline at all`, async () => {
    const b = await pw[eng].launch(); try {
      const p = await open(b, `ignore-${eng}.html`, create(pmodel(), {spell: correct}).html);
      await p.click('#spellbad');
      assert.deepEqual(await words(p), ['renewls', 'linkd', 'fotter']);
      assert.equal(await p.evaluate(() => !!$('spellmenu').querySelector('.none')), true, 'a word with no suggestion still lists, and says so');
      await p.click('#spellmenu .w:nth-child(4) .ign');   // .hd is the first child, so the third word is the fourth node
      await p.waitForTimeout(150);
      assert.deepEqual(await p.evaluate(() => deck.spell.ignore), ['fotter'], 'the model key the build already honours');
      assert.deepEqual(await p.evaluate(() => [...(CSS.highlights.get('spell') || [])].map(r => r.toString()).sort()), ['Renewls', 'linkd', 'renewls'], 'and the paint drops it');
      // Safari paints NO text-decoration inside ::highlight(); reproduce that here and check the word is still marked.
      await p.addStyleTag({content: '::highlight(spell){text-decoration:none!important}'});
      const row = p.locator('#canvas [data-n="0"]');
      const on = await row.screenshot();
      await p.evaluate(() => setSpell(false)); await p.waitForTimeout(100);
      const off = await row.screenshot();
      assert.notEqual(Buffer.compare(on, off), 0, 'with the underline suppressed, as Safari suppresses it, the wash still marks the word');
      assert.deepEqual(p.errs, []);
    } finally { await b.close(); }
  });
}

live('spell: a 0.9 deck (a plain array of words, no suggestions) still paints and still opens the panel', async () => {
  const html = create(pmodel(), {spell: correct}).html.replace(/\/\*SPELL\*\/[\s\S]*?\/\*\/SPELL\*\//, '/*SPELL*/["fotter","linkd","renewls"]/*\/SPELL*/');
  const b = await pw.chromium.launch(); try {
    const p = await open(b, 'legacy.html', html);
    assert.deepEqual(await p.evaluate(() => [...CSS.highlights.get('spell')].map(r => r.toString()).sort()), ['Renewls', 'fotter', 'linkd', 'renewls']);
    await p.click('#spellbad');
    assert.deepEqual(await words(p), ['renewls', 'linkd', 'fotter']);
    assert.equal(await p.evaluate(() => $('spellmenu').querySelectorAll('.sg').length), 0, 'an old deck carries no suggestions — the panel still ignores and still counts');
    assert.deepEqual(p.errs, []);
  } finally { await b.close(); }
});

live('spell: on a phone the badge is a tap target and the panel fits the screen', async () => {
  const b = await pw.chromium.launch(); try {
    const ctx = await b.newContext({...pw.devices['iPhone 14']});
    const f = path.join(tmp, 'phone.html'); fs.writeFileSync(f, create(pmodel(), {spell: correct}).html);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(pathToFileURL(f).href); await p.waitForTimeout(200);
    const bx = await p.locator('#spellbad').boundingBox();
    assert.ok(bx.width >= 20 && bx.height >= 20, `the badge is a tap target on a coarse pointer: ${bx.width}×${bx.height}`);
    await p.tap('#spellbad'); await p.waitForTimeout(150);
    assert.equal(await p.evaluate(() => $('spellmenu').hidden), false, 'a tap opens it');
    const m = await p.locator('#spellmenu').boundingBox();
    assert.ok(m.x >= 0 && m.x + m.width <= 393, `the panel stays on screen: ${JSON.stringify(m)}`);
    assert.deepEqual(errs, []);
  } finally { await b.close(); }
});

// S5.1 — the flag line ends with the line an author pastes. The study spent a whole build on retyping the words into
// spell.ignore by hand; the CLI already knows them, lowercased exactly as the ignore list matches them.
test('spell: create prints a pasteable spell.ignore line, and pasting it silences the flags', async () => {
  if (!await loadChecker('en')) return;                                    // optional peer: the gate passes without it
  const m = path.join(tmp, 'paste.model.json'), out = path.join(tmp, 'paste.html');
  const build = model => {
    fs.writeFileSync(m, JSON.stringify(model));
    const r = spawnSync(process.execPath, [path.join(root, 'bin/create.mjs'), '--model', m, '--out', out], {encoding: 'utf8'});
    assert.equal(r.status, 0, r.stderr);
    return r.stderr;
  };
  const first = build(model());
  assert.match(first, /^spell: \d+ word\(s\) flagged/m);
  const line = first.split('\n').find(l => l.startsWith('spell: {'));
  assert.equal(line, 'spell: {"ignore": ["fotter", "linkd", "renewls"]}', 'the same words, lowercased, one paste away');
  const pasted = JSON.parse(line.slice('spell: '.length));                 // the value is JSON, so an author can paste it verbatim
  assert.doesNotMatch(build({...model(), spell: pasted}), /word\(s\) flagged/, 'pasting it silences the flags');
});
