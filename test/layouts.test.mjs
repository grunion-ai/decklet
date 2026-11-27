// decklet layout library gate — the catalogue is an accelerant, never a fence: a slide may use a library layout, a deck
// layout or free rows, and may mix library slots with extra free rows. Nothing that worked before the library may stop.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {validate, ROLES} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {verify} from '../bin/verify.mjs';
import {LIBRARY, GROUPS, DENSE, COUNTER, NEUTRAL_LH, MEDIA_MIN, libraryFor, catalogue, densityReport, freeArea} from '../lib/layouts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-lib-'));

export const NAMES = ['cover', 'agenda', 'section', 'cover-agenda-rail', 'cover-contents-column', 'cover-agenda-strip',
  'cover-front-page', 'cover-contents-page', 'cover-decision', 'cover-title-block', 'cover-presenter-panel', 'cover-margin-notes', 'cover-purpose-ask-footer', 'cover-description-column',
  'cover-description-headline', 'cover-fact-ledger', 'cover-description-card', 'cover-ask-sticker', 'cover-three-bands', 'cover-section-rows', 'cover-two-anchors', 'cover-framed',
  'content', 'title', 'statement', 'fact', 'quote', 'two-cols', 'two-cols-header', 'bullets', 'memo', 'letter', 'brief-sheet', 'image-left', 'image-right',
  'bento-grid', 'image-hero-overlay', 'image-split', 'annotated-shot', 'three-up-cards', 'dashboard-composite', 'table-insight', 'proof-strip', 'team-grid',
  'kpi-grid', 'kpi-grid-4', 'stat', 'chart', 'comparison', 'process-steps', 'diagram', 'timeline', 'cta', 'end'];
const COVERS = ['cover-agenda-rail', 'cover-contents-column', 'cover-agenda-strip'];
const run = (n, mk) => Array.from({length: n}, (_, i) => mk(i + 1)).flat();
const FULL = {x: 0, y: 0, w: 960, h: 540};
export const BATCH2 = {
  'cover-front-page': {group: 'openers', density: 'reading', links: true, panels: {rule: {x: 60, y: 72, w: 840, h: 3, bg: 'var(--fg)'}},
    slots: ['rule', ...run(5, k => `rule${k}`), 'masthead', 'meta', 'title', 'description', ...run(5, k => [`section${k}`, `page${k}`])]},
  'cover-contents-page': {group: 'openers', density: 'reading', links: true, panels: {panel: {x: 0, y: 0, w: 403, h: 540, bg: 'var(--box)'}},
    slots: ['panel', ...run(5, k => `rule${k}`), 'supertitle', 'title', 'tagline', 'caption', 'contents-label', ...run(5, k => [`section${k}`, `page${k}`])]},
  'cover-decision': {group: 'openers', density: 'speaker', panels: {ground: {...FULL, bg: 'var(--fg)'}},
    slots: ['ground', 'title', 'meta', 'decision-label', 'decision', 'item1', 'item2', 'item3', 'item4']},
  'cover-title-block': {group: 'openers', density: 'speaker', panels: {frame: {x: 48, y: 36, w: 864, h: 468, bd: '1px solid var(--fg)'}, block: {x: 504, y: 372, w: 408, h: 132, bg: 'var(--card)', bd: '1px solid var(--fg)'}},
    slots: ['frame', 'block', ...run(5, k => `block-rule${k}`), 'supertitle', 'title', ...run(6, k => [`fact${k}-label`, `fact${k}`])]},
  'cover-presenter-panel': {group: 'openers', density: 'reading', panels: {panel: {x: 614, y: 0, w: 346, h: 540, bg: 'var(--fg)'}},
    slots: ['panel', 'avatar', 'supertitle', 'title', 'purpose', 'avatar-label', 'presenter', 'presenter-label', 'fact1-label', 'fact1', 'fact2-label', 'fact2', 'ask-label', 'ask']},
  'cover-margin-notes': {group: 'openers', density: 'reading', panels: {},
    slots: [...run(4, k => `note${k}-rule`), 'supertitle', 'title', ...run(4, k => [`note${k}-label`, `note${k}`])]},
  'cover-purpose-ask-footer': {group: 'openers', density: 'reading', panels: {'purpose-panel': {x: 0, y: 410, w: 480, h: 130, bg: 'var(--box)'}, 'ask-panel': {x: 480, y: 410, w: 480, h: 130, bg: 'var(--fg)'}},
    slots: ['purpose-panel', 'ask-panel', 'supertitle', 'title', 'description', 'purpose-label', 'purpose', 'ask-label', 'ask']},
  'cover-description-column': {group: 'openers', density: 'reading', panels: {column: {x: 499, y: 0, w: 461, h: 540, bg: 'var(--box)'}},
    slots: ['column', 'column-rule', 'supertitle', 'title', 'tagline', 'caption', 'about-label', 'description', 'purpose-label', 'purpose', 'ask-label', 'ask']},
  'cover-description-headline': {group: 'openers', density: 'reading', panels: {rule: {x: 60, y: 404, w: 840, h: 2, bg: 'var(--fg)'}},
    slots: ['rule', 'title', 'meta', 'description', ...run(4, k => [`fact${k}-label`, `fact${k}`])]},
  'cover-fact-ledger': {group: 'openers', density: 'reading', panels: {rule: {x: 60, y: 404, w: 840, h: 1, bg: 'var(--fg)'}},
    slots: ['rule', 'supertitle', 'description', 'title', 'tagline', ...run(4, k => [`fact${k}-label`, `fact${k}`])]},
  'cover-description-card': {group: 'openers', density: 'reading', panels: {ground: {...FULL, bg: 'var(--box)'}, card: {x: 573, y: 110, w: 346, h: 320, bg: 'var(--card)', radius: 8}},
    slots: ['ground', 'card', 'card-rule', 'supertitle', 'title', 'tagline', 'purpose', 'about-label', 'description', 'ask-label', 'ask']},
  'cover-ask-sticker': {group: 'openers', density: 'reading', panels: {ground: {...FULL, bg: 'var(--accent)'}, sticker: {x: 716, y: 38, w: 180, h: 180, radius: 90, bg: 'var(--card)'}},
    slots: ['ground', 'sticker', 'supertitle', 'title', 'tagline', 'description', 'ask-label', 'ask']},
  'cover-three-bands': {group: 'openers', density: 'reading', links: true, panels: {band: {x: 0, y: 0, w: 960, h: 266, bg: 'var(--fg)'}, strip: {x: 0, y: 443, w: 960, h: 97, bg: 'var(--box)'}},
    slots: ['band', 'strip', 'supertitle', 'title', 'description', ...run(5, k => `section${k}`), 'meta']},
  'cover-section-rows': {group: 'openers', density: 'reading', links: true, panels: Object.fromEntries(run(5, k => [[`row${k}`, {x: 403, y: (k - 1) * 108, w: 557, h: 108, bg: k % 2 ? 'var(--box)' : 'var(--card)'}]])),
    slots: [...run(5, k => `row${k}`), 'supertitle', 'title', 'tagline', 'caption', ...run(5, k => [`section${k}`, `page${k}`])]},
  'cover-two-anchors': {group: 'openers', density: 'reading', panels: {},
    slots: ['supertitle', 'meta', 'title', 'description', 'ask-label', 'ask']},
  'cover-framed': {group: 'openers', density: 'speaker', panels: {ground: {...FULL, bg: 'var(--box)'}, frame: {x: 22, y: 22, w: 916, h: 484, radius: 14, bg: 'var(--card)'}},
    slots: ['ground', 'frame', 'supertitle', 'meta', 'title', 'tagline', 'caption', 'ask']},
  memo: {group: 'text', density: 'reading', links: true, panels: {rule: {x: 60, y: 222, w: 840, h: 2, bg: 'var(--fg)'}},
    slots: ['rule', ...run(4, k => `field${k}-rule`), 'title', 'meta', ...run(4, k => [`field${k}-label`, `field${k}`]), 'body', 'ask', 'contents-label', ...run(5, k => [`section${k}`, `page${k}`])]},
  letter: {group: 'text', density: 'reading', links: true, panels: {column: {x: 672, y: 0, w: 288, h: 540, bg: 'var(--box)'}},
    slots: ['column', 'supertitle', 'greeting', 'body', 'name', 'caption', 'contents-label', ...run(5, k => [`n${k}`, `section${k}`])]},
  'brief-sheet': {group: 'text', density: 'reading', links: true, panels: {grid: {x: 40, y: 30, w: 880, h: 480, bd: '1px solid var(--fg)'}},
    slots: ['grid', ...run(4, k => `grid-rule${k}`), 'title-label', 'title', 'tagline', 'about-label', 'description', 'purpose-label', 'purpose', 'fact1-label', 'fact1', 'ask-label', 'ask', 'fact2-label', 'fact2', 'contents-label', ...run(5, k => [`page${k}`, `section${k}`])]},
};
const WORDY = [...COVERS, ...Object.keys(BATCH2)];
const SHORT = [[/^(description|body)$/, 'Two sentences that say what the deck is about. Enough to wrap once.'], [/^time\d$/, '5 min'], [/^(item|section|note|field)\d$/, 'Pilot scope'], [/^fact\d$/, 'Pilot'], [/^(n|page)\d$/, '4'],
  [/^(ask|decision)$/, 'Approve a pilot'], [/^(purpose|caption|tagline|masthead|presenter|name|greeting)$/, 'One short line'], [/^meta$/, '5-minute read'], [/^avatar-label$/, 'AB'], [/label$/, 'Label'], [/^(title)$/, 'Deck title']];
