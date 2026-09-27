#!/usr/bin/env node
// decklet assets — company name → clean logo file, URL → cropped screenshot, name → monogram. Each command writes its file
// and upserts a row {name, file, source, aspect, plate} into manifest.json beside it. docs/assets.md has the whole story.
// usage:
//   node bin/assets.mjs logo <name|domain>… --out dir [--name key] [--domain d] [--strict]
//   node bin/assets.mjs shot <url> --out file.webp|.png|.jpg [--crop x,y,w,h] [--width 1440] [--wait 800]
//   node bin/assets.mjs monogram <name> --out dir [--name key]
// logo tries, in order: simple-icons (jsDelivr), the company site's header logo and icon links, Google's s2 favicon, and
// last a monogram. It never fails for want of a source; the manifest row's `source` says which one landed, a monogram row
// carries fallback:true, and the run ends with a "missed:" list on stderr (exit 1 under --strict).
import fs from 'node:fs';
import path from 'node:path';
import {isMain} from '../lib/is-main.mjs';
import {slugOf, domainOf, isDomain, keyOf, svgBBox, fitViewBox, svgPlate, decodePng, pngPlate, logoCandidates,
        writeManifestRow, monogram, alphaBBox, trimBox, cropImg, encodePng, HIDE_CONSENT_CSS, hideConsentOverlays} from '../lib/assets.mjs';

const USAGE = `usage:
  decklet-assets logo <name|domain>… --out dir [--name key] [--domain d] [--strict]
  decklet-assets shot <url> --out file.webp|.png|.jpg [--crop x,y,w,h] [--width 1440] [--wait 800]
  decklet-assets monogram <name> --out dir [--name key]`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const r3 = n => Math.round(n * 1000) / 1000;

function writeRow(dir, row, bytes) {
  fs.mkdirSync(dir, {recursive: true});
  if (bytes !== undefined) fs.writeFileSync(path.join(dir, row.file), bytes);
  return writeManifestRow(dir, row);
}

const OFFLINE = process.env.DECKLET_ASSETS_OFFLINE === '1'; // tests: every network source fails, so a logo falls back
async function get(url) {
  if (OFFLINE && !url.startsWith('data:')) throw new Error('offline');
  if (url.startsWith('data:')) { const [head, body] = url.split(','); return Buffer.from(head.endsWith(';base64') ? body : decodeURIComponent(body), head.endsWith(';base64') ? 'base64' : 'utf8'); }
  const r = await fetch(url, {headers: {'user-agent': UA}, redirect: 'follow', signal: AbortSignal.timeout(15000)});
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

let browser = null;
async function page() {
  if (!browser) { const {chromium} = await import('playwright'); browser = await chromium.launch(); }
  return browser.newPage();
}
// transforms, groups and shapes: let a browser measure what the pure path parser refuses
async function browserBBox(svg) {
  try {
    const p = await page(); await p.setContent(svg);
    const b = await p.evaluate(() => { const r = document.querySelector('svg').getBBox(); return [r.x, r.y, r.width, r.height]; });
    await p.close(); return b[2] > 0 && b[3] > 0 ? b.map(r3) : null;
  } catch { return null; }
}

// render the fitted SVG on a transparent page: the decoded pixels, or null without a browser
async function render(svg, aspect) {
  try {
    const h = 256, w = Math.max(1, Math.min(2048, Math.round(h * aspect))), p = await page();
    await p.setViewportSize({width: w, height: h});
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`);
    const png = await p.screenshot({omitBackground: true, type: 'png'}); await p.close();
    return decodePng(png);
  } catch { return null; }
}
const slack = (px, w, h) => px[2] < w * 0.97 || px[3] < h * 0.97; // painted area short of the box by more than anti-aliasing

// bytes → {ext, bytes, aspect, plate} or null when the candidate is not a usable logo
async function prepare(bytes, fmt) {
  if (fmt === 'svg') {
    let svg = bytes.toString('utf8').replace(/^[\s\S]*?(?=<svg\b)/i, '').replace(/<script[\s\S]*?<\/script>/gi, '');
    if (!/^<svg\b/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return null;
    const vb = /viewBox="([^"]*)"/i.exec(svg.match(/<svg\b[^>]*>/i)[0]);
    let box = svgBBox(svg) ?? await browserBBox(svg) ?? (vb && vb[1].trim().split(/[\s,]+/).map(Number));
    if (!box || !(box[2] > 0 && box[3] > 0)) return null;
    svg = fitViewBox(svg, box);
    // the bbox counts invisible geometry (an unfilled rect, a clip box); the render counts only what paints: trim to it
    let img = await render(svg, box[2] / box[3]);
    if (img?.data) {
      const px = alphaBBox(img); if (!px) return null; // paints nothing: a blank logo
      if (slack(px, img.width, img.height)) { box = trimBox(box, px, img.width, img.height); svg = fitViewBox(svg, box); img = await render(svg, box[2] / box[3]); }
    }
    return {ext: 'svg', bytes: svg, aspect: r3(box[2] / box[3]), plate: img?.data ? pngPlate(img) : svgPlate(svg)};
  }
  let img = decodePng(bytes);
  if (!img || img.width < 32 || img.height < 16) return null; // a 16px favicon is not a logo
  if (img.data) {
    const px = alphaBBox(img); if (!px) return null;
    if (slack(px, img.width, img.height)) { img = cropImg(img, px); bytes = encodePng(img); }
  }
  return {ext: 'png', bytes, aspect: r3(img.width / img.height), plate: pngPlate(img)};
}

export async function logo(input, {out, name, domain} = {}) {
  const key = name || keyOf(input), dom = domain || domainOf(input), tried = [];
  const land = (p, source, url) => writeRow(out, {name: key, file: `${key}.${p.ext}`, source, url, aspect: p.aspect, plate: p.plate}, p.bytes);
  const attempt = async (url, fmt, source, cite = url) => {
    try { const p = await prepare(await get(url), fmt); if (p) return land(p, source, cite); tried.push(`${source} unusable: ${url.slice(0, 80)}`); }
    catch (e) { tried.push(`${source}: ${e.message.slice(0, 120)}`); }
    return null;
  };
  const slugs = [...new Set([slugOf(isDomain(input) ? dom.split('.')[0] : input), slugOf(dom.replace(/\.\w+$/, ''))])];
  for (const s of slugs) { const r = await attempt(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${s}.svg`, 'svg', 'simple-icons'); if (r) return {row: r, tried}; }
  try {
    const home = u => fetch(u, {headers: {'user-agent': UA}, redirect: 'follow', signal: AbortSignal.timeout(15000)});
    const res = await home('https://' + dom).catch(() => home('https://www.' + dom)); // some apexes only answer on www
    const html = await res.text(), site = res.url || 'https://' + dom;
    const cands = logoCandidates(html, site, [input, dom.split('.')[0]]);
    if (!cands.length) tried.push(`site: no logo candidates on ${site} (HTTP ${res.status})`);
    for (const c of cands) {
      const r = await attempt(c.url, c.fmt, c.kind, c.url.startsWith('data:') ? site + '#inline-svg' : c.url); if (r) return {row: r, tried};
    }
  } catch (e) { tried.push(`site: ${e.message.slice(0, 120)}`); }
  const s2 = await attempt(`https://www.google.com/s2/favicons?domain=${dom}&sz=256`, 'png', 's2'); if (s2) return {row: s2, tried};
  return {row: writeRow(out, {name: key, file: `${key}.svg`, source: 'monogram', aspect: 1, plate: 'any', fallback: true}, monogram(input)), tried};
}

