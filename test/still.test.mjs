// #85: a reader that runs no script (macOS QuickLook, Spotlight, grep, a repo's HTML preview) sees slide 1. The build writes a
// static copy of slide 1 into #canvas as a <noscript>; with script on, the parser keeps a <noscript> as inert text and render()
// empties #canvas before its first paint, so the editor is unchanged. Every write path refreshes the copy: create, the host's
// splice (bin/serve.mjs) and the page's own fileHtml() (the File System Access route).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {blockOf, splice} from '../lib/edits.mjs';
import {edits} from '../bin/edits.mjs';
import {projects, withProject} from './helpers/projects.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-still-'));
const model = () => ({w: 960, h: 540, title: 'still', master: [{id: 'foot', footer: 1, x: 660, y: 500, w: 240, align: 'right', role: 'Caption', text: 'probe deck'}], slides: [
  {els: [{x: 60, y: 120, w: 840, role: 'H1', text: 'Quarterly <review> & plan', anim: 'rise'},
    {x: 60, y: 240, w: 300, h: 120, box: 1, role: 'Body', text: 'boxed'},
    {x: 420, y: 240, w: 400, role: 'Body', html: 'see <a href="https://example.com/x">the site</a> and <a href="javascript:alert(1)">this</a>'}]},
  {els: [{x: 60, y: 120, w: 840, role: 'H1', text: 'Second slide'}]},
]});
const write = (name, html) => { const f = path.join(tmp, name); fs.writeFileSync(f, html); return f; };
// the static copy, as the file carries it: the <noscript> that opens #canvas
const stillOf = html => { const m = html.match(/<div id="canvas"><noscript>([\s\S]*?)<\/noscript><\/div>/); return m && m[1]; };

