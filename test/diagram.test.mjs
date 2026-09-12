// lib/diagram.mjs gate — a spec of nodes / edges / groups / timeline / note becomes native rows (every node, label and
// connector editable and draggable, grouped so a node or an edge moves as one) inside the library's `diagram` frame.
// Ported from the harness helper that drew the nine figure kinds (2026-09-07); the router, fans and label rules are the
// ones the eyeball rounds shaped: same-column edges go V-H-V, edges sharing a face fan 20px, a label rides the run
// nearest its target and lifts or sidesteps when it does not fit.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {diagramRows, diagramLayout, diagramSlide} from '../lib/diagram.mjs';
import {LIBRARY} from '../lib/layouts.mjs';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const spec = {
  w: 900, h: 300, label: 'Buying won the ordering',
  nodes: [
    {id: 'cp', x: 21, y: 22, w: 200, h: 60, title: 'Build in-house', sub: 'two engineers, a year'},
    {id: 'ae', x: 20, y: 120, w: 200, h: 60, title: 'Buy a platform', sub: 'twelve-month contract', state: 'chosen'},
    {id: 'gs', x: 20, y: 220, w: 200, h: 60, title: 'Partner', sub: 'revenue share', state: 'lost'},
    {id: 'log', x: 300, y: 120, w: 200, h: 60, title: 'One contract', sub: 'everything <reads> it', state: 'chosen'},
  ],
  edges: [
    {from: 'cp', to: 'log'},
    {from: 'ae', to: 'log', state: 'chosen', label: 'signed'},
    {from: 'gs', to: 'log', state: 'lost'},
  ],
  timeline: {x: 560, y: 150, w: 320, ticks: [
    {label: 'Q1', sub: 'shortlist', filled: true}, {label: 'Q2', sub: 'pilot'}, {label: 'Q3', sub: 'rollout'},
  ]},
  note: {x: 560, y: 220, lines: ['exit clause at month six']},
};
const fr = {x: 60, y: 130, w: 900, h: 300};

test('diagram: the layout is the library diagram layout, scaled to the space, with the figure slot as the frame', () => {
  for (const [space, W, H] of [['960x540', 960, 540], ['1600x900', 1600, 900]]) {
    const {layout, frame} = diagramLayout(space);
    for (const s of ['supertitle', 'title', 'caption']) assert.ok(layout[s].role, `${space}: ${s} slot has a role`);
    assert.equal(layout.caption.role, 'Caption');
    assert.ok(!layout.figure, 'the figure slot is the frame, not a slot to bind');
    assert.ok(frame.x > 0 && frame.y > layout.title.y && frame.x + frame.w <= W && frame.y + frame.h <= layout.caption.y && layout.caption.y < H, `${space}: frame sits between title and caption`);
  }
  const {frame} = diagramLayout();
  const lib = LIBRARY.diagram.slots.figure;
  assert.deepEqual(frame, {x: lib.x, y: lib.y, w: lib.w, h: lib.h}, 'at 960×540 the frame IS the library figure slot');
  assert.equal(diagramLayout('1600x900').frame.w, Math.round(lib.w * 1600 / 960), 'scaled like libraryFor');
  assert.throws(() => diagramLayout('4x3x2'), /space/);
});

