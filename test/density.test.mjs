// decklet density gate — two named densities, defined in the engine so an agent asked for a "dense" or a "fluffy"
// deck builds the same thing every time. `speaker` (fluffy): one idea, ≤ 3 points, big type, the presenter carries the
// rest. `reading` (dense): a leave-behind — subtitle under the title, a note/description, a source line, a legend, the
// footer carrying the deck name; the slide stands without a speaker. Every content layout carries the dense chrome slots
// (subtitle · note · source · legend); a deck says `density` and validate tells the builder where a slide misses it.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {LIBRARY, DENSITY, DENSE, densityReport} from '../lib/layouts.mjs';
import {TEMPLATES} from '../lib/templates.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const v = m => validate(create(m).deck);   // validate what create() judges: the neutral roles filled in
const deck = (slides, extra = {}) => ({w: 960, h: 540, title: 'dens', ...extra, slides});
const lorem = n => Array.from({length: n}, (_, i) => 'word' + i).join(' ');

test('density: the two definitions are data — name, what the slide carries, the budgets', () => {
  for (const k of ['speaker', 'reading']) {
    const d = DENSITY[k];
    assert.ok(d.aka && d.for && d.carries && d.max, k + ' is defined');
    assert.ok(typeof d.max.points === 'number' && typeof d.max.words === 'number', k + ' budgets are numbers');
  }
  assert.equal(DENSITY.speaker.aka, 'fluffy'); assert.equal(DENSITY.reading.aka, 'dense');
  assert.ok(DENSITY.speaker.max.points < DENSITY.reading.max.points && DENSITY.speaker.max.words < DENSITY.reading.max.words);
});

test('density: every library layout with title chrome carries the four dense slots; DENSE names them', () => {
  assert.deepEqual(Object.keys(DENSE), ['subtitle', 'note', 'source', 'legend']);
  for (const [name, lay] of Object.entries(LIBRARY)) {
    if (!lay.slots.title || lay.slots.title.role !== 'H1') continue;
    for (const k of Object.keys(DENSE)) assert.ok(lay.slots[k] || (lay.dense && lay.dense[k] === false), `${name}.${k}: present, or declared false`);
    if (lay.slots.subtitle) assert.equal(lay.slots.subtitle.role, 'H2'); if (lay.slots.source) assert.equal(lay.slots.source.role, 'Caption');
    if (lay.slots.legend) { assert.equal(lay.slots.legend.role, 'Label'); assert.ok(lay.slots.legend.right != null, name + ': the legend hangs on the right margin'); }
  }
  for (const t of TEMPLATES) assert.ok(['speaker', 'reading'].includes(t.density), t.id);
});

test('density: a reading deck warns on a content slide that binds none of the dense chrome; binding subtitle+source clears it', () => {
  const bare = deck([{layout: 'chart', els: [{slot: 'supertitle', text: 'Q3'}, {slot: 'title', text: 'Growth held.'}, {slot: 'takeaway', text: 'up'}]}], {density: 'reading'});
  const r = v(bare);
  assert.ok(r.warnings.some(m => /reading density/.test(m) && /subtitle|note|source|legend/.test(m)), r.warnings.join(' | '));
  const dense = deck([{layout: 'chart', els: [{slot: 'supertitle', text: 'Q3'}, {slot: 'title', text: 'Growth held.'}, {slot: 'subtitle', text: 'Four numbers, one story'},
    {slot: 'takeaway', text: 'up'}, {slot: 'source', text: 'Source: ledger, 2026-09'}]}], {density: 'reading'});
  assert.ok(!v(dense).warnings.some(m => /reading density/.test(m)));
});

test('density: a speaker deck warns past three points or the word budget; a template slide inherits its own density', () => {
  const busy = deck([{layout: 'two-cols', els: [{slot: 'title', text: 'T'}, {slot: 'left', text: lorem(30)}, {slot: 'right', text: lorem(30)},
    {x: 60, y: 400, w: 400, role: 'Body', text: 'four'}, {x: 500, y: 400, w: 400, role: 'Body', text: 'five'}]}], {density: 'speaker'});
  const r = v(busy);
  assert.ok(r.warnings.some(m => /speaker density/.test(m) && /(points|words)/.test(m)), r.warnings.join(' | '));
  const rep = densityReport({layout: 'fact', els: [{slot: 'stat', text: '63%'}, {slot: 'label', text: 'parsed clean'}, {slot: 'body', text: 'one line'}]}, LIBRARY, 'speaker');
  assert.equal(rep, null, 'a speaker fact is within budget');
});

test('density: an unknown density is an error; SKILL.md defines both by name and alias', () => {
  assert.ok(v(deck([{els: [{x: 60, y: 60, w: 800, role: 'H1', text: 'x'}]}], {density: 'medium'})).errors.some(m => /density "medium"/.test(m)));
  const doc = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  assert.match(doc, /## DENSITY/); assert.match(doc, /fluffy/); assert.match(doc, /dense/); assert.match(doc, /`speaker`/); assert.match(doc, /`reading`/);
  for (const k of ['subtitle', 'note', 'source', 'legend']) assert.match(doc, new RegExp('`' + k + '`'), k);
});
