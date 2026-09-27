// decklet coverage gate — validate warns when a slide carries words and nothing to look at, and (opt-in, deck.entities)
// when a row names a listed company with no logo beside it. Pure Node, no browser.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import * as templates from '../lib/templates.mjs';
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
const prose = v => v.warnings.filter(w => /no logo for/.test(w));

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

test('coverage (K9): a visual clears it only by its area — about 8% of the content box; an icon is decoration', () => {
  const pass = {
    img: {x: 600, y: 60, w: 300, h: 170, img: PNG},
    chart: {x: 680, y: 60, w: 240, h: 200, chart: {mark: 'bar', data: [{label: 'A', value: 3}, {label: 'B', value: 5}]}},
    bars: [0, 1, 2, 3].map(k => ({x: 700 + k * 50, y: 120 + k * 20, w: 40, h: 200 - k * 20, bg: '#36c'})),
    diagram: [{id: 'a', x: 60, y: 300, w: 200, h: 80, bg: '#eee'}, {x: 70, y: 320, w: 180, role: 'Label', text: 'Quote'},
      {id: 'b', x: 400, y: 300, w: 200, h: 80, bg: '#eee'}, {x: 410, y: 320, w: 180, role: 'Label', text: 'Make'},
      {from: 'a', to: 'b', style: 'arrow'}],
    logos: [0, 1, 2, 3, 4, 5].map(k => ({x: 660 + (k % 2) * 130, y: 280 + Math.floor(k / 2) * 60, h: 40, logo: PNG, name: 'Mk' + k})),
  };
  for (const [k, r] of Object.entries(pass)) {
    const v = validate(deck([{els: [...three, ...[r].flat()]}]));
    assert.deepEqual(textOnly(v), [], `${k}: ${JSON.stringify(v.warnings)}`);
  }
  const fail = {
    icon: {x: 700, y: 60, w: 48, h: 48, icon: 'award'},
    'icon row': [0, 1, 2].map(k => ({x: 60 + k * 300, y: 300, w: 32, h: 32, icon: 'award'})),
    'small img': {x: 820, y: 60, w: 80, h: 45, img: PNG},
    'one bar': {x: 700, y: 60, w: 120, h: 24, bg: '#36c'},
    arrow: {x: 700, y: 300, line: [860, 300], arrow: 'end', h: 3},
    'wide rule': {x: 60, y: 120, line: [900, 120], h: 2, bg: '#36c'},
  };
  for (const [k, r] of Object.entries(fail)) {
    const v = validate(deck([{els: [...three, ...[r].flat()]}]));
    assert.equal(textOnly(v).length, 1, `${k} is decoration, not the visual: ${JSON.stringify(v.warnings)}`);
    assert.match(textOnly(v)[0], /\d+%/, 'the message names the coverage it found');
  }
});

test('coverage (K9): a chart of 10% of the content box passes, one of 5% warns', () => {
  const chart = (w, h) => ({x: 600, y: 200, w, h, chart: {mark: 'bar', data: [{label: 'A', value: 3}, {label: 'B', value: 5}, {label: 'C', value: 4}]}});
  // the content box on 960×540 is the canvas inside the 60px margin: 840 × 420
  assert.deepEqual(textOnly(validate(deck([{els: [...three, chart(210, 168)]}]))), [], '210×168 is 10% of 840×420');
  assert.equal(textOnly(validate(deck([{els: [...three, chart(150, 120)]}]))).length, 1, '150×120 is 5%');
});

