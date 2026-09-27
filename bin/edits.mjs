#!/usr/bin/env node
// decklet edits — what the human changed in a deck file. Read it BEFORE regenerating a deck, so the revision keeps their work.
// usage: node bin/edits.mjs deck.html [--json]
// prints: deck id + rev, every logged edit (slide/row, keys before → after, conflicts the last migrate kept, and edits a hosted page yielded to the agent)
import fs from 'node:fs';
import {blockOf} from '../lib/edits.mjs';
import {isMain} from '../lib/is-main.mjs';

export function edits(html) {
  const deck = blockOf(html, 'DECK'), log = blockOf(html, 'LOG');
  return {id: deck.id, rev: deck.rev, title: deck.title, log};
}
const J = v => v === undefined ? '∅' : JSON.stringify(v);
export function describe(e) {
  const at = e.m ? `master ${e.m}` : e.order ? 'slides' : e.sadd ? `slide ${e.sadd.id}` : e.sdel ? `slide ${e.sdel}` : `slide ${e.s}${e.r ? ' row ' + e.r : ''}`;
  const what = e.order ? `reordered → ${e.order.join(',')}` : e.sadd ? `added at ${e.at}` : e.sdel ? 'deleted' : e.add ? `row added at ${e.at}: ${J(e.add)}` : e.del ? 'row deleted' :
    Object.entries(e.k || {}).map(([k, [a, b]]) => `${k} ${J(a)} → ${J(b)}${e.conflict && k in e.conflict ? ` (agent had ${J(e.conflict[k])}; human kept)` : ''}${e.yielded && k in e.yielded ? ` (agent's ${J(e.yielded[k])} kept; the edit came after its rebuild)` : ''}`).join(', ');
  return `${e.t || ''} ${at}: ${what}${e.rev ? '' : '  [not in any file yet]'}`;
}

if (isMain(import.meta.url)) {
  const a = process.argv.slice(2), file = a.find(x => !x.startsWith('--'));
  if (!file) { console.error('usage: node bin/edits.mjs deck.html [--json]'); process.exit(2); }
  const r = edits(fs.readFileSync(file, 'utf8'));
  if (a.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  console.log(`${r.title || 'deck'} · id ${r.id} · rev ${r.rev} · ${r.log.length} human edit(s)`);
  for (const e of r.log) console.log('  ' + describe(e));
}
