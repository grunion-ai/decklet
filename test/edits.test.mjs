// decklet edits — stable ids, the human-edit log, migrate (human wins, conflicts flagged), create --from
// The pure core lives ONCE, in template.html between /*EDITS*/ markers; lib/edits.mjs lifts it out for node.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {stampIds, diffDecks, applyLog, blockOf, putBlock} from '../lib/edits.mjs';
import {create} from '../bin/create.mjs';
import {validate} from '../bin/validate.mjs';
import {modelOf} from '../bin/verify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-edits-'));
const mk = () => ({w: 960, h: 540, master: [{id: 'foot', x: 60, y: 500, w: 400, role: 'Caption', text: 'footer', footer: 1}],
  slides: [
    {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}, {x: 60, y: 200, w: 400, role: 'Body', text: 'body one'}]},
    {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Two'}, {x: 100, y: 300, line: [400, 300], arrow: 'end', h: 3}]},
  ]});
const clone = d => JSON.parse(JSON.stringify(d));

test('stampIds: deck, every slide and every row get an id; existing ids are kept; row ids are unique per slide, slide ids per deck', () => {
  const d = stampIds(mk());
  assert.equal(d.id, 'unstamped', 'no id: the namespace stands in (create always stamps one)');
  assert.deepEqual(d.slides.map(s => s.id), ['s1', 's2'], 'deterministic: the next free number');
  assert.deepEqual(d.slides.map(s => s.els.map(r => r.id)), [['r1', 'r2'], ['r1', 'r2']]);
  const taken = mk(); taken.slides[0].els[0].id = 'r1'; taken.slides[1].id = 's1';
  assert.deepEqual(stampIds(taken).slides.map(s => [s.id, s.els.map(r => r.id)]), [['s2', ['r1', 'r2']], ['s1', ['r1', 'r2']]], 'taken numbers are skipped, never reused');
  assert.equal(new Set(d.slides.map(s => s.id)).size, 2);
  for (const s of d.slides) assert.equal(new Set(s.els.map(r => r.id)).size, s.els.length);
  const kept = mk(); kept.id = 'deckA'; kept.slides[0].id = 'intro'; kept.slides[0].els[0].id = 'title';
  const k = stampIds(kept);
  assert.equal(k.id, 'deckA'); assert.equal(k.slides[0].id, 'intro'); assert.equal(k.slides[0].els[0].id, 'title');
  assert.equal(stampIds(k), k, 'idempotent: a second pass changes nothing'); assert.equal(JSON.stringify(stampIds(clone(k))), JSON.stringify(k));
});

test('stampIds: the validator accepts id/rev on the deck, slides and rows', () => {
  const d = create(stampIds(mk()), {}).deck; d.rev = 'abc';
  assert.deepEqual(validate(d).errors, []);
});

test('diffDecks: a moved row is one entry with before/after for exactly the changed keys, addressed by slide id + row id', () => {
  const a = stampIds(mk()), b = clone(a);
  b.slides[0].els[1].x = 90; b.slides[0].els[1].y = 210;
  const log = diffDecks(a, b);
  assert.equal(log.length, 1);
  assert.deepEqual(log[0], {s: a.slides[0].id, r: a.slides[0].els[1].id, k: {x: [60, 90], y: [200, 210]}});
});

test('diffDecks: a connector drag logs the far end too; a text edit logs text; a deleted key logs [before, undefined]', () => {
  const a = stampIds(mk()), b = clone(a);
  b.slides[1].els[1].line = [420, 320]; b.slides[0].els[0].text = 'Uno'; delete b.slides[0].els[0].w;
  const log = diffDecks(a, b);
  assert.deepEqual(log.find(e => e.r === a.slides[1].els[1].id).k, {line: [[400, 300], [420, 320]]});
  assert.deepEqual(log.find(e => e.r === a.slides[0].els[0].id).k, {text: ['One', 'Uno'], w: [800, undefined]});
});

