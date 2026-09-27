// K23 + K26 (part): a wordmark in a template media slot. A logo about 3:1 or wider reads like a line of type, so it may drop to
// WORDMARK_MIN (14px at the 960 cut) where a logomark stops at MEDIA_MIN, and in a box too narrow to hold it beside its text
// it stacks ABOVE the text across the box's full width; the box grows to hold it. A refusal names the logo, its aspect and
// the width it needs, and a refused slide still names its template's layout, so the author's own slot rows are not reported
// as strays. Fixture: the Protolabs wordmark from the cad-dfm-landscape v4 build (aspect 4.44, light plate), drawn here as a
// stand-in of the same viewBox so no third-party mark ships in the repo.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {expandTemplates, fillErrors, templateMedia, templateVals, WORDMARK, WORDMARK_MIN} from '../lib/templates.mjs';
import {logoGeom} from '../lib/logo.mjs';
import {withBrowser} from './helpers/browser.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-wordmark-'));

const mark = (w, h) => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#343842"/></svg>`).toString('base64');
const PROTOLABS = {logo: mark(360.942, 81.299), aspect: 4.44, plate: 'light', alt: 'Protolabs'};
const FIVE = {logo: mark(50, 10), aspect: 5, plate: 'light', alt: 'Fivemark'};
const v = m => validate(create(m).deck);
const deck = (slides, extra = {}) => ({w: 960, h: 540, title: 'wordmarks', ...extra, slides});
const fillOf = (id, m) => ({...Object.fromEntries(templateVals(id).map(e => [e.key, e.sample])), ...Object.fromEntries(templateMedia(id).map(e => [e.key, m]))});
const rows = (id, fill, extra) => { const d = deck([{template: id, fill}], extra); expandTemplates(d); return d.slides[0].els; };
const painted = r => logoGeom(r).img;   // the mark's own box inside the row: what a reader sees

test('wordmark: the constants — 3:1 and wider is a wordmark, and its floor is 14px', () => {
  assert.equal(WORDMARK, 3); assert.equal(WORDMARK_MIN, 14);
});

test('wordmark: a 5:1 mark in a list template draws beside its item at full size, wider than v4\'s hand-built 70px', () => {
  for (const id of ['agenda-ruled', 'three-up-cards', 'vertical-steps']) {
    assert.deepEqual(fillErrors(id, fillOf(id, FIVE)), [], id);
    const logos = rows(id, fillOf(id, FIVE)).filter(r => r.logo != null);
    assert.equal(logos.length, templateMedia(id).length, id);
    for (const r of logos) {
      const im = painted(r);
      assert.ok(im.h >= WORDMARK_MIN && im.w >= 90, `${id}: the mark paints ${im.w.toFixed(0)}×${im.h.toFixed(0)}`);
      assert.ok(Math.abs(im.w / im.h - 5) < 1e-6, id + ': keeps 5:1');
      assert.equal(r.name != null && r.name.length > 0, true, id + ': the item text rides beside it');
    }
    const r = v(deck([{template: id, fill: fillOf(id, FIVE)}]));
    assert.deepEqual(r.errors, [], `${id}: ${r.errors.join(' | ')}`);
  }
});

test('wordmark: a 5:1 mark in a 138px process box stacks above its step across the box, and the box grows to hold it', () => {
  for (const id of ['process-flow-5', 'process-flow-4']) {
    assert.deepEqual(fillErrors(id, fillOf(id, FIVE)), [], id);
    const plain = rows(id, {}), els = rows(id, fillOf(id, FIVE));
    const boxes = els.filter(r => /^st\d$/.test(r.id)), logos = els.filter(r => r.logo != null);
    assert.equal(logos.length, boxes.length, id + ': one mark per box');
    for (const [i, lg] of logos.entries()) {
      const box = boxes[i], was = plain.find(r => r.id === box.id), im = painted(lg);
      assert.ok(im.h >= WORDMARK_MIN, `${id} ${box.id}: mark ${im.h}px tall`);
      assert.ok(lg.x >= box.x && lg.x + lg.col <= box.x + box.w - 16 + 0.5, `${id} ${box.id}: the mark stays inside the box's text column`);
      assert.ok(!lg.name, id + ': a stacked mark carries no name — the step text sits under it');
      const step = els[els.indexOf(lg) + 1];
      assert.ok(step.text && step.y >= lg.y + lg.h, `${id} ${box.id}: the step text starts under the mark`);
      assert.ok(box.h > was.h, `${id} ${box.id}: the box grew (${was.h} → ${box.h})`);
      const inside = els.filter(r => r.text != null && r.x >= box.x && r.x < box.x + box.w && r.y >= box.y && r.y < box.y + box.h);
      for (const t of inside) assert.ok(t.y + 18 <= box.y + box.h, `${id} ${box.id}: "${t.text}" ends inside the box`);
    }
    const r = v(deck([{template: id, fill: fillOf(id, FIVE)}]));
    assert.deepEqual(r.errors, [], `${id}: ${r.errors.join(' | ')}`);
  }
});

