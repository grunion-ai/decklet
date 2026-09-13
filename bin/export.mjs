#!/usr/bin/env node
// decklet export — a built deck.html → one PNG per slide at native resolution (Playwright, Chromium).
//   node bin/export.mjs deck.html --png [--out dir] [--scale 2]
// The per-card export: a LinkedIn or Instagram carousel is posted one image per card, and a screenshot stitched by hand ships
// the HUD, a selection box or a half-played entrance animation. This is bin/verify.mjs's screenshot loop on its own — goto
// file://, clear storage (the SHIPPED model, not a stale local edit), transform:none + animation:none on the canvas, then
// `i = k; sel.clear(); render()` and shoot #canvas. The page counter is on the card, as it is in verify's own shots (verify masks
// its box for the AE diff rather than hiding it). --scale multiplies the device pixels (2 = retina), the frame stays W×H.
// Files: <out>/01-<slide name or slide-1>.png … Default out: <deck>-png/ beside the deck.
// Spellcheck marks are editor chrome (the deck's own print path drops them): the shot takes the spell button's route, off.
// Gate (exit 1): #hud computed display is none at shoot time · no spell highlight registered · files == slides · every PNG is W×H×scale (IHDR).
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const USAGE = 'usage: node bin/export.mjs deck.html --png [--out dir] [--scale 2]';
export const pngSize = buf => buf.toString('latin1', 1, 4) === 'PNG' ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null; // IHDR, no image library

export async function toPng(file, {out = null, scale = 1} = {}) {
  const {chromium} = await import('playwright');
  out = out || path.resolve(file).replace(/\.html?$/, '') + '-png'; fs.mkdirSync(out, {recursive: true});
  const b = await chromium.launch();
  try {
    const p = await b.newPage({viewport: {width: 4000, height: 4000}, deviceScaleFactor: scale});
    const errors = []; p.on('pageerror', e => errors.push(String(e)));
    await p.goto(pathToFileURL(path.resolve(file)).href); await p.waitForTimeout(300);
    await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(300);
    const {W, H, names} = await p.evaluate(() => ({W, H, names: deck.slides.map((s, n) => s.name || `slide-${n + 1}`)}));
    await p.setViewportSize({width: W + 100, height: H + 100});
    await p.addStyleTag({content: '#canvas{transform:none!important;border:0!important;border-radius:0!important;position:absolute!important;left:0;top:0} .el{animation:none!important} #hud,#tb{display:none!important}'});
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => { if (typeof setSpell === 'function') setSpell(false); }); // the spell button's own route: paintSpell() drops the Highlight
    const hud = await p.evaluate(() => getComputedStyle(document.getElementById('hud')).display);
    if (hud !== 'none') throw new Error(`gate: HUD is visible (display ${hud})`);
    const files = [];
    for (let n = 0; n < names.length; n++) {
      await p.evaluate(k => { i = k; sel.clear(); render(); }, n); await p.waitForTimeout(150);
      const f = path.join(out, `${String(n + 1).padStart(2, '0')}-${names[n].replace(/[\\/:]/g, '-')}.png`);
      await p.locator('#canvas').screenshot({path: f}); files.push(f);
    }
    const counter = await p.evaluate(() => { const c = document.querySelector('#canvas .num'); return c ? getComputedStyle(c).visibility : 'none'; });
    const spell = await p.evaluate(() => !!(window.CSS && CSS.highlights && CSS.highlights.has('spell')));
    if (spell) throw new Error('gate: spell highlight painted on the card');
    if (errors.length) throw new Error(`gate: page errors\n${errors.join('\n')}`);
    const wrote = fs.readdirSync(out).filter(f => f.endsWith('.png')).length;
    if (wrote !== names.length) throw new Error(`gate: ${wrote} PNGs in ${out} for ${names.length} slides`);
    for (const f of files) { const s = pngSize(fs.readFileSync(f)); if (!s || s[0] !== W * scale || s[1] !== H * scale) throw new Error(`gate: ${path.basename(f)} is ${s} not ${W * scale}×${H * scale}`); }
    return {out, files, W, H, scale, hud, counter, spell};
  } finally { await b.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const a = process.argv.slice(2), o = {}; let file = null;
  for (let k = 0; k < a.length; k++) if (a[k].startsWith('--')) o[a[k].slice(2)] = a[k + 1] && !a[k + 1].startsWith('--') ? a[++k] : true; else file = a[k];
  if (!file || !o.png) { console.error(USAGE); process.exit(2); }
  if (!fs.existsSync(file)) { console.error(`FAIL no such file: ${file}\n${USAGE}`); process.exit(1); }
  toPng(file, {out: o.out || null, scale: o.scale ? +o.scale : 1})
    .then(r => console.log(`PASS ${r.out} · ${r.files.length} cards · ${r.W * r.scale}×${r.H * r.scale}`))
    .catch(e => { console.error('FAIL', e.message); process.exit(1); });
}
