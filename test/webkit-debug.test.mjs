// TEMP diagnostic — not part of the shipped suite. Prints the full WebKit parity row detail for the K20 fixtures
// (explainer slide 3, the every-layout deck's slides 15/32) so CI's real Linux WebKit tells us exactly what fails.
// Removed before this branch ships.
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {verify} from '../bin/verify.mjs';
import {LIBRARY} from '../lib/layouts.mjs';
import {NAMES, fill} from './layouts.test.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-wkdebug-'));

live('DEBUG explainer webkit rows', async () => {
  const model = JSON.parse(fs.readFileSync(path.join(root, 'examples/explainer/model.json'), 'utf8'));
  const f = path.join(tmp, 'explainer.html');
  fs.writeFileSync(f, create(model).html);
  const r = await verify(f, {out: path.join(tmp, 'v-explainer')});
  console.log('EXPLAINER WEBKIT:', JSON.stringify(r.engines.webkit, null, 1));
});

live('DEBUG every-layout webkit rows', async () => {
  const m = {w: 960, h: 540, title: 'library', styles: {margin: 60}, master: [{id: 'foot', footer: 1, x: 60, y: 500, w: 300, role: 'Label', text: 'library'}],
    slides: NAMES.map((n, k) => ({...fill(n, k), textOnly: true}))};
  const f = path.join(tmp, 'every-layout.html');
  fs.writeFileSync(f, create(m).html);
  const r = await verify(f, {out: path.join(tmp, 'v-every')});
  console.log('EVERY-LAYOUT WEBKIT (15, 32):', JSON.stringify(r.engines.webkit.filter(s => [15, 32].includes(s.slide)), null, 1));
});

live('DEBUG H1 natural width in webkit', async () => {
  const model = JSON.parse(fs.readFileSync(path.join(root, 'examples/explainer/model.json'), 'utf8'));
  const f = path.join(tmp, 'explainer-width.html');
  fs.writeFileSync(f, create(model).html);
  const b = await pw.webkit.launch();
  const p = await b.newPage({viewport: {width: 1060, height: 640}});
  await p.goto(pathToFileURL(f).href); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(300);
  await p.evaluate(k => { i = k; sel.clear(); render(); }, 2);
  await p.waitForTimeout(150);
  const width = await p.evaluate(() => {
    const el = document.querySelector('#canvas .el[data-n="4"]');
    const prevWrap = el.style.whiteSpace, prevW = el.style.width;
    el.style.whiteSpace = 'nowrap'; el.style.width = 'auto';
    const w = el.scrollWidth;
    el.style.whiteSpace = prevWrap; el.style.width = prevW;
    return w;
  });
  console.log('H1 NATURAL WIDTH (nowrap, webkit):', width);
  await b.close();
});
