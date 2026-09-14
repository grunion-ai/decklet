#!/usr/bin/env node
// decklet new — the starter model. Every run of the parity study hand-assembled the deck's top level, and the first
// validate of the study was an error on deck.w in four runs out of four. This writes that top level once, correctly:
// format, canvas, styles.margin, one right-anchored master footer, and a run of slides that climbs the shape ladder
// the study's best decks climbed. What comes out passes `validate --strict` and `verify --strict` untouched, so the
// author's first loop is replacing placeholder copy rather than debugging geometry.
//
// usage: node bin/new.mjs --out model.json [--slides 8] [--density reading|speaker] [--style <kit>] [--space WxH]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {diagramSlide} from '../lib/diagram.mjs';
import KITS from '../examples/styles/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CO = 'Meridian Freight';                 // fictional: no client residue in anything this writes
const MARK = 'PLACEHOLDER';

// The ladder, in narrative order. `rank` is the order rungs are taken as --slides grows, so a three-slide deck gets the
// numbers page and an eight-slide deck gets the study's own run: opener · agenda · stats · chart · process · figure ·
// comparison · close. Every rung builds its whole slide, because the answer to "does this shape survive speaker
// density" differs per shape: reading carries ≤ 8 points and ≤ 140 words, speaker ≤ 3 and ≤ 40 (lib/layouts.mjs).
const RUNGS = [
  {rank: 6, build: d => ({name: 'agenda', layout: 'agenda', els: [
    {slot: 'supertitle', text: 'AGENDA'},
    {slot: 'title', text: 'Replace with what the deck covers.'},
    ...items(d === 'speaker' ? 3 : 5).flatMap(([n, i]) => [
      {slot: 'n' + i, text: n}, {slot: 'item' + i, text: d === 'speaker' ? `Replace · section ${i}` : `Replace · section ${i} in five words`}]),
    // the dense slot bound here is `note`, not `subtitle`: a kit with a tall H1 leading (ocean-ember, lh 44) puts the
    // title box within 2px of the subtitle's y on the library's chrome pitch, and a starter must be clean on every kit
    ...(d === 'speaker' ? [] : [{slot: 'note', text: 'Replace with the one sentence that frames the list.'}]),
  ]})},
  {rank: 7, build: d => ({name: 'points', layout: 'bullets', els: [
    {slot: 'supertitle', text: 'POINTS'},
    {slot: 'title', text: 'Replace with the claim these points carry.'},
    ...items(d === 'speaker' ? 3 : 5).map(([, i]) => ({slot: 'b' + i, text: d === 'speaker' ? `Replace · point ${i}` : `Replace · point ${i}, one line, no number`})),
    ...(d === 'speaker' ? [] : [{slot: 'note', text: 'Replace with what a reader should make of the list.'}]),
  ]})},
  {rank: 1, build: d => ({name: 'numbers', layout: 'kpi-grid', els: [
    {slot: 'supertitle', text: 'NUMBERS'},
    {slot: 'title', text: 'Replace with what the numbers say.'},
    ...[1, 2, 3].flatMap(i => [
      {slot: 'kpi' + i, text: '00'},
      {slot: 'kpi' + i + '-label', text: `Replace · metric ${i}`},
      {slot: 'kpi' + i + '-delta', text: '± 0'}]),
    ...(d === 'speaker' ? [] : [
      {slot: 'body', text: 'Replace with the reading of the three tiles — one sentence, not a repeat of the labels.'},
      {slot: 'source', text: `${MARK} · name the source`}]),
  ]})},
  {rank: 2, build: d => ({name: 'trend', layout: 'chart', els: [
    {slot: 'supertitle', text: 'TREND'},
    {slot: 'title', text: 'Replace with what the series shows.'},
    {slot: 'chart', chart: {mark: 'bar', data: [
      {label: 'One', value: 10}, {label: 'Two', value: 20}, {label: 'Three', value: 30}, {label: 'Four', value: 40}]}},
    {slot: 'takeaway', text: 'Replace with the takeaway. The bars above are a placeholder ramp, not data.'},
    ...(d === 'speaker' ? [] : [{slot: 'source', text: `${MARK} · name the source`}]),
  ]})},
  {rank: 3, build: d => ({name: 'process', layout: 'process-steps', els: [
    {slot: 'supertitle', text: 'PROCESS'},
    {slot: 'title', text: 'Replace with the name of the process.'},
    ...items(d === 'speaker' ? 3 : 4).flatMap(([n, i]) => [
      {slot: 'n' + i, text: n}, {slot: 'step' + i, text: d === 'speaker' ? `Replace · step ${i}` : `Replace · step ${i}, what happens and who does it`}]),
    ...(d === 'speaker' ? [] : [{slot: 'note', text: 'Replace with where the process breaks today.'}]),
  ]})},
  // the figure goes through the spec API, so the connectors are routed by the engine rather than drawn by hand.
  // 840×320 is the `diagram` frame 1:1 — the spec's own canvas, which every node's x/y/w/h is written on.
  {rank: 4, build: () => diagramSlide({w: 840, h: 320, label: 'Replace · what this figure claims', nodes: [
    {id: 'a', x: 8, y: 120, w: 200, h: 60, title: 'Replace A', sub: 'placeholder node'},
    {id: 'b', x: 320, y: 120, w: 200, h: 60, title: 'Replace B', sub: 'placeholder node'},
    {id: 'c', x: 632, y: 120, w: 200, h: 60, title: 'Replace C', sub: 'placeholder node', state: 'chosen'},
  ], edges: [{from: 'a', to: 'b'}, {from: 'b', to: 'c', state: 'chosen'}]}, {
    name: 'figure', supertitle: 'FIGURE', title: 'Replace with the name of the figure.',
    caption: 'Replace with the sentence this figure proves.'})},
  {rank: 5, build: d => ({name: 'options', layout: 'comparison', els: [
    {slot: 'supertitle', text: 'OPTIONS'},
    {slot: 'title', text: 'Replace with the choice being made.'},
    {slot: 'left-head', text: 'Replace · option A'},
    {slot: 'right-head', text: 'Replace · option B'},
    ...(d === 'speaker' ? [] : [
      {slot: 'left', text: 'Replace with what option A costs and buys. Two lines at most.'},
      {slot: 'right', text: 'Replace with what option B costs and buys. Two lines at most.'},
      {slot: 'source', text: `${MARK} · name the source`}]),
  ]})},
  {rank: 8, build: d => ({name: 'timeline', layout: 'timeline', els: [
    {slot: 'supertitle', text: 'TIMELINE'},
    {slot: 'title', text: 'Replace with what the dates lead to.'},
    {slot: 'rule'},
    ...items(d === 'speaker' ? 3 : 4).flatMap(([, i]) => [
      {slot: 'd' + i}, {slot: 't' + i, text: `Q${i}`}, {slot: 'e' + i, text: `Replace · milestone ${i}`}]),
    ...(d === 'speaker' ? [] : [{slot: 'note', text: 'Replace with what has to be true by the last date.'}]),
  ]})},
  {rank: 9, build: d => ({name: 'cards', layout: 'three-up-cards', els: [
    {slot: 'supertitle', text: 'CARDS'},
    {slot: 'title', text: 'Replace with what the three cards have in common.'},
    // the tile is a paint slot: bind it as well as its text, and before it, or the words sit on an empty canvas
    ...[1, 2, 3].flatMap(i => [
      {slot: `card${i}`},
      {slot: `card${i}-number`, text: String(i).padStart(2, '0')},
      {slot: `card${i}-head`, text: `Replace · card ${i}`},
      ...(d === 'speaker' ? [] : [
        {slot: `card${i}-rule`},
        {slot: `card${i}-body`, text: `Replace · what card ${i} gives the reader, two lines at most.`}]),
    ]),
    ...(d === 'speaker' ? [] : [{slot: 'source', text: `${MARK} · name the source`}]),
  ]})},
  {rank: 10, build: () => ({name: 'claim', layout: 'statement', els: [
    {slot: 'title', text: 'Replace with the one\nclaim of the deck.'},
    {slot: 'caption', text: `${MARK} · one claim, display type, nothing else on the slide`},
  ]})},
];
const items = n => Array.from({length: n}, (_, k) => [String(k + 1).padStart(2, '0'), k + 1]);

