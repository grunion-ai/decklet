// decklet gate — engine contract + validator + create + import-html (pure) + live browser proofs (Playwright, skipped when absent)
// run: npm test   (= node --test test/**/*.test.mjs)
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validate, ROLES, ANIMS} from '../bin/validate.mjs';
import {create, FORMAT} from '../bin/create.mjs';
import {assemble, extractInPage, classify, detectTitle} from '../bin/import-html.mjs';
import {verify, modelOf} from '../bin/verify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const tpl = read('template.html'), deck = read('deck.html');
const example = n => ({model: JSON.parse(read(`examples/${n}/model.json`)), style: fs.existsSync(path.join(root, `examples/${n}/style.json`)) ? JSON.parse(read(`examples/${n}/style.json`)) : null});
const explainer = example('explainer');
const withRoles = m => create(m, {}).deck; // fills neutral roles exactly like the CLI does
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-'));

// ── 1. the core guarantee: single file, zero network ──
test('template + deck are self-contained (no external src/href, loaders, sockets)', () => {
  for (const [n, h] of [['template', tpl], ['deck', deck]]) {
    assert.doesNotMatch(h, /(src|href)\s*=\s*["']https?:/i, `${n}: external src/href`);
    assert.doesNotMatch(h, /@import|<link[^>]+stylesheet|fetch\s*\(|XMLHttpRequest|new\s+WebSocket/i, `${n}: external loader`);
    assert.match(h, /const store=\{get:/, `${n}: storage shim`);
    assert.equal((h.match(/localStorage\./g) || []).length, 3, `${n}: storage API only inside the shim`);
  }
});
test('no client or brand residue in the public tree', () => {
  const files = fs.globSync('**/*.{html,mjs,md,json,txt,yml}', {cwd: root}).filter(f => !/node_modules|^\.git\/|^test\//.test(f));
  // base64 payloads (the inlined clips) are not prose — a random three-letter run inside one is not residue
  const prose = f => read(f).replace(/base64,[A-Za-z0-9+/=]+/g, 'base64,…');
  for (const f of files) assert.doesNotMatch(prose(f), /ponytail|Approach C|deckC[0-9]|Presenton|PPTist|undersight|underchat|AFB|Sajit|grunion-internal/, `${f}: residue`);
});

// ── 2. engine static contract (the rules the editor is built on) ──
test('template markers + per-deck storage namespace', () => {
  assert.match(tpl, /<title>\/\*TITLE\*\/[^<]*\/\*\/TITLE\*\/<\/title>/);
  assert.match(tpl, /:root\{\/\*TOKENS\*\/[^}]*\/\*\/TOKENS\*\/;--W:/);
  assert.match(tpl, /const DECK=\/\*DECK\*\/\{[\s\S]*?\}\/\*\/DECK\*\/;/);
  assert.match(tpl, /const NS=\/\*KEY\*\/'decklet:template'\/\*\/KEY\*\/,KEY=NS\+':model',HKEY=NS\+':hist'/);
  assert.match(deck, /const NS=\/\*KEY\*\/'decklet:[0-9a-f]{10}'\/\*\/KEY\*\//, 'deck: namespace stamped from the model hash');
});
test('editing: double-click via detail, multiselect, undo stack (persisted, capped), click-off deselect', () => {
  assert.match(tpl, /e\.detail>=2/); assert.match(tpl, /e\.metaKey\|\|e\.ctrlKey/); assert.match(tpl, /function undo/);
  assert.match(tpl, /store\.get\(HKEY\)\|\|'\[\]'/); assert.match(tpl, /history\.length>50/);
  assert.match(tpl, /if\(!t\)\{if\(sel\.size\)\{sel\.clear\(\);render\(\)\}return\}/); assert.match(tpl, /\$\('wrap'\)\.addEventListener\('mousedown'/);
});
test('commitEdit runs first on every path that destroys the live editor', () => {
  assert.match(tpl, /function commitEdit\(\)\{\n\s*const t=canvas\.querySelector\('\.el\[contenteditable="true"\]'\)/);
  for (const re of [/const nav=d=>\{commitEdit\(\);/, /'sadd'\)\.onclick=\(\)=>\{commitEdit\(\);/, /const fs=\(\)=>\{commitEdit\(\);/, /'beforeprint',\(\)=>\{commitEdit\(\);/, /function sheetOpen\(\)\{commitEdit\(\);/, /t\.onblur=commitEdit;/, /el\.html=t\.innerHTML;delete el\.text/]) assert.match(tpl, re);
});
test('renderer adds nothing implicit; chrome lives on box/tile only', () => {
  assert.match(tpl, /\.el\{position:absolute;cursor:grab;padding:0;border-radius:0;white-space:normal;line-height:normal\}/);
  assert.match(tpl, /\.el\.box\{[^}]*padding:6px 8px;border-radius:8px;white-space:pre-wrap\}/);
  assert.match(tpl, /\.el\.tile\{/);
  for (const re of [/r\.svg\)d\.innerHTML=r\.svg/, /else if\(r\.html\)d\.innerHTML=r\.html/, /s\.bg\|\|'var\(--card\)'/, /letter-spacing:\$\{r\.ls\}px/, /line-height:\$\{r\.lh\}px/, /text-transform:\$\{r\.tt\}/, /white-space:\$\{r\.ws\}/, /font-style:italic/, /opacity:\$\{r\.op\}/, /border-top:\$\{r\.bt\}/, /box-shadow:\$\{r\.shadow\}/, /r\.nowrap\?'white-space:nowrap;'/, /r\.w==='auto'\?'auto'/, /deck\.styles\.pad\[r\.p\]/, /r\.line\)/, /conic-gradient\(/, /r\.h\?/]) assert.match(tpl, re, String(re));
});
test('selection chrome: nib only for one painting row, never in present mode; present hides HUD/toolbar (sheet stays usable)', () => {
  assert.match(tpl, /sel\.size===1&&!present\(\)/); assert.match(tpl, /paints\(r\)&&r\.w!==0&&r\.h!==0/);
  assert.match(tpl, /body\.present #hud,body\.present #tb,body\.present \.h\{display:none!important\}/);
  assert.match(tpl, /const pinned=\(\)=>addmenu\.classList\.contains\('open'\)\|\|!tb\.hidden\|\|!sheet\.hidden/, 'peek HUD stays pinned while a menu/toolbar/sheet is open');
  assert.match(tpl, /document\.body\.style\.background=present\(\)\?\(s\.bg\|\|'var\(--card\)'\):''/);
});
test('master layer: partial fork on edit, hide per slide, footer carries the inline counter on the margin, on screen and in print', () => {
  for (const re of [/function fork\(id\)\{slide\(\)\.els\.push\(\{override:id\}\)/, /const MG=\(\)=>deck\.styles&&deck\.styles\.margin!=null\?deck\.styles\.margin/, /d\.style\.right=MG\(\)\+'px'/, /\(s\.hide\|\|\[\]\)\.includes\(m\.id\)/, /d\.dataset\.footer='1'/, /root\.querySelector\('\[data-footer\]'\)/, /className=f\?'num':'num pin'/, /num\(cv,n\+1\)/, /pg\.style\.background=s\.bg\|\|'var\(--card\)'/]) assert.match(tpl, re, String(re));
});
test('slots: deck-scope slots under per-layout slots; + Text binds a free slot; promote actions exist', () => {
  assert.match(tpl, /const LAY=s=>\(\{\.\.\.\(deck\.slots\|\|\{\}\),\.\.\.\(\(deck\.layouts\|\|\{\}\)\[s\.layout\]\|\|\{\}\)\}\)/);
  assert.match(tpl, /const free=Object\.keys\(LAY\(s\)\)\.find\(n=>!s\.els\.some\(e=>e\.slot===n\)\)/);
  assert.match(tpl, /text:\{[^}]*role:'Body'/); assert.match(tpl, /id="tb-layout"/); assert.match(tpl, /id="tb-master"/);
});
test('roles are the type system: eight complete roles in the template, locked keys, B/I/U/S + sub/sup marks, NO font/size/color pickers', () => {
  const m = modelOf(tpl);
  assert.deepEqual(Object.keys(m.styles.roles), ROLES);
  for (const r of Object.values(m.styles.roles)) for (const p of ['font', 'size', 'weight', 'lh', 'color']) assert.ok(r[p] != null, p); // the template's own roles carry lh
  assert.match(tpl, /data-cmd="bold"[\s\S]*data-cmd="italic"[\s\S]*data-cmd="underline"[\s\S]*data-cmd="strikeThrough"[\s\S]*data-cmd="subscript"[\s\S]*data-cmd="superscript"/);
  assert.match(tpl, /\.el sub,\.el sup\{font-size:inherit;line-height:0/, 'sub/sup never change size');
  assert.match(tpl, /const LOCK=\['font','size','lh','ls'\]/); assert.match(tpl, /if\(r\[k\]==null\|\|LOCK\.includes\(k\)\)r\[k\]=t\[k\]/, 'role always wins the locked keys');
  assert.doesNotMatch(tpl, /<select|type="color"|font-picker|fontFamily|id="font|id="size|id="color/);
  assert.match(tpl, /\['weight','color','tt','italic'\]\.forEach\(p=>delete el\[p\]\)/, 'applying a role clears the row-level overrides');
  assert.doesNotMatch(tpl, /r\.mono\?/, 'mono is not a row prop — Label is the mono role');
});
test('HUD contract is a set: ‹ · › · + (Text/Box/Slide) · ⊞ · ⤓ · ⛶', () => {
  assert.match(tpl, /<button id="prev" title="Previous slide \(←\)" aria-label="Previous slide \(←\)">‹<\/button>/, 'prev is icon-only'); assert.match(tpl, /<button id="next" title="Next slide \(→\)" aria-label="Next slide \(→\)">›<\/button>/, 'next is icon-only');
  const ids = [...tpl.matchAll(/<div id="hud">[\s\S]*?<\/div>\n<div id="sheet"/g)][0][0].match(/id="([^"]+)"/g).map(s => s.slice(4, -1)).filter(s => s !== 'hud' && s !== 'sheet').sort();
  assert.deepEqual(ids, ['add-box', 'add-text', 'addbtn', 'addmenu', 'addwrap', 'autosave', 'fs', 'grid-btn', 'next', 'pdf', 'prev', 'sadd']);
  // autosave indicator: the shim's set reports success; save() drives the dot; reduced motion kills glow + pulse
  assert.match(tpl, /set:\(k,v\)=>\{try\{localStorage\.setItem\(k,v\);return true\}catch\{return false\}\}/, 'store.set returns boolean'); assert.match(tpl, /<span id="autosave" role="status"/); assert.match(tpl, /prefers-reduced-motion:reduce\)\{#autosave\{box-shadow:none;animation:none!important\}\}/);
  assert.match(tpl, /\$\('pdf'\)\.onclick=\(\)=>exportPdf\(\)\.catch\(\(\)=>print\(\)\)/, '⤓ writes a PDF in-file; print() is the fallback'); assert.match(tpl, /requestFullscreen/);
});
test('⤓ PDF writer: slide-sized pages from foreignObject rasters, byte-exact xref, zero dependencies', () => {
  for (const re of [/async function exportPdf\(\)\{\n\s*commitEdit\(\)/, /<foreignObject width="\$\{W\}" height="\$\{H\}">/, /'data:image\/svg\+xml;charset=utf-8,'\+encodeURIComponent\(svg\)/, /c\.toDataURL\('image\/jpeg',\.92\)/, /\/MediaBox \[0 0 \$\{W\} \$\{H\}\]/, /\/Filter \/DCTDecode/, /startxref\\n\$\{x\}\\n%%EOF/, /type:'application\/pdf'/, /\.pdf';a\.click\(\)/]) assert.match(tpl, re, String(re));
  assert.doesNotMatch(tpl, /jspdf|pdf-lib|html2canvas/i);
});
test('contact sheet: 3 across, pointer-drag reorder with FLIP (no HTML5 DnD), never deletes the last slide, ⌘C/⌘V/⌘D/⌘Z', () => {
  assert.match(tpl, /#grid\{display:grid;grid-template-columns:repeat\(3,1fr\)/);
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) assert.match(tpl, new RegExp(`grid\\.addEventListener\\('${ev}'`), ev);
  assert.doesNotMatch(tpl, /c\.draggable=true|addEventListener\('drop'/, 'no HTML5 drag-and-drop');
  assert.match(tpl, /\.cell\.lift\{/); assert.match(tpl, /\.cell\.drop\{/); assert.match(tpl, /Math\.hypot\(dx,dy\)<6/); assert.match(tpl, /prefers-reduced-motion:reduce/);
  assert.match(tpl, /if\(del\.length>=deck\.slides\.length\)del\.pop\(\)/);
  // thumbnails are non-interactive renders: never selectable; a drag never runs native text selection alongside it
  assert.match(tpl, /#sheet\{[^}]*user-select:none/, 'sheet is user-select:none'); assert.match(tpl, /\.cell\{[^}]*user-select:none/, 'cells are user-select:none'); assert.match(tpl, /body\.dragging\{[^}]*user-select:none/, 'body.dragging is user-select:none');
  assert.match(tpl, /closest\('\.cell'\);if\(!c\)return;e\.preventDefault\(\);/, 'press on a cell preventDefaults'); assert.match(tpl, /pd\.on=true;e\.preventDefault\(\);getSelection\(\)\.removeAllRanges\(\);document\.body\.classList\.add\('dragging'\)/, 'drag start preventDefaults, clears selection, flags body');
  for (const k of ['c', 'v', 'd', 'z']) assert.match(tpl, new RegExp(`mod&&k==='${k}'`));
});
test('print: named page sizes only (Safari), per-page bg, A4 injected from deck.page', () => {
  assert.match(tpl, /@page\{size:letter;margin:0\}/); assert.doesNotMatch(tpl, /@page\{size:\d+px/);
  assert.match(tpl, /PW=PAGE==='a4'\?794:816/); assert.match(tpl, /st\.textContent='@page\{size:a4;margin:0\}'/);
});

// ── 2b. motion: a four-word vocabulary, replayed on slide ENTRY only, absent from print/parity/reduced motion ──
test('motion: rise · fade · pop · wipe are the whole vocabulary; unknown anims paint nothing', () => {
  assert.match(tpl, /const ANIM=\['rise','fade','pop','wipe'\]/, 'renderer whitelists the vocabulary');
  assert.match(tpl, /const an=animate&&ANIM\.includes\(r\.anim\)\?r\.anim:''/, 'an unknown anim gets no class and no stagger slot');
  for (const a of ['rise', 'fade', 'pop', 'wipe']) {
    assert.match(tpl, new RegExp(`\\.el\\.${a}\\{animation:${a} `), a + ': class');
    assert.match(tpl, new RegExp(`@keyframes ${a}\\{`), a + ': keyframes');
  }
  assert.match(tpl, /@media \(prefers-reduced-motion:reduce\)\{\.el\.rise,\.el\.fade,\.el\.pop,\.el\.wipe\{animation:none\}\}/, 'one guard turns all four off');
  assert.match(tpl, /if\(an\)d\.style\.animationDelay=\(a\+\+\*120\)\+'ms'/, '120 ms stagger, counted over animated rows only');
  assert.match(tpl, /let lastAnim=-1/); assert.match(tpl, /animate=i!==lastAnim/, 'entry only — drag/select re-renders never restagger');
  assert.equal((tpl.match(/drawEls\([^)]*,false\)/g) || []).length, 3, 'print + contact sheet + PDF rasteriser draw un-animated');
  assert.match(read('bin/verify.mjs'), /\.el\{animation:none!important\}/, 'parity measures the settled frame');
});

test('validator: anim must be one of the four', () => {
  const v = validate(withRoles({w: 960, h: 540, slides: [{els: [
    {x: 0, y: 0, w: 100, role: 'Body', anim: 'rise', text: 'ok'},
    {x: 0, y: 0, w: 100, role: 'Body', anim: 'spin', text: 'invented'},
  ]}]}));
  assert.equal(v.errors.length, 1); assert.match(v.errors[0], /anim "spin"/);
  assert.deepEqual(ANIMS, ['rise', 'fade', 'pop', 'wipe']);
});

// ── 3. deck.html is exactly what create() produces from the explainer model (determinism + self-hosting) ──
test('deck.html == create(examples/explainer)', () => {
  const {html} = create(explainer.model, {title: 'decklet'});
  assert.equal(html, deck, 'rebuild with: node bin/create.mjs --model examples/explainer/model.json --out deck.html --title decklet');
  const m = modelOf(deck);
  assert.equal(m.slides.length, 12); assert.equal(m.master.filter(x => x.footer).length, 1);
  assert.ok(m.slides.every(s => s.layout && s.els.some(e => e.slot === 'title')), 'every explainer slide is slotted');
  assert.equal(m.layouts.title.title.role, 'Title', 'cover headline uses the display role'); assert.equal(m.layouts.content.title.role, 'H1');
  assert.equal(m.styles.margin, 60, 'explainer sets the margin token');
  assert.ok(JSON.stringify(m).includes('foreignObject'), 'explainer mentions the in-file PDF writer');
});

test('explainer: the deck moves the way it documents, and shows the editor as filmed clips', () => {
  const m = modelOf(deck);
  const anims = [...new Set(m.slides.flatMap(s => s.els.map(e => e.anim)).filter(Boolean))].sort();
  assert.deepEqual(anims, ['fade', 'pop', 'rise', 'wipe'], 'the deck demonstrates every anim it documents');
  const clips = m.slides.flatMap(s => s.els.filter(e => e.img));
  assert.ok(clips.length >= 3, `${clips.length} clips — the editor slide films drag, reorder and PDF`);
  for (const r of clips) {
    assert.match(r.img, /^data:image\/gif;base64,/, 'a clip is an inlined GIF — still zero network');
    assert.ok(typeof r.w === 'number' && typeof r.h === 'number', 'a clip row is a fixed rect, so parity can measure it');
    assert.ok(r.img.length < 400_000, `clip is ${Math.round(r.img.length / 1024)} KB of base64 — keep the file portable`);
  }
  assert.ok(deck.length < 1_400_000, `deck.html is ${Math.round(deck.length / 1024)} KB — the one-file promise has a ceiling`);
});

// ── 4. validator ──
test('validator: explainer + three examples are clean', () => {
  for (const n of ['explainer', 'quarterly-update', 'launch-carousel', 'one-pager']) {
    const {model, style} = example(n); const v = validate(create(model, {style}).deck);
    assert.deepEqual(v.errors, [], n); assert.deepEqual(v.warnings, [], n + ' warnings');
  }
});
test('validator: rejects size/font overrides, unknown roles/slots/layouts, bad master refs, html with size runs, non-data img', () => {
  const bad = withRoles({w: 960, h: 540, layouts: {content: {title: {x: 0, y: 0, w: 100, role: 'H1'}}}, master: [{id: 'foot', footer: 1, x: 0, y: 0, w: 100, role: 'Label', text: 'x'}], slides: [
    {layout: 'content', els: [
      {slot: 'title', text: 'ok'},
      {x: 0, y: 0, w: 100, role: 'Body', size: 18, text: 'size override'},
      {x: 0, y: 0, w: 100, role: 'Body', font: 'Comic Sans', text: 'font override'},
      {x: 0, y: 0, w: 100, role: 'Nope', text: 'unknown role'},
      {slot: 'nope', text: 'unknown slot'},
      {x: 0, y: 0, w: 100, text: 'no role at all'},
      {x: 0, y: 0, w: 100, role: 'Body', html: '<span style="font-size:30px">run</span>'},
      {x: 0, y: 0, w: 100, role: 'Body', override: 'ghost', text: 'bad override'},
      {x: 0, y: 0, w: 100, img: 'https://x/y.png'},
      {x: 0, y: 0, w: 100, donut: 140},
    ], hide: ['ghost']},
    {layout: 'missing', els: []},
  ]});
  const v = validate(bad);
  assert.equal(v.ok, false);
  for (const re of [/overrides size/, /overrides font/, /role "Nope"/, /slot "nope"/, /has no role/, /runs carry size/, /override "ghost"/, /img must be a data: URI/, /donut must be 0\.\.100/, /hide "ghost"/, /layout "missing"/]) assert.ok(v.errors.some(e => re.test(e)), String(re));
});
test('validator: warns on hardcoded counters, likely overflow, raw css, off-canvas rows', () => {
  const v = validate(withRoles({w: 960, h: 540, slides: [{els: [
    {x: 0, y: 0, w: 100, role: 'Label', text: '3 / 9'},
    {x: 0, y: 0, w: 60, role: 'Body', nowrap: 1, text: 'this is far too long for sixty pixels'},
    {x: 0, y: 0, w: 100, role: 'Body', css: 'transform:rotate(1deg)', text: 'css'},
    {x: 900, y: 0, w: 200, role: 'Body', text: 'off the edge'},
  ]}]}));
  assert.equal(v.ok, true);
  for (const re of [/hardcoded page counter/, /likely wider than w=60/, /raw css/, /past the right edge/]) assert.ok(v.warnings.some(w => re.test(w)), String(re));
});
test('validator: structural errors', () => {
  assert.ok(validate(null).errors.length); assert.ok(validate({w: 1, h: 1, styles: {roles: {}}, slides: []}).errors.some(e => /slides must be/.test(e)));
  assert.ok(validate({w: 1, h: 1, styles: {roles: {}}, slides: [{els: []}]}).errors.some(e => /styles\.roles missing/.test(e)));
  assert.ok(validate({w: 1, h: 1, styles: {roles: {H1: {font: 'x'}}}, slides: [{els: []}]}).errors.some(e => /role H1: missing size/.test(e)));
  assert.ok(validate({w: 1, h: 1, format: 'poster', styles: {roles: {}}, slides: [{els: []}]}).errors.some(e => /format "poster"/.test(e)));
});

// ── 5. create ──
test('create: format presets set canvas + page; --space overrides; model w/h wins over preset', () => {
  const m = {styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: []}]};
  for (const [f, p] of Object.entries(FORMAT)) { const d = create(m, {format: f}).deck; assert.deepEqual([d.w, d.h, d.page, d.format], [p.w, p.h, p.page, f], f); }
  assert.deepEqual((d => [d.w, d.h])(create(m, {format: 'slides', space: '1600x900'}).deck), [1600, 900]);
  assert.deepEqual((d => [d.w, d.h])(create({...m, w: 1200, h: 700}, {format: 'slides'}).deck), [1200, 700]);
  assert.throws(() => create(m, {format: 'poster'}), /unknown format/);
});
test('create: style.json tokens land in :root, roles merge (model wins per role), no roles anywhere → template neutral scale', () => {
  const style = {tokens: {accent: '#FF0000', bg: '#000'}, roles: {H1: {font: 'Georgia', size: 50, weight: 700, lh: 56, color: '#fff'}}};
  const {html, deck: d} = create({styles: {roles: {Body: {font: 'x', size: 10, weight: 400, lh: 12, color: '#000'}}}, slides: [{els: []}]}, {style});
  assert.match(html, /:root\{\/\*TOKENS\*\/--accent:#FF0000;--bg:#000\/\*\/TOKENS\*\//);
  assert.equal(d.styles.roles.H1.size, 50); assert.equal(d.styles.roles.Body.size, 10);
  const e = create({slides: [{els: []}]}, {}).deck; assert.deepEqual(Object.keys(e.styles.roles), ROLES);
});
test('create: title escaped, </script> in content escaped, namespace follows the model', () => {
  const base = {styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: [{x: 0, y: 0, w: 10, role: 'Body', text: 'a</script><b>'}]}]};
  const a = create(base, {title: 'x<y&z'});
  assert.match(a.html, /<title>\/\*TITLE\*\/x&lt;y&amp;z\/\*\/TITLE\*\/<\/title>/);
  assert.ok(!/a<\/script><b>/.test(a.html) && a.html.includes('a<\\/script><b>'));
  assert.deepEqual(modelOf(a.html).slides[0].els[0].text, 'a</script><b>', 'round-trips through modelOf');
  const b = create({...base, slides: [{els: []}]}, {}); assert.notEqual(a.hash, b.hash);
});

// ── 6. import-html: pure structure lifting on a fixture ──
test('import-html assemble: master from recurring chrome, footer, layout slots, roles seeded from signatures, nowrap intent', () => {
  const logo = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
  const mk = (name, bg, extra = []) => ({name, bg, els: [
    {x: 10, y: 10, w: 100, h: 20, svg: logo},
    {x: 0, y: 0, w: 800, h: 450},
    {x: 20, y: 30, w: 600, font: 'Inter', size: 14, weight: 600, color: '#C97A54', tt: 'uppercase', ls: 1, text: 'KICKER ' + name, _lines: 1, nowrap: 1},
    {x: 20, y: 60, w: 600, font: 'Inter', size: 44, weight: 700, color: '#23262C', text: name + ' title', _lines: 1, nowrap: 1},
    {x: 700, y: 420, w: 'auto', font: 'Inter', size: 12, weight: 400, color: '#3A3F47', text: 'footer · deck', _lines: 1, nowrap: 1},
    ...extra]});
  const raw = [mk('a', '#fff'), mk('b', '#fff'), mk('c', '#fff', [{x: 20, y: 200, w: 300, font: 'DM Sans', size: 16, weight: 400, color: '#3A3F47', text: 'body', _lines: 2}])];
  raw[2].els[0] = {...raw[2].els[0], x: 12}; // same logo nudged 2px on one slide → mockup drift, normalised to the master rect
  const d = assemble(raw, {w: 800, h: 450});
  assert.equal(d.master.filter(m => m.svg).length, 1); assert.equal(d.master.find(m => m.svg).x, 10);
  assert.ok(!d.slides[2].els.some(e => e.override), 'drift is normalised away, not forked');
  assert.ok(d._report.normalised.some(n => n.slide === 'c' && n.what === 'rect'), 'drift recorded in the report');
  assert.ok(d.slides.every(s => !s.els.some(e => !e.text && !e.svg && !e.bg && !e.bd)), 'paintless wrapper dropped');
  assert.ok(/^footer/.test(d.master.find(m => m.footer).text));
  assert.deepEqual(Object.keys(d.layouts), ['content']); assert.deepEqual(d.layouts.content.title, {x: 20, y: 60, w: 600, role: 'H1'});
  assert.ok(d.slides.every(s => s.layout === 'content' && s.els.some(e => e.slot === 'title' && e.x === undefined)));
  assert.equal(d.styles.roles.H1.size, 44); assert.equal(d.styles.roles.Body.font, 'DM Sans'); assert.equal(d.styles.roles.H2.size, 36, 'undetected role keeps the neutral seed');
  assert.equal(d.slides[0].els.find(e => e.slot === 'supertitle').nowrap, 1);
  assert.ok(d.slots.supertitle, 'supertitle is a deck-scope slot');
  const v = validate(d); assert.deepEqual(v.errors, [], 'imported model passes the contract');
  assert.equal(classify({size: 64, text: '1,240'}), 'Stat'); assert.equal(classify({size: 12, font: 'Menlo', text: 'x'}), 'Label'); assert.equal(classify({size: 96, text: 'Welcome'}), 'H1', 'classify never emits Title'); assert.equal(classify({size: 48, text: 'Section'}), 'H1');
  // Title: the larger headline that lives only on non-content layouts; its slot rebinds too
  const lay = {title: {title: {x: 0, y: 0, w: 100, role: 'H1'}}, content: {title: {x: 0, y: 0, w: 100, role: 'H1'}}};
  const sl = [{layout: 'title', els: [{slot: 'title', size: 72, text: 'Welcome'}]}, {layout: 'content', els: [{slot: 'title', size: 44, text: 'Section'}]}];
  assert.equal(detectTitle(sl, lay).length, 1); assert.equal(sl[0].els[0].role, 'Title'); assert.equal(lay.title.title.role, 'Title'); assert.equal(lay.content.title.role, 'H1');
  assert.equal(detectTitle([{layout: 'title', els: [{slot: 'title', size: 44, text: 'Same size'}]}, sl[1]], structuredClone(lay)).length, 0, 'no Title when the cover headline is not larger than content H1');
});

test('import-html assemble: the footer is ONE master row across slides — right-anchored hugging text matches by its right edge, typed page counts are stripped, the scale never crowds (fit cap)', () => {
  const logo = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
  const mk = (name, foot, extra = []) => ({name, bg: '#fff', els: [
    {x: 10, y: 10, w: 100, h: 20, svg: logo},
    {x: 20, y: 30, w: 600, font: 'Inter', size: 14, weight: 600, color: '#C97A54', tt: 'uppercase', ls: 1, text: 'KICKER ' + name, _lines: 1, nowrap: 1},
    {x: 20, y: 60, w: 600, font: 'Inter', size: 44, weight: 700, color: '#23262C', text: name + ' title', _lines: 1, nowrap: 1},
    {x: 800 - 20 - foot.length * 6, y: 420, w: 'auto', _w: foot.length * 6, font: 'Inter', size: 12, weight: 400, color: '#3A3F47', text: foot, _lines: 1, nowrap: 1}, // right edge on 780 for every slide
    ...extra]});
  // slide a typed no page count (x differs by 30px from the others); b/c/d typed "· 2/4" style counters
  const body = n => ({x: 20, y: 200, w: 300, font: 'DM Sans', size: 16, weight: 400, color: '#3A3F47', text: 'body ' + n, _lines: 2, _fit: 19});
  const raw = [mk('a', 'Deck · July', [body(1)]), mk('b', 'Deck · July · 2/4', [body(2)]), mk('c', 'Deck · July · 3/4', [body(3), {x: 20, y: 300, w: 120, font: 'DM Sans', size: 15, weight: 400, color: '#3A3F47', text: 'a tight body row in a narrow card', _lines: 2, _fit: 13.5}]), mk('d', 'Deck · July · 4/4', [body(4)])];
  const d = assemble(raw, {w: 800, h: 450});
  const foot = d.master.find(m => m.footer);
  assert.ok(foot, 'footer master exists'); assert.equal(foot.text, 'Deck · July', 'typed page count stripped from the footer text (the engine renders the counter)');
  assert.ok(d.slides.every(s => !(s.hide || []).includes(foot.id)), 'every slide shows the one footer row — slide a matched by its right edge');
  assert.ok(!d.slides.some(s => s.els.some(e => /July/.test(e.text || ''))), 'no slide keeps a private footer copy');
  // fit cap: Body modal is 16 but one Body row only fits at 13.5 → the role is 13.5 (the scale may shrink a row, never crowd it)
  assert.equal(d.styles.roles.Body.size, 13.5); assert.ok(d._report.conflicts.Body.cap, 'the cap is reported with the row that set it');
});
// ── 7. live proofs (Playwright optional devDependency) ──
live('live: explainer + three examples pass verify (layout parity, no page errors)', async () => {
  for (const n of ['explainer', 'quarterly-update', 'launch-carousel', 'one-pager']) {
    const {model, style} = example(n); const f = path.join(tmp, n + '.html');
    fs.writeFileSync(f, create(model, {style}).html);
    const r = await verify(f, {out: path.join(tmp, 'v-' + n)});
    assert.deepEqual(r.errors, [], n + ': ' + JSON.stringify(r.parity.filter(p => !p.pass)));
    assert.equal(r.parity.length, model.slides.length);
  }
});
live('live: parity — a snapped row (_src) may render fewer lines (crowding, reported); more lines or overflow fail', async () => {
  const row = {x: 60, y: 200, w: 120, role: 'Body', text: 'a sentence that certainly wraps inside one hundred and twenty pixels', _lines: 1};
  const mk = extra => ({w: 960, h: 540, slides: [{els: [{...row, ...extra}]}]});
  const hard = path.join(tmp, 'parity-hard.html'), soft = path.join(tmp, 'parity-soft.html');
  fs.writeFileSync(hard, create(mk({})).html); fs.writeFileSync(soft, create(mk({_src: {size: 11, lh: null, ls: null}})).html);
  const rh = await verify(hard, {out: path.join(tmp, 'v-hard'), log: () => {}}), rs = await verify(soft, {out: path.join(tmp, 'v-soft'), log: () => {}});
  assert.equal(rh.parity[0].pass, false, 'unchanged row: line-count drift is a parity failure');
  assert.equal(rs.parity[0].pass, false, 'snapped row that renders MORE lines than its source: still a failure (the importer fit cap must prevent it)');
  const fewer = path.join(tmp, 'parity-fewer.html'); fs.writeFileSync(fewer, create({w: 960, h: 540, slides: [{els: [{x: 60, y: 200, w: 600, role: 'Body', text: 'one line', _lines: 2, _src: {size: 11, lh: null, ls: null}}]}]}).html);
  const rf = await verify(fewer, {out: path.join(tmp, 'v-fewer'), log: () => {}});
  assert.equal(rf.parity[0].pass, true, 'snapped row that renders FEWER lines (collapsed runs): not a failure'); assert.equal(rf.parity[0].crowding.length, 1, '…reported as scale crowding');
});
live('live: AE — a deck that differs from its reference reports the real pixel count (compare exits 1 and prints to stderr; never a silent 0)', async () => {
  let magick = true; try { execFileSync('magick', ['-version'], {stdio: 'pipe'}); } catch { magick = false; }
  if (!magick) return;
  const model = {w: 960, h: 540, slides: [{name: 'one', els: [{x: 60, y: 60, w: 400, h: 200, bg: '#ff0000'}]}]};
  const f = path.join(tmp, 'ae.html'); fs.writeFileSync(f, create(model).html);
  const refs = path.join(tmp, 'ae-refs'); fs.mkdirSync(refs, {recursive: true});
  execFileSync('magick', ['-size', '960x540', 'xc:#15161a', path.join(refs, 'one.png')]); // the reference has no red box
  const r = await verify(f, {refs, out: path.join(tmp, 'v-ae'), log: () => {}});
  assert.ok(r.ae[0].px > 70000 && r.ae[0].pass === false, `AE must see the 400×200 box: ${JSON.stringify(r.ae[0])}`);
});
live('live: motion — anims run on slide entry, never on a re-render, and are gone under reduced motion', async () => {
  const b = await pw.chromium.launch();
  const open = async (opts) => { const p = await b.newPage({viewport: {width: 1280, height: 800}, ...opts});
    await p.goto(pathToFileURL(path.join(root, 'deck.html')).href); await p.evaluate(() => { localStorage.clear(); }); await p.reload();
    await p.waitForSelector('#canvas .el'); return p };
  const names = p => p.evaluate(n => { i = n; render(); return [...document.querySelectorAll('#canvas .el')].map(d => getComputedStyle(d).animationName) },
    modelOf(deck).slides.findIndex(s => s.name === 'motion'));
  const p = await open();
  const first = await names(p);
  assert.deepEqual(first.filter(n => n !== 'none'), ['fade', 'rise', 'rise', 'rise', 'fade', 'fade', 'pop', 'pop', 'wipe', 'wipe'], 'the motion slide enters with all four anims, tile then caption');
  const delays = await p.evaluate(() => [...document.querySelectorAll('#canvas .el')].filter(d => getComputedStyle(d).animationName !== 'none').map(d => d.style.animationDelay));
  assert.deepEqual(delays.slice(0, 3), ['0ms', '120ms', '240ms'], '120 ms stagger in model order');
  await p.evaluate(() => render());   // a re-render of the SAME slide does not restagger
  assert.deepEqual((await p.evaluate(() => [...document.querySelectorAll('#canvas .el')].map(d => getComputedStyle(d).animationName))).filter(n => n !== 'none'), []);
  const r = await open({reducedMotion: 'reduce'});
  assert.deepEqual((await names(r)).filter(n => n !== 'none'), [], 'reduced motion: nothing animates');
  await b.close();
});

live('live: editor rules — nib, present backdrop, master fork + inline counter, edit commit, undo, slots, A4 page rule', async () => {
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(path.join(root, 'deck.html')).href); await p.waitForTimeout(200);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(200);
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  // nib
  await ev(() => { sel.clear(); sel.add(2); render(); });
  assert.equal(await ev(() => canvas.querySelectorAll('.h').length), 1, 'nib for one selected text row');
  assert.equal(await ev(() => { document.body.classList.add('present'); render(); const n = canvas.querySelectorAll('.h').length; document.body.classList.remove('present'); return n; }), 0, 'no nib in present');
  // present backdrop = current slide bg
  await ev(() => { deck.slides[1].bg = '#123456'; document.body.classList.add('present'); i = 1; sel.clear(); render(); });
  assert.equal(await ev(() => getComputedStyle(document.body).backgroundColor), 'rgb(18, 52, 86)');
  await ev(() => { document.body.classList.remove('present'); delete deck.slides[1].bg; i = 0; render(); });
  // counter inline in the footer master, on every slide
  assert.equal(await ev(() => canvas.querySelector('[data-footer] .num').textContent), ' · 1 / 12');
  assert.equal(await ev(() => canvas.querySelector('[data-footer]').style.right), '60px', 'footer right edge sits on styles.margin');
  assert.equal(await ev(() => canvas.querySelectorAll('.num.pin').length), 0, 'no generic pin when a footer exists');
  // master fork on edit: dragging the footer creates override:'foot' on that slide only
  assert.equal(await ev(() => { sel.clear(); sel.add('m:foot'); const k = fork('foot'); return slide().els[k].override; }), 'foot');
  assert.equal(await ev(() => deck.slides[1].els.some(e => e.override)), false, 'other slides untouched');
  await ev(() => { deck = structuredClone(DECK); sel.clear(); render(); });
  // text edit commits through commitEdit on nav (no blur needed), and undo restores it
  await ev(() => { sel.clear(); sel.add(2); render(); edit(2); });
  await p.keyboard.type('Replaced');
  await ev(() => nav(1));
  assert.equal(await ev(() => deck.slides[0].els[2].text), 'Replaced');
  await ev(() => undo());
  assert.match(await ev(() => deck.slides[0].els[2].text), /^Agent-generated/);
  // slotted rows resolve geometry from the layout
  const t = await ev(() => { i = 1; sel.clear(); render(); const d = canvas.querySelector('[data-n="1"]'); return [d.style.left, d.style.top, d.style.fontSize]; });
  assert.deepEqual(t, ['60px', '76px', '34px']);
  // + Text binds the first free slot; + Slide copies the layout
  await ev(() => { i = 1; render(); deck.slides[1].els = deck.slides[1].els.filter(e => e.slot !== 'supertitle'); render(); document.getElementById('add-text').click(); });
  assert.equal(await ev(() => slide().els.at(-1).slot), 'supertitle');
  await ev(() => document.getElementById('sadd').click());
  assert.deepEqual(await ev(() => [slide().layout, slide().els[0].slot, deck.slides.length]), ['content', 'title', 13]);
  // contact sheet renders every slide
  await ev(() => sheetOpen());
  assert.equal(await ev(() => document.querySelectorAll('#grid .cell').length), 13);
  // pointer drag across cells never leaves a text selection behind (thumbnails are renders)
  { const [a, z] = await ev(() => [0, 4].map(k => { const r = document.querySelectorAll('#grid .cell')[k].getBoundingClientRect(); return { x: r.x, y: r.y }; }));
    await p.mouse.move(a.x + 20, a.y + 20); await p.mouse.down(); for (let k = 1; k <= 8; k++) await p.mouse.move(a.x + 20 + (z.x - a.x) * k / 8, a.y + 20 + (z.y - a.y) * k / 8); await p.waitForTimeout(50);
    assert.equal(await ev(() => getSelection().toString()), '', 'no text selected mid-drag'); assert.equal(await ev(() => document.body.classList.contains('dragging')), true, 'body.dragging while dragging');
    await p.mouse.up(); await p.waitForTimeout(250); assert.equal(await ev(() => document.body.classList.contains('dragging')), false, 'dragging flag cleared on drop'); await ev(() => undo()); }
  await ev(() => sheetClose());
  // autosave dot: a normal save lands green; a shim that cannot persist lands red with the warning label
  await ev(() => save()); await p.waitForTimeout(400); assert.deepEqual(await ev(() => [document.getElementById('autosave').dataset.state, document.getElementById('autosave').getAttribute('aria-label')]), ['ok', 'Autosaved']);
  await ev(() => { window.__set = store.set; store.set = () => false; save(); }); assert.equal(await ev(() => document.getElementById('autosave').dataset.state), 'busy', 'amber while saving'); await p.waitForTimeout(400);
  assert.deepEqual(await ev(() => [document.getElementById('autosave').dataset.state, document.getElementById('autosave').getAttribute('aria-label')]), ['bad', 'Not saved — edits will be lost on refresh']); await ev(() => { store.set = window.__set; save(); }); await p.waitForTimeout(400);
  // ⤓ PDF: in-file writer produces a real PDF with one W×H pt page per slide (Chromium rasterises foreignObject untainted)
  const pdf = await ev(async () => { const orig = URL.createObjectURL; let blob; URL.createObjectURL = b => { blob = b; return 'blob:x'; }; HTMLAnchorElement.prototype.click = () => {}; await exportPdf(); URL.createObjectURL = orig; const t = await blob.text(); return {type: blob.type, head: t.slice(0, 8), pages: (t.match(/\/Type \/Page\b/g) || []).length, box: /\/MediaBox \[0 0 960 540\]/.test(t), eof: /%%EOF\n$/.test(t), size: blob.size}; });
  assert.deepEqual([pdf.type, pdf.head, pdf.pages, pdf.box, pdf.eof], ['application/pdf', '%PDF-1.4', 13, true, true]); assert.ok(pdf.size > 20000, 'rasters are real');
  assert.deepEqual(errs, []);
  // A4 document injects the a4 page rule; Letter decks do not
  const a4 = path.join(tmp, 'a4.html'); fs.writeFileSync(a4, create(example('one-pager').model, {style: example('one-pager').style, format: 'document-a4'}).html);
  await p.goto(pathToFileURL(a4).href); await p.waitForTimeout(200);
  assert.equal(await ev(() => [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => r.cssText.includes('a4')); } catch { return false; } })), true);
  assert.equal(await ev(() => document.documentElement.style.getPropertyValue('--Z')), '1.0000', 'A4 document prints at zoom 1');
  await b.close();
});
live('live: import-html in-page intent capture (line count, nowrap, hugging chip)', async () => {
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 800, height: 450}});
  await p.setContent('<body style="margin:0;width:800px;height:450px;font:16px/1.5 sans-serif"><div style="padding:20px"><p style="width:200px">one two three four five six seven eight nine ten eleven twelve</p><div style="display:flex;gap:8px"><span style="background:#eee;padding:4px 10px;border-radius:999px;border:1px solid #999">chip</span><span>label</span></div><div style="width:300px;height:10px"></div><table style="border-collapse:separate;border-spacing:4px;margin-top:8px"><tr><td style="width:58px;height:40px;padding:0;background:#c97a54;border-radius:8px;color:#fff;text-align:center">2</td></tr></table></div></body>');
  const rows = (await p.evaluate(extractInPage, 800)).els; await b.close();
  const para = rows.find(r => /^one two/.test(r.text || '')), chip = rows.find(r => r.text === 'chip'), label = rows.find(r => r.text === 'label');
  assert.ok(para._lines > 1 && !para.nowrap); assert.deepEqual([label._lines, label.nowrap], [1, 1]);
  assert.deepEqual([chip.w, chip.p, chip.bg, chip.bd, chip.radius], ['auto', '4px 10px 4px 10px', '#EEEEEE', '1px solid #999999', 999]);
  assert.ok(!rows.some(r => r.x === 20 && r.w === 300 && !r.text));
  // fixed-width table cell: the column pins the width (style.width=max-content is a no-op on a td) → a 58×40 box row + a centred text
  // row whose y comes from the glyph line, never a w:'auto' chip (AFB grading heatmap, 2026-08-23)
  const cell = rows.find(r => r.text === '2'), cellBox = rows.find(r => r.bg === '#C97A54');
  assert.deepEqual([cell.w, cell.align, [cellBox.x, cellBox.w, cellBox.h]], [58, 'center', [cell.x, 58, 40]]);
  assert.ok(cell.y > cellBox.y + 4 && cell.y < cellBox.y + 24, `centred cell text y ${cell.y} vs box ${cellBox.y}`);
  assert.ok(para._fit >= 16 && para._fit < 24, `wrapped paragraph records the largest font-size that keeps its line count (${para._fit})`);
  assert.ok(chip._fit === undefined, 'hugging chip has no width to fit into → no _fit');
});
