// bug reports: one pure builder (template.html /*BUG*/ block, lifted by lib/bug.mjs) turns a fixed set of facts into a
// prefilled mailto to decklet@grunion.ai. The address is receive-only and the reporter edits everything before sending, so
// the whole contract is: (1) the facts triage needs are there, (2) nothing the deck SAYS can reach the mail, (3) every mail
// client opens it. Two doors: the ⓘ popover's "Report a bug" row and bin/bug.mjs.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {bugReport, bugFacts, scrub, BUG_TO, BUG_CAP, BUG_CATS} from '../lib/bug.mjs';
import {create} from '../bin/create.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const pkg = JSON.parse(read('package.json')).version;
const tpl = read('template.html');
const explainer = JSON.parse(read('examples/explainer/model.json'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-bug-'));
let pw = null; try { pw = await import('playwright'); } catch {}
const live = (name, fn) => test(name, {skip: pw ? false : 'playwright not installed'}, fn);

// every place a deck can carry a human's words or assets, each with its own sentinel: the guard fails if ANY reaches the mail
const SENTINEL = {
  text: 'ZQTEXT-9f1', slideName: 'ZQSLIDE-9f2', notes: 'ZQNOTES-9f3', alt: 'ZQALT-9f4', role: 'ZQROLE-9f5', color: '#9f6a2b',
  font: 'ZQFONT-9f7', img: 'data:image/png;base64,ZQIMG9f8', title: 'ZQTITLE-9f9', path: '/Users/zqowner/decks/ZQDIR/deck.html',
  logKey: 'ZQLOG-9fa', link: 'https://zqcustomer.example/ZQURL',
};
const leakyDeck = () => ({
  w: 960, h: 540, format: 'slides', id: 'abc123def4',
  styles: {roles: {Title: {font: SENTINEL.font, size: 64, weight: 800, lh: 68, color: SENTINEL.color}, [SENTINEL.role]: {font: 'serif', size: 12, weight: 400, lh: 16}}},
  slides: [
    {id: 's1', name: SENTINEL.slideName, notes: SENTINEL.notes, bg: SENTINEL.color, els: [
      {id: 'r1', x: 0, y: 0, w: 100, role: 'Title', text: SENTINEL.text, href: SENTINEL.link},
      {id: 'r2', x: 0, y: 200, w: 100, h: 100, img: SENTINEL.img, alt: SENTINEL.alt},
    ]},
    {id: 's2', els: []}, {id: 's3', els: []},
  ],
});
const leakyLog = [{s: 's1', r: 'r1', k: {text: [SENTINEL.logKey, SENTINEL.text]}}];
const noLeak = (s, where) => { for (const [k, v] of Object.entries(SENTINEL)) assert.ok(!s.includes(v), `${where} carries ${k} (${v})`); };

// ── the builder ──
test('bugReport: the subject is the [decklet] tag and a symptom the reporter overwrites; the body leads with the triage line', () => {
  const r = bugReport({engine: '0.7.0', format: 'slides', w: 960, h: 540, slides: 12, at: 3, mode: 'editing', client: 'Chrome/128 macOS', id: 'abc123def4', cat: 'looks', desc: 'Chips wrap on slide 3 after a retype', probes: [['rows', '7 (5 text · 1 box · 1 connector)'], ['clipped', '1']]});
  assert.equal(r.subject, '[ISSUE] decklet · Looks wrong · Chips wrap on slide 3 after a retype', 'the ISSUE tag leads, then the product, the category and the reporter\'s words');
  assert.equal(r.body.split('\n')[0], 'decklet 0.7.0 · slides 960×540 · 12 slides · on slide 3 · editing');
  assert.equal(r.body.split('\n')[1], 'Chrome/128 macOS');
  assert.equal(r.body.split('\n')[2], 'deck abc123def4 · looks');
  assert.ok(r.body.includes('\nLooks wrong\nrows       7 (5 text · 1 box · 1 connector)\nclipped    1\n'), 'the category block: aligned key/value probes under the category name\n' + r.body);
  assert.ok(r.body.includes('\nWhat happened\nChips wrap on slide 3 after a retype\n'), 'the description sits under What happened');
  assert.ok(r.body.includes('\nSteps to reproduce, if you can\n1. \n'), 'a steps prompt stays for the mail app');
  assert.deepEqual(Object.keys(BUG_CATS), ['looks', 'respond', 'save', 'crash'], 'four categories, fixed');
  assert.deepEqual(Object.values(BUG_CATS).map(c => c.label), ['Looks wrong', 'Won\'t respond', 'Save or PDF', 'Crashed']);
  assert.throws(() => bugReport({engine: '0.7.0', cat: 'other', mode: 'cli', client: 'x'}), /category/, 'a fifth category throws');
  const bare = bugReport({engine: '0.7.0', format: 'slides', w: 960, h: 540, slides: 1, mode: 'editing', client: 'x'});
  assert.equal(bare.subject, '[ISSUE] decklet', 'no category, no description: the tag and the product alone');
  assert.ok(bare.body.includes('\nWhat happened\n\n'), 'an empty description leaves the slot to type into');
  const long = bugReport({engine: '0.7.0', mode: 'cli', client: 'x', cat: 'crash', desc: 'y'.repeat(200)});
  assert.equal(long.subject.length, '[ISSUE] decklet · Crashed · '.length + 70, 'the subject takes the first 70 characters of the description');
  assert.ok(r.body.includes('A screenshot helps.'), 'asks for the one thing a mail can carry that the builder cannot');
  assert.ok(!/we will reply|reply from decklet@/i.test(r.body), 'the address is receive-only: no promise it will answer');
});
test('bugReport: the mailto is the address plus subject and body, percent-encoded so every client parses newlines and the tag', () => {
  const r = bugReport({engine: '0.7.0', format: 'slides', w: 960, h: 540, slides: 1, mode: 'editing', client: 'x'});
  assert.equal(BUG_TO, 'decklet@grunion.ai');
  assert.ok(r.mailto.startsWith('mailto:decklet@grunion.ai?subject=%5BISSUE%5D%20decklet'), r.mailto.slice(0, 60));
  assert.ok(r.mailto.includes('&body=decklet%200.7.0%20'), 'body is the second parameter, spaces as %20 (a + would arrive as a plus)');
  assert.ok(r.mailto.includes('%0A'), 'newlines survive as %0A');
  assert.ok(!r.mailto.includes('\n') && !r.mailto.includes(' '), 'no raw whitespace in the URL');
  const u = new URL(r.mailto); assert.equal(u.pathname, 'decklet@grunion.ai'); assert.equal(u.searchParams.get('subject'), r.subject); assert.equal(u.searchParams.get('body'), r.body);
});
test('bugReport: a tool snippet rides in the body as a fenced block, named by the tool, scrubbed', () => {
  const r = bugReport({engine: '0.7.0', format: 'slides', w: 960, h: 540, slides: 2, mode: 'cli', client: 'node v22 darwin 24.5.0', tool: 'verify', output: `parity  slide 1 ${SENTINEL.slideName}: FAIL {"rows":[{"text":"${SENTINEL.text}"}]}\nVERIFY FAIL`});
  assert.ok(r.body.includes('Tool output (verify)\nparity  slide 1: FAIL {…}\nVERIFY FAIL'), r.body);
  noLeak(r.body, 'tool snippet');
});
test('bugReport: the whole mailto stays under the cap whatever the inputs — the snippet is cut first, then the client string', () => {
  const long = 'x'.repeat(5000);
  const r = bugReport({engine: '0.7.0', format: 'slides', w: 960, h: 540, slides: 2, mode: 'cli', client: long, tool: 'verify', output: long});
  assert.equal(BUG_CAP, 2000);
  assert.ok(r.mailto.length <= BUG_CAP, `${r.mailto.length} > ${BUG_CAP}`);
  assert.ok(r.body.includes('Steps to reproduce'), 'the prompts survive the cut — only the snippet and the client string shrink');
  const d = bugReport({engine: '0.7.0', mode: 'cli', client: long, tool: 'verify', output: long, cat: 'looks', desc: 'the reporter\'s own words stay whole'});
  assert.ok(d.body.includes('the reporter\'s own words stay whole'), 'the description is never cut while the snippet and client can shrink');
  assert.ok(r.body.includes('[cut]'), 'a cut is marked so triage knows the tail is missing');
  const ok = bugReport({engine: '0.7.0', format: 'slides', w: 960, h: 540, slides: 2, mode: 'editing', client: 'Chrome'});
  assert.ok(!ok.body.includes('[cut]'), 'nothing is cut when nothing is long');
});
test('scrub: quoted strings, JSON payloads and directory paths leave a tool line; the shape of the line stays', () => {
  assert.equal(scrub(`parity  slide 2 ${SENTINEL.slideName}: FAIL {"rows":[{"text":"${SENTINEL.text}"}]}`), 'parity  slide 2: FAIL {…}');
  assert.equal(scrub(`ERROR   role "${SENTINEL.role}": missing size`), 'ERROR   role …: missing size');
  assert.equal(scrub(`occlusion slide 2: row 3 (Label '${SENTINEL.text}') under row 9 (box)`), 'occlusion slide 2: row 3 (Label …) under row 9 (box)');
  assert.equal(scrub(`wrote ${SENTINEL.path} · 402KB`), 'wrote deck.html · 402KB');
  assert.equal(scrub('C:\\Users\\zqowner\\Desktop\\deck.html: 0 errors, 1 warnings'), 'deck.html: 0 errors, 1 warnings');
  assert.equal(scrub('~/decks/q3/model.json: 2 errors, 0 warnings'), 'model.json: 2 errors, 0 warnings');
  assert.equal(scrub(`spell: 2 word(s) flagged — ${SENTINEL.text}, Acme (spell.ignore in the model silences a name)`), 'spell: 2 word(s) flagged — … (spell.ignore in the model silences a name)');
  assert.equal(scrub('VERIFY PASS'), 'VERIFY PASS');
});

// ── the guard: nothing a deck says can reach the mail ──
test('bugFacts: reads only the shape of a deck — format, size, slide count, id — never its words, tokens, assets, log or versions', () => {
  const deck = leakyDeck();
  const f = bugFacts(deck, {log: leakyLog, versions: [{at: 1, deck}], title: SENTINEL.title, file: SENTINEL.path});
  assert.deepEqual(Object.keys(f).sort(), ['format', 'h', 'id', 'slides', 'w'], 'the fact set is closed: a new key is a new leak review');
  assert.deepEqual(f, {format: 'slides', w: 960, h: 540, slides: 3, id: 'abc123def4'});
  for (const cat of Object.keys(BUG_CATS)) { const r = bugReport({...f, engine: pkg, mode: 'editing', client: 'Chrome', at: 1, cat, probes: [['errors', scrub(`TypeError: null is not an object (evaluating '${SENTINEL.text}') · 1047:12`)]]}); noLeak(r.subject, cat + ' subject'); noLeak(r.body, cat + ' body'); noLeak(decodeURIComponent(r.mailto), cat + ' mailto'); }
});
test('the builder is ONE source: template.html carries it between /*BUG*/ markers and lib/bug.mjs lifts that block', () => {
  const m = tpl.match(/\/\*BUG\*\/([\s\S]*?)\/\*\/BUG\*\//);
  assert.ok(m, 'template.html has a /*BUG*/ … /*/BUG*/ block');
  assert.match(m[1], /function bugReport\(/); assert.match(m[1], /function bugFacts\(/); assert.match(m[1], /const scrub=/); assert.match(m[1], /BUG_CATS=\{/);
  assert.doesNotMatch(m[1], /document\.|window\.|navigator\./, 'the block never touches the DOM, so node can lift it');
  assert.match(read('lib/bug.mjs'), /\\\*BUG\\\*/, 'lib/bug.mjs lifts the block rather than copying it');
  assert.ok(!/const BUG_TO=/.test(read('lib/bug.mjs').replace(/\/\/.*$/gm, '')), 'the address is defined once, in the template');
});

// ── the deck door: ⓘ → Report a bug ──
test('template: a HUD bug button (last in the view group) opens a native dialog: four category tiles, a description, Open mail app + Copy', () => {
  assert.match(tpl, /<button id="bug" class="mi mi-bug" data-ms="\d+" data-tip="Report a bug" aria-label="Report a bug" aria-haspopup="dialog">/, 'a real HUD control with the hover label and the motion beat');
  assert.ok(tpl.indexOf('id="bug"') > tpl.indexOf('id="helpwrap"') && tpl.indexOf('id="bug"') < tpl.indexOf('id="sheet"'), 'after ⓘ, inside #hud');
  assert.ok(!/<a id="bug"/.test(tpl), 'the popover anchor is gone: the button is the one door');
  assert.match(tpl, /<dialog id="bugdlg" aria-labelledby="bugdlg-title">/, 'a native <dialog>: showModal traps focus, Esc closes, the backdrop is free');
  assert.ok(tpl.indexOf('<dialog id="bugdlg"') > tpl.indexOf('id="sheet"'), 'the dialog sits outside #hud, so the HUD id set only gains the button');
  for (const k of ['looks', 'respond', 'save', 'crash']) assert.match(tpl, new RegExp(`<input type="radio" name="cat" value="${k}"`), `tile ${k}`);
  assert.match(tpl, /<textarea id="bugdesc" [^>]*maxlength="300"/, 'a short description, capped so the URL stays under the mailto ceiling');
  assert.match(tpl, /<a id="bugsend" class="primary" href="#"/, 'the primary action is an anchor whose href IS the mailto');
  assert.match(tpl, /id="bugcopy"/, 'Copy report for a mail client that cuts the body');
  assert.match(tpl, /nothing is sent until you do/, 'the footer says the mail is the reporter\'s to send');
  assert.match(tpl, /const ENGINE=\/\*ENGINE\*\/'0\.0\.0'\/\*\/ENGINE\*\/;/, 'create fills the ENGINE marker with the package version');
  assert.match(tpl, /window\.addEventListener\('error',/, 'an error ring so Crashed has something to say');
  assert.match(tpl, /addEventListener\('unhandledrejection',/);
  assert.match(tpl, /function bugProbe\(cat\)/, 'probes are one function outside the block, keyed by category');
});
test('create stamps the package version into the ENGINE marker; the SKILL.md HUD manifest is unchanged by the anchor', () => {
  const {html} = create(structuredClone(explainer), {title: 'bug'});
  assert.ok(html.includes(`const ENGINE=/*ENGINE*/'${pkg}'/*/ENGINE*/;`), `deck carries ENGINE='${pkg}'`);
  assert.ok(read('SKILL.md').includes('Report a bug'), 'SKILL.md documents the door');
  assert.match(read('SKILL.md'), /<!-- HUD: [^>]* help bug -->/, 'the HUD manifest ends in bug');
  assert.ok(read('README.md').includes('decklet@grunion.ai'), 'README names the address');
  assert.match(read('SECURITY.md'), /private vulnerability reporting/, 'security keeps GitHub private reporting');
  assert.match(read('SECURITY.md'), /decklet@grunion\.ai/, 'SECURITY.md routes ordinary bugs to the address');
  assert.match(read('llms.txt'), /\/\*ENGINE\*\//, 'llms.txt names the new marker');
});
live('live: opening ⓘ fills the anchor with a mailto that names the engine, the format, the slide, the mode — and none of the deck\'s words', async () => {
  const deck = leakyDeck();
  const f = path.join(tmp, 'leaky.html'); fs.writeFileSync(f, create(deck, {title: SENTINEL.title}).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#hud');
  await p.evaluate(() => setTimeout(() => { throw new Error(`boom (${'ZQTEXT-9f1'}) /Users/zqowner/x.js`); }, 0)); await p.waitForTimeout(60); // an UNCAUGHT error (async, so it reaches window.onerror) lands in the ring, scrubbed
  await p.click('#bug');
  assert.equal(await p.evaluate(() => document.getElementById('bugdlg').open), true, 'the dialog opens');
  assert.equal(await p.evaluate(() => document.querySelector('input[name=cat]:checked').value), 'looks', 'Looks wrong is the default tile');
  await p.fill('#bugdesc', 'Chips wrap on slide 3 after a retype');
  let href = await p.getAttribute('#bugsend', 'href');
  assert.ok(href.startsWith('mailto:decklet@grunion.ai?subject=%5BISSUE%5D%20decklet%20%C2%B7%20Looks%20wrong%20%C2%B7%20Chips'), href.slice(0, 120));
  let body = new URL(href).searchParams.get('body');
  assert.ok(body.startsWith(`decklet ${pkg} · slides 960×540 · 3 slides · on slide 1 · editing\n`), body.split('\n')[0]);
  assert.match(body.split('\n')[1], /Chrome|Chromium|HeadlessChrome/, 'the client line is the UA');
  assert.ok(body.includes('deck abc123def4 · looks · viewport 1280×800 · dpr 1 · '), body.split('\n')[2]);
  assert.match(body, /\nLooks wrong\nrows       2 \(1 text · 1 box · 0 connector\)\nclipped    \d+\n/, body);
  assert.ok(body.includes('\nWhat happened\nChips wrap on slide 3 after a retype\n'));
  noLeak(decodeURIComponent(href), 'live mailto (looks)');
  await p.click('label:has(input[name=cat][value=crash])'); // the radio is visually hidden; the tile is the label
  href = await p.getAttribute('#bugsend', 'href'); body = new URL(href).searchParams.get('body');
  assert.match(body, /\nCrashed\nerrors     (Uncaught )?Error: boom \(…\) x\.js · \d+:\d+\n/, 'the ring carries the scrubbed error: no sentinel, no directory\n' + body);
  assert.match(body, /\nuptime     \d+ s\ndrawn      2 of 2 rows\n/, body);
  noLeak(decodeURIComponent(href), 'live mailto (crash)');
  await p.click('label:has(input[name=cat][value=save])'); // the radio is visually hidden; the tile is the label
  body = new URL(await p.getAttribute('#bugsend', 'href')).searchParams.get('body');
  assert.match(body, /\nSave or PDF\nautosave   (ok|local|bad)\nfile access (yes|no)\nversions   \d+ · \d+ edits not in the file\npdf route  (print|raster)\n/, body);
  await p.click('label:has(input[name=cat][value=respond])'); // the radio is visually hidden; the tile is the label
  body = new URL(await p.getAttribute('#bugsend', 'href')).searchParams.get('body');
  assert.match(body, /\nWon't respond\npointer    (mouse|touch)\nselection  \d+ rows?\nautosave   (ok|local|bad) · \d+ edits not in the file\n/, body);
  assert.ok(new URL(await p.getAttribute('#bugsend', 'href')).toString().length <= BUG_CAP, 'live URL under the cap');
  await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(() => document.getElementById('bugdlg').open), false, 'Esc closes');
  await p.keyboard.press('ArrowRight'); await p.evaluate(() => setPresent(true, true));
  await p.evaluate(() => bugOpen());
  body = new URL(await p.getAttribute('#bugsend', 'href')).searchParams.get('body');
  assert.ok(body.includes('· on slide 2 · presenting'), body.split('\n')[0]);
  assert.ok(!body.includes('ZQ'), 'present-mode report is as clean');
  await b.close();
});

// ── the CLI door: bin/bug.mjs ──
test('bin/bug.mjs: prints the body and the mailto; a deck names its built-with version; --log scrubs a tool run into the body', () => {
  const f = path.join(tmp, 'cli.html'); fs.writeFileSync(f, create(leakyDeck(), {title: SENTINEL.title}).html.replace(`/*ENGINE*/'${pkg}'/*/ENGINE*/`, "/*ENGINE*/'0.6.1'/*/ENGINE*/"));
  const logf = path.join(tmp, 'verify.log'); fs.writeFileSync(logf, `parity  slide 1 ${SENTINEL.slideName}: FAIL {"rows":[{"text":"${SENTINEL.text}"}]}\nwrote ${SENTINEL.path}\nVERIFY FAIL\n`);
  const out = execFileSync('node', [path.join(root, 'bin/bug.mjs'), f, '--tool', 'verify', '--log', logf, '--category', 'looks', '--desc', 'verify fails on a clean two-column layout'], {encoding: 'utf8'});
  assert.ok(out.startsWith('Subject: [ISSUE] decklet · Looks wrong · verify fails on a clean two-column layout\n'), out.split('\n')[0]);
  assert.ok(out.includes(`decklet ${pkg} (this deck was built with 0.6.1) · slides 960×540 · 3 slides · cli\n`), out.split('\n')[0]);
  assert.match(out, /node v\d+\.\d+\.\d+ · (darwin|linux|win32) /, 'the client line is node + platform + release');
  assert.ok(out.includes('Tool output (verify)\nparity  slide 1: FAIL {…}\nwrote deck.html\nVERIFY FAIL'), out);
  assert.match(out, /^mailto:decklet@grunion\.ai\?subject=%5BISSUE%5D/m, 'the last line is the mailto to paste or open');
  assert.throws(() => execFileSync('node', [path.join(root, 'bin/bug.mjs'), '--category', 'nope'], {encoding: 'utf8', stdio: 'pipe'}), /category/, 'an unknown category is refused');
  noLeak(out, 'cli output');
  const bare = execFileSync('node', [path.join(root, 'bin/bug.mjs')], {encoding: 'utf8'});
  assert.ok(bare.includes(`decklet ${pkg} · cli\n`), 'no deck: the engine line is the CLI version alone');
});
test('bin/bug.mjs is a package bin and the docs name it', () => {
  assert.equal(JSON.parse(read('package.json')).bin['decklet-bug'], 'bin/bug.mjs');
  assert.ok(read('README.md').includes('bin/bug.mjs'), 'README names the CLI door');
  assert.ok(read('llms.txt').includes('bin/bug.mjs'), 'llms.txt maps the file');
});