test('coverage (K6): a template or layout slide is judged too — no exemption for naming one', () => {
  const bullets = {layout: 'bullets', els: [{slot: 'title', text: 'Four things the close waits on'},
    {slot: 'b1', text: 'The bank feed posts overnight.'}, {slot: 'b2', text: 'Card statements land on the third day.'},
    {slot: 'b3', text: 'Two subsidiaries send spreadsheets.'}]};
  assert.equal(textOnly(validate(deck([bullets]))).length, 1, 'a bullet layout with no graphic warns');
  assert.equal(textOnly(validate(deck([{template: 'bullet-page', textOnly: false}]))).length, 1, 'a text template warns once the slide drops the mark it inherits');
  const tiles = ['1,240', '$86K', '4.6'].map((text, i) => ({x: 60 + i * 290, y: 190, w: 260, h: 120, tile: 1, role: 'Stat', text}));
  assert.equal(textOnly(validate(deck([{els: tiles}]))).length, 1, 'stat tiles are words in boxes, not a graphic (K10)');
  assert.equal(textOnly(validate(deck([{template: 'icon-bullets', textOnly: false}]))).length, 1, 'icons beside the points are decoration');
  for (const t of ['area-bubbles', 'waffle', 'range-bar', 'chart-column', 'chart-line-trend', 'figure-flow', 'stat-row-4'])
    assert.deepEqual(textOnly(validate(deck([{template: t}]))), [], `${t} draws a real graphic`);
  assert.deepEqual(textOnly(validate(deck([{...bullets, textOnly: true}]))), [], 'textOnly: true declares a words slide');
  assert.ok(validate(deck([{...bullets, textOnly: 1}])).errors.some(e => /textOnly/.test(e)), 'textOnly is a boolean');
});

// K19 guard: Kyle rejected the exec-summary slide twice as words with nothing to look at (v1, v3 slide 2). The template
// draws a graphic now and carries no textOnly mark, so a slide expanded from it that loses the graphic warns.
test('coverage (K19): exec-summary draws a graphic, and a slide from it with no graphic warns', () => {
  const {TEMPLATE} = templates;
  assert.equal(TEMPLATE['exec-summary'].textOnly, undefined, 'exec-summary is not a words template');
  assert.deepEqual(textOnly(validate(deck([{template: 'exec-summary'}]))), [], 'the sample draws its graphic');
  const d = deck([{template: 'exec-summary'}]);
  const s = d.slides[0];
  s.els = s.els.filter(r => r.text != null || r.slot || (r.bg === 'var(--box)'));   // words and the claim strip, no graphic
  const v = validate(d);
  assert.equal(textOnly(v).length, 1, JSON.stringify(v.warnings));
  assert.equal(TEMPLATE['bullet-page'].textOnly, true, 'bullet-page is for words, by its own note');
  assert.equal(TEMPLATE['three-up-cards'].textOnly, undefined, 'three-up-cards carries cohorts of companies: its media carry the logos');
  const marks = validate(deck([{template: 'three-up-cards', fill: {m1: {logo: ''}, m2: {logo: ''}, m3: {logo: ''}}}]));
  assert.deepEqual(textOnly(marks), [], 'three logo marks on the cards satisfy the gate');
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
});

test('coverage: deck.entities (K18) — a company named in prose needs its own logo somewhere on the slide', () => {
  const entities = ['Xometry', 'Protolabs', 'MISUMI', 'Fictiv', ['nTop', 'nTopology']];
  const prose = v => v.warnings.filter(w => /no logo for/.test(w));
  const sentence = txt(300, 'MISUMI buys Fictiv, and Xometry cuts quoting to seconds this year.');
  const v = validate(deck([{els: [sentence]}], {entities}));
  assert.equal(prose(v).length, 1, JSON.stringify(v.warnings));
  assert.match(prose(v)[0], /^slides\[0\]: .*MISUMI.*Fictiv.*Xometry/);
  assert.match(unlogoed(v)[0], /img|logo/, 'the message names the fix');
  assert.equal(prose(validate(deck([{els: [txt(60, 'Xometry leads quoting', 'H1')]}], {entities}))).length, 1, 'a heading is prose too');
  // a logo for that company, anywhere on the slide: by asset key, by alt, or by the logo row's name; an unnamed img is nobody's logo
  const assets = {misumi: PNG};
  const els = [sentence,
    {x: 700, y: 60, h: 24, logo: '#misumi', name: 'buys Fictiv'},
    {x: 700, y: 120, h: 24, logo: PNG, name: 'Fictiv'},
    {x: 700, y: 400, w: 100, h: 40, img: PNG, alt: 'Xometry logo'}];
  assert.deepEqual(unlogoed(validate(deck([{els}], {entities, assets}))), [], 'every named company has its logo');
  const partial = validate(deck([{els: [sentence, {x: 700, y: 60, h: 24, logo: '#misumi', name: 'buys Fictiv'}, {x: 700, y: 400, w: 100, h: 40, img: PNG}]}], {entities, assets}));
  assert.equal(prose(partial).length, 1, JSON.stringify(partial.warnings));
  assert.match(prose(partial)[0], /Fictiv, Xometry/); assert.doesNotMatch(prose(partial)[0], /MISUMI/, 'the row names Fictiv, but its logo is MISUMI\'s');
  // aliases: an array entry is one company under several names; whole words only
  assert.equal(prose(validate(deck([{els: [txt(300, 'nTopology ships implicit modeling to aerospace teams.')]}], {entities}))).length, 1, 'an alias is a mention');
  assert.match(prose(validate(deck([{els: [txt(300, 'nTopology ships implicit modeling to aerospace teams.')]}], {entities})))[0], /nTop/);
  assert.deepEqual(prose(validate(deck([{els: [txt(300, 'nTopology ships implicit modeling.'), {x: 700, y: 60, h: 24, logo: PNG, name: 'nTop'}]}], {entities}))), [], 'a logo under any alias clears it');
  assert.deepEqual(prose(validate(deck([{els: [txt(300, 'Fictivity is not a company we listed.')]}], {entities}))), [], 'whole words only');
});

