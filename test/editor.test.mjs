// decklet editor — live proofs (Playwright, skipped when absent) for the human-edit loop:
// connector point nibs · arrows in the PDF · autosave that survives reload and a mid-edit reload · slide position by id ·
// a new version keeps the human's edits (migrate on load) · ⌘S writes the file (File System Access, mocked) · versions · ⌘B
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {blockOf, putBlock} from '../lib/edits.mjs';
import {edits, describe} from '../bin/edits.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-editor-'));
const model = (extra = {}) => ({w: 960, h: 540, title: 'probe', ...extra, slides: extra.slides || [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}, {x: 60, y: 200, w: 400, role: 'Body', text: 'body one'}, {x: 100, y: 300, line: [400, 300], arrow: 'end', h: 3}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Two'}, {x: 100, y: 200, curve: [200, 100, 300, 400, 500, 200], arrow: 'end', h: 3}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Three'}]},
]});
const write = (name, html) => { const f = path.join(tmp, name); fs.writeFileSync(f, html); return f; };
const open = async (b, f, opts = {}) => { const p = await b.newPage({viewport: {width: 1280, height: 800}, ...opts}); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.errs = errs; await p.goto(pathToFileURL(f).href); await p.waitForTimeout(150); return p; };
const fresh = async (b, f) => { const p = await open(b, f); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(150); return p; };

live('the mini toolbar opens on a text edit inside a group: the edited row wins over the group selection', async () => {
  // clicking a member selects the whole group (sel.size > 1), and placeTb bailed on any selection but one row — so a
  // double-click into a grouped row edited the text with no toolbar: no roles, no B/I/U, no colours.
  const m = model({slides: [{els: [
    {x: 60, y: 100, w: 300, h: 80, bg: 'var(--card)', bd: '1px solid var(--fg)', group: 'card'},
    {x: 76, y: 108, w: 268, role: 'Body', weight: 600, text: 'Title', group: 'card'},
    {x: 76, y: 140, w: 268, role: 'Label', text: 'sublabel', group: 'card'},
    {x: 60, y: 300, w: 300, role: 'Body', text: 'loose'}]}]});
  const b = await pw.chromium.launch(); const p = await fresh(b, write('grouptb.html', create(m).html));
  await p.evaluate(() => { sel.clear(); sel.add(1); grp(1).forEach(n => sel.add(n)); render(); });
  assert.equal(await p.evaluate(() => sel.size), 3, 'a member selects the group');
  assert.equal(await p.evaluate(() => tb.hidden), true, 'a bare group selection shows no toolbar');
  await p.evaluate(() => edit(1));
  assert.equal(await p.evaluate(() => tb.hidden), false, 'editing a grouped text row opens the toolbar');
  assert.equal(await p.evaluate(() => $('tb-roles').querySelector('.on').dataset.role), 'Body', 'the roles strip marks the edited row\'s role');
  await p.evaluate(() => { commitEdit(); sel.clear(); sel.add(3); render(); });
  assert.equal(await p.evaluate(() => tb.hidden), false, 'a single loose text row still shows it');
  assert.deepEqual(p.errs, []); await b.close();
});

