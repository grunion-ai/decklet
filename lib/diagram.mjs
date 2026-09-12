// decklet figures — a spec of nodes (rect / pill / diamond / circle), edges, dashed groups, a timeline and a note becomes
// native rows: every node, label and connector is editable and draggable, grouped so a node or an edge moves as one unit.
// Colours are tokens; strokes follow the CONNECTORS rules (≥ 2.5px headed, to/from termination, engine dash and head).
// Only a diamond keeps its paint as an svg row (no native diamond); its title is still a text row.
// Ported from the harness helper that drew the nine figure kinds (2026-09-07). The router and label rules are the ones
// the eyeball rounds shaped: a target to the right takes an H-V-H route between the facing vertical sides (straight when
// level); anything else takes a V-H-V route between the facing horizontal sides (straight when in one column); edges
// sharing a face fan 20px apart at both ends; a label sits on the run nearest the target, and lifts above the node tops
// (straight) or moves beside the vertical (bent) when it does not fit its run; a node keeps 4px inside the frame.
// Simplification: nodes carry explicit x/y/w/h (snapped to 8px); auto-layout is the upgrade if a deck needs it. The
// inline-<svg> drawing of the same spec (for web artifacts) stays out of the engine: a deck never draws a figure as one
// opaque svg, so nothing here needs it.
// usage: import {diagramRows, diagramSlide, diagramLayout} from '@grunion/decklet/diagram'
import {libraryFor} from './layouts.mjs';

const snap = n => Math.round(n / 8) * 8;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const stroke = state => state === 'chosen' ? 'var(--accent)' : state === 'lost' ? 'var(--muted)' : 'var(--fg)';
const SHAPES = ['rect', 'pill', 'diamond', 'circle'];
const labelW = text => text.length * 8 + 8;   // 11px mono Label + 1px tracking, measured 7.6px a glyph
const fits = (run, text) => run >= labelW(text) + 16;   // the chip is w + 8 of padding, and owes each node the 4px gap validate enforces

const rightward = (a, b) => snap(b.x) - 4 >= snap(a.x) + a.w + 4 + 16;
const face = (e, byId) => `${e.from}:${rightward(byId[e.from], byId[e.to]) ? 'right' : snap(byId[e.to].y) > snap(byId[e.from].y) ? 'bottom' : 'top'}`;
const entry = (e, byId) => `${e.to}:${rightward(byId[e.from], byId[e.to]) ? 'left' : snap(byId[e.to].y) > snap(byId[e.from].y) ? 'top' : 'bottom'}`;
const SPREAD = 20;   // px between edges sharing a face: a 14px label chip above a run must clear the next run
const spread = (e, peers) => (peers.indexOf(e) - (peers.length - 1) / 2) * SPREAD;
function fan(e, all, byId) {
  const ok = all.filter(o => byId[o.from] && byId[o.to]);
  return [spread(e, ok.filter(o => face(o, byId) === face(e, byId))), spread(e, ok.filter(o => entry(o, byId) === entry(e, byId)))];
}
const routePoints = (e, byId, [off, endOff]) => {
  const a = byId[e.from], b = byId[e.to], ax = snap(a.x), ay = snap(a.y), bx = snap(b.x), by = snap(b.y);
  if (rightward(a, b)) {
    const x1 = ax + a.w, y1 = ay + a.h / 2 + off, x2 = bx, y2 = by + b.h / 2 + (endOff || (ay + a.h / 2 === by + b.h / 2 ? off : 0));
    if (y1 === y2) return [[x1, y1], [x2, y2]];
    const xm = snap((x1 + x2) / 2); return [[x1, y1], [xm, y1], [xm, y2], [x2, y2]];
  }
  const down = by > ay, xs = ax + a.w / 2 + off, xe = bx + b.w / 2 + (endOff || (ax + a.w / 2 === bx + b.w / 2 ? off : 0));
  const ys = down ? ay + a.h : ay, ye = down ? by : by + b.h, ym = snap((ys + ye) / 2);
  if (xs === xe) return [[xs, ys], [xe, ye]];
  return [[xs, ys], [xs, ym], [xe, ym], [xe, ye]];
};

// the rows of one figure, offset into `frame` and scaled to its width. `palette` maps every colour token to that
// palette's prefixed twin (var(--fg) → var(--us-fg)) so one deck can show the same figure under several palettes.
export function diagramRows(spec, frame, {palette} = {}) {
  if (!spec.label) throw new Error('diagram needs a label (the one claim the figure makes)');
  const rows = rowsOf(spec, frame);
  if (!palette) return rows;
  const map = v => typeof v === 'string' ? v.replace(/var\(--(fg|muted|accent|card|box|line)\)/g, `var(--${palette}-$1)`) : v;
  return rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, map(v)])));
}

