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

// ── S1. Density explains itself — the message names the rows it counted, so the fix is visible without reading the engine
test('density: the point message lists the rows it counted, one per point, and names the chrome it did not', () => {
  const s = {layout: 'two-cols', els: [
    {slot: 'title', text: 'Re-plan the quarter'},                       // H1 chrome — never a point
    {slot: 'caption', text: 'a caption'},                               // caption slot — chrome
    {slot: 'left', text: 'We moved the date to March'},
    {slot: 'right', text: 'The team stayed the same size'},
    {x: 60, y: 400, w: 400, role: 'Body', text: 'Spend held flat'},
    {x: 500, y: 400, w: 400, role: 'Body', text: 'Two hires slipped'},
  ]};
  const m = densityReport(s, LIBRARY, 'speaker');
  assert.match(m, /speaker density carries ≤ 3 points, this slide has 4/);
  // every counted row is listed as `role "the first few words"`, and exactly the counted ones
  const listed = (m.match(/points: ([^\n;]+)/) || [, ''])[1].split(' · ').filter(Boolean);
  assert.equal(listed.length, 4, 'four points counted, four rows listed: ' + m);
  for (const t of ['We moved the date', 'The team stayed', 'Spend held flat', 'Two hires slipped']) assert.ok(m.includes(t.slice(0, 17)), t + ' is listed: ' + m);
  assert.ok(!m.includes('Re-plan the quarter') && !m.includes('a caption'), 'chrome rows are not listed: ' + m);
  assert.match(m, /Supertitle · Title · H1 · Caption · Label/, 'the excluded chrome roles are named: ' + m);
});

test('density: the word message lists the same rows with their word counts, and says chrome counts here', () => {
  const s = {layout: 'quote', els: [{slot: 'quote', text: lorem(30)}, {slot: 'attribution', text: lorem(20)}]};
  const m = densityReport(s, LIBRARY, 'speaker');
  assert.match(m, /speaker density carries ≤ 40 words, this slide has 50/);
  assert.match(m, /words: /);
  assert.ok(/\b30\b/.test(m) && /\b20\b/.test(m), 'each listed row carries its own word count: ' + m);
  assert.match(m, /chrome/, 'the message says how chrome is treated: ' + m);
});

test('density: SKILL.md states the counting rule beside the table', () => {
  const doc = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  const sec = doc.slice(doc.indexOf('## DENSITY'), doc.indexOf('## GRAPHICS'));
  assert.match(sec, /counting rule/i, 'DENSITY states the rule by name');
  assert.match(sec, /Supertitle.*Title.*H1.*Caption.*Label/, 'the five chrome roles are named in DENSITY');
  assert.match(sec, /number/, 'the chrome slot list is complete (the `number` slot is chrome too)');
});
// ── K19. A summary or a number slide says less: reading density keeps 140 words for a slide that argues, and caps a slide
// whose content is an executive summary (kind: 'summary') or a number template (the Numbers shelf: stat rows, kpi, the
// proportional figures) lower. The CAD/DFM v2 deck carried 115 words on its summary and 88 on its market-size slide; Kyle
// read both as too much text, so the cap sits well under both.
test('density: reading caps summary and number slides lower; speaker is unchanged', () => {
  const r = DENSITY.reading.max;
  assert.ok(r.summary && r.numbers, 'reading names a summary cap and a numbers cap');
  assert.ok(r.summary < 88 && r.numbers < 88 && r.summary < r.words && r.numbers < r.words, 'both sit under the v2 slides (115, 88 words)');
  assert.deepEqual(DENSITY.speaker.max, {points: 3, words: 40}, 'speaker density is untouched');
});
const claim = extra => ({layout: 'content', ...extra, els: [{slot: 'supertitle', text: 'Summary'}, {slot: 'title', text: 'The market has no owner'},
  {slot: 'subtitle', text: 'One line'}, {slot: 'source', text: 'Source · filings'}, {x: 60, y: 200, w: 840, role: 'Body', text: lorem(70)}]});
