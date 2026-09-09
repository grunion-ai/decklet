// `counter: 0` on the deck draws no page counter — canvas and print pages alike. Default still draws one.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-counter-'));
const model = (extra = {}) => ({w: 816, h: 1056, title: 'counter', format: 'document-letter', ...extra, slides: [
  {els: [{x: 46, y: 46, w: 724, role: 'H1', text: 'Letter'}, {x: 46, y: 120, w: 724, role: 'Body', text: 'Dear reader,'}]},
]});
const count = async (b, m, name) => {
  const f = path.join(tmp, name); fs.writeFileSync(f, create(m).html);
  const p = await b.newPage(); await p.goto(pathToFileURL(f).href); await p.waitForTimeout(150);
  const canvas = await p.locator('#canvas .num').count();
  await p.emulateMedia({media: 'print'}); await p.evaluate(() => dispatchEvent(new Event('beforeprint')));
  const print = await p.locator('#print .num').count();
  await p.close(); return {canvas, print};
};
live('counter:0 draws no page counter on the canvas or the print pages; the default still does', async () => {
  const b = await pw.chromium.launch();
  assert.deepEqual(await count(b, model({counter: 0}), 'off.html'), {canvas: 0, print: 0});
  const on = await count(b, model(), 'on.html');
  assert.equal(on.canvas, 1); assert.equal(on.print, 1);
  await b.close();
});
test('counter:0 survives create into the deck model', () => {
  const html = create(model({counter: 0})).html;
  assert.match(html, /"counter":0/);
});
