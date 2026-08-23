#!/usr/bin/env node
// decklet verify — proof harness for a built deck.html.
//   1. model contract (bin/validate.mjs)                              always, no browser
//   2. LAYOUT PARITY in a real browser (Playwright, optional devDep)  always when Playwright is installed
//        every text row: no overflow (scrollWidth ≤ clientWidth), nowrap rows render ONE line, rows imported from HTML render the
//        source line count (data-lines), every element stays inside the canvas, zero page errors
//   3. AE pixel diff vs reference PNGs (ImageMagick `magick`/`compare`)  only when --refs is given
// usage: node bin/verify.mjs deck.html [--refs dir] [--out dir] [--threshold 0.5] [--fuzz 2%] [--strict]
//   refs: <slide.name>.png, <n>.png (1-based) or slide-<n>.png
// exit 0 = PASS. Writes <out>/results.json (+ per-slide PNGs).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {validate} from './validate.mjs';

export const modelOf = html => JSON.parse(html.match(/\/\*DECK\*\/([\s\S]*?)\/\*\/DECK\*\//)[1].replace(/<\\\/script/g, '</script'));

export async function verify(file, {refs = null, out = null, threshold = 0.5, fuzz = '2%', strict = false, log = console.log} = {}) {
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
    const hasMagick = !!refs && (() => { try { execFileSync('magick', ['-version'], {stdio: 'pipe'}); return true; } catch { return false; } })();
    if (refs && !hasMagick) res.skipped.push('AE: ImageMagick `magick` not on PATH');
    for (let n = 0; n < N; n++) {
      await p.evaluate(k => { i = k; sel.clear(); render(); }, n); await p.waitForTimeout(150);
      const name = deck.slides[n].name || `slide-${n + 1}`;
      const bad = await p.evaluate(([W, H]) => [...document.querySelectorAll('#canvas .el')].map(d => {
        const r = d.getBoundingClientRect(), cv = document.getElementById('canvas').getBoundingClientRect();
        const o = {text: (d.textContent || '').trim().slice(0, 40), n: d.dataset.n ?? ('m:' + d.dataset.m), problems: []};
        const textual = !!(d.textContent || '').trim() && !d.querySelector('svg,img');
        if (textual) {
          const rg = document.createRange(); rg.selectNodeContents(d); const tops = [];
          for (const x of rg.getClientRects()) { if (!x.width && !x.height) continue; if (!tops.some(t => Math.abs(t - x.top) < 2)) tops.push(x.top); }
          const lines = tops.length || 1;
          if (d.scrollWidth > d.clientWidth + 1) o.problems.push(`overflows its box (${d.scrollWidth}>${d.clientWidth})`);
          if (d.style.whiteSpace === 'nowrap' && lines > 1) o.problems.push(`nowrap row renders ${lines} lines`);
          if (d.dataset.lines && +d.dataset.lines !== lines) o.problems.push(`source had ${d.dataset.lines} line(s), renders ${lines}`);
          o.lines = lines;
        }
        if (r.right > cv.left + W + 1 || r.bottom > cv.top + H + 1 || r.left < cv.left - 1 || r.top < cv.top - 1) o.problems.push('outside the canvas');
        return o;
      }).filter(o => o.problems.length), [W, H]);
      res.parity.push({slide: n + 1, name, pass: !bad.length, rows: bad});
      const act = path.join(out, `${String(n + 1).padStart(2, '0')}-${name}.png`);
      await p.locator('#canvas').screenshot({path: act});
      if (hasMagick) {
        const ref = [`${name}.png`, `${n + 1}.png`, `slide-${n + 1}.png`].map(f => path.join(refs, f)).find(f => fs.existsSync(f));
        if (!ref) { res.ae.push({slide: n + 1, name, skipped: 'no reference'}); continue; }
        const ae = (args) => { try { return +execFileSync('magick', ['compare', '-metric', 'AE', ...args, ref, act, path.join(out, `${String(n + 1).padStart(2, '0')}-${name}.diff.png`)], {stdio: 'pipe'}).toString(); } catch (e) { return +e.stderr.toString().trim() || 0; } };
        const px = ae(['-fuzz', fuzz]), pct = px / (W * H) * 100;
        res.ae.push({slide: n + 1, name, px, pct: +pct.toFixed(3), pass: pct < threshold});
      }
    }
    await b.close();
    if (pageErrors.length) res.errors.push('page errors: ' + pageErrors.join(' | '));
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(res, null, 1));
  }
  if (res.parity.some(r => !r.pass)) res.errors.push('layout parity failed on ' + res.parity.filter(r => !r.pass).map(r => r.slide).join(','));
  if (res.ae.some(r => r.pass === false)) res.errors.push('AE over threshold on ' + res.ae.filter(r => r.pass === false).map(r => `${r.slide} (${r.pct}%)`).join(','));
  res.ok = !res.errors.length;
  return res;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), o = {}; let file = null;
  for (let k = 0; k < a.length; k++) if (a[k].startsWith('--')) o[a[k].slice(2)] = a[k + 1] && !a[k + 1].startsWith('--') ? a[++k] : true; else file = a[k];
  if (!file) { console.error('usage: node bin/verify.mjs deck.html [--refs dir] [--out dir] [--threshold 0.5] [--fuzz 2%] [--strict]'); process.exit(2); }
  const r = await verify(file, {refs: o.refs, out: o.out, threshold: o.threshold ? +o.threshold : 0.5, fuzz: o.fuzz || '2%', strict: !!o.strict});
  for (const m of r.contract.errors) console.error('ERROR   contract: ' + m);
  for (const m of r.contract.warnings) console.error('warning contract: ' + m);
  for (const s of r.parity) console.log(`parity  slide ${s.slide} ${s.name}: ${s.pass ? 'PASS' : 'FAIL ' + JSON.stringify(s.rows)}`);
  for (const s of r.ae) console.log(`ae      slide ${s.slide} ${s.name}: ${s.skipped ? 'skipped (' + s.skipped + ')' : (s.pass ? 'PASS' : 'FAIL') + ' ' + s.pct + '%'}`);
  for (const m of r.skipped) console.log('skipped ' + m);
  for (const m of r.errors) console.error('FAIL    ' + m);
  console.log(r.ok ? 'VERIFY PASS' : 'VERIFY FAIL');
  process.exit(r.ok ? 0 : 1);
}
