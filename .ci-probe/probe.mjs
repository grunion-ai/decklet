import http from 'node:http';
import path from 'node:path';
const WT = path.resolve(process.argv[2]), RUNS = +(process.argv[3] || 10), ID = process.argv[4] || 'p';
const pw = await import('file://' + WT + '/node_modules/playwright/index.mjs');
const {create} = await import('file://' + WT + '/bin/create.mjs');
const model = () => ({w: 960, h: 540, title: 'probe', slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}, {x: 60, y: 200, w: 400, role: 'Body', text: 'body one'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'Two'}]},
]});
const served = create(model()).html;
const server = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(served); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const settled = p => p.waitForFunction(() => document.getElementById('autosave').dataset.state !== 'busy', null, {timeout: 15000});
const spy = () => { window.__w = []; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (this === localStorage && k === KEY) window.__w.push([Math.round(performance.timeOrigin + performance.now()), JSON.parse(v).slides[0].els[0].text]); return o.call(this, k, v); }; };
const has = p => p.evaluate(() => { try { return JSON.parse(localStorage.getItem(KEY)).slides[0].els[0].text; } catch (e) { return String(e); } });
const until = (p, fn, ms = 15000) => p.waitForFunction(fn, null, {timeout: ms});
let bad = 0, good = 0, errs = 0;
for (let run = 0; run < RUNS; run++) {
  const b = await pw.firefox.launch();
  try {
    const ctx = await b.newContext(), url = `http://127.0.0.1:${server.address().port}/${ID}-${run}.html`, t = {id: ID, run};
    const A = await ctx.newPage(); await A.goto(url); await A.evaluate(() => localStorage.clear()); await A.reload(); await settled(A);
    const B = await ctx.newPage(); await B.goto(url); await settled(B);
    await A.evaluate(spy); await B.evaluate(spy);
    await B.evaluate(() => nav(1));
    await A.evaluate(() => { snap(); slide().els[1].x = 123; save(); });
    await until(B, () => deck.slides[0].els[1].x === 123);
    await B.evaluate(() => { nav(-1); sel.clear(); sel.add(0); render(); edit(0); }); await B.keyboard.type('typed in B');
    await A.evaluate(() => { snap(); slide().els[1].y = 250; save(); });
    await until(B, () => deck.slides[0].els[1].y === 250);
    await until(A, () => deck.slides[0].els[0].text === 'typed in B');
    t.first = await has(A);
    const s = Date.now();
    try { await until(A, () => JSON.parse(localStorage.getItem(KEY)).slides[0].els[0].text === 'typed in B', 2000); t.poll2s = true; } catch { t.poll2s = false; }
    t.pollMs = Date.now() - s;
    if (t.first !== 'typed in B' || !t.poll2s) {
      t.aNow = await has(A); t.bNow = await has(B);
      const C = await ctx.newPage(); await C.goto(url + '?fresh'); t.freshNow = await has(C).catch(e => String(e)); await C.close();
      const r = Date.now(); let reads = 0;
      while (Date.now() - r < 30000 && await has(A) !== 'typed in B') { reads++; await new Promise(x => setTimeout(x, 100)); }
      t.settledMs = Date.now() - r; t.reads = reads; t.aEnd = await has(A); t.bEnd = await has(B);
      t.aWrites = await A.evaluate(() => window.__w); t.bWrites = await B.evaluate(() => window.__w);
      t.aFocus = await A.evaluate(() => [document.hidden, document.hasFocus()]);
    }
    const flagged = t.first !== 'typed in B' || !t.poll2s;
    if (flagged) { bad++; console.log('FLAG ' + JSON.stringify(t)); } else good++;
    await ctx.close();
  } catch (e) { errs++; console.log('ERR ' + ID + ' ' + run + ' ' + String(e).slice(0, 200)); }
  await b.close();
}
console.log(`DONE ${ID} good ${good} bad ${bad} errs ${errs}`);
server.close();
