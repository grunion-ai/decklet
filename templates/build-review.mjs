#!/usr/bin/env node
// build-review.mjs — the contact sheet Kyle marks up: survey + 59 candidate previews.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'candidates.index.json'), 'utf8'));
const thumbs = fs.readdirSync(path.join(dir, 'thumbs')).filter(f => f.endsWith('.webp')).sort();
const uri = f => 'data:image/webp;base64,' + fs.readFileSync(path.join(dir, 'thumbs', f)).toString('base64');
const sh = c => { try { return execSync(c, { encoding: 'utf8' }).trim(); } catch { return 'n/a'; } };
const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const TIER = { core: ['Core', 'Appears in 4+ of the surveyed catalogs. The vocabulary a deck cannot ship without.'],
  standard: ['Standard', 'Common in consulting catalogs, rare in developer-slide themes. Earns its place on a specific job.'],
  fringe: ['Fringe', 'Well documented in the dataviz literature, near-absent from slide template libraries. Upside is differentiation; risk is nobody asks for it.'] };

const SURVEY = [
  ['ToseaAI/awesome-html-slide-skills', 'index of 23 HTML-slide agent skills + template packs', 'the map — which repos are worth opening'],
  ['likaku/Mck-ppt-design-skill', '72-slide consulting layout catalog, PPTX output', 'the spine of this candidate list'],
  ['kgraph57/mckinsey-style-visualization-skill', '22 rendered strategy patterns + 13 spec-only', 'confirms which patterns survive as real renderers'],
  ['lewislulu/html-ppt-skill', '31 page layouts, 36 themes, presenter mode', 'layout names that recur outside consulting'],
  ['slidevjs/slidev', '19 built-in layouts', 'the irreducible common core (cover, section, two-cols, quote, fact, image-left/right)'],
  ['zarazhangrui/frontend-slides (22.6k★)', '16 themes, 3 slides each', 'style vocabulary, almost no layout vocabulary — the gap decklet fills'],
  ['op7418/guizang-ppt-skill · WayneZhon/KingDee-PPT-Skill', '10 and 29 layouts, magazine and bento styles', 'the modern/bento end of the range'],
  ['Observable · Datawrapper · Nightingale', 'underused-chart writeups (slope, dumbbell, small multiples, marimekko)', 'the fringe tier'],
];

const byCat = idx.reduce((m, t, i) => ((m[t.cat] ||= []).push({ ...t, n: i + 1, thumb: thumbs[i] }), m), {});
const counts = Object.entries(TIER).map(([k, v]) => `${idx.filter(t => t.tier === k).length} ${v[0].toLowerCase()}`).join(' · ');

const card = t => `<figure class="c" id="${t.id}">
  <img src="${uri(t.thumb)}" alt="${esc(t.name)}" loading="lazy">
  <figcaption><div class="ch"><span class="n">${String(t.n).padStart(2, '0')}</span><b>${esc(t.name)}</b><span class="t t-${t.tier}">${TIER[t.tier][0]}</span></div>
  <p>${esc(t.note)}</p><code>${t.id}</code></figcaption></figure>`;