test('create writes slide 1 into #canvas as static markup: the title escaped as the renderer escapes it, no later slide', () => {
  const {html} = create(model());
  const s = stillOf(html);
  assert.ok(s, 'the built file opens #canvas with a <noscript> static copy');
  assert.ok(s.includes('Quarterly &lt;review&gt; &amp; plan'), 'the title, escaped like textContent');
  assert.ok(s.includes('>boxed<') && /class="el box"/.test(s), 'a box row keeps its classes, so the stylesheet draws it');
  assert.ok(s.includes('probe deck') && s.includes('1 / 2'), 'the footer master and the counter');
  assert.ok(!s.includes('Second slide'), 'slide 1 only');
  assert.match(s, /^<div class="still" style="--u:min\(calc\(100cqw \/ 960\),calc\(100cqh \/ 540\)\);/, 'one model px in container units: CSS alone fits the copy to the wrapper');
  assert.doesNotMatch(s.replace(/url\([^)]*\)/g, ''), /\dpx/, 'every length is a multiple of it');
  assert.ok(!/href=/i.test(s), 'links carry no href in the copy: nothing navigates without script, and the self-containment check stays true');
  assert.ok(s.includes('the site') && s.includes('this'), 'the link text stays');
  assert.ok(!/\s(src|href)\s*=\s*["']https?:/i.test(html), 'bin/verify.mjs self-containment check: no network reference');
});

test('the static copy is inert to the data blocks: DECK, LOG, edits, create --from and a rebuild ignore it', () => {
  const m = model(); m.slides[0].els.push({x: 60, y: 420, w: 800, role: 'Caption', text: 'marker =/*DECK*/{} and /*LOG*/[] here'});
  m.slides[0].els.push({x: 60, y: 460, w: 800, role: 'Caption', html: 'x</noscript><img src=x onerror="alert(1)">'});
  const {html, deck} = create(m);
  assert.deepEqual(blockOf(html, 'DECK'), deck, 'the model block reads back unchanged');
  assert.deepEqual(blockOf(html, 'LOG'), []);
  assert.equal(edits(html).rev, deck.rev);
  assert.ok(!stillOf(html).includes('/*'), 'no comment marker inside the copy for an unanchored reader to match');
  const at = html.indexOf('<div id="canvas"><noscript>'), end = html.indexOf('</noscript>', at);
  assert.equal(end, at + '<div id="canvas"><noscript>'.length + stillOf(html).length, 'a row cannot close the <noscript> early');
  assert.ok(stillOf(html).includes('&lt;/noscript'), 'the row\'s own </noscript is text');
  const f = write('from.html', html);
  const again = create(m, {from: f});
  assert.equal(again.html.split('<div id="canvas"><noscript>').length, 2, 'create --from writes one static copy, never two');
  assert.equal(stillOf(again.html), stillOf(html), 'the same copy');
  const bare = write('bare.html', html.replace(/<div id="canvas"><noscript>[\s\S]*?<\/noscript><\/div>/, '<div id="canvas"></div>'));
  assert.equal(again.html, create(m, {from: bare}).html, 'create --from reads the same deck, id and rev with or without the copy');
  assert.equal(create(m).html, html, 'the build is deterministic');
});

test('an inline image is drawn; an asset-table image keeps its box only, so the file still embeds it once', () => {
  const dot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const m = model(); m.assets = {mark: dot};
  m.slides[0].els.push({x: 700, y: 60, w: 80, h: 40, img: '#mark'}, {x: 800, y: 60, w: 80, h: 40, img: dot.replace('AAAA', 'AAAB'), bd: '1px solid red'});
  const {html} = create(m), s = stillOf(html);
  assert.equal(html.split(dot).length, 2, 'the table image is embedded once');
  assert.ok(s.includes(dot.replace('AAAA', 'AAAB')), 'an inline image is drawn');
  assert.ok(!s.includes('#mark') && (s.match(/<img /g) || []).length === 1, 'the table image draws no picture in the copy');
});

test('the host splice refreshes the static copy from the saved model', () => {
  const {html, deck} = create(model());
  const next = structuredClone(deck); next.slides[0].els[0].text = 'Retitled by hand';
  const out = splice(html, next, [{s: 's1', r: 'r1', k: {text: ['Quarterly <review> & plan', 'Retitled by hand']}}]);
  const s = stillOf(out);
  assert.ok(s.includes('Retitled by hand'), 'the new title');
  assert.ok(!s.includes('Quarterly'), 'the old title is gone');
  assert.equal(blockOf(out, 'DECK').slides[0].els[0].text, 'Retitled by hand');
  const old = html.replace(/<div id="canvas"><noscript>[\s\S]*?<\/noscript><\/div>/, '<div id="canvas"></div>');
  assert.ok(stillOf(splice(old, next, [])).includes('Retitled by hand'), 'a file built before the copy existed gains one on its next save');
});

test('the template: a script-less #canvas fills its wrapper and render() empties it', () => {
  const tpl = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
  assert.match(tpl, /#canvas:has\(>noscript\)\{[^}]*width:100%;height:100%/, 'the static copy sizes to the wrapper in CSS');
  assert.match(tpl, /canvas\.innerHTML='';/, 'render() empties #canvas');
});

// ── live ──
const shoot = async (p, sel) => p.locator(sel).screenshot();
// distinct-pixel share of a PNG, read in a scripted page (the no-script page cannot decode its own shot)
const inked = async (browser, png) => { const ctx = await browser.newContext(); const p = await ctx.newPage();
  const r = await p.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, bg = d.slice(0, 3); let n = 0; for (let k = 0; k < d.length; k += 4) if (Math.abs(d[k] - bg[0]) + Math.abs(d[k + 1] - bg[1]) + Math.abs(d[k + 2] - bg[2]) > 60) n++; return n / (d.length / 4); }, png.toString('base64'));
  await ctx.close(); return r; };

for (const engine of projects(['chromium', 'webkit'])) live(`${engine}: with script off the file shows slide 1, title inside the slide box, fitted to the window`, async () => withProject(pw, engine, async ({browser, context}) => {
  const f = write(`off-${engine}.html`, create(model()).html);
  const ctx = await context({javaScriptEnabled: false, viewport: {width: 800, height: 600}}); const p = await ctx.newPage();
  await p.goto(pathToFileURL(f).href);
  const slide = await p.locator('#canvas .still').boundingBox();
  const title = await p.locator('#canvas .still .el', {hasText: 'Quarterly <review> & plan'}).boundingBox();
  assert.ok(slide && title, 'the slide and its title are laid out');
  assert.ok(slide.width <= 800 && slide.x >= 0 && slide.y >= 0 && slide.y + slide.height <= 600, 'the slide fits the window: ' + JSON.stringify(slide));
  assert.ok(Math.abs(slide.width / slide.height - 960 / 540) < .02, 'at the deck ratio');
  assert.ok(slide.width > 600, 'scaled to the window, not left at a corner: ' + slide.width);
  assert.ok(title.x >= slide.x && title.y >= slide.y && title.x + title.width <= slide.x + slide.width + 1 && title.y + title.height <= slide.y + slide.height, 'the title sits inside the slide box');
  assert.ok(Math.abs((title.y - slide.y) / slide.height - 120 / 540) < .03, 'at its model position');
  const ink = await inked(browser, await p.screenshot());
  assert.ok(ink > .005, 'the preview is not blank: ' + ink);
}));

for (const engine of projects(['chromium', 'webkit'])) live(`${engine}: with script on, #canvas holds only live rows, the copy never painted, and the slide matches a build without the copy`, async () => withProject(pw, engine, async ({context}) => {
  const html = create(model()).html, f = write(`on-${engine}.html`, html);
  const bare = write(`bare-${engine}.html`, html.replace(/<div id="canvas"><noscript>[\s\S]*?<\/noscript><\/div>/, '<div id="canvas"></div>'));
  const ctx = await context({viewport: {width: 1100, height: 700}, reducedMotion: 'reduce'});
  await ctx.addInitScript(() => { window.__still = []; new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeName === 'NOSCRIPT' && n.parentNode && n.parentNode.id === 'canvas') window.__still.push({kids: n.childElementCount, boxes: n.getClientRects().length}); }).observe(document, {childList: true, subtree: true}); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForFunction(() => document.querySelector('#canvas .el'));
  assert.deepEqual(await p.evaluate(() => window.__still), [{kids: 0, boxes: 0}], 'the parser kept the copy as inert text: nothing in it could paint');
  assert.equal(await p.evaluate(() => [...document.getElementById('canvas').children].filter(c => !c.classList.contains('el') && !c.classList.contains('num')).length), 0, 'only live rows');
  assert.equal(await p.evaluate(() => !!document.querySelector('#canvas noscript, #canvas .still')), false, 'the copy is gone');
  await p.waitForTimeout(300); const a = await shoot(p, '#canvas');
  const q = await ctx.newPage(); await q.goto(pathToFileURL(bare).href); await q.waitForFunction(() => document.querySelector('#canvas .el')); await q.waitForTimeout(300);
  assert.ok(a.equals(await shoot(q, '#canvas')), 'the live slide is pixel-identical to the same deck without the copy');
  assert.equal(await p.evaluate(() => { dispatchEvent(new Event('beforeprint')); const r = [document.querySelectorAll('#print .pg').length, !!document.querySelector('.still')].join(); dispatchEvent(new Event('afterprint')); return r; }), '2,false', 'print draws every slide from the model and no copy');
  assert.equal(await p.evaluate(() => { sheetOpen(); const r = [document.querySelectorAll('#grid .cell').length, !!document.querySelector('.still')].join(); sheetClose(); return r; }), '2,false', 'the contact sheet too');
  assert.deepEqual(errs, []);
}));