const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#5B9CF6"/></svg>');
// one slide per library layout, every slot bound with plausible content
export const fill = (name, k = 0) => {
  const lay = LIBRARY[name];
  // `body` and b1…bn are alternatives — a column carries the paragraph or the points, and validate errors on the pair, so the
  // image layouts fill as their paragraph here; the bullets-beside-an-image slide is its own test below.
  const els = Object.entries(lay.slots).filter(([slot]) => !(/^b\d$/.test(slot) && lay.slots.body) && !/-media$/.test(slot)).map(([slot, sl]) => {   // a media slot is the marker's alternative
    if (slot === 'image') return {slot, img: IMG, fit: 'cover'};
    if (slot === 'chart') return {slot, bg: 'var(--box)'};   // a painted stand-in until the chart row lands
    if (!sl.role) return {slot};                              // paint slots (rule, dots, button): the slot carries the paint
    const text = {Title: 'Two lines of display headline', Supertitle: 'Kicker', H1: 'A content-slide title', H2: 'A second-level heading',
      Body: 'Body copy, two short sentences at most. Enough to wrap once.', Caption: 'Source · caption text', Label: 'Label', Stat: '63%', Stat2: '$1.2M'}[sl.role];
    const short = WORDY.includes(name) && (SHORT.find(([re]) => re.test(slot)) || [])[1];
    return {slot, text: short || (/^(n\d|t\d)$/.test(slot) ? '0' + (slot.slice(1)) : /delta/.test(slot) ? '↑ 8 pts' : /label/.test(slot) ? 'Renewals' : /value/.test(slot) ? '$86K' : text)};
  });
  return {name: `${name}-${k}`, layout: name, els, ...(name === 'image-hero-overlay' || WORDY.includes(name) ? {hide: ['foot']} : {})};
};
export const everyLayout = (w = 960, h = 540) => ({w, h, title: 'library', styles: {margin: 60}, master: [{id: 'foot', footer: 1, x: 60, y: 500, w: 300, role: 'Label', text: 'library'}],
  slides: NAMES.map((n, k) => ({...fill(n, k), textOnly: true}))});   // the catalogue shows each layout's words; coverage is judged in coverage.test

test('library: diagram — title chrome, one 840×320 figure frame, a caption that states the claim', () => {
  const d = LIBRARY.diagram;
  assert.equal(d.group, 'diagrams');
  assert.deepEqual(d.slots.figure, {x: 60, y: 130, w: 840, h: 320}, 'the figure frame is media: geometry, no role, no paint — rows are placed inside it');
  assert.deepEqual(d.slots.caption, {x: 60, y: 470, w: 840, role: 'Caption'});
  assert.equal(d.slots.title.role, 'H1'); assert.equal(d.slots.supertitle.role, 'Supertitle');
});

test('library: every layout is complete, its slots wear a role from the scale (or carry paint), the names are the catalogue', () => {
  assert.deepEqual(Object.keys(LIBRARY), NAMES, 'the catalogue, in group order');
  for (const [name, lay] of Object.entries(LIBRARY)) {
    assert.ok(GROUPS.includes(lay.group), `${name}: group ${lay.group}`);
    assert.match(lay.use, /^[A-Z].{20,}\.$/, `${name}: one sentence of use`);
    assert.ok(['speaker', 'reading'].includes(lay.density), `${name}: density`);
    assert.ok(Object.keys(lay.slots).length >= 2, `${name}: slots`);
    for (const [slot, sl] of Object.entries(lay.slots)) {
      if (sl.role) assert.ok([...ROLES, 'Stat2'].includes(sl.role), `${name}.${slot}: role ${sl.role}`);
      else assert.ok(sl.h != null || sl.line, `${name}.${slot}: a roleless slot is paint or media and carries h (or a line)`);
      assert.equal(typeof sl.y, 'number', `${name}.${slot}.y`);
      assert.ok(typeof sl.x === 'number' || typeof sl.right === 'number', `${name}.${slot}: x or right`);
      assert.ok(typeof sl.w === 'number' || sl.w === 'auto', `${name}.${slot}.w`);
      if (typeof sl.w === 'number' && sl.role) assert.ok(sl.x + sl.w <= 900 && sl.x >= 60, `${name}.${slot} inside the 60px margins`);
      else if (typeof sl.w === 'number') assert.ok(sl.x + sl.w <= 960 && sl.x >= 0, `${name}.${slot}: paint or media may bleed to the canvas edge, never past it`);
    }
  }
  assert.ok(Object.keys(LIBRARY['kpi-grid'].slots).filter(s => /^kpi\d$/.test(s)).length === 3 && Object.keys(LIBRARY['kpi-grid-4'].slots).filter(s => /^kpi\d$/.test(s)).length === 4, 'three or four tiles');
  for (const n of ['kpi-grid', 'kpi-grid-4']) for (const k of [1, 2, 3]) for (const s of [`kpi${k}`, `kpi${k}-label`, `kpi${k}-delta`]) assert.ok(LIBRARY[n].slots[s], `${n}.${s}: value + label + delta`);
  for (const s of ['supertitle', 'title', 'chart', 'takeaway', 'source']) assert.ok(LIBRARY.chart.slots[s], 'chart: ' + s);
  assert.equal(LIBRARY.stat.slots.stat.role, 'Stat', 'stat is the hero number');
});

const boxOf = sl => ({x: sl.x, y: sl.y, w: sl.w, h: sl.h ?? NEUTRAL_LH[sl.role]});
const inside = (t, p) => t.x >= p.x && t.x + t.w <= p.x + p.w && t.y >= p.y && t.y + t.h <= p.y + p.h;
const five = (slots, stem) => [1, 2, 3, 4, 5].map(k => slots[`${stem}${k}`]);

