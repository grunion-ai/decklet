#!/usr/bin/env node
// decklet model-contract validator — pure Node, no browser. Agents run this before create/verify.
// usage: node bin/validate.mjs model.json [--style style.json] [--strict]     (--strict: warnings fail too)
//   --style: the same style.json create() will build with — text fit is only meaningful against the scale the deck will wear
// library: import {validate, mergeStyle, ROLES} from './validate.mjs'  →  {ok, errors:[…], warnings:[…]}
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export const ROLES = ['Title', 'Supertitle', 'H1', 'H2', 'Body', 'Caption', 'Label', 'Stat'];
export const ANIMS = ['rise', 'fade', 'pop', 'wipe'];   // entrance motion on slide entry — the engine ignores anything else
export const FORMATS = ['slides', 'carousel', 'carousel-4x5', 'document-letter', 'document-a4'];
export const ARROWS = ['start', 'end', 'both'];          // WHICH ends carry a head
export const HEADS = ['triangle', 'chevron', 'dot', 'bar'];   // WHAT is drawn there row
export const HREF = /^(https?:|mailto:)/i;               // href is model content: navigable schemes only, never javascript:/data:
const LOCKED = ['font', 'size', 'lh', 'ls', 'mono'];          // only a role may set these
const ROLE_REQ = ['font', 'size', 'weight', 'color'];   // lh is strongly recommended; null = browser-normal leading (what import-html emits for line-height:normal)
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const plain = r => (r.text ?? r.html ?? '').replace(/<[^>]+>/g, '');
const isText = r => r.text != null || r.html != null;
// end-to-end span of a connector row; below ~40px a line is an icon stroke (a tick, a cross), not a run between boxes
const connLen = r => { const x0 = r.x ?? 0, y0 = r.y ?? 0, e = r.line ? r.line : r.curve ? [r.curve[4], r.curve[5]] : null;
  return e && isNum(e[0]) && isNum(e[1]) ? Math.hypot(e[0] - x0, e[1] - y0) : 0; };

// style.json → deck: {tokens:{…}, roles:{…}, pad:{…}} — the model's own styles win per key. The ONE merge: create() builds with
// it and validate --style measures text fit against it, so the two scales can never drift apart. Mutates and returns the deck.
export function mergeStyle(deck, style) {
  if (!style) return deck;
  deck.styles = deck.styles || {};
  deck.styles.roles = {...(style.roles || {}), ...(deck.styles.roles || {})};
  deck.styles.pad = {...(style.pad || {}), ...(deck.styles.pad || {})};
  return deck;
}

