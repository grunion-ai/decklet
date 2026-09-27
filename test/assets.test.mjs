// decklet assets: company name → clean logo file + manifest row, URL → cropped screenshot, monogram fallback (FRICTION F5).
// The pure half (slug, bbox fit, plate detection, PNG decode, candidate ranking, manifest) runs offline; the network half
// (simple-icons, the company site, Google s2) is skipped when offline, the screenshot half when Playwright is absent.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {execFileSync, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {slugOf, domainOf, pathBBox, svgBBox, fitViewBox, svgPlate, decodePng, pngPlate, logoCandidates,
        upsertManifest, monogram, initials, namesOther, alphaBBox, trimBox, cropImg, encodePng, writeManifestRow,
        HIDE_CONSENT_CSS, sameOrSubdomain, nearUniformColor} from '../lib/assets.mjs';
import {logo, closeBrowser} from '../bin/assets.mjs';
import {after} from 'node:test';
after(closeBrowser); // logo() calls in this file open a browser directly, outside the CLI's own finally

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'assets.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-assets-'));
let pw = null; try { pw = await import('playwright'); } catch {}
const online = await fetch('https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/autodesk.svg', {signal: AbortSignal.timeout(5000)})
  .then(r => r.ok, () => false);
const near = (a, b, msg) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 0.01, `${msg}: ${a} ≈ ${b}`));

// a tiny PNG encoder for fixtures: RGBA rows, filter 0
const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type), l = Buffer.alloc(4), c = Buffer.alloc(4); l.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([l, t, data, c]); };
function png(w, h, px) { // px(x, y) → [r,g,b,a]
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 4 + 1) + 1 + x * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const disc = rgb => (x, y) => (x - 8) ** 2 + (y - 8) ** 2 < 25 ? [...rgb, 255] : [0, 0, 0, 0];

test('slugOf follows the simple-icons title-to-slug rule', () => {
  assert.equal(slugOf('Formlabs'), 'formlabs');
  assert.equal(slugOf('Dassault Systèmes'), 'dassaultsystemes');
  assert.equal(slugOf('Node.js'), 'nodedotjs');
  assert.equal(slugOf('C++'), 'cplusplus');
  assert.equal(slugOf('AT&T'), 'atandt');
});

test('domainOf takes a domain or URL as given and guesses .com for a bare name', () => {
  assert.equal(domainOf('xometry'), 'xometry.com');
  assert.equal(domainOf('Formlabs'), 'formlabs.com');
  assert.equal(domainOf('3ds.com'), '3ds.com');
  assert.equal(domainOf('https://www.formlabs.com/store/'), 'formlabs.com');
});

test('pathBBox measures the painted extent: lines, curve extrema, arcs, relative commands', () => {
  near(pathBBox('M2 3h10v5H2z'), [2, 3, 10, 5], 'rect');
  near(pathBBox('M0 0C0 10 10 10 10 0'), [0, 0, 10, 7.5], 'cubic bulges to 7.5, not to its control points');
  near(pathBBox('M0 0Q5 10 10 0'), [0, 0, 10, 5], 'quadratic');
  near(pathBBox('M0 5A5 5 0 0 1 10 5'), [0, 0, 10, 5], 'semicircle arc');
  near(pathBBox('m1 1 2 0 0 2-2 0z'), [1, 1, 2, 2], 'implicit relative lineto');
  near(pathBBox('M0 0c0 10 10 10 10 0s10-10 10 0'), [0, -7.5, 20, 15], 'smooth cubic reflects');
  // the real simple-icons Autodesk mark: a wordmark-ish glyph that fills only the middle band of its 24×24 box
  const autodesk = 'm.129 20.202 14.7-9.136h7.625c.235 0 .445.188.445.445 0 .21-.092.305-.21.375l-7.222 4.323c-.47.283-.633.845-.633 1.265l-.008 2.725H24V4.362a.561.561 0 0 0-.585-.562h-8.752L0 12.893V20.2h.129z';
  const [x, y, w, h] = pathBBox(autodesk);
  near([x, y, w], [0, 3.8, 24], 'autodesk');
  assert.ok(Math.abs(y + h - 20.202) < 0.01);
});