test('library: the three agenda covers are openers at reading density, a Title-role title on each, every slot inside the canvas', () => {
  for (const name of COVERS) {
    const lay = LIBRARY[name];
    assert.ok(lay, name + ' is in the library');
    assert.equal(lay.group, 'openers', name); assert.equal(lay.density, 'reading', name + ': five items are over the speaker budget');
    assert.equal(lay.slots.title.role, 'Title', name); assert.equal(lay.slots.supertitle.role, 'Supertitle', name); assert.equal(lay.slots.body.role, 'Body', name);
    assert.match(lay.use, /hide the footer/, name + ': a panel owns the foot, so the use line says to hide the footer');
    for (const [slot, sl] of Object.entries(lay.slots)) assert.ok(inside(boxOf(sl), {x: 0, y: 0, w: 960, h: 540}), `${name}.${slot} inside the 960×540 cut`);
    const keys = Object.keys(lay.slots), firstText = keys.findIndex(k => lay.slots[k].role);
    assert.ok(keys.slice(firstText).every(k => lay.slots[k].role), name + ': paint slots come first, so a fill in slot order never paints over text');
    assert.ok(!keys.some(k => k in DENSE), name + ': no dense chrome on a cover');
  }
  assert.deepEqual(Object.keys(LIBRARY).filter(n => LIBRARY[n].group === 'openers'), ['cover', 'agenda', 'section', ...COVERS, ...Object.keys(BATCH2).filter(n => BATCH2[n].group === 'openers')]);
});

test('library: cover-agenda-rail — a rail over the left 34% with five numbered, timed items; the title block in the right 66%', () => {
  const s = LIBRARY['cover-agenda-rail'].slots, rail = boxOf(s.rail);
  assert.deepEqual(s.rail, {x: 0, y: 0, w: 326, h: 540, bg: 'var(--fg)'}, '34% of 960, full height, the inverse of the ground');
  assert.deepEqual(Object.keys(s), ['rail', 'rail-label', ...[1, 2, 3, 4, 5].flatMap(k => [`n${k}`, `item${k}`, `time${k}`]), 'total', 'supertitle', 'title', 'body', 'caption']);
  for (const k of ['rail-label', 'total', ...[1, 2, 3, 4, 5].flatMap(k => [`n${k}`, `item${k}`, `time${k}`])]) assert.ok(inside(boxOf(s[k]), rail), k + ' sits on the rail');
  for (const k of ['supertitle', 'title', 'body', 'caption']) assert.ok(s[k].x >= rail.w + 24, k + ' sits right of the rail');
  assert.equal(s['rail-label'].role, 'Label'); assert.equal(s.total.role, 'Label'); assert.equal(s.caption.role, 'Caption');
  for (const [i, sl] of five(s, 'item').entries()) {
    const n = s[`n${i + 1}`], t = s[`time${i + 1}`];
    assert.equal(sl.role, 'Body'); assert.equal(n.role, 'Label'); assert.equal(t.role, 'Caption');
    assert.equal(sl.color, 'var(--card)', 'the item reads on the inverse rail');
    assert.equal(centreY(n), centreY(sl), `n${i + 1} on its item's line`); assert.equal(centreY(t), centreY(sl), `time${i + 1} on its item's line`);
    assert.equal(t.align, 'right'); assert.equal(t.nowrap, 1); assert.ok(n.x + n.w <= sl.x && sl.x + sl.w <= t.x, 'number, item, duration left to right');
    if (i) assert.equal(sl.y - s[`item${i}`].y, 44, 'a 44px pitch: one line of Body and 20px of air');
  }
  assert.ok(s.item5.y + NEUTRAL_LH.Body < s.total.y && s['rail-label'].y + NEUTRAL_LH.Label < s.item1.y, 'label above the list, total under it');
  assert.equal(s.title.h, 4 * NEUTRAL_LH.Title, 'room for four lines of Title in the 526px column'); assert.equal(s.title.valign, 'bottom', 'a shorter title sits on the purpose line, in the lower middle');
  assert.ok(s.supertitle.y + NEUTRAL_LH.Supertitle < s.title.y && s.title.y + s.title.h <= s.body.y && s.body.y + 2 * NEUTRAL_LH.Body <= s.caption.y, 'supertitle, the title, a two-line purpose, the presenter line');
});

test('library: cover-contents-column — an accent panel over the left 73%, a ground-colour column of five slide-numbered sections on the right', () => {
  const s = LIBRARY['cover-contents-column'].slots, panel = boxOf(s.panel), column = boxOf(s.column);
  assert.deepEqual(s.panel, {x: 0, y: 0, w: 701, h: 540, bg: 'var(--accent)'}, '73% of 960, full height, the brand colour');
  assert.deepEqual(s.column, {x: 701, y: 0, w: 259, h: 540, bg: 'var(--card)'}, 'the remaining 27%, the ground colour');
  assert.deepEqual(Object.keys(s), ['panel', 'column', 'supertitle', 'title', 'body', 'column-label', ...[1, 2, 3, 4, 5].flatMap(k => [`page${k}`, `section${k}`])]);
  for (const k of ['supertitle', 'title', 'body']) { assert.ok(inside(boxOf(s[k]), panel), k + ' sits on the panel'); assert.equal(s[k].color, 'var(--card)', k + ' reads on the accent'); }
  for (const k of ['column-label', ...[1, 2, 3, 4, 5].flatMap(k => [`page${k}`, `section${k}`])]) assert.ok(inside(boxOf(s[k]), column), k + ' sits in the column');
  assert.equal(s['column-label'].role, 'Label');
  for (const [i, sl] of five(s, 'section').entries()) {
    const p = s[`page${i + 1}`];
    assert.equal(sl.role, 'Body'); assert.equal(p.role, 'Label');
    assert.ok(p.y + NEUTRAL_LH.Label <= sl.y && sl.y - p.y <= 24, `page${i + 1} is the caption above section${i + 1}`);
    if (i) assert.ok(sl.y - s[`section${i}`].y >= 2 * NEUTRAL_LH.Body + NEUTRAL_LH.Label, 'a two-line section name clears the next page caption');
  }
  assert.equal(s.title.h, 4 * NEUTRAL_LH.Title, 'room for four lines of Title'); assert.equal(s.title.valign, 'middle'); assert.equal(centreY(s.title), 270, 'the title is centred on the canvas');
  assert.ok(s.supertitle.y + NEUTRAL_LH.Supertitle < s.title.y && s.title.y + s.title.h <= s.body.y && s.body.y + 2 * NEUTRAL_LH.Body <= 540, 'supertitle at the top, the title in the middle, the purpose at the bottom');
});

