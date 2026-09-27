// K17 — the slide foot is ONE line. A reading slide used to stack three text strata in its lower third: a muted note, a
// source line under it, then the footer with the page counter. Now the `source` slot joins the footer's baseline on the left,
// the legend sits on the same line just left of the deck name, the counter keeps its corner, and a note is a caption beside
// the visual it explains (or the layout drops it). validate warns on any other text row that starts in the foot band: below
// the content area's bottom edge (FOOT.y) and above the footer.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {validate} from '../bin/validate.mjs';
import {LIBRARY, DENSE, FOOT, NEUTRAL_LH} from '../lib/layouts.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-foot-'));

const RIGHT = {id: 'foot', footer: 1, right: 60, y: 506, w: 'auto', role: 'Label', nowrap: 1, text: 'Landscape · Sep 2026'};
const LEFT = {id: 'foot', footer: 1, x: 60, y: 506, w: 340, role: 'Label', text: 'Landscape · Sep 2026'};
const chart = (extra = []) => ({layout: 'chart', els: [{slot: 'supertitle', text: 'Market'}, {slot: 'title', text: 'Tickets climb through the week'},
  {slot: 'subtitle', text: 'Desk count, Monday to Thursday.'}, {slot: 'chart', bg: 'var(--box)'}, {slot: 'takeaway', text: 'Thursday carries half again what Monday does.'},
  {slot: 'source', text: 'Source · desk log, one week'}, {slot: 'legend', text: '● tickets'}, ...extra]});
const deck = (foot, slides) => ({w: 960, h: 540, title: 'foot', styles: {margin: 60}, density: 'reading', master: [foot], slides});

test('K17: source and legend are foot-line slots; the note has no generic seat in the lower third', () => {
  assert.equal(DENSE.source.foot, 'left', 'the source joins the footer line on the left');
  assert.equal(DENSE.legend.foot, 'right', 'the legend joins the same line, left of the deck name');
  assert.equal(DENSE.note, null, 'no generic note position: a layout names a caption seat beside its visual, or drops the note');
  assert.equal(typeof FOOT.y, 'number');
  for (const [name, lay] of Object.entries(LIBRARY)) {
    const n = lay.slots.note; if (!n) continue;
    assert.ok(n.y + 2 * NEUTRAL_LH.Body <= FOOT.y, `${name}.note: two lines end by ${FOOT.y}, inside the content area (ends ${n.y + 2 * NEUTRAL_LH.Body})`);
  }
  for (const n of ['content', 'two-cols', 'two-cols-header', 'comparison', 'kpi-grid', 'kpi-grid-4', 'stat']) assert.equal(LIBRARY[n].slots.note, undefined, `${n}: no visual to caption, the note is dropped`);
});

test('K17: validate warns on a text row between the content area and the footer; the seated source does not', () => {
  const clean = validate(create(deck(RIGHT, [chart()])).deck);
  assert.deepEqual(clean.errors, []);
  assert.deepEqual(clean.warnings.filter(w => /foot band/.test(w)), [], clean.warnings.join(' | '));
  const stray = validate(create(deck(RIGHT, [chart([{x: 60, y: 480, w: 400, role: 'Caption', text: 'a stray line above the footer'}])])).deck);
  assert.ok(stray.warnings.some(w => /slides\[0\]\.els\[7\].*foot band/.test(w)), stray.warnings.join(' | '));
  // a row with its own y opts out of the seat, and is judged like any other row
  const own = chart(); own.els = own.els.map(r => r.slot === 'source' ? {...r, y: 476} : r);
  const pinned = validate(create(deck(RIGHT, [own])).deck);
  assert.ok(pinned.warnings.some(w => /foot band/.test(w) && /desk log/.test(w)), pinned.warnings.join(' | '));
});

test('K17: a note bound where the layout dropped it names the fix', () => {
  const v = validate(create(deck(RIGHT, [{layout: 'content', els: [{slot: 'title', text: 'A title'}, {slot: 'note', text: 'A floating note'}]}])).deck);
  assert.ok(v.errors.some(m => /note/.test(m) && /caption/.test(m)), v.errors.join(' | '));
});

// per slide: the baseline (first line) of the source, the legend, the footer and the counter, in canvas px
const measure = async (b, m, name) => {
  const f = path.join(tmp, name); fs.writeFileSync(f, create(m).html);
  const p = await b.newPage({viewport: {width: 1100, height: 700}}); await p.goto(pathToFileURL(f).href); await p.waitForTimeout(150);
  await p.addStyleTag({content: '#canvas{transform:none!important;border:0!important;position:absolute!important;left:0;top:0}'});
  const out = [];
  for (let k = 0; k < m.slides.length; k++) {
    await p.evaluate(k => { i = k; sel.clear(); render(); }, k); await p.waitForTimeout(60);
    out.push(await p.evaluate(() => {
      const cv = canvas.getBoundingClientRect();
      const base = e => { if (!e) return null; const s = document.createElement('i'); s.style.cssText = 'display:inline-block;width:0;height:0'; e.insertBefore(s, e.firstChild); const y = s.getBoundingClientRect().top - cv.top; s.remove(); return +y.toFixed(1); };
      const box = e => e && (r => ({left: +(r.left - cv.left).toFixed(1), right: +(r.right - cv.left).toFixed(1)}))(e.getBoundingClientRect());
      const row = slot => { const k = deck.slides[i].els.findIndex(r => r.slot === slot); return k < 0 ? null : canvas.querySelector(`[data-n="${k}"]`); };
      const f = canvas.querySelector('[data-footer]'), c = canvas.querySelector('.num'), s = row('source'), l = row('legend');
      return {source: base(s), legend: base(l), footer: base(f), num: base(c), sBox: box(s), lBox: box(l), fBox: box(f), nBox: box(c)};
    }));
  }
  await p.close(); return out;
};

live('K17: source, legend, deck name and page number share one baseline — right- and left-anchored footers, Chromium and WebKit', async () => {
  for (const eng of ['chromium', 'webkit']) {
    const b = await pw[eng].launch();
    for (const [label, foot] of [['right', RIGHT], ['left', LEFT]]) {
      const [s] = await measure(b, deck(foot, [chart(), {els: [{x: 60, y: 60, w: 840, role: 'H1', text: 'no source here'}]}]), `${label}-${eng}.html`);
      const at = `${eng}/${label}`;
      assert.ok(Math.abs(s.source - s.num) <= 0.5, `${at}: source baseline ${s.source} vs page number ${s.num}`);
      assert.ok(Math.abs(s.legend - s.num) <= 0.5, `${at}: legend baseline ${s.legend} vs page number ${s.num}`);
      assert.ok(Math.abs(s.footer - s.num) <= 0.5, `${at}: deck name baseline ${s.footer} vs page number ${s.num}`);
      assert.equal(Math.round(s.sBox.left), 60, at + ': the source starts on the left margin');
      assert.equal(Math.round(s.nBox.right), 900, at + ': the counter keeps its corner');
      assert.ok(s.sBox.right < s.lBox.left && s.lBox.right < s.fBox.left, `${at}: source · legend · deck name, left to right (${JSON.stringify(s)})`);
    }
    await b.close();
  }
});
