// examples/styles — five style kits a user copies whole. Each is a complete STYLE CONTRACT (SKILL.md): the eight tokens,
// the eight roles as full treatments with a measured `cw`, fonts that are system stacks (one file, zero network), pad,
// margin and gap. The gate builds the explainer under every kit and refuses a kit the validator would.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {create} from '../bin/create.mjs';
import {validate, mergeStyle} from '../bin/validate.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KITS = ['warm', 'dark', 'graphite-amber', 'navy-blue', 'display'];
const TOKENS = ['bg', 'fg', 'muted', 'accent', 'card', 'line', 'sel', 'box'];
const ROLES = ['Title', 'Supertitle', 'H1', 'H2', 'Body', 'Caption', 'Label', 'Stat'];
const kit = (n) => JSON.parse(fs.readFileSync(path.join(root, 'examples/styles', n, 'style.json'), 'utf8'));
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

test('styles: the five kits exist and each is a complete STYLE CONTRACT', () => {
  for (const n of KITS) {
    const s = kit(n), where = `examples/styles/${n}`;
    assert.deepEqual(Object.keys(s.tokens).sort(), [...TOKENS].sort(), `${where}: the eight tokens, no more`);
    for (const [k, v] of Object.entries(s.tokens)) assert.match(v, /^#[0-9a-f]{6}$/i, `${where}: token ${k} is a hex colour`);
    const roles = Object.keys(s.roles).filter(r => r !== 'Stat2');
    assert.deepEqual(roles.sort(), [...ROLES].sort(), `${where}: exactly the eight roles (Stat2 optional)`);
    for (const [r, t] of Object.entries(s.roles)) {
      for (const k of ['size', 'weight', 'lh', 'ls', 'cw']) assert.equal(typeof t[k], 'number', `${where}: role ${r} carries ${k}`);
      assert.ok(t.cw > 0.3 && t.cw < 0.9, `${where}: role ${r} cw ${t.cw} is a measured glyph width in em`);
      assert.match(t.color, /^var\(--(fg|muted|accent)\)$/, `${where}: role ${r} colours through a token`);
      assert.match(t.font, /,\s*(serif|sans-serif|monospace)$/, `${where}: role ${r} font "${t.font}" ends in a generic family`);
      assert.ok(t.font.split(',').length >= 2, `${where}: role ${r} font has a fallback stack`);
    }
    assert.match(s.roles.Label.font, /mono/i, `${where}: Label is the mono role`);
    assert.equal(typeof s.pad.chip, 'string'); assert.equal(typeof s.pad.pill, 'string');
    assert.equal(typeof s.margin, 'number'); assert.equal(typeof s.gap, 'number');
    const raw = fs.readFileSync(path.join(root, 'examples/styles', n, 'style.json'), 'utf8');
    assert.doesNotMatch(raw, /url\(|https?:|@import|@font-face/i, `${where}: a kit loads nothing — fonts are system stacks`);
  }
});

test('styles: the kits differ — type and ground vary across the five', () => {
  const kits = KITS.map(kit);
  assert.ok(new Set(kits.map(s => s.roles.Title.font)).size >= 4, 'at least four distinct display faces');
  assert.ok(new Set(kits.map(s => s.roles.Body.font)).size >= 3, 'at least three distinct body faces');
  const dark = kits.filter(s => lum(s.tokens.card) < 0.3).length;
  assert.ok(dark >= 2 && dark <= 3, `dark and light grounds both represented (${dark} dark of 5)`);
});

test('styles: the explainer validates with zero errors and builds under every kit', () => {
  const model = JSON.parse(fs.readFileSync(path.join(root, 'examples/explainer/model.json'), 'utf8'));
  for (const n of KITS) {
    const s = kit(n);
    const v = validate(mergeStyle(structuredClone(model), s));
    assert.deepEqual(v.errors, [], `examples/styles/${n}: explainer validates`);
    const {html, deck} = create(model, {style: s, title: `explainer · ${n}`});
    for (const k of TOKENS) assert.ok(html.includes(`--${k}:${s.tokens[k]}`), `examples/styles/${n}: token ${k} reaches the file`);
    assert.equal(deck.styles.roles.Title.font, s.roles.Title.font, `examples/styles/${n}: the kit's roles are the deck's`);
    assert.doesNotMatch(html, /@import|<link[^>]+stylesheet|fonts\.googleapis/i, `examples/styles/${n}: no webfont`);
  }
});