test('library: cover-agenda-strip — the title block in the top 76%, an inverse strip over the bottom 24% cut into five equal columns', () => {
  const s = LIBRARY['cover-agenda-strip'].slots, strip = boxOf(s.strip);
  assert.deepEqual(s.strip, {x: 0, y: 410, w: 960, h: 130, bg: 'var(--fg)'}, '24% of 540, full width, the inverse of the ground');
  assert.deepEqual(Object.keys(s), ['strip', 'rule2', 'rule3', 'rule4', 'rule5', 'supertitle', 'title', 'body', ...[1, 2, 3, 4, 5].flatMap(k => [`n${k}`, `item${k}`, `time${k}`])]);
  assert.equal(s.title.h, 3 * NEUTRAL_LH.Title, 'room for three lines of Title at the content width'); assert.equal(s.title.valign, 'bottom', 'a shorter title sits on the purpose line');
  assert.ok(s.supertitle.y + NEUTRAL_LH.Supertitle < s.title.y && s.title.y + s.title.h <= s.body.y && s.body.y + 2 * NEUTRAL_LH.Body <= strip.y, 'supertitle, the title and a two-line purpose end above the strip');
  const xs = five(s, 'item').map(sl => sl.x);
  assert.deepEqual(xs.slice(1).map((x, i) => x - xs[i]), [172, 172, 172, 172], 'five equal columns across the content width');
  assert.equal(xs[0], 60); assert.equal(xs[4] + s.item5.w, 900);
  for (const k of [1, 2, 3, 4, 5]) {
    const n = s[`n${k}`], item = s[`item${k}`], time = s[`time${k}`];
    assert.equal(n.role, 'Label'); assert.equal(item.role, 'Body'); assert.equal(time.role, 'Caption');
    for (const sl of [n, item, time]) { assert.ok(inside(boxOf(sl), strip), `column ${k} sits on the strip`); assert.equal(sl.x, xs[k - 1]); assert.equal(sl.w, 152); }
    assert.ok(n.y + NEUTRAL_LH.Label < item.y && item.y + NEUTRAL_LH.Body <= time.y, 'the number at the top, the name over its duration at the bottom');
    assert.equal(item.color, 'var(--card)', 'the name reads on the inverse strip');
    if (k > 1) { const r = s[`rule${k}`]; assert.ok(!r.role && r.w === 1 && r.y === strip.y && r.h === strip.h, `rule${k} is a full-height hairline`); assert.ok(r.x > xs[k - 2] + 152 && r.x < xs[k - 1], `rule${k} sits in the gutter before column ${k}`); }
  }
  assert.ok(s.time5.y + NEUTRAL_LH.Caption <= 514, 'the fifth column ends above the counter pin a hidden footer leaves in the corner');
});

const agendaCover = (name, rows, n = 3) => ({w: 960, h: 540, title: 'covers', slides: [{id: 'open', layout: name, hide: [], els: [
  ...Object.keys(LIBRARY[name].slots).filter(k => !LIBRARY[name].slots[k].role && !/^rule[45]$/.test(k)).map(slot => ({slot})),
  {slot: 'supertitle', text: 'Plumbline'}, {slot: 'title', text: 'Supplier funding verification'}, {slot: 'body', text: 'Decide whether to pilot on one funding desk.'}, ...rows],
}, ...Array.from({length: n}, (_, i) => ({id: `s${i + 2}`, layout: 'statement', els: [{slot: 'title', text: `Part ${i + 1}`}]}))]});

test('library: each agenda cover is a words slide by kind and binds only the items it has — three of five validate with no error and no warning', () => {
  const three = {
    'cover-agenda-rail': [1, 2, 3].flatMap(k => [{slot: `n${k}`, text: String(k)}, {slot: `item${k}`, text: 'Pilot scope'}, {slot: `time${k}`, text: '7 min'}]),
    'cover-contents-column': [1, 2, 3].flatMap(k => [{slot: `page${k}`, text: `Slide ${k + 1}`}, {slot: `section${k}`, text: 'Pilot scope'}]),
    'cover-agenda-strip': [1, 2, 3].flatMap(k => [{slot: `n${k}`, text: String(k)}, {slot: `item${k}`, text: 'Pilot scope'}, {slot: `time${k}`, text: '7 min'}]),
  };
  for (const name of COVERS) {
    const d = create(agendaCover(name, three[name])).deck, v = validate(d);
    assert.deepEqual(v.errors, [], name + ': ' + v.errors.join(' | ')); assert.deepEqual(v.warnings, [], name + ': ' + v.warnings.join(' | '));
    assert.ok(!d.slides[0].els.some(r => /4$|5$/.test(r.slot || '')), name + ': no fourth or fifth row exists');
    const loose = create(agendaCover(name, three[name])).deck; loose.slides[0].els = loose.slides[0].els.filter(r => LIBRARY[name].slots[r.slot].role);
    assert.ok(validate(loose).errors.some(m => /not the paint slot/.test(m)), name + ': text bound without its panel is an error');
  }
});

test('library: cover-contents-column sections link into the deck — a bound section and its page take the engine\'s own #slide href', () => {
  const rows = good => [1, 2, 3].flatMap(k => [{slot: `page${k}`, text: `Slide ${k + 1}`, href: `#${k + 1}`}, {slot: `section${k}`, text: 'Pilot scope', href: good ? `#s${k + 1}` : `#s${k + 7}`}]);
  const made = create(agendaCover('cover-contents-column', rows(true)));
  const v = validate(made.deck);
  assert.deepEqual(v.errors, [], v.errors.join(' | ')); assert.deepEqual(v.warnings, [], v.warnings.join(' | '));
  assert.deepEqual(made.deck.slides[0].els.filter(r => /^section\d$/.test(r.slot || '')).map(r => r.href), ['#s2', '#s3', '#s4'], 'the href stays on the row');
  assert.match(LIBRARY['cover-contents-column'].use, /link/, 'the use line says the sections link');
  const bad = validate(create(agendaCover('cover-contents-column', rows(false))).deck);
  assert.equal(bad.errors.filter(m => /names no slide/.test(m)).length, 3, bad.errors.join(' | '));
});

test('library: the nineteen reviewed layouts — group, density, slot names in order, panel boxes, every slot inside the canvas', () => {
  assert.equal(Object.keys(BATCH2).length, 19);
  for (const [name, want] of Object.entries(BATCH2)) {
    const lay = LIBRARY[name];
    assert.ok(lay, name + ' is in the library');
    assert.equal(lay.group, want.group, name + ' group'); assert.equal(lay.density, want.density, name + ' density');
    assert.deepEqual(Object.keys(lay.slots), want.slots, name + ' slots');
    for (const [slot, box] of Object.entries(want.panels)) assert.deepEqual(lay.slots[slot], box, `${name}.${slot}`);
    assert.match(lay.use, /hide the footer/, name + ': the layout fills the slide, so the use line says to hide the footer');
    if (want.links) assert.match(lay.use, /link/, name + ': the use line says the sections link');
    const keys = Object.keys(lay.slots), firstText = keys.findIndex(k => lay.slots[k].role);
    assert.ok(keys.slice(firstText).every(k => lay.slots[k].role), name + ': paint slots come first');
    for (const [slot, sl] of Object.entries(lay.slots)) {
      assert.ok(inside(boxOf(sl), FULL), `${name}.${slot} inside the 960×540 cut`);
      if (sl.role && (sl.align === 'right' || sl.x + sl.w > 820)) assert.ok(sl.y + (sl.h ?? NEUTRAL_LH[sl.role]) <= 514 || sl.x + sl.w <= 820, `${name}.${slot} ends above the counter pin a hidden footer leaves in the corner`);
    }
    assert.ok(!keys.some(k => k in DENSE), name + ': no dense chrome');
  }
});

test('library: the nineteen reviewed layouts stay inside their density — a fully bound slide carries no more points than the budget', () => {
  for (const name of Object.keys(BATCH2)) {
    const s = fill(name), d = LIBRARY[name].density;
    assert.equal(densityReport({...s, els: s.els.map(r => r.text ? {...r, text: 'word'} : r)}, LIBRARY, d), null, `${name} at ${d}`);
  }
});

test('library: each reviewed layout is a words slide by kind and validates with no error and no warning, fully bound', () => {
  for (const name of Object.keys(BATCH2)) {
    const {textOnly, hide, ...slide} = fill(name);
    const v = validate(create({w: 960, h: 540, title: 'batch', slides: [slide]}).deck);
    assert.deepEqual(v.errors, [], name + ': ' + v.errors.join(' | ')); assert.deepEqual(v.warnings, [], name + ': ' + v.warnings.join(' | '));
  }
});

test('library: a panel that holds text is an error when the text is bound without it', () => {
  for (const [name, want] of Object.entries(BATCH2)) {
    const holders = Object.keys(want.panels).filter(k => !/rule/.test(k));
    if (!holders.length) continue;
    const {hide, ...s} = fill(name);
    const v = validate(create({w: 960, h: 540, title: 'loose', slides: [{...s, els: s.els.filter(r => !holders.includes(r.slot))}]}).deck);
    for (const h of holders) assert.ok(v.errors.some(m => m.includes(`not the paint slot "${h}"`)), `${name}.${h}: ${v.errors.join(' | ')}`);
  }
});