const html = `<title>Decklet Template Library</title>
<meta name="kind" content="design-review"><meta name="generated-at" content="${stamp}">
<meta name="repo" content="grunion-ai/decklet"><meta name="branch" content="${sh('git -C ~/Documents/decklet rev-parse --abbrev-ref HEAD')}">
<style>
:root{--fg:#16181d;--muted:#6b7078;--line:#dfe1e6;--bg:#fff;--soft:#f6f7f9;--accent:#b3401a;--ok:#2f7a44;--warn:#a86a12;--bad:#a3271f;--mono:ui-monospace,Menlo,Consolas,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:0 28px 90px}
.plan-header{background:#16181d;color:#fff;padding:20px 28px;margin-bottom:0}
.plan-header .bar{max-width:1180px;margin:0 auto;display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
.badge{font:600 11px/1 var(--mono);letter-spacing:.12em;background:var(--accent);padding:6px 9px;border-radius:3px}
.bar h1{font-size:19px;margin:0;font-weight:600}.bar time{margin-left:auto;font:11px var(--mono);opacity:.7}
dl.meta{max-width:1180px;margin:0 auto;padding:16px 28px 22px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 24px;border-bottom:1px solid var(--line);font:12px var(--mono)}
dl.meta dt{color:var(--muted);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase}dl.meta dd{margin:2px 0 0}
h2{font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:44px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--line)}
h3{font-size:16px;margin:34px 0 10px}
table{border-collapse:collapse;width:100%;font-size:13.5px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:600 10.5px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
code{font:12px var(--mono);color:var(--muted)}
p.lede{font-size:16px;max-width:74ch;color:#3a3f47}
.tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:18px 0 0}
.tiers div{border:1px solid var(--line);border-radius:8px;padding:14px 16px;background:var(--soft)}
.tiers b{display:block;font:600 11px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;margin-bottom:7px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.c{margin:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
.c img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-bottom:1px solid var(--line);background:var(--soft)}
figcaption{padding:12px 14px 14px}.ch{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.ch b{font-size:14px}.n{font:600 11px var(--mono);color:var(--muted)}
.t{font:600 9.5px/1 var(--mono);letter-spacing:.09em;text-transform:uppercase;padding:4px 6px;border-radius:3px;margin-left:auto}
.t-core{background:#e7f2ea;color:var(--ok)}.t-standard{background:#f4ecdb;color:var(--warn)}.t-fringe{background:#f7e8e6;color:var(--bad)}
figcaption p{margin:7px 0 8px;font-size:12.5px;color:#4a4f57;line-height:1.5}
.gap{border-left:3px solid var(--accent);background:var(--soft);padding:12px 16px;margin:16px 0;font-size:13.5px}
@media (prefers-color-scheme:dark){:root{--fg:#e8e8ea;--muted:#9aa0a8;--line:#2c3037;--bg:#101215;--soft:#181b20}.c{background:#14171b}p.lede{color:#c3c7cd}figcaption p{color:#b3b8bf}
.t-core{background:#16301f;color:#7fd39b}.t-standard{background:#332a17;color:#e3b45c}.t-fringe{background:#331d1a;color:#e78d82}}
</style>
<header class="plan-header"><div class="bar"><span class="badge">DESIGN-REVIEW</span><h1>Decklet template library — candidate contact sheet</h1><time>${stamp}</time></div></header>
<dl class="meta">
<dt>Repo</dt><dd>grunion-ai/decklet</dd>
<dt>Branch</dt><dd>${sh('git -C ~/Documents/decklet rev-parse --abbrev-ref HEAD')}</dd>
<dt>Commit</dt><dd>${sh('git -C ~/Documents/decklet rev-parse --short HEAD')}</dd>
<dt>Working dir</dt><dd>~/Documents/decklet</dd>
<dt>Kind</dt><dd>design-review</dd>
<dt>Generated</dt><dd>${stamp}</dd>
</dl>
<div class="wrap">

<h2>1 · What this is</h2>
<p class="lede">Fifty-nine candidate templates, every one authored as a real decklet model and rendered by the engine — not mocked. The whole sheet passes <code>validate --strict</code> and <code>verify</code> layout parity, so anything you keep is already buildable today. Tell me which numbers to keep and the survivors become the shipped library.</p>
<p class="lede">Mix: ${counts}.</p>

<h2>2 · The landscape</h2>
<table><thead><tr><th>Source</th><th>What it is</th><th>What it contributed</th></tr></thead><tbody>
${SURVEY.map(r => `<tr><td><code>${esc(r[0])}</code></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('\n')}
</tbody></table>
<div class="gap"><b>The gap worth exploiting.</b> The 20k-star repos compete on <em>themes</em> — colour, type, background treatment — and ship three layouts each. The consulting repos compete on <em>layouts</em> and ship 70, but only as PPTX generators with no verification. Decklet already owns brand-true styling and a parity gate; layouts are the missing axis.</div>

<h2>3 · Common vs fringe</h2>
<div class="tiers">${Object.entries(TIER).map(([k, v]) => `<div><b>${v[0]} · ${idx.filter(t => t.tier === k).length}</b>${esc(v[1])}</div>`).join('')}</div>

${Object.entries(byCat).map(([cat, items]) => `<h2>${cat} · ${items.length}</h2>\n<div class="grid">${items.map(card).join('\n')}</div>`).join('\n')}

<h2>Appendix · How to answer</h2>
<p class="lede">Reply with the numbers or ids to <b>drop</b> — everything else ships. Flag any you want re-cut rather than cut ("keep 47 but two rows, not three"). One known engine gap: <code>chart-flow-split</code> (49) is a straight-band stand-in because a true curved Sankey ribbon needs a fill primitive decklet does not have — say the word and it becomes an engine feature request instead of a template.</p>
</div>`;

const out = process.argv[2] || path.join(process.env.HOME, 'Documents/queue', `${stamp.slice(0, 10)}-${stamp.slice(11, 19).replace(/:/g, '')}-decklet-template-library-design-review.html`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, (fs.statSync(out).size / 1e6).toFixed(2) + ' MB');
