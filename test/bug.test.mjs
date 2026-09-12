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
import {bugReport, bugFacts, scrub, BUG_TO, BUG_CAP} from '../lib/bug.mjs';
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
  const r = bugReport({engine: '0.7.0', format: 'slides', w: 960, h: 540, slides: 12, at: 3, mode: 'editing', client: 'Chrome/128 macOS', id: 'abc123def4'});
  assert.equal(r.subject, '[decklet] <what you saw, in a few words>');
  assert.equal(r.body.split('\n')[0], 'decklet 0.7.0 · slides 960×540 · 12 slides · on slide 3 · editing');
  assert.equal(r.body.split('\n')[1], 'Chrome/128 macOS');
  assert.equal(r.body.split('\n')[2], 'deck abc123def4');
  for (const h of ['What I did', 'What I expected', 'What happened instead']) assert.ok(r.body.includes(h + '\n'), `body carries the "${h}" prompt`);
  assert.ok(r.body.includes('A screenshot helps.'), 'asks for the one thing a mail can carry that the builder cannot');
  assert.ok(!/we will reply|reply from decklet@/i.test(r.body), 'the address is receive-only: no promise it will answer');
});
test('bugReport: the mailto is the address plus subject and body, percent-encoded so every client parses newlines and the tag', () => {
  const r = bugReport({engine: '0.7.0', format: 'slides', w: 960, h: 540, slides: 1, mode: 'editing', client: 'x'});
  assert.equal(BUG_TO, 'decklet@grunion.ai');
  assert.ok(r.mailto.startsWith('mailto:decklet@grunion.ai?subject=%5Bdecklet%5D%20'), r.mailto.slice(0, 60));
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
  assert.ok(r.body.includes('What happened instead'), 'the prompts survive the cut — only the snippet and the client string shrink');
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
  const r = bugReport({...f, engine: pkg, mode: 'editing', client: 'Chrome', at: 1});
  noLeak(r.subject, 'subject'); noLeak(r.body, 'body'); noLeak(decodeURIComponent(r.mailto), 'mailto');
});
test('the builder is ONE source: template.html carries it between /*BUG*/ markers and lib/bug.mjs lifts that block', () => {
  const m = tpl.match(/\/\*BUG\*\/([\s\S]*?)\/\*\/BUG\*\//);
  assert.ok(m, 'template.html has a /*BUG*/ … /*/BUG*/ block');
  assert.match(m[1], /function bugReport\(/); assert.match(m[1], /function bugFacts\(/); assert.match(m[1], /const scrub=/);
  assert.match(read('lib/bug.mjs'), /\\\*BUG\\\*/, 'lib/bug.mjs lifts the block rather than copying it');
  assert.ok(!/const BUG_TO=/.test(read('lib/bug.mjs').replace(/\/\/.*$/gm, '')), 'the address is defined once, in the template');
});

// ── the deck door: ⓘ → Report a bug ──
test('template: the ⓘ popover carries a Report a bug anchor; the engine version rides in the file for the report to read', () => {
  assert.match(tpl, /<a id="bug" href="#" [^>]*>Report a bug<\/a>/, 'an anchor, so the HUD manifest (buttons and spans) is unchanged');
  assert.ok(tpl.indexOf('id="bug"') > tpl.indexOf('id="helpmenu"') && tpl.indexOf('id="bug"') < tpl.indexOf('id="sheet"'), 'it lives inside the ⓘ popover');
  assert.match(tpl, /const ENGINE=\/\*ENGINE\*\/'0\.0\.0'\/\*\/ENGINE\*\/;/, 'create fills the ENGINE marker with the package version');
  assert.match(tpl, /nothing is sent until you do/, 'the row says the mail is the reporter\'s to send');
});
test('create stamps the package version into the ENGINE marker; the SKILL.md HUD manifest is unchanged by the anchor', () => {
  const {html} = create(structuredClone(explainer), {title: 'bug'});
  assert.ok(html.includes(`const ENGINE=/*ENGINE*/'${pkg}'/*/ENGINE*/;`), `deck carries ENGINE='${pkg}'`);
  assert.ok(read('SKILL.md').includes('Report a bug'), 'SKILL.md documents the door');
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
  await p.click('#help');
  let href = await p.getAttribute('#bug', 'href');
  assert.ok(href.startsWith('mailto:decklet@grunion.ai?subject=%5Bdecklet%5D'), href.slice(0, 80));
  let body = new URL(href).searchParams.get('body');
  assert.ok(body.startsWith(`decklet ${pkg} · slides 960×540 · 3 slides · on slide 1 · editing\n`), body.split('\n')[0]);
  assert.match(body.split('\n')[1], /Chrome|Chromium|HeadlessChrome/, 'the client line is the UA');
  assert.ok(body.includes('deck abc123def4'), 'deck id rides');
  noLeak(decodeURIComponent(href), 'live mailto');
  await p.keyboard.press('Escape'); await p.keyboard.press('ArrowRight');
  await p.evaluate(() => { setPresent(true, true); help(true); });
  href = await p.getAttribute('#bug', 'href'); body = new URL(href).searchParams.get('body');
  assert.ok(body.includes('· on slide 2 · presenting'), body.split('\n')[0]);
  await b.close();
});

// ── the CLI door: bin/bug.mjs ──
test('bin/bug.mjs: prints the body and the mailto; a deck names its built-with version; --log scrubs a tool run into the body', () => {
  const f = path.join(tmp, 'cli.html'); fs.writeFileSync(f, create(leakyDeck(), {title: SENTINEL.title}).html.replace(`/*ENGINE*/'${pkg}'/*/ENGINE*/`, "/*ENGINE*/'0.6.1'/*/ENGINE*/"));
  const logf = path.join(tmp, 'verify.log'); fs.writeFileSync(logf, `parity  slide 1 ${SENTINEL.slideName}: FAIL {"rows":[{"text":"${SENTINEL.text}"}]}\nwrote ${SENTINEL.path}\nVERIFY FAIL\n`);
  const out = execFileSync('node', [path.join(root, 'bin/bug.mjs'), f, '--tool', 'verify', '--log', logf], {encoding: 'utf8'});
  assert.ok(out.includes(`decklet ${pkg} (this deck was built with 0.6.1) · slides 960×540 · 3 slides · cli\n`), out.split('\n')[0]);
  assert.match(out, /node v\d+\.\d+\.\d+ · (darwin|linux|win32) /, 'the client line is node + platform + release');
  assert.ok(out.includes('Tool output (verify)\nparity  slide 1: FAIL {…}\nwrote deck.html\nVERIFY FAIL'), out);
  assert.match(out, /^mailto:decklet@grunion\.ai\?subject=%5Bdecklet%5D/m, 'the last line is the mailto to paste or open');
  noLeak(out, 'cli output');
  const bare = execFileSync('node', [path.join(root, 'bin/bug.mjs')], {encoding: 'utf8'});
  assert.ok(bare.includes(`decklet ${pkg} · cli\n`), 'no deck: the engine line is the CLI version alone');
});
test('bin/bug.mjs is a package bin and the docs name it', () => {
  assert.equal(JSON.parse(read('package.json')).bin['decklet-bug'], 'bin/bug.mjs');
  assert.ok(read('README.md').includes('bin/bug.mjs'), 'README names the CLI door');
  assert.ok(read('llms.txt').includes('bin/bug.mjs'), 'llms.txt maps the file');
});
