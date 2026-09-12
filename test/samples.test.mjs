// The sample media the library sheet binds (templates/samples/*, build products of samples/make.mjs): a size budget, so
// the sheet stays a file someone opens from mail, and the binding itself — the image templates and layouts carry a real
// photo, a screenshot and a playing GIF instead of one gradient placeholder. ROADMAP L5.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'templates/samples');
const KB = 1024;
const SAMPLE_EACH = 100 * KB, SAMPLE_SUM = 160 * KB, LIBRARY = 640 * KB;   // the budget: ~100 KB an image (SKILL.md), the sheet well under 1 MB

test('samples: two photos, one screenshot, one GIF, each under 100 KB, together under 160 KB', () => {
  const files = fs.readdirSync(dir).filter(f => /\.(jpg|png|gif)$/.test(f)).sort();
  assert.deepEqual(files, ['clip.gif', 'photo-1.jpg', 'photo-2.jpg', 'ui-shot.png']);
  let sum = 0;
  for (const f of files) { const n = fs.statSync(path.join(dir, f)).size; sum += n; assert.ok(n < SAMPLE_EACH, `${f} is ${Math.round(n / KB)} KB`); }
  assert.ok(sum < SAMPLE_SUM, `samples total ${Math.round(sum / KB)} KB`);
  assert.ok(fs.readFileSync(path.join(dir, 'clip.gif')).subarray(0, 6).toString() === 'GIF89a', 'the clip is a GIF89a (animated)');
  assert.ok(fs.existsSync(path.join(dir, 'make.mjs')), 'the generator ships beside its products');
});

test('samples: the sheet binds them — hero + image-right a photo, annotated-shot the GIF, image-left the screenshot, image-split a photo', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'templates/build-sheet.mjs')], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  const model = JSON.parse(fs.readFileSync(path.join(root, 'templates/candidates.model.json'), 'utf8'));
  const img = name => { const s = model.slides.find(s => s.name === name); const rows = s.els.filter(e => e.img); assert.equal(rows.length, 1, `${name}: one media row`); return rows[0]; };
  assert.match(img('image-hero-overlay').img, /^data:image\/jpeg;base64,/);
  assert.match(img('image-split').img, /^data:image\/jpeg;base64,/);
  assert.match(img('annotated-shot').img, /^data:image\/gif;base64,/, 'the GIF plays on the annotated screenshot');
  assert.match(img('layout-image-left').img, /^data:image\/png;base64,/, 'the product screenshot');
  assert.match(img('layout-image-right').img, /^data:image\/jpeg;base64,/);
  for (const n of ['image-hero-overlay', 'image-split', 'annotated-shot', 'layout-image-left', 'layout-image-right']) {
    const e = img(n);
    assert.equal(e.fit, 'cover', `${n}: fit`); assert.ok(e.alt, `${n}: alt`); assert.equal(e.bg, undefined, `${n}: the placeholder paint is gone`);
    if (!e.slot) assert.ok(e.w > 0 && e.h > 0, `${n}: explicit w/h (parity measures rects)`);
  }
});

test('samples: library.html stays under budget and every data: URI in it is base64 (the residue gate strips those)', () => {
  const html = fs.readFileSync(path.join(root, 'library.html'), 'utf8');
  assert.ok(html.length < LIBRARY, `library.html is ${Math.round(html.length / KB)} KB`);
  // the engine's own inline icons are short utf-8 svg URIs; anything payload-sized (a photo, a clip) must be base64
  const uris = [...html.matchAll(/data:image\/[a-z+]+;([^,"'\\]*),([^"'\\]*)/g)];
  assert.ok(uris.filter(m => m[1] === 'base64').length >= 5, `${uris.length} data: URIs, fewer than five base64`);
  for (const m of uris) if (m[2].length > 2 * KB) assert.equal(m[1], 'base64', `${m[0].slice(0, 40)}… — a ${Math.round(m[2].length / KB)} KB payload the residue gate would read as prose`);
});
