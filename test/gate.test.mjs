// decklet gate — engine contract + validator + create + import-html (pure) + live browser proofs (Playwright, skipped when absent)
// run: npm test   (= node --test test/**/*.test.mjs)
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validate, mergeStyle, ROLES, ANIMS} from '../bin/validate.mjs';
import {create, FORMAT} from '../bin/create.mjs';
import {assemble, extract, extractInPage, classify, detectTitle} from '../bin/import-html.mjs';
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
    assert.equal((h.match(/localStorage\./g) || []).length, 5, `${n}: storage API only inside the shim and the availability probe`);
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
  assert.match(tpl, /<title>decklet<\/title>/, 'the tab title is plain static text — a /*MARK*/ sentinel is not a comment inside <title>');
  assert.match(tpl, /:root\{\/\*TOKENS\*\/[^}]*\/\*\/TOKENS\*\/;--W:/);
  assert.match(tpl, /const DECK=\/\*DECK\*\/\{[\s\S]*?\}\/\*\/DECK\*\/;/);
  assert.match(tpl, /const NS=\/\*KEY\*\/'decklet:template'\/\*\/KEY\*\/,KEY=NS\+':model',HKEY=NS\+':hist'/);
  assert.match(deck, /const NS=\/\*KEY\*\/'decklet:[0-9a-f]{10}'\/\*\/KEY\*\//, 'deck: namespace stamped from the model hash');
});
test('editing: double-click via detail, multiselect, undo stack (persisted, capped), click-off deselect', () => {
  assert.match(tpl, /e\.detail>=2/); assert.match(tpl, /e\.metaKey\|\|e\.ctrlKey/); assert.match(tpl, /function undo/);
  assert.match(tpl, /store\.get\(HKEY\)\|\|'\[\]'/); assert.match(tpl, /history\.length>50/);
  assert.match(tpl, /if\(!t\)\{[^\n]*sel\.clear\(\)/, 'a press on empty canvas drops the selection'); assert.match(tpl, /mode:'band'/, 'and the same press starts a marquee'); assert.match(tpl, /\$\('wrap'\)\.addEventListener\('mousedown'/);
});
test('commitEdit runs first on every path that destroys the live editor', () => {
  assert.match(tpl, /function commitEdit\(\)\{\n\s*const t=canvas\.querySelector\('\.el\[contenteditable="true"\]'\)/);
  for (const re of [/const nav=d=>\{commitEdit\(\);/, /'sadd'\)\.onclick=\(\)=>\{commitEdit\(\);/, /const fs=\(\)=>\{commitEdit\(\);/, /'beforeprint',\(\)=>\{commitEdit\(\);/, /function sheetOpen\(\)\{commitEdit\(\);/, /t\.onblur=commitEdit;/, /el\.html=t\.innerHTML;delete el\.text/]) assert.match(tpl, re);
});
test('renderer adds nothing implicit; chrome lives on box/tile only', () => {
  assert.match(tpl, /\.el\{position:absolute;cursor:grab;padding:0;border-radius:0;white-space:normal;line-height:normal\}/);
  assert.match(tpl, /\.el\.box\{[^}]*padding:6px 8px;border-radius:8px;white-space:pre-wrap\}/);
  assert.match(tpl, /\.el\.tile\{/);
  for (const re of [/r\.svg\)d\.innerHTML=r\.svg/, /else if\(r\.html\)\{d\.innerHTML=r\.html/, /s\.bg\|\|'var\(--card\)'/, /letter-spacing:\$\{r\.ls\}px/, /line-height:\$\{r\.lh\}px/, /text-transform:\$\{r\.tt\}/, /white-space:\$\{r\.ws\}/, /font-style:italic/, /opacity:\$\{r\.op\}/, /border-top:\$\{r\.bt\}/, /box-shadow:\$\{r\.shadow\}/, /r\.nowrap\?'white-space:nowrap;'/, /r\.w==='auto'\?'auto'/, /deck\.styles\.pad\[r\.p\]/, /r\.line\)/, /conic-gradient\(/, /r\.h\?/]) assert.match(tpl, re, String(re));
});
test('selection chrome: nib only for one painting row, never in present mode; present hides HUD (NOT the toolbar — editing is allowed; sheet stays usable)', () => {
  assert.match(tpl, /sel\.size===1&&!present\(\)/); assert.match(tpl, /paints\(r\)&&r\.w!==0&&r\.h!==0/);
  assert.match(tpl, /body\.present #hud,body\.present \.h\{display:none!important\}/); assert.doesNotMatch(tpl, /body\.present #tb/, 'toolbar floats on a text selection in present mode');
  assert.match(tpl, /const pinned=\(\)=>addmenu\.classList\.contains\('open'\)\|\|helpmenu\.classList\.contains\('open'\)\|\|!tb\.hidden\|\|!sheet\.hidden/, 'peek HUD stays pinned while a menu/popover/toolbar/sheet is open');
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
test('roles are the type system: eight complete roles in the template, locked keys, B I U S̶ only (no sub/sup buttons; existing runs still render), NO font/size/color pickers, NO box-fill', () => {
  const m = modelOf(tpl);
  assert.deepEqual(Object.keys(m.styles.roles), ROLES);
  for (const r of Object.values(m.styles.roles)) for (const p of ['font', 'size', 'weight', 'lh', 'color']) assert.ok(r[p] != null, p); // the template's own roles carry lh
  assert.match(tpl, /data-cmd="bold"[\s\S]*data-cmd="italic"[\s\S]*data-cmd="underline"[\s\S]*data-cmd="strikeThrough"/); assert.doesNotMatch(tpl, /data-cmd="(subscript|superscript)"/, 'no sub/sup buttons'); assert.doesNotMatch(tpl, /tb-fill|dataset\.fill|data-fill|deckBgs/, 'no box-fill feature'); assert.match(tpl, /#tb \.seg\{display:inline-flex;align-items:center;gap:2px;padding:2px 4px 2px 0;/, 'segments are one centred line box with symmetric top/bottom padding'); assert.match(tpl, /#tb \.sw\{width:16px;height:16px;padding:0;margin:0;vertical-align:middle;/, 'swatches symmetric'); assert.match(tpl, /<kbd>select text<\/kbd> → roles · B I U S̶ · link · color<\/div>/, 'popover toolbar line'); assert.doesNotMatch(tpl.match(/<div id="helpmenu"[\s\S]*?<\/div>\s*<\/div>/)[0], /fill/i, 'no "fill" in the popover');
  assert.match(tpl, /\.el sub,\.el sup\{font-size:inherit;line-height:0/, 'sub/sup never change size');
  assert.match(tpl, /const LOCK=\['font','size','lh','ls'\]/); assert.match(tpl, /if\(r\[k\]==null\|\|LOCK\.includes\(k\)\)r\[k\]=t\[k\]/, 'role always wins the locked keys');
  assert.doesNotMatch(tpl, /<select|type="color"|font-picker|fontFamily|id="font|id="size|id="color/);
  assert.match(tpl, /\['weight','color','tt','italic'\]\.forEach\(p=>delete el\[p\]\)/, 'applying a role clears the row-level overrides');
  assert.doesNotMatch(tpl, /r\.mono\?/, 'mono is not a row prop — Label is the mono role');
});
test('HUD contract is a set: prev · next · autosave · + (Text/Box/Slide) · contact sheet · PDF · fullscreen · shortcuts', () => {
  assert.match(tpl, /<button id="prev" [^>]*aria-label="Previous slide \(←\)"><svg [^>]*><path [^>]*\/><\/svg><\/button>/, 'prev is icon-only'); assert.match(tpl, /<button id="next" [^>]*aria-label="Next slide \(→\)"><svg [^>]*><path [^>]*\/><\/svg><\/button>/, 'next is icon-only');
  const ids = [...tpl.matchAll(/<div id="hud">[\s\S]*?<\/div>\n<div id="sheet"/g)][0][0].match(/id="([^"]+)"/g).map(s => s.slice(4, -1)).filter(s => s !== 'hud' && s !== 'sheet').sort();
  assert.deepEqual(ids, ['add-box', 'add-text', 'addbtn', 'addmenu', 'addwrap', 'autosave', 'fs', 'grid-btn', 'help', 'helpmenu', 'helpwrap', 'next', 'pdf', 'prev', 'sadd', 'savecopy']);
  assert.deepEqual([...tpl.match(/<div id="hud">[\s\S]*?\n<\/div>/)[0].matchAll(/id="(prev|next|autosave|addbtn|grid-btn|pdf|fs|help)"/g)].map(m => m[1]), ['prev', 'next', 'autosave', 'addbtn', 'grid-btn', 'pdf', 'fs', 'help'], 'autosave immediately left of +, ⓘ rightmost');
  assert.match(tpl, /<button id="help" class="mi mi-circle-question-mark"[^>]*aria-label="Shortcuts"[^>]*><svg /, 'the shortcuts control is the question-mark icon'); assert.match(tpl, /<kbd>← → \/ ↑ ↓<\/kbd> navigate/, 'popover nav line'); assert.match(tpl, /<button id="sheet-back" title="Back to slide \(Esc\)" aria-label="Back to slide \(Esc\)">← Back<\/button>/, 'contact sheet ← Back');
  assert.match(tpl, /if\(\(e\.metaKey\|\|e\.ctrlKey\)&&e\.key\.toLowerCase\(\)==='s'\)\{e\.preventDefault\(\);saveCopy\(\);return\}/, '⌘S save-a-copy, keyboard only'); assert.doesNotMatch(tpl, /id="save"/);
  assert.match(tpl, /if\(e\.key==='ArrowRight'\|\|e\.key==='ArrowDown'\|\|e\.key===' '\)nav\(1\)/, '↓ = next'); assert.match(tpl, /if\(e\.key==='ArrowLeft'\|\|e\.key==='ArrowUp'\)nav\(-1\)/, '↑ = prev');
  assert.match(tpl, /PKEY=NS\+':pos'/, 'position persisted'); assert.match(tpl, /if\(animate\)\{store\.set\(PKEY,i\);location\.replace\('#'\+\(i\+1\)\)\}/, 'slide change → pos + #n hash'); assert.match(tpl, /addEventListener\('hashchange'/, 'hash → slide');
  // autosave indicator: the shim's set reports success; save() drives the dot; reduced motion kills glow + pulse
  assert.match(tpl, /set:\(k,v\)=>\{try\{localStorage\.setItem\(k,v\);lastSavedAt=new Date\(\);return true\}catch\{mem\.set\(k,v\);return false\}\}/, 'store.set returns boolean + stamps lastSavedAt on a confirmed write; a blocked write still holds the session in memory'); assert.match(tpl, /<span id="autosave" role="status"/); assert.match(tpl, /prefers-reduced-motion:reduce\)\{#autosave\{box-shadow:none;animation:none!important\}\}/);
  assert.match(tpl, /\$\('pdf'\)\.onclick=\(\)=>exportPdf\(\)\.catch\(\(\)=>print\(\)\)/, '⤓ writes a PDF in-file; print() is the fallback'); assert.match(tpl, /requestFullscreen/);
});
test('⤓ PDF writer: slide-sized pages from foreignObject rasters, byte-exact xref, real link annotations, zero dependencies', () => {
  for (const re of [/async function exportPdf\(\)\{\n\s*commitEdit\(\)/, /<foreignObject width="\$\{W\}" height="\$\{H\}">/, /'data:image\/svg\+xml;charset=utf-8,'\+encodeURIComponent\(svg\)/, /c\.toDataURL\('image\/jpeg',\.92\)/, /\/MediaBox \[0 0 \$\{W\} \$\{H\}\]/, /\/Filter \/DCTDecode/, /startxref\\n\$\{x\}\\n%%EOF/, /type:'application\/pdf'/, /\.pdf';a\.click\(\)/]) assert.match(tpl, re, String(re));
  assert.match(tpl, /\/Subtype \/Link[\s\S]{0,120}\/S \/URI/, 'links reach the PDF as annotations — LinkedIn document posts read those');
  assert.doesNotMatch(tpl, /jspdf|pdf-lib|html2canvas/i);
  // the rasteriser never touches the visible page: the clone lives in an offscreen host and the page colour is read off the clone
  assert.match(tpl, /const host=document\.createElement\('div'\);host\.style\.cssText='position:fixed;left:-99999px/, 'one offscreen host holds every clone');
  assert.doesNotMatch(tpl, /canvas\.style\.background=s\.bg/, 'the visible canvas is never repainted mid-export (that was the colour flash)');
  assert.doesNotMatch(tpl, /cv\.style\.left='0'/, 'the clone is never moved on-screen to be serialised');
  assert.match(tpl, /pdfbtn\.setAttribute\('aria-busy'/, '⤓ reports that it is working');
});
test('links: one href model — a whole-row link and an inline link mark, http/https/mailto only', () => {
  assert.match(tpl, /const href=u=>\{u=String\(u==null\?'':u\)\.trim\(\);return \/\^\(https\?:\|mailto:\)\/i\.test\(u\)\?u:''\}/, 'one scheme gate for both surfaces');
  assert.match(tpl, /d\.querySelectorAll\('a\[href\]'\)\.forEach/, 'inline runs are re-gated at render — a saved copy can carry anything');
  assert.match(tpl, /a\.className='lk';a\.href=href\(r\.href\)/, 'a row href paints one inset anchor over the whole row (the CTA box is a box + a text row)');
  assert.match(tpl, /body\.present \.el a\.lk\{pointer-events:auto\}/, 'clickable while presenting, inert while editing');
  // the mark sits in the inline segment, immediately after strikethrough
  assert.match(tpl, /data-cmd="strikeThrough"[^\n]*\n\s*<button data-link="1"/, 'B I U S̶ → link, in that order');
  assert.match(tpl, /document\.execCommand\('createLink',false,href\(u\)\)/); assert.match(tpl, /document\.execCommand\('unlink'\)/, 'clearing the field removes the link');
  assert.match(tpl, /<kbd>select text<\/kbd> → roles · B I U S̶ · link · color<\/div>/, 'popover names it');
});
test('curve + arrow: a bezier connector is a row like line/donut/bar, and either end can carry a head', () => {
  assert.match(tpl, /if\(r\.curve\)\{/); assert.match(tpl, /M\$\{P\(q\[0\]\)\}C\$\{P\(q\[1\]\)\} \$\{P\(q\[2\]\)\} \$\{P\(q\[3\]\)\}/, 'one cubic bezier, absolute canvas coords like line');
  assert.match(tpl, /orient="auto-start-reverse"/, 'one marker def serves both ends');
  assert.match(tpl, /const AR=r=>\(\{start:\[1,0\],end:\[0,1\],both:\[1,1\]\}\[r\.arrow\]\|\|\[0,0\]\)/, 'one arrow prop, shared by line and curve');
  assert.match(tpl, /const paints=r=>[^\n]*r\.curve/, 'a curve paints (nib, parity, collision all read this)');
  // the head is the TERMINUS on both painters: the stroke gives up room for it, it is never appended past the stated end
  assert.match(tpl, /const HEAD=sw=>\(\{len:sw\*3\.2,half:sw\*1\.6\}\)/, 'one head size, shared by line and curve');
  assert.match(tpl, /const back=as\?Math\.min\(hd\.len,len\/2\):0,fwd=ae\?Math\.min\(hd\.len,len\/2\):0,shaft=Math\.max\(0,len-back-fwd\)/, 'line: the shaft gives up a head length at each headed end');
  assert.match(tpl, /left:\$\{fw\?shaft:-hd\.len\}px/, 'line: the triangle sits in the gap it was given, tip on the stated end');
  assert.match(tpl, /const t0=as\?tAtLen\(q,hd\.len,false\):0,t1=ae\?tAtLen\(q,hd\.len,true\):1/, 'curve: the path is trimmed by one head length per headed end');
  assert.match(tpl, /refX="0"/, 'curve: the marker is anchored by its BASE, so it fills the gap and tips on the stated end');
  assert.doesNotMatch(tpl, /right:\$\{-hw\*2\}px/, 'the old appended-outside head is gone');
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

// ── 2a. storage that is honest about being blocked (Safari refuses localStorage on file:// — the browser decks open in) ──
test('blocked storage: probed at load, says what to do, and reveals ⌘S save-a-copy as the durable path', () => {
  assert.match(tpl, /const CANSTORE=\(\(\)=>\{try\{localStorage\.setItem\(NS\+':probe','1'\);localStorage\.removeItem\(NS\+':probe'\);return true\}catch\{return false\}\}\)\(\)/, 'availability is probed, not inferred from the first failed save');
  assert.match(tpl, /const mem=new Map\(\)/, 'the shim keeps edits for the session even when nothing persists');
  assert.match(tpl, /document\.body\.classList\.add\('nostore'\)/);
  assert.match(tpl, /blocks storage for local files[^']*⌘S[^']*Chrome/, 'the message names the durable path and the browser that works');
  assert.match(tpl, /body\.nostore #savecopy\{display:inline-flex\}/, '⌘S gets a button in exactly the state where it is the only way to keep an edit');
  assert.equal((tpl.match(/localStorage\./g) || []).length, 5, 'storage API only inside the shim and the probe');
});

test('toolbar: the link mark is drawn like B I U S, not an emoji', () => {
  const seg = tpl.match(/<span class="seg" id="tb-inline">[\s\S]*?<\/span>/)[0];
  assert.doesNotMatch(seg, /\uD83D[\uDD17]|🔗/u, 'no emoji in the mark segment — it is a colour raster beside four monochrome glyphs');
  assert.match(seg, /<button data-link="1"[^>]*><svg[^>]*width="13" height="13" viewBox="0 0 24 24"[^>]*>/, 'a Lucide link, sized to the letters');
  assert.match(seg, /stroke="currentColor"/, 'it inherits the toolbar colour and active state like the other marks');
  assert.match(seg, /aria-label="Link"/);
});
test('shortcuts popover cannot drift from the keybindings', () => {
  const pop = tpl.match(/<div id="helpmenu"[\s\S]*?\n\s*<\/div>/)[0];
  // every modifier chord the template actually handles must appear in the popover
  const chords = [...new Set([...tpl.matchAll(/mod&&k==='([a-z])'/g)].map(m => m[1])
    .concat([...tpl.matchAll(/\(e\.metaKey\|\|e\.ctrlKey\)&&e\.key\.toLowerCase\(\)==='([a-z])'/g)].map(m => m[1])))].sort();
  assert.ok(chords.length >= 5, 'found the chord handlers: ' + chords);
  for (const c of chords) assert.match(pop, new RegExp('⌘' + c.toUpperCase()), `⌘${c.toUpperCase()} is handled but not in the shortcuts popover`);
  // …and every plain key the template handles
  for (const [re, shown] of [[/e\.key==='ArrowRight'/, /← → \/ ↑ ↓/], [/e\.key\.toLowerCase\(\)==='f'/, /<kbd>F<\/kbd>/], [/e\.key\.toLowerCase\(\)==='g'/, /Esc · G/], [/e\.key==='Backspace'/, /<kbd>⌫<\/kbd>/]])
    if (re.test(tpl)) assert.match(pop, shown, `handled key missing from the popover: ${re}`);
});

// ── 2c′. the HUD glyphs are the moving Lucide set weave uses: one svg per control, played once, never looped ──
test('HUD icons: every control is a Lucide shape wearing its motion parts; no unicode glyph survives; nothing loops', () => {
  for (const id of ['prev', 'next', 'addbtn', 'grid-btn', 'savecopy', 'pdf', 'fs', 'help']) {
    assert.match(tpl, new RegExp(`<button id="${id}" class="mi mi-[\\w-]+" data-ms="\\d+"[^>]*><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"[^>]*>[^]*?data-mi="[^"]+"[^]*?<\\/svg><\\/button>`), `${id} draws a Lucide shape on the 24 grid with its motion parts`);
  }
  assert.doesNotMatch(tpl, /<button id="(prev|next|addbtn|grid-btn|savecopy|pdf|fs|help)"[^>]*>[‹›+⊞⤒⤓⛶ⓘ]<\/button>/, 'no control is a typed glyph any more');
  assert.match(tpl, /@keyframes mi-layout-grid-/, 'the motion rides in the template, scoped per icon'); assert.match(tpl, /\.mi-chevron-left path \{ transition/, 'a chevron slides on a transition, no keyframes needed');
  assert.doesNotMatch(tpl.slice(tpl.indexOf('#hud button svg'), tpl.indexOf('@media (prefers-reduced-motion:reduce)')), /infinite/, 'nothing loops');
  assert.match(tpl, /const miPlay=\(h\)=>\{const ms=\+h\.dataset\.ms\|\|0;if\(!ms\|\|h\.dataset\.on\|\|matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\)return;/, 'one run per trigger, reduced motion respected');
  assert.match(tpl, /h\.addEventListener\('mouseenter',\(\)=>miPlay\(h\)\);setTimeout\(\(\)=>miPlay\(h\),300\+i\*90\)/, 'hover replays; load plays once, staggered');
  assert.match(tpl, /@media \(prefers-reduced-motion:reduce\)\{\.mi svg,\.mi svg \*\{animation:none!important;transition:none!important\}\}/);
});

// ── 2c. the HUD is a contract: what ships and what SKILL.md promises are checked against each other ──
test('HUD contract does not drift: SKILL.md names exactly the controls the template ships', () => {
  // the controls themselves, not the items inside the + and ⓘ pop-ups
  const hud = tpl.match(/<div id="hud">[\s\S]*?\n<\/div>/)[0].replace(/<div id="(?:addmenu|helpmenu)"[\s\S]*?<\/div>/g, '');
  const shipped = [...hud.matchAll(/<(?:button|span) id="([^"]+)"/g)].map(m => m[1]);
  const doc = read('SKILL.md').match(/<!-- HUD: ([^>]*) -->/);
  assert.ok(doc, 'SKILL.md carries a machine-checked HUD manifest');
  assert.deepEqual(doc[1].trim().split(/\s+/), shipped, 'the documented HUD and the shipped HUD are the same set, in the same order');
});
test('present mode: the peek HUD is a centred pill, so it cannot sit on the page counter', () => {
  assert.match(tpl, /body\.present\.peek #hud\{[^}]*left:50%[^}]*transform:translateX\(-50%\)/, 'centred, not full-width');
  assert.match(tpl, /body\.present\.peek #hud\{[^}]*bottom:12px/, 'lifted off the bottom edge');
  assert.match(tpl, /body\.present\.peek #hud \.spacer\{display:none\}/, 'the spacer must not stretch the pill back across the slide');
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
test('validator: href is model content — http/https/mailto only, on a row and inside an inline run', () => {
  const ok = validate(withRoles({w: 960, h: 540, slides: [{els: [
    {x: 0, y: 0, w: 200, h: 40, bg: '#000', href: 'https://example.com/x?a=1'},
    {x: 0, y: 0, w: 200, role: 'Body', text: 'mail', href: 'mailto:hi@example.com'},
    {x: 0, y: 0, w: 200, role: 'Body', html: 'read <a href="http://example.com">the note</a>'},
  ]}]}));
  assert.deepEqual(ok.errors, []);
  const bad = validate(withRoles({w: 960, h: 540, slides: [{els: [
    {x: 0, y: 0, w: 200, h: 40, bg: '#000', href: 'javascript:alert(1)'},
    {x: 0, y: 0, w: 200, role: 'Body', html: 'x <a href="JavaScript:alert(1)">y</a>'},
    {x: 0, y: 0, w: 200, role: 'Body', html: 'x <a href="data:text/html,z">y</a>'},
  ]}]}));
  assert.equal(bad.errors.length, 3, JSON.stringify(bad.errors));
  for (const e of bad.errors) assert.match(e, /href .* must be http/);
});
test('validator: curve is six numbers, arrow is one of three and only on a line or a curve', () => {
  const v = validate(withRoles({w: 960, h: 540, slides: [{els: [
    {x: 10, y: 10, curve: [40, 10, 40, 90, 80, 90], bg: '#fff', arrow: 'end'},
    {x: 10, y: 10, line: [90, 90], bg: '#fff', arrow: 'both'},
    {x: 10, y: 10, curve: [1, 2, 3]},
    {x: 10, y: 10, line: [90, 90], arrow: 'barb'},
    {x: 0, y: 0, w: 100, role: 'Body', text: 'plain', arrow: 'end'},
  ]}]}));
  for (const re of [/curve must be \[c1x,c1y,c2x,c2y,x2,y2\]/, /arrow "barb"/, /arrow needs a line or a curve/]) assert.ok(v.errors.some(e => re.test(e)), String(re));
  assert.equal(v.errors.length, 3, JSON.stringify(v.errors));
});
test('validator: to/from terminate a connector against a row that exists', () => {
  const v = validate(withRoles({w: 960, h: 540, master: [{id: 'chip', x: 0, y: 0, w: 40, h: 40, bg: '#000'}], slides: [{els: [
    {x: 0, y: 0, w: 100, h: 60, bg: '#111'},
    {x: 200, y: 30, line: [400, 30], bg: '#fff', arrow: 'end', to: 0, from: 'chip'},
    {id: 'card', x: 600, y: 0, w: 80, h: 80, bg: '#222'},
    {x: 200, y: 30, curve: [250, 30, 300, 90, 400, 90], bg: '#fff', arrow: 'end', to: 'card'},
    {x: 200, y: 30, curve: [250, 30, 300, 90, 400, 90], bg: '#fff', arrow: 'end', to: 9},
    {x: 200, y: 30, line: [400, 30], bg: '#fff', to: 'ghost'},
    {x: 0, y: 0, w: 100, role: 'Body', text: 'plain', to: 0},
  ]}]}));
  for (const re of [/to "9" is not a row id on this slide, a master id, or a row index/, /to "ghost" is not a row/, /to needs a line or a curve/]) assert.ok(v.errors.some(e => re.test(e)), String(re));
  assert.equal(v.errors.length, 3, JSON.stringify(v.errors));
});
test('validator: connector shape rules are loud warnings, and waive:1 is the declared exception', () => {
  const boxes = [{x: 0, y: 0, w: 132, h: 62, bg: '#111', bd: '2px solid #333'}, {x: 252, y: 0, w: 132, h: 62, bg: '#111', bd: '2px solid #333'}];
  const v = validate(withRoles({w: 960, h: 540, slides: [{els: [...boxes,
    {x: 20, y: 90, line: [300, 260], bg: '#fff', h: 3, arrow: 'end'},                          // diagonal straight run
    {x: 20, y: 300, curve: [50, 300, 70, 360, 80, 360], bg: '#fff', h: 3, arrow: 'end'},       // 60px channel
    {x: 400, y: 300, curve: [560, 300, 720, 400, 600, 400], bg: '#fff', h: 3, arrow: 'end'},   // c2 past the endpoints
    {x: 400, y: 460, curve: [440, 460, 560, 500, 600, 500], bg: '#fff', h: 3, arrow: 'end'},   // c1 at 20% of the run
    {x: 142, y: 31, line: [242, 31], bg: '#fff', h: 1.5, arrow: 'end'},                        // headed hairline
    {x: 400, y: 100, line: [500, 100], bg: '#fff', h: 1},                                      // headless hairline: fine
  ]}]}));
  for (const re of [/diagonal straight run/, /spanning 60px/, /past the endpoints/, /20% of the run/, /too light/]) assert.ok(v.warnings.some(w => re.test(w)), String(re));
  assert.equal(v.errors.length, 0, JSON.stringify(v.errors));
  assert.ok(!v.warnings.some(w => /h=1 /.test(w)), 'a headless leader may be a hairline (H5)');
  // every one of them goes quiet when the row declares the exception
  const waived = validate(withRoles({w: 960, h: 540, slides: [{els: [
    {x: 20, y: 90, line: [300, 260], bg: '#fff', h: 3, arrow: 'end', waive: 1},
    {x: 20, y: 300, curve: [50, 300, 70, 360, 80, 360], bg: '#fff', h: 3, arrow: 'end', waive: 1},
  ]}]}));
  assert.deepEqual(waived.warnings, [], JSON.stringify(waived.warnings));
});
test('validator: a connector leaves air, and the same amount at both ends', () => {
  const boxes = [{x: 0, y: 0, w: 132, h: 62, bg: '#111', bd: '2px solid #333'}, {x: 252, y: 0, w: 132, h: 62, bg: '#111', bd: '2px solid #333'}];
  const one = els => validate(withRoles({w: 960, h: 540, slides: [{els: [...boxes, ...els]}]})).warnings;
  assert.ok(one([{x: 132, y: 31, line: [252, 31], bg: '#fff', h: 3, arrow: 'end'}]).some(w => /touches the box/.test(w)), 'flush against both borders (K1/D1)');
  assert.ok(one([{x: 136, y: 31, line: [236, 31], bg: '#fff', h: 3, arrow: 'end'}]).some(w => /uneven air/.test(w)), '4px vs 16px (K5)');
  assert.deepEqual(one([{x: 142, y: 31, line: [242, 31], bg: '#fff', h: 3, arrow: 'end'}]), [], '10px both ends (K3) is clean');
  assert.deepEqual(one([{x: 134, y: 31, line: [250, 31], bg: '#fff', h: 3, arrow: 'end'}]), [], 'the rule is about touching a border, not about being tight');
  // to:/from: hand the gap to the engine, so the authored geometry is not second-guessed
  assert.deepEqual(one([{x: 132, y: 31, line: [252, 31], bg: '#fff', h: 3, arrow: 'end', to: 1, from: 0}]), [], 'terminated connectors are the engine\'s business');
});
test('validator: no shared stubs, and head/arrow compose', () => {
  const fan = [{x: 100, y: 100, curve: [180, 100, 180, 60, 260, 60], bg: '#fff', h: 3, arrow: 'end'},
               {x: 100, y: 100, curve: [180, 100, 180, 140, 260, 140], bg: '#fff', h: 3, arrow: 'end'}];
  // F4: two curves straight off one point, no stub feeding it — accepted
  assert.deepEqual(validate(withRoles({w: 960, h: 540, slides: [{els: fan}]})).warnings, [], 'a stubless fan-out is not a stub');
  // F3/E4: a segment ENDS at that point and the two curves leave from it — that junction is what reads badly
  const v = validate(withRoles({w: 960, h: 540, slides: [{els: [{x: 40, y: 100, line: [100, 100], bg: '#fff', h: 3, arrow: 'end'}, ...fan]}]}));
  assert.ok(v.warnings.some(w => /shared stub/.test(w)), JSON.stringify(v.warnings));
  const h = validate(withRoles({w: 960, h: 540, slides: [{els: [
    {x: 100, y: 100, line: [300, 100], bg: '#fff', h: 3, arrow: 'end', head: 'dot'},
    {x: 100, y: 200, line: [300, 200], bg: '#fff', h: 3, head: 'bar'},
    {x: 100, y: 300, line: [300, 300], bg: '#fff', h: 3, arrow: 'end', head: 'spike'},
  ]}]}));
  for (const re of [/head needs arrow/, /head "spike"/]) assert.ok(h.errors.some(e => re.test(e)), String(re));
  assert.equal(h.errors.length, 2, JSON.stringify(h.errors));
});
test('validator: dash is 1 or [on,off]', () => {
  const v = validate(withRoles({w: 960, h: 540, slides: [{els: [
    {x: 100, y: 100, line: [300, 100], bg: '#fff', h: 3, dash: 1},
    {x: 100, y: 160, line: [300, 160], bg: '#fff', h: 3, dash: [10, 8]},
    {x: 100, y: 220, line: [300, 220], bg: '#fff', h: 3, dash: 'yes'},
    {x: 100, y: 280, w: 90, role: 'Body', text: 'not a connector', dash: 1},
  ]}]}));
  for (const re of [/dash must be 1 or \[on,off\]/, /dash needs a line or a curve/]) assert.ok(v.errors.some(e => re.test(e)), String(re));
  assert.equal(v.errors.length, 2, JSON.stringify(v.errors));
});
test('validator: a connector is a stroke with a HEAD — headless rules, leaders, chart series and decoration are exempt', () => {
  // every row here would trip a connector rule if it were judged as one: a diagonal, a tight channel, a control point past
  // the end, one at 20% of the run, a flush end, and uneven ends. None carries an arrow, so none of them is a connector.
  const boxes = [{x: 0, y: 0, w: 132, h: 62, bg: '#111', bd: '2px solid #333'}, {x: 252, y: 0, w: 132, h: 62, bg: '#111', bd: '2px solid #333'}];
  const shapes = [
    {x: 20, y: 90, line: [300, 260], bg: '#fff', h: 3},                          // a chart series segment is diagonal by definition
    {x: 20, y: 90, line: [300, 20], bg: '#fff', h: 3},                           // …and shares a vertex with the one above (a polyline, not a stub)
    {x: 20, y: 300, curve: [50, 300, 70, 360, 80, 360], bg: '#fff', h: 3},       // a decorative swoosh in a 60px space
    {x: 400, y: 300, curve: [560, 300, 720, 400, 600, 400], bg: '#fff', h: 3},
    {x: 400, y: 460, curve: [440, 460, 560, 500, 600, 500], bg: '#fff', h: 3},
    {x: 132, y: 31, line: [252, 31], bg: '#fff', h: 3},                          // a rule touching both boxes: it is a rule
    {x: 136, y: 45, line: [236, 45], bg: '#fff', h: 1},                          // 4px/16px — a hairline leader, not a connector
  ];
  assert.deepEqual(validate(withRoles({w: 960, h: 540, slides: [{els: [...boxes, ...shapes]}]})).warnings, [],
    'headless strokes must not be judged as connectors — a validator that flags a chart for being diagonal teaches agents to ignore it');
  // the identical geometry WITH a head is a connector, and every rule applies
  const headed = validate(withRoles({w: 960, h: 540, slides: [{els: [...boxes, ...shapes.map(r => ({...r, arrow: 'end'}))]}]})).warnings;
  for (const re of [/diagonal straight run/, /spanning 60px/, /past the endpoints/, /% of the run/, /touches the box/, /uneven air/, /too light/])
    assert.ok(headed.some(w => re.test(w)), String(re) + ' — ' + JSON.stringify(headed));
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
test('create: --title is model data (clean tab title, clean ⤓/⌘S filename), </script> in content escaped, namespace follows the model', () => {
  const base = {styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: [{x: 0, y: 0, w: 10, role: 'Body', text: 'a</script><b>'}]}]};
  const a = create(base, {title: 'x<y&z'});
  assert.match(a.html, /<title>decklet<\/title>/, 'no sentinel and no interpolation in <title> — the runtime titles the document');
  assert.doesNotMatch(a.html, /\/\*\/?TITLE\*\//, 'the TITLE marker is gone from the engine');
  assert.equal(modelOf(a.html).title, 'x<y&z', '--title lands in the model, escaped by JSON not by HTML');
  assert.match(tpl, /document\.title=deck\.title\|\|'decklet'/, 'one source for the tab title, the ⤓ PDF name and the ⌘S copy name');
  assert.equal(create(base, {}).deck.title, 'decklet');
  assert.equal(create({...base, title: 'from the model'}, {}).deck.title, 'from the model');
  assert.equal(create({...base, title: 'from the model'}, {title: 'from the flag'}).deck.title, 'from the flag', '--title wins');
  assert.ok(!/a<\/script><b>/.test(a.html) && a.html.includes('a<\\/script><b>'));
  assert.deepEqual(modelOf(a.html).slides[0].els[0].text, 'a</script><b>', 'round-trips through modelOf');
  const b = create({...base, slides: [{els: []}]}, {}); assert.notEqual(a.hash, b.hash);
  assert.equal(modelOf(create({...base, title: 'second pass'}, {template: a.html}).html).title, 'second pass', 're-create over a built deck still substitutes');
});

test('validate --style: text fit is measured against the scale create() will build with (ONE merge, no drift)', () => {
  // a Body row that fits at the template's neutral 16px and overflows badly at the brand's 40px
  const model = {w: 960, h: 540, slides: [{els: [{x: 0, y: 0, w: 200, role: 'Body', nowrap: 1, text: 'Two deals, one re-read'}]}]};
  const style = {roles: {Body: {font: 'Georgia', size: 40, weight: 400, lh: 48, color: '#000'}}, pad: {chip: '2px 6px'}};
  const mf = path.join(tmp, 'fit-model.json'), sf = path.join(tmp, 'fit-style.json');
  fs.writeFileSync(mf, JSON.stringify(model)); fs.writeFileSync(sf, JSON.stringify(style));
  const cli = (...args) => { const r = spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), mf, ...args], {encoding: 'utf8'}); return {out: r.stdout + r.stderr, code: r.status}; };
  assert.match(cli().out, /0 errors, 0 warnings/, 'without --style the neutral scale hides the overflow');
  const s = cli('--style', sf);
  assert.match(s.out, /likely wider than w=200/, '--style surfaces exactly what create --style reports');
  assert.equal(cli('--style', sf, '--strict').code, 1, '--strict fails on it');
  // the merge itself is shared with create() — the two can never disagree
  assert.deepEqual(validate(mergeStyle(structuredClone(model), style)).warnings, validate(create(model, {style}).deck).warnings);
  assert.equal(mergeStyle(structuredClone(model), style).styles.pad.chip, '2px 6px');
  assert.equal(mergeStyle({styles: {roles: {Body: {size: 9}}}}, style).styles.roles.Body.size, 9, 'the model wins per role');
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
  await ev(() => save()); await p.waitForTimeout(400); assert.deepEqual(await ev(() => [document.getElementById('autosave').dataset.state, document.getElementById('autosave').getAttribute('aria-label')]), ['ok', await ev(() => document.getElementById('autosave').title)]); assert.match(await ev(() => document.getElementById('autosave').title), /^Autosaved · \d\d:\d\d:\d\d$/, 'tooltip carries the last save time');
  await ev(() => { window.__set = store.set; store.set = () => false; save(); }); assert.equal(await ev(() => document.getElementById('autosave').dataset.state), 'busy', 'amber while saving'); await p.waitForTimeout(400);
  { const bad = await ev(() => [document.getElementById('autosave').dataset.state, document.getElementById('autosave').getAttribute('aria-label')]); assert.equal(bad[0], 'bad'); assert.match(bad[1], /^Not saved — edits will be lost on refresh( \(last saved \d\d:\d\d:\d\d\))?$/, 'bad tooltip names the last successful save time'); } await ev(() => { store.set = window.__set; save(); }); await p.waitForTimeout(400);
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
// ── 2d-bis. a move moves ALL of a row: a connector's far end is model geometry, not a rendered consequence ──
// The bug this catches: drag wrote x/y only, so line:[x2,y2] / curve:[…] stayed where they were authored and the
// connector stretched instead of travelling — one end followed the mouse, the other stayed pinned to the canvas.
live('live: a dragged connector travels WHOLE — every point moves by the same delta, length and angle unchanged', async () => {
  const model = {w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: [
    {x: 100, y: 100, line: [400, 220], bg: '#5B9CF6', h: 3, arrow: 'end'},
    {x: 100, y: 300, curve: [200, 300, 300, 400, 400, 400], bg: '#6B9E8C', h: 3, arrow: 'end'},
    {x: 600, y: 120, w: 160, h: 80, box: 1, bd: '#5B9CF6'},
  ]}]};
  const f = path.join(tmp, 'drag-connector.html'); fs.writeFileSync(f, create(model).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  await p.evaluate(() => { localStorage.clear(); canvas.style.transform = 'none'; }); // model space: 1 canvas px = 1 client px
  const DX = 120, DY = -40;
  const boxOfRow = n => p.locator(`#canvas .el[data-n="${n}"]`).boundingBox();
  const dragRow = async n => {
    const bb = await boxOfRow(n), cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    await p.mouse.move(cx, cy); await p.mouse.down();
    await p.mouse.move(cx + DX / 2, cy + DY / 2); await p.mouse.move(cx + DX, cy + DY); await p.mouse.up();
    return bb;
  };
  const row = n => p.evaluate(k => structuredClone(slide().els[k]), n);
  // a straight connector
  const before0 = await dragRow(0), after0 = await row(0), painted0 = await boxOfRow(0);
  assert.deepEqual([after0.x, after0.y], [100 + DX, 100 + DY], 'the tail travelled');
  assert.deepEqual(after0.line, [400 + DX, 220 + DY], 'the head travelled by the SAME delta — it is not pinned');
  assert.ok(Math.abs(painted0.width - before0.width) < 1 && Math.abs(painted0.height - before0.height) < 1,
    `the stroke kept its length and angle: ${before0.width}x${before0.height} became ${painted0.width}x${painted0.height}`);
  assert.ok(Math.abs(painted0.x - before0.x - DX) < 1.5 && Math.abs(painted0.y - before0.y - DY) < 1.5, 'and it landed where the mouse left it');
  // a bezier connector: start, both control points and the end all translate
  const before1 = await boxOfRow(1); await dragRow(1); const after1 = await row(1), painted1 = await boxOfRow(1);
  assert.deepEqual([after1.x, after1.y], [100 + DX, 300 + DY]);
  assert.deepEqual(after1.curve, [200 + DX, 300 + DY, 300 + DX, 400 + DY, 400 + DX, 400 + DY], 'control points and end travel with the start');
  assert.ok(Math.abs(painted1.width - before1.width) < 1 && Math.abs(painted1.height - before1.height) < 1, 'the curve kept its shape');
  // multi-select: a connector dragged alongside a box keeps step with it
  await p.evaluate(() => { sel.clear(); sel.add(0); sel.add(2); render(); });
  const boxBefore = await row(2), connBefore = await row(0);
  const bb = await boxOfRow(2), cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
  await p.mouse.move(cx, cy); await p.mouse.down(); // pressing a row that is already selected keeps the whole group
  await p.mouse.move(cx + 40, cy + 40); await p.mouse.move(cx + 80, cy + 80); await p.mouse.up();
  const boxAfter = await row(2), connAfter = await row(0);
  assert.deepEqual([boxAfter.x - boxBefore.x, boxAfter.y - boxBefore.y], [80, 80]);
  assert.deepEqual([connAfter.x - connBefore.x, connAfter.y - connBefore.y], [80, 80], 'the connector moved with the group');
  assert.deepEqual([connAfter.line[0] - connBefore.line[0], connAfter.line[1] - connBefore.line[1]], [80, 80], 'head included');
  // ⌘Z restores the whole row, geometry and all
  await p.evaluate(() => undo());
  const undone = await row(0);
  assert.deepEqual([undone.x, undone.y, ...undone.line], [100 + DX, 100 + DY, 400 + DX, 220 + DY], 'undo restores the pre-drag geometry');
  await b.close();
  assert.deepEqual(errs, []);
});
// ── 2d-ter. the marquee: a drag window is the only way to take a group without clicking each row ──
live('live: marquee — a drag from empty canvas takes every row it fully contains, ⇧ adds, partial overlap takes nothing, a click still deselects', async () => {
  const model = {w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: [
    {x: 100, y: 100, w: 120, h: 60, box: 1, bd: '#5B9CF6'},   // 0 — inside band A
    {x: 300, y: 100, w: 120, h: 60, box: 1, bd: '#5B9CF6'},   // 1 — inside band A
    {x: 100, y: 300, w: 120, h: 60, box: 1, bd: '#5B9CF6'},   // 2 — inside band B only
    {x: 400, y: 60, w: 300, h: 300, box: 1, bd: '#6B9E8C'},   // 3 — straddles band A's edge: never taken
  ]}]};
  const f = path.join(tmp, 'marquee.html'); fs.writeFileSync(f, create(model).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  await p.evaluate(() => { localStorage.clear(); canvas.style.transform = 'none'; });
  const org = await p.evaluate(() => { const r = canvas.getBoundingClientRect(); return {x: r.left, y: r.top}; });
  const at = (x, y) => [org.x + x, org.y + y];
  const band = async (x1, y1, x2, y2, mod) => {
    await p.mouse.move(...at(x1, y1)); if (mod) await p.keyboard.down(mod); await p.mouse.down();
    await p.mouse.move(...at((x1 + x2) / 2, (y1 + y2) / 2)); await p.mouse.move(...at(x2, y2));
    const mid = await p.evaluate(() => canvas.querySelectorAll('.band').length);
    await p.mouse.up(); if (mod) await p.keyboard.up(mod);
    return mid;
  };
  const picked = () => p.evaluate(() => [...sel].sort());
  const model0 = await p.evaluate(() => JSON.stringify(slide().els));
  // band A: 60,60 → 460,200
  const drawn = await band(60, 60, 460, 200);
  assert.equal(drawn, 1, 'the drag window is drawn while the button is down');
  assert.deepEqual(await picked(), [0, 1], 'rows wholly inside are taken; the row straddling the edge is not');
  assert.equal(await p.evaluate(() => canvas.querySelectorAll('.band').length), 0, 'and it is gone on release');
  assert.equal(await p.evaluate(() => JSON.stringify(slide().els)), model0, 'a marquee selects — it never moves anything');
  // ⇧-band B adds row 2 to the standing selection
  await band(60, 260, 300, 420, 'Shift');
  assert.deepEqual(await picked(), [0, 1, 2], '⇧ adds to the selection instead of replacing it');
  // a band with no rows wholly inside it clears the selection
  await band(700, 400, 900, 500);
  assert.deepEqual(await picked(), [], 'an empty band takes nothing');
  // a plain click on empty canvas still deselects
  await p.evaluate(() => { sel.clear(); sel.add(0); sel.add(1); render(); });
  await p.mouse.click(...at(60, 480));
  assert.deepEqual(await picked(), [], 'click-off deselects');
  // present mode is for reading: no marquee, no band
  await p.evaluate(() => { document.body.classList.add('present'); render(); });
  const inPresent = await band(60, 60, 460, 200);
  assert.equal(inPresent, 0, 'no drag window in present mode');
  await p.evaluate(() => { document.body.classList.remove('present'); render(); });
  await b.close();
  assert.deepEqual(errs, []);
});
// blocked storage, driven in WebKit — Safari's engine. Playwright's WebKit does NOT enforce Safari's file:// storage ban,
// so the ban is injected: what is being proved is that the engine reacts usefully, in the engine Kyle's browser runs.
live('live: storage blocked (Safari on file://) — the deck says so, keeps the session, and puts ⌘S in front of you', async () => {
  const f = path.join(tmp, 'nostore.html');
  fs.writeFileSync(f, create(explainer.model, {title: 'blocked'}).html);
  for (const engine of ['chromium', 'webkit']) {
    const b = await pw[engine].launch(); const p = await b.newPage();
    await p.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }}));
    await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
    const s = await p.evaluate(() => { const a = document.getElementById('autosave');
      return {nostore: document.body.classList.contains('nostore'), state: a.dataset.state, tip: a.title, button: getComputedStyle(document.getElementById('savecopy')).display}; });
    assert.equal(s.nostore, true, engine + ': blocked storage detected at load, before the first edit');
    assert.equal(s.state, 'bad', engine);
    assert.match(s.tip, /⌘S/, engine + ': the tooltip names the durable path');
    assert.notEqual(s.button, 'none', engine + ': ⌘S has a button in this state');
    // the session still works: edits, navigation and undo all survive without persistence
    assert.deepEqual(await p.evaluate(() => { sel.clear(); sel.add(2); render(); snap(); slide().els[2].text = 'still editable'; save(); nav(1); nav(-1); const t = slide().els[2].text; undo(); return [t, slide().els[2].text.slice(0, 6)]; }), ['still editable', 'Agent-'], engine + ': in-memory shim keeps the session');
    await b.close();
  }
});
live('live: ⤓ export never touches the visible page — nothing flashes', async () => {
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  await p.goto(pathToFileURL(path.join(root, 'deck.html')).href); await p.waitForSelector('#canvas .el');
  // sampled every frame WHILE the export runs — the clone used to be dropped into document flow to be serialised
  const seen = await p.evaluate(async () => {
    const bg0 = getComputedStyle(canvas).backgroundColor, hits = [], CHROME = ['wrap', 'hud', 'sheet', 'tb'];
    let run = true, busySeen = false;
    const sample = () => {
      if (!run) return;
      for (const nd of document.body.children) {
        if (CHROME.includes(nd.id)) continue;
        const r = nd.getBoundingClientRect();
        if (r.width && r.height && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight) hits.push(nd.tagName + JSON.stringify([r.left, r.top, r.width, r.height].map(Math.round)));
      }
      const bg = getComputedStyle(canvas).backgroundColor; if (bg !== bg0) hits.push('canvas background ' + bg);
      busySeen ||= document.getElementById('pdf').hasAttribute('aria-busy');
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    HTMLAnchorElement.prototype.click = () => {}; URL.createObjectURL = () => 'blob:x';
    await exportPdf(); run = false;
    return {hits: [...new Set(hits)], busySeen, bg1: getComputedStyle(canvas).backgroundColor, bg0, busy: document.getElementById('pdf').hasAttribute('aria-busy')};
  });
  await b.close();
  assert.deepEqual(seen.hits, [], 'something the export created was visible on the page');
  assert.equal(seen.bg1, seen.bg0);
  assert.equal(seen.busySeen, true, '⤓ reports that it is working'); assert.equal(seen.busy, false, '…and stops when it is done');
});
live('live: links survive — clickable in the deck, real /Link annotations in the ⤓ PDF, and they round-trip', async () => {
  const model = {w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles}, slides: [{name: 'cta', els: [
    {x: 60, y: 200, w: 300, h: 60, bg: '#5B9CF6', radius: 8, href: 'https://calendly.com/d/cym7-q65-cht/discovery'},
    {x: 60, y: 218, w: 300, role: 'Body', align: 'center', text: 'Book a discovery call', href: 'https://calendly.com/d/cym7-q65-cht/discovery'},
    {x: 60, y: 320, w: 500, role: 'Body', html: 'or write to <a href="mailto:hi@example.com">hi@example.com</a> instead'},
  ]}]};
  const f = path.join(tmp, 'links.html'); fs.writeFileSync(f, create(model).html);
  assert.equal(modelOf(fs.readFileSync(f, 'utf8')).slides[0].els[0].href, model.slides[0].els[0].href, 'href round-trips through create');
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  assert.deepEqual(await p.evaluate(() => [...canvas.querySelectorAll('a[href]')].map(a => [a.className, a.href, a.target, getComputedStyle(a).pointerEvents])), [
    ['lk', 'https://calendly.com/d/cym7-q65-cht/discovery', '_blank', 'none'],
    ['lk', 'https://calendly.com/d/cym7-q65-cht/discovery', '_blank', 'none'],
    ['', 'mailto:hi@example.com', '_blank', 'auto'],
  ], 'row links are inert while editing; inline marks are ordinary anchors');
  assert.equal(await p.evaluate(() => { document.body.classList.add('present'); const v = getComputedStyle(canvas.querySelector('a.lk')).pointerEvents; document.body.classList.remove('present'); return v; }), 'auto', 'clickable while presenting');
  const pdf = await p.evaluate(async () => { let blob; URL.createObjectURL = x => { blob = x; return 'blob:x'; }; HTMLAnchorElement.prototype.click = () => {}; await exportPdf(); return blob.text(); });
  await b.close();
  assert.equal((pdf.match(/\/Subtype \/Link/g) || []).length, 3, 'one annotation per link — two on the CTA, one on the inline mark');
  assert.ok(pdf.includes('(https://calendly.com/d/cym7-q65-cht/discovery)') && pdf.includes('(mailto:hi@example.com)'), 'the URIs are in the file');
  assert.match(pdf, /\/Annots \[/); assert.deepEqual(errs, []);
});
// The head IS the terminus. It used to be APPENDED outside the stated end, so every connector drew ~15px longer than it was
// authored: a symmetric 8px gap at both ends rendered as 8px at the tail and −7px at the nose, i.e. the head inside the target.
// That one behaviour is what made authors hand-inset every endpoint. Measured here in model space, transform off.
live('live: an arrow head ENDS on the row\'s stated end point — the connector never draws longer than authored', async () => {
  const model = {w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: [
    {x: 100, y: 100, line: [400, 100], bg: '#5B9CF6', h: 3, arrow: 'end'},
    {x: 100, y: 160, line: [400, 160], bg: '#5B9CF6', h: 3, arrow: 'both'},
    {x: 100, y: 220, line: [400, 220], bg: '#5B9CF6', h: 3},
    {x: 100, y: 300, curve: [200, 300, 300, 400, 400, 400], bg: '#6B9E8C', h: 3, arrow: 'end'},
  ]}]};
  const f = path.join(tmp, 'terminus.html'); fs.writeFileSync(f, create(model).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  const got = await p.evaluate(() => {
    canvas.style.transform = 'none'; canvas.style.border = '0';   // measure in model space (the 1px canvas border shifts children)
    const cb = canvas.getBoundingClientRect(), L = e => { const r = e.getBoundingClientRect(); return {l: r.left - cb.left, r: r.right - cb.left, t: r.top - cb.top, b: r.bottom - cb.top}; };
    const row = k => { const d = canvas.querySelector(`[data-n="${k}"]`); return {shaft: L(d), heads: [...d.querySelectorAll('.ar')].map(L)}; };
    const cv = canvas.querySelector('[data-n="3"]'), pa = cv.querySelector('svg > path');
    const sv = cv.querySelector('svg').getBoundingClientRect(), end = pa.getPointAtLength(pa.getTotalLength());
    return {end: row(0), both: row(1), none: row(2),
      curveShaftEnd: {x: sv.left - cb.left + end.x, y: sv.top - cb.top + end.y}, curveLen: pa.getTotalLength()};
  });
  await b.close();
  assert.deepEqual(errs, []);
  // arrow:'end' — the head's tip is the stated end (400); the shaft stops short of it and never pokes through
  assert.equal(got.end.heads.length, 1);
  assert.ok(Math.abs(got.end.heads[0].r - 400) < 1, `head tip at ${got.end.heads[0].r}, stated end is 400`);
  assert.ok(got.end.shaft.r <= got.end.heads[0].l + 0.5, `shaft ends at ${got.end.shaft.r}, head starts at ${got.end.heads[0].l} — the line must not extend past the head`);
  assert.ok(Math.abs(got.end.shaft.l - 100) < 1, 'the tail end is untouched');
  // arrow:'both' — a tip on each stated end, shaft strictly between them
  assert.equal(got.both.heads.length, 2);
  const xs = got.both.heads.map(h => [h.l, h.r]).flat();
  assert.ok(Math.abs(Math.min(...xs) - 100) < 1 && Math.abs(Math.max(...xs) - 400) < 1, `heads span ${Math.min(...xs)}..${Math.max(...xs)}, stated 100..400`);
  assert.ok(got.both.shaft.l > 100.5 && got.both.shaft.r < 399.5, 'the shaft is shortened at BOTH ends to make room');
  // no arrow — geometry is exactly what was written
  assert.ok(Math.abs(got.none.shaft.l - 100) < 1 && Math.abs(got.none.shaft.r - 400) < 1, 'a headless line is unchanged');
  // a curve's path is trimmed by the head length, and its marker tip lands on the stated end (400,400)
  assert.ok(Math.hypot(got.curveShaftEnd.x - 400, got.curveShaftEnd.y - 400) > 4, `the curve's own path must stop short of the tip to make room: ${JSON.stringify(got.curveShaftEnd)}`);
  assert.ok(Math.hypot(got.curveShaftEnd.x - 400, got.curveShaftEnd.y - 400) < 16, 'but only by the head length');
});
live('live: A1 from the connector probe — a symmetric 8px gap renders symmetric at BOTH ends', async () => {
  // the probe's A1: 132x62 boxes, shaft authored 8px clear of each. The head used to land 7px INSIDE the target.
  const BW = 132, BH = 62;
  const model = {w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: [
    {x: 60, y: 100, w: BW, h: BH, bg: '#1A1D21', bd: '2px solid #2C3138', radius: 12},
    {x: 60 + 252, y: 100, w: BW, h: BH, bg: '#1A1D21', bd: '2px solid #2C3138', radius: 12},
    {x: 60 + BW + 8, y: 131, line: [60 + 244, 131], bg: '#5B9CF6', h: 2.5, arrow: 'end'},
  ]}]};
  const f = path.join(tmp, 'a1.html'); fs.writeFileSync(f, create(model).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  const g = await p.evaluate(() => { canvas.style.transform = 'none'; canvas.style.border = '0';
    const cb = canvas.getBoundingClientRect(), X = (s, k) => { const r = canvas.querySelector(s).getBoundingClientRect(); return r[k] - cb.left; };
    const head = canvas.querySelector('[data-n="2"] .ar').getBoundingClientRect();
    return {fromRight: X('[data-n="0"]', 'right'), toLeft: X('[data-n="1"]', 'left'), shaftLeft: X('[data-n="2"]', 'left'), tip: head.right - cb.left};
  });
  await b.close();
  const tail = g.shaftLeft - g.fromRight, nose = g.toLeft - g.tip;
  assert.ok(Math.abs(tail - 8) < 1, `tail gap ${tail}, authored 8`);
  assert.ok(Math.abs(nose - 8) < 1, `nose gap ${nose}, authored 8 — the head used to overshoot to −7`);
  // and the gate now measures the same geometry the eye sees
  const r = await verify(f, {out: path.join(tmp, 'v-a1'), log: () => {}});
  assert.equal(r.parity[0].pass, true, JSON.stringify(r.parity[0].rows));
  const bad = {...model, slides: [{els: [model.slides[0].els[0], model.slides[0].els[1], {...model.slides[0].els[2], line: [60 + 272, 131]}]}]};
  const fb = path.join(tmp, 'a1-bad.html'); fs.writeFileSync(fb, create(bad).html);
  const rb = await verify(fb, {out: path.join(tmp, 'v-a1-bad'), log: () => {}});
  assert.equal(rb.parity[0].pass, false, 'a head aimed 20px into the target is still a failure');
  assert.match(JSON.stringify(rb.parity[0].rows), /arrow lands inside/);
});
live('live: a curve is a bezier row, and arrow heads come from the engine', async () => {
  const model = {w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: [
    {x: 100, y: 200, curve: [180, 200, 170, 100, 240, 100], bg: '#5B9CF6', h: 3, arrow: 'end'},
    {x: 400, y: 200, line: [560, 260], bg: '#5B9CF6', h: 3, arrow: 'both'},
  ]}]};
  const f = path.join(tmp, 'curve.html'); fs.writeFileSync(f, create(model).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  const got = await p.evaluate(() => {
    const c = canvas.querySelector('[data-n="0"]'), pa = c.querySelector('svg > path');  // the connector, not the marker's own path
    return {d: pa.getAttribute('d'), stroke: pa.getAttribute('stroke-width'), markerEnd: !!pa.getAttribute('marker-end'), markerStart: !!pa.getAttribute('marker-start'),
      // offsets, not client rects: #canvas is scaled to fit the window and the hull is asserted in model space
      covers: [c.offsetLeft <= 100, c.offsetLeft + c.offsetWidth >= 240, c.offsetTop <= 100, c.offsetTop + c.offsetHeight >= 200],
      heads: canvas.querySelectorAll('[data-n="1"] .ar').length};
  });
  await b.close();
  assert.match(got.d, /^M[\d.\- ]+C[\d.\- ]+ [\d.\- ]+ [\d.\- ]+$/, 'one cubic segment: ' + got.d);
  assert.deepEqual([got.markerEnd, got.markerStart], [true, false], 'arrow:"end" heads one end only');
  assert.deepEqual(got.covers, [true, true, true, true], 'the row box wraps the whole control hull, so parity can measure it');
  assert.equal(got.heads, 2, 'arrow:"both" puts a head on each end of a straight line');
  assert.deepEqual(errs, []);
});
live('live: to/from terminate a connector on the target\'s border — the arrow head never floats on its fill', async () => {
  const box = {x: 500, y: 180, w: 200, h: 100, bg: '#1A1D21', bd: '1.5px solid #5B9CF6', radius: 10};
  const model = {w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: [
    box,
    {x: 200, y: 230, line: [600, 230], bg: '#5B9CF6', h: 3, arrow: 'end', to: 0},                          // aimed at the box CENTRE
    {x: 200, y: 400, curve: [340, 400, 420, 230, 600, 230], bg: '#6B9E8C', h: 3, arrow: 'end', to: 0},     // same, on a bezier
    {x: 200, y: 460, line: [600, 460], bg: '#C97A54', h: 3, arrow: 'end'},                                 // no `to`: ends exactly where told
  ]}]};
  const f = path.join(tmp, 'terminate.html'); fs.writeFileSync(f, create(model).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  const got = await p.evaluate(() => {
    const end = k => { const d = canvas.querySelector(`[data-n="${k}"]`);
      if (d.dataset.seg) { const [, , x2, y2] = d.dataset.seg.split(',').map(Number); return [x2, y2]; }
      const c = d.dataset.cur.split(',').map(Number); return [c[6], c[7]]; };
    return {clipped: end(1), curved: end(2), plain: end(3), heads: [1, 2, 3].map(k => canvas.querySelector(`[data-n="${k}"]`).dataset.head)};
  });
  await b.close();
  assert.equal(Math.round(got.clipped[0]), 490, 'the straight connector stops 10px clear of the box border at x=500, not at the 600 it was given');
  assert.equal(Math.round(got.clipped[1]), 230);
  assert.ok(Math.hypot(got.curved[0] - 500, got.curved[1] - 230) > 6, `the bezier leaves air too: ${got.curved}`);
  assert.deepEqual(got.plain, [600, 460], 'without `to` the endpoint is exactly what the author wrote');
  assert.deepEqual(got.heads, ['end', 'end', 'end'], 'the head end is declared for the collision gate');
  assert.deepEqual(errs, []);
});
live('live: the page counter reads "1 / 3" when the footer row is empty, "text · 1 / 3" when it is not', async () => {
  const mk = text => ({w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles},
    master: [{id: 'foot', footer: 1, x: 60, y: 500, w: 300, role: 'Label', ...(text ? {text} : {text: ''})}],
    slides: [{els: []}, {els: []}, {els: []}]});
  const out = [];
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  for (const t of ['', 'undersight']) {
    const f = path.join(tmp, 'foot-' + (t || 'empty') + '.html'); fs.writeFileSync(f, create(mk(t)).html);
    await p.goto(pathToFileURL(f).href); await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForSelector('#canvas [data-footer]');
    out.push(await p.evaluate(() => canvas.querySelector('[data-footer]').textContent));
  }
  await b.close();
  assert.deepEqual(out, ['1 / 3', 'undersight · 1 / 3'], 'the separator only means something after preceding text');
});
live('live: present-mode peek HUD clears the page counter', async () => {
  // a 4:5 carousel with a right-anchored footer on the margin — a tall deck is HEIGHT-constrained, so the canvas fills the
  // screen top to bottom and its bottom-right counter lands exactly where the HUD peeks (what Kyle saw)
  const model = {w: 1080, h: 1350, format: 'carousel-4x5', styles: {roles: modelOf(tpl).styles.roles, margin: 72},
    master: [{id: 'foot', footer: 1, x: 700, y: 1290, w: 300, role: 'Label', text: 'undersight'}], slides: [{els: []}, {els: []}]};
  const f = path.join(tmp, 'peek.html'); fs.writeFileSync(f, create(model).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas [data-footer]');
  // fullscreen geometry: the canvas fills the screen, so its bottom-right counter is where the HUD peeks. Windowed mode
  // reserves 52px below the canvas and hides the clash — which is why this has to be measured at the fullscreen scale.
  const hit = await p.evaluate(() => { document.body.classList.add('present', 'peek');
    canvas.style.transform = `scale(${Math.min(innerWidth / deck.w, innerHeight / deck.h)})`;
    const a = document.getElementById('hud').getBoundingClientRect(), c = canvas.querySelector('[data-footer]').getBoundingClientRect();
    return {overlap: !(a.right < c.left || a.left > c.right || a.bottom < c.top || a.top > c.bottom), hud: [a.left, a.top, a.width], counter: [c.left, c.top, c.width]};
  });
  await b.close();
  assert.equal(hit.overlap, false, `the peek HUD sits on the page counter: ${JSON.stringify(hit)}`);
});
live('live: parity catches a painted row drawn THROUGH a text row (the class of defect a human sees instantly)', async () => {
  const roles = modelOf(tpl).styles.roles;
  const label = {x: 300, y: 260, w: 220, role: 'Body', nowrap: 1, text: 'grade held at B'};
  const mk = els => ({w: 960, h: 540, styles: {roles}, slides: [{els}]});
  const thru = {x: 120, y: 268, line: [820, 268], h: 3, bg: '#5B9CF6'};           // a leader line straight across the label
  const cases = {
    hit:  mk([thru, label]),
    over: mk([{...thru, over: 1}, label]),                                        // declared overlay: allowed
    tile: mk([{x: 280, y: 240, w: 260, h: 90, tile: 1, bg: '#1A1D21'}, label]),   // text INSIDE a painted box: always fine
    miss: mk([{...thru, y: 480, line: [820, 480]}, label]),
  };
  const res = {};
  for (const [k, m] of Object.entries(cases)) {
    const f = path.join(tmp, 'collide-' + k + '.html'); fs.writeFileSync(f, create(m).html);
    res[k] = await verify(f, {out: path.join(tmp, 'v-collide-' + k), log: () => {}});
  }
  assert.equal(res.hit.parity[0].pass, false, 'a line crossing a label must fail the gate');
  assert.match(JSON.stringify(res.hit.parity[0].rows), /overlapped by/);
  assert.equal(res.over.parity[0].pass, true, 'over:1 is how a deliberate overlay is expressed');
  assert.equal(res.tile.parity[0].pass, true, 'a text row sitting inside a tile is containment, not collision');
  assert.equal(res.miss.parity[0].pass, true);
});
live('live: parity catches text straddling a container edge, and an arrow head landing inside a fill', async () => {
  const roles = modelOf(tpl).styles.roles;
  const tile = {x: 300, y: 200, w: 300, h: 140, tile: 1, bg: '#1A1D21', bd: '1.5px solid #2C3138', radius: 12};
  const ring = {x: 300, y: 200, w: 300, h: 300, bd: '1.5px solid #2C3138', radius: 150};   // a decoration, not a container
  const band = {x: 100, y: 200, w: 760, h: 90, bg: '#20262E'};                             // a tint, no border — a backdrop
  const mk = els => ({w: 960, h: 540, styles: {roles}, slides: [{els}]});
  const cases = {
    inside:   mk([tile, {x: 320, y: 250, w: 260, role: 'Body', align: 'center', nowrap: 1, text: 'well inside'}]),
    straddle: mk([tile, {x: 480, y: 250, w: 260, role: 'Body', nowrap: 1, text: 'half out of the tile'}]),
    over:     mk([tile, {x: 480, y: 250, w: 260, role: 'Body', nowrap: 1, text: 'half out of the tile', over: 1}]),
    ring:     mk([ring, {x: 200, y: 320, w: 500, role: 'Body', nowrap: 1, text: 'a headline across a decorative ring'}]),
    band:     mk([band, {x: 120, y: 275, w: 500, role: 'Body', nowrap: 1, text: 'a caption on the edge of a tint band'}]),
    outside:  mk([tile, {x: 60, y: 420, w: 200, role: 'Body', nowrap: 1, text: 'nowhere near'}]),
    headIn:   mk([tile, {x: 100, y: 270, line: [450, 270], bg: '#5B9CF6', h: 3, arrow: 'end'}]),   // tips 150px inside the fill
    headOn:   mk([tile, {x: 100, y: 270, line: [450, 270], bg: '#5B9CF6', h: 3, arrow: 'end', to: 0}]),
    through:  mk([tile, {x: 100, y: 270, line: [860, 270], bg: '#5B9CF6', h: 3}]),                 // crosses, no head: routing, not a landing
  };
  const res = {};
  for (const [k, m] of Object.entries(cases)) {
    const f = path.join(tmp, 'g4-' + k + '.html'); fs.writeFileSync(f, create(m).html);
    res[k] = await verify(f, {out: path.join(tmp, 'v-g4-' + k), log: () => {}});
  }
  const pass = k => res[k].parity[0].pass, why = k => JSON.stringify(res[k].parity[0].rows);
  assert.equal(pass('inside'), true, 'text on a tile is containment: ' + why('inside'));
  assert.equal(pass('straddle'), false, 'a label hanging out of its tile must fail');
  assert.match(why('straddle'), /straddles/);
  assert.equal(pass('over'), true, 'over:1 is still the opt-out');
  assert.equal(pass('ring'), true, 'a circle outline is decoration — its bounding square is not a container edge: ' + why('ring'));
  assert.equal(pass('band'), true, 'a tint with no border is a backdrop, not a container: ' + why('band'));
  assert.equal(pass('outside'), true, why('outside'));
  assert.equal(pass('headIn'), false, 'an arrow head floating on a box fill must fail');
  assert.match(why('headIn'), /arrow lands inside/);
  assert.equal(pass('headOn'), true, '`to` puts the head on the border: ' + why('headOn'));
  assert.equal(pass('through'), true, 'a headless line crossing a card is routing, not a landing: ' + why('through'));
});
live('live: dash quantises to the run so a stroke starts and ends on a WHOLE dash, and keeps its head', async () => {
  const model = {w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: [
    {x: 100, y: 100, line: [403, 100], bg: '#5B9CF6', h: 2.5, arrow: 'end', dash: 1},
    {x: 100, y: 200, line: [377, 200], bg: '#5B9CF6', h: 2.5, dash: [10, 8]},
    {x: 100, y: 300, curve: [220, 300, 300, 420, 420, 420], bg: '#6B9E8C', h: 2.5, arrow: 'end', dash: 1},
  ]}]};
  const f = path.join(tmp, 'dash.html'); fs.writeFileSync(f, create(model).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  const got = await p.evaluate(() => {
    canvas.style.transform = 'none'; canvas.style.border = '0';
    const num = t => [...t.matchAll(/([\d.]+)px/g)].map(m => +m[1]);
    const lineRow = k => { const d = canvas.querySelector(`[data-n="${k}"]`);
      return {len: parseFloat(d.style.width), stops: num(getComputedStyle(d).backgroundImage), heads: d.querySelectorAll('.ar').length}; };
    const cv = canvas.querySelector('[data-n="2"]'), pa = cv.querySelector('svg > path');
    return {a: lineRow(0), b: lineRow(1), c: {len: pa.getTotalLength(), da: (pa.getAttribute('stroke-dasharray') || '').split(/[ ,]+/).map(Number), heads: cv.querySelectorAll('marker').length}};
  });
  await b.close();
  assert.deepEqual(errs, []);
  // stops read [0, on, on, on+off]; a whole number of periods plus one closing dash must fill the run exactly
  const whole = (len, on, off) => { const n = (len - on) / (on + off); return Math.abs(n - Math.round(n)) < 0.02 && n >= 1; };
  for (const [id, r] of [['dash:1', got.a], ['dash:[10,8]', got.b]]) {
    const on = r.stops[1], off = r.stops[3] - r.stops[1];
    assert.ok(whole(r.len, on, off), `${id}: run ${r.len} does not hold a whole number of ${on}/${off} dashes`);
  }
  assert.equal(got.a.heads, 1, 'a dashed line keeps its arrow head (the gradient used to eat it)');
  assert.ok(whole(got.c.len, got.c.da[0], got.c.da[1]), `curve: arc ${got.c.len} vs dasharray ${got.c.da}`);
  assert.equal(got.c.heads, 1, 'a dashed curve keeps its marker');
});
live('live: terminator shapes are drawn by the engine, centred on the stroke axis by construction', async () => {
  const shapes = ['triangle', 'chevron', 'dot', 'bar'];
  const model = {w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: shapes.map((h, k) => (
    {x: 100, y: 80 + k * 90, line: [400, 80 + k * 90], bg: '#5B9CF6', h: 3, arrow: 'end', head: h}))}]};
  const f = path.join(tmp, 'heads.html'); fs.writeFileSync(f, create(model).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  const got = await p.evaluate(n => { canvas.style.transform = 'none'; canvas.style.border = '0';
    const cb = canvas.getBoundingClientRect();
    return [...Array(n).keys()].map(k => { const d = canvas.querySelector(`[data-n="${k}"]`), hd = d.querySelector('.ar');
      const s = d.getBoundingClientRect(), a = hd.getBoundingClientRect();
      const g = hd.querySelector('path');
      return {tip: +(a.right - cb.left).toFixed(1), axis: +((s.top + s.bottom) / 2 - cb.top).toFixed(1), mid: +((a.top + a.bottom) / 2 - cb.top).toFixed(1), shaftEnd: +(s.right - cb.left).toFixed(1),
        d: g.getAttribute('d'), filled: g.getAttribute('fill') !== 'none'};
    }); }, shapes.length);
  await b.close();
  assert.deepEqual(errs, []);
  got.forEach((g, k) => {
    assert.ok(Math.abs(g.tip - 400) < 1, `${shapes[k]}: leading edge at ${g.tip}, stated end 400`);
    assert.ok(Math.abs(g.mid - g.axis) < 0.6, `${shapes[k]}: head centre ${g.mid} off the stroke axis ${g.axis}`);
    assert.ok(g.shaftEnd <= g.tip + 0.5, `${shapes[k]}: shaft runs past the head`);
  });
  assert.equal(new Set(got.map(g => g.d)).size, 4, 'four distinct head shapes, not four triangles: ' + JSON.stringify(got.map(g => g.d)));
  assert.deepEqual(got.map(g => g.filled), [true, false, true, true], 'the chevron is an OPEN head (J3), the rest are filled');
});
live('live: to:/from: leave 10px of air by default — a connector never lands on the border', async () => {
  const box = {x: 500, y: 180, w: 200, h: 100, bg: '#1A1D21', bd: '1.5px solid #5B9CF6', radius: 10};
  const model = {w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: [box,
    {x: 200, y: 230, line: [600, 230], bg: '#5B9CF6', h: 3, arrow: 'end', to: 0},
    {x: 200, y: 260, line: [600, 260], bg: '#5B9CF6', h: 3, arrow: 'end', to: 0, gap: 0},
    {x: 200, y: 400, curve: [340, 400, 420, 230, 600, 235], bg: '#6B9E8C', h: 3, arrow: 'end', to: 0},
  ]}]};
  const f = path.join(tmp, 'air.html'); fs.writeFileSync(f, create(model).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  const got = await p.evaluate(() => [1, 2, 3].map(k => { const d = canvas.querySelector(`[data-n="${k}"]`);
    if (d.dataset.seg) { const v = d.dataset.seg.split(',').map(Number); return [+v[2].toFixed(1), +v[3].toFixed(1)]; }
    const c = d.dataset.cur.split(',').map(Number); return [+c[6].toFixed(1), +c[7].toFixed(1)]; }));
  await b.close();
  assert.equal(got[0][0], 490, 'default: the tip stops 10px clear of the border at x=500');
  assert.equal(got[1][0], 500, 'gap:0 puts it back on the border');
  assert.ok(Math.hypot(got[2][0] - 500, got[2][1] - 230) > 8, `curve leaves air too: ${got[2]}`);
});
live('live: parity catches text over text', async () => {
  const roles = modelOf(tpl).styles.roles;
  const mk = els => ({w: 960, h: 540, styles: {roles}, slides: [{els}]});
  const title = {x: 60, y: 200, w: 700, role: 'H1', text: 'A title that runs long'};
  const cases = {
    clash: mk([title, {x: 60, y: 214, w: 400, role: 'Body', text: 'a caption underneath'}]),
    over:  mk([title, {x: 60, y: 214, w: 400, role: 'Body', text: 'a caption underneath', over: 1}]),
    clear: mk([title, {x: 60, y: 280, w: 400, role: 'Body', text: 'a caption underneath'}]),
  };
  const res = {};
  for (const [k, m] of Object.entries(cases)) {
    const f = path.join(tmp, 'tt-' + k + '.html'); fs.writeFileSync(f, create(m).html);
    res[k] = await verify(f, {out: path.join(tmp, 'v-tt-' + k), log: () => {}});
  }
  assert.equal(res.clash.parity[0].pass, false, 'two text rows on top of each other must fail');
  assert.match(JSON.stringify(res.clash.parity[0].rows), /overlaps text/);
  assert.equal(res.over.parity[0].pass, true, 'over:1 opts out');
  assert.equal(res.clear.parity[0].pass, true, JSON.stringify(res.clear.parity[0].rows));
});
live('live: the tab title is the model title — the ⤓ PDF and the ⌘S copy inherit it clean', async () => {
  const f = path.join(tmp, 'titled.html');
  fs.writeFileSync(f, create({styles: {roles: modelOf(tpl).styles.roles}, slides: [{els: []}]}, {title: 'Two deals, one re-read'}).html);
  const b = await pw.chromium.launch(); const p = await b.newPage();
  await p.goto(pathToFileURL(f).href); await p.evaluate(() => { localStorage.clear(); }); await p.reload();
  const names = await p.evaluate(() => [document.title, document.title.replace(/[\/:*?"<>|]+/g, '-') + '.pdf']);
  await b.close();
  assert.deepEqual(names, ['Two deals, one re-read', 'Two deals, one re-read.pdf'], 'no /*TITLE*/ sentinel in the tab or the download');
});
live('live: import-html --shots writes one reference PNG per page, named for the slide (verify --refs consumes it)', async () => {
  const dir = path.join(tmp, 'shots-new'), pages = ['alpha', 'beta'].map(n => {
    const f = path.join(tmp, n + '.html');
    fs.writeFileSync(f, `<body style="margin:0;width:800px;height:450px;background:#fff"><h1 style="position:absolute;left:40px;top:60px;font:700 40px sans-serif">${n}</h1></body>`);
    return f;
  });
  const d = await extract(pages, {w: 800, h: 450, shots: dir});   // the directory does not exist yet
  assert.deepEqual(Object.keys(d._report.refs), ['alpha', 'beta'], 'refs keyed by slide name');
  for (const s of d.slides) {
    const f = path.join(dir, s.name + '.png');   // exactly the name verify --refs looks for
    assert.equal(d._report.refs[s.name], f);
    const png = fs.readFileSync(f);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [800, 450], s.name + ': shot is the model viewport');
  }
  assert.equal((await extract([pages[0]], {w: 800, h: 450}))._report.refs, undefined, 'no --shots → no refs, exactly as before');
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

// ── 7. keyboard: a selection owns the arrows ──
live('live: arrows nudge a selection 1px (⇧ 10px), a connector travels whole, one undo per burst, no selection navigates', async () => {
  const model = {w: 960, h: 540, styles: {roles: modelOf(tpl).styles.roles}, slides: [
    {els: [{x: 100, y: 100, w: 200, text: 'moved', role: 'body'}, {x: 400, y: 200, line: [560, 260], bg: '#5B9CF6', h: 3, arrow: 'end'}]},
    {els: [{x: 100, y: 100, w: 200, text: 'two', role: 'body'}]},
  ]};
  const f = path.join(tmp, 'nudge.html'); fs.writeFileSync(f, create(model).html);
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  await p.evaluate(() => { sel.add(0); sel.add(1); render(); });
  const h0 = await p.evaluate(() => history.length);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Shift+ArrowRight');
  const got = await p.evaluate(() => ({i, a: [deck.slides[0].els[0].x, deck.slides[0].els[0].y], l: [deck.slides[0].els[1].x, deck.slides[0].els[1].y, ...deck.slides[0].els[1].line], h: history.length}));
  await b.close();
  assert.equal(got.i, 0, 'a selection owns the arrows: the deck did not navigate');
  assert.deepEqual(got.a, [112, 101], '→ → ↓ ⇧→ = +12, +1');
  assert.deepEqual(got.l, [412, 201, 572, 261], 'a line row travels whole: both ends move by the same delta');
  assert.equal(got.h - h0, 1, 'one undo snapshot per burst of nudges');
  assert.deepEqual(errs, []);
  // no selection: arrows navigate, exactly as before
  const b2 = await pw.chromium.launch(); const p2 = await b2.newPage({viewport: {width: 1280, height: 800}});
  await p2.goto(pathToFileURL(f).href); await p2.waitForSelector('#canvas .el');
  await p2.keyboard.press('ArrowRight');
  assert.equal(await p2.evaluate(() => i), 1, 'no selection: → navigates');
  await b2.close();
});
test('nudge shares the drag translation path and is named in the shortcuts popover', () => {
  assert.match(tpl, /const moveBy=\(el,o,dx,dy\)=>/, 'one moveBy helper');
  assert.equal((tpl.match(/moveBy\(/g) || []).length, 2, 'drag and nudge both call it — no second translation path');
  assert.match(tpl, /navigate · move a selection 1px \(⇧ 10px\)/);
});

// ── 8. F presents in-window when fullscreen is refused ──
live('live: fullscreen rejected or never settling → in-window present; Esc leaves it', async () => {
  const f = path.join(tmp, 'fsfb.html'); fs.writeFileSync(f, create(explainer.model, explainer.style).html);
  const b = await pw.chromium.launch();
  for (const stub of ['reject', 'hang']) {
    const p = await b.newPage({viewport: {width: 1280, height: 800}});
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
    await p.evaluate(s => { Element.prototype.requestFullscreen = () => s === 'reject' ? Promise.reject(new TypeError('not allowed')) : new Promise(() => {}); }, stub);
    await p.keyboard.press('f');
    await p.waitForFunction(() => document.body.classList.contains('present'), null, {timeout: 1500});
    const cls = await p.evaluate(() => [...document.body.classList]);
    assert.ok(cls.includes('present-inline'), stub + ': marker class for the fit maths: ' + cls);
    assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('hud')).display), 'none', stub + ': chrome hidden');
    await p.keyboard.press('Escape');
    assert.deepEqual(await p.evaluate(() => [document.body.classList.contains('present'), document.body.classList.contains('present-inline'), sheet.hidden]), [false, false, true], stub + ': Esc leaves in-window present without opening the sheet');
    assert.deepEqual(errs, [], stub);
    await p.close();
  }
  await b.close();
});
test('the F shortcut line names the in-window fallback', () => {
  assert.match(tpl, /<kbd>F<\/kbd> fullscreen \(presentation[^<]*in-window/);
});