test('diffDecks: row add / row delete / slide add / slide delete / slide reorder / master edit', () => {
  const a = stampIds(mk()), b = clone(a);
  const added = {id: 'rnew', x: 1, y: 2, w: 3, role: 'Body', text: 'new'};
  b.slides[0].els.push(added); const gone = b.slides[0].els.splice(0, 1)[0];
  const ns = {id: 'sx', els: []}; b.slides.push(ns);
  b.master[0].text = 'changed footer';
  let log = diffDecks(a, b);
  assert.deepEqual(log.find(e => e.add), {s: a.slides[0].id, r: 'rnew', add: added, at: 1});
  assert.deepEqual(log.find(e => e.del), {s: a.slides[0].id, r: gone.id, del: gone});
  assert.deepEqual(log.find(e => e.sadd), {sadd: ns, at: 2});
  assert.deepEqual(log.find(e => e.m), {m: 'foot', k: {text: ['footer', 'changed footer']}});
  const c = clone(a); c.slides.reverse();
  log = diffDecks(a, c);
  assert.deepEqual(log, [{order: [a.slides[1].id, a.slides[0].id]}]);
  const d = clone(a); d.slides.splice(0, 1);
  assert.deepEqual(diffDecks(a, d), [{sdel: a.slides[0].id, slide: a.slides[0]}]);
  assert.deepEqual(diffDecks(a, clone(a)), [], 'no change, no entries');
});

test('applyLog: replays a log onto a NEW agent version — human wins; untouched keys keep the agent\'s values', () => {
  const base = stampIds(mk()), human = clone(base);
  human.slides[0].els[1].x = 90; human.slides[0].els[0].text = 'Uno';
  const log = diffDecks(base, human);
  const agent = clone(base); agent.slides[0].els[1].w = 500; agent.slides[0].els[0].color = 'red'; // agent touched OTHER keys
  const r = applyLog(agent, log);
  assert.equal(agent.slides[0].els[1].x, 90); assert.equal(agent.slides[0].els[1].w, 500);
  assert.equal(agent.slides[0].els[0].text, 'Uno'); assert.equal(agent.slides[0].els[0].color, 'red');
  assert.deepEqual([r.applied, r.conflicts, r.orphans], [2, [], []]);
});

test('applyLog: conflict = the agent changed the same key since the human\'s "before"; human still wins, the agent value is kept on the entry', () => {
  const base = stampIds(mk()), human = clone(base); human.slides[0].els[0].text = 'Uno';
  const log = diffDecks(base, human);
  const agent = clone(base); agent.slides[0].els[0].text = 'Agent title';
  const r = applyLog(agent, log);
  assert.equal(agent.slides[0].els[0].text, 'Uno');
  assert.equal(r.conflicts.length, 1);
  assert.deepEqual(r.conflicts[0], {s: base.slides[0].id, r: base.slides[0].els[0].id, key: 'text', human: 'Uno', agent: 'Agent title'});
  assert.equal(log[0].conflict.text, 'Agent title', 'the entry itself records the agent value the human overrode');
});

test('applyLog: idempotent (already-applied entries are skipped, never conflicts); a row or slide that no longer exists is an orphan', () => {
  const base = stampIds(mk()), human = clone(base); human.slides[0].els[1].x = 90;
  const log = diffDecks(base, human);
  const agent = clone(human); // the file already carries the edit (write-back happened)
  let r = applyLog(agent, log);
  assert.deepEqual([r.applied, r.conflicts, r.orphans], [0, [], []]);
  const cut = clone(base); cut.slides[0].els.splice(1, 1);
  r = applyLog(cut, log);
  assert.equal(r.orphans.length, 1); assert.equal(r.orphans[0].r, base.slides[0].els[1].id);
});

