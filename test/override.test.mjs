// a slide-local override of a master row is a partial row — `{override:'foot', text:'…'}` — and reads everything else,
// the role included, from the master. validate must not demand a role it can already see.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
const v = m => validate(create(m).deck);   // the neutral roles filled in, as create judges it
test('validate: a partial override row inherits the master row\'s role', () => {
  const deck = {w: 960, h: 540, master: [{id: 'foot', footer: 1, x: 60, y: 506, w: 340, role: 'Label', text: 'deck'}],
    slides: [{els: [{x: 60, y: 60, w: 800, role: 'H1', text: 'a'}, {override: 'foot', text: 'this slide only'}]}]};
  assert.deepEqual(v(deck).errors, []);
  const bad = {...deck, slides: [{els: [{override: 'nope', text: 'x'}]}]};
  assert.ok(v(bad).errors.some(e => /override "nope" is not a master id/.test(e)));
});