test('library: section entries link into the deck on every reviewed layout that lists sections', () => {
  const linked = Object.keys(BATCH2).filter(n => BATCH2[n].links);
  assert.deepEqual(linked, ['cover-front-page', 'cover-contents-page', 'cover-three-bands', 'cover-section-rows', 'memo', 'letter', 'brief-sheet']);
  for (const name of linked) {
    const deck = to => ({w: 960, h: 540, title: 'links', slides: [{...fill(name), hide: undefined, els: fill(name).els.map(r => /^(section|page)\d$/.test(r.slot) ? {...r, href: to(+r.slot.slice(-1))} : r)},
      ...[2, 3, 4, 5, 6].map(n => ({id: `s${n}`, layout: 'statement', els: [{slot: 'title', text: `Part ${n}`}]}))]});
    const good = create(deck(k => `#s${k + 1}`)).deck, v = validate(good);
    assert.deepEqual(v.errors, [], name + ': ' + v.errors.join(' | ')); assert.deepEqual(v.warnings, [], name + ': ' + v.warnings.join(' | '));
    assert.deepEqual(good.slides[0].els.filter(r => /^section\d$/.test(r.slot || '')).map(r => r.href), ['#s2', '#s3', '#s4', '#s5', '#s6'], name + ': the href stays on the row');
    const bad = validate(create(deck(k => `#s${k + 20}`)).deck);
    assert.ok(bad.errors.filter(m => /names no slide/.test(m)).length >= 5, name + ': ' + bad.errors.join(' | '));
  }
});

// ── U5.1 / U5.2: the missing starting rungs — a plain bullet page, and points beside an image
const LH = NEUTRAL_LH;   // the neutral scale, one line of each role

test('library: bullets — six Body slots down the left, one line apart, each carrying the engine\'s dot', () => {
  const b = LIBRARY.bullets;
  assert.equal(b.group, 'text'); assert.equal(b.density, 'reading');
  assert.equal(b.slots.title.role, 'H1'); assert.equal(b.slots.supertitle.role, 'Supertitle');
  const keys = Object.keys(b.slots).filter(k => /^b\d$/.test(k));
  assert.deepEqual(keys, ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'], 'four to six points, six slots');
  for (const k of keys) {
    const sl = b.slots[k];
    assert.equal(sl.role, 'Body', k); assert.equal(sl.bullet, 1, k + ': the engine draws its dot');
    assert.equal(sl.x, 96, k + ': indented 36px so the dot (1.25em) clears the margin');
    assert.equal(sl.w, 780, k);
  }
  const ys = keys.map(k => b.slots[k].y);
  assert.deepEqual(ys, [160, 204, 248, 292, 336, 380], 'a 44px pitch: one line of Body and 20px of air');
  assert.ok(ys.at(-1) + LH.Body + 4 <= b.slots.note.y, 'the last point clears the note');
  for (const n of ['image-left', 'image-right']) {
    const lay = LIBRARY[n];
    assert.deepEqual(Object.keys(lay.slots).filter(k => /^b\d$/.test(k)), ['b1', 'b2', 'b3', 'b4'], n + ': four points beside the image');
    assert.ok(lay.slots.body, n + ': the paragraph slot stays');
    for (const k of ['b1', 'b2', 'b3', 'b4']) assert.equal(lay.slots[k].bullet, 1, `${n}.${k}`);
    assert.equal(lay.slots.b1.x, lay.slots.body.x + 36, n + ': the points are indented from the paragraph column');
    assert.ok(lay.slots.b4.y + LH.Body + 4 <= lay.slots.note.y, n + ': four points and a note both fit the panel');
  }
});

test('library: no dense slot collides — subtitle · note · source · legend clear every other slot of their layout', () => {
  const box = sl => {
    if (sl.w === 'auto' || (sl.x == null && sl.right == null)) return null;   // a w:auto slot has no declared width to compare
    const w = sl.w, x = sl.right != null ? 960 - sl.right - w : sl.x;
    return {x, y: sl.y, w, h: sl.h ?? LH[sl.role] ?? 0};
  };
  const hits = (A, B) => Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) > 0.5 && Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) > 0.5;
  for (const [name, lay] of Object.entries(LIBRARY)) for (const k of Object.keys(DENSE)) {
    const A = lay.slots[k] && box(lay.slots[k]); if (!A) continue;
    for (const [n2, sl2] of Object.entries(lay.slots)) {
      if (n2 === k) continue;
      const B = box(sl2); if (!B) continue;
      assert.ok(!hits(A, B), `${name}: dense slot ${k} (${A.x},${A.y} ${A.w}×${A.h}) collides with ${n2} (${B.x},${B.y} ${B.w}×${B.h})`);
    }
  }
});

test('library: a bullet page binds only the points it has — four bullets, four dot-bearing rows, no fifth', () => {
  const m = {w: 960, h: 540, slides: [{layout: 'bullets', textOnly: true, els: [{slot: 'supertitle', text: 'The close'}, {slot: 'title', text: 'Four things the close waits on'},
    {slot: 'subtitle', text: 'Each one is a person waiting for a file.'},
    {slot: 'b1', text: 'The bank feed posts overnight.'}, {slot: 'b2', text: 'Card statements land on the third day.'},
    {slot: 'b3', text: 'Two subsidiaries send spreadsheets.'}, {slot: 'b4', text: 'Sign-off needs two directors.'},
    {slot: 'source', text: 'Source · close log, six months'}]}]};
  const {deck: d} = create(m);
  const v = validate(d);
  assert.deepEqual(v.errors, []); assert.deepEqual(v.warnings, []);
  const rows = d.slides[0].els.filter(r => /^b\d$/.test(r.slot || ''));
  assert.equal(rows.length, 4, 'four bound bullets');
  assert.ok(!d.slides[0].els.some(r => r.slot === 'b5' || r.slot === 'b6'), 'no fifth or sixth row exists to carry a fifth dot');
  for (const r of rows) assert.equal(d.layouts.bullets[r.slot].bullet, 1, r.slot + ': the slot carries the marker');
  assert.equal(d.layouts.bullets.b5.bullet, 1, 'b5 still declares its marker — unbound, it draws nothing at all');
});

test('library: a column carries the paragraph or the points — binding both is an error', () => {
  const both = {w: 960, h: 540, slides: [{layout: 'image-left', els: [{slot: 'title', text: 'Built for the hour before work.'},
    {slot: 'body', text: 'A paragraph beside the photo.'}, {slot: 'b1', text: 'And a point beside it too.'}]}]};
  const v = validate(create(both).deck);
  assert.ok(v.errors.some(m => /binds "body" and b1/.test(m)), v.errors.join(' | '));
  const points = {w: 960, h: 540, slides: [{layout: 'image-left', els: [{slot: 'title', text: 'Built for the hour before work.'},
    {slot: 'b1', text: 'Most runs start before half past six.'}, {slot: 'b2', text: 'A median run is thirty-four minutes.'},
    {slot: 'b3', text: 'One buzz a kilometre, no screen.'}, {slot: 'source', text: 'Source · activity log'}]}]};
  assert.deepEqual(validate(create(points).deck).errors, []);
});

test('library: the bullets layout answers to both densities — three points at speaker, six at reading', () => {
  const slide = n => ({layout: 'bullets', els: [{slot: 'supertitle', text: 'The close'}, {slot: 'title', text: 'What the close waits on'},
    ...Array.from({length: n}, (_, i) => ({slot: `b${i + 1}`, text: `A wait on somebody else, number ${i + 1}.`}))]});
  assert.equal(densityReport(slide(3), LIBRARY, 'speaker'), null, 'three points is a speaker slide');
  assert.ok(densityReport(slide(4), LIBRARY, 'speaker'), 'four points is not');
  const dense = slide(6); dense.els.push({slot: 'source', text: 'Source · close log'});
  assert.equal(densityReport(dense, LIBRARY, 'reading'), null, 'six points with a source is a reading slide');
});