test('svgBBox unions every path and refuses shapes it cannot measure honestly', () => {
  near(svgBBox('<svg viewBox="0 0 24 24"><path d="M2 2h4v4H2z"/><path d="M10 10h2v2h-2z"/></svg>'), [2, 2, 10, 10], 'union');
  // two blocks sharing a y-range: the second fold must not re-add x0/y0 into the running x1/y1 (found building K25's blank guard)
  near(svgBBox('<svg><path d="M20 40h20v20H20z"/><path d="M60 40h20v20H60z"/></svg>'), [20, 40, 60, 20], 'two blocks, same y-range, wide x gap');
  assert.equal(svgBBox('<svg><g transform="scale(2)"><path d="M0 0h1v1H0z"/></g></svg>'), null, 'transforms need a browser');
  assert.equal(svgBBox('<svg><circle cx="5" cy="5" r="2"/></svg>'), null, 'non-path shapes need a browser');
});

test('fitViewBox re-fits a 24×24 simple-icons box to the painted bbox and drops fixed width/height', () => {
  const out = fitViewBox('<svg role="img" width="24" height="24" viewBox="0 0 24 24"><path d="M0 8h24v8H0z"/></svg>', [0, 8, 24, 8]);
  assert.match(out, /viewBox="0 8 24 8"/);
  assert.doesNotMatch(out, /width="24"/);
  assert.match(fitViewBox('<svg><path d="M0 0h1v1H0z"/></svg>', [0, 0, 10, 5], 1), /viewBox="-1 -1 12 7"/, 'pad and no viewBox yet');
});

test('svgPlate: white-on-transparent needs a dark plate, black needs a light one, brand colour sits on either', () => {
  assert.equal(svgPlate('<svg><path fill="#fff" d="M0 0h1v1z"/></svg>'), 'dark');
  assert.equal(svgPlate('<svg><path d="M0 0h1v1z"/></svg>'), 'light', 'no fill paints black');
  assert.equal(svgPlate('<svg><path fill="#E34F26" d="M0 0h1v1z"/></svg>'), 'any');
  assert.equal(svgPlate('<svg><style>.a{fill:white}</style><path class="a" d="M0 0h1v1z"/></svg>'), 'dark', 'fills in a style block');
  assert.equal(svgPlate('<svg><path style="fill:rgb(20,20,20)" d="M0 0h1v1z"/><path fill="none" stroke="#000" d="M0 0h1"/></svg>'), 'light');
  assert.equal(svgPlate('<svg><path fill="#fff" d="M0 0"/><path fill="#111" d="M0 0"/></svg>'), 'any', 'a mixed logo carries its own contrast');
});

