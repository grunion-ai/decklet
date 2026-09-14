#!/usr/bin/env node
// decklet create — headless: model.json (+ style.json) → one self-contained deck.html
// usage: node bin/create.mjs --model model.json [--style style.json] --out deck.html
//          [--format slides|slides-4x3|story|carousel|carousel-4x5|document-letter|document-a4|document-letter-landscape|document-a4-landscape|poster-a3] [--space 960x540|1600x900] [--title "…"] [--force]
//          [--from prev.html]   revise an existing deck: keep its id + slide/row ids, replay the human edits it carries
//                               (human wins, conflicts reported), push its state into the version history
// library: import {create, FORMAT} from './create.mjs'
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {validate, mergeStyle, fillKpi, FORMAT, resolveCanvas} from './validate.mjs';
import {libraryFor} from '../lib/layouts.mjs';
import {expandCharts} from '../lib/chart.mjs';
import {expandTemplates} from '../lib/templates.mjs';
import {expandIcons} from '../lib/icons.mjs';
import {flags as spellFlags, flagMap as spellMap, loadChecker} from '../lib/spell.mjs';
import {stampIds, diffDecks, applyLog, blockOf, hasBlock, putBlock} from '../lib/edits.mjs';

// page-size presets of ONE model space: the FORMAT table lives in validate.mjs (the module create builds on), re-exported
// here so `import {create, FORMAT} from './create.mjs'` is unchanged and the validator can never size a deck differently.
export {FORMAT};

const here = path.dirname(fileURLToPath(import.meta.url));
const esc = s => s.replace(/<\/script/gi, '<\\/script');
const put = (html, mark, to) => {
  const re = new RegExp(`/\\*${mark}\\*/[\\s\\S]*?/\\*/${mark}\\*/`);
  if (!re.test(html)) throw new Error(`template marker ${mark} missing`);
  return html.replace(re, () => `/*${mark}*/${to}/*/${mark}*/`);
};

// --from: ids are inherited by position — a new slide/row with no id takes the previous file's id at the same index when the
// roles agree (a regenerated model.json rarely carries ids; text is NOT compared, because a retyped row is exactly the edit
// to carry). Anything unmatched gets a fresh id and reads as new. Carry ids in model.json to make the match exact.
function inheritIds(deck, prev) {
  deck.id = deck.id || prev.id;
  // slides: same index when the first text agrees, else any unused previous slide with that first text (an insert above shifts
  // every index, and the deck must not renumber every slide because of it), else the same index if still free, else nothing — a fresh id says "new slide"
  const sig = s => { const r = (s.els || []).find(e => e.text != null || e.html != null); return r ? String(r.text ?? r.html) : null; };
  const used = new Set(deck.slides.map(s => s.id).filter(Boolean)), pairs = [];
  const take = (s, ps) => { s.id = ps.id; used.add(ps.id); pairs.push([s, ps]); };
  deck.slides.forEach(s => { if (s.id) { const ps = prev.slides.find(x => x.id === s.id); if (ps) pairs.push([s, ps]); } });
  deck.slides.forEach((s, n) => { if (s.id) return; const at = prev.slides[n], ps = at && !used.has(at.id) && sig(at) != null && sig(at) === sig(s) ? at : prev.slides.find(x => !used.has(x.id) && sig(x) != null && sig(x) === sig(s)); if (ps) take(s, ps); }); // pass 1: by content
  deck.slides.forEach((s, n) => { if (s.id) return; const at = prev.slides[n]; if (at && !used.has(at.id)) take(s, at); });                                   // pass 2: by position (a retyped title still matches its slide)
  for (const [s, ps] of pairs) (s.els || []).forEach((r, k) => { const pr = (ps.els || [])[k]; if (!r.id && pr && pr.id && (pr.role || null) === (r.role || null) && !!(pr.line || pr.curve) === !!(r.line || r.curve) && !(s.els || []).some(x => x.id === pr.id)) r.id = pr.id; });
}