live('write-back: an edit to slide 1 saved through the file handle carries the new title in the static copy', async () => withProject(pw, 'chromium', async ({context}) => {
  const f = write('wb.html', create(model()).html);
  const ctx = await context(); await ctx.addInitScript(() => { window.__writes = []; let mod = 1; const h = {kind: 'file', name: 'wb.html', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    getFile: async () => ({lastModified: mod, text: async () => window.__writes.at(-1) || document.documentElement.outerHTML}),
    createWritable: async () => ({write: async s => { window.__writes.push(s); }, close: async () => { mod++; }})}; window.showOpenFilePicker = async () => [h]; });
  const p = await ctx.newPage(); await p.goto(pathToFileURL(f).href); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => document.getElementById('autosave').dataset.state !== 'busy');
  await p.click('#autosave'); await p.waitForFunction(() => window.__writes.length === 1);
  await p.evaluate(() => { snap(); deck.slides[0].els[0].text = 'Edited <title>'; save(); });
  await p.waitForFunction(() => window.__writes.length === 2, null, {timeout: 3000});
  const out = await p.evaluate(() => window.__writes.at(-1)), s = stillOf(out);
  assert.ok(s && s.includes('Edited &lt;title&gt;'), 'the saved copy shows the edit');
  assert.ok(!s.includes('Quarterly'), 'and not the old title');
  assert.equal(s, stillOf(splice(out, blockOf(out, 'DECK'), blockOf(out, 'LOG'))), 'the page and the host write the same copy');
  assert.equal(blockOf(out, 'DECK').slides[0].els[0].text, 'Edited <title>');
  assert.ok(!/<div id="canvas"[^>]*>[^<]*<div class="el/.test(out), 'no live row reaches the file');
}));
