// decklet export — one PNG per slide at native resolution, HUD-free, selection-free, animations settled (Playwright, skipped when absent).
// bin/export.mjs --png is verify's screenshot loop lifted out on its own: goto file://, clear storage, transform:none + animation:none,
// i = k; sel.clear(); render(); shoot #canvas. It KEEPS the page counter (verify hides it for AE parity; a shipped card wants it).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync, spawnSync} from 'node:child_process';
import {create} from '../bin/create.mjs';
import {toPng} from '../bin/export.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-export-'));
const cli = path.resolve('bin/export.mjs');
const model = () => ({w: 960, h: 540, title: 'export', counter: 1, slides: [
  {name: 'cover', els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'First card'}]},
  {bg: '#123456', els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Second card on a background'}]},
  {name: 'close', els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Third card'}]},
]});
// the deck carries a flagged word (option C list, as a build with a dictionary writes it) so the editor WOULD underline 'card' at rest
const deck = (name = 'export.html', m = model(), opts = {}) => { const f = path.join(tmp, name); const html = create(m, opts).html.replace('/*SPELL*/{}/*/SPELL*/', '/*SPELL*/{"card":["cards"]}/*/SPELL*/'); assert.match(html, /\/\*SPELL\*\/\{"card":\["cards"\]\}/); fs.writeFileSync(f, html); return f; };
const size = f => { const b = fs.readFileSync(f); assert.equal(b.toString('latin1', 1, 4), 'PNG', `${f} is not a PNG`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }; // IHDR width/height, no image library
const pngs = dir => fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();

live('--png writes exactly one PNG per slide, numbered and named, at native W×H, HUD hidden, spell marks off, counter kept', async () => {
  const out = path.join(tmp, 'png');
  const r = await toPng(deck(), {out});
  assert.deepEqual(pngs(out), ['01-cover.png', '02-slide-2.png', '03-close.png']);
  for (const f of pngs(out)) assert.deepEqual(size(path.join(out, f)), [960, 540], f);
  assert.equal(r.hud, 'none');                                  // computed display of #hud at shoot time
  assert.equal(r.counter, 'visible');                           // the counter ships on the card (verify hides it, export must not)
  assert.equal(r.spell, false);                                 // no spell Highlight registered at shoot time: the wavy underline is editor chrome
  assert.equal(r.files.length, 3);
});

live('--scale 2 doubles the pixels, the frame stays the slide', async () => {
  const out = path.join(tmp, 'png2x');
  await toPng(deck(), {out, scale: 2});
  assert.equal(pngs(out).length, 3);
  for (const f of pngs(out)) assert.deepEqual(size(path.join(out, f)), [1920, 1080], f);
});

live('a carousel deck gives square cards — the per-card PNG the README lacked', async () => {
  const out = path.join(tmp, 'carousel');
  const m = {...model(), w: 1080, h: 1080};
  await toPng(deck('carousel.html', m, {format: 'carousel'}), {out});
  assert.equal(pngs(out).length, 3);
  for (const f of pngs(out)) assert.deepEqual(size(path.join(out, f)), [1080, 1080], f);
});

live('the CLI prints a PASS line like pdf.mjs and exits 0', () => {
  const out = path.join(tmp, 'cli');
  const stdout = execFileSync(process.execPath, [cli, deck(), '--png', '--out', out], {encoding: 'utf8'});
  assert.match(stdout, /^PASS .*cli · 3 cards · 960×540$/m);
  assert.equal(pngs(out).length, 3);
});

test('a missing file exits 1 with the usage line', () => {
  const r = spawnSync(process.execPath, [cli, path.join(tmp, 'nope.html'), '--png'], {encoding: 'utf8'});
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: node bin\/export\.mjs deck\.html --png \[--out dir\] \[--scale 2\]/);
});