export async function shot(url, {out, crop, width = 1440, wait = 800} = {}) {
  const c = crop ? String(crop).split(',').map(Number) : null;
  if (c && (c.length !== 4 || c.some(n => !Number.isFinite(n)) || c[2] <= 0 || c[3] <= 0)) throw new Error('--crop wants x,y,w,h');
  const p = await page();
  await p.setViewportSize({width: +width, height: Math.max(900, c ? c[1] + c[3] : 0)});
  await p.goto(url, {waitUntil: 'load', timeout: 45000});
  await p.waitForTimeout(+wait);
  await p.addStyleTag({content: HIDE_CONSENT_CSS}).catch(() => {}); // a strict CSP can refuse the tag; the script pass still runs
  await p.evaluate(hideConsentOverlays).catch(() => {});
  const ext = path.extname(out).toLowerCase().slice(1), box = c ? {x: c[0], y: c[1], width: c[2], height: c[3]} : undefined;
  let bytes = await p.screenshot({clip: box, type: ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : 'png', ...(ext === 'jpg' || ext === 'jpeg' ? {quality: 80} : {})});
  await p.close();
  if (ext === 'webp') { // the browser's own encoder, on a blank page so the target site's CSP cannot block it
    const q = await page();
    const b64 = await q.evaluate(async src => { const i = new Image(); i.src = src; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.naturalWidth; cv.height = i.naturalHeight; cv.getContext('2d').drawImage(i, 0, 0); return cv.toDataURL('image/webp', 0.82).split(',')[1]; }, 'data:image/png;base64,' + bytes.toString('base64'));
    await q.close(); bytes = Buffer.from(b64, 'base64');
  } else if (ext !== 'png' && ext !== 'jpg' && ext !== 'jpeg') throw new Error('--out must end in .webp, .png or .jpg');
  const w = c ? c[2] : +width, h = c ? c[3] : 900;
  return writeRow(path.dirname(out), {name: path.basename(out, path.extname(out)), file: path.basename(out), source: url, aspect: r3(w / h), plate: 'any', crop: c || [0, 0, w, h], width: +width}, bytes);
}

if (isMain(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2), o = {}, args = [];
  for (let n = 0; n < rest.length; n++) {
    if (rest[n] === '--strict') o.strict = true;
    else if (rest[n].startsWith('--')) o[rest[n].slice(2)] = rest[++n];
    else args.push(rest[n]);
  }
  const arg = args[0];
  if (!['logo', 'shot', 'monogram'].includes(cmd) || !arg || !o.out || (cmd === 'logo' && args.length > 1 && o.name)) { console.error(USAGE); process.exit(2); }
  try {
    if (cmd === 'monogram') {
      const key = o.name || keyOf(arg);
      console.log(JSON.stringify(writeRow(o.out, {name: key, file: `${key}.svg`, source: 'monogram', aspect: 1, plate: 'any'}, monogram(arg))));
    } else if (cmd === 'logo') {
      const missed = [];
      for (const a of args) {
        const {row, tried} = await logo(a, o);
        for (const t of tried) console.error('  skipped ' + t);
        if (row.fallback) missed.push(a);
        console.log(JSON.stringify(row));
      }
      if (missed.length) {
        console.error(`missed: ${missed.join(', ')} (monogram fallback; pass --domain or supply the file)`);
        if (o.strict) process.exitCode = 1;
      }
    } else console.log(JSON.stringify(await shot(arg, o)));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { if (browser) await browser.close(); }
}
