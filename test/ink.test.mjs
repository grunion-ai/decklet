// verify's ink rule: a rect is ink (something drawn THROUGH text) only when it is thin in one dimension (a rule) or small in
// both (a dot). A logo plate or chip is a surface text sits beside or on — never a stroke. (FRICTION F8)
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {create} from '../bin/create.mjs';
import {verify} from '../bin/verify.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-ink-'));
const label = {x: 100, y: 100, w: 200, h: 30, role: 'Body', text: 'Company name', nowrap: 1};
const run = async (name, extra) => {
  const f = path.join(tmp, name + '.html');
  fs.writeFileSync(f, create({w: 960, h: 540, slides: [{els: [label, extra]}]}).html);
  const r = await verify(f, {out: path.join(tmp, 'v-' + name), log: () => {}});
  return JSON.stringify(r.parity[0].rows);
};
live('ink: a 56x22 logo plate 8px beside its label is not a collision', async () => {
  assert.doesNotMatch(await run('plate', {x: 36, y: 104, w: 56, h: 22, bg: '#ffffff', bd: '#dddddd'}), /overlapped by/);
});
live('ink: a 1px rule drawn through text still fails', async () => {
  assert.match(await run('rule', {x: 80, y: 114, w: 300, h: 1, bg: '#000000'}), /overlapped by/);
});
live('ink: an 8px dot on text still fails', async () => {
  assert.match(await run('dot', {x: 150, y: 110, w: 8, h: 8, bg: '#000000'}), /overlapped by/);
});
