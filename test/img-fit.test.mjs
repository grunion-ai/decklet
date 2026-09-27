// img rows keep their aspect ratio by default (FRICTION F3): object-fit defaults to contain, not fill.
// fit:'fill' and fit:'cover' stay explicit opt-ins.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {create} from '../bin/create.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-imgfit-'));
// 4:3 source in a 200x100 box — a mismatched ratio, so a wrong default silently stretches it
const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#5B9CF6"/></svg>');
const row = fit => ({x: 50, y: 50, w: 200, h: 100, img: IMG, ...(fit ? {fit} : {})});
const objectFitOf = async (name, fit) => {
  const f = path.join(tmp, name + '.html');
  fs.writeFileSync(f, create({w: 960, h: 540, slides: [{els: [row(fit)]}]}).html);
  const {chromium} = pw;
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    await p.goto('file://' + f);
    return await p.evaluate(() => getComputedStyle(document.querySelector('img')).objectFit);
  } finally { await b.close(); }
};
live('img row with no fit set defaults to contain', async () => {
  assert.equal(await objectFitOf('default', undefined), 'contain');
});
live("img row with fit:'fill' still stretches", async () => {
  assert.equal(await objectFitOf('fill', 'fill'), 'fill');
});
live("img row with fit:'cover' still covers", async () => {
  assert.equal(await objectFitOf('cover', 'cover'), 'cover');
});