test('decodePng reads RGBA and palette PNGs; pngPlate reads what it paints', () => {
  const white = decodePng(png(16, 16, disc([255, 255, 255])));
  assert.equal(white.width, 16); assert.equal(white.height, 16);
  assert.deepEqual([...white.data.slice((8 * 16 + 8) * 4, (8 * 16 + 8) * 4 + 4)], [255, 255, 255, 255]);
  assert.equal(pngPlate(white), 'dark', 'white disc on transparent');
  assert.equal(pngPlate(decodePng(png(16, 16, disc([10, 10, 10])))), 'light', 'black disc on transparent');
  assert.equal(pngPlate(decodePng(png(16, 16, disc([220, 60, 40])))), 'any', 'coloured disc');
  assert.equal(pngPlate(decodePng(png(16, 16, () => [255, 255, 255, 255]))), 'any', 'an opaque tile brings its own plate');
  const accented = (x, y) => y > 12 ? [0, 0, 0, 0] : x < 3 ? [128, 128, 128, 255] : [240, 240, 240, 255]; // a light wordmark with a grey cube
  assert.equal(pngPlate(decodePng(png(16, 16, accented))), 'dark', 'judged by painted area, not by the count of distinct fills');
  // palette + tRNS, filter 1 (sub) on the second row
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 3;
  const raw = Buffer.from([0, 0, 1, 1, 1, 0]); // row0: idx 0,1 ; row1 (sub): 1, 1+0=1
  const p = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', Buffer.from([0, 0, 0, 255, 255, 255])),
    chunk('tRNS', Buffer.from([0])), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  const d = decodePng(p);
  assert.deepEqual([...d.data], [0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
  assert.equal(decodePng(Buffer.from('not a png')), null);
});

test('sameOrSubdomain: the redirect-host guard (K25 Altair→Siemens)', () => {
  assert.equal(sameOrSubdomain('altair.com', 'altair.com'), true, 'same host');
  assert.equal(sameOrSubdomain('www.altair.com', 'altair.com'), true, 'www is not a foreign host');
  assert.equal(sameOrSubdomain('damassets.altair.com', 'altair.com'), true, 'a real subdomain');
  assert.equal(sameOrSubdomain('siemens.com', 'altair.com'), false, 'a different company entirely');
  assert.equal(sameOrSubdomain('notaltair.com', 'altair.com'), false, 'a suffix match on the label is not a subdomain match');
  assert.equal(sameOrSubdomain('altair.com.evil.com', 'altair.com'), false, 'altair.com as a prefix of someone else\'s domain');
});

test('nearUniformColor: a flat plate rejects, a real mark with negative space does not, even when it is itself one colour', () => {
  const w = 16, h = 16;
  const flatSquare = {width: w, height: h, data: new Uint8Array(w * h * 4)};
  for (let i = 0; i < flatSquare.data.length; i += 4) flatSquare.data.set([10, 10, 10, 255], i); // K25 Plasticity: currentColor, no stylesheet
  assert.equal(nearUniformColor(flatSquare), true, 'edge-to-edge single colour is blank');
  const disc = {width: w, height: h, data: new Uint8Array(w * h * 4)}; // a black disc on transparent: one colour, but not a plate
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x - 8) ** 2 + (y - 8) ** 2 < 25) disc.data.set([10, 10, 10, 255], (y * w + x) * 4);
  assert.equal(nearUniformColor(disc), false, 'a shaped mark leaves negative space around it');
  const twoTone = {width: w, height: h, data: new Uint8Array(w * h * 4)}; // full coverage but two colours, neither dominant
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) twoTone.data.set(x < w / 2 ? [255, 255, 255, 255] : [10, 10, 10, 255], (y * w + x) * 4);
  assert.equal(nearUniformColor(twoTone), false, 'a genuine two-colour wordmark is not near-uniform');
  assert.equal(nearUniformColor({width: 4, height: 4, data: new Uint8Array(64)}), false, 'a fully transparent image is alphaBBox\'s job, not this one\'s');
  assert.equal(nearUniformColor(null), false);
});

test('logoCandidates ranks the site header logo (SVG first), then icon links, all absolute', () => {
  const html = `<head><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="icon" type="image/svg+xml" href="/icon.svg"></head><body>
    <img width="122" height="18" src="/assets/logo.png" alt="Formlabs Logo"/>
    <img alt="Formlabs" src="/logo_white.svg" class="Picture_image"/>
    <img src="https://cdn.example/partner-logo-white.png" class="news-card-logo"/>
    <img src="/hero.jpg" alt="A printer"/></body>`;
  const c = logoCandidates(html, 'https://formlabs.com/', 'Formlabs');
  assert.deepEqual(c.slice(0, 2).map(x => x.url), ['https://formlabs.com/logo_white.svg', 'https://formlabs.com/assets/logo.png']);
  assert.ok(c.findIndex(x => x.url.endsWith('/icon.svg')) < c.findIndex(x => x.url.endsWith('apple-touch-icon.png')));
  const partner = c.findIndex(x => x.url.includes('partner-logo'));
  assert.ok(partner === -1 || partner > 1, 'a logo that does not name the company ranks below ones that do, or is dropped');
  assert.ok(!c.some(x => x.url.endsWith('.ico') || x.url.endsWith('hero.jpg')), 'ico and non-logo images are not candidates');
  assert.ok(c.every(x => x.kind), 'each candidate says where it came from');
  const data = logoCandidates('<link rel="icon" href="data:image/png;base64,AAAA">', 'https://x.com/', 'x');
  assert.equal(data[0].url, 'data:image/png;base64,AAAA');
});

