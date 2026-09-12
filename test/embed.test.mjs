// decklet embedded — live proofs (Playwright, skipped when absent) for a deck hosted inside another page. A node:http server
// inside the test serves the built deck and three hosts: an iframe on the same origin, an iframe from a second site
// (localhost hosting 127.0.0.1 — a cross-site frame, where browsers partition or refuse storage), and a srcdoc frame.
// Same origin and srcdoc: an edit survives a reload of the host. Cross-site: the deck lands on a tier that persists or says
// red — never an error, in Chromium and WebKit alike.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {create} from '../bin/create.mjs';

let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const model = () => ({w: 960, h: 540, title: 'embedded', slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}, {x: 60, y: 200, w: 400, role: 'Body', text: 'body one'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Two'}]},
]});
const deck = create(model()).html;
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const host = src => `<!DOCTYPE html><title>host</title><style>iframe{width:900px;height:600px;border:1px solid #888}</style><h1>host page</h1><iframe id="deck" src="${src}"></iframe>`;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/deck.html') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(deck); }
  if (u.pathname === '/host.html') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(host(u.searchParams.get('src'))); }
  if (u.pathname === '/srcdoc.html') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(`<!DOCTYPE html><title>host</title><iframe id="deck" style="width:900px;height:600px" srcdoc="${esc(deck)}"></iframe>`); }
  res.statusCode = 404; res.end('no');
});
await new Promise(r => server.listen(0, r)); const port = server.address().port; // no host → dual-stack where the OS has it, so localhost and 127.0.0.1 both reach it
test.after(() => server.close());
const at = (h, p) => `http://${h}:${port}${p}`;
const watch = p => { p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') p.errs.push('console: ' + m.text()); }); return p; };
const frameOf = async p => { const el = await p.waitForSelector('#deck'); const fr = await el.contentFrame(); await fr.waitForSelector('#canvas .el'); await fr.waitForFunction(() => document.getElementById('autosave').dataset.state !== 'busy', null, {timeout: 4000}); return fr; };
const state = fr => fr.evaluate(() => [document.getElementById('autosave').dataset.state, TIER, document.body.classList.contains('nostore')]);

for (const bn of ['chromium', 'webkit']) live(`same-origin iframe (${bn}): an edit inside the frame survives a reload of the host`, async () => {
  const b = await pw[bn].launch(); const p = watch(await b.newPage({viewport: {width: 1200, height: 800}}));
  await p.goto(at('127.0.0.1', '/host.html?src=/deck.html')); let fr = await frameOf(p);
  await fr.evaluate(() => { try { localStorage.clear(); } catch {} }); await p.reload(); fr = await frameOf(p);
  assert.deepEqual(await state(fr), ['ok', 'local', false], 'localStorage works in a same-origin frame');
  await fr.evaluate(() => { snap(); slide().els[1].x = 222; save(); }); await p.waitForTimeout(150);
  await p.reload(); fr = await frameOf(p);
  assert.deepEqual(await fr.evaluate(() => [slide().els[1].x, log.length]), [222, 1], 'the edit came back inside the frame');
  assert.deepEqual(p.errs, []); await b.close();
});

for (const bn of ['chromium', 'webkit']) live(`cross-site iframe (${bn}): localhost hosting 127.0.0.1 — a tier that persists, or an honest red dot; never an error`, async () => {
  const b = await pw[bn].launch(); const p = watch(await b.newPage({viewport: {width: 1200, height: 800}}));
  await p.goto(at('localhost', '/host.html?src=' + encodeURIComponent(at('127.0.0.1', '/deck.html')))); let fr = await frameOf(p);
  assert.notEqual(await fr.evaluate(() => location.hostname), await p.evaluate(() => location.hostname), 'fixture: two sites');
  const s0 = await state(fr); assert.ok(['ok', 'bad'].includes(s0[0]), `settled: ${s0}`);
  await fr.evaluate(() => { snap(); slide().els[1].x = 333; save(); }); await p.waitForTimeout(300);
  await p.reload(); fr = await frameOf(p);
  const s1 = await state(fr), x = await fr.evaluate(() => slide().els[1].x);
  if (s1[1] === 'mem') assert.deepEqual([s1[0], s1[2], x], ['bad', true, 60], `the deck says so: ${s1}`);
  else assert.deepEqual([x, ['ok', 'local'].includes(s1[0])], [333, true], `the ${s1[1]} tier kept the edit (${s1})`);
  assert.deepEqual(p.errs, []); await b.close();
});

for (const bn of ['chromium', 'webkit']) live(`srcdoc iframe (${bn}): the deck inlined in the host's own markup keeps its edits across a reload`, async () => {
  const b = await pw[bn].launch(); const p = watch(await b.newPage({viewport: {width: 1200, height: 800}}));
  await p.goto(at('127.0.0.1', '/srcdoc.html')); let fr = await frameOf(p);
  await fr.evaluate(() => { try { localStorage.clear(); } catch {} }); await p.reload(); fr = await frameOf(p);
  const s0 = await state(fr); assert.notEqual(s0[1], 'mem', `srcdoc inherits the host's origin, so a tier persists: ${s0}`);
  await fr.evaluate(() => { snap(); slide().els[1].x = 444; save(); }); await p.waitForTimeout(300);
  await p.reload(); fr = await frameOf(p);
  assert.equal(await fr.evaluate(() => slide().els[1].x), 444, 'the edit came back');
  assert.deepEqual(p.errs, []); await b.close();
});
