#!/usr/bin/env node
// decklet pdf — a built deck.html → one VECTOR PDF, one page per slide at the slide's own size (Playwright, Chromium).
//   node bin/pdf.mjs deck.html [out.pdf]
// Why not screenshots: a rasterised page blurs on every rescale (a LinkedIn document post, a viewer's zoom), carries no text
// and no links, and once shipped the editor's HUD inside the frame. This drives the deck's OWN print pipeline — `beforeprint`
// builds #print (one .pg per slide, its own bg, HUD/wrap/toolbar hidden by the deck's @media print) — through Chromium's print
// engine with a pixel @page, which Chromium honours (Safari does not; that is why the paper path stays Letter). Text stays
// text, every href is a /Link annotation, fonts embed. 1 model px = 0.75 pt.
// Gate (exit 1): pages == slides · MediaBox ratio == W/H · #hud computed display is none under print media · links == href rows.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// what the bytes say: Chromium's Skia backend writes page dictionaries in the clear, so no PDF parser is needed
export function inspect(buf) {
  const s = buf.toString('latin1');
  const pages = (s.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
  const m = s.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  const box = m ? [+m[3] - +m[1], +m[4] - +m[2]] : null;
  const links = (s.match(/\/Subtype\s*\/Link\b/g) || []).length;
  return {pages, box, links};
}

export async function toPdf(file, out = file.replace(/\.html?$/, '') + '.pdf') {
  const {chromium} = await import('playwright');
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    const errors = []; p.on('pageerror', e => errors.push(String(e)));
    await p.goto(pathToFileURL(path.resolve(file)).href);
    await p.evaluate(() => document.fonts.ready);
    const {W, H, slides, hrefs} = await p.evaluate(() => ({W, H, slides: deck.slides.length,
      hrefs: deck.slides.reduce((n, s) => n + s.els.filter(e => e.href && !e.hide).length, 0) + deck.slides.reduce((n, s) => n + s.els.filter(e => e.html).reduce((k, e) => k + (e.html.match(/<a\s[^>]*href=/g) || []).length, 0), 0)}));
    await p.addStyleTag({content: `@page{size:${W}px ${H}px;margin:0}#print .pg{zoom:1!important}`});
    await p.emulateMedia({media: 'print'});
    await p.evaluate(() => dispatchEvent(new Event('beforeprint')));
    const hud = await p.evaluate(() => getComputedStyle(document.getElementById('hud')).display);
    const built = await p.evaluate(() => document.querySelectorAll('#print .pg').length);
    if (hud !== 'none') throw new Error(`gate: HUD is visible under print media (display ${hud})`);
    if (built !== slides) throw new Error(`gate: print built ${built} pages for ${slides} slides`);
    if (errors.length) throw new Error(`gate: page errors\n${errors.join('\n')}`);
    await p.pdf({path: out, width: `${W}px`, height: `${H}px`, printBackground: true, preferCSSPageSize: true});
    const r = {...inspect(fs.readFileSync(out)), hud, out, W, H};
    if (r.pages !== slides) throw new Error(`gate: PDF has ${r.pages} pages for ${slides} slides`);
    if (!r.box || Math.abs(r.box[0] / r.box[1] - W / H) > 0.005) throw new Error(`gate: page box ${r.box} is not ${W}×${H}`);
    if (r.links < hrefs) throw new Error(`gate: ${r.links} link annotations for ${hrefs} linked rows`);
    return r;
  } finally { await b.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [file, out] = process.argv.slice(2);
  if (!file) { console.error('usage: node bin/pdf.mjs deck.html [out.pdf]'); process.exit(2); }
  toPdf(file, out).then(r => console.log(`PASS ${r.out} · ${r.pages} pages · ${r.box[0]}×${r.box[1]} pt · ${r.links} links · ${fs.statSync(r.out).size} bytes`))
    .catch(e => { console.error('FAIL', e.message); process.exit(1); });
}