// K12: a vendor homepage whose own mark is an inline SVG in the header, above a strip of customer logos (the SendCutSend case)
const VENDOR_HOME = `<html><head><link rel="apple-touch-icon" href="/apple-touch-icon.png"></head><body>
  <section class="trusted-by"><h2>Trusted by</h2>
    <img src="/wp-content/uploads/2024/03/cisco-logo.svg" alt="Cisco logo">
    <img src="/wp-content/uploads/2024/03/Dell_Logo.svg" alt="Dell">
    <img src="/wp-content/uploads/customer-logo-3.svg" alt="SpaceX logo"></section>
  <header class="site-header"><a href="/" class="brand" aria-label="Home">
    <svg viewBox="0 0 200 40"><title>SendCutSend</title><path d="M0 0h200v40H0z" fill="#e5561c"/></svg></a>
    <nav><a href="/materials">Materials</a><img src="/img/search.svg" alt="Search"></nav></header>
  <main><img src="/img/hero.jpg" alt="Laser cut parts"></main></body></html>`;

test('logoCandidates: the header logo linked to home beats a customer-logo strip, and customer logos are dropped (K12)', () => {
  const c = logoCandidates(VENDOR_HOME, 'https://sendcutsend.com/', 'SendCutSend');
  assert.match(c[0].url, /^data:image\/svg\+xml,/, 'the inline header SVG ranks first');
  assert.match(decodeURIComponent(c[0].url.split(',')[1]), /<title>SendCutSend<\/title>/);
  assert.equal(c[0].kind, 'site');
  assert.ok(!c.some(x => /cisco|dell|customer-logo/i.test(x.url)), 'a logo whose file or alt names another company is never a candidate');
  assert.ok(c.some(x => x.url.endsWith('apple-touch-icon.png')), 'icon links still follow');
});

test('logoCandidates: a header <img> in a home link beats an earlier named strip image (the Vizcom/Dell case)', () => {
  const html = `<div class="logos"><img src="/logos/dell-technologies.svg" alt="Dell Technologies"></div>
    <header><a href="https://www.vizcom.ai/"><img src="/_next/static/media/logo.8f3a9b21.svg" alt="Home"></a></header>`;
  const c = logoCandidates(html, 'https://www.vizcom.ai/', 'Vizcom');
  assert.equal(c[0].url, 'https://www.vizcom.ai/_next/static/media/logo.8f3a9b21.svg');
  assert.ok(!c.some(x => /dell/.test(x.url)));
});

test('namesOther: a file name, alt or title naming another company rejects; generic words and hashes do not', () => {
  const who = ['sendcutsend'];
  assert.equal(namesOther(['cisco-logo.svg'], who), true);
  assert.equal(namesOther(['logo', 'Dell'], who), true);
  assert.equal(namesOther(['logo_white.8f3a9b21.svg', 'Home'], who), false);
  assert.equal(namesOther(['send-cut-send-logo.svg', 'SendCutSend logo'], who), false);
  assert.equal(namesOther(['sc.svg', 'Go to homepage'], who), false, 'two letters is too short to name anyone');
  assert.equal(namesOther(['', undefined], who), false);
});

test('alphaBBox + trimBox: a logo drawn at a third of its box is re-fitted to what it paints (the Protolabs case)', () => {
  // a 90×30 render of a viewBox 0 0 1305 416 where only a band is painted
  const img = {width: 90, height: 30, data: new Uint8Array(90 * 30 * 4)};
  for (let y = 10; y < 16; y++) for (let x = 20; x < 45; x++) img.data.set([0, 0, 0, 255], (y * 90 + x) * 4);
  assert.deepEqual(alphaBBox(img), [20, 10, 25, 6]);
  const b = trimBox([0, 0, 1305, 416], alphaBBox(img), 90, 30);
  assert.ok(Math.abs(b[0] - 20 * 1305 / 90) < 1305 / 90 + 0.01 && b[2] < 1305 / 2, 'trimmed ' + b);
  assert.equal(alphaBBox({width: 4, height: 4, data: new Uint8Array(64)}), null, 'a blank image paints nothing');
});