test('library: a deck using every layout validates clean — and a deck-defined layout of the same name wins', () => {
  const v = validate(create(everyLayout()).deck);
  assert.deepEqual(v.errors, []); assert.deepEqual(v.warnings, []);
  const own = {w: 960, h: 540, layouts: {cover: {title: {x: 10, y: 10, w: 500, role: 'H1'}}}, slides: [{layout: 'cover', els: [{slot: 'title', text: 'mine'}]}]};
  const d = create(own).deck;
  assert.deepEqual(d.layouts.cover, own.layouts.cover, 'the deck keeps its own cover');
  assert.deepEqual(Object.keys(d.layouts), ['cover'], 'only referenced names are merged');
  assert.deepEqual(validate(d).errors, []);
});

test('library: create merges only the layouts a slide references, scaled to the canvas', () => {
  const d = create({w: 960, h: 540, slides: [{layout: 'two-cols', els: [{slot: 'title', text: 'x'}]}]}).deck;
  assert.deepEqual(Object.keys(d.layouts), ['two-cols']);
  assert.deepEqual(d.layouts['two-cols'].right, LIBRARY['two-cols'].slots.right);
  const big = create({slides: [{layout: 'two-cols', els: [{slot: 'title', text: 'x'}]}]}, {space: '1600x900'}).deck;
  const s = LIBRARY['two-cols'].slots.right, b = big.layouts['two-cols'].right;
  assert.deepEqual([b.x, b.y, b.w], [s.x, s.y, s.w].map(v => Math.round(v * 1600 / 960)), '1600×900 scales the geometry 1.67×');
  assert.equal(b.role, s.role);
  assert.deepEqual(libraryFor({w: 960, h: 540, slides: [{els: []}]}), {}, 'nothing referenced → nothing merged');
});

test('library: an unknown layout still errors, and the error lists the library names', () => {
  const v = validate(create({w: 960, h: 540, slides: [{layout: 'hero-bento', els: []}]}).deck);
  assert.equal(v.errors.length, 1);
  assert.match(v.errors[0], /layout "hero-bento" not in deck\.layouts or the library \(cover, agenda, .*, end\)/);
});

test('library: a slide mixes a library layout with free rows (and nudges a slot with its own x/y)', () => {
  const m = {w: 960, h: 540, slides: [{layout: 'kpi-grid', textOnly: true, els: [
    {slot: 'title', text: 'Renewals'},
    {slot: 'kpi1', text: '63%'}, {slot: 'kpi1-label', text: 'renewed'},
    {slot: 'kpi2', text: '41'}, {slot: 'kpi2-label', text: 'days early', y: 296},
    {x: 60, y: 400, w: 400, role: 'Caption', text: 'a free caption row beside the tiles'},
    {x: 500, y: 400, line: [900, 400], h: 1, bg: 'var(--line)'},
  ]}]};
  const v = validate(create(m).deck);
  assert.deepEqual(v.errors, []); assert.deepEqual(v.warnings, []);
});

test('library: the catalogue printer lists every layout with its group, use and slots; validate --layouts prints it', () => {
  const c = catalogue();
  for (const g of GROUPS) assert.ok(c.includes(g), g);
  for (const [name, lay] of Object.entries(LIBRARY)) {
    assert.ok(c.includes(name), name); assert.ok(c.includes(lay.use), name + ' use');
    for (const s of Object.keys(lay.slots)) assert.ok(c.includes(s), `${name}.${s}`);
  }
  const r = spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), '--layouts'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, c + '\n');
});

// U2.2 — an agent placing a free row beside a bound slot reads the printed geometry, never lib/layouts.mjs
test('library: the catalogue prints every slot box and the free band under the chrome', () => {
  const c = catalogue();
  for (const [name, lay] of Object.entries(LIBRARY)) {
    const fa = freeArea(lay);
    assert.ok(c.includes(`free: x ${fa.x} y ${fa.y} w ${fa.w} h ${fa.h}`), name + ' free band');
    for (const [s, sl] of Object.entries(lay.slots)) {
      const x = sl.right != null ? 'r' + sl.right : String(sl.x ?? 0);
      assert.match(c, new RegExp('^ +' + s + ' +\\S+ +' + x + ' +' + (sl.y ?? 0) + ' +' + String(sl.w ?? '-').replace(/[-]/g, '\\-'), 'm'), `${name}.${s} box`);
    }
  }
  assert.match(c, /960×540 cut/, 'the cut the numbers are in');
});

test('library: the free band starts under the lowest chrome slot and ends at the foot', () => {
  const content = freeArea(LIBRARY.content);
  assert.deepEqual(content, {x: 60, y: DENSE.subtitle.y + NEUTRAL_LH.H2, w: 840, h: COUNTER.y - (DENSE.subtitle.y + NEUTRAL_LH.H2)},
    'a dense layout: under the subtitle, above the counter reserve (the note is a caption seat per layout since K17, none on the bare canvas)');
  for (const [name, lay] of Object.entries(LIBRARY)) {
    const fa = freeArea(lay);
    assert.ok(fa.h > 0, name + ' has a band');
    for (const n of ['supertitle', 'title', 'subtitle']) if (lay.slots[n]) assert.ok(lay.slots[n].y < fa.y, `${name}.${n} is chrome, above the band`);
    for (const n of ['note', 'source', 'legend', 'footer']) if (lay.slots[n]) assert.ok(lay.slots[n].y >= fa.y + fa.h, `${name}.${n} is foot, below the band`);
  }
});

