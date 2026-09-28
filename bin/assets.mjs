#!/usr/bin/env node
// decklet assets — company name → clean logo file, URL → cropped screenshot, name → monogram. Each command writes its file
// and upserts a row {name, file, source, aspect, plate} into manifest.json beside it. docs/assets.md has the whole story.
// usage:
//   node bin/assets.mjs logo <name|domain>… --out dir [--name key] [--domain d] [--file path] [--style style.json] [--strict]
//   node bin/assets.mjs shot <url> --out file.webp|.png|.jpg [--crop x,y,w,h] [--width 1440] [--wait 800]
//   node bin/assets.mjs monogram <name> --out dir [--name key]
// logo tries, in order: a local --file, simple-icons (jsDelivr), the company site's header logo and icon links, Google's
// s2 favicon, and last a monogram. It never fails for want of a source; the manifest row's `source` says which one landed,
// a monogram row carries fallback:true, and the run ends with a "missed:" list on stderr (exit 1 under --strict). A site
// or site-icon candidate whose fetch lands off the company domain (K25: altair.com → siemens.com) is refused, unless the
// page links it from its own header or nav, whose host then counts too (#155: a first-party CDN), and a
// candidate that renders as one near-uniform colour (K25: a currentColor mark painting a flat square) is refused as blank.
import fs from 'node:fs';
import path from 'node:path';
import {isMain} from '../lib/is-main.mjs';
import {slugOf, domainOf, isDomain, keyOf, svgBBox, fitViewBox, svgPlate, decodePng, pngPlate, logoCandidates,
        writeManifestRow, monogram, alphaBBox, trimBox, cropImg, encodePng, HIDE_CONSENT_CSS, hideConsentOverlays,
        sameOrSubdomain, nearUniformColor, paintLum, svgPaintLum, plateOn, rgbOf} from '../lib/assets.mjs';