test('applyLog: structural entries — add/delete rows, add/delete/reorder slides, master keys, deleted keys', () => {
  const base = stampIds(mk()), human = clone(base);
  human.slides[0].els.push({id: 'rnew', x: 1, y: 2, w: 3, role: 'Body', text: 'new'}); human.slides[1].els.splice(0, 1);
  human.slides.push({id: 'sx', els: []}); human.master[0].text = 'mine'; delete human.slides[0].els[0].w;
  const log = diffDecks(base, human);
  const agent = clone(base); applyLog(agent, log);
  assert.equal(agent.slides[0].els.at(-1).id, 'rnew'); assert.equal(agent.slides[1].els.length, 1);
  assert.equal(agent.slides.at(-1).id, 'sx'); assert.equal(agent.master[0].text, 'mine'); assert.equal('w' in agent.slides[0].els[0], false);
  const rev = clone(base); rev.slides.reverse(); const agent2 = clone(base); applyLog(agent2, diffDecks(base, rev));
  assert.deepEqual(agent2.slides.map(s => s.id), rev.slides.map(s => s.id));
  const three = clone(base); three.slides.push({id: 'snew', els: []}); // an agent slide the human never saw stays, after the reordered ones
  applyLog(three, diffDecks(base, rev)); assert.deepEqual(three.slides.map(s => s.id), [...rev.slides.map(s => s.id), 'snew']);
});

