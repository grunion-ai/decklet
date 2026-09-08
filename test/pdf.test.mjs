// decklet pdf — the agent's PDF is vector, slide-sized, HUD-free and linked (Playwright, skipped when absent).
// bin/pdf.mjs drives the deck's own print pipeline (beforeprint → #print pages) through Chromium's print engine with a
// pixel @page, so text stays text and every href becomes a /Link annotation. The button takes the same route in Chromium.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {toPdf, inspect} from '../bin/pdf.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-pdf-'));
const model = () => ({w: 960, h: 540, title: 'pdf', slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Vector text stays text'}, {x: 60, y: 200, w: 300, role: 'Body', text: 'Read the docs', href: 'https://example.com/a'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Second slide'}, {x: 60, y: 200, w: 300, role: 'Body', text: 'Another link', href: 'https://example.com/b'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Third slide'}]},
]});
const deck = () => { const f = path.join(tmp, 'pdf.html'); fs.writeFileSync(f, create(model()).html); return f; };

test('inspect counts pages, MediaBox and links from PDF bytes', () => {
  const pdf = '%PDF-1.4\n1 0 obj << /Type /Pages /Kids [2 0 R] >> endobj\n2 0 obj << /Type /Page /MediaBox [0 0 720 405] /Annots [3 0 R] >> endobj\n3 0 obj << /Type /Annot /Subtype /Link >> endobj\n';
  const r = inspect(Buffer.from(pdf, 'latin1'));
  assert.deepEqual(r, {pages: 1, box: [720, 405], links: 1});
});

live('bin/pdf.mjs: one vector page per slide at the slide ratio, HUD hidden, links annotated', async () => {
  const out = path.join(tmp, 'out.pdf');
  const r = await toPdf(deck(), out);
  assert.equal(r.pages, 3);
  assert.ok(Math.abs(r.box[0] / r.box[1] - 960 / 540) < 0.005, `ratio ${r.box}`);
  assert.equal(r.links, 2);
  assert.equal(r.hud, 'none');                                  // computed display of #hud under print media
  const bytes = fs.readFileSync(out, 'latin1');
  assert.match(bytes, /\/Type\s*\/Font/);                        // text is text: at least one embedded font
  assert.doesNotMatch(bytes, /\/Filter\s*\/DCTDecode/);          // and no full-page JPEG
});

live('bin/pdf.mjs refuses a deck whose gate fails', async () => {
  const f = path.join(tmp, 'broken.html');
  const html = create(model()).html.replace(/#wrap,#hud,(#tb,#sheet[^}]*})/, '#wrap,$1'); assert.notEqual(html, create(model()).html);
  fs.writeFileSync(f, html);
  await assert.rejects(toPdf(f, path.join(tmp, 'broken.pdf')), /HUD/);
});

live('the PDF button in Chromium takes the print route: px @page injected, print() called, cleaned up after', async () => {
  const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
  await p.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await p.goto(pathToFileURL(deck()).href);
  await p.click('#pdf');
  await p.waitForFunction(() => window.__printed === 1);
  const rule = await p.evaluate(() => document.getElementById('pdfpage')?.textContent || '');
  assert.match(rule, /@page\{size:960px 540px;margin:0\}/);
  assert.match(rule, /#print \.pg\{zoom:1!important\}/);
  await p.evaluate(() => dispatchEvent(new Event('afterprint')));
  assert.equal(await p.evaluate(() => !!document.getElementById('pdfpage')), false);
  await b.close();
});
