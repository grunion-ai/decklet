// examples/styles — five style kits a user copies whole. Each is a complete STYLE CONTRACT (SKILL.md): the eight tokens,
// the eight roles as full treatments with a measured `cw`, fonts that are system stacks (one file, zero network), pad,
// margin and gap. The gate builds the explainer under every kit and refuses a kit the validator would.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {KITS} from '../examples/styles/index.mjs';
import {create} from '../bin/create.mjs';
import {validate, mergeStyle} from '../bin/validate.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export { KITS } from '../examples/styles/index.mjs';   // the shelf itself names its kits; this file gates them
const TOKENS = ['bg', 'fg', 'muted', 'accent', 'card', 'line', 'sel', 'box'];
const ROLES = ['Title', 'Supertitle', 'H1', 'H2', 'Body', 'Caption', 'Label', 'Stat'];
const kit = (n) => JSON.parse(fs.readFileSync(path.join(root, 'examples/styles', n, 'style.json'), 'utf8'));
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

test('styles: every kit exists and each is a complete STYLE CONTRACT', () => {
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

test('styles: the kits differ — face, scale, ground and inset all vary', () => {
  const kits = KITS.map(kit), n = kits.length;
  const spread = (f) => new Set(kits.map(f)).size;
  assert.ok(spread(s => s.roles.Title.font) >= Math.ceil(n * 2 / 3), `distinct display faces across ${n} kits`);
  assert.ok(spread(s => s.roles.Body.font) >= 5, 'at least five distinct body faces');
  // the 2026-09-13 complaint: five kits that changed the ink and the face but wore ONE scale — Title 56–66, Stat 40,
  // margin 60 on every one. A kit is a scale as much as a palette, so the spread is gated.
  assert.ok(spread(s => s.roles.Title.size) >= 8, 'at least eight distinct Title sizes');
  assert.ok(spread(s => s.roles.Stat.size) >= 6, 'at least six distinct Stat sizes');
  assert.ok(spread(s => s.margin) >= 5, 'at least five distinct content insets');
  assert.ok(spread(s => s.gap) >= 2, 'the air between rows varies');
  assert.equal(spread(s => JSON.stringify(s.tokens)), n, 'no two kits share a palette');
  assert.ok(spread(s => s.tokens.accent) === n, 'every kit has its own accent');
  const dark = kits.filter(s => lum(s.tokens.card) < 0.3).length;
  assert.ok(dark >= n / 3 && dark <= n * 2 / 3, `dark and light grounds both represented (${dark} dark of ${n})`);
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
