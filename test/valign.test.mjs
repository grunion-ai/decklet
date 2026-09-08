// vertical centring — live proofs (Playwright, skipped when absent):
// a `box` row with a height centres its text on the box; `valign:'middle'` does the same for any text row with an `h`
// (the two-row button: a painted rect and a label bound to the same y/h); `valign:'bottom'` seats it on the floor.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-valign-'));
const model = els => ({w: 960, h: 540, title: 'valign', slides: [{els}]});
// the text's ink centre vs the row's box centre, in canvas px
const offsets = async p => p.evaluate(() => [...document.querySelectorAll('#canvas .el')].map(d => {
  const r = document.createRange(); r.selectNodeContents(d); const t = r.getBoundingClientRect(), b = d.getBoundingClientRect();
  const k = canvas.getBoundingClientRect().width / W; return +(((t.top + t.bottom) / 2 - (b.top + b.bottom) / 2) / k).toFixed(1);
}));
live('box rows and valign rows centre their text; valign bottom seats it', async () => {
  const f = path.join(tmp, 'valign.html');
  fs.writeFileSync(f, create(model([
    {x: 60, y: 100, w: 200, h: 76, box: 1, role: 'H2', text: 'Margin −4 pts'},                                // 0 box
    {x: 300, y: 100, w: 220, h: 52, bg: 'var(--accent)', radius: 8},                                          // 1 button paint
    {x: 300, y: 100, w: 220, h: 52, role: 'H2', text: 'Book the pilot', align: 'center', valign: 'middle', nowrap: 1}, // 2 label
    {x: 600, y: 100, w: 200, h: 120, role: 'Body', text: 'floor', valign: 'bottom'},                         // 3 bottom
    {x: 600, y: 300, w: 200, h: 120, role: 'Body', text: 'top'},                                              // 4 default: top
  ])).html);
  const b = await pw.chromium.launch(); const p = await b.newPage(); await p.goto(pathToFileURL(f).href); await p.waitForTimeout(200);
  const o = await offsets(p);
  assert.ok(Math.abs(o[0]) <= 1.5, `box text centred: off by ${o[0]}`);
  assert.ok(Math.abs(o[2]) <= 1.5, `valign middle centred: off by ${o[2]}`);
  assert.ok(o[3] > 30, `valign bottom sits low: ${o[3]}`);
  assert.ok(o[4] < -30, `a plain row with h still hugs the top: ${o[4]}`);
  await b.close();
});
