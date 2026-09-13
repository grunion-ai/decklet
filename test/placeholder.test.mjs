// A stand-in logo is a drawing aid. It may sit in a sample sheet (deck.draft) and never in a deck.
import test from 'node:test';
import assert from 'node:assert';
import {validate} from '../bin/validate.mjs';

const deck = (extra = {}, row = {}) => ({
  w: 960, h: 540,
  styles: {roles: {Label: {font: 'monospace', size: 11, lh: 14, weight: 500, color: '#000'}}},
  slides: [{name: 's', els: [{x: 60, y: 60, w: 120, h: 40, bg: '#333', placeholder: 'wordmark', ...row}]}],
  ...extra,
});

test('a placeholder mark is an error in a shipping deck', () => {
  const r = validate(deck());
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /placeholder mark "wordmark" may not ship/);
});

test('deck.draft downgrades it to ONE summary warning, so a sample sheet still builds', () => {
  const r = validate(deck({draft: 1}));
  assert.equal(r.errors.filter(e => /placeholder|stand-in/.test(e)).length, 0);
  const w = r.warnings.filter(x => /stand-in mark/.test(x));
  assert.equal(w.length, 1, 'one line for the sheet, not one per row');
  assert.match(w[0], /wordmark/);
});

test('a row without the prop is untouched', () => {
  const r = validate(deck({}, {placeholder: undefined}));
  assert.equal(r.errors.filter(e => /placeholder/.test(e)).length, 0);
});