test('wordmark: the rule under a row of grown boxes moves once, not once per box', () => {
  const plain = rows('process-flow-5', {}), els = rows('process-flow-5', fillOf('process-flow-5', FIVE));
  const rule0 = plain.find(r => Array.isArray(r.line) && r.y > 340), rule1 = els.find(r => Array.isArray(r.line) && r.y > 340);
  const grew = els.find(r => r.id === 'st0').h - plain.find(r => r.id === 'st0').h;
  assert.equal(rule1.y - rule0.y, grew, 'side-by-side growth takes the largest, it does not add up');
});

test('wordmark: the Protolabs fixture fits a centred timeline label at 14px or more, where v0.13 refused it', () => {
  const id = 'timeline-horizontal', f = fillOf(id, PROTOLABS);
  assert.deepEqual(fillErrors(id, f), [], id);
  for (const r of rows(id, f).filter(r => r.logo != null)) {
    assert.ok(r.h >= WORDMARK_MIN, `row ${r.h}px`);
    assert.ok(Math.abs(painted(r).w / painted(r).h - 4.44) < 1e-6);
  }
  const r = v(deck([{template: id, fill: f}]));
  assert.deepEqual(r.errors, [], r.errors.join(' | '));
});

test('wordmark: a logomark under 3:1 keeps the 20px floor; only a wordmark goes to 14', () => {
  const sq = {logo: mark(30, 20), aspect: 1.5, plate: 'light', alt: 'Squat'};
  for (const r of rows('agenda-ruled', fillOf('agenda-ruled', {...sq, h: 12})).filter(r => r.logo != null)) assert.ok(r.h >= 20, `${r.h}`);
});

test('wordmark: a refusal names the logo, its aspect and the width it needs — and the slide keeps its layout, so no slot row cascades', () => {
  const wide = {logo: mark(90, 10), aspect: 9, plate: 'light', alt: 'Ninemark'};
  const why = fillErrors('timeline-horizontal', fillOf('timeline-horizontal', wide)).join(' ');
  assert.match(why, /Ninemark/, why); assert.match(why, /9:1/, why); assert.match(why, /needs \d+px/, why);
  const noAlt = fillErrors('timeline-horizontal', fillOf('timeline-horizontal', {logo: '#nine', aspect: 9})).join(' ');
  assert.match(noAlt, /#nine/, 'with no alt the asset id names it: ' + noAlt);
  // the v4 cascade: a refused template slide with the author's own subtitle row reported "slot subtitle not in any layout"
  const r = v(deck([{template: 'timeline-horizontal', fill: fillOf('timeline-horizontal', wide), els: [{slot: 'subtitle', text: 'Buyers and sellers'}]}]));
  assert.ok(r.errors.some(e => /Ninemark/.test(e)), r.errors.join(' | '));
  assert.deepEqual(r.errors.filter(e => /not in any layout|slot "?subtitle/.test(e)), [], r.errors.join(' | '));
});

live('wordmark: the runtime paints the stacked 5:1 mark inside its grown process box, in both engines', {timeout: 60000}, async () => {
  const f = path.join(tmp, 'flow.html'); fs.writeFileSync(f, create(deck([{template: 'process-flow-5', fill: fillOf('process-flow-5', FIVE)}])).html);
  for (const engine of ['chromium', 'webkit']) await withBrowser(pw[engine], async b => {
    const p = await b.newPage(); await p.goto('file://' + f);
    await p.waitForFunction(() => [...document.querySelectorAll('#canvas img')].every(i => i.complete));
    const got = await p.evaluate(() => {
      const cv = document.getElementById('canvas'), c = cv.getBoundingClientRect(), k = c.width / cv.offsetWidth;
      const R = e => { const r = e.getBoundingClientRect(); return {x: (r.left - c.left) / k, y: (r.top - c.top) / k, w: r.width / k, h: r.height / k}; };
      return [...document.querySelectorAll('#canvas .el[data-logo] img')].map(R);
    });
    assert.equal(got.length, 5, engine);
    for (const im of got) assert.ok(im.h >= 14 && im.w >= 70, `${engine}: painted ${im.w.toFixed(0)}×${im.h.toFixed(0)}`);
  }, {timeout: 25000});
});
