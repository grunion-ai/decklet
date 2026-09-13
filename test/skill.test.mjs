// decklet doc-split gate (ROADMAP U7) — SKILL.md is the authoring path and nothing else. The editor reference, the chart
// row, the connector shapes, the figures and the worked examples live under docs/ and are LINKED from it, so an agent
// reads ~7,000 words to build a deck and follows one link when it needs the rest. A section that walks off without a
// link is the failure this gate exists to catch.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const words = f => read(f).split(/\s+/).filter(Boolean).length;

const BUDGET = 7000;   // the study's four subjects read all of it once; 11,256 was about 40% more than authoring needs

test('skill: SKILL.md stays inside the authoring budget', () => {
  const n = words('SKILL.md');
  assert.ok(n <= BUDGET, `SKILL.md is ${n} words (budget ${BUDGET}) — move a reference to docs/ instead of growing it`);
});

test('skill: every docs/ reference exists and is linked from SKILL.md', () => {
  const doc = read('SKILL.md');
  for (const f of ['editor.md', 'charts.md', 'connectors.md', 'figures.md', 'examples.md', 'import-html.md', 'verify.md']) {
    assert.ok(fs.existsSync(path.join(root, 'docs', f)), 'docs/' + f + ' exists');
    assert.ok(doc.includes(`(docs/${f})`), 'SKILL.md links docs/' + f);
    assert.ok(words('docs/' + f) > 80, 'docs/' + f + ' carries the text, not a stub');
  }
});

test('skill: the moved rules are still written down somewhere', () => {
  const editor = read('docs/editor.md');
  for (const re of [/File System Access/, /amber/, /⌘S/, /Versions:/, /contact sheet/i, /Report a bug/, /prefers-reduced-motion/, /bin\/edits\.mjs/]) assert.match(editor, re, 'editor: ' + re);
  for (const re of [/start at zero/, /max label/, /[Dd]irect value labels/, /dashed/, /60%/, /annotations/]) assert.match(read('docs/charts.md'), re, 'charts: ' + re);
  for (const re of [/orthogonal/, /96px/, /control point/i, /fan-out/i, /waive/]) assert.match(read('docs/connectors.md'), re, 'connectors: ' + re);
  for (const re of [/diagramSlide/, /figure-decision/, /figure-layers/, /fits\(run, text\)/, /Y\(tops\)/]) assert.match(read('docs/figures.md'), re, 'figures: ' + re);
  assert.match(read('docs/import-html.md'), /import-html\.mjs/);
  const verify = read('docs/verify.md');
  for (const re of [/ink through text/, /straddling a container/, /arrow head inside a fill/, /text over text/, /occlusion/, /Containment is not collision/, /## Thresholds/, /0 errors \(0 warnings with `--strict`\)/, /< 0\.5%/]) assert.match(verify, re, 'verify: ' + re);
  for (const re of [/quarterly-update/, /launch-carousel/, /one-pager/]) assert.match(read('docs/examples.md'), re, 'examples: ' + re);
});

test('skill: SKILL.md keeps the authoring rules the split must not take with it', () => {
  const doc = read('SKILL.md');
  assert.match(doc, /rise.*fade.*pop.*wipe/s, 'the four motion words');
  assert.match(doc, /Entry only/, 'and the entry rule');
  assert.match(doc, /A template carries its own density and \*\*overrides the deck's\*\*/, 'DENSITY states the override (U7.2)');
  assert.match(doc.slice(doc.indexOf('## TEMPLATE LIBRARY')), /is \*\*reading\*\*/, 'TEMPLATE LIBRARY says which templates are reading (U7.2)');
  assert.match(doc, /\| `slides` \|/, 'the formats table shows the supported format');
  assert.ok(/[Ee]ight more are \*\*experimental\*\*/.test(doc), 'and names the experimental rest in one line');
  assert.ok(!/^## (CHART ROW|CONNECTORS|GIFS AND IMAGES)/m.test(doc), 'the moved sections are gone from SKILL.md');
  assert.match(doc, /an animated GIF plays as-is/, 'the GIF rule folded into GRAPHICS');
});

test('skill: README, llms.txt and the package manifest name the docs set', () => {
  assert.match(read('README.md'), /docs\/editor\.md/, 'README points at the editor reference');
  assert.match(read('llms.txt'), /docs\/editor\.md/, 'llms.txt lists it');
  assert.ok(JSON.parse(read('package.json')).files.includes('docs'), 'docs/ ships in the package');
});
