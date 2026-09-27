// K5: verify measures layout parity in WebKit as well as Chromium, and warns on font stacks that resolve per engine.
// Kyle's case: the Label role starts with ui-monospace, Safari resolves it to SF Mono (wider), Chromium skips it for Menlo;
// a label wrapped to three lines in Safari and hit a bar while verify (Chromium only) passed.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {create} from '../bin/create.mjs';
import {verify, fontWarnings} from '../bin/verify.mjs';
let pw = null; try { pw = await import('playwright'); } catch {}
const hasWebkit = !!pw && fs.existsSync(pw.webkit.executablePath());
const live = hasWebkit ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-webkit-'));

test('fontWarnings flags a role whose stack starts with an engine-resolved family, and only those', () => {
  const deck = {styles: {roles: {
    Label: {font: 'ui-monospace,Menlo,monospace'}, Body: {font: "'system-ui', sans-serif"}, Caption: {font: ' UI-Serif , Georgia'},
    Stat: {font: 'ui-sans-serif'}, H1: {font: 'Menlo, ui-monospace, monospace'}, H2: {font: 'Inter, sans-serif'}}}};
  const w = fontWarnings(deck);
  assert.deepEqual(w.map(x => x.role).sort(), ['Body', 'Caption', 'Label', 'Stat']);
  assert.match(w.find(x => x.role === 'Label').msg, /Label.*ui-monospace/);
  assert.deepEqual(fontWarnings({}), []);
});

// a label that fits one line in Chromium and wraps onto the caption under it in WebKit only. The WebKit-only width comes from
// a feature query Chromium fails (hanging-punctuation), standing in for SF Mono so the test holds on any OS.
// K26: the engine default Label no longer leads with ui-monospace (it trips this very warning on every unbranded deck), so
// Kyle's case is reproduced here explicitly instead of riding the default — the rest of the roles are the engine's own.
const model = {w: 960, h: 540, title: 'webkit', styles: {roles: {
  Label: {font: 'ui-monospace,Menlo,Consolas,monospace', size: 11, weight: 500, lh: 14, ls: 1, color: 'var(--muted)', tt: 'uppercase', cw: 0.69},
  Caption: {font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", size: 13, weight: 400, lh: 18, ls: 0, color: 'var(--muted)', cw: 0.47}}},
  slides: [{els: [
  {x: 60, y: 100, w: 320, role: 'Label', text: 'part library'},
  {x: 60, y: 112, w: 600, role: 'Caption', text: 'the caption sitting right under the label'}]}]};
const build = name => { const f = path.join(tmp, name);
  fs.writeFileSync(f, create(model).html.replace('</style>', '@supports (hanging-punctuation:first){#canvas .el[data-n="0"]{letter-spacing:24px!important}}</style>')); return f; };

live('a WebKit-only wrap fails verify: Chromium passes, WebKit reports the collision per engine, the font-stack warning fires', async () => {
  const r = await verify(build('wrap.html'), {log: () => {}});   // default: WebKit runs on every OS now (K20)
  assert.ok(r.parity.every(s => s.pass), 'Chromium parity passes');
  assert.ok(r.engines.webkit.some(s => !s.pass), 'WebKit parity fails');
  const row = r.engines.webkit[0].rows.find(o => o.n === '0'); assert.ok(row.lines > 1, 'the label wraps in WebKit'); assert.match(row.problems.join(), /overlaps text 1/);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /webkit/i.test(e) && /layout parity failed/.test(e)), r.errors.join(' | '));
  assert.ok(!r.errors.some(e => /^layout parity failed on/.test(e)), 'the Chromium line stays clean');
  assert.ok(r.warnings.some(w => /Label.*ui-monospace/.test(w)), 'default Label stack warns');
  assert.ok(fs.existsSync(path.join(path.dirname(r.file), 'verify-out', 'webkit', '01-slide-1.png')), 'WebKit shots land in their own folder');
});

// K20: the default runs WebKit on every OS whenever it is installed — CI is Linux, and parity has to hold there, not only on a
// laptop before push.
live('the default runs WebKit on every OS', async () => {
  const r = await verify(build('auto.html'), {log: () => {}});
  assert.ok(r.engines.webkit, 'WebKit ran'); assert.equal(r.ok, false);
});

live('webkit:false skips the WebKit pass and says so', async () => {
  const r = await verify(build('skip.html'), {webkit: false, log: () => {}});
  assert.equal(r.ok, true, r.errors.join(' | '));
  assert.equal(r.engines.webkit, undefined);
  assert.ok(r.skipped.some(s => /webkit/i.test(s)));
});

