// The sheet's closing "Styles" section: six slides (cover, statement, table, chart, process, end) repeated under the five
// kits in examples/styles. A decklet style is deck-wide, so a slide wears its kit through PREFIXED tokens
// (`var(--warm-accent)`) and a backdrop row in the kit's card colour — the harness diagram-showcase pattern — while the
// kit's weight and case land per row. templates/candidates.style.json carries the neutral tokens plus every prefixed set.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {KITS} from './styles.test.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIX = ['cover-hero', 'statement', 'benchmark-table', 'chart-column', 'process-flow-4', 'closing-cta'];
const BARE = /var\(--(fg|muted|accent|card|box|line)\)/;
const read = f => JSON.parse(fs.readFileSync(path.join(root, 'templates', f), 'utf8'));

test('sheet: a Styles divider opens thirty slides — the six under every kit, backdrop first, every token prefixed', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'templates/build-sheet.mjs')], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  const model = read('candidates.model.json'), index = read('candidates.index.json'), style = read('candidates.style.json');
  const names = model.slides.map(s => s.name);
  const at = names.indexOf('kind-styles');
  assert.ok(at > 0, 'a kind-styles divider');
  assert.deepEqual(names.slice(at + 1), KITS.flatMap(k => SIX.map(t => `style-${k}-${t}`)), 'thirty style slides close the deck, six per kit in order');
  for (const k of KITS) for (const t of SIX) {
    const s = model.slides.find(x => x.name === `style-${k}-${t}`), where = s.name;
    assert.deepEqual(s.els[0], {x: 0, y: 0, w: 960, h: 540, bg: `var(--${k}-card)`, over: 1}, `${where}: the backdrop is the first row`);
    for (const [i, e] of s.els.entries()) {
      for (const [p, v] of Object.entries(e)) if (typeof v === 'string') assert.doesNotMatch(v, BARE, `${where}: els[${i}].${p} "${v}" still names a deck token`);
      if (e.text != null || e.html != null) assert.match(e.color || '', new RegExp(`^var\\(--${k}-(fg|muted|accent|card)\\)$`), `${where}: els[${i}] text carries the kit's colour`);
      if (e.tile) assert.equal(e.bg, `var(--${k}-card)`, `${where}: els[${i}] tile wears the kit's card`);
      if (e.box) assert.equal(e.bg, `var(--${k}-box)`, `${where}: els[${i}] box wears the kit's box fill`);
    }
    const foot = s.els.find(e => e.override === 'foot');
    assert.deepEqual(foot, {override: 'foot', text: `style · ${k} · ${t}`, color: `var(--${k}-muted)`}, `${where}: the L4 foot line names the kit and the template, in the kit's muted ink, nothing else`);
    assert.equal(s.hide, undefined, `${where}: the foot shows on every styled slide`);
  }
  // type varies where the contract lets it: the kit's weight lands on the row; its case only when the kit cut that role at
  // the sheet's size (graphite-amber's caps Title is 56px — at the sheet's 64 the cover headline wrapped into the body)
  const title = k => model.slides.find(x => x.name === `style-${k}-cover-hero`).els.find(e => e.slot === 'title');
  assert.equal(title('warm').weight, 700, 'warm cuts its Title at 700 against the neutral 800');
  assert.equal(title('graphite-amber').tt, undefined, 'caps stay with the size they were cut for');
  // the sheet style: the neutral eight, then six prefixed tokens per kit with the kit's values
  for (const k of ['bg', 'fg', 'muted', 'accent', 'card', 'line', 'sel', 'box']) assert.match(style.tokens[k], /^#/, `neutral ${k}`);
  for (const k of KITS) {
    const kit = JSON.parse(fs.readFileSync(path.join(root, 'examples/styles', k, 'style.json'), 'utf8'));
    for (const t of ['fg', 'muted', 'accent', 'card', 'box', 'line']) assert.equal(style.tokens[`${k}-${t}`], kit.tokens[t], `${k}-${t}`);
  }
  const rows = index.filter(r => r.kind === 'styles');
  assert.equal(rows.length, 30);
  assert.deepEqual(rows.map(r => r.source), Array(30).fill('style'));
  assert.deepEqual(rows.map(r => `${r.style}/${r.id}`), KITS.flatMap(k => SIX.map(t => `${k}/${t}`)));
});
