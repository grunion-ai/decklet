#!/usr/bin/env node
// build-options.mjs — the four option families as one review deck: flow, chrome, padding, quad.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOW, FLOW_BLOCKED, CHROME } from './options-sankey-chrome.mjs';
import { PAD, QUAD } from './options-pad-quad.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const FAMS = [
  ['Flow', 'Sankey and flow forms', FLOW.filter(t => !FLOW_BLOCKED.includes(t.id))],
  ['Chrome', 'Header and footer kits', CHROME],
  ['Padding', 'Inset and density', PAD],
  ['Quad', '2×2 and its relatives', QUAD],
];
const all = FAMS.flatMap(([, , list]) => list);

const model = {
  title: 'decklet options',
  w: 960, h: 540,
  styles: { margin: 60 },
  spell: { ignore: ['decklet', 'Northwind', 'Sankey', 'screenshotted'] },
  layouts: {
    title: { supertitle: { x: 60, y: 236, w: 840, role: 'Supertitle' }, title: { x: 60, y: 262, w: 840, role: 'Title' } },
    content: { supertitle: { x: 60, y: 52, w: 840, role: 'Supertitle' }, title: { x: 60, y: 76, w: 840, role: 'H1' } },
  },
  master: [{ id: 'foot', footer: 1, x: 60, y: 506, w: 340, role: 'Label', text: 'decklet options' }],
  slides: FAMS.flatMap(([fam, note, list]) => [
    { name: `divider-${fam.toLowerCase()}`, layout: 'title', hide: ['foot'],
      els: [{ slot: 'supertitle', text: `${list.length} options` }, { slot: 'title', text: note }] },
    ...list.map(t => ({ name: t.id, layout: t.layout || undefined, hide: t.hideFoot || !t.layout ? ['foot'] : undefined, els: t.els })),
  ]),
};
fs.writeFileSync(path.join(dir, 'options.model.json'), JSON.stringify(model, null, 1));
fs.writeFileSync(path.join(dir, 'options.index.json'), JSON.stringify(all.map(({ id, name, fam, note }) => ({ id, name, fam, note })), null, 1));
console.log(`${all.length} options across ${FAMS.length} families → templates/options.model.json`);