test('diagram: nodes — a painted box, a Body title and a Label sublabel, one group; chosen = accent 2px, lost = dashed muted', () => {
  const rows = diagramRows(spec, fr);
  assert.ok(!rows.some(r => r.svg), 'no svg row for rect nodes');
  assert.deepEqual(rows.find(r => r.id === 'ae'), {id: 'ae', x: 84, y: 250, w: 200, h: 60, bg: 'var(--box)', bd: '2px solid var(--accent)', radius: 8, group: 'ae'});
  assert.equal(rows.find(r => r.id === 'gs').bd, '1px dashed var(--muted)');
  assert.equal(rows.find(r => r.id === 'cp').bg, 'var(--card)');
  assert.equal(rows.find(r => r.id === 'cp').x, 84, 'node origins snap to the 8px grid');
  assert.deepEqual(rows.find(r => r.group === 'ae' && r.role === 'Body'), {x: 100, y: 258, w: 168, role: 'Body', weight: 600, color: 'var(--fg)', nowrap: 1, text: 'Buy a platform', group: 'ae'});
  assert.deepEqual(rows.find(r => r.group === 'ae' && r.role === 'Label'), {x: 100, y: 286, w: 168, role: 'Label', nowrap: 1, color: 'var(--muted)', text: 'twelve-month contract', group: 'ae'});
  assert.throws(() => diagramRows({w: 100, h: 100, label: 'edge', nodes: [{id: 'a', x: 0, y: 10, w: 50, h: 20, title: 'A'}]}, fr), /inset/, 'a node on the frame edge loses its stroke to the row clip');
  assert.throws(() => diagramRows({w: 100, h: 100, label: 'x', nodes: [{id: 'a', x: 8, y: 8, w: 40, h: 20, title: 'A', shape: 'star'}]}, fr), /shape/);
  assert.throws(() => diagramRows({...spec, label: ''}, fr), /label/, 'the one claim is mandatory');
  assert.throws(() => diagramRows({w: 100, h: 100, label: 'x', nodes: [{id: 'a', x: 8, y: 8, w: 40, h: 20, title: 'A'}], edges: [{from: 'a', to: 'zz'}]}, fr), /unknown node/);
});

test('diagram: edges — line rows terminated on their nodes, headed, 2.5px (3 chosen), dashed when lost; bent edges are three grouped runs whose ends fan', () => {
  const rows = diagramRows(spec, fr);
  assert.deepEqual(rows.find(r => r.line && r.from === 'ae'), {x: 284, y: 280, line: [364, 280], h: 3, bg: 'var(--accent)', from: 'ae', to: 'log', arrow: 'end', head: 'triangle', group: 'e:ae-log'});
  assert.equal(rows.find(r => r.line && r.from === 'gs').dash, 1);
  assert.equal(rows.find(r => r.line && r.from === 'cp').h, 2.5);
  const bent = rows.filter(r => r.group === 'e:cp-log' && r.line);
  assert.equal(bent.length, 3);
  assert.deepEqual([bent[0].from, bent[0].to, bent[1].from, bent[1].to, bent[2].from, bent[2].to, bent[2].arrow], ['cp', undefined, undefined, undefined, undefined, 'log', 'end']);
  assert.deepEqual([bent[0].y, bent[0].line[1], bent[1].x, bent[2].line[1]], [184, 184, 324, 260], 'H-V-H: first run level with the source; three edges enter log on its left face, so the target ends fan 20px apart (cp -20, ae 0, gs +20)');
  // a label is a Label chip over card with explicit padding, centred by explicit width
  assert.deepEqual(rows.find(r => r.text === 'signed'), {x: 292, y: 262, w: 56, role: 'Label', nowrap: 1, align: 'center', bg: 'var(--card)', p: '1px 4px', text: 'signed', group: 'e:ae-log'});
});