live('a bound connector dragged without its anchors translates rigidly: the to:/from: ends become the human\'s', async () => {
  // dragging a line whose ends are bound to boxes that stay put used to leave both ends re-aimed at the boxes while the
  // shaft moved, skewing the stroke into a diagonal. The drag is a translation: shape and length are kept, the bindings drop.
  const m = model({slides: [{els: [
    {id: 'a', x: 60, y: 200, w: 160, h: 60, bg: 'var(--card)', bd: '1px solid var(--fg)'},
    {id: 'b', x: 500, y: 200, w: 160, h: 60, bg: 'var(--card)', bd: '1px solid var(--fg)'},
    {x: 220, y: 230, line: [500, 230], h: 3, arrow: 'end', from: 'a', to: 'b'}]}]});
  const b = await pw.chromium.launch(); const p = await fresh(b, write('bound.html', create(m).html));
  await p.evaluate(() => { sel.clear(); sel.add(2); render(); });
  const before = await p.evaluate(() => JSON.parse(JSON.stringify(slide().els[2])));
  const box = async s => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, s);
  const [x, y] = await box('.el[data-seg]'); await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x, y + 60, {steps: 4}); await p.mouse.up();
  const after = await p.evaluate(() => JSON.parse(JSON.stringify(slide().els[2])));
  const scale = await p.evaluate(() => canvas.getBoundingClientRect().width / W);
  assert.equal(after.to, undefined); assert.equal(after.from, undefined);
  assert.ok(Math.abs(after.x - before.x) <= 1 && Math.abs(after.line[0] - before.line[0]) <= 1, `no horizontal drift: ${before.x},${before.line[0]} → ${after.x},${after.line[0]}`);
  assert.ok(Math.abs((after.y - before.y) - 60 / scale) <= 2 && Math.abs(after.line[1] - after.y) <= 1, `both ends travelled ${60 / scale}px and stayed level: ${after.y},${after.line[1]}`);
  // the rendered shaft is the model's: level, full length
  const seg = await p.evaluate(() => { const r = canvas.querySelector('.el[data-seg]').getBoundingClientRect(); return [r.width, r.height]; });
  assert.ok(seg[0] / scale > 260 && seg[1] / scale < 12, `rendered level and long: ${seg}`);
  // a selection that carries the anchor keeps the binding: box + line move together, the line still ends on the box
  await p.evaluate(() => { sel.clear(); sel.add(0); sel.add(1); sel.add(2); render(); });
  await p.evaluate(() => { slide().els[2].from = 'a'; slide().els[2].to = 'b'; render(); });
  const [x2, y2] = await box('.el[data-seg]'); await p.mouse.move(x2, y2); await p.mouse.down(); await p.mouse.move(x2 + 40, y2, {steps: 4}); await p.mouse.up();
  const kept = await p.evaluate(() => JSON.parse(JSON.stringify(slide().els[2])));
  assert.deepEqual([kept.from, kept.to], ['a', 'b'], 'anchors in the same drag stay bound');
  assert.deepEqual(p.errs, []); await b.close();
});

live('connector nibs: point handles, never the corner nib; an endpoint drag moves one end; a body drag keeps the length', async () => {
  const b = await pw.chromium.launch(); const p = await fresh(b, write('nib.html', create(model()).html));
  await p.evaluate(() => { sel.clear(); sel.add(2); render(); });
  assert.deepEqual(await p.evaluate(() => [canvas.querySelectorAll('.h.pt').length, canvas.querySelectorAll('.el .h').length, [...canvas.querySelectorAll('.h.pt')].map(h => h.dataset.pt)]), [2, 0, ['s', 'e']], 'a line: two point nibs on the canvas, no corner nib on the row');
  await p.evaluate(() => { i = 1; sel.clear(); sel.add(1); render(); });
  assert.deepEqual(await p.evaluate(() => [...canvas.querySelectorAll('.h.pt')].map(h => h.dataset.pt + (h.classList.contains('ctl') ? '*' : ''))), ['s', 'c1*', 'c2*', 'e'], 'a curve: endpoints + hollow control nibs');
  await p.evaluate(() => { i = 0; sel.clear(); sel.add(2); render(); });
  const box = async sel => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  let [x, y] = await box('.h.pt[data-pt="e"]');
  await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 40, y + 20, {steps: 4}); await p.mouse.up();
  const scale = await p.evaluate(() => canvas.getBoundingClientRect().width / W);
  const el = await p.evaluate(() => JSON.parse(JSON.stringify(slide().els[2])));
  assert.deepEqual([el.x, el.y], [100, 300], 'the start did not move');
  assert.ok(Math.abs(el.line[0] - (400 + 40 / scale)) <= 2 && Math.abs(el.line[1] - (300 + 20 / scale)) <= 2, `the end followed the nib: ${el.line}`);
  // body drag: grab the shaft (its halo), translate — same length, same angle
  const before = await p.evaluate(() => JSON.parse(JSON.stringify(slide().els[2])));
  const len = l => Math.hypot(l.line[0] - l.x, l.line[1] - l.y);
  [x, y] = await box('.el[data-seg]'); await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 30, y + 30, {steps: 4}); await p.mouse.up();
  const after = await p.evaluate(() => JSON.parse(JSON.stringify(slide().els[2])));
  assert.notEqual(after.x, before.x, 'it moved'); assert.ok(Math.abs(len(after) - len(before)) < 1.5, `length kept: ${len(before)} → ${len(after)}`);
  assert.equal((await p.evaluate(() => log.filter(e => e.r === slide().els[2].id).length)), 2, 'two log entries: the end drag, the body drag');
  assert.deepEqual(p.errs, []); await b.close();
});

