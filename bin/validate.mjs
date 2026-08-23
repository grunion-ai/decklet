#!/usr/bin/env node
// decklet model-contract validator — pure Node, no browser. Agents run this before create/verify.
// usage: node bin/validate.mjs model.json [--strict]     (--strict: warnings fail too)
// library: import {validate, ROLES} from './validate.mjs'  →  {ok, errors:[…], warnings:[…]}
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export const ROLES = ['Supertitle', 'H1', 'H2', 'Body', 'Caption', 'Label', 'Stat'];
export const FORMATS = ['slides', 'carousel', 'carousel-4x5', 'document-letter', 'document-a4'];
const LOCKED = ['font', 'size', 'lh', 'ls', 'mono'];          // only a role may set these
const ROLE_REQ = ['font', 'size', 'weight', 'color'];   // lh is strongly recommended; null = browser-normal leading (what import-html emits for line-height:normal)
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const plain = r => (r.text ?? r.html ?? '').replace(/<[^>]+>/g, '');
const isText = r => r.text != null || r.html != null;

export function validate(deck) {
  const errors = [], warnings = [];
  const E = (m) => errors.push(m), Wn = (m) => warnings.push(m);
  if (!deck || typeof deck !== 'object') return {ok: false, errors: ['model is not an object'], warnings};
  const W = deck.w, H = deck.h;
  if (!isNum(W) || W <= 0) E('deck.w must be a positive number');
  if (!isNum(H) || H <= 0) E('deck.h must be a positive number');
  if (deck.format && !FORMATS.includes(deck.format)) E(`deck.format "${deck.format}" not one of ${FORMATS.join('|')}`);
  if (deck.page && !['letter', 'a4'].includes(deck.page)) E(`deck.page "${deck.page}" must be letter|a4`);
  // styles.roles — the seven-role strict type scale: every role is a complete treatment; one font+size per role
  const roles = deck.styles && deck.styles.roles;
  if (!roles || typeof roles !== 'object' || !Object.keys(roles).length) E('styles.roles missing — every text row needs a role');
  else {
    for (const [name, t] of Object.entries(roles)) {
      if (!ROLES.includes(name)) Wn(`role "${name}" is outside the seven-role scale (${ROLES.join(', ')})`);
      for (const p of ROLE_REQ) if (t[p] == null) E(`role ${name}: missing ${p}`);
      if (t.size != null && !isNum(t.size)) E(`role ${name}: size must be a number`);
    }
    if (Object.keys(roles).length > 7) Wn(`${Object.keys(roles).length} roles — more than seven dilutes the scale`);
  }
  const roleOk = n => !!(roles && roles[n]);
  const roleOf = n => (roles && roles[n]) || null;
  const pad = (deck.styles && deck.styles.pad) || {};
  // slots (deck scope) + layouts
  const checkSlot = (where, name, sl) => {
    if (!sl || typeof sl !== 'object') return E(`${where}.${name}: slot must be an object`);
    for (const p of ['x', 'y', 'w']) if (sl[p] != null && sl[p] !== 'auto' && !isNum(sl[p])) E(`${where}.${name}.${p} must be a number`);
    if (sl.role && !roleOk(sl.role)) E(`${where}.${name}: role "${sl.role}" not in styles.roles`);
    if (!sl.role) Wn(`${where}.${name}: slot has no role — rows bound to it must carry one`);
  };
  for (const [n, sl] of Object.entries(deck.slots || {})) checkSlot('slots', n, sl);
  const layouts = deck.layouts || {};
  for (const [ln, lay] of Object.entries(layouts)) for (const [n, sl] of Object.entries(lay || {})) checkSlot(`layouts.${ln}`, n, sl);
  // master
  const master = deck.master || [];
  if (!Array.isArray(master)) E('master must be an array');
  const mids = new Set();
  let footers = 0;
  master.forEach((m, k) => { if (!m.id) E(`master[${k}]: missing id`); else if (mids.has(m.id)) E(`master[${k}]: duplicate id ${m.id}`); else mids.add(m.id); if (m.footer) footers++; });
  if (footers > 1) E(`${footers} footer master rows — at most one carries the counter`);
  // rows
  const row = (r, where, s) => {
    if (!r || typeof r !== 'object') return E(`${where}: row must be an object`);
    const slot = r.slot && ((deck.slots || {})[r.slot] || (s && layouts[s.layout] && layouts[s.layout][r.slot]));
    if (r.slot && !slot) E(`${where}: slot "${r.slot}" not in ${s && s.layout ? `layout "${s.layout}"` : 'any layout'} or deck.slots`);
    if (r.role && !roleOk(r.role)) E(`${where}: role "${r.role}" not in styles.roles`);
    const role = r.role || (slot && slot.role);
    const textual = isText(r);
    if (textual && !role) E(`${where}: text row "${plain(r).slice(0, 30)}" has no role (role or slot required)`);
    for (const p of LOCKED) if (r[p] != null && textual) E(`${where}: "${plain(r).slice(0, 30)}" overrides ${p} — only a role sets font/size/lh/ls/mono`);
    if (r.html && /<script|on\w+=/i.test(r.html)) E(`${where}: html contains script/handler`);
    if (r.html && /font-size|font-family|line-height|letter-spacing/.test(r.html)) E(`${where}: html runs carry size/family/leading — runs may only carry color/weight/marks`);
    for (const p of ['x', 'y', 'h']) if (r[p] != null && !isNum(r[p])) E(`${where}: ${p} must be a number`);
    if (r.w != null && r.w !== 'auto' && !isNum(r.w)) E(`${where}: w must be a number or "auto"`);
    if (r.line && !(Array.isArray(r.line) && r.line.length === 2 && r.line.every(isNum))) E(`${where}: line must be [x2,y2]`);
    if (r.donut != null && !(isNum(r.donut) && r.donut >= 0 && r.donut <= 100)) E(`${where}: donut must be 0..100`);
    if (r.bar && !(isNum(r.h) && r.bg)) E(`${where}: bar needs h and bg`);
    if (r.p != null && typeof r.p === 'string' && !pad[r.p] && !/px|em|%/.test(r.p)) E(`${where}: p "${r.p}" is neither a styles.pad token nor a CSS length`);
    if (r.override && !mids.has(r.override)) E(`${where}: override "${r.override}" is not a master id`);
    if (r.css) Wn(`${where}: raw css escape hatch used`);
    if (r.img && !/^data:/.test(r.img)) E(`${where}: img must be a data: URI (single file, zero network)`);
    if (r.svg && /<script|href\s*=\s*["']https?:/i.test(r.svg)) E(`${where}: svg contains script or external href`);
    if (textual && /^\s*\d+\s*\/\s*\d+\s*$/.test(plain(r))) Wn(`${where}: "${plain(r).trim()}" looks like a hardcoded page counter — the footer master renders it`);
    // geometry: inside the canvas (slot geometry resolved)
    const x = r.x ?? (slot && slot.x) ?? 0, y = r.y ?? (slot && slot.y) ?? 0, w = r.w ?? (slot && slot.w);
    if (isNum(W) && isNum(w) && x + w > W + 0.5) Wn(`${where}: extends past the right edge (${x}+${w} > ${W})`);
    if (isNum(H) && y > H) Wn(`${where}: y ${y} is below the canvas (${H})`);
    // text-fit heuristic: a nowrap row whose text is wider than its box (0.55em per char) will overflow
    if (textual && r.nowrap && isNum(w) && roleOf(role) && plain(r).length * roleOf(role).size * 0.55 > w) Wn(`${where}: nowrap text "${plain(r).slice(0, 30)}" likely wider than w=${w} — widen or use w:"auto"`);
    if (textual && !r.nowrap && r.w !== 'auto' && isNum(w) && roleOf(role) && plain(r).length * roleOf(role).size * 0.55 > w * 3.5 && !/\n/.test(plain(r))) Wn(`${where}: "${plain(r).slice(0, 30)}" wraps past 3 lines at w=${w} — split it or widen`);
  };
  master.forEach((m, k) => row(m, `master[${k}]`, null));
  if (!Array.isArray(deck.slides) || !deck.slides.length) E('slides must be a non-empty array');
  else deck.slides.forEach((s, si) => {
    if (!s || typeof s !== 'object') return E(`slides[${si}]: not an object`);
    if (s.layout && !layouts[s.layout]) E(`slides[${si}]: layout "${s.layout}" not in deck.layouts`);
    if (!Array.isArray(s.els)) return E(`slides[${si}]: els must be an array`);
    for (const id of s.hide || []) if (!mids.has(id)) E(`slides[${si}]: hide "${id}" is not a master id`);
    const used = new Set();
    s.els.forEach((r, ei) => { row(r, `slides[${si}].els[${ei}]`, s); if (r && r.slot) { if (used.has(r.slot)) Wn(`slides[${si}]: slot "${r.slot}" bound twice`); used.add(r.slot); } });
  });
  return {ok: !errors.length, errors, warnings};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), strict = a.includes('--strict'), file = a.find(x => !x.startsWith('--'));
  if (!file) { console.error('usage: node bin/validate.mjs model.json [--strict]'); process.exit(2); }
  const deck = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!(deck.styles && deck.styles.roles)) { // no roles in the model → create.mjs inherits the template's neutral scale; validate against the same
    const tpl = new URL('../template.html', import.meta.url);
    if (fs.existsSync(tpl)) { const t = JSON.parse(fs.readFileSync(tpl, 'utf8').match(/\/\*DECK\*\/([\s\S]*?)\/\*\/DECK\*\//)[1]); deck.styles = {...t.styles, ...(deck.styles || {}), roles: t.styles.roles}; console.error('note    no styles.roles in the model — validated against the template\'s neutral roles (create.mjs does the same)'); }
  }
  const r = validate(deck);
  for (const m of r.errors) console.error('ERROR   ' + m);
  for (const m of r.warnings) console.error('warning ' + m);
  console.log(`${file}: ${r.errors.length} errors, ${r.warnings.length} warnings`);
  process.exit(r.ok && !(strict && r.warnings.length) ? 0 : 1);
}