test('density: a kind: summary slide over the summary cap warns, names the cap and the words it counted', () => {
  const r = v(deck([claim({kind: 'summary'})], {density: 'reading'}));
  const m = r.warnings.find(w => /summary/.test(w) && /words/.test(w));
  assert.ok(m, r.warnings.join(' | '));
  assert.match(m, new RegExp(`≤ ${DENSITY.reading.max.summary} words`)); assert.match(m, /this slide has 80/);
  assert.match(m, /Body "word0 word1/, 'the rows it counted are listed'); assert.match(m, /\b70\b/, 'with their counts');
  assert.ok(!v(deck([claim({})], {density: 'reading'})).warnings.some(w => /density carries/.test(w)), 'the same 80 words pass on an unmarked slide');
});
test('density: a number template slide is capped lower; a Stat-led free slide counts as one too', () => {
  const tpl = v(deck([{template: 'waffle', els: [{x: 60, y: 420, w: 840, role: 'Body', text: lorem(40)}]}], {density: 'reading'}));
  assert.ok(tpl.warnings.some(w => /number slide/.test(w) && /words/.test(w)), tpl.warnings.join(' | '));
  const stats = deck([{layout: 'content', els: [{slot: 'title', text: 'Market size'}, {slot: 'source', text: 'Source · analysts'},
    ...[0, 1, 2].map(k => ({x: 60 + k * 300, y: 200, w: 260, role: 'Stat', text: '$' + (k + 1) + 'B'})),
    {x: 60, y: 320, w: 840, role: 'Body', text: lorem(40)}, {x: 60, y: 380, w: 840, role: 'Body', text: lorem(30)}]}], {density: 'reading'});
  assert.ok(v(stats).warnings.some(w => /number slide/.test(w)), v(stats).warnings.join(' | '));
});
// K19 guard: a slide expanded from exec-summary IS a summary slide, before create expands it or after (create keeps the
// template id in name), so the reading cap for a summary applies without the author setting kind.
test('density: a slide from exec-summary is a summary slide — capped at the summary words at reading density', () => {
  const extra = {x: 60, y: 420, w: 840, role: 'Caption', text: lorem(30)};
  const model = () => deck([{template: 'exec-summary', els: [extra, {slot: 'source', text: 'Source · board pack'}]}], {density: 'reading'});
  for (const r of [v(model()), validate(create(model()).deck), validate(model())]) {   // after create, and before it expands
    const m = r.warnings.find(w => /summary slide/.test(w) && /words/.test(w));
    assert.ok(m, r.warnings.join(' | '));
    assert.match(m, new RegExp(`≤ ${DENSITY.reading.max.summary} words`));
  }
  const bare = v(deck([{template: 'exec-summary'}], {density: 'reading'}));
  assert.ok(!bare.warnings.some(w => /density carries/.test(w)), 'the sample itself fits the summary cap: ' + bare.warnings.join(' | '));
});
// #165: the cap counted the value and axis labels a template graphic draws, so a 26-word note had to shrink to 15 on a
// slide whose chart already carried the numbers. Those rows carry `graphic: 1` and the word count skips them, before
// create expands the slide, after it, and in the model read back from the deck file.
test('density: a template graphic\'s value and axis labels are not words — the cap counts the author\'s text', () => {
  const data = [{label: 'Farm sensors · 2026', value: 4.2, ring: 5.1, text: '$4.2–5.1B'}, {label: 'Farm software · 2026', value: 2.6, text: '$2.6B'},
    {label: 'Soil probes · 2026–30', value: 0.6, ring: 1.4, text: '$0.6B → $1.4B'}];
  const model = n => deck([{template: 'area-bubbles', fill: {t4: lorem(n), data}}], {density: 'reading'});
  const built = create(model(26)).deck;
  for (const r of [validate(model(26)), validate(built), validate(JSON.parse(JSON.stringify(built)))])
    assert.ok(!r.warnings.some(w => /density carries/.test(w)), 'a 26-word note fits beside the circles: ' + r.warnings.join(' | '));
  const labels = built.slides[0].els.filter(r => r.graphic);
  assert.deepEqual(labels.map(r => r.text), ['$4.2–5.1B', 'Farm sensors · 2026', '$2.6B', 'Farm software · 2026', '$0.6B → $1.4B', 'Soil probes · 2026–30'],
    'the value labels and the category labels, nothing the author wrote');
  const over = v(model(40)).warnings.find(w => /density carries/.test(w));
  assert.ok(over, 'the cap still binds the author\'s own words');
  assert.match(over, /this slide has 68/); assert.doesNotMatch(over, /Farm sensors|\$2\.6B/, 'the listing names only the rows it counted');
  const ranges = create(deck([{template: 'range-bar'}], {density: 'reading'})).deck.slides[0].els.filter(r => r.graphic).map(r => r.text);
  assert.ok(ranges.includes('2') && ranges.includes('Northwind Research') && ranges.includes('3.8–5.1'), 'axis ticks, row and value labels on range-bar too: ' + ranges);
});
test('density: kind is summary or nothing; a speaker summary keeps the speaker cap', () => {
  assert.ok(v(deck([claim({kind: 'sumary'})], {density: 'reading'})).errors.some(e => /kind/.test(e)));
  const rep = densityReport(claim({kind: 'summary'}), LIBRARY, 'speaker', 'summary');
  assert.match(rep, /speaker density carries ≤ 40 words/);
});
test('density: a separator is not a word — "·", "→" and "–" standing alone are not counted', () => {
  const m = densityReport({layout: 'quote', els: [{slot: 'quote', text: lorem(40) + ' · → –'}, {slot: 'attribution', text: 'a · b'}]}, LIBRARY, 'speaker');
  assert.match(m, /this slide has 42/);
});