export function create(model, {style = null, format, space, title, template, from = null, spell = null} = {}) {
  const deck = structuredClone(model);
  const prevHtml = from ? fs.readFileSync(from, 'utf8') : null, prev = prevHtml ? blockOf(prevHtml, 'DECK') : null;
  if (prev) inheritIds(deck, prev);
  const fmt = format || deck.format || 'slides';
  if (!FORMAT[fmt]) throw new Error(`unknown format ${fmt}`);
  // the ONE resolver, shared with validate: --space, then the model's own w/h, then the preset (ROADMAP U1.1)
  const canvas = resolveCanvas(deck, {format, space, fallback: 'slides'});
  deck.format = canvas.format; deck.page = canvas.page; deck.w = canvas.w; deck.h = canvas.h;
  // style.json: {tokens:{bg,fg,muted,accent,card,line,sel,box}, roles:{…}, pad:{…}} — shared with validate --style so the two never drift
  mergeStyle(deck, style);
  expandTemplates(deck); // template slides → their rows (the template's chrome layout named on the slide), before the library resolves
  expandIcons(deck);     // icon rows → inline svg rows
  deck.layouts = {...libraryFor(deck), ...(deck.layouts || {})};   // library layouts a slide names and the deck does not define
  // the deck NAMES itself: --title wins, else the model's own title, else "decklet". It is model data, never markup —
  // the runtime titles the document from it, so the tab, the ⤓ PDF filename and the ⌘S copy filename are one string.
  deck.title = title || deck.title || 'decklet';
  let html = template || fs.readFileSync(path.join(here, '..', 'template.html'), 'utf8');
  if (!deck.styles || !deck.styles.roles || !Object.keys(deck.styles.roles).length) { // no roles anywhere → inherit the template's neutral scale
    const tpl = JSON.parse(html.match(/\/\*DECK\*\/([\s\S]*?)\/\*\/DECK\*\//)[1]);
    deck.styles = {...tpl.styles, ...(deck.styles || {}), roles: tpl.styles.roles};
  }
  fillKpi(deck);        // the optional Stat2 role, derived from Stat when a kpi tile asks for it and the style has none
  expandCharts(deck);   // chart rows → the ordinary rows they stand for; the runtime draws no charts
  const tokens = {...(style && style.tokens || {})};
  if (Object.keys(tokens).length) html = put(html, 'TOKENS', Object.entries(tokens).map(([k, v]) => `--${k.replace(/^--/, '')}:${v}`).join(';'));
  deck.id = deck.id || createHash('sha256').update(JSON.stringify(model)).digest('hex').slice(0, 10); // born once, from the first model; --from carries it
  stampIds(deck);
  // --from: replay the human's edits onto this version (human wins) and stamp them with this rev. A previous file's
  // /*VERSIONS*/ block (0.5.0–0.8.x) is read past: the history left the file in 0.9.0.
  let migrate = null, log = [];
  if (prev) {
    const predates = !hasBlock(prevHtml, 'LOG');   // built before 0.5.0: no edit log to replay
    const plog = blockOf(prevHtml, 'LOG', []);
    migrate = applyLog(deck, plog); if (predates) migrate.predates = true;
    log = plog;
  }
  const hash = createHash('sha256').update(JSON.stringify(deck)).digest('hex').slice(0, 10);
  deck.rev = hash;
  for (const e of log) if (!e.rev) e.rev = hash;
  html = put(html, 'DECK', esc(JSON.stringify(deck)));
  html = putBlock(html, 'LOG', log);
  html = put(html, 'KEY', `'decklet:${deck.id}'`);
  html = put(html, 'ENGINE', `'${JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8')).version}'`); // the bug report leads with the version that built the file
  html = put(html, 'SPELL', JSON.stringify(spell ? spellMap(deck, spell) : {})); // option C: the flagged words AND their suggestions ride in the file; the editor underlines them and offers the fix
  return {html, deck, hash, migrate};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), o = {};
  for (let k = 0; k < a.length; k++) if (a[k].startsWith('--')) o[a[k].slice(2)] = a[k + 1] && !a[k + 1].startsWith('--') ? a[++k] : true;
  if (!o.model || !o.out) { console.error('usage: node bin/create.mjs --model model.json [--style style.json] --out deck.html [--format …] [--space WxH] [--title …] [--from prev.html] [--force]'); process.exit(2); }
  const model = JSON.parse(fs.readFileSync(o.model, 'utf8'));
  const style = o.style ? JSON.parse(fs.readFileSync(o.style, 'utf8')) : null;
  const spell = await loadChecker(model.lang || 'en'); // optional: nspell + dictionary-en; absent → no flags, the browser's own checker only
  const {html, deck, hash, migrate} = create(model, {style, format: o.format, space: o.space, title: o.title, from: o.from || null, spell});
  const flagged = spell ? spellFlags(deck, spell) : null;
  if (flagged === null) console.error('spell: nspell + dictionary-en not installed — no words flagged (npm i -D nspell dictionary-en)');
  else if (flagged.length) {
    console.error(`spell: ${flagged.length} word(s) flagged — ${flagged.join(', ')} (spell.ignore in the model silences a name)`);
    console.error(`spell: {"ignore": [${flagged.map(w => JSON.stringify(w)).join(', ')}]}`); // paste it into the model: the words as spell.ignore matches them, already JSON
  }
  if (migrate?.predates) console.error(`${o.from} predates the edit log (built before decklet 0.5.0): id and state carried, nothing to replay`);
  if (migrate) { console.error(`migrated ${migrate.applied} human edit(s) from ${o.from} · ${migrate.conflicts.length} conflict(s) · ${migrate.orphans.length} orphan(s)`); for (const c of migrate.conflicts) console.error(`conflict ${c.s || c.m}${c.r ? '/' + c.r : ''}.${c.key}: kept human ${JSON.stringify(c.human)} over agent ${JSON.stringify(c.agent)}`); }
  const v = validate(deck);
  for (const m of v.errors) console.error('ERROR   ' + m);
  for (const m of v.warnings) console.error('warning ' + m);
  if (!v.ok && !o.force) { console.error('model invalid — fix the errors or pass --force'); process.exit(1); }
  fs.writeFileSync(o.out, html);
  console.log(`wrote ${o.out} · ${(html.length / 1024).toFixed(0)}KB · ${deck.format} ${deck.w}×${deck.h} · ${deck.slides.length} slides · master ${(deck.master || []).length} · layouts ${Object.keys(deck.layouts || {}).join(',') || '—'} · id ${deck.id} · rev ${hash}`);
}
