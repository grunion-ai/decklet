// asset table (FRICTION F4): deck.assets = {id: data URI}; img and logo rows (and any other image key, e.g. a chart datum's
// logo once charts expand it into a row) reference an asset as '#id'. The file embeds each image ONCE, in the DECK block;
// the runtime resolves '#id' when it draws, and the editor's save writes the table back unchanged.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-assets-'));
const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 10"><rect width="40" height="10" fill="#1F6FEB"/><!--xometry-asset--></svg>');
const count = (s, needle) => s.split(needle).length - 1;
const N = 9;
const roles = {H1: {font: 'system-ui', size: 28, weight: 700, color: '#111', lh: 34}, Body: {font: 'system-ui', size: 16, weight: 400, color: '#111', lh: 22}};
const model = (extra = {}) => ({w: 960, h: 540, styles: {roles}, assets: {xometry: LOGO, ...extra},
  slides: Array.from({length: N}, (_, k) => ({els: [
    {x: 64, y: 64, w: 800, role: 'H1', text: `Slide ${k + 1}`},
    k % 2 ? {x: 64, y: 200, w: 120, h: 30, img: '#xometry'} : {x: 64, y: 200, h: 32, col: 120, logo: '#xometry', name: 'Xometry', role: 'Body'},
  ]}))});

test('validate: #id references to a known asset pass on img and logo rows', () => {
  const v = validate(model());
  assert.deepEqual(v.errors, []);
  assert.ok(!v.warnings.some(w => /asset/.test(w)), v.warnings.join(' | '));
});
test('validate: an unknown #id is an error naming the id', () => {
  const m = model(); m.slides[0].els[1].logo = '#nope'; m.slides[1].els[1].img = '#gone';
  const v = validate(m);
  assert.ok(v.errors.some(e => /#nope/.test(e) && /assets/.test(e)), v.errors.join(' | '));
  assert.ok(v.errors.some(e => /#gone/.test(e)), v.errors.join(' | '));
});
test('validate: an asset nobody uses is a warning; a non-data: asset is an error', () => {
  const v = validate(model({spare: LOGO, bad: 'https://example.com/x.png'}));
  assert.ok(v.warnings.some(w => /spare/.test(w) && /unused|nobody/.test(w)), v.warnings.join(' | '));
  assert.ok(v.errors.some(e => /assets\.bad/.test(e) && /data:/.test(e)), v.errors.join(' | '));
});
test('validate: an asset reference anywhere an image key sits counts as a use (a master row, a nested key)', () => {
  const m = model({acme: LOGO}); m.master = [{x: 900, y: 500, w: 40, h: 10, img: '#acme'}];
  assert.ok(!validate(m).warnings.some(w => /acme/.test(w)));
  m.master = [{x: 900, y: 500, w: 40, h: 10, deep: {data: [{logo: '#missing'}]}}];
  assert.ok(validate(m).errors.some(e => /master\[0\]\.deep\.data\[0\]\.logo/.test(e) && /#missing/.test(e)), 'nested references are checked by path');
});
test('create: one embed for N references', () => {
  const {html} = create(model());
  assert.equal(count(html, LOGO), 1, `the asset is embedded once for ${N} references`);
  assert.equal(count(html, '"#xometry"'), N);
});

live('runtime: #id resolves on img and logo rows, the PDF path sees the data URI, and the editor save round-trips the table', async () => {
  const f = path.join(tmp, 'deck.html'); fs.writeFileSync(f, create(model()).html);
  const b = await pw.chromium.launch();
  try {
    const p = await b.newPage(); await p.goto('file://' + f);
    for (const n of [0, 1]) {
      await p.evaluate(n => { location.hash = '#' + (n + 1); }, n);
      await p.waitForFunction(() => [...document.querySelectorAll('#canvas img')].length && [...document.querySelectorAll('#canvas img')].every(i => i.complete));
      const imgs = await p.evaluate(() => [...document.querySelectorAll('#canvas img')].map(i => ({src: i.getAttribute('src'), w: i.naturalWidth})));
      assert.equal(imgs.length, 1);
      assert.equal(imgs[0].src, LOGO, `slide ${n + 1}: src resolved from the table`);
      assert.ok(imgs[0].w > 0, `slide ${n + 1}: image decoded`);
    }
    const pdf = await p.evaluate(async () => { let blob; URL.createObjectURL = x => { blob = x; return 'blob:x'; }; HTMLAnchorElement.prototype.click = () => {}; await exportPdf(); return blob.size; });
    assert.ok(pdf > 1000, 'the ⤓ PDF builds with #id images');
    const saved = await p.evaluate(() => fileHtml());
    assert.equal(count(saved, LOGO), 1, 'the saved file still embeds the asset once');
    const g = path.join(tmp, 'saved.html'); fs.writeFileSync(g, saved);
    await p.goto('file://' + g);
    await p.waitForFunction(() => [...document.querySelectorAll('#canvas img')].length && [...document.querySelectorAll('#canvas img')].every(i => i.complete));
    assert.equal(await p.evaluate(() => document.querySelector('#canvas img').getAttribute('src')), LOGO, 'the saved copy resolves too');
    assert.deepEqual(await p.evaluate(() => deck.assets), {xometry: LOGO});
  } finally { await b.close(); }
});
