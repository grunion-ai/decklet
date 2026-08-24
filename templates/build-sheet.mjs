#!/usr/bin/env node
// build-sheet.mjs — every candidate template as one slide, for review.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES } from './index.mjs';
import { scale } from './kit.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const list = only ? TEMPLATES.filter(t => only.includes(t.id)) : TEMPLATES;
const k = 1;

const model = {
  title: 'decklet template candidates',
  w: 960, h: 540,
  styles: { margin: 60 },
  layouts: {
    title: { supertitle: { x: 60, y: 236, w: 840, role: 'Supertitle' }, title: { x: 60, y: 262, w: 840, role: 'Title' } },
    content: { supertitle: { x: 60, y: 52, w: 840, role: 'Supertitle' }, title: { x: 60, y: 76, w: 840, role: 'H1' } },
  },
  master: [ { id: 'foot', footer: 1, x: 60, y: 506, w: 340, role: 'Label', text: 'decklet candidates' } ],
  slides: list.map(t => ({
    name: t.id,
    layout: t.layout || undefined,
    hide: t.layout ? undefined : ['foot'],
    els: scale(t.els, k),
  })),
};
fs.writeFileSync(path.join(dir, 'candidates.model.json'), JSON.stringify(model, null, 1));
fs.writeFileSync(path.join(dir, 'candidates.index.json'), JSON.stringify(list.map(({ id, name, tier, cat, note }) => ({ id, name, tier, cat, note })), null, 1));
console.log(`${list.length} candidate slides → templates/candidates.model.json`);
