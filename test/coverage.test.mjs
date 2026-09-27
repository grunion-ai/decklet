// decklet coverage gate — validate warns when a slide carries words and nothing to look at, and (opt-in, deck.entities)
// when a row names a listed company with no logo beside it. Pure Node, no browser.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const bin = fileURLToPath(new URL('../bin/validate.mjs', import.meta.url));

const deck = (slides, extra = {}) => create({w: 960, h: 540, slides, ...extra}).deck;
const txt = (y, text, role = 'Body') => ({x: 60, y, w: 600, role, text});
const three = [txt(60, 'Market map', 'H1'), txt(140, 'Instant quoting is consolidating'), txt(200, 'Three vendors hold most volume')];
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const textOnly = v => v.warnings.filter(w => /text only/.test(w));
const unlogoed = v => v.warnings.filter(w => /no logo/.test(w));

test('coverage: a slide of text rows only warns, naming the slide and the fix', () => {
  const v = validate(deck([{els: three}]));
  assert.deepEqual(v.errors, []);
  assert.equal(textOnly(v).length, 1, JSON.stringify(v.warnings));
  assert.match(textOnly(v)[0], /^slides\[0\]: text only/);
  assert.match(textOnly(v)[0], /icon|img|chart/, 'the message names the fix');
});

test('coverage: a plain card behind the text is still text only', () => {
  const v = validate(deck([{els: [{x: 40, y: 40, w: 700, h: 300, bg: '#eee'}, ...three]}]));
  assert.equal(textOnly(v).length, 1, JSON.stringify(v.warnings));
});

test('coverage: an icon, an image, a chart or a drawn mark clears it', () => {
  const cases = {
    icon: {x: 700, y: 60, w: 48, h: 48, icon: 'award'},
    img: {x: 700, y: 60, w: 160, h: 90, img: PNG},
    bar: {x: 700, y: 60, w: 120, h: 24, bg: '#36c'},
    arrow: {x: 700, y: 300, line: [860, 300], arrow: 'end', h: 3},
    chart: {x: 680, y: 60, w: 240, h: 200, chart: {mark: 'bar', data: [{label: 'A', value: 3}, {label: 'B', value: 5}]}},
  };
  for (const [k, r] of Object.entries(cases)) {
    const v = validate(deck([{els: [...three, r]}]));
    assert.deepEqual(textOnly(v), [], `${k}: ${JSON.stringify(v.warnings)}`);
  }
});

test('coverage: cover, section and statement slides, short slides and big-number slides are exempt', () => {
  for (const layout of ['cover', 'section', 'statement']) {
    const v = validate(deck([{layout, els: [{slot: 'title', text: 'A title'}, {slot: layout === 'statement' ? 'caption' : 'body', text: 'A line under it'}]}]));
    assert.deepEqual(textOnly(v), [], layout);
  }
  assert.deepEqual(textOnly(validate(deck([{els: three.slice(0, 2)}]))), [], 'a title and one line is a statement by form');
  assert.deepEqual(textOnly(validate(deck([{els: [...three, {x: 700, y: 60, w: 200, role: 'Stat', text: '63%'}]}]))), [], 'a big number is a figure');
});

test('coverage: deck.entities warns on a named company with no logo nearby, and a logo beside it clears it', () => {
  const entities = ['Xometry', 'Protolabs'];
  const rows = [txt(60, 'Quoting vendors', 'H1'), {x: 120, y: 200, w: 300, role: 'Body', text: 'Xometry'}, {x: 120, y: 260, w: 300, role: 'Body', text: 'Protolabs'}];
  const off = validate(deck([{els: rows}]));
  assert.deepEqual(unlogoed(off), [], 'opt-in: no entity list, no entity warning');
  const v = validate(deck([{els: rows}], {entities}));
  assert.equal(unlogoed(v).length, 1, JSON.stringify(v.warnings));
  assert.match(unlogoed(v)[0], /^slides\[0\]: .*Xometry.*Protolabs/);
  assert.match(unlogoed(v)[0], /img/, 'the message names the fix');
  const logos = [{x: 60, y: 196, w: 48, h: 24, img: PNG}, {x: 60, y: 256, w: 48, h: 24, img: PNG}];
  assert.deepEqual(unlogoed(validate(deck([{els: [...rows, ...logos]}], {entities}))), []);
  const far = [{x: 820, y: 460, w: 48, h: 24, img: PNG}];
  assert.equal(unlogoed(validate(deck([{els: [...rows, ...far]}], {entities}))).length, 1, 'a logo across the slide is not beside the name');
  assert.deepEqual(unlogoed(validate(deck([{els: [txt(60, 'Xometry leads quoting', 'H1'), {x: 700, y: 300, w: 100, h: 60, img: PNG}]}], {entities}))), [], 'a heading may name a company in prose');
  assert.deepEqual(unlogoed(validate(deck([{els: [txt(300, 'Xometry and Protolabs both cut quoting to seconds this year.')]}], {entities}))), [], 'so may a sentence: the rule is for listings');
});

test('coverage: deck.entities must be a list of names; warnings fail only under --strict', () => {
  assert.ok(validate(deck([{els: three}], {entities: 'Xometry'})).errors.some(e => /entities/.test(e)));
  const v = validate(deck([{els: three}]));
  assert.ok(v.ok, 'a warning is not an error');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-cov-')), 'model.json');
  fs.writeFileSync(f, JSON.stringify({w: 960, h: 540, slides: [{els: three}]}));
  assert.equal(spawnSync(process.execPath, [bin, f]).status, 0, 'the CLI passes a text-only slide');
  const strict = spawnSync(process.execPath, [bin, f, '--strict']);
  assert.equal(strict.status, 1, 'and fails it under --strict'); assert.match(String(strict.stderr), /text only/);
});
