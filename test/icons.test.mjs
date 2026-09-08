// decklet icon gate — `icon:'name'` rows expand at create time into inline Lucide SVG (ISC, lucide.dev) coloured by
// tokens; the runtime draws nothing new. An unknown name is an error that lists the set. Only the icons a deck uses
// reach the file.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validate} from '../bin/validate.mjs';
import {create} from '../bin/create.mjs';
import {ICONS, expandIcons, iconSvg} from '../lib/icons.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const v = m => validate(create(m).deck);
const deck = els => ({w: 960, h: 540, title: 'ico', slides: [{els}]});

test('icons: a curated Lucide set ships, every entry is path markup on the 24 grid', () => {
  const names = Object.keys(ICONS);
  assert.ok(names.length >= 150, names.length + ' icons');
  for (const n of ['check', 'zap', 'shield-check', 'trending-up', 'users', 'lightbulb', 'clock', 'target']) assert.ok(ICONS[n], n);
  for (const [n, v] of Object.entries(ICONS)) assert.ok(/^<(path|rect|circle|line|polyline|polygon|ellipse)/.test(v) && !/<svg|<script|data-mi|class=/.test(v), n + ' is bare shapes');
});

test('icons: iconSvg wraps the shapes in a 24-grid stroke svg in currentColor', () => {
  const s = iconSvg('check');
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"/);
  assert.match(s, /stroke-linecap="round" stroke-linejoin="round"/);
  assert.equal(iconSvg('no-such'), null);
});

test('icons: expand — an icon row becomes an svg row keeping x/y/w/h/color/group; a missing size defaults to 24', () => {
  const d = deck([{icon: 'zap', x: 60, y: 100, w: 32, h: 32, color: 'var(--accent)', group: 'g1'}, {icon: 'check', x: 100, y: 100}]);
  expandIcons(d);
  const [a, b] = d.slides[0].els;
  assert.equal(a.icon, undefined); assert.match(a.svg, /^<svg/); assert.equal(a.w, 32); assert.equal(a.color, 'var(--accent)'); assert.equal(a.group, 'g1');
  assert.equal(b.w, 24); assert.equal(b.h, 24);
});

test('icons: validate — an unknown icon is an error listing the set; a known one passes; create inlines it', () => {
  const r = v(deck([{icon: 'no-such', x: 60, y: 100}]));
  assert.ok(r.errors.some(m => /icon "no-such"/.test(m) && /check/.test(m)), r.errors.join(' | '));
  assert.deepEqual(v(deck([{icon: 'check', x: 60, y: 100}])).errors, []);
  const {html} = create(deck([{icon: 'rocket', x: 60, y: 100, w: 40, h: 40}]));
  assert.match(html, /viewBox=\\"0 0 24 24\\"|viewBox="0 0 24 24"/);
  assert.ok(!html.includes('"icon":"rocket"'), 'the icon row was consumed');
});

test('icons: validate --icons prints the names', () => {
  const out = spawnSync(process.execPath, [path.join(root, 'bin/validate.mjs'), '--icons'], {encoding: 'utf8'});
  assert.equal(out.status, 0); assert.match(out.stdout, /shield-check/); assert.match(out.stdout, /users/);
});

test('icons: SKILL.md carries the graphics rules — icons, glyphs, images, figures, clips', () => {
  const doc = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  assert.match(doc, /## GRAPHICS/); assert.match(doc, /`icon`/); assert.match(doc, /--icons/); assert.match(doc, /Lucide/);
  for (const w of ['glyph', 'image', 'figure', 'clip']) assert.match(doc, new RegExp(w, 'i'), w);
});
