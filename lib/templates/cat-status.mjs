import { M, t, lab, cap, body, rect, rule, vrule, cols } from './kit.mjs';

export const STATUS_COLORS = ['var(--idle,#4B5563)', 'var(--ok,#34D399)', 'var(--warn,#FBBF24)', 'var(--stop,#F87171)'];
export const STATUS_INK = 'var(--on-status,#0B0F17)';
const INK = STATUS_INK, LINE = 'var(--line)', MUTED = 'var(--muted)', BOX = 'var(--box)', CARD = 'var(--card)';
const HAIR = `1px solid ${LINE}`;
const STATES = '0 not started, 1 green, 2 amber, 3 red';
const on = s => Math.max(0, Math.min(3, Math.round(s)));
const st = s => STATUS_COLORS[on(s)];
const state = (sample, of, extra = {}) => ({ range: [0, 3], sample, of: `${of}: ${STATES}`, ...extra });
const listed = (sample, of) => state(sample, of, { optional: true, unset: -1 });
const live = (v, key, n) => Array.from({ length: n }, (_, i) => v[`${key}${i + 1}`]).filter(s => s >= 0).length;
const given = (fill, key, n) => Array.from({ length: n }, (_, i) => `${key}${i + 1}`).filter(k => k in fill).length;
const edge = d => `${Math.max(2, Math.round(d * 0.14))}px solid`;
const lamp = (x, y, d, s, extra = {}) => on(s) ? rect(x, y, d, d, { radius: d, bg: st(s), ...extra }) : rect(x, y, d, d, { radius: d, bd: `${edge(d)} ${st(0)}`, ...extra });
const ring = (x, y, d, s) => rect(x, y, d, d, { radius: d, bd: `${edge(d)} ${st(s)}` });
const stoplight = (x, y, d, s, upright) => {
  const gap = Math.round(d * 0.3), pad = Math.round(d * 0.38), long = d * 3 + gap * 2 + pad * 2, short = d + pad * 2;
  return [rect(x, y, upright ? short : long, upright ? long : short, { bg: BOX, bd: HAIR, radius: short }),
    ...[3, 2, 1].map((c, i) => rect(x + pad + (upright ? 0 : i * (d + gap)), y + pad + (upright ? i * (d + gap) : 0), d, d, { radius: d, bg: st(c), ...(c === on(s) ? {} : { op: 0.17 }) }))];
};
const kv = (x, y, w, k, v, extra = {}) => [lab(x, y, w, k, { nowrap: 1, ...extra }), body(x, y + 18, w, v, extra)];
const facts = (x, y, w, list, extra = {}, pitch = 72) => list.flatMap(([k, v], i) => kv(x, y + i * pitch, w, k, v, extra));
const across = (y, list, extra = {}) => cols(3).flatMap((c, i) => kv(c.x, y, c.w, list[i][0], list[i][1], extra));
const rail = (w, bg) => bg ? [rect(0, 0, w, 540, { bg, over: 1 })] : [rect(0, 0, w, 540, { bg: BOX, over: 1 }), vrule(w, 0, 540, { over: 1 })];
const segments = (x, y, w, n, paint, h = 11, gap = 4) => { const sw = Math.max(2, Math.floor((w - gap * (n - 1)) / n));
  return Array.from({ length: n }, (_, i) => rect(x + i * (sw + gap), y, sw, h, paint(i))); };
const count = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
const RX = 29, RW = 172, BX = 269, BW = 631;