test('diagram: routing — a target not to the right takes V-H-V between the horizontal faces; a label that does not fit lifts or sidesteps', () => {
  const unit = {x: 0, y: 0, w: 400, h: 300};
  const stacked = diagramRows({w: 400, h: 300, label: 'stacked', nodes: [
    {id: 'a', x: 200, y: 24, w: 120, h: 40, title: 'A'}, {id: 'b', x: 200, y: 200, w: 120, h: 40, title: 'B'},
    {id: 'c', x: 24, y: 200, w: 120, h: 40, title: 'C'}, {id: 'd', x: 24, y: 24, w: 120, h: 40, title: 'D'}],
    edges: [{from: 'a', to: 'b', label: 'down'}, {from: 'a', to: 'c', label: 'back'}, {from: 'd', to: 'b', label: 'bent'}, {from: 'd', to: 'a', label: 'flat'}]}, unit);
  const runs = g => stacked.filter(r => r.group === g && r.line).map(r => [r.x, r.y, ...r.line]);
  assert.deepEqual(runs('e:a-b'), [[250, 64, 250, 200]], 'same column: straight down, fanned 10px left with the target end');
  assert.deepEqual(runs('e:a-c'), [[270, 64, 270, 136], [270, 136, 84, 136], [84, 136, 84, 200]], 'target left and below: V-H-V from the fanned start');
  assert.deepEqual(runs('e:d-b'), [[144, 34, 176, 34], [176, 34, 176, 220], [176, 220, 200, 220]], 'bent edge leaves 10px above the face centre');
  assert.deepEqual(runs('e:d-a'), [[144, 54, 200, 54]], 'level edge stays level: both ends fanned 10px down');
  const lab = t => stacked.find(r => r.text === t);
  assert.deepEqual([lab('down').x, lab('down').y, lab('down').align], [256, 124, undefined], 'no horizontal run: label beside the vertical');
  assert.deepEqual([lab('back').y, lab('back').align], [118, 'center'], 'V-H-V: label centred on the horizontal run');
  assert.deepEqual([lab('bent').x, lab('bent').y, lab('bent').align], [152, 119, 'center'], 'H-V-H with a short last run and room between the nodes: label centred on the vertical, its halo over the line');
  assert.deepEqual([lab('flat').y, lab('flat').align], [36, 'center'], 'straight: label centred on the span');
  const tight = diagramRows({w: 400, h: 200, label: 'tight', nodes: [
    {id: 'a', x: 8, y: 40, w: 120, h: 40, title: 'A'}, {id: 'b', x: 168, y: 40, w: 120, h: 40, title: 'B'}, {id: 'c', x: 168, y: 120, w: 120, h: 40, title: 'C'}],
    edges: [{from: 'a', to: 'b', label: 'screen passed'}, {from: 'a', to: 'c', label: 'linked to'}]}, unit);
  assert.equal(tight.find(r => r.text === 'screen passed').y, 18, 'wider than the 40px run: lifted 22 above the node tops, so the 16px chip keeps the 4px gap');
  assert.deepEqual([tight.find(r => r.text === 'linked to').x, tight.find(r => r.text === 'linked to').y], [158, 97], 'bent with a short last run and no room between the nodes: beside the vertical at its midpoint');
});

test('diagram: timeline — one headless accent rule, each tick its own group (dot + label + sublabel); note — one Label row', () => {
  const rows = diagramRows(spec, fr);
  assert.deepEqual(rows.find(r => r.line && r.group === 'timeline'), {x: 620, y: 280, line: [940, 280], h: 2, bg: 'var(--accent)', group: 'timeline'});
  const dots = rows.filter(r => r.radius === '50%' && /^tick:/.test(r.group));
  assert.equal(dots.length, 3);
  assert.deepEqual(dots[0], {x: 613, y: 273, w: 14, h: 14, bg: 'var(--accent)', bd: '2px solid var(--accent)', radius: '50%', group: 'tick:Q1'});
  assert.equal(dots[1].bg, 'var(--card)', 'a tick ahead is hollow');
  assert.ok(!rows.some(r => r.group === 'timeline' && !r.line), 'nothing but the rule shares the timeline group');
  assert.deepEqual(rows.find(r => r.text === 'Q1'), {x: 572, y: 248, w: 96, role: 'Label', nowrap: 1, align: 'center', color: 'var(--fg)', tt: 'none', text: 'Q1', group: 'tick:Q1'});
  assert.deepEqual(rows.find(r => r.text === 'shortlist'), {x: 572, y: 296, w: 96, role: 'Label', nowrap: 1, align: 'center', text: 'shortlist', group: 'tick:Q1'});
  assert.deepEqual(rows.find(r => r.group === 'note'), {x: 620, y: 350, w: 340, role: 'Label', text: 'exit clause at month six', group: 'note'});
  assert.equal(diagramRows({w: 450, h: 150, label: 'half', nodes: [{id: 'ae', x: 24, y: 24, w: 100, h: 30, title: 'A'}]}, fr).find(r => r.id === 'ae').w, 200, 'a spec narrower than the frame scales to its width');
});