export const COVER = () => ({name: 'cover', layout: 'cover', els: [
  {slot: 'supertitle', text: `${CO.toUpperCase()} · ${MARK} DECK`},
  {slot: 'title', text: 'Replace with the deck\'s one-line promise.'},
  {slot: 'body', text: 'Replace with who this is for and what they get.'},
  {slot: 'caption', text: 'Replace · presenter, audience, date'},
]});
export const CLOSE = () => ({name: 'close', layout: 'end', els: [
  {slot: 'title', text: 'Replace with the ask.'},
  {slot: 'body', text: 'Replace with the one next step, and who takes it.'},
  {slot: 'caption', text: `${MARK} · how to reach you`},
]});

export const MAX = RUNGS.length + 2, MIN = 3;

// the run of slides for n at this density: the opener, the first n-2 rungs by rank in narrative order, the close
export function run(n, density) {
  const take = RUNGS.filter(r => r.rank <= n - 2);
  return [COVER(), ...take.map(r => r.build(density)), CLOSE()];
}

export function newModel({slides = 8, density = 'reading', space = null} = {}) {
  const [w, h] = space ? space.split('x').map(Number) : [960, 540];
  return {
    title: `${CO} — ${MARK} deck`,
    format: 'slides', w, h, density,
    styles: {margin: 60},
    // Master discipline (SKILL.md): one master row carries footer:1 and the engine draws the page counter with it.
    // Right-anchored with w:'auto' is the anchoring that passes --strict; never type "3 / 9" into a row.
    master: [{id: 'foot', footer: 1, right: 60, y: h - 34, w: 'auto', role: 'Label', nowrap: 1, text: `${CO} · ${MARK}`}],
    slides: run(slides, density),
  };
}