live('PDF: the arrow head and shaft survive the export (connectors are painted by the styled layer, not redrawn alone)', async () => {
  const b = await pw.chromium.launch(); const p = await fresh(b, write('pdf.html', create(model()).html));
  const px = await p.evaluate(async () => {
    HTMLAnchorElement.prototype.click = () => {}; const cvs = []; const orig = CanvasRenderingContext2D.prototype.getImageData; // the Flate path reads pixels, so hook the read
    CanvasRenderingContext2D.prototype.getImageData = function (...a) { if (!cvs.includes(this.canvas)) cvs.push(this.canvas); return orig.apply(this, a); };
    await exportPdf();
    const g = cvs[0].getContext('2d'), at = (x, y) => [...orig.call(g, x * 3, y * 3, 1, 1).data].slice(0, 3); // 3× raster
    return {tip: at(394, 300), shaft: at(250, 300), bg: at(250, 330)}; // the shaft ends at 390.4; 394 is inside the head, short of its anti-aliased tip at 400
  });
  const accent = c => c[2] > 150 && c[2] > c[0] + 40; // #5B9CF6-ish: blue dominant
  assert.ok(accent(px.shaft), `shaft painted: ${px.shaft}`); assert.ok(accent(px.tip), `head painted at the tip: ${px.tip}`); assert.ok(!accent(px.bg), `air stays card-coloured: ${px.bg}`);
  await b.close();
});

live('autosave: an edit survives reload; a live text edit survives reload (committed on pagehide); the dot goes red when storage throws', async () => {
  const b = await pw.chromium.launch(); const f = write('as.html', create(model()).html); let p = await fresh(b, f);
  await p.evaluate(() => { snap(); slide().els[1].x = 123; save(); });
  await p.reload(); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => slide().els[1].x), 123, 'x persisted');
  assert.equal(await p.evaluate(() => log.length), 1); assert.equal(await p.evaluate(() => document.getElementById('autosave').dataset.state), 'local', 'amber: in this browser, not in the file');
  await p.evaluate(() => { sel.clear(); sel.add(0); render(); edit(0); }); await p.keyboard.type('Typed then reloaded');
  await p.reload(); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => slide().els[0].text), 'Typed then reloaded', 'the edit in flight was committed before the page went');
  await p.close();
  const ctx = await b.newContext(); await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', {get() { throw new Error('blocked'); }}); });
  p = await ctx.newPage(); await p.goto(pathToFileURL(f).href); await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => document.getElementById('autosave').dataset.state), 'bad', 'storage blocked → red at load');
  await p.evaluate(() => { snap(); slide().els[1].x = 7; save(); nav(1); nav(-1); });
  assert.equal(await p.evaluate(() => slide().els[1].x), 7, 'edits still hold in memory for the session');
  await b.close();
});