export function validate(deck) {
  const errors = [], warnings = [];
  const E = (m) => errors.push(m), Wn = (m) => warnings.push(m);
  if (!deck || typeof deck !== 'object') return {ok: false, errors: ['model is not an object'], warnings};
  const W = deck.w, H = deck.h;
  if (!isNum(W) || W <= 0) E('deck.w must be a positive number');
  if (!isNum(H) || H <= 0) E('deck.h must be a positive number');
  if (deck.format && !FORMATS.includes(deck.format)) E(`deck.format "${deck.format}" not one of ${FORMATS.join('|')}`);
  if (deck.page && !['letter', 'a4'].includes(deck.page)) E(`deck.page "${deck.page}" must be letter|a4`);
  // styles.roles — the eight-role strict type scale: every role is a complete treatment; one font+size per role
  // (Title = display size for title/closing-slide headlines; H1 = content-slide title)
  const roles = deck.styles && deck.styles.roles;
  if (!roles || typeof roles !== 'object' || !Object.keys(roles).length) E('styles.roles missing — every text row needs a role');
  else {
    for (const [name, t] of Object.entries(roles)) {
      if (!ROLES.includes(name)) Wn(`role "${name}" is outside the eight-role scale (${ROLES.join(', ')})`);
      for (const p of ROLE_REQ) if (t[p] == null) E(`role ${name}: missing ${p}`);
      if (t.size != null && !isNum(t.size)) E(`role ${name}: size must be a number`);
    }
    if (Object.keys(roles).length > 8) Wn(`${Object.keys(roles).length} roles — more than eight dilutes the scale`);
    if (Object.keys(roles).length && !roles.Body) Wn('no Body role — text rows without a role fall back to Body at render time');
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
    if (r.curve && !(Array.isArray(r.curve) && r.curve.length === 6 && r.curve.every(isNum))) E(`${where}: curve must be [c1x,c1y,c2x,c2y,x2,y2]`);
    if (r.arrow && !ARROWS.includes(r.arrow)) E(`${where}: arrow "${r.arrow}" not one of ${ARROWS.join('|')}`);
    else if (r.arrow && !r.line && !r.curve) E(`${where}: arrow needs a line or a curve to sit on`);
    // to/from: terminate a connector against another row, so the engine — not the author — computes where the head stops
    for (const p of ['to', 'from']) {
      if (r[p] == null) continue;
      if (!r.line && !r.curve) { E(`${where}: ${p} needs a line or a curve to terminate`); continue; }
      const tgt = typeof r[p] === 'number' ? (s && s.els || [])[r[p]] : ((s && s.els || []).find(x => x.id === r[p]) || master.find(m => m.id === r[p]));
      if (!tgt) { E(`${where}: ${p} "${r[p]}" is not a row id on this slide, a master id, or a row index`); continue; }
      const sl = (tgt.slot && ((deck.slots || {})[tgt.slot] || (s && layouts[s.layout] && layouts[s.layout][tgt.slot]))) || {};
      if (!['x', 'y', 'w', 'h'].every(k => isNum(tgt[k] ?? sl[k]))) Wn(`${where}: ${p} "${r[p]}" has no resolvable x/y/w/h — the connector cannot be clipped to it`);
    }
    if (r.head != null) {
      if (!HEADS.includes(r.head)) E(`${where}: head "${r.head}" not one of ${HEADS.join('|')}`);
      else if (!r.arrow) E(`${where}: head needs arrow to say which end carries it`);
    }
    if (r.dash != null) {
      if (!(r.dash === 1 || r.dash === true || (Array.isArray(r.dash) && r.dash.length === 2 && r.dash.every(v => isNum(v) && v > 0)))) E(`${where}: dash must be 1 or [on,off]`);
      else if (!r.line && !r.curve) E(`${where}: dash needs a line or a curve`);
    }
    // ── connector SHAPE rules. Warnings, never errors: a deck may have a deliberate exception — declare it with waive:1.
    // Ruled on two connector probes (decks/connector-probe*/RULES.md); see SKILL.md CONNECTORS for the full list.
    //
    // A CONNECTOR IS A STROKE WITH A HEAD. Every rule below is about a line that POINTS AT something: where it may run, how
    // it may bend, how much air it leaves at the thing it points to. A headless stroke is a rule, an underline, an
    // annotation leader, a chart series or decoration — it has no target, so none of this applies to it. Kyle's own ruling
    // draws the line in exactly this place (G1's 1.5px WITH a head rejected, H5's 1px hairline leader accepted), and the
    // cost of getting it wrong is a validator that flags a chart for being diagonal, which teaches agents to stop reading
    // warnings at all. Length is the second guard: under 40px a headed stroke is an icon, not a run between boxes.
    // …only for rows long enough to BE connectors: a 9px stroke is a tick or a cross drawn as a line, not a run between boxes
    if ((r.line || r.curve) && r.arrow && !r.waive && connLen(r) >= 40) {
      const sw = r.h ?? 3, x0 = r.x ?? 0, y0 = r.y ?? 0;
      if (sw < 2.5) Wn(`${where}: a headed connector at h=${sw} is too light — use 2.5 or more (a headless leader may be a hairline)`);
      if (Array.isArray(r.line) && r.line.every(isNum)) {
        const dx = Math.abs(r.line[0] - x0), dy = Math.abs(r.line[1] - y0);
        if (dx > 2 && dy > 2) Wn(`${where}: diagonal straight run — draw an elbow of two orthogonal segments instead`);
      }
      if (Array.isArray(r.curve) && r.curve.length === 6 && r.curve.every(isNum)) {
        const [c1x, c1y, c2x, c2y, ex, ey] = r.curve;
        const horiz = Math.abs(ex - x0) >= Math.abs(ey - y0), run = horiz ? Math.abs(ex - x0) : Math.abs(ey - y0);
        const A = horiz ? [x0, c1x, c2x, ex] : [y0, c1y, c2y, ey], B = horiz ? [y0, c1y, c2y, ey] : [x0, c1x, c2x, ex];
        if (run < 88) Wn(`${where}: S-curve spanning ${Math.round(run)}px — an S-curve needs about 96px of channel, or re-cut the layout so it fits`);
        const lo = Math.min(A[0], A[3]), hi = Math.max(A[0], A[3]);
        for (const k of [1, 2]) if (A[k] < lo - 2 || A[k] > hi + 2) Wn(`${where}: control point ${k} sits past the endpoints — the curve overshoots and doubles back`);
        // a control point taken out ALONG the run should reach 50%..90% of it; one taken out PERPENDICULAR (C5) is fine
        for (const [k, base, far] of [[1, 0, 3], [2, 3, 0]]) {
          const along = Math.abs(A[k] - A[base]), across = Math.abs(B[k] - B[base]);
          if (run > 0 && along > across && along / run < 0.4) Wn(`${where}: control point ${k} at ${Math.round(along / run * 100)}% of the run — take it to 50% or 90%, or out perpendicular`);
        }
      }
    }
    if (r.href != null && !HREF.test(String(r.href).trim())) E(`${where}: href "${String(r.href).slice(0, 40)}" must be http, https or mailto`);
    if (r.html) for (const m of r.html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']*)["']/gi)) if (!HREF.test(m[1].trim())) E(`${where}: link run href "${m[1].slice(0, 40)}" must be http, https or mailto`);
    if (r.anim && !ANIMS.includes(r.anim)) E(`${where}: anim "${r.anim}" not one of ${ANIMS.join('|')}`);
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
    // ── connector AIR, across the slide: a connector leaves the same visible gap at both ends and never touches a
    // container. `to:`/`from:` hand that to the engine, so ends it terminates are not second-guessed here.
    // Headed strokes only — see the note above: a chart series or a decorative path has nothing to leave air FROM.
    const conn = s.els.map((r, ei) => ({r, ei})).filter(o => o.r && (o.r.line || o.r.curve) && o.r.arrow && !o.r.waive && connLen(o.r) >= 40);
    // containers only — the same shape the collision gate calls chrome. A tint band with no border is a backdrop a chart
    // line may legitimately run inside; the rule is about terminating on or inside a BORDER.
    const rects = s.els.filter(e => e && !isText(e) && (e.bd || e.bt || e.br || e.bb || e.bl || e.box || e.tile)
      && ['x', 'y', 'w', 'h'].every(k => isNum(e[k])) && Math.min(e.w, e.h) > 24);
    const holds = (b, p) => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h;
    // a box holding BOTH ends is the container the diagram lives in, not something the connector terminates against
    const clear = (pt, other) => { let best = Infinity;
      for (const b of rects) { if (holds(b, pt) && holds(b, other)) continue;
        const dx = Math.max(b.x - pt[0], pt[0] - (b.x + b.w), 0), dy = Math.max(b.y - pt[1], pt[1] - (b.y + b.h), 0);
        best = Math.min(best, (dx || dy) ? Math.hypot(dx, dy) : -1); }
      return best; };
    const endOf = r => r.line ? [r.line[0], r.line[1]] : [r.curve[4], r.curve[5]];
    // a stub is a segment that ENDS where two connectors begin — and the stub itself is normally headless (only the
    // branches carry heads), so look for it among ALL strokes even though only headed rows are warned about
    const fedBy = s.els.filter(e => e && (e.line || e.curve) && connLen(e) >= 40).map(endOf);
    const seen = [];
    for (const {r, ei} of conn) {
      const w = `slides[${si}].els[${ei}]`, a0 = [r.x ?? 0, r.y ?? 0];
      const z0 = r.line ? [r.line[0], r.line[1]] : [r.curve[4], r.curve[5]];
      const ends = [[a0, r.from, z0], [z0, r.to, a0]].map(([pt, term, other]) => term != null ? null : clear(pt, other));
      for (const g of ends) if (g !== null && g <= 1) Wn(`${w}: touches the box — a connector stops clear of it (10px is the default; to:/from: does it for you)`);
      const [g1, g2] = ends;
      if (g1 !== null && g2 !== null && g1 > 2 && g2 > 2 && g1 < 60 && g2 < 60 && Math.abs(g1 - g2) > 4)
        Wn(`${w}: uneven air — ${Math.round(g1)}px at one end, ${Math.round(g2)}px at the other; use the same gap at both`);
      if (fedBy.some(e => Math.hypot(e[0] - a0[0], e[1] - a0[1]) < 4))
        for (const q of seen) if (Math.hypot(q[0] - a0[0], q[1] - a0[1]) < 4) Wn(`${w}: shared stub — a segment feeds a point that two connectors leave from; fan out from the edge instead`);
      seen.push(a0);
    }
  });
  return {ok: !errors.length, errors, warnings};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), strict = a.includes('--strict'), si = a.indexOf('--style');
  const file = (si < 0 ? a : a.filter((_, k) => k !== si && k !== si + 1)).find(x => !x.startsWith('--'));
  if (!file) { console.error('usage: node bin/validate.mjs model.json [--style style.json] [--strict]'); process.exit(2); }
  const deck = JSON.parse(fs.readFileSync(file, 'utf8'));
  // --style: the real type scale usually arrives at create time. Merge it the same way create() does, or text fit is measured
  // against the wrong roles — validate reports 0 warnings while create --style reports the overflow verify then fails on.
  mergeStyle(deck, si >= 0 ? JSON.parse(fs.readFileSync(a[si + 1], 'utf8')) : null);
  if (!deck.styles || !deck.styles.roles || !Object.keys(deck.styles.roles).length) { // no roles anywhere → create.mjs inherits the template's neutral scale; validate against the same
    const tpl = new URL('../template.html', import.meta.url);
    if (fs.existsSync(tpl)) { const t = JSON.parse(fs.readFileSync(tpl, 'utf8').match(/\/\*DECK\*\/([\s\S]*?)\/\*\/DECK\*\//)[1]); deck.styles = {...t.styles, ...(deck.styles || {}), roles: t.styles.roles}; console.error('note    no styles.roles in the model — validated against the template\'s neutral roles (create.mjs does the same)'); }
  }
  const r = validate(deck);
  for (const m of r.errors) console.error('ERROR   ' + m);
  for (const m of r.warnings) console.error('warning ' + m);
  console.log(`${file}: ${r.errors.length} errors, ${r.warnings.length} warnings`);
  process.exit(r.ok && !(strict && r.warnings.length) ? 0 : 1);
}