test('cropImg + encodePng: a PNG with transparent padding is trimmed and still decodes', () => {
  const img = decodePng(png(40, 20, (x, y) => x >= 10 && x < 30 && y >= 5 && y < 15 ? [200, 30, 30, 255] : [0, 0, 0, 0]));
  const box = alphaBBox(img);
  assert.deepEqual(box, [10, 5, 20, 10]);
  const back = decodePng(encodePng(cropImg(img, box)));
  assert.equal(back.width, 20); assert.equal(back.height, 10);
  assert.deepEqual([...back.data.slice(0, 4)], [200, 30, 30, 255]);
});

test('writeManifestRow keeps every row when many processes write at once (K12)', async () => {
  const out = path.join(tmp, 'parallel'), run = promisify(execFile), names = Array.from({length: 16}, (_, i) => 'Co' + i);
  await Promise.all(names.map(n => run(process.execPath, [cli, 'monogram', n, '--out', out])));
  const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.deepEqual(m.map(r => r.name).sort(), names.map(n => slugOf(n)).sort());
  assert.ok(!fs.existsSync(path.join(out, 'manifest.json.lock')), 'the lock is released');
  writeManifestRow(out, {name: 'co0', file: 'co0.svg', source: 'monogram', aspect: 1, plate: 'any'});
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')).length, 16, 'in-process writes upsert too');
});

test('HIDE_CONSENT_CSS never hides html or body', () => {
  assert.match(HIDE_CONSENT_CSS, /onetrust/i);
  assert.match(HIDE_CONSENT_CSS, /:not\(html\):not\(body\)/);
});

test('upsertManifest keys rows by name: re-running a logo replaces its row, never duplicates it', () => {
  let m = upsertManifest([], {name: 'xometry', file: 'xometry.svg', source: 'site', aspect: 4.2, plate: 'light'});
  m = upsertManifest(m, {name: 'formlabs', file: 'formlabs.svg', source: 'simple-icons', aspect: 5, plate: 'light'});
  m = upsertManifest(m, {name: 'xometry', file: 'xometry.png', source: 's2', aspect: 1, plate: 'any'});
  assert.deepEqual(m.map(r => r.name), ['formlabs', 'xometry']);
  assert.equal(m.find(r => r.name === 'xometry').source, 's2');
});

test('monogram: initials on a colour hashed from the name, stable across runs', () => {
  assert.equal(initials('Xometry'), 'X');
  assert.equal(initials('Hexagon AB'), 'HA');
  assert.equal(initials('3D Systems'), '3S');
  const a = monogram('Xometry');
  assert.match(a, /^<svg[^>]*viewBox="0 0 64 64"/);
  assert.match(a, />X</);
  assert.equal(a, monogram('Xometry'));
  assert.notEqual(a.match(/fill="(#[0-9a-f]{6})"/)[1], monogram('Formlabs').match(/fill="(#[0-9a-f]{6})"/)[1]);
});

test('package.json registers decklet-assets', () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).bin['decklet-assets'], 'bin/assets.mjs');
});

test('cli monogram writes the file and a manifest row, offline', () => {
  const out = path.join(tmp, 'mono');
  execFileSync(process.execPath, [cli, 'monogram', 'Hexagon AB', '--out', out]);
  const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.deepEqual(m, [{name: 'hexagonab', file: 'hexagonab.svg', source: 'monogram', aspect: 1, plate: 'any'}]);
  assert.match(fs.readFileSync(path.join(out, 'hexagonab.svg'), 'utf8'), />HA</);
});

test('cli logo: an unreachable company falls back to a monogram flagged fallback:true, listed as missed; --strict exits 1 (K18)', () => {
  const out = path.join(tmp, 'missed'), env = {...process.env, DECKLET_ASSETS_OFFLINE: '1'};
  const r = execFileSync(process.execPath, [cli, 'logo', 'MISUMI', 'Hexagon', '--out', out], {stdio: 'pipe', env});
  const rows = r.toString().trim().split('\n').map(l => JSON.parse(l));
  assert.deepEqual(rows.map(x => [x.name, x.source, x.fallback]), [['misumi', 'monogram', true], ['hexagon', 'monogram', true]]);
  const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.ok(m.every(x => x.fallback === true));
  assert.throws(() => execFileSync(process.execPath, [cli, 'logo', 'MISUMI', '--out', out, '--strict'], {stdio: 'pipe', env}),
    e => e.status === 1 && /missed: MISUMI/.test(e.stderr));
  const soft = execFileSync(process.execPath, [cli, 'logo', 'MISUMI', '--out', out], {stdio: ['ignore', 'pipe', 'pipe'], env});
  assert.ok(soft, 'without --strict a miss still exits 0');
});