test('template carries the same EDITS block lib/edits.mjs runs (one source), plus LOG and VERSIONS markers', () => {
  const tpl = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
  assert.match(tpl, /\/\*EDITS\*\/[\s\S]*function stampIds[\s\S]*function diffDecks[\s\S]*function applyLog[\s\S]*\/\*\/EDITS\*\//);
  assert.match(tpl, /const LOG0=\/\*LOG\*\/\[\]\/\*\/LOG\*\//); assert.match(tpl, /const VERS0=\/\*VERSIONS\*\/\[\]\/\*\/VERSIONS\*\//);
  assert.deepEqual(blockOf(tpl, 'LOG'), []); assert.deepEqual(blockOf(putBlock(tpl, 'LOG', [{s: 1}]), 'LOG'), [{s: 1}]);
});

test('create: stamps deck.id + deck.rev + slide/row ids; the storage namespace is the deck id (stable across versions)', () => {
  const {html, deck, hash} = create(mk(), {});
  assert.match(deck.id, /^[0-9a-f]{10}$/); assert.equal(deck.rev, hash); assert.equal(create(mk(), {}).html, html, 'byte-identical rebuild'); assert.ok(deck.slides.every(s => s.id && s.els.every(r => r.id)));
  assert.match(html, new RegExp(`const NS=/\\*KEY\\*/'decklet:${deck.id}'/\\*/KEY\\*/`));
  assert.deepEqual(modelOf(html).rev, hash);
  const again = create(deck, {});
  assert.equal(again.deck.id, deck.id, 'a model that carries its id keeps it');
});

test('create --from: inherits the deck id and matching slide/row ids from the previous file, replays its log (human wins), and pushes the previous state into VERSIONS', () => {
  const v1 = create(mk(), {}); const f1 = path.join(tmp, 'v1.html');
  // the human moved a row and retitled a slide in the browser; write-back baked both into DECK and the LOG
  const edited = clone(v1.deck); edited.slides[0].els[1].x = 90; edited.slides[0].els[0].text = 'Uno';
  const log = diffDecks(v1.deck, edited).map(e => ({...e, t: '2026-09-06T10:00:00Z'}));
  let html = putBlock(v1.html, 'DECK', edited); html = putBlock(html, 'LOG', log);
  fs.writeFileSync(f1, html);
  // the agent regenerates from a model WITHOUT ids (fresh model.json), changing a different key and adding a slide
  const m2 = mk(); m2.slides[0].els[1].w = 500; m2.slides.push({els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Three'}]});
  const v2 = create(m2, {from: f1});
  assert.equal(v2.deck.id, v1.deck.id);
  assert.equal(v2.deck.slides[0].id, v1.deck.slides[0].id); assert.equal(v2.deck.slides[0].els[1].id, v1.deck.slides[0].els[1].id);
  assert.notEqual(v2.deck.rev, v1.deck.rev);
  assert.equal(v2.deck.slides[0].els[1].x, 90, 'human move carried'); assert.equal(v2.deck.slides[0].els[1].w, 500, 'agent width kept');
  assert.equal(v2.deck.slides[0].els[0].text, 'Uno', 'human text carried'); assert.equal(v2.deck.slides.length, 3);
  assert.deepEqual([v2.migrate.applied, v2.migrate.conflicts.length, v2.migrate.orphans.length], [2, 0, 0]);
  const vers = blockOf(v2.html, 'VERSIONS');
  assert.equal(vers.length, 1); assert.equal(vers[0].rev, v1.deck.rev); assert.equal(vers[0].by, 'human'); assert.equal(vers[0].deck.slides[0].els[1].x, 90);
  assert.ok(blockOf(v2.html, 'LOG').every(e => e.rev === v2.deck.rev), 'carried entries are stamped with the rev they were applied to');
});

test('create --from: a conflict is reported and the human value wins; versions are capped at 20', () => {
  const v1 = create(mk(), {}); const f1 = path.join(tmp, 'c1.html');
  const edited = clone(v1.deck); edited.slides[0].els[0].text = 'Uno';
  const log = diffDecks(v1.deck, edited).map(e => ({...e, t: '2026-09-06T10:00:00Z'}));
  const vers = Array.from({length: 20}, (_, n) => ({rev: 'r' + n, t: 't', by: 'agent', deck: v1.deck}));
  let html = putBlock(putBlock(putBlock(v1.html, 'DECK', edited), 'LOG', log), 'VERSIONS', vers);
  fs.writeFileSync(f1, html);
  const m2 = mk(); m2.slides[0].els[0].text = 'Agent title';
  const v2 = create(m2, {from: f1});
  assert.equal(v2.deck.slides[0].els[0].text, 'Uno');
  assert.equal(v2.migrate.conflicts.length, 1); assert.equal(v2.migrate.conflicts[0].agent, 'Agent title');
  assert.equal(blockOf(v2.html, 'VERSIONS').length, 20); assert.equal(blockOf(v2.html, 'VERSIONS').at(-1).rev, v1.deck.rev);
});

// ROADMAP P1.4: a deck built before 0.5.0 carries no /*LOG*/ or /*VERSIONS*/ data block, but its fileHtml() source still
// holds the marker strings. blockOf's regex was an unanchored whole-document search, so it matched the source literal and
// JSON.parse('+J(log)+') threw an uncaught SyntaxError from create --from.
const pre050 = html => {
  const out = html.replace(/const LOG0=\/\*LOG\*\/\[\]\/\*\/LOG\*\/;const VERS0=\/\*VERSIONS\*\/\[\]\/\*\/VERSIONS\*\/;/, 'const LOG0=[];const VERS0=[];');
  assert.notEqual(out, html, 'fixture: the data blocks were stripped'); assert.match(out, /'\/\*LOG\*\/'/, 'fixture: the source literal stays');
  return out;
};
test('blockOf: anchored to the data block — a marker missing there is reported as missing, never parsed out of fileHtml()\'s source', () => {
  const html = pre050(create(mk(), {}).html);
  assert.throws(() => blockOf(html, 'LOG'), {message: 'marker LOG missing'});
  assert.throws(() => blockOf(html, 'VERSIONS'), {message: 'marker VERSIONS missing'});
  assert.deepEqual(blockOf(html, 'LOG', []), [], 'a fallback stands in for a missing block');
  assert.equal(blockOf(html, 'DECK').w, 960, 'the blocks that are there still read');
});
test('create --from: a deck built before 0.5.0 (no edit log) carries its id and its state into VERSIONS, replays nothing, and says so', () => {
  const v1 = create(mk(), {}); const f1 = path.join(tmp, 'pre050.html');
  fs.writeFileSync(f1, pre050(v1.html));
  const v2 = create(mk(), {from: f1});
  assert.equal(v2.deck.id, v1.deck.id, 'id inherited');
  assert.deepEqual([v2.migrate.applied, v2.migrate.conflicts.length, v2.migrate.orphans.length], [0, 0, 0]);
  assert.equal(v2.migrate.predates, true, 'the caller can tell the previous file had no log');
  const vers = blockOf(v2.html, 'VERSIONS');
  assert.equal(vers.length, 1); assert.equal(vers[0].rev, v1.deck.rev); assert.equal(vers[0].by, 'agent');
  assert.deepEqual(blockOf(v2.html, 'LOG'), []);
});
