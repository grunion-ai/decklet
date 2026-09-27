// logo row (FRICTION F2): a fixed slot so names align down a list whatever the logo's aspect, contain-fit, a contrast plate,
// the name centred on its first line at slot + gap, and a monogram chip when there is no logo.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {logoGeom, plateOf, monogramOf, PLATE_BG} from '../lib/logo.mjs';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {verify} from '../bin/verify.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-logo-'));

const svg = (w, h, fill = '#1F6FEB') => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`);
const SQUARE = svg(10, 10), WIDE = svg(45, 10), WHITE = svg(30, 10, '#FFFFFF');
const roles = {Title: {font: 'system-ui', size: 40, weight: 700, color: '#111', lh: 48}, H1: {font: 'system-ui', size: 28, weight: 700, color: '#111', lh: 34},
  Body: {font: 'system-ui', size: 16, weight: 400, color: '#111', lh: 22}, Caption: {font: 'system-ui', size: 12, weight: 400, color: '#555', lh: 16}};
const deck = (els, extra = {}) => ({w: 960, h: 540, styles: {roles}, slides: [{els}], ...extra});

test('geometry: square and wide logos in the same slot put the name at the same x, centred on the slot', () => {
  const sq = logoGeom({logo: SQUARE, aspect: 1, h: 32, col: 120}, 22), wd = logoGeom({logo: WIDE, aspect: 4.5, h: 32, col: 120}, 22);
  assert.equal(sq.name.x, 128); assert.equal(wd.name.x, 128);
  assert.equal(sq.name.y + 22 / 2, 16, 'first line centre = slot centre');
  assert.equal(sq.name.y, wd.name.y);
  // contain: the square keeps 1:1, the wide one is width-limited by the slot and keeps 4.5:1
  assert.equal(sq.img.w, sq.img.h);
  assert.ok(Math.abs(wd.img.w / wd.img.h - 4.5) < 1e-9 && wd.img.w <= 120 - 2 * wd.img.x);
  // a name taller than the box still centres its first line (negative top), never top-aligns
  const tall = logoGeom({logo: SQUARE, h: 16, col: 40}, 34);
  assert.equal(tall.name.y, -9); assert.equal(tall.top, -9); assert.equal(tall.bottom, 25);
});

test('geometry: plate modes — auto and light paint white, dark paints dark, none and the manifest\'s any paint nothing', () => {
  assert.equal(plateOf(undefined), 'light'); assert.equal(plateOf('auto'), 'light'); assert.equal(plateOf('light'), 'light');
  assert.equal(plateOf('dark'), 'dark'); assert.equal(plateOf('none'), 'none'); assert.equal(plateOf('any'), 'none');
  const g = p => logoGeom({logo: WIDE, aspect: 4.5, h: 30, col: 100, plate: p});
  assert.equal(g('auto').plate.bg, PLATE_BG.light); assert.equal(g('dark').plate.bg, PLATE_BG.dark);
  assert.equal(g('none').plate, null); assert.equal(g('none').img.x, 0, 'no plate, no padding');
  assert.ok(g('auto').plate.w <= 100, 'the plate hugs the image inside the slot');
});

test('geometry: a missing logo draws a monogram chip from the name, or the monogram given', () => {
  const m = logoGeom({logo: '', name: 'Hexagon AB', h: 28, col: 90});
  assert.equal(m.img, null); assert.deepEqual([m.mono.w, m.mono.h, m.mono.text], [28, 28, 'HA']);
  assert.equal(monogramOf({name: 'Xometry'}), 'X'); assert.equal(monogramOf({monogram: 'XM', name: 'Xometry'}), 'XM');
  assert.equal(m.name.x, 98, 'the name sits at slot + gap, same as a real logo');
});

test('validate: a logo row is a first-class row — checked fields, a box for the gap gate, a visual for coverage', () => {
  const ok = validate(deck([{logo: SQUARE, aspect: 1, name: 'Xometry', x: 60, y: 60, h: 32, col: 120, role: 'Body'}]));
  assert.deepEqual(ok.errors, []);
  const bad = validate(deck([{logo: 'https://x.com/a.png', plate: 'grey', aspect: -1, col: 0, name: 'X', x: 60, y: 60}]));
  for (const m of [/logo must be a data: URI/, /plate "grey"/, /aspect/, /col/, /h must be/]) assert.ok(bad.errors.some(e => m.test(e)), m + ' in ' + bad.errors.join(' | '));
  assert.ok(validate(deck([{logo: '', x: 60, y: 60, h: 30}])).errors.some(e => /monogram/.test(e)), 'no logo, no name, no monogram');
  assert.ok(validate(deck([{logo: SQUARE, name: 'X', x: 60, y: 60, h: 30, role: 'Nope'}])).errors.some(e => /role "Nope"/.test(e)));
  // coverage (K9): a logo group is a visual; one logo row beside three text rows is decoration
  const t = y => ({x: 400, y, w: 400, role: 'Body', text: 'A line of body text ' + y});
  const wall = [60, 120, 180, 240, 300, 360].map(y => ({logo: '', name: 'Hubb ' + y, x: 60, y, h: 40}));
  assert.ok(!validate(deck([t(100), t(200), t(300), ...wall])).warnings.some(w => /text only/.test(w)));
  assert.ok(validate(deck([t(100), t(200), t(300), wall[0]])).warnings.some(w => /text only/.test(w)));
  // entities: a logo row beside a listing clears the no-logo warning
  const listed = validate(deck([{x: 200, y: 64, w: 200, role: 'Body', text: 'Xometry'}, {logo: SQUARE, x: 60, y: 60, h: 28, col: 40}], {entities: ['Xometry']}));
  assert.ok(!listed.warnings.some(w => /no logo/.test(w)), listed.warnings.join(' | '));
  // gap gate: the row's box runs from x to the end of the (estimated) name; two stacked rows 2px apart collide, 12px apart are clear
  const two = gap => validate(deck([{logo: SQUARE, name: 'Xometry', x: 60, y: 60, h: 32, col: 60, role: 'Body'}, {logo: WIDE, name: 'Protolabs', x: 60, y: 60 + 32 + gap, h: 32, col: 60, role: 'Body'}]));
  assert.ok([...two(2).errors, ...two(2).warnings].some(e => /els\[0\].*els\[1\]/.test(e)), 'stacked 2px apart');
  assert.deepEqual([...two(12).errors, ...two(12).warnings].filter(e => /els\[0\].*els\[1\]/.test(e)), []);
  // a text row placed over the name collides with the logo row
  const over = validate(deck([{logo: SQUARE, name: 'Xometry', x: 60, y: 60, h: 32, col: 60, role: 'Body'}, {x: 140, y: 64, w: 120, role: 'Body', text: 'overlapping'}]));
  assert.ok([...over.errors, ...over.warnings].some(e => /els\[0\].*els\[1\]/.test(e)), [...over.errors, ...over.warnings].join(' | '));
});

// the sample slide: square, wide, dark-plated white, no plate, monogram and a name taller than its row — names in one column
const LIST = [
  {logo: SQUARE, aspect: 1, name: 'Squareco', plate: 'auto'},
  {logo: WIDE, aspect: 4.5, name: 'Widemark Industries', plate: 'light'},
  {logo: WHITE, name: 'Whitemark', plate: 'dark'},
  {logo: WIDE, aspect: 4.5, name: 'Bareco', plate: 'none'},
  {logo: '', name: 'Hubb Global', monogram: 'HG'},
  {logo: SQUARE, aspect: 1, name: 'Taller name', h: 16, role: 'H1'},   // the name's line (34px) is taller than the row (16px)
].map((r, k) => ({x: 80, y: 110 + k * 64, h: 32, col: 120, role: 'Body', alt: r.name + ' logo', ...r}));
const SAMPLE = deck([{x: 80, y: 48, w: 800, role: 'H1', text: 'Five logos, one name column'}, ...LIST]);

live('runtime: names align down the list, first line centred on the slot, image contained, plates painted', async () => {
  assert.deepEqual(validate(structuredClone(SAMPLE)).errors, []);
  const f = path.join(tmp, 'sample.html'); fs.writeFileSync(f, create(SAMPLE).html);
  const b = await pw.chromium.launch();
  try {
    const p = await b.newPage(); await p.goto('file://' + f);
    await p.waitForFunction(() => [...document.querySelectorAll('#canvas img')].every(i => i.complete));
    const rows = await p.evaluate(() => [...document.querySelectorAll('#canvas .el[data-logo]')].map(d => {
      const cv = document.getElementById('canvas'), b = cv.getBoundingClientRect(), k = b.width / cv.offsetWidth, c = {left: b.left + cv.clientLeft * k, top: b.top + cv.clientTop * k};   // inside the canvas border, in model px
      const R = e => { const r = e.getBoundingClientRect(); return {x: (r.left - c.left) / k, y: (r.top - c.top) / k, w: r.width / k, h: r.height / k}; };
      const nm = d.querySelector('.lname'), g = document.createRange(); g.selectNodeContents(nm); const first = g.getClientRects()[0];
      const im = d.querySelector('img'), pl = d.querySelector('.lplate'), mo = d.querySelector('.lmono');
      return {row: R(d), name: R(nm), first: {y: (first.top - c.top) / k, h: first.height / k}, lh: parseFloat(getComputedStyle(nm).lineHeight),
        img: im && {...R(im), nw: im.naturalWidth, nh: im.naturalHeight, fit: im.style.objectFit}, plate: pl && getComputedStyle(pl).backgroundColor, mono: mo && mo.textContent};
    }));
    assert.equal(rows.length, 6);
    const xs = rows.map(r => Math.round(r.name.x));
    assert.deepEqual(xs, Array(6).fill(80 + 120 + 8), `every name starts at x + col + gap (rows at ${rows.map(r => r.row.x)})`);
    for (const [k, r] of rows.entries()) {
      const line = r.name.y + r.lh / 2, glyphs = r.first.y + r.first.h / 2, slotMid = LIST[k].y + LIST[k].h / 2;
      assert.ok(Math.abs(line - slotMid) <= 0.5, `row ${k}: first line box centre ${line} vs column centre ${slotMid}`);
      assert.ok(Math.abs(glyphs - slotMid) <= 1, `row ${k}: first line glyphs centre ${glyphs} vs column centre ${slotMid}`);
    }
    for (const k of [0, 1, 3]) {   // the runtime draws exactly lib/logo.mjs's boxes
      const g = logoGeom(LIST[k], 22), im = rows[k].img;
      assert.deepEqual([im.x - rows[k].row.x, im.y - rows[k].row.y, im.w, im.h].map(v => Math.round(v * 10) / 10), [g.img.x, g.img.y, g.img.w, g.img.h].map(v => Math.round(v * 10) / 10), `row ${k} img box`);
    }
    assert.ok(Math.abs(rows[0].img.w / rows[0].img.h - 1) < 0.02, 'square stays square');
    assert.ok(Math.abs(rows[1].img.w / rows[1].img.h - 4.5) < 0.05, 'wide stays 4.5:1');
    assert.equal(rows[2].img.fit, 'contain', 'no aspect: object-fit contains it');
    assert.equal(rows[0].plate, 'rgb(255, 255, 255)'); assert.equal(rows[1].plate, 'rgb(255, 255, 255)');
    assert.equal(rows[2].plate, 'rgb(21, 23, 27)'); assert.equal(rows[3].plate, null);
    assert.equal(rows[4].img, null); assert.equal(rows[4].mono, 'HG');
  } finally { await b.close(); }
});

live('verify: the sample logo slide passes layout parity', async () => {
  const f = path.join(tmp, 'verify.html'); fs.writeFileSync(f, create(SAMPLE).html);
  const r = await verify(f, {out: path.join(tmp, 'v'), log: () => {}});
  assert.deepEqual(r.errors, [], JSON.stringify(r.parity));
});