// ---------- K25: --file, the redirect guard, the blank-image guard ----------
const fixtures = path.join(tmp, 'fixtures');
fs.mkdirSync(fixtures, {recursive: true});
// two disjoint blocks, like a wordmark's letters: tight bbox [20,40,60,20] with real negative space inside it, so it
// stays well under the blank guard's coverage floor even though (like plenty of real marks) it is itself one flat colour
const wordmarkSvg = path.join(fixtures, 'wordmark.svg');
fs.writeFileSync(wordmarkSvg, '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path fill="#0a5" d="M20 40h20v20H20z"/><path fill="#0a5" d="M60 40h20v20H60z"/></svg>');
const blankSvg = path.join(fixtures, 'blank.svg'); // K25 Plasticity: currentColor with no stylesheet, paints one flat square
fs.writeFileSync(blankSvg, '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="currentColor"/></svg>');
const wordmarkPng = path.join(fixtures, 'wordmark.png');
fs.writeFileSync(wordmarkPng, png(40, 20, disc([200, 30, 30])));
const blankPng = path.join(fixtures, 'blank.png');
fs.writeFileSync(blankPng, png(40, 20, () => [12, 12, 12, 255])); // K25: a solid tile saved as a "logo"

test('logo --file normalises a local SVG the same way as any other source: bbox fit, plate, manifest row, source:file', async () => {
  const out = path.join(tmp, 'file-svg');
  const {row, tried} = await logo('Acme', {out, file: wordmarkSvg});
  assert.equal(row.source, 'file');
  assert.equal(row.url, path.resolve(wordmarkSvg));
  assert.equal(row.fallback, undefined);
  const fitted = fs.readFileSync(path.join(out, row.file), 'utf8'), vb = /viewBox="([^"]*)"/.exec(fitted)[1].split(' ').map(Number);
  [20, 40, 60, 20].forEach((v, i) => assert.ok(Math.abs(vb[i] - v) < 1, `re-fitted to the painted bbox: ${vb} ≈ [20,40,60,20]`));
  assert.equal(row.plate, 'any');
  assert.deepEqual(tried, []);
});

test('logo --file normalises a local PNG the same way: transparent padding trimmed, manifest row written', async () => {
  const out = path.join(tmp, 'file-png');
  const {row} = await logo('Acme', {out, file: wordmarkPng});
  assert.equal(row.source, 'file');
  assert.equal(row.file, 'acme.png');
  const img = decodePng(fs.readFileSync(path.join(out, row.file)));
  assert.ok(img.width < 40 && img.height < 20, 'cropped to the painted disc, not the full canvas');
});

test('logo --file rejects a near-uniform SVG as blank and falls back to a monogram (K25 Plasticity)', async () => {
  const out = path.join(tmp, 'file-blank-svg');
  const {row, tried} = await logo('Plasticity', {out, file: blankSvg});
  assert.equal(row.source, 'monogram'); assert.equal(row.fallback, true);
  assert.ok(tried.some(t => /file unusable/.test(t)), tried.join(' | '));
});

test('logo --file rejects a near-uniform PNG as blank and falls back to a monogram', async () => {
  const out = path.join(tmp, 'file-blank-png');
  const {row} = await logo('Solid', {out, file: blankPng});
  assert.equal(row.source, 'monogram'); assert.equal(row.fallback, true);
});

test('logo --file: an unsupported extension and a missing file both fall back to a monogram with the reason recorded', async () => {
  const out = path.join(tmp, 'file-bad');
  const bad = await logo('Acme', {out, file: path.join(fixtures, 'logo.gif')});
  assert.equal(bad.row.source, 'monogram');
  assert.ok(bad.tried.some(t => /unsupported extension/.test(t)), bad.tried.join(' | '));
  const missing = await logo('Acme', {out, file: path.join(fixtures, 'does-not-exist.svg')});
  assert.equal(missing.row.source, 'monogram');
  assert.ok(missing.tried.some(t => /^file:/.test(t)), missing.tried.join(' | '));
});

