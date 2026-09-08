// decklet links — live proofs (Playwright, skipped when absent). One `href` model, two surfaces (a row's inset anchor and an
// inline <a> run), three modes: presenting = a click opens the link in a new tab; editing = a click selects, ⌘-click (Ctrl-click
// off Mac) opens the link in a new tab and the hover hint says so; print + ⤓ PDF = the link survives as an anchor / an annotation.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-links-'));
const BOX = 'https://example.com/box', RUN = 'https://example.com/run';
const model = () => ({w: 960, h: 540, title: 'links', slides: [{els: [
  {x: 60, y: 80, w: 800, role: 'H1', text: 'Links'},
  {x: 60, y: 200, w: 240, h: 56, bg: 'var(--accent)', radius: 8, href: BOX},                       // a painted CTA box…
  {x: 60, y: 200, w: 240, h: 56, role: 'Body', align: 'center', valign: 'middle', text: 'Open the box', href: BOX}, // …and its label
  {x: 60, y: 320, w: 800, role: 'Body', html: 'Read the <a href="' + RUN + '">linked run</a> here'},   // an inline link mark
  {x: 60, y: 400, w: 300, role: 'Body', text: 'plain row, no link'},
]}]});
const deck = () => { const f = path.join(tmp, 'links.html'); fs.writeFileSync(f, create(model()).html); return f; };
// a context that never reaches the network: every https navigation is answered locally, so the popup's URL is still the deck's href
const launch = async () => {
  const b = await pw.chromium.launch(); const ctx = await b.newContext({viewport: {width: 1280, height: 800}});
  await ctx.route('https://**', r => r.fulfill({status: 200, contentType: 'text/html', body: 'ok'}));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.errs = errs;
  await p.goto(pathToFileURL(deck()).href); await p.waitForTimeout(150); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(150);
  return {b, ctx, p};
};
const centre = async (p, q) => p.$eval(q, d => { const r = d.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
// click at a point and report the popup it opened (or null after a short wait)
const clickFor = async (ctx, p, [x, y], opts = {}) => {
  const popup = ctx.waitForEvent('page', {timeout: 800}).catch(() => null);
  for (const k of opts.modifiers || []) await p.keyboard.down(k); // page.mouse.click has no modifiers option: hold the key around the click
  await p.mouse.click(x, y); for (const k of opts.modifiers || []) await p.keyboard.up(k);
  const np = await popup; if (np) await np.waitForLoadState({timeout: 3000}).catch(() => {});
  return np ? np.url() : null;
};

live('presenting: a click on a linked box, or on a linked run, opens the link in a new tab and leaves the deck where it was', async () => {
  const {b, ctx, p} = await launch(); await p.evaluate(() => setPresent(true, true));
  assert.equal(await clickFor(ctx, p, await centre(p, '.el[data-n="2"]')), BOX, 'the label row over the CTA box opens the box href');
  assert.equal(await clickFor(ctx, p, await centre(p, '.el[data-n="3"] a')), RUN, 'the inline run opens its own href');
  assert.equal(await clickFor(ctx, p, await centre(p, '.el[data-n="4"]')), null, 'an unlinked row opens nothing');
  assert.match(p.url(), /links\.html/, 'the deck tab never navigates');
  assert.equal(await p.evaluate(() => present()), true, 'still presenting');
  assert.deepEqual(p.errs, []); await b.close();
});

live('editing: a click selects a linked row; ⌘-click opens its link in a new tab without touching the selection; ⌘-click elsewhere still multi-selects', async () => {
  const {b, ctx, p} = await launch();
  assert.equal(await clickFor(ctx, p, await centre(p, '.el[data-n="2"]')), null, 'a plain click on a linked row opens nothing…');
  assert.deepEqual(await p.evaluate(() => [...sel]), [2], '…it selects the row');
  assert.equal(await clickFor(ctx, p, await centre(p, '.el[data-n="3"] a')), null, 'a plain click on an inline run opens nothing');
  await p.evaluate(() => { sel.clear(); render(); });
  assert.equal(await clickFor(ctx, p, await centre(p, '.el[data-n="2"]'), {modifiers: ['Meta']}), BOX, '⌘-click on the linked row opens it');
  assert.deepEqual(await p.evaluate(() => [...sel]), [], 'the selection is untouched');
  assert.equal(await clickFor(ctx, p, await centre(p, '.el[data-n="3"] a'), {modifiers: ['Meta']}), RUN, '⌘-click on the inline run opens it');
  assert.equal(await clickFor(ctx, p, await centre(p, '.el[data-n="3"] a'), {modifiers: ['Control']}), RUN, 'Ctrl-click too (Windows / Linux)');
  assert.equal(await clickFor(ctx, p, await centre(p, '.el[data-n="4"]'), {modifiers: ['Meta']}), null, '⌘-click on an unlinked row opens nothing…');
  assert.deepEqual(await p.evaluate(() => [...sel]), [4], '…it toggles the row into the selection, as before');
  assert.match(p.url(), /links\.html/, 'the deck tab never navigates');
  assert.deepEqual(p.errs, []); await b.close();
});

live('hover hint: while editing, a linked row and a linked run say "⌘-click opens <url>"; while presenting the hint is the url alone', async () => {
  const {b, p} = await launch();
  const mod = await p.evaluate(() => /Mac|iP/.test(navigator.platform) ? '⌘' : 'Ctrl');
  assert.equal(await p.$eval('.el[data-n="1"]', d => d.title), `${mod}-click opens ${BOX}`, 'the painted box carries the hint');
  assert.equal(await p.$eval('.el[data-n="2"]', d => d.title), `${mod}-click opens ${BOX}`, 'so does its label row');
  assert.equal(await p.$eval('.el[data-n="3"] a', d => d.title), `${mod}-click opens ${RUN}`, 'and the inline run');
  assert.equal(await p.$eval('.el[data-n="4"]', d => d.title), '', 'an unlinked row has none');
  await p.evaluate(() => setPresent(true, true));
  assert.equal(await p.$eval('.el[data-n="2"]', d => d.title), BOX, 'presenting: the url alone, a click is the whole gesture');
  assert.equal(await p.$eval('.el[data-n="3"] a', d => d.title), RUN);
  assert.deepEqual(p.errs, []); await b.close();
});

live('print + ⤓ PDF: both link surfaces reach the print pages as anchors and the in-file PDF as /Link annotations', async () => {
  const {b, p} = await launch();
  await p.evaluate(() => dispatchEvent(new Event('beforeprint')));
  const printed = await p.$$eval('#print a[href]', as => as.map(a => [a.getAttribute('href'), a.target]));
  assert.deepEqual(printed.sort(), [[BOX, '_blank'], [BOX, '_blank'], [RUN, '_blank']].sort(), 'print pages carry the anchors ⌘P → Save as PDF follows');
  const dl = p.waitForEvent('download', {timeout: 8000}); await p.evaluate(() => exportPdf()); const file = await (await dl).path();
  const pdf = fs.readFileSync(file, 'latin1');
  assert.equal((pdf.match(/\/Subtype \/Link/g) || []).length, 3, 'three annotations: box, label, run');
  assert.match(pdf, new RegExp('/URI \\(' + BOX.replace(/[/.]/g, '\\$&') + '\\)'));
  assert.match(pdf, new RegExp('/URI \\(' + RUN.replace(/[/.]/g, '\\$&') + '\\)'));
  assert.deepEqual(p.errs, []); await b.close();
});
