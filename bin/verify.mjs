#!/usr/bin/env node
// decklet verify — proof harness for a built deck.html.
//   1. model contract (bin/validate.mjs)                              always, no browser
//   2. LAYOUT PARITY in a real browser (Playwright, optional devDep)  always when Playwright is installed
//        every text row: no overflow (scrollWidth ≤ clientWidth), nowrap rows render ONE line, rows imported from HTML render the
//        source line count (data-lines), every element stays inside the canvas, zero page errors
//   3. AE pixel diff vs reference PNGs (ImageMagick `magick`/`compare`)  only when --refs is given
// usage: node bin/verify.mjs deck.html [--refs dir] [--out dir] [--threshold 0.5] [--fuzz 2%] [--report model.report.json] [--fonts <css url>] [--strict]
//   --report: the importer's drift report (default: model.report.json beside the deck) — masks where the mockup drew its chrome
//   --fonts: a webfont stylesheet injected at TEST time only (the deck stays self-contained) so the AE shot uses the reference's font build
//   refs: <slide.name>.png, <n>.png (1-based) or slide-<n>.png
// exit 0 = PASS. Writes <out>/results.json (+ per-slide PNGs).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {validate} from './validate.mjs';

export const modelOf = html => JSON.parse(html.match(/\/\*DECK\*\/([\s\S]*?)\/\*\/DECK\*\//)[1].replace(/<\\\/script/g, '</script'));

export async function verify(file, {refs = null, out = null, threshold = 0.5, fuzz = '2%', strict = false, report = null, fonts = null, log = console.log} = {}) {
  const html = fs.readFileSync(file, 'utf8');
  const res = {file, contract: null, parity: [], ae: [], errors: [], skipped: []};
  // self-containment — the guarantee the whole engine rests on
  if (/(src|href)\s*=\s*["']https?:/i.test(html) || /@import|<link[^>]+stylesheet|fetch\s*\(|XMLHttpRequest|new\s+WebSocket/i.test(html)) res.errors.push('deck references the network');
  const deck = modelOf(html);
  const v = validate(deck); res.contract = v;
  if (!v.ok) res.errors.push(`model contract: ${v.errors.length} errors`);
  if (strict && v.warnings.length) res.errors.push(`model contract: ${v.warnings.length} warnings (--strict)`);
  let chromium; try { ({chromium} = await import('playwright')); } catch { res.skipped.push('layout parity + AE: Playwright not installed (npm i -D playwright && npx playwright install chromium)'); }
  if (chromium) {
    out = out || path.join(path.dirname(path.resolve(file)), 'verify-out'); fs.mkdirSync(out, {recursive: true});
    const W = deck.w, H = deck.h;
    const b = await chromium.launch(); const p = await b.newPage({viewport: {width: W + 100, height: H + 100}, deviceScaleFactor: 1});
    const pageErrors = []; p.on('pageerror', e => pageErrors.push(String(e)));
    await p.goto(pathToFileURL(path.resolve(file)).href); await p.waitForTimeout(300);
    await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(300); // verify the SHIPPED model, not a stale local edit
    await p.addStyleTag({content: '#canvas{transform:none!important;border:0!important;border-radius:0!important;position:absolute!important;left:0;top:0} .el{animation:none!important}'});
    const N = deck.slides.length;
    const repFile = report || path.join(path.dirname(path.resolve(file)), 'model.report.json');
    const rep = fs.existsSync(repFile) ? JSON.parse(fs.readFileSync(repFile, 'utf8')) : null; // importer's drift report: where the mockup drew its chrome
    if (fonts) { await p.addStyleTag({url: fonts}); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200); } // TEST-TIME only: pin the AE shot to the reference's webfont build
    await p.addStyleTag({content: '#canvas .num{visibility:hidden}'}); // the counter is engine chrome the mockups never had; parity still measures it
    const hasMagick = !!refs && (() => { try { execFileSync('magick', ['-version'], {stdio: 'pipe'}); return true; } catch { return false; } })();
    if (refs && !hasMagick) res.skipped.push('AE: ImageMagick `magick` not on PATH');
    for (let n = 0; n < N; n++) {
      await p.evaluate(k => { i = k; sel.clear(); render(); }, n); await p.waitForTimeout(150);
      const name = deck.slides[n].name || `slide-${n + 1}`;
      const bad = await p.evaluate(([W, H]) => {
      // collision: ink drawn THROUGH a text row — the defect a human sees instantly and no other gate catches. The engine marks
      // its own ink (data-seg = a line, data-cur = a curve, data-ink = a thin rule/dot); a card, tile, bar, donut or backdrop is
      // something text sits ON, never a collision. A stroke is sampled along its real path, so a diagonal leader line is judged by
      // where it is drawn and not by its bounding square. `over:1` declares a deliberate overlay.
      const cvr = document.getElementById('canvas').getBoundingClientRect();
      const bez = (a, b, c, e, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * e; };
      const ink = [...document.querySelectorAll('#canvas .el[data-seg],#canvas .el[data-cur],#canvas .el[data-ink]')].filter(d => d.dataset.over == null).map(d => {
        const key = d.dataset.n ?? ('m:' + d.dataset.m), pt = (x, y) => ({x: cvr.left + x, y: cvr.top + y}), pts = [];
        if (d.dataset.seg) { const [x1, y1, x2, y2, th] = d.dataset.seg.split(',').map(Number);
          for (let k = 0; k <= 80; k++) pts.push(pt(x1 + (x2 - x1) * k / 80, y1 + (y2 - y1) * k / 80));
          return {key, pts, t: th / 2 + 1}; }
        if (d.dataset.cur) { const [x1, y1, c1x, c1y, c2x, c2y, x2, y2, th] = d.dataset.cur.split(',').map(Number);
          for (let k = 0; k <= 80; k++) { const u = k / 80; pts.push(pt(bez(x1, c1x, c2x, x2, u), bez(y1, c1y, c2y, y2, u))); }
          return {key, pts, t: th / 2 + 1}; }
        const b = d.getBoundingClientRect();   // a thin rule or dot: axis-aligned, sample its own footprint
        for (let k = 0; k <= 40; k++) { const u = k / 40; pts.push({x: b.left + b.width * u, y: b.top + b.height * u}, {x: b.left + b.width * u, y: b.bottom - b.height * u}); }
        return {key, pts, t: Math.min(b.width, b.height) / 2 + 1};
      }).map(q => { const d = [...document.querySelectorAll('#canvas .el[data-seg],#canvas .el[data-cur],#canvas .el[data-ink]')].find(x => (x.dataset.n ?? ('m:' + x.dataset.m)) === q.key);
        return {...q, head: d && d.dataset.head};   // which end carries an arrow, so the gate can ask where the head landed
      });
      // container edges the engine declared. `over:1` opts a row out of both new checks, as it does for stroke-over-text.
      const chrome = [...document.querySelectorAll('#canvas .el[data-chrome]')].filter(d => d.dataset.over == null)
        .map(d => ({key: d.dataset.n ?? ('m:' + d.dataset.m), b: d.getBoundingClientRect()}));
      // an arrow HEAD terminating inside a fill is a defect (the connector was aimed at a centre, not stopped on the edge);
      // a headless stroke crossing the same box is routing. A LANDING means the connector crossed INTO the box — it starts
      // outside and ends inside. A box that holds both ends is the container the diagram lives in, not the thing pointed at.
      // Depth tolerance covers the border and its antialiasing.
      const headHits = [], within = (p, b) => p.x > b.left && p.x < b.right && p.y > b.top && p.y < b.bottom;
      for (const q of ink) { if (!q.head) continue;
        for (const [on, p, o] of [[q.head !== 'start', q.pts.at(-1), q.pts[0]], [q.head !== 'end', q.pts[0], q.pts.at(-1)]]) { if (!on) continue;
          for (const c of chrome) if (!within(o, c.b) && p.x > c.b.left + 4 && p.x < c.b.right - 4 && p.y > c.b.top + 4 && p.y < c.b.bottom - 4) headHits.push({key: q.key, on: c.key});
        } }
      return [...document.querySelectorAll('#canvas .el')].map(d => {
        const r = d.getBoundingClientRect(), cv = document.getElementById('canvas').getBoundingClientRect();
        const o = {text: (d.textContent || '').trim().slice(0, 40), n: d.dataset.n ?? ('m:' + d.dataset.m), problems: [], ...(d.dataset.snapped ? {snapped: 1} : {})};
        const textual = !!(d.textContent || '').trim() && !d.querySelector('svg,img');
        if (textual) {
          const rg = document.createRange(); rg.selectNodeContents(d); const tops = [];
          for (const x of rg.getClientRects()) { if (!x.width && !x.height) continue; if (!tops.some(t => Math.abs(t - x.top) < 2)) tops.push(x.top); }
          const lines = tops.length || 1;
          if (d.scrollWidth > d.clientWidth + 1) o.problems.push(`overflows its box (${d.scrollWidth}>${d.clientWidth})`);
          if (d.style.whiteSpace === 'nowrap' && lines > 1) o.problems.push(`nowrap row renders ${lines} lines`);
          if (d.dataset.lines && +d.dataset.lines !== lines) o.problems.push(`source had ${d.dataset.lines} line(s), renders ${lines}`);
          o.lines = lines;
          if (d.dataset.over == null && (ink.length || chrome.length)) {
            // glyph rects carry the line box's leading; inset it so a rule sitting just under a heading is not a "collision".
            // TWO samples inside = the stroke passes THROUGH the glyphs; one = it merely touches an edge (a leader pointing at a label).
            const gl = [...rg.getClientRects()].filter(x => x.width > 1 && x.height > 1).map(x => ({l: x.left, r: x.right, t: x.top + x.height * .15, b: x.bottom - x.height * .15}));
            const hit = ink.filter(q => q.pts.filter(z => gl.some(g => z.x > g.l - q.t && z.x < g.r + q.t && z.y > g.t - q.t && z.y < g.b + q.t)).length >= 2);
            if (hit.length) o.problems.push('overlapped by ' + hit.map(q => q.key).join(','));
            // …and text must be wholly inside a container or wholly outside it. Straddling an edge is the other shape a human
            // sees instantly: a label crossing a tile's border, or hanging half out of the box that is supposed to hold it.
            const TOL = 2, cross = chrome.filter(c => gl.some(g => {
              const inside = g.l >= c.b.left - TOL && g.r <= c.b.right + TOL && g.t >= c.b.top - TOL && g.b <= c.b.bottom + TOL;
              const outside = g.r <= c.b.left + TOL || g.l >= c.b.right - TOL || g.b <= c.b.top + TOL || g.t >= c.b.bottom - TOL;
              return !inside && !outside;
            }));
            if (cross.length) o.problems.push('straddles ' + cross.map(c => c.key).join(','));
          }
        }
        const hh = headHits.filter(x => x.key === o.n);
        if (hh.length) o.problems.push('arrow lands inside ' + [...new Set(hh.map(x => x.on))].join(',') + ' — terminate it with to:/from:');
        if (r.right > cv.left + W + 1 || r.bottom > cv.top + H + 1 || r.left < cv.left - 1 || r.top < cv.top - 1) o.problems.push('outside the canvas');
        return o;
      }).filter(o => o.problems.length); }, [W, H]);
      // a row the type scale changed (imported with _src) may wrap or crowd differently from its source: that is a consequence of the
      // scale, not a layout fault — reported as scale crowding for a human decision, never a failure. Everything else stays hard.
      // …only when it renders FEWER lines (collapsed runs); more lines or overflow means the importer's fit cap failed — hard
      const soft = o => o.snapped && o.problems.every(x => { const m = /^source had (\d+) line\(s\), renders (\d+)/.exec(x); return m && +m[2] < +m[1]; });
      res.parity.push({slide: n + 1, name, pass: !bad.some(o => !soft(o)), rows: bad.filter(o => !soft(o)), crowding: bad.filter(soft)});
      const act = path.join(out, `${String(n + 1).padStart(2, '0')}-${name}.png`);
      await p.locator('#canvas').screenshot({path: act});
      if (hasMagick) {
        const ref = [`${name}.png`, `${n + 1}.png`, `slide-${n + 1}.png`].map(f => path.join(refs, f)).find(f => fs.existsSync(f));
        if (!ref) { res.ae.push({slide: n + 1, name, skipped: 'no reference'}); continue; }
        // `compare` exits 1 whenever the images differ and prints "AE (normalised)" on stderr — parse the leading number; never fall back to 0
        const ae = (a, b, args, diff) => { const num = t => { const m = /^\s*(\d+(?:\.\d+)?)/.exec(t); return m ? +m[1] : NaN; }; const argv = ['compare', '-metric', 'AE', ...args, a, b, diff || path.join(out, `${String(n + 1).padStart(2, '0')}-${name}.diff.png`)]; try { return num(execFileSync('magick', argv, {stdio: 'pipe'}).toString()) || 0; } catch (e) { const v = num(e.stderr.toString()); if (Number.isNaN(v)) throw new Error('magick compare: ' + e.stderr.toString().trim()); return v; } };
        const PAD = 6, mask = (src, dst, rects) => execFileSync('magick', [src, '-fill', 'black', ...rects.flatMap(r => ['-draw', `rectangle ${Math.floor(r[0] - PAD)},${Math.floor(r[1] - PAD)} ${Math.ceil(r[0] + r[2] + PAD)},${Math.ceil(r[1] + r[3] + PAD)}`]), dst]);
        const pct = v => +(v / (W * H) * 100).toFixed(3), raw = ae(ref, act, ['-fuzz', fuzz]);
        // imported decks deviate from their mockups ON PURPOSE: chrome is deck-wide (mockup drift normalised away) and rows the type
        // scale changed were snapped. Mask both — where the engine drew them and where the mockup drew them — and pass on what is left:
        // everything the engine was asked to reproduce verbatim. Hand-authored decks have no master drift / _src, so all three columns agree.
        const geo = await p.evaluate(() => {
          const c = canvas.getBoundingClientRect(), R = d => { const r = d.getBoundingClientRect(); return [r.left - c.left, r.top - c.top, r.width, r.height]; };
          const chrome = [...canvas.querySelectorAll('.el[data-m]')].map(R), conflicts = [], s = deck.slides[i];
          s.els.forEach((e, k) => { const d = canvas.querySelector(`[data-n="${k}"]`); if (!d) return; const a = R(d), bx = e._box || a;
            const u = [Math.min(a[0], bx[0]), Math.min(a[1], bx[1])]; u.push(Math.max(a[0] + a[2], bx[0] + (bx[2] || 0)) - u[0], Math.max(a[1] + a[3], bx[1] + (bx[3] || a[3])) - u[1]);
            if (e.slot === 'supertitle') chrome.push(u); else if (e._src) conflicts.push(u); });
          return {chrome, conflicts};
        });
        for (const x of (rep?.normalised || [])) if (x.slide === name && x.what === 'rect') geo.chrome.push([x.from[0], x.from[1], x.from[2] === 'auto' ? 400 : x.from[2], x.from[3] || 24]);
        const masked = geo.chrome.length || geo.conflicts.length, stem = path.join(out, `${String(n + 1).padStart(2, '0')}-${name}`);
        let noChrome = raw, noBoth = raw;
        if (masked) {
          const mr = stem + '.ref-masked.png', ma = stem + '.actual-masked.png';
          mask(ref, mr, geo.chrome); mask(act, ma, geo.chrome); noChrome = ae(mr, ma, ['-fuzz', fuzz], stem + '.chrome.diff.png');
          mask(mr, mr, geo.conflicts); mask(ma, ma, geo.conflicts); noBoth = ae(mr, ma, ['-fuzz', fuzz]);
        }
        res.ae.push({slide: n + 1, name, px: raw, pct: pct(raw), pctNoChrome: pct(noChrome), pctNoChromeNoConflict: pct(noBoth), conflictRows: geo.conflicts.length, pass: pct(noBoth) < threshold});
      }
    }
    await b.close();
    if (pageErrors.length) res.errors.push('page errors: ' + pageErrors.join(' | '));
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(res, null, 1));
  }
  if (res.parity.some(r => !r.pass)) res.errors.push('layout parity failed on ' + res.parity.filter(r => !r.pass).map(r => r.slide).join(','));
  if (res.ae.some(r => r.pass === false)) res.errors.push('AE over threshold on ' + res.ae.filter(r => r.pass === false).map(r => `${r.slide} (${r.pctNoChromeNoConflict ?? r.pct}% after masks)`).join(','));
  res.ok = !res.errors.length;
  return res;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), o = {}; let file = null;
  for (let k = 0; k < a.length; k++) if (a[k].startsWith('--')) o[a[k].slice(2)] = a[k + 1] && !a[k + 1].startsWith('--') ? a[++k] : true; else file = a[k];
  if (!file) { console.error('usage: node bin/verify.mjs deck.html [--refs dir] [--out dir] [--threshold 0.5] [--fuzz 2%] [--report model.report.json] [--fonts <css url, test-time only>] [--strict]'); process.exit(2); }
  const r = await verify(file, {refs: o.refs, out: o.out, threshold: o.threshold ? +o.threshold : 0.5, fuzz: o.fuzz || '2%', strict: !!o.strict, report: o.report || null, fonts: o.fonts || null});
  for (const m of r.contract.errors) console.error('ERROR   contract: ' + m);
  for (const m of r.contract.warnings) console.error('warning contract: ' + m);
  for (const s of r.parity) console.log(`parity  slide ${s.slide} ${s.name}: ${s.pass ? 'PASS' : 'FAIL ' + JSON.stringify(s.rows)}`);
  for (const s of r.parity) if (s.crowding?.length) console.log(`crowding slide ${s.slide} ${s.name}: ${s.crowding.length} row(s) the scale changed now wrap/crowd differently — ${s.crowding.map(c => JSON.stringify(c.text)).join(', ')}`);
  for (const s of r.ae) console.log(`ae      slide ${s.slide} ${s.name}: ${s.skipped ? 'skipped (' + s.skipped + ')' : (s.pass ? 'PASS' : 'FAIL') + ` raw ${s.pct}% · chrome masked ${s.pctNoChrome}% · + ${s.conflictRows} snapped rows masked ${s.pctNoChromeNoConflict}% (pass column)`}`);
  for (const m of r.skipped) console.log('skipped ' + m);
  for (const m of r.errors) console.error('FAIL    ' + m);
  console.log(r.ok ? 'VERIFY PASS' : 'VERIFY FAIL');
  process.exit(r.ok ? 0 : 1);
}