test('library: the dense subtitle is regular weight, independent of H2 (K8) — size, colour and nowrap stay put', () => {
  const roles = JSON.parse(fs.readFileSync(path.join(root, 'template.html'), 'utf8').match(/\/\*DECK\*\/([\s\S]*?)\/\*\/DECK\*\//)[1]).styles.roles;
  assert.equal(DENSE.subtitle.weight, 400, 'DENSE.subtitle carries its own weight');
  assert.notEqual(DENSE.subtitle.weight, roles.H2.weight, `a bound weight must not equal the role's own (H2 is ${roles.H2.weight})`);
  assert.equal(DENSE.subtitle.role, 'H2', 'still the H2 role for size and leading');
  assert.equal(DENSE.subtitle.color, 'var(--muted)', 'still muted');
  assert.equal(DENSE.subtitle.nowrap, 1, 'still one line');
  for (const [name, lay] of Object.entries(LIBRARY)) {
    const sl = lay.slots.subtitle;
    if (sl) assert.equal(sl.weight, 400, `${name}.subtitle is regular weight, not the bold H2 default`);
  }
});

test('library: NEUTRAL_LH is the template scale — the printed geometry cannot drift from the runtime', () => {
  const roles = JSON.parse(fs.readFileSync(path.join(root, 'template.html'), 'utf8').match(/\/\*DECK\*\/([\s\S]*?)\/\*\/DECK\*\//)[1]).styles.roles;
  for (const [r, v] of Object.entries(roles)) assert.equal(NEUTRAL_LH[r], v.lh, r + ' leading');
});

test('library: the counter owns the corner — COUNTER is the reserve, and no dense or right-anchored slot enters it on any layout', () => {
  assert.deepEqual(COUNTER, {right: 60, y: 466, w: 96, h: 74}, 'the bottom-right corner of the 960×540 cut: the right foot from y 466 down');
  assert.equal(DENSE.legend.right, COUNTER.right + COUNTER.w + 12, 'the legend keeps its right alignment, left of the reserve plus a 12px gap');
  const LH = NEUTRAL_LH;
  const cx = 960 - COUNTER.right - COUNTER.w;
  for (const [name, lay] of Object.entries(LIBRARY)) for (const [slot, sl] of Object.entries(lay.slots)) {
    if (!(slot in DENSE) && sl.right == null) continue;
    if (sl.foot) continue;   // K17: a foot-line row is seated by the engine beside the footer's text, clear of the counter
    const x1 = sl.right != null ? 960 - sl.right : sl.x + sl.w, y1 = sl.y + (sl.h ?? LH[sl.role] ?? 0);
    assert.ok(x1 <= cx || y1 <= COUNTER.y || sl.y >= COUNTER.y + COUNTER.h, `${name}.${slot} enters the counter reserve (ends x ${x1}, y ${y1})`);
  }
  const doc = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  assert.match(doc.slice(doc.indexOf('## LAYOUT LIBRARY')), /`COUNTER`/, 'the layout contract names the reserve');
});

test('library: SKILL.md documents the catalogue and the mixing rule', () => {
  const doc = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  const sec = doc.slice(doc.indexOf('## LAYOUT LIBRARY'));
  assert.ok(sec.length > 500, 'a LAYOUT LIBRARY section');
  for (const n of NAMES) assert.ok(new RegExp('`' + n + '`').test(sec), n + ' in the catalogue table');
  assert.match(sec, /validate\.mjs --layouts/); assert.match(sec, /free rows/); assert.match(sec, /override/);
});

live('live: four bullets draw four dots and no fifth — in chromium and in webkit, the dot outside the row\'s own box', async () => {
  const m = {w: 960, h: 540, title: 'dots', slides: [{layout: 'bullets', textOnly: true, els: [{slot: 'title', text: 'Four things the close waits on'},
    ...[1, 2, 3, 4].map(n => ({slot: `b${n}`, text: `A wait on somebody else, number ${n}.`}))]}]};
  const f = path.join(tmp, 'dots.html'); fs.writeFileSync(f, create(m).html);
  for (const name of ['chromium', 'webkit']) {
    const b = await pw[name].launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(pathToFileURL(f).href); await p.waitForTimeout(200);
    const seen = await p.evaluate(() => [...document.querySelectorAll('#canvas .el.bul')].map(el => {
      const m = getComputedStyle(el, '::before');
      return {w: parseFloat(m.width), h: parseFloat(m.height), left: parseFloat(m.left), paints: m.content === '""' && m.position === 'absolute'};
    }));
    assert.equal(seen.length, 4, name + ': one dot-bearing row per bound bullet');
    for (const d of seen) { assert.ok(d.paints, name + ': the marker is drawn'); assert.ok(Math.abs(d.w - 8) < 1 && Math.abs(d.h - 8) < 1, `${name}: an 8px dot at Body, got ${d.w}×${d.h}`); assert.ok(Math.abs(d.left + 20) < 1, `${name}: 20px left of the row box, got ${d.left}`); }
    assert.deepEqual(errs, [], name + ': zero page errors');
    await b.close();
  }
  const r = await verify(f, {out: path.join(tmp, 'v-dots'), strict: true, log: () => {}});
  assert.deepEqual(r.errors, [], JSON.stringify(r.parity.filter(x => !x.pass)));
});

live('live: a deck using every library layout renders — parity holds, zero page errors; so does the mixed slide', async () => {
  for (const [n, m] of [['every-layout', everyLayout()], ['mixed', {w: 960, h: 540, slides: [{layout: 'kpi-grid', textOnly: true, els: [
    {slot: 'title', text: 'Renewals'}, {slot: 'kpi1', text: '63%'}, {slot: 'kpi1-label', text: 'renewed'}, {slot: 'kpi1-delta', text: '↑ 8 pts'},
    {x: 60, y: 400, w: 400, role: 'Caption', text: 'a free caption row beside the tiles'}, {x: 500, y: 400, line: [900, 400], h: 1, bg: 'var(--line)'}]}]}]]) {
    const f = path.join(tmp, n + '.html'); fs.writeFileSync(f, create(m).html);
    const r = await verify(f, {out: path.join(tmp, 'v-' + n), strict: true, log: () => {}});
    assert.deepEqual(r.errors, [], n + ': ' + JSON.stringify(r.parity.filter(p => !p.pass)));
    assert.equal(r.parity.length, m.slides.length);
  }
});

// ── S2. A paint slot cannot vanish. A layout's paint slot (`h`, no `role`) draws nothing unless a row binds it, and a
// card's box must be painted BEFORE its own text or it covers it. Two study builds bound a card's text and not its box;
// one shipped a decision slide whose cards were loose text on empty canvas, and both gates passed it.
const decision = (els, extra = {}) => ({w: 960, h: 540, title: 'cards', slides: [{layout: 'three-up-cards', els: [
  {slot: 'title', text: 'Three ways to close the gap'}, ...els], ...extra}]});
const cardText = n => [{slot: `card${n}-number`, text: `0${n}`}, {slot: `card${n}-head`, text: `Option ${n}`}, {slot: `card${n}-body`, text: 'What it costs and what it buys.'}];
const cardBox = n => ({slot: `card${n}`});

test('layouts: binding a card\'s text and not its box is an error that names the row to add', () => {
  const bad = validate(create(decision([...cardText(1), cardBox(2), ...cardText(2)])).deck);
  const m = bad.errors.filter(e => /card1/.test(e));
  assert.equal(m.length, 1, bad.errors.join(' | '));
  assert.match(m[0], /slides\[0\]/);
  assert.match(m[0], /card1-number|card1-head|card1-body/, 'the bound text rows are named: ' + m[0]);
  assert.match(m[0], /\{"slot":\s*"card1"\}/, 'the row to add is spelled out: ' + m[0]);
  assert.ok(!bad.errors.some(e => /card2/.test(e)), 'card2 binds its box and is clean: ' + bad.errors.join(' | '));
  // the fix passes
  const good = validate(create(decision([cardBox(1), ...cardText(1), cardBox(2), ...cardText(2)])).deck);
  assert.deepEqual(good.errors, [], good.errors.join(' | '));
});

test('layouts: a paint slot bound AFTER its own text is a warning — the box would cover the words', () => {
  const late = validate(create(decision([...cardText(1), cardBox(1)])).deck);
  assert.deepEqual(late.errors, [], late.errors.join(' | '));
  const w = late.warnings.filter(m => /card1/.test(m) && /after/.test(m));
  assert.equal(w.length, 1, late.warnings.join(' | '));
  assert.match(w[0], /els\[\d+\]/, 'the message points at the rows: ' + w[0]);
  assert.ok(!validate(create(decision([cardBox(1), ...cardText(1)])).deck).warnings.some(m => /card1/.test(m) && /after/.test(m)));
});

test('layouts: the check only fires where a paint slot provably holds its group\'s text', () => {
  // team-grid's photo sits ABOVE its name, timeline's dot above its label: a missing photo or dot is not text on empty canvas
  const team = validate(create({w: 960, h: 540, title: 't', slides: [{layout: 'team-grid', els: [
    {slot: 'title', text: 'Who is on it'}, {slot: 'name1', text: 'R. Vance'}, {slot: 'role1', text: 'Operations'}]}]}).deck);
  assert.deepEqual(team.errors, [], team.errors.join(' | '));
  const tl = validate(create({w: 960, h: 540, title: 't', slides: [{layout: 'timeline', els: [
    {slot: 'title', text: 'The year'}, {slot: 't1', text: 'March'}, {slot: 'e1', text: 'Pilot opens'}]}]}).deck);
  assert.deepEqual(tl.errors, [], tl.errors.join(' | '));
  // a free row the author paints themselves, carrying the card's group, counts as the box
  const own = validate(create(decision([{x: 60, y: 168, w: 264, h: 240, bg: 'var(--card)', radius: 10, group: 'card1'}, ...cardText(1)])).deck);
  assert.ok(!own.errors.some(e => /card1/.test(e)), own.errors.join(' | '));
});

live('live: the fixed decision slide paints its three cards; the buggy one paints none', async () => {
  const painted = create(decision([cardBox(1), ...cardText(1), cardBox(2), ...cardText(2), cardBox(3), ...cardText(3)])).html;
  const loose = create(decision([...cardText(1), ...cardText(2), ...cardText(3)])).html;
  const boxes = async html => { const f = path.join(tmp, 'cards-' + html.length + '.html'); fs.writeFileSync(f, html);
    const b = await pw.chromium.launch(); const p = await b.newPage({viewport: {width: 1280, height: 800}});
    await p.goto(pathToFileURL(f).href); await p.waitForTimeout(200);
    const n = await p.evaluate(() => [...document.querySelectorAll('#canvas .el')].filter(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return !el.textContent.trim() && r.width > 200 && r.height > 150 && s.backgroundColor !== 'rgba(0, 0, 0, 0)';
    }).length);
    await b.close(); return {n, f}; };
  assert.equal((await boxes(painted)).n, 3, 'three card boxes painted');
  assert.equal((await boxes(loose)).n, 0, 'the bug: text on empty canvas');
});

// ── F10: a list layout takes a logo, an image or an icon per item through `<item>-media`, bound IN PLACE of the item's marker
const MEDIA_LAYOUTS = {agenda: ['item', 'n', 5], 'process-steps': ['step', 'n', 4], timeline: ['d', 'd', 4], 'three-up-cards': ['card', 'card', 3], 'proof-strip': ['logo', 'logo', 5]};
const marker = (name, k) => ({agenda: `n${k}`, 'process-steps': `n${k}`, timeline: `d${k}`, 'three-up-cards': `card${k}-number`, 'proof-strip': `logo${k}-name`})[name];
const centreY = sl => sl.y + (sl.h ?? NEUTRAL_LH[sl.role]) / 2;
test('library: media — each list layout carries one <item>-media slot per item, roleless and unpainted, centred on the marker it replaces', () => {
  for (const [name, [item, , n]] of Object.entries(MEDIA_LAYOUTS)) {
    const slots = LIBRARY[name].slots, media = Object.keys(slots).filter(s => /-media$/.test(s));
    assert.deepEqual(media, [...Array(n)].map((_, i) => `${item}${i + 1}-media`), name + ': one per item, in order');
    for (const [i, s] of media.entries()) {
      const sl = slots[s], mk = slots[marker(name, i + 1)];
      assert.ok(!sl.role && !sl.bg && sl.w > 0 && sl.h > 0, `${name}.${s}: a media box`);
      assert.equal(centreY(sl), centreY(mk), `${name}.${s}: centred on ${marker(name, i + 1)}`);
      if (name === 'agenda') assert.equal(slots[`item${i + 1}`].x - (sl.x + sl.w), 8, 'agenda: one 8px gutter before the item');
    }
  }
  for (const [name, l] of Object.entries(LIBRARY)) for (const [s, sl] of Object.entries(l.slots || {}))
    if (/-media$/.test(s)) assert.ok(sl.h >= MEDIA_MIN && sl.w >= MEDIA_MIN, `${name}.${s}: a media slot is at least ${MEDIA_MIN}px (K11)`);
  const cat = catalogue();
  assert.match(cat, /item1-media +media +78 +150 +24 +24/);
});
const MARK = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><rect width="40" height="20" fill="#123"/></svg>');
test('library: media — binding an icon, an img or a logo in place of every marker validates clean', () => {
  for (const kind of ['icon', 'img', 'logo']) for (const name of Object.keys(MEDIA_LAYOUTS)) {
    const s = fill(name);
    const els = s.els.filter(r => !/^(n\d|card\d-number|logo\d-name)$/.test(r.slot) && !(name === 'timeline' && /^d\d$/.test(r.slot)));
    for (const slot of Object.keys(LIBRARY[name].slots).filter(x => /-media$/.test(x))) {
      const sl = LIBRARY[name].slots[slot];
      els.push(kind === 'icon' ? {slot, icon: 'factory'} : kind === 'img' ? {slot, img: MARK, fit: 'contain'} : {slot, logo: MARK, h: sl.h, col: sl.w});
    }
    const r = validate(create({w: 960, h: 540, title: 'media', slides: [{...s, els}]}).deck);
    assert.deepEqual(r.errors, [], `${name} ${kind}: ${r.errors.join(' | ')}`);
    assert.deepEqual(r.warnings.filter(w => /from els|overlaps/.test(w)), [], `${name} ${kind}: ${r.warnings.join(' | ')}`);
  }
});

// K26: the table-insight TEMPLATE (lib/templates/cat-modern.mjs) and the table-insight LAYOUT above shared one id with two
// different slot sets — the template binds no note, so a deck that assumed the layout's note slot got a bare "not in
// layout" error with no hint the names were two different things. The template renamed to 'table-panel'; 'table-insight'
// stays as a deprecated alias (same rows) so an old deck still builds, and the error a bound note now gets names the
// layout it actually resolves to ('content'), not the ambiguous template id.
test('library: table-insight the LAYOUT still has a note slot; table-panel the TEMPLATE (ex table-insight) does not share it', () => {
  assert.ok(LIBRARY['table-insight'] && LIBRARY['table-insight'].slots.note, 'the layout table-insight keeps its note slot');
});
test('library: the table-panel template resolves via layout "content", which has no note — a bound note names that layout', () => {
  const d = {w: 960, h: 540, title: 't', styles: {roles: Object.fromEntries(ROLES.map(r => [r, {font: 'sans-serif', size: 16, weight: 400, lh: 20, ls: 0, color: '#000'}]))},
    slides: [{template: 'table-panel', els: [{slot: 'note', text: 'a note', role: 'Label'}]}]};
  const r = validate(d);
  assert.ok(r.errors.some(m => /slot "note" not in layout "content"/.test(m)), `names the resolved layout: ${r.errors.join(' | ')}`);
});
test('library: template "table-insight" is a deprecated alias for "table-panel" — same rows, still builds', async () => {
  const {TEMPLATE} = await import('../lib/templates.mjs');
  assert.equal(TEMPLATE['table-insight'].deprecated, 'table-panel');
  assert.deepEqual(TEMPLATE['table-insight'].els, TEMPLATE['table-panel'].els, 'the alias draws exactly what table-panel draws');
  const r = validate(create({w: 960, h: 540, title: 'alias', slides: [{template: 'table-insight'}]}).deck);
  assert.deepEqual(r.errors, [], `an old deck naming table-insight still validates: ${r.errors.join(' | ')}`);
});
// #161: the warning printed on every command, since loading the template module built the alias's sample rows
test('library: the table-insight deprecation warning prints only for a model that names it, and once', () => {
  const run = (...args) => spawnSync(process.execPath, args, {cwd: root, encoding: 'utf8'}).stderr;
  const make = id => `import {create} from './bin/create.mjs'; const d = {w: 960, h: 540, title: 'w', slides: [{template: '${id}'}, {template: '${id}'}]}; create(d);`;
  assert.doesNotMatch(run('bin/validate.mjs', '--templates'), /deprecated/, 'the catalogue names no deprecated template');
  assert.doesNotMatch(run('--input-type=module', '-e', make('table-panel')), /deprecated/, 'a deck without the old id builds silently');
  assert.equal(run('--input-type=module', '-e', make('table-insight')).match(/template "table-insight" is deprecated/g)?.length, 1, 'the old id warns once per process');
});
