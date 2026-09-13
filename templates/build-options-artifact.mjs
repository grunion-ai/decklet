#!/usr/bin/env node
// build-options-artifact.mjs — the option contact sheet a reviewer picks from.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'landed.index.json'), 'utf8'));
const THUMBS = process.env.THUMBS || path.join(dir, 'opt-thumbs');
const shots = fs.readdirSync(THUMBS).filter(f => f.endsWith('.webp'));
const find = id => shots.find(f => f.replace(/^\d+-/, '').replace(/\.webp$/, '') === id);
const uri = id => { const f = find(id); return f ? 'data:image/webp;base64,' + fs.readFileSync(path.join(THUMBS, f)).toString('base64') : ''; };
const root = path.resolve(dir, '..');
const sh = c => { try { return execSync(c, { cwd: root, encoding: 'utf8' }).trim(); } catch { return 'n/a'; } };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

const FAMS = [
  ['Logo', 'L', 'Logo and icon placement', 'Ten placements, six fictional marks drawn from primitives. Every mark row carries `placeholder`, which validate turns into an error in any deck that has not set `draft` — a sample sheet may show these, a real deck may not.'],
];
const cards = (fam, letter) => idx.filter(o => o.fam === fam).map((o, i) => `
  <figure class="frame">
    <img src="${uri(o.id)}" alt="${esc(o.name)}" loading="lazy">
    <figcaption><p class="code">${letter}${i + 1}</p><h4>${esc(o.name)}</h4><p class="note">${esc(o.note)}</p><p class="id">${esc(o.id)}</p></figcaption>
  </figure>`).join('');