// The coverage manifest docs/building.md asks for, written empty: the author fills a line per must-include before the
// model, which is the practice that took the study's worst deck from 0.691 to 0.944.
export function manifest({slides, density, style, layouts}) {
  return `# Coverage manifest

Fill this in **before** you touch the model. It is step 1 of the build loop
([docs/building.md](https://github.com/grunion-ai/decklet/blob/main/docs/building.md)), and the second pass ticks it
against the rendered PNGs: a line with no PNG is a missing item.

- **The brief's slide count is the deck's slide count.** ${slides} slides here — change the number in both places at once.
- **Every number in the brief gets a manifest line and a slide.** Write a derived number's arithmetic beside it
  (\`0.65 × 14 + 0.35 × 23 = 17.15\`), so the second pass checks a computation rather than re-doing it.

Deck: ${slides} slides · ${density} density · style ${style || 'none (the template\'s neutral roles)'}

| Must-include | Slide | Shape | Checked |
| --- | --- | --- | --- |
${layouts.map((l, i) => `|  | ${i + 1} | ${l} |  |`).join('\n')}
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), o = {};
  for (let k = 0; k < a.length; k++) if (a[k].startsWith('--')) o[a[k].slice(2)] = a[k + 1] && !a[k + 1].startsWith('--') ? a[++k] : true;
  const die = m => { console.error(m); process.exit(2); };
  if (!o.out) die('usage: node bin/new.mjs --out model.json [--slides 8] [--density reading|speaker] [--style <kit>] [--space WxH]');
  const slides = o.slides == null ? 8 : Number(o.slides);
  if (!Number.isInteger(slides) || slides < MIN || slides > MAX) die(`--slides must be ${MIN}..${MAX} — the shape ladder has ${MAX} rungs, and a deck that repeats a layout is worse than a shorter one`);
  const density = o.density == null ? 'reading' : String(o.density);
  if (!['reading', 'speaker'].includes(density)) die('--density must be reading or speaker');
  if (o.style && !KITS.includes(o.style)) die(`--style "${o.style}" is not on the shelf: ${KITS.join(', ')}`);
  if (o.space && !/^\d+x\d+$/.test(o.space)) die('--space must be WxH, e.g. 960x540');

  const dir = path.dirname(path.resolve(o.out));
  const model = newModel({slides, density, space: o.space || null});
  fs.writeFileSync(o.out, JSON.stringify(model, null, 2) + '\n');
  const man = path.join(dir, 'MANIFEST.md');
  fs.writeFileSync(man, manifest({slides, density, style: o.style || null, layouts: model.slides.map(s => s.layout)}));
  const wrote = [o.out, man];
  if (o.style) {
    const s = path.join(dir, 'style.json');
    fs.copyFileSync(path.join(root, 'examples/styles', o.style, 'style.json'), s);
    wrote.push(s);
  }
  const style = o.style ? ` --style ${path.relative(process.cwd(), path.join(dir, 'style.json'))}` : '';
  console.log(`wrote ${wrote.map(f => path.relative(process.cwd(), f)).join(' · ')} — ${slides} slides, ${density} density`);
  console.log(`next: fill MANIFEST.md, then node bin/validate.mjs ${path.relative(process.cwd(), o.out)}${style} --strict`);
}