test('diagram: shapes and groups — pill radius half the height, circle 50%, a diamond keeps its paint as one svg row; a group is a dashed over:1 box with a Label', () => {
  const rows = diagramRows({w: 600, h: 300, label: 'shapes',
    groups: [{x: 8, y: 8, w: 280, h: 200, label: 'edge'}],
    nodes: [{id: 'p', x: 24, y: 40, w: 120, h: 40, title: 'Serve', shape: 'pill', state: 'chosen'},
      {id: 'd', x: 200, y: 40, w: 120, h: 60, title: 'hit?', shape: 'diamond'},
      {id: 'c', x: 400, y: 40, w: 60, h: 60, title: 'DB', shape: 'circle'}]}, {x: 0, y: 0, w: 600, h: 300});
  assert.deepEqual(rows[0], {x: 8, y: 8, w: 280, h: 200, bd: '1px dashed var(--line)', radius: 12, over: 1, group: 'g:edge'});
  assert.deepEqual(rows[1], {x: 20, y: 14, w: 256, role: 'Label', nowrap: 1, text: 'edge', group: 'g:edge'});
  assert.equal(rows.find(r => r.id === 'p').radius, 20);
  assert.deepEqual(rows.find(r => r.group === 'p' && r.role), {x: 40, y: 48, w: 88, role: 'Body', weight: 600, color: 'var(--fg)', nowrap: 1, align: 'center', text: 'Serve', group: 'p'});
  assert.equal(rows.find(r => r.id === 'c').radius, '50%');
  const dia = rows.find(r => r.id === 'd');
  assert.match(dia.svg, /<polygon points="60,0 120,30 60,60 0,30"/);
  assert.doesNotMatch(dia.svg, /#[0-9a-fA-F]{3,8}\b|<script|<style|href="http/, 'tokens only, self-contained');
  assert.deepEqual([dia.x, dia.y, dia.w, dia.h, dia.group], [200, 40, 120, 60, 'd']);
  assert.equal(rows.find(r => r.group === 'd' && r.role).text, 'hit?');
});

test('diagram: slide — rows fill the library frame under the diagram layout, the caption states the claim, and it validates and creates', () => {
  const slide = diagramSlide(spec, {supertitle: 'decisions', title: 'Three options, one pick', caption: 'Buying won; partnering moved to next year.'});
  assert.equal(slide.layout, 'diagram');
  const {frame} = diagramLayout('960x540');
  assert.ok(!slide.els.some(r => r.svg), 'a rect-only diagram slide carries no svg row');
  assert.equal(slide.els.find(r => r.id === 'ae').x, Math.round(frame.x + 24 * frame.w / 900));
  assert.deepEqual(slide.els.find(r => r.slot === 'caption'), {slot: 'caption', text: 'Buying won; partnering moved to next year.'});
  assert.throws(() => diagramSlide(spec, {title: 't'}), /caption/, 'a diagram slide without a caption is refused');
  const deck = {w: 960, h: 540, title: 'fig', slides: [slide]};
  const r = validate(create(deck).deck);
  assert.deepEqual(r.errors, [], r.errors.join(' | '));
  assert.ok(create(deck).html.includes('/*DECK*/'));
});

test('diagram: palette — a token prefix maps every colour to that palette\'s twins and the slide wears its ground', () => {
  const us = diagramRows(spec, fr, {palette: 'us'});
  assert.equal(us.find(r => r.id === 'ae').bd, '2px solid var(--us-accent)');
  assert.equal(us.find(r => r.id === 'cp').bg, 'var(--us-card)');
  assert.equal(us.find(r => r.group === 'ae' && r.role === 'Body').color, 'var(--us-fg)');
  assert.equal(us.find(r => r.text === 'signed').bg, 'var(--us-card)');
  assert.ok(!JSON.stringify(us).includes('var(--fg)') && !JSON.stringify(us).includes('var(--accent)'), 'no bare token survives under a palette');
  const s = diagramSlide(spec, {title: 'T', caption: 'C', palette: 'us'});
  assert.deepEqual(s.els[0], {x: 0, y: 0, w: 960, h: 540, bg: 'var(--us-bg)', over: 1});
  assert.deepEqual(s.els.find(r => r.slot === 'title'), {slot: 'title', text: 'T', color: 'var(--us-fg)'});
  assert.deepEqual(s.els.find(r => r.slot === 'caption'), {slot: 'caption', text: 'C', color: 'var(--us-muted)'});
});

test('diagram: the package exports it, so a caller imports @grunion/decklet/diagram', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.exports['./diagram'], './lib/diagram.mjs');
  assert.ok(pkg.exports['./*'], 'every other file stays reachable by path');
  assert.equal(import.meta.resolve('@grunion/decklet/diagram'), new URL('../lib/diagram.mjs', import.meta.url).href, 'self-reference resolves');
});