const USAGE = `usage:
  decklet-assets logo <name|domain>… --out dir [--name key] [--domain d] [--file path] [--style style.json] [--strict]
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
// allowHost: the candidate's fetch must land, after every redirect, on one of these domains or a subdomain of one (K25)
async function get(url, {allowHost} = {}) {
  if (OFFLINE && !url.startsWith('data:')) throw new Error('offline');
  if (url.startsWith('data:')) { const [head, body] = url.split(','); return Buffer.from(head.endsWith(';base64') ? body : decodeURIComponent(body), head.endsWith(';base64') ? 'base64' : 'utf8'); }
  const r = await fetch(url, {headers: {'user-agent': UA}, redirect: 'follow', signal: AbortSignal.timeout(15000)});
  if (allowHost) {
    const finalHost = new URL(r.url || url).hostname;
    if (!allowHost.some(h => sameOrSubdomain(finalHost, h))) throw new Error(`redirect host mismatch: ${url} landed on ${finalHost}, not ${allowHost.join(' or ')} or a subdomain`);
  }
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

let browser = null;
async function page() {
  if (!browser) { const {chromium} = await import('playwright'); browser = await chromium.launch(); }
  return browser.newPage();
}
// a caller that imports logo()/shot() directly (not through the CLI's own finally) owns closing the browser it opened
export async function closeBrowser() { if (browser) { await browser.close(); browser = null; } }
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

// bytes → {ext, bytes, aspect, plate, lum} or null when the candidate is not a usable logo
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
      if (nearUniformColor(img)) return null; // paints one flat colour: a currentColor mark with no stylesheet (K25 Plasticity)
      if (slack(px, img.width, img.height)) { box = trimBox(box, px, img.width, img.height); svg = fitViewBox(svg, box); img = await render(svg, box[2] / box[3]); }
    }
    return {ext: 'svg', bytes: svg, aspect: r3(box[2] / box[3]), plate: img?.data ? pngPlate(img) : svgPlate(svg), lum: img?.data ? paintLum(img) : svgPaintLum(svg)};
  }
  let img = decodePng(bytes);
  if (!img || img.width < 32 || img.height < 16) return null; // a 16px favicon is not a logo
  if (img.data) {
    const px = alphaBBox(img); if (!px) return null;
    if (nearUniformColor(img)) return null; // a near-solid tile: a blank plate saved as a logo, not a mark
    if (slack(px, img.width, img.height)) { img = cropImg(img, px); bytes = encodePng(img); }
  }
  return {ext: 'png', bytes, aspect: r3(img.width / img.height), plate: pngPlate(img), lum: paintLum(img)};
}

// --style style.json → the slide surface a logo sits on: `card` (SKILL.md: `bg` is the editor chrome behind the slide)
function surfaceOf(style) {
  if (!style) return null;
  const t = JSON.parse(fs.readFileSync(style, 'utf8')).tokens ?? {}, c = t.card ?? t.bg;
  if (typeof c !== 'string' || !rgbOf(c)) throw new Error(`--style ${style}: tokens.card (or tokens.bg) must be a hex or rgb() colour`);
  return c;
}
// a local file's extension → the fmt prepare() knows how to normalise, or null
const fmtOfFile = f => ({'.svg': 'svg', '.png': 'png'})[path.extname(f).toLowerCase()] ?? null;

export async function logo(input, {out, name, domain, file, style} = {}) {
  const key = name || keyOf(input), dom = domain || domainOf(input), tried = [], on = surfaceOf(style);
  // with a style, the plate is the one that clears 3:1 on its slide surface, and the row records the ratio (#153)
  const plate = p => on && p.lum != null ? {...plateOn(p.lum, on), on} : {plate: p.plate};
  const land = (p, source, url) => writeRow(out, {name: key, file: `${key}.${p.ext}`, source, url, aspect: p.aspect, ...plate(p)}, p.bytes);
  const attempt = async (url, fmt, source, cite = url, opts) => {
    try { const p = await prepare(await get(url, opts), fmt); if (p) return land(p, source, cite); tried.push(`${source} unusable: ${url.slice(0, 80)}`); }
    catch (e) { tried.push(`${source}: ${e.message.slice(0, 120)}`); }
    return null;
  };
  // no source landed: a monogram, unless the manifest already holds a real logo under this key (#154: a failed retry under a
  // second domain replaced a working entry). Then that row and its file stay, and the caller reports the retry as kept.
  const fallback = () => {
    let prev; try { prev = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')).find(r => r.name === key); } catch {}
    if (prev && prev.source !== 'monogram') return {row: prev, tried, kept: true};
    return {row: writeRow(out, {name: key, file: `${key}.svg`, source: 'monogram', aspect: 1, plate: 'any', fallback: true}, monogram(input)), tried};
  };
  if (file) { // an explicit local import: normalise it the same way, or fall straight to the monogram (K25)
    const fmt = fmtOfFile(file);
    if (!fmt) tried.push(`file: unsupported extension ${path.extname(file) || '(none)'} — use .svg or .png`);
    else {
      try {
        const p = await prepare(fs.readFileSync(file), fmt);
        if (p) return {row: land(p, 'file', path.resolve(file)), tried};
        tried.push(`file unusable (blank or unparseable): ${file}`);
      } catch (e) { tried.push(`file: ${e.message.slice(0, 120)}`); }
    }
    return fallback();
  }
  const slugs = [...new Set([slugOf(isDomain(input) ? dom.split('.')[0] : input), slugOf(dom.replace(/\.\w+$/, ''))])];
  for (const s of slugs) { const r = await attempt(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${s}.svg`, 'svg', 'simple-icons'); if (r) return {row: r, tried}; }
  try {
    const home = u => fetch(u, {headers: {'user-agent': UA}, redirect: 'follow', signal: AbortSignal.timeout(15000)});
    const res = await home('https://' + dom).catch(() => home('https://www.' + dom)); // some apexes only answer on www
    const html = await res.text(), site = res.url || 'https://' + dom, siteHost = new URL(site).hostname;
    if (!sameOrSubdomain(siteHost, dom)) {
      tried.push(`site: ${dom} redirects off-domain to ${siteHost}, refused`);
    } else {
      const cands = logoCandidates(html, site, [input, dom.split('.')[0]]);
      if (!cands.length) tried.push(`site: no logo candidates on ${site} (HTTP ${res.status})`);
      for (const c of cands) {
        // a logo the page links from its own header or nav vouches for its host (#155: Xometry's mark on its Prismic CDN);
        // a redirect from there to anywhere else is still refused
        const allowHost = c.own && !c.url.startsWith('data:') ? [...new Set([dom, new URL(c.url).hostname])] : [dom];
        const r = await attempt(c.url, c.fmt, c.kind, c.url.startsWith('data:') ? site + '#inline-svg' : c.url, {allowHost}); if (r) return {row: r, tried};
      }
    }
  } catch (e) { tried.push(`site: ${e.message.slice(0, 120)}`); }
  const s2 = await attempt(`https://www.google.com/s2/favicons?domain=${dom}&sz=256`, 'png', 's2'); if (s2) return {row: s2, tried};
  return fallback();
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
  if (!['logo', 'shot', 'monogram'].includes(cmd) || !arg || !o.out || (cmd === 'logo' && args.length > 1 && (o.name || o.file))) { console.error(USAGE); process.exit(2); }
  try {
    if (cmd === 'monogram') {
      const key = o.name || keyOf(arg);
      console.log(JSON.stringify(writeRow(o.out, {name: key, file: `${key}.svg`, source: 'monogram', aspect: 1, plate: 'any'}, monogram(arg))));
    } else if (cmd === 'logo') {
      const missed = [];
      for (const a of args) {
        const {row, tried, kept} = await logo(a, o);
        for (const t of tried) console.error('  skipped ' + t);
        if (kept) console.error(`kept: ${a} (retry found no logo; the earlier ${row.source} entry ${row.file} stays)`);
        if (row.fallback) missed.push(a);
        console.log(JSON.stringify(row));
        if (kept && o.strict) process.exitCode = 1;
      }
      if (missed.length) {
        console.error(`missed: ${missed.join(', ')} (monogram fallback; pass --domain or supply the file)`);
        if (o.strict) process.exitCode = 1;
      }
    } else console.log(JSON.stringify(await shot(arg, o)));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { await closeBrowser(); }
}