test('cli logo --file wires through the CLI arg parser', () => {
  const out = path.join(tmp, 'file-cli');
  const r = execFileSync(process.execPath, [cli, 'logo', 'Acme', '--file', wordmarkSvg, '--out', out], {stdio: 'pipe'});
  const row = JSON.parse(r.toString().trim());
  assert.equal(row.source, 'file');
  const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(m[0].source, 'file');
});

// a minimal fetch mock: home page + one absolute site candidate, offline and deterministic (no real network, no TLS)
function mockFetch(routes) {
  return async (url) => {
    url = String(url);
    for (const [prefix, make] of routes) if (url.startsWith(prefix)) return make(url);
    throw new Error('unmocked url: ' + url);
  };
}
const notFound = () => ({ok: false, status: 404, url: '', text: async () => '', arrayBuffer: async () => new ArrayBuffer(0)});
const wordmarkSvgText = fs.readFileSync(wordmarkSvg, 'utf8');

test('logo refuses a site candidate whose fetch redirects off the company domain (K25 Altair→Siemens)', async (t) => {
  const real = globalThis.fetch;
  t.after(() => { globalThis.fetch = real; });
  const home = `<header><a href="/"><img src="https://cdn.attacker.test/logo.svg" alt="Acme logo"></a></header>`;
  globalThis.fetch = mockFetch([
    ['https://cdn.jsdelivr.net/', notFound],
    ['https://acme-redirect.test', async () => ({ok: true, status: 200, url: 'https://acme-redirect.test/', text: async () => home})],
    ['https://cdn.attacker.test/logo.svg', async () => ({ok: true, status: 200, url: 'https://cdn.attacker.test/logo.svg', arrayBuffer: async () => new TextEncoder().encode(wordmarkSvgText).buffer})],
    ['https://www.google.com/s2/', notFound],
  ]);
  const out = path.join(tmp, 'redirect-candidate');
  const {row, tried} = await logo('Acme', {out, domain: 'acme-redirect.test'});
  assert.equal(row.source, 'monogram', 'the off-domain candidate is refused, and nothing else lands');
  assert.ok(tried.some(x => /redirect host mismatch/.test(x)), tried.join(' | '));
});

test('logo refuses the whole site when the home page itself redirects off-domain, but accepts a real subdomain', async (t) => {
  const real = globalThis.fetch;
  t.after(() => { globalThis.fetch = real; });
  const home = `<header><a href="/"><img src="https://static.acme-sub.test/logo.svg" alt="Acme logo"></a></header>`;
  globalThis.fetch = mockFetch([
    ['https://cdn.jsdelivr.net/', notFound],
    // the apex itself 301s off-domain (a company that sold its old domain, K25's actual Altair case)
    ['https://acme-sub.test', async () => ({ok: true, status: 200, url: 'https://not-acme-anymore.test/', text: async () => 'irrelevant'})],
    ['https://www.google.com/s2/', notFound],
  ]);
  const out = path.join(tmp, 'redirect-home');
  const {row, tried} = await logo('Acme', {out, domain: 'acme-sub.test'});
  assert.equal(row.source, 'monogram');
  assert.ok(tried.some(x => /redirects off-domain/.test(x)), tried.join(' | '));

  // now the home page answers on-domain, and its candidate lives on a real subdomain: no guard trip
  globalThis.fetch = mockFetch([
    ['https://cdn.jsdelivr.net/', notFound],
    ['https://acme-sub.test', async () => ({ok: true, status: 200, url: 'https://acme-sub.test/', text: async () => home})],
    ['https://static.acme-sub.test/logo.svg', async () => ({ok: true, status: 200, url: 'https://static.acme-sub.test/logo.svg', arrayBuffer: async () => new TextEncoder().encode(wordmarkSvgText).buffer})],
    ['https://www.google.com/s2/', notFound],
  ]);
  const out2 = path.join(tmp, 'redirect-subdomain-ok');
  const {row: row2} = await logo('Acme', {out: out2, domain: 'acme-sub.test'});
  assert.equal(row2.source, 'site');
  assert.equal(row2.url, 'https://static.acme-sub.test/logo.svg');
});