export default [
{ id: 'status-rail', textOnly: true, name: 'Status — left rail', tier: 'core', cat: 'Status', note: 'One lamp and the status word in a left rail, three labelled facts beside it. The rail can take the status colour.', layout: null, foot: { x: BX, w: 340 },
  vals: { state: state(2, 'the lamp and the colour of the status word'),
    fill: { range: [0, 1], sample: 0, of: 'the rail ground: 1 fills it with the status colour and sets the rail in dark ink, 0 keeps the quiet rail and the lamp' } },
  els: v => { const full = v.fill >= 0.5, ink = full ? { color: INK } : {};
    return [ ...rail(230, full ? st(v.state) : null), lab(RX, 48, RW, 'Ledger sync', { nowrap: 1, ...ink }),
      ...(full ? [] : [lamp(RX, 80, 58, v.state)]),
      full ? t(RX, 86, RW, 'H1', 'Amber', { nowrap: 1, color: INK }) : t(RX + 73, 95, RW - 73, 'H2', 'Amber', { nowrap: 1, color: st(v.state) }),
      rule(RX, 160, RX + RW, full ? { bg: INK, op: 0.25 } : {}),
      ...facts(RX, 176, RW, [['Next', 'Import speed'], ['Due', 'Dec 4']], ink, 60),
      t(BX, 52, BW, 'Supertitle', 'Weekly status'), t(BX, 76, BW, 'H1', 'Ledger sync'),
      ...facts(BX, 150, BW, [['Done', 'Duplicate entry fix shipped in the March build'], ['Doing', 'Import write path measured on the test host'], ['Risk', 'Build minutes at 90% of the monthly cap']]) ]; } },

{ id: 'status-hero', textOnly: true, name: 'Status — hero stoplight', tier: 'core', cat: 'Status', note: 'A three-lamp stoplight, the status word at display size and the one reason. Three facts on the right.', layout: null,
  vals: { state: state(2, 'the lit lamp and the colour of the status word') },
  els: v => [ ...stoplight(M, 156, 52, v.state, 1),
    t(182, 170, 430, 'Supertitle', 'Ledger sync · weekly status'), t(182, 192, 430, 'Title', 'Amber', { nowrap: 1, color: st(v.state) }),
    t(182, 268, 430, 'H1', 'Build minutes near the cap'),
    ...facts(641, 170, 259, [['Progress', '82%'], ['Next', 'Import speed · Dec 4'], ['Decision', 'Raise the cap or slow the nightly fixer']]) ] },

{ id: 'status-title-block', textOnly: true, name: 'Status — drawing title block', tier: 'standard', cat: 'Status', note: 'A statement up top and a six-cell title block bottom right, with a stoplight in the Status cell.', layout: 'content',
  vals: { state: state(2, 'the lit lamp in the Status cell') },
  els: v => { const X = [429, 592, 746], CWS = [163, 154, 154], top = 356;
    const cells = [['Project', 'Ledger sync'], ['Status', 'Amber'], ['Progress', '82%'], ['Next', 'Import speed'], ['Due', 'Dec 4'], ['Rev', 'Nov 27']];
    return [ { slot: 'supertitle', text: 'Weekly status' }, { slot: 'title', text: 'Ledger sync slips one week' },
      body(M, 136, 540, 'Write costs show only on the test host. Build spend is the open risk.', { color: MUTED }),
      rect(429, top, 471, 116, { bd: HAIR }), vrule(592, top, top + 116), vrule(746, top, top + 116), rule(429, top + 58, 900),
      ...cells.flatMap(([k, val], i) => { const x = X[i % 3] + 11, y = top + 58 * Math.floor(i / 3), w = CWS[i % 3] - 22, lead = i === 1 ? 62 : 0;
        return [ lab(x, y + 9, w, k, { nowrap: 1 }), ...(i === 1 ? stoplight(x, y + 27, 12, v.state, 0) : []), body(x + lead, y + 26, w - lead, val, { nowrap: 1 }) ]; }) ]; } },

{ id: 'status-title-strip', textOnly: true, name: 'Status — title strip', tier: 'core', cat: 'Status', note: 'A statement over a full-width strip of five cells: name, lamp, a segment bar, a run of lamps and one closing fact.', layout: 'content',
  vals: { state: state(1, 'the lamp in the second cell'),
    segs: { range: [2, 30], sample: 5, of: 'the bar in the third cell: how many segments (5 phases, 4 tranches, 30 days)' },
    lit: { range: [0, 30], sample: 2, of: 'how many segments are lit, from the left' },
    barState: state(1, 'the colour of the lit segments'),
    mark: { range: [0, 30], sample: 0, of: 'one segment drawn in its own colour (the day of an incident), 0 for none' },
    markState: state(2, 'the colour of the marked segment'),
    ...Object.fromEntries([2, 2, 1, 1, 1, 1].map((s, i) => [`l${i + 1}`, listed(s, `lamp ${i + 1} in the fourth cell (a week, a workstream, a component)`)])) },
  valsCheck: v => [...(v.lit > v.segs ? [`fill value "lit" is ${v.lit}, past the ${v.segs} segments the bar draws`] : []), ...(v.mark > v.segs ? [`fill value "mark" is ${v.mark}, past the ${v.segs} segments the bar draws`] : [])],
  els: v => { const X = [60, 215, 370, 564, 771], WS = [155, 155, 194, 207, 129], top = 414, n = count(v.segs, 2, 30), dense = n > 10;
    const head = ['Project', 'Status', 'Phase', 'Six weeks', 'Due'];
    return [ { slot: 'supertitle', text: 'Weekly status' }, { slot: 'title', text: 'Close report design is signed off' },
      body(M, 136, 560, 'Design phase continues. Pacing controls come next.', { color: MUTED }),
      rect(60, top, 840, 58, { bd: HAIR }), ...X.slice(1).map(x => vrule(x, top, top + 58)),
      ...head.map((k, i) => lab(X[i] + 11, top + 9, WS[i] - 22, k, { nowrap: 1 })),
      body(X[0] + 11, top + 26, WS[0] - 22, 'Close report', { nowrap: 1 }),
      lamp(X[1] + 11, top + 31, 15, v.state), body(X[1] + 33, top + 26, WS[1] - 44, 'Green', { nowrap: 1 }),
      ...segments(X[2] + 11, top + (dense ? 29 : 33), WS[2] - 22, n, i => ({ bg: i + 1 === Math.round(v.mark) ? st(v.markState) : i < Math.round(v.lit) ? st(v.barState) : LINE }), dense ? 18 : 11, dense ? 2 : 4),
      ...[1, 2, 3, 4, 5, 6].map(i => lamp(X[3] + 11 + (i - 1) * 21, top + 31, 14, v[`l${i}`], { q: `l${i}` })),
      body(X[4] + 11, top + 26, WS[4] - 22, 'Dec 19', { nowrap: 1 }) ]; } },

{ id: 'status-margin-notes', textOnly: true, name: 'Status — margin notes', tier: 'standard', cat: 'Status', note: 'The week in a paragraph, with a stoplight and three facts in the right margin.', layout: 'content',
  vals: { state: state(2, 'the lit lamp and the colour of the status word') },
  els: v => [ { slot: 'supertitle', text: 'Weekly status', w: 540 }, { slot: 'title', text: 'Ledger sync', w: 540 },
    body(M, 150, 540, 'The duplicate entry fix shipped in the March build. Import speed moves to Dec 4 after the test host showed write costs the laptops hid. Nightly runs have used 90% of this month\'s build minutes.'),
    vrule(640, 52, 472), ...stoplight(663, 56, 16, v.state, 0), t(745, 56, 155, 'H2', 'Amber', { nowrap: 1, color: st(v.state) }),
    ...facts(663, 112, 237, [['Progress', '82%'], ['Next', 'Import speed'], ['Due', 'Dec 4']]) ] },

{ id: 'status-columns', name: 'Status — stoplight columns', tier: 'standard', cat: 'Status', note: 'Four upright stoplights, one a dimension, each with its reason.', layout: 'content',
  vals: Object.fromEntries([1, 2, 2, 1].map((s, i) => [`d${i + 1}`, state(s, `the lit lamp of column ${i + 1}`)])),
  els: v => [ { slot: 'supertitle', text: 'Weekly status' }, { slot: 'title', text: 'Ledger sync' },
    ...cols(4).flatMap((c, i) => { const d = [['Scope', 'Fix list holds at 17 items'], ['Schedule', 'Import speed slips to Dec 4'], ['Cost', 'Build minutes at 90% of cap'], ['Quality', 'Gates green, one test parked']][i];
      return [ ...stoplight(c.x + Math.round((c.w - 51) / 2), 160, 29, v[`d${i + 1}`], 1), body(c.x, 303, c.w, d[0], { align: 'center', weight: 700, nowrap: 1 }), cap(c.x, 331, c.w, d[1], { align: 'center' }) ]; }) ] },

{ id: 'status-filled', textOnly: true, name: 'Status — filled slide', tier: 'core', cat: 'Status', note: 'The whole ground takes the status colour: the word, the reason and three facts in dark ink.', layout: null, foot: { color: INK },
  vals: { state: state(3, 'the ground colour') },
  els: v => [ rect(0, 0, 960, 540, { bg: st(v.state), over: 1 }),
    t(M, 140, 840, 'Supertitle', 'Bank feeds · weekly status', { color: INK }), t(M, 166, 840, 'Title', 'Red', { nowrap: 1, color: INK }),
    t(M, 242, 840, 'H1', 'Feed token expired on the fifth', { color: INK }), rule(M, 386, 900, { bg: INK, op: 0.25 }),
    ...across(402, [['Blocked on', 'A new feed token'], ['Impact', 'Production on last month\'s build'], ['Needs', 'The owner, two minutes']], { color: INK }) ] },

{ id: 'status-split', textOnly: true, name: 'Status — split field', tier: 'standard', cat: 'Status', note: 'A colour field states the status and the phase; the other half carries three facts.', layout: null, foot: { x: 403, w: 150 },
  vals: { state: state(2, 'the colour of the field'),
    segs: { range: [2, 8], sample: 5, of: 'the phase bar: how many segments' }, lit: { range: [0, 8], sample: 2, of: 'how many segments are lit, from the left' } },
  valsCheck: v => v.lit > v.segs ? [`fill value "lit" is ${v.lit}, past the ${v.segs} segments the bar draws`] : [],
  els: v => [ rect(0, 0, 365, 540, { bg: st(v.state), over: 1 }), lab(RX, 48, 307, 'Mobile app', { nowrap: 1, color: INK }),
    t(RX, 190, 307, 'Title', 'Amber', { nowrap: 1, color: INK }), body(RX, 268, 307, 'Two store screens still open', { color: INK, weight: 700 }),
    ...segments(RX, 432, 307, count(v.segs, 2, 8), i => ({ bg: INK, radius: 3, ...(i < Math.round(v.lit) ? {} : { op: 0.2 }) }), 12),
    lab(RX, 454, 307, 'Phase 2 of 5 · Design', { nowrap: 1, color: INK }),
    t(403, 52, 497, 'Supertitle', 'Weekly status'), t(403, 76, 497, 'H1', 'Creative round'),
    ...facts(403, 150, 497, [['Done', 'Style one approved, screen four follows it'], ['Doing', 'Concepts for screens four and five'], ['Next', 'Store listing build · Dec 12']]) ] },

{ id: 'status-corner-lamp', textOnly: true, name: 'Status — corner lamp', tier: 'standard', cat: 'Status', note: 'One oversized lamp with the status word inside it. The quietest status slide.', layout: 'content',
  vals: { state: state(1, 'the colour of the lamp') },
  els: v => [ rect(640, 180, 300, 300, { radius: 300, bg: st(v.state) }),
    { slot: 'supertitle', text: 'Field app · weekly status', w: 470 }, { slot: 'title', text: 'Capture build runs on device', w: 470 },
    body(M, 170, 420, 'Sign-in, offline saves and failure notices all work.', { color: MUTED }),
    ...facts(M, 250, 420, [['Next', 'Share sheet note field'], ['Due', 'Dec 8']]),
    t(640, 296, 300, 'Title', 'Green', { nowrap: 1, align: 'center', color: INK }) ] },

{ id: 'status-stage-rail', textOnly: true, name: 'Status — stage rail', tier: 'core', cat: 'Status', note: 'The rail is the stage bar: phases, tranches or system layers, each with its own state, the current one named in the body.', layout: null, foot: { x: BX, w: 340 },
  vals: { ...Object.fromEntries([1, 1, 1, 1, 0].map((s, i) => [`s${i + 1}`, listed(s, `stage ${i + 1} (with its name)`)])),
    at: { range: [1, 5], sample: 4, of: 'the current stage, set in bold' } },
  valsCheck: (v, fill = v) => v.at > given(fill, 's', 5) ? [`fill value "at" is ${v.at}, past the ${given(fill, 's', 5)} stages the rail draws`] : [],
  els: v => { const n = live(v, 's', 5), h = n > 4 ? 40 : 50;
    return [ ...rail(230), lab(RX, 48, RW, 'Close report', { nowrap: 1 }),
      ...['Plan', 'Design', 'Build', 'Deploy', 'Release'].flatMap((name, i) => { const s = v[`s${i + 1}`], y = 78 + i * (h + 6), q = `s${i + 1}`;
        return [ rect(RX, y, 12, h, { bg: on(s) ? st(s) : LINE, radius: 3, q }),
          i + 1 === Math.round(v.at) ? body(RX + 24, y + (h - 24) / 2, 148, name, { weight: 700, nowrap: 1, q }) : cap(RX + 24, y + (h - 18) / 2, 148, name, { nowrap: 1, color: MUTED, q }) ]; }),
      rule(RX, 318, RX + RW), ...kv(RX, 334, RW, 'Due', 'Dec 1'),
      t(BX, 52, BW, 'Supertitle', 'Phase 4 of 5'), t(BX, 76, BW, 'H1', 'Deploy'),
      ...facts(BX, 150, BW, [['Done', 'Hosting and sign-off shipped in the last release'], ['Doing', 'Cover and status pages'], ['Exit test', 'Every page draws from live figures']]) ]; } },

{ id: 'status-trajectory', textOnly: true, name: 'Status — then, now, next', tier: 'standard', cat: 'Status', note: 'Three lamps: last period, this one, and the forecast drawn hollow.', layout: 'content',
  vals: { was: state(1, 'the first lamp, last period'), now: state(2, 'the middle lamp, this period'), next: state(1, 'the forecast, drawn hollow') },
  els: v => { const c = cols(3, 840, 15);
    const side = (x, head, s, word, line, hollow) => [ lab(x + 16, 236, 238, head, { nowrap: 1 }), hollow ? ring(x + 16, 262, 43, s) : lamp(x + 16, 262, 43, s),
      body(x + 16, 315, 238, word, { weight: 700, nowrap: 1, color: st(s) }), cap(x + 16, 345, 238, line) ];
    return [ { slot: 'supertitle', text: 'Weekly status' }, { slot: 'title', text: 'Mobile app' },
      ...side(c[0].x, 'Last week', v.was, 'Green', 'Style one approved'),
      rect(c[1].x, 150, c[1].w, 300, { bg: BOX, bd: HAIR, radius: 9 }), lab(c[1].x + 16, 220, 238, 'This week', { nowrap: 1 }), lamp(c[1].x + 16, 246, 67, v.now),
      t(c[1].x + 16, 323, 238, 'H2', 'Amber', { nowrap: 1, color: st(v.now) }), body(c[1].x + 16, 357, 238, 'Screens four and five open'),
      ...side(c[2].x, 'Forecast', v.next, 'Green', 'Green once concepts land', 1) ]; } },

{ id: 'status-decision', textOnly: true, name: 'Status — decision', tier: 'core', cat: 'Status', note: 'The ask is the slide: a decision, its reason and two options, with the status in a filled rail.', layout: null, foot: { x: BX, w: 340 },
  vals: { state: state(2, 'the colour of the rail') },
  els: v => [ ...rail(230, st(v.state)), lab(RX, 48, RW, 'Ledger sync', { nowrap: 1, color: INK }), t(RX, 72, RW, 'H1', 'Amber', { nowrap: 1, color: INK }),
    rule(RX, 128, RX + RW, { bg: INK, op: 0.25 }), ...facts(RX, 144, RW, [['Phase', 'Build'], ['Next', 'Import speed'], ['Due', 'Dec 4']], { color: INK }, 60),
    t(BX, 52, BW, 'Supertitle', 'Decision needed by Dec 1'), t(BX, 76, BW, 'H1', 'Raise the build minutes cap'),
    body(BX, 130, BW, 'Nightly runs have used 90% of this month\'s 3,000 minutes.', { color: MUTED }),
    ...[['Option one', 'Raise the cap', 'Fixes keep landing'], ['Option two', 'Slow the nightly runs', 'Import speed slips again']].flatMap(([k, head, line], i) => { const x = BX + i * 322;
      return [ rect(x, 200, 309, 112, { bg: BOX, bd: HAIR, radius: 9 }), lab(x + 16, 214, 277, k, { nowrap: 1 }), body(x + 16, 234, 277, head, { weight: 700, nowrap: 1 }), cap(x + 16, 264, 277, line) ]; }) ] },

{ id: 'status-owner-note', textOnly: true, name: 'Status — owner note', tier: 'standard', cat: 'Status', note: 'The owner states the status in one line, with a lamp beside their name and three facts under a rule.', layout: null,
  vals: { state: state(1, 'the lamp and the colour of the status word') },
  els: v => [ rect(M, 48, 58, 58, { radius: 58, bg: BOX, bd: HAIR }), body(M, 65, 58, 'RV', { align: 'center', weight: 700, nowrap: 1 }),
    body(133, 52, 400, 'R. Vance', { weight: 700, nowrap: 1 }), lab(133, 80, 400, 'Owner · Field app', { nowrap: 1 }),
    lamp(760, 58, 25, v.state), t(795, 56, 105, 'H2', 'Green', { nowrap: 1, color: st(v.state) }),
    t(M, 190, 672, 'H1', 'Capture works on my phone. Notes ship next week.'), rule(M, 386, 900),
    ...across(402, [['Phase', 'Build'], ['Next', 'Share sheet note'], ['Due', 'Dec 8']]) ] },

{ id: 'status-roster-rail', textOnly: true, name: 'Status — roster rail with focus', tier: 'core', cat: 'Status', note: 'The rail lists every project, workstream or component with its lamp; the body opens the one that needs attention.', layout: null, foot: { x: 298, w: 340 },
  vals: { ...Object.fromEntries([2, 3, 1, 2, 1, 2, 1, 1].map((s, i) => [`s${i + 1}`, listed(s, `the lamp of rail item ${i + 1} (with its name)`)])),
    focus: { range: [1, 8], sample: 2, of: 'the rail item the body opens: boxed and bold in the rail, its lamp repeated beside the title' } },
  valsCheck: (v, fill = v) => `s${Math.round(v.focus)}` in fill ? [] : [`fill value "focus" is ${v.focus}, and rail item ${v.focus} is not filled: focus names one of the items the rail draws`],
  els: v => { const at = Math.round(v.focus), y0 = 78;
    return [ ...rail(259), lab(RX, 48, 201, 'Portfolio', { nowrap: 1 }), rect(20, y0 + (at - 1) * 30 - 3, 219, 30, { bg: CARD, bd: HAIR, radius: 6 }),
      ...['Ledger sync', 'Bank feeds', 'Close report', 'Mobile app', 'Audit trail', 'Billing', 'Help center', 'Field app'].flatMap((name, i) => { const y = y0 + i * 30, q = `s${i + 1}`;
        return [ lamp(RX, y + 5, 14, v[q], { q }), i + 1 === at ? body(55, y, 175, name, { weight: 700, nowrap: 1, q }) : cap(55, y + 3, 175, name, { nowrap: 1, color: MUTED, q }) ]; }),
      cap(RX, 432, 201, 'Review · every Friday', { color: MUTED }),
      t(298, 52, 440, 'Supertitle', 'Needs attention'), t(298, 76, 440, 'H1', 'Bank feeds'),
      lamp(760, 58, 25, v[`s${at}`]), t(795, 56, 105, 'H2', 'Red', { nowrap: 1, color: st(v[`s${at}`]) }),
      ...facts(298, 150, 602, [['Problem', 'Feed token expired on the fifth'], ['Impact', 'Production still on last month\'s build'], ['Decision', 'Issue a new feed token']]) ]; } },
];