live('position: a fresh window opens on slide 1; reload keeps the slide; the slide is remembered by id, so it survives a renumbering', async () => {
  const b = await pw.chromium.launch(); const f = write('pos.html', create(model()).html); let p = await fresh(b, f);
  await p.evaluate(() => { nav(1); nav(1); }); assert.equal(await p.evaluate(() => i), 2);
  await p.reload(); await p.waitForTimeout(150); assert.equal(await p.evaluate(() => i), 2, 'reload keeps slide 3');
  const p2 = await open(b, f); assert.equal(await p2.evaluate(() => i), 0, 'a new window starts on slide 1'); await p2.close();
  const p3 = await b.newPage(); await p3.goto(pathToFileURL(f).href + '#2'); await p3.waitForTimeout(150); assert.equal(await p3.evaluate(() => i), 1, 'a deep link #2 still lands on slide 2'); await p3.close();
  // a new file version inserts a slide before the current one: the tab stays on the SAME slide (id), now index 3
  const id = await p.evaluate(() => slide().id);
  const m2 = model(); m2.slides.splice(0, 0, {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Zero'}]});
  fs.writeFileSync(f, create(m2, {from: f}).html);
  await p.reload(); await p.waitForTimeout(150);
  assert.deepEqual(await p.evaluate(() => [i, slide().id, deck.slides.length]), [3, id, 4], 'same slide by id after the insert');
  await b.close();
});

live('new version: the browser replays its log onto the agent\'s file (human wins); the agent\'s other changes show; a stale copy never hides them', async () => {
  const b = await pw.chromium.launch(); const f = write('mig.html', create(model()).html); const p = await fresh(b, f);
  await p.evaluate(() => { snap(); slide().els[1].x = 321; slide().els[0].text = 'Mine'; save(); });
  const m2 = model(); m2.slides[0].els[1].w = 555; m2.slides[0].els[0].text = 'Agent retitled'; // agent: one untouched key, one conflict
  const v2 = create(m2, {from: f}); // the agent could not see the browser-only edits (no ⌘S yet): nothing to migrate on its side
  assert.equal(v2.migrate.applied, 0); fs.writeFileSync(f, v2.html);
  await p.reload(); await p.waitForTimeout(150);
  assert.deepEqual(await p.evaluate(() => [slide().els[1].x, slide().els[1].w, slide().els[0].text, deck.rev === DECK.rev]), [321, 555, 'Mine', true], 'human x + text, agent w, on the new rev');
  assert.equal(await p.evaluate(() => log.filter(e => e.conflict).length), 1, 'the retitle conflict is on the entry');
  await p.reload(); await p.waitForTimeout(150);
  assert.deepEqual(await p.evaluate(() => [slide().els[1].x, slide().els[0].text]), [321, 'Mine'], 'idempotent on the next reload');
  await b.close();
});

live('⌘S writes the file: the first press links it (picker, mocked), the file carries DECK + LOG + VERSIONS, later edits write back on their own; bin/edits reads it', async () => {
  const b = await pw.chromium.launch(); const f = write('fsa.html', create(model()).html);
  const ctx = await b.newContext(); await ctx.addInitScript(() => {
    window.__writes = []; const h = {kind: 'file', name: 'fsa.html', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      createWritable: async () => ({write: async s => { window.__writes.push(s); }, close: async () => {}})};
    window.showOpenFilePicker = async () => [h];
  });
  const p = await ctx.newPage(); await p.goto(pathToFileURL(f).href); await p.waitForTimeout(150); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(150);
  await p.evaluate(() => { snap(); slide().els[1].x = 200; save(); });
  await p.keyboard.press('Meta+s'); await p.waitForTimeout(300);
  const html = await p.evaluate(() => window.__writes.at(-1));
  assert.ok(html && html.startsWith('<!DOCTYPE html>'), 'a full document was written');
  assert.equal(blockOf(html, 'DECK').slides[0].els[1].x, 200, 'DECK carries the edit');
  const log = blockOf(html, 'LOG'); assert.equal(log.length, 1); assert.ok(log[0].rev, 'the entry is stamped with the rev it lives in');
  assert.equal(blockOf(html, 'VERSIONS').length, 1, '⌘S pinned a version'); assert.equal(blockOf(html, 'VERSIONS')[0].by, 'human');
  assert.equal(await p.evaluate(() => document.getElementById('autosave').dataset.state), 'ok', 'green: the file has everything');
  await p.evaluate(() => { snap(); slide().els[1].y = 250; save(); }); await p.waitForTimeout(300);
  assert.equal(blockOf(await p.evaluate(() => window.__writes.at(-1)), 'DECK').slides[0].els[1].y, 250, 'the next edit wrote back without ⌘S');
  const r = edits(html); assert.equal(r.log.length, 1); assert.match(describe(r.log[0]), /slide s1 row r2: x 60 → 200/);
  // a fresh open of the written file shows the edits with no browser storage at all
  const g = write('fsa-copy.html', html); const p2 = await b.newPage(); await p2.goto(pathToFileURL(g).href); await p2.waitForTimeout(150);
  assert.equal(await p2.evaluate(() => slide().els[1].x), 200);
  await b.close();
});

live('versions: pin keeps a snapshot, restore brings it back (and pins the state you left), the popover lists them, cap 20', async () => {
  const b = await pw.chromium.launch(); const p = await fresh(b, write('ver.html', create(model()).html));
  await p.evaluate(() => pin('first')); assert.equal(await p.evaluate(() => versions.length), 1);
  await p.evaluate(() => { snap(); slide().els[0].text = 'Changed'; save(); });
  await p.evaluate(() => document.getElementById('vers').click());
  assert.equal(await p.evaluate(() => document.querySelectorAll('#versmenu .v').length), 3, 'the save row + one version + the pin row');
  await p.evaluate(() => document.querySelector('#versmenu [data-restore="0"]').click());
  assert.equal(await p.evaluate(() => slide().els[0].text), 'One', 'restored');
  assert.deepEqual(await p.evaluate(() => versions.map(v => v.label)), ['first', 'before restore']);
  await p.evaluate(() => { for (let n = 0; n < 25; n++) { slide().els[0].text = 'v' + n; pin('p' + n); } });
  assert.equal(await p.evaluate(() => versions.length), 20);
  await p.reload(); await p.waitForTimeout(150); assert.equal(await p.evaluate(() => versions.length), 20, 'versions persist');
  await b.close();
});

live('⌘B / ⌘I / ⌘U mark the selection while editing, and take the whole row when a text row is merely selected', async () => {
  const b = await pw.chromium.launch(); const p = await fresh(b, write('marks.html', create(model()).html));
  await p.evaluate(() => { sel.clear(); sel.add(1); render(); });
  await p.keyboard.press('Meta+b'); await p.evaluate(() => nav(1));
  assert.match(await p.evaluate(() => deck.slides[0].els[1].html), /<b>body one<\/b>/, 'a selected row is bolded whole');
  await p.evaluate(() => { i = 0; sel.clear(); sel.add(0); render(); edit(0); });
  await p.keyboard.press('Meta+u'); await p.evaluate(() => nav(1));
  assert.match(await p.evaluate(() => deck.slides[0].els[0].html), /<u>One<\/u>/);
  await b.close();
});

// L1.1 — the contact sheet keeps its scroll: every sheet action rebuilt the grid from innerHTML='', so #sheet's scroll
// height collapsed for that frame and the viewport snapped to the top. #sheet (position:fixed; overflow:auto) is the
// scroller, not the window. Both engines: the clamp-on-collapse is per engine.
const sheetDeck = () => model({slides: Array.from({length: 40}, (_, n) => ({els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Slide ' + (n + 1)}]}))});
const pick = (p, n) => p.evaluate(n => grid.children[n].dispatchEvent(new MouseEvent('mousedown', {bubbles: true})), n);
for (const bn of ['chromium', 'webkit']) live(`the contact sheet keeps its scroll through a duplicate, and pulls an off-screen new cell into view (${bn})`, async () => {
  const b = await pw[bn].launch(); try { const p = await fresh(b, write(`sheetscroll-${bn}.html`, create(sheetDeck()).html));
  await p.keyboard.press('c'); assert.equal(await p.evaluate(() => sheet.hidden), false, 'C opens the sheet');
  const cellH = await p.evaluate(() => grid.children[3].getBoundingClientRect().top - grid.children[0].getBoundingClientRect().top);
  await p.evaluate(() => { sheet.scrollTop = 1500; });
  const before = await p.evaluate(() => sheet.scrollTop);
  assert.ok(before >= 1000, `the sheet scrolled (${before})`);
  await pick(p, 20); await p.evaluate(() => $('dup').click()); await p.waitForTimeout(60);
  assert.equal(await p.evaluate(() => deck.slides.length), 41, 'duplicate added a slide');
  const after = await p.evaluate(() => sheet.scrollTop);
  assert.ok(Math.abs(after - before) <= cellH, `scrollTop stays put: ${before} → ${after} (one cell row is ${cellH})`);
  // the acted-on cell off screen: duplicating slide 1 from row 7 brings the new cell 2 into the viewport, and no further
  await pick(p, 0); await p.evaluate(() => $('dup').click()); await p.waitForTimeout(60);
  const r = await p.evaluate(() => { const r = grid.children[1].getBoundingClientRect(); return {top: r.top, bottom: r.bottom, sel: grid.children[1].classList.contains('sel'), top0: sheet.scrollTop}; });
  assert.ok(r.top >= 0 && r.bottom <= 800, `the new cell is in view (${r.top}..${r.bottom})`);
  assert.ok(r.sel, 'the new cell is the selection');
  assert.ok(r.top0 <= cellH, `scrolled just far enough (${r.top0})`);
  assert.deepEqual(p.errs, []); } finally { await b.close(); }
});

// L1.2 — the sheet patches cells in place: an action rebuilds only the slides it touched; the other cells keep their DOM
// node (and thumbnail) and FLIP to where they now sit. Counters and labels are renumbered on every cell.
for (const bn of ['chromium', 'webkit']) live(`the contact sheet keeps the untouched cells' DOM nodes through a duplicate and a delete (${bn})`, async () => {
  const b = await pw[bn].launch(); try { const p = await fresh(b, write(`sheetpatch-${bn}.html`, create(sheetDeck()).html));
  await p.keyboard.press('c'); await p.evaluate(() => { window.__cells = [...grid.children]; });
  await pick(p, 20); await p.evaluate(() => $('dup').click()); await p.waitForTimeout(60);
  const d = await p.evaluate(() => {
    const now = [...grid.children], same = now.map((c, n) => n <= 20 ? c === __cells[n] : n === 21 ? !__cells.includes(c) : c === __cells[n - 1]);
    return {n: now.length, same, num: now[30].querySelector('.num').textContent, label: now[30].querySelector('.n').textContent, sel: now.map(c => c.classList.contains('sel'))};
  });
  assert.equal(d.n, 41);
  assert.ok(d.same.every(Boolean), `every cell but the new one is the node it was: ${d.same.map((s, n) => s ? '' : n).filter(x => x !== '').join(',')} differ`);
  assert.equal(d.num, '31 / 41', 'the counter is renumbered on a kept cell'); assert.equal(d.label, '31');
  assert.deepEqual(d.sel.map((s, n) => s ? n : -1).filter(n => n >= 0), [21], 'the copy is the selection');
  await p.evaluate(() => { window.__cells = [...grid.children]; }); await pick(p, 5); await p.keyboard.press('Backspace'); await p.waitForTimeout(60);
  const e = await p.evaluate(() => {
    const now = [...grid.children];
    return {n: now.length, same: now.every((c, n) => c === __cells[n < 5 ? n : n + 1]), num: now[5].querySelector('.num').textContent, label: now[5].querySelector('.n').textContent, sel: now.findIndex(c => c.classList.contains('sel'))};
  });
  assert.equal(e.n, 40); assert.ok(e.same, 'after a delete every remaining cell is the node it was');
  assert.equal(e.num, '6 / 40'); assert.equal(e.label, '6'); assert.equal(e.sel, 5, 'the slide after the deleted one is selected');
  assert.deepEqual(p.errs, []); } finally { await b.close(); }
});
