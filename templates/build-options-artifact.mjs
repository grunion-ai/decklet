#!/usr/bin/env node
// build-options-artifact.mjs — the option contact sheet a reviewer picks from.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'options.index.json'), 'utf8'));
const shots = fs.readdirSync(path.join(dir, 'opt-thumbs')).filter(f => f.endsWith('.webp'));
const find = id => shots.find(f => f.replace(/^\d+-/, '').replace(/\.webp$/, '') === id);
const uri = id => { const f = find(id); return f ? 'data:image/webp;base64,' + fs.readFileSync(path.join(dir, 'opt-thumbs', f)).toString('base64') : ''; };
const root = path.resolve(dir, '..');
const sh = c => { try { return execSync(c, { cwd: root, encoding: 'utf8' }).trim(); } catch { return 'n/a'; } };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

const FAMS = [
  ['Flow', 'F', 'Sankey and flow', 'Five forms that survive the gate. A sixth — true curved ribbons — does not, and needs an engine primitive.'],
  ['Chrome', 'C', 'Header and footer', 'Eight chrome kits. The source line moves freely; the page counter’s corner is fixed by the engine, which ruled out two ideas.'],
  ['Padding', 'P', 'Inset and density', 'Four insets and the same slide at both densities, so the difference is visible rather than described.'],
  ['Quad', 'Q', '2×2 and its relatives', 'Ten uses of one framework — position, portfolio, effort, risk, stakeholders, movement, recommendation, concept, nine-box, and the document version.'],
];
const cards = (fam, letter) => idx.filter(o => o.fam === fam).map((o, i) => `
  <figure class="frame">
    <img src="${uri(o.id)}" alt="${esc(o.name)}" loading="lazy">
    <figcaption><p class="code">${letter}${i + 1}</p><h4>${esc(o.name)}</h4><p class="note">${esc(o.note)}</p><p class="id">${esc(o.id)}</p></figcaption>
  </figure>`).join('');

const html = `<title>Decklet Option Sheet</title>
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
  <div class="cell"><dt>Decision</dt><dd>Pick from 29 rendered options across four families.</dd></div>
  <div class="cell"><dt>Why</dt><dd>Sankey, chrome, padding and the 2×2 were the thin spots in the 67-template library.</dd></div>
  <div class="cell"><dt>Risk</dt><dd>Curved ribbons need an engine fill primitive; the counter corner is fixed.</dd></div>
  <div class="cell"><dt>Next</dt><dd>Name the codes to keep; they land as per-density decks.</dd></div>
 </dl>
</section>

<header class="plan-header">
 <div class="bar"><span class="badge">DESIGN-REVIEW</span><h1>Decklet option sheet</h1><time>${stamp}</time></div>
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

<details open><summary><span class="num">2</span><h2>Key decisions &amp; trade-offs</h2><span class="sub">3 forks</span></summary>
<div class="sec">
<figure class="dec">
<div class="scroll">

\`\`\`mermaid
flowchart LR
  A["Thin spots in the library"] --> B{"Sankey"}
  A --> C{"Chrome"}
  A --> D{"2x2"}
  B --> B1["Curved ribbon<br/>engine primitive"]
  B --> B2["Five gate-safe forms<br/>CHOSEN"]
  C --> C1["Move the counter<br/>rejected by the engine"]
  C --> C2["Move the source line<br/>CHOSEN"]
  D --> D1["One canonical 2x2"]
  D --> D2["Ten uses of the frame<br/>CHOSEN"]
\`\`\`

</div>
<figcaption>Two forks were settled by the engine rather than by taste: a thick <code>curve</code> paints a canvas-sized box and occludes every text row, and the page counter’s corner is asserted identical on every slide. The third is yours.</figcaption>
</figure>
</div></details>

${FAMS.map(([fam, letter, title, lede], i) => `
<details open><summary><span class="num">${i + 3}</span><h2>${esc(title)}</h2><span class="sub">${idx.filter(o => o.fam === fam).length} options · ${letter}1–${letter}${idx.filter(o => o.fam === fam).length}</span></summary>
<div class="sec"><p class="lede">${esc(lede)}</p><div class="sheet">${cards(fam, letter)}</div></div></details>`).join('')}

<details><summary><span class="num">7</span><h2>The one engine gap</h2><span class="sub">curved ribbons</span></summary>
<div class="sec">
<div class="gap"><b>A true Sankey ribbon is not a template problem.</b> Drawing one as a thick <code>curve</code> row makes the engine size that row’s SVG to <code>-400,-253 1865×1074</code> — far outside the canvas — so <code>verify</code> reports the ribbon outside the canvas and every text row on the slide occluded beneath it. F1–F5 are what the current primitives can honestly draw. A real ribbon wants a <code>ribbon</code> or area-fill row that takes two edge profiles and paints between them. Say the word and it becomes a decklet issue rather than a template.</div>
</div></details>

<details><summary><span class="num">8</span><h2>Verification</h2><span class="sub">all green</span></summary>
<div class="sec"><div class="scroll"><table>
<thead><tr><th>Gate</th><th>Method</th><th>Pass criteria</th><th>Result</th></tr></thead>
<tbody>
<tr><td>Contract</td><td><code>validate --style warm --strict</code></td><td>0 errors, 0 warnings</td><td><span class="pill p-ok">0 / 0</span></td></tr>
<tr><td>Gap gate</td><td><code>validate</code> occlusion + <code>styles.gap</code></td><td>nothing within 4px, no text under ink</td><td><span class="pill p-ok">pass</span></td></tr>
<tr><td>Layout parity</td><td><code>verify</code> (Chromium)</td><td>no overflow, no collision, counter box identical</td><td><span class="pill p-ok">33 / 33</span></td></tr>
<tr><td>Spelling</td><td><code>verify</code> spell</td><td>0 unknown words</td><td><span class="pill p-ok">pass</span></td></tr>
</tbody></table></div>
<p class="lede" style="margin-top:14px">Deck: <code>templates/options.html</code>. Shots: <code>templates/opt-shots/</code>. Source: <code>templates/options-sankey-chrome.mjs</code>, <code>templates/options-pad-quad.mjs</code>.</p>
</div></details>

<details><summary><span class="num">9</span><h2>How to answer</h2><span class="sub">codes</span></summary>
<div class="sec"><p class="lede">Name the codes to keep — “F2 F6 C1 C2 C6 P2 P5 P6 Q3 Q4 Q7 Q10” reads fine. Anything you want re-cut rather than cut, say how. Survivors land in the library as one deck per density, each carrying three orthogonal style kits and every template and layout at that density.</p></div></details>

</div>`;
const out = path.join(dir, 'options-artifact.html');
fs.writeFileSync(out, html);
console.log(out, (fs.statSync(out).size / 1e6).toFixed(2) + ' MB');
