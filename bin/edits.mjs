#!/usr/bin/env node
// decklet edits — what the human changed in a deck file. Read it BEFORE regenerating a deck, so the revision keeps their work.
// usage: node bin/edits.mjs deck.html [--json]
// prints: deck id + rev, every logged edit (slide/row, keys before → after, conflicts the last migrate kept), the version history
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {blockOf} from '../lib/edits.mjs';

export function edits(html) {
  const deck = blockOf(html, 'DECK'), log = blockOf(html, 'LOG'), versions = blockOf(html, 'VERSIONS');
  return {id: deck.id, rev: deck.rev, title: deck.title, log, versions: versions.map(v => ({rev: v.rev, t: v.t, by: v.by, label: v.label, slides: v.deck.slides.length}))};
}
const J = v => v === undefined ? '∅' : JSON.stringify(v);
export function describe(e) {
  const at = e.m ? `master ${e.m}` : e.order ? 'slides' : e.sadd ? `slide ${e.sadd.id}` : e.sdel ? `slide ${e.sdel}` : `slide ${e.s}${e.r ? ' row ' + e.r : ''}`;
  const what = e.order ? `reordered → ${e.order.join(',')}` : e.sadd ? `added at ${e.at}` : e.sdel ? 'deleted' : e.add ? `row added at ${e.at}: ${J(e.add)}` : e.del ? 'row deleted' :
    Object.entries(e.k || {}).map(([k, [a, b]]) => `${k} ${J(a)} → ${J(b)}${e.conflict && k in e.conflict ? ` (agent had ${J(e.conflict[k])}; human kept)` : ''}`).join(', ');
  return `${e.t || ''} ${at}: ${what}${e.rev ? '' : '  [not in any file yet]'}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), file = a.find(x => !x.startsWith('--'));
  if (!file) { console.error('usage: node bin/edits.mjs deck.html [--json]'); process.exit(2); }
  const r = edits(fs.readFileSync(file, 'utf8'));
  if (a.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  console.log(`${r.title || 'deck'} · id ${r.id} · rev ${r.rev} · ${r.log.length} human edit(s) · ${r.versions.length} version(s)`);
  for (const e of r.log) console.log('  ' + describe(e));
  for (const v of r.versions) console.log(`  version ${v.rev} · ${v.t} · ${v.by} · ${v.label || ''} · ${v.slides} slides`);
}