test('coverage: deck.entities (K18) — a monogram chip for a listed company warns', () => {
  const entities = ['Xometry', 'Protolabs'];
  const mono = v => v.warnings.filter(w => /monogram for/.test(w));
  const v = validate(deck([{els: [{x: 60, y: 200, h: 24, logo: '', name: 'Xometry'}, {x: 60, y: 260, h: 24, monogram: 'PL', name: 'Protolabs'}]}], {entities}));
  assert.equal(mono(v).length, 2, JSON.stringify(v.warnings));
  assert.match(mono(v)[0], /^slides\[0\]: monogram for Xometry/);
  assert.deepEqual(mono(validate(deck([{els: [{x: 60, y: 200, h: 24, logo: '', name: 'Acme Tools'}]}], {entities}))), [], 'an unlisted company may wear a monogram');
  assert.ok(validate(deck([{els: [{x: 60, y: 200, h: 24, logo: '', name: 'Xometry'}]}], {entities})).ok, 'a warning, not an error');
});

test('coverage: deck.entities must be a list of names; warnings fail only under --strict', () => {
  assert.ok(validate(deck([{els: three}], {entities: 'Xometry'})).errors.some(e => /entities/.test(e)));
  assert.ok(validate(deck([{els: three}], {entities: [['nTop', 3]]})).errors.some(e => /entities/.test(e)), 'an alias list holds names only');
  assert.deepEqual(validate(deck([{els: three}], {entities: ['Xometry', ['nTop', 'nTopology']]})).errors, []);
  const v = validate(deck([{els: three}]));
  assert.ok(v.ok, 'a warning is not an error');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-cov-')), 'model.json');
  fs.writeFileSync(f, JSON.stringify({w: 960, h: 540, slides: [{els: three}]}));
  assert.equal(spawnSync(process.execPath, [bin, f]).status, 0, 'the CLI passes a text-only slide');
  const strict = spawnSync(process.execPath, [bin, f, '--strict']);
  assert.equal(strict.status, 1, 'and fails it under --strict'); assert.match(String(strict.stderr), /text only/);
});