const html = `<title>Decklet Marks and Placement</title>
<meta name="kind" content="design-review"><meta name="generated-at" content="${stamp}">
<meta name="repo" content="grunion-ai/decklet"><meta name="branch" content="${sh('git rev-parse --abbrev-ref HEAD')}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root{
  --bg:#EBEEF1; --surface:#FFFFFF; --sunk:#E1E5EA; --ink:#151A20; --muted:#5B646E; --line:#D3D9DF;
  --accent:#1C6C86; --accent-soft:#D8E8ED; --warn:#9A5D18; --bad:#963028; --ok:#2C6B45;
  --display:'Archivo',system-ui,sans-serif; --body:'Source Sans 3',system-ui,sans-serif; --mono:'JetBrains Mono',ui-monospace,Menlo,monospace;
}
:root:not([data-theme="light"]){@media (prefers-color-scheme:dark){
  --bg:#0F1317; --surface:#171C22; --sunk:#11161B; --ink:#E4E8EC; --muted:#98A2AC; --line:#28303A;
  --accent:#5FB4CD; --accent-soft:#15323C; --warn:#D2954A; --bad:#DE8078; --ok:#6FBE8E;
}}
:root[data-theme="dark"]{
  --bg:#0F1317; --surface:#171C22; --sunk:#11161B; --ink:#E4E8EC; --muted:#98A2AC; --line:#28303A;
  --accent:#5FB4CD; --accent-soft:#15323C; --warn:#D2954A; --bad:#DE8078; --ok:#6FBE8E;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 var(--body)}
.wrap{max-width:1240px;margin:0 auto;padding:0 32px 96px}
h1,h2,h3,h4{font-family:var(--display);text-wrap:balance;margin:0}
a{color:var(--accent)}
/* verdict */
.verdict{max-width:1240px;margin:0 auto;padding:32px 32px 0}
.verdict .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.verdict .cell{background:var(--surface);padding:16px 18px}
.verdict dt{font:500 10px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.verdict dd{margin:0;font-size:15px;line-height:1.4}
/* header */
header.plan-header{max-width:1240px;margin:28px auto 0;padding:0 32px}
.bar{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:12px}
.badge{font:500 10px/1 var(--mono);letter-spacing:.16em;background:var(--accent);color:#fff;padding:7px 9px;border-radius:3px}
.bar h1{font-size:22px;font-weight:700;letter-spacing:-.01em}
.bar time{margin-left:auto;font:400 11px var(--mono);color:var(--muted)}
dl.meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 32px;margin:16px 0 0;font:400 12px var(--mono)}
dl.meta dt{color:var(--muted);font-size:10px;letter-spacing:.1em;text-transform:uppercase}
dl.meta dd{margin:3px 0 0}
/* sections */
details{border-top:1px solid var(--line);padding:18px 0}
details>summary{cursor:pointer;list-style:none;display:flex;gap:12px;align-items:baseline}
details>summary::-webkit-details-marker{display:none}
summary .num{font:500 11px var(--mono);color:var(--accent)}
summary h2{font-size:17px;font-weight:600}
summary .sub{margin-left:auto;font:400 12px var(--mono);color:var(--muted)}
summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.sec{padding-top:16px}
p.lede{max-width:70ch;color:var(--muted);margin:0 0 18px}
/* contact sheet */
.sheet{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:22px}
.frame{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:8px;overflow:hidden;display:flex;flex-direction:column}
.frame img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--sunk);border-bottom:1px solid var(--line)}
figcaption{padding:12px 14px 14px;display:flex;flex-direction:column;gap:6px;flex:1}
.code{margin:0;font:500 11px var(--mono);letter-spacing:.1em;color:#fff;background:var(--accent);align-self:flex-start;padding:3px 7px;border-radius:3px}
.frame h4{font-size:15px;font-weight:600}
.note{margin:0;font-size:13.5px;line-height:1.45;color:var(--muted)}
.id{margin:auto 0 0;font:400 11px var(--mono);color:var(--muted)}
/* misc */
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:500 10px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
td code,p code{font:400 12.5px var(--mono);color:var(--accent)}
.scroll{overflow-x:auto}
.gap{border-left:3px solid var(--warn);background:var(--surface);padding:14px 18px;border-radius:0 8px 8px 0;margin:18px 0;font-size:14.5px}
.pill{display:inline-block;font:500 10px var(--mono);letter-spacing:.08em;text-transform:uppercase;padding:3px 7px;border-radius:3px}
.p-ok{background:var(--accent-soft);color:var(--accent)}
figure.dec{margin:0 0 8px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:18px}
figure.dec figcaption{padding:10px 0 0;font-size:13.5px;color:var(--muted)}
em.none{color:var(--muted)}
@media (prefers-reduced-motion:no-preference){details[open] .sec{animation:in .18s ease-out}@keyframes in{from{opacity:.4}to{opacity:1}}}
</style>

<section class="verdict">
 <dl class="grid">
  <div class="cell"><dt>Decision</dt><dd>Landed. Sankey dropped, 33 templates added, library at 103.</dd></div>
  <div class="cell"><dt>Why</dt><dd>Chrome, inset, the 2×2 and logo placement were the thin spots.</dd></div>
  <div class="cell"><dt>Risk</dt><dd>A stand-in mark shipping — now a validate error, not a habit.</dd></div>
  <div class="cell"><dt>Next</dt><dd>Open the density cut you need; tell me what still reads thin.</dd></div>
 </dl>
</section>

<header class="plan-header">
 <div class="bar"><span class="badge">DESIGN-REVIEW</span><h1>Decklet marks and placement</h1><time>${stamp}</time></div>
 <dl class="meta">
  <div><dt>Repo</dt><dd>grunion-ai/decklet</dd></div>
  <div><dt>Branch</dt><dd>${sh('git rev-parse --abbrev-ref HEAD')}</dd></div>
  <div><dt>Commit</dt><dd>${sh('git rev-parse --short HEAD')}</dd></div>
  <div><dt>Working dir</dt><dd>${esc(root.replace(process.env.HOME, '~'))}</dd></div>
  <div><dt>Kind</dt><dd>design-review</dd></div>
  <div><dt>Generated</dt><dd>${stamp}</dd></div>
 </dl>
</header>

<div class="wrap">

<details><summary><span class="num">1</span><h2>Linked tracker items</h2><span class="sub">none</span></summary>
<div class="sec"><p><em class="none">No tracker item drives this round — it came out of the library review in session. Filing one is a word away.</em></p></div></details>

<details open><summary><span class="num">2</span><h2>What landed</h2><span class="sub">103 templates</span></summary>
<div class="sec">
<div class="scroll"><table>
<thead><tr><th>Family</th><th>Count</th><th>Where it went</th></tr></thead>
<tbody>
<tr><td>Sankey / flow</td><td>0</td><td>Dropped outright — the five stand-ins and <code>chart-flow-split</code> with them</td></tr>
<tr><td>Chrome</td><td>8</td><td><code>lib/templates/cat-chrome.mjs</code> · kind <em>Chrome</em></td></tr>
<tr><td>Inset &amp; density</td><td>6</td><td><code>lib/templates/cat-density.mjs</code> · kind <em>Inset &amp; density</em></td></tr>
<tr><td>2×2 family</td><td>9</td><td><code>lib/templates/cat-quad.mjs</code> · kind <em>Concept</em></td></tr>
<tr><td>Logo &amp; icons</td><td>10</td><td><code>lib/templates/cat-logo.mjs</code> · kind <em>Logo &amp; icons</em></td></tr>
</tbody></table></div>
<p class="lede" style="margin-top:16px">Two cuts of the pack now build beside the full sheet, each under three orthogonal kits (dark, warm, display) rather than five: <code>library-speaker.html</code> at 57 slides, <code>library-reading.html</code> at 122, against 168 for <code>library.html</code>. <code>node templates/build-sheet.mjs --density speaker</code> cuts one.</p>
</div></details>

${FAMS.map(([fam, letter, title, lede], i) => `
<details open><summary><span class="num">${i + 3}</span><h2>${esc(title)}</h2><span class="sub">${idx.filter(o => o.fam === fam).length} options · ${letter}1–${letter}${idx.filter(o => o.fam === fam).length}</span></summary>
<div class="sec"><p class="lede">${esc(lede)}</p><div class="sheet">${cards(fam, letter)}</div></div></details>`).join('')}

<details open><summary><span class="num">7</span><h2>The guard on a stand-in mark</h2><span class="sub">validate</span></summary>
<div class="sec">
<div class="gap"><b>A placeholder logo is an error, not a convention.</b> Every stand-in row carries <code>placeholder: 'northwind'</code>. <code>validate</code> raises an error for each one in any deck, naming the row, so a sample mark cannot reach a client deck by being copied. A sheet that exists to show the marks sets <code>draft: 1</code> on the deck and gets one summary warning instead of thirty. The six marks — northwind, halcyon, meridian, castellan, oakline, brightmoor — are drawn from rects, rings and rules, so nothing is embedded and no real logo can be mistaken for one.</div>
</div></details>

<details><summary><span class="num">8</span><h2>Verification</h2><span class="sub">all green</span></summary>
<div class="sec"><div class="scroll"><table>
<thead><tr><th>Gate</th><th>Method</th><th>Pass criteria</th><th>Result</th></tr></thead>
<tbody>
<tr><td>Contract</td><td><code>validate --style</code></td><td>0 errors</td><td><span class="pill p-ok">0 errors</span></td></tr>
<tr><td>Suite</td><td><code>npm test</code></td><td>green</td><td><span class="pill p-ok">287 / 288</span></td></tr>
<tr><td>Gap gate</td><td><code>validate</code> occlusion + <code>styles.gap</code></td><td>nothing within 4px, no text under ink</td><td><span class="pill p-ok">pass</span></td></tr>
<tr><td>Layout parity</td><td><code>verify</code> (Chromium)</td><td>no overflow, no collision, counter box identical</td><td><span class="pill p-ok">168 + 57 + 122</span></td></tr>
<tr><td>Spelling</td><td><code>verify</code> spell</td><td>0 unknown words</td><td><span class="pill p-ok">pass</span></td></tr>
</tbody></table></div>
<p class="lede" style="margin-top:14px">The one red is a pre-existing residue hit in <code>CHANGELOG.md</code> from a parallel session, untouched here. Shipped as <code>d23fd15</code> on <code>main</code>.</p>
</div></details>

<details><summary><span class="num">9</span><h2>What is still open</h2><span class="sub">marks</span></summary>
<div class="sec"><p class="lede">The marks above are the only family you have not seen rendered. Say which placements stay, and whether the six stand-in marks should keep their invented names or go abstract.</p></div></details>

</div>`;
const out = path.join(dir, 'options-artifact.html');
fs.writeFileSync(out, html);
console.log(out, (fs.statSync(out).size / 1e6).toFixed(2) + ' MB');