function rowsOf(spec, frame) {
  const k = frame.w / spec.w, X = v => Math.round(frame.x + v * k), Y = v => Math.round(frame.y + v * k), S = v => Math.round(v * k);
  const byId = Object.fromEntries((spec.nodes || []).map(n => [n.id, n]));
  const rows = [];
  const lbl = (text, x, y, w, group, extra = {}) => rows.push({x, y, w, role: 'Label', nowrap: 1, ...extra, text, group});
  for (const g of spec.groups || []) {
    const group = `g:${g.label || rows.length}`;
    rows.push({x: X(g.x), y: Y(g.y), w: S(g.w), h: S(g.h), bd: '1px dashed var(--line)', radius: 12, over: 1, group});   // over: a boundary is crossed by design
    if (g.label) lbl(g.label, X(g.x) + 12, Y(g.y) + 6, S(g.w) - 24, group);
  }
  for (const n of spec.nodes || []) {
    const x = snap(n.x), y = snap(n.y), w = n.w, h = n.h, s = n.state || '', shape = n.shape || 'rect';
    if (x < 4 || y < 4 || x + w > spec.w - 4 || y + h > spec.h - 4) throw new Error(`node ${n.id}: keep a 4px inset from the frame edge, the row clips the stroke`);
    if (!SHAPES.includes(shape)) throw new Error(`node ${n.id}: shape must be one of ${SHAPES.join(' | ')}`);
    const bd = `${s === 'chosen' ? 2 : 1}px ${s === 'lost' ? 'dashed' : 'solid'} ${stroke(s)}`, bg = s === 'chosen' ? 'var(--box)' : 'var(--card)';
    const centred = shape === 'diamond' || shape === 'circle' || !n.sub;
    if (shape === 'diamond') rows.push({id: n.id, x: X(x), y: Y(y), w: S(w), h: S(h), svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(n.title)}" style="display:block;overflow:visible"><polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="${bg}" stroke="${stroke(s)}" stroke-width="${s === 'chosen' ? 2 : 1}"${s === 'lost' ? ' stroke-dasharray="3 4"' : ''} vector-effect="non-scaling-stroke"/></svg>`, group: n.id});
    else rows.push({id: n.id, x: X(x), y: Y(y), w: S(w), h: S(h), bg, bd, radius: shape === 'circle' ? '50%' : shape === 'pill' ? S(h) / 2 : 8, group: n.id});
    const inset = shape === 'diamond' ? S(w) / 8 : shape === 'circle' ? S(w) / 6 : 16;
    rows.push({x: X(x) + inset, y: centred ? Y(y) + S(h) / 2 - 12 : Y(y) + 8, w: S(w) - 2 * inset, role: 'Body', weight: 600, color: 'var(--fg)', nowrap: 1, ...(centred ? {align: 'center'} : {}), text: n.title, group: n.id});
    if (n.sub && !centred) lbl(n.sub, X(x) + 16, Y(y) + S(h) - 24, S(w) - 32, n.id, {color: 'var(--muted)'});
  }
  (spec.edges || []).forEach((e, i, all) => {
    if (!byId[e.from] || !byId[e.to]) throw new Error(`edge ${e.from}→${e.to}: unknown node`);
    const s = e.state || '', group = `e:${e.from}-${e.to}`, pts = routePoints(e, byId, fan(e, all, byId));
    const h = s === 'chosen' ? 3 : 2.5, last = pts.length - 2;
    for (let j = 0; j <= last; j++) {
      const [x1, y1] = pts[j], [x2, y2] = pts[j + 1];
      rows.push({x: X(x1), y: Y(y1), line: [X(x2), Y(y2)], h, bg: stroke(s), ...(s === 'lost' ? {dash: 1} : {}),
        ...(j === 0 ? {from: e.from} : {}), ...(j === last ? {to: e.to, arrow: 'end', head: 'triangle'} : {}), group});
    }
    if (!e.label) return;
    const w = labelW(e.label), chip = {align: 'center', bg: 'var(--card)', p: '1px 4px'};   // a bg row carries explicit padding
    const a = byId[e.from], b = byId[e.to], tops = Math.min(snap(a.y), snap(b.y));
    if (pts.length === 2) {
      const [[x1, y1], [x2, y2]] = pts, level = y1 === y2, run = level ? x2 - x1 : y2 - y1;
      if (level) lbl(e.label, Math.round(X((x1 + x2) / 2) - w / 2) - 4, fits(run, e.label) ? Y(y1) - 18 : Y(tops) - 22, w, group, chip);   // lifted: 22 clears a 16px chip by the gap
      else lbl(e.label, X(x1) + 6, Y((y1 + y2) / 2) - 8, w, group, {bg: 'var(--card)', p: '1px 4px'});
    } else {
      const [p0, p1, p2, p3] = pts, horizontalMid = p1[1] === p2[1];
      if (horizontalMid) lbl(e.label, Math.round(X((p1[0] + p2[0]) / 2) - w / 2) - 4, Y(p1[1]) - 18, w, group, chip);
      else if (fits(p3[0] - p2[0], e.label)) lbl(e.label, Math.round(X((p2[0] + p3[0]) / 2) - w / 2) - 4, Y(p3[1]) - 18, w, group, chip);
      else if (Math.abs(p0[1] - p3[1]) < b.h + 16) lbl(e.label, Math.round(X(p1[0]) - w / 2) - 4, Y(tops) - 22, w, group, chip);   // a short vertical: beside it the chip sits in the target box, so it lifts above the node tops over the bend
      else lbl(e.label, X(p1[0]) + 6, Y((p1[1] + p2[1]) / 2) - 8, w, group, {bg: 'var(--card)', p: '1px 4px'});
    }
  });
  if (spec.timeline) {
    const t = spec.timeline, n = t.ticks.length, step = n > 1 ? t.w / (n - 1) : 0;
    rows.push({x: X(t.x), y: Y(t.y), line: [X(t.x + t.w), Y(t.y)], h: 2, bg: 'var(--accent)', group: 'timeline'});
    t.ticks.forEach((tk, i) => {
      const cx = t.x + i * step, g = `tick:${tk.label}`;   // a tick is its own unit: the dot and its labels move together, free of the rule
      rows.push({x: X(cx) - 7, y: Y(t.y) - 7, w: 14, h: 14, bg: tk.filled ? 'var(--accent)' : 'var(--card)', bd: '2px solid var(--accent)', radius: '50%', group: g});
      lbl(tk.label, X(cx) - 48, Y(t.y) - 32, 96, g, {align: 'center', color: 'var(--fg)', tt: 'none'});   // 96: an eleven-letter sublabel (marketplace) fits
      if (tk.sub) lbl(tk.sub, X(cx) - 48, Y(t.y) + 16, 96, g, {align: 'center'});
    });
  }
  if (spec.note) rows.push({x: X(spec.note.x), y: Y(spec.note.y), w: S(spec.w - spec.note.x), role: 'Label', text: spec.note.lines.join('\n'), group: 'note'});
  return rows;
}

// the library's `diagram` layout at a space (`WxH`): its text slots, and the figure slot as the frame the rows fill
export function diagramLayout(space = '960x540') {
  const m = /^(\d+)x(\d+)$/.exec(String(space));
  if (!m) throw new Error(`unknown space "${space}" (WxH, e.g. 960x540)`);
  const {figure, ...layout} = libraryFor({w: +m[1], h: +m[2], slides: [{layout: 'diagram'}]}).diagram;
  return {layout, frame: {x: figure.x, y: figure.y, w: figure.w, h: figure.h}};
}

// a ready slide on the `diagram` layout: chrome, the figure's rows, and the caption stating the claim
export function diagramSlide(spec, {space = '960x540', name = 'diagram', supertitle, title, caption, palette} = {}) {
  if (!caption) throw new Error('a diagram slide needs a caption: the sentence the figure proves');
  const {frame} = diagramLayout(space);
  const [W, H] = space.split('x').map(Number), P = palette ? {fg: `var(--${palette}-fg)`, muted: `var(--${palette}-muted)`, accent: `var(--${palette}-accent)`} : {};
  const els = [];
  if (palette) els.push({x: 0, y: 0, w: W, h: H, bg: `var(--${palette}-bg)`, over: 1});   // the slide wears the palette's ground
  if (supertitle) els.push({slot: 'supertitle', text: supertitle, ...(palette ? {color: P.accent} : {})});
  if (title) els.push({slot: 'title', text: title, ...(palette ? {color: P.fg} : {})});
  els.push(...diagramRows(spec, frame, {palette}), {slot: 'caption', text: caption, ...(palette ? {color: P.muted} : {})});
  return {name, layout: 'diagram', els};
}
