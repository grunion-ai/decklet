// decklet suggest — "three numbers with movement" → the library layouts and templates that carry it, best first.
// Each candidate is scored by idf-weighted word overlap with its name, its own use/note text, and the SKILL.md routing table
// ("Picking a layout by what the content is"), read at run time so the router and the skill can never disagree.
import fs from 'node:fs';
import {LIBRARY} from './layouts.mjs';
import {TEMPLATE, templateKeys} from './templates.mjs';

const STOP = new Set('a an and are as at be by for from in into is it its of on or that the this to with what who whose'.split(' '));
const stem = w => w.length > 4 ? w.replace(/(ings?|ed|es|s)$/, '') : w;
const words = s => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w)).map(stem);

const skill = fs.readFileSync(new URL('../SKILL.md', import.meta.url), 'utf8');
const table = skill.slice(skill.indexOf("| the slide's content is"), skill.indexOf('\n\n', skill.indexOf("| the slide's content is")));
export const ROUTES = table.split('\n').slice(2).map(l => l.split('|').map(c => c.trim())).filter(c => c.length > 3)
  .map(c => ({phrase: c[1], layouts: [...c[2].matchAll(/`([\w-]+)`/g)].map(m => m[1])}));

const docs = [
  ...Object.entries(LIBRARY).map(([name, l]) => ({kind: 'layout', name, density: l.density, keys: Object.keys(l.slots || {}),
    text: [name, l.group, l.use, ...ROUTES.filter(r => r.layouts.includes(name)).flatMap(r => [r.phrase, r.phrase])].join(' ')})),
  ...Object.values(TEMPLATE).map(t => ({kind: 'template', name: t.id, density: t.density, keys: templateKeys(t.id).map(k => k.key),
    text: [t.id, t.name, t.cat, t.note].join(' ')})),
].map(d => ({...d, bag: words(d.text)}));
const df = new Map();
for (const d of docs) for (const w of new Set(d.bag)) df.set(w, (df.get(w) || 0) + 1);
const idf = w => Math.log(1 + docs.length / (df.get(w) || docs.length));

export function suggest(query, n = 5) {
  const q = new Set(words(query));
  return docs.map(d => ({d, score: d.bag.reduce((s, w) => s + (q.has(w) ? idf(w) : 0), 0) / Math.sqrt(d.bag.length)}))
    .sort((a, b) => b.score - a.score || (a.d.kind === 'layout' ? -1 : 1))
    .slice(0, n).map(({d, score}) => ({kind: d.kind, name: d.name, density: d.density, keys: d.keys, score: +score.toFixed(3)}));
}