// K24: a logo is matched to its company through the deck.entities entry and its aliases — the asset id is compared as a slug
// ('#leo' is Leo AI, '#3dsystems' is 3D Systems), a logo row may say entity:'<name>' outright, a template's logo group carries
// alt. A company named only in the source line (the source slot, or a Caption in the foot band) needs no logo on the slide.
test('coverage: deck.entities (K24) — a logo matches its company through the entry and its aliases', () => {
  const entities = ['Leo AI', '3D Systems', ['nTop', 'nTopology'], 'Xometry'];
  const assets = {leo: PNG, '3dsystems': PNG, 'leo-ai': PNG, leopard: PNG, mark1: PNG, ntopology: PNG};
  const said = t => txt(300, t + ' The teams we met buy it this year.');   // a sentence, not a short listing
  const logo = (k, extra = {}) => ({x: 700, y: 60, h: 24, logo: '#' + k, ...extra});
  for (const [k, t] of [['leo', 'Leo AI drafts parts from a prompt.'], ['leo-ai', 'Leo AI drafts parts from a prompt.'], ['3dsystems', '3D Systems sells printers and software.'], ['ntopology', 'nTop ships implicit modeling.']])
    assert.deepEqual(prose(validate(deck([{els: [said(t), logo(k)]}], {entities, assets}))), [], `#${k} is the company's logo`);
  assert.equal(prose(validate(deck([{els: [said('Leo AI drafts parts from a prompt.'), logo('leopard')]}], {entities, assets}))).length, 1, '#leopard is not Leo AI');
  assert.deepEqual(prose(validate(deck([{els: [said('Leo AI drafts parts from a prompt.'), logo('mark1', {entity: 'Leo AI'})]}], {entities, assets}))), [], 'entity: declares whose logo it is');
  assert.deepEqual(prose(validate(deck([{els: [said('nTopology ships implicit modeling.'), logo('mark1', {entity: 'ntop'})]}], {entities, assets}))), [], 'entity: matches any alias, any case');
  assert.equal(prose(validate(deck([{els: [said('Leo AI drafts parts from a prompt.'), logo('leo', {entity: 'Xometry'})]}], {entities, assets}))).length, 1, 'entity: outranks the asset id');
  const stray = validate(deck([{els: [said('Leo AI drafts parts.'), logo('leo', {entity: 'Acme'})]}], {entities, assets}));
  assert.ok(stray.warnings.some(w => /entity "Acme"/.test(w) && /deck\.entities/.test(w)), stray.warnings.join(' | '));
  assert.ok(validate(deck([{els: [logo('leo', {entity: 7})]}], {assets})).errors.some(e => /entity must be/.test(e)));
});

test('coverage: deck.entities (K24) — a template logo group (kind logos) owns its companies by alt', () => {
  const entities = ['Leo AI', 'Xometry'], assets = {mark1: PNG, mark2: PNG};
  const d = deck([{template: 'exec-summary', fill: {l1: [{logo: '#mark1', aspect: 1, alt: 'Leo AI'}, {logo: '#mark2', aspect: 1, alt: 'Xometry'}]}, els: [txt(300, 'Leo AI and Xometry split the market.')]}], {entities, assets});
  assert.ok(d.slides[0].els.some(r => r.alt === 'Leo AI'), 'the group expands to logo rows carrying alt');
  assert.deepEqual(prose(validate(d)).filter(w => /Leo AI|Xometry/.test(w)), [], prose(validate(d)).join(' | '));
});

test('coverage: deck.entities (K24) — a company named only in the source line needs no logo', () => {
  const entities = ['Xometry', 'Protolabs'];
  const src = {slot: 'source', text: 'Source · Xometry and Protolabs pricing pages, Sep 2026'};
  const base = [txt(60, 'Quoting is consolidating', 'H1'), {x: 640, y: 140, w: 260, h: 160, img: PNG}];   // a figure far from the text rows
  assert.deepEqual(unlogoed(validate(deck([{layout: 'content', density: 'reading', els: [...base, src]}], {entities}))), [], 'the source slot is exempt');
  const caption = {x: 60, y: 490, w: 300, role: 'Caption', text: 'Source · Xometry pricing page'};
  assert.deepEqual(unlogoed(validate(deck([{els: [...base, caption]}], {entities}))), [], 'a Caption in the foot band is a source line');
  assert.equal(unlogoed(validate(deck([{els: [...base, {...caption, y: 360}]}], {entities}))).length, 1, 'a Caption up in the content area still names the company');
  assert.equal(unlogoed(validate(deck([{els: [...base, txt(360, 'Xometry buys demand with instant quotes and a partner network.')]}], {entities}))).length, 1, 'prose is still prose');
});