test('cli with no command prints usage and exits 2', () => {
  assert.throws(() => execFileSync(process.execPath, [cli], {stdio: 'pipe'}), e => e.status === 2 && /usage/.test(e.stderr));
});

test('cli shot crops a page region to webp and records the source URL', {skip: pw ? false : 'playwright not installed'}, () => {
  const page = path.join(tmp, 'page.html');
  fs.writeFileSync(page, '<body style="margin:0"><div style="position:absolute;left:100px;top:50px;width:300px;height:200px;background:#c33"></div></body>');
  const url = pathToFileURL(page).href, file = path.join(tmp, 'shots', 'quote.webp');
  execFileSync(process.execPath, [cli, 'shot', url, '--out', file, '--crop', '100,50,300,200', '--width', '800'], {stdio: 'pipe'});
  const b = fs.readFileSync(file);
  assert.equal(b.subarray(0, 4).toString(), 'RIFF'); assert.equal(b.subarray(8, 12).toString(), 'WEBP');
  const m = JSON.parse(fs.readFileSync(path.join(tmp, 'shots', 'manifest.json'), 'utf8'));
  assert.deepEqual(m[0], {name: 'quote', file: 'quote.webp', source: url, aspect: 1.5, plate: 'any', crop: [100, 50, 300, 200], width: 800});
  execFileSync(process.execPath, [cli, 'shot', url, '--out', path.join(tmp, 'shots', 'quote.png'), '--crop', '100,50,300,200'], {stdio: 'pipe'});
  assert.equal(decodePng(fs.readFileSync(path.join(tmp, 'shots', 'quote.png'))).width, 300);
});

test('cli shot hides a cookie banner before capture (K12)', {skip: pw ? false : 'playwright not installed'}, () => {
  const page = path.join(tmp, 'cookie.html');
  fs.writeFileSync(page, `<body style="margin:0;background:#fff"><div style="height:2000px"></div>
    <div class="cc-banner" style="position:fixed;left:0;right:0;bottom:0;height:200px;background:#0a0"><p>We use cookies to improve your experience.</p><button>Accept</button></div>
    <div style="position:fixed;left:0;top:0;width:100px;height:100px;background:#00f"><p>Menu</p></div></body>`);
  const file = path.join(tmp, 'shots2', 'c.png');
  execFileSync(process.execPath, [cli, 'shot', pathToFileURL(page).href, '--out', file, '--width', '800', '--wait', '0'], {stdio: 'pipe'});
  const img = decodePng(fs.readFileSync(file)), at = (x, y) => [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)];
  assert.deepEqual(at(400, 850), [255, 255, 255], 'the banner is gone');
  assert.deepEqual(at(50, 50), [0, 0, 255], 'a fixed element that is not a consent banner stays');
});

test('cli logo: a simple-icons mark comes back re-fitted, with a manifest row', {skip: online ? false : 'offline'}, () => {
  const out = path.join(tmp, 'logos');
  execFileSync(process.execPath, [cli, 'logo', 'Autodesk', '--out', out], {stdio: 'pipe', timeout: 60000});
  const svg = fs.readFileSync(path.join(out, 'autodesk.svg'), 'utf8');
  assert.doesNotMatch(svg, /viewBox="0 0 24 24"/, 're-fitted');
  const row = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')).find(r => r.name === 'autodesk');
  assert.equal(row.source, 'simple-icons'); assert.equal(row.plate, 'light'); assert.ok(row.aspect > 1.3, 'aspect ' + row.aspect);
});

test('cli logo: a company outside simple-icons still lands a usable file', {skip: online ? false : 'offline'}, () => {
  const out = path.join(tmp, 'logos2');
  execFileSync(process.execPath, [cli, 'logo', 'xometry.com', '--out', out], {stdio: 'pipe', timeout: 90000});
  const row = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'))[0];
  assert.equal(row.name, 'xometry');
  assert.ok(fs.statSync(path.join(out, row.file)).size > 100);
  assert.ok(['site', 'site-icon', 's2', 'simple-icons'].includes(row.source), row.source); assert.match(row.url, /^(https:|data:)/);
  assert.ok(['dark', 'light', 'any'].includes(row.plate));
});
