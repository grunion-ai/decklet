// The 2x2 and its relatives — ten uses of one frame, so the template is an exemplar rather than a shape.
import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols, bars } from './kit.mjs';

const S1 = 'var(--accent)', S2 = 'var(--muted)', S3 = 'var(--line)';
// K22: a plotted mark is x#/y# on 0..100 across and up (50 is the quadrant line), like two-by-two; a bubble adds s#, its area
const xy = (i, who, s, size) => ({ [`x${i}`]: { range: [0, 100], sample: s[0], of: `${who} · across (0 … 100)` }, [`y${i}`]: { range: [0, 100], sample: s[1], of: `${who} · up (0 … 100)` },
  ...(size ? { [`s${i}`]: { range: [0, 1e9], sample: s[2], of: `${who} · ${size}` } } : {}) });
const chip = (x, y, text, tone = S1) => ({ x, y, w: 'auto', p: 'chip', radius: 4, bd: `1px solid ${tone}`, role: 'Label', color: tone, text, nowrap: 1 });

export default [

{ id: 'quad-growth-share', tier: 'standard', density: 'reading', name: 'Growth / share with size', cat: 'Quad', note: 'Bubble area adds a third variable. Quadrant names do the interpreting.', layout: 'content', hideFoot: 1,
  vals: Object.assign({}, ...[[69.2, 78.7, 2704], [19.2, 70.9, 484], [34.6, 19.7, 900], [76.9, 23.6, 1600]]
    .map((s, i) => xy(i + 1, `line ${i + 1}${i ? '' : ' (the lit bubble)'}`, s, 'revenue, the bubble\'s area (the largest draws at 52px)'))),
  els: v => { const px = n => Math.round(300 + n * 5.2), py = n => Math.round(430 - n * 2.54), top = Math.max(...[1, 2, 3, 4].map(i => v['s' + i])) || 1;
    const look = [{ op: 0.5 }, { bg: S2 }, { bg: S2, op: 0.6 }, { bg: S2, op: 0.4 }];
    return [ { slot: 'supertitle', text: 'Quad · B' }, { slot: 'title', text: 'Two lines carry the portfolio.' },
    rect(300, 176, 260, 127, { bg: S1, op: 0.08 }), rect(560, 176, 260, 127, { bg: S1, op: 0.16 }),
    { x: 300, y: 430, line: [820, 430], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    { x: 300, y: 430, line: [300, 176], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    rule(560, 176, 560, { line: [560, 430], bg: S3 }), rule(300, 303, 820, { line: [820, 303], bg: S3 }),
    lab(310, 186, 240, 'Question marks'), lab(570, 186, 240, 'Leaders', { color: S1 }),
    lab(310, 405, 240, 'Retire'), lab(570, 405, 240, 'Cash'),
    lab(300, 452, 520, 'Share of segment →'), lab(170, 176, 120, 'Growth ↑', { align: 'right' }),
    ...[1, 2, 3, 4].map((i, k) => dot(px(v['x' + i]), py(v['y' + i]), Math.max(4, Math.round(52 * Math.sqrt(v['s' + i] / top))), look[k])),
    lab(M, 200, 200, 'Bubble area is revenue.', { color: S2 }) ]; } },

{ id: 'quad-effort-impact', textOnly: true, tier: 'core', density: 'reading', name: 'Effort / impact with chips', cat: 'Quad', note: 'Items sit as named chips, not dots. No legend to cross-reference.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · C' }, { slot: 'title', text: 'Do the top-left four first.' },
    rule(M, 176, W - M, { line: [W - M, 176] }), vrule(480, 176, 430), rule(M, 303, W - M),
    lab(M + 12, 186, 200, 'Quick wins', { color: S1 }), lab(492, 186, 200, 'Big bets'),
    lab(M + 12, 313, 200, 'Fill-ins'), lab(492, 313, 200, 'Money pits'),
    chip(M + 12, 214, 'Relabel the bins'), chip(M + 12, 246, 'Two-scan check'), chip(M + 12, 278, 'Night pick slot'),
    chip(492, 214, 'New WMS'), chip(492, 250, 'Second dock'),
    chip(M + 12, 342, 'Tidy the aisles'), chip(492, 342, 'Custom conveyor', S2),
    lab(M, 452, 400, 'Impact ↑ · Effort →'), rule(M, 430, W - M) ] },

// each numbered risk sits at x#/y# (likelihood across, impact up; the plot runs 60..700 × 430..176), the tile centred there
{ id: 'quad-risk-heat', tier: 'standard', density: 'reading', name: 'Risk heat quadrant', cat: 'Quad', note: 'Tint carries severity, numbers key to a list. The compliance version.', layout: 'content', hideFoot: 1,
  vals: Object.assign({}, ...[[31.7, 77.6], [66.1, 81.5], [80.2, 65.7], [20.8, 26.4], [73.9, 18.5]].map((s, i) => xy(i + 1, `risk ${i + 1} (likelihood across, impact up)`, s))),
  els: v => [ { slot: 'supertitle', text: 'Quad · D' }, { slot: 'title', text: 'Two risks sit in the red corner.' },
    rect(M, 176, 320, 127, { bg: S1, op: 0.18 }), rect(380, 176, 320, 127, { bg: S1, op: 0.42 }),
    rect(M, 303, 320, 127, { bg: S1, op: 0.06 }), rect(380, 303, 320, 127, { bg: S1, op: 0.18 }),
    lab(M + 12, 186, 240, 'Monitor'), lab(392, 186, 240, 'Act now'),
    lab(M + 12, 412, 240, 'Accept'), lab(392, 412, 240, 'Plan for'),
    // a marker is a 26px disc with its number centred on it: the disc is the mark the value places, the number a text key
    ...[1, 2, 3, 4, 5].flatMap(i => { const cx = Math.round(60 + v['x' + i] * 6.4), cy = Math.round(430 - v['y' + i] * 2.54);
      return [ dot(cx, cy, 26, { bg: 'var(--fg)' }), lab(cx - 13, cy - 7, 26, `${i}`, { align: 'center', color: 'var(--card)', nowrap: 1 }) ]; }),
    lab(M, 452, 400, 'Likelihood → · Impact ↑'),
    ...['1 Single radio supplier', '2 Dock closure', '3 Peak staffing', '4 Label printer', '5 Customs delay']
      .map((s, i) => lab(730, 186 + i * 30, 190, s, { nowrap: 1 })) ] },

{ id: 'quad-stakeholder', textOnly: true, tier: 'standard', density: 'reading', name: 'Stakeholder map with actions', cat: 'Quad', note: 'Each quadrant names the action, not the category. The most useful 2×2 in a working session.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · E' }, { slot: 'title', text: 'Four groups, four different jobs.' },
    rule(M, 176, W - M), vrule(480, 176, 430), rule(M, 303, W - M), rule(M, 430, W - M),
    ...[['Keep satisfied', 'Ops director · Finance', M + 12, 186], ['Manage closely', 'Plant manager · Head of supply', 492, 186],
        ['Monitor', 'Night shift leads', M + 12, 313], ['Keep informed', 'Warehouse crew · Carriers', 492, 313]]
      .flatMap(([h, s, x, y]) => [ t(x, y, 340, 'H2', h, { nowrap: 1 }), body(x, y + 30, 340, s, { color: S2 }) ]),
    lab(M, 452, 400, 'Interest → · Influence ↑') ] },

// each player moves from fx#/fy# (a year ago, the hollow dot) to x#/y# (now); a player that has not moved draws no arrow.
// The plot is two-by-two's (300..820 × 430..176); the name rides beside the dot and flips when that side runs out.
{ id: 'quad-movement', tier: 'standard', density: 'reading', name: 'Movement arrows', cat: 'Quad', note: 'Where each player was, where it is going. The arrow is the argument.', layout: 'content', hideFoot: 1,
  vals: Object.assign({}, ...[['Incumbent A', 15.4, 27.6, 38.5, 54.3], ['Entrant', 61.5, 15.7, 79.6, 42.5], ['Us', 84.6, 82.7, 84.6, 82.7]]
    .map(([who, fx, fy, x, y], k) => { const i = k + 1;
      return { [`fx${i}`]: { range: [0, 100], sample: fx, of: `${who} · a year ago, across` }, [`fy${i}`]: { range: [0, 100], sample: fy, of: `${who} · a year ago, up` },
        [`x${i}`]: { range: [0, 100], sample: x, of: `${who} · now, across` }, [`y${i}`]: { range: [0, 100], sample: y, of: `${who} · now, up` } }; })),
  els: v => { const px = n => Math.round(300 + n * 5.2), py = n => Math.round(430 - n * 2.54);
    const player = (i, name, d, w, off, left, extra = {}) => { const ax = px(v['fx' + i]), ay = py(v['fy' + i]), cx = px(v['x' + i]), cy = py(v['y' + i]);
      const dx = cx - ax, dy = cy - ay, len = Math.hypot(dx, dy), moved = len > 30;   // under 30px the arrow would not clear both dots
      const onLeft = left ? cx - off - w >= 300 : cx + off + w > 900;
      return [ ...(moved ? [dot(ax, ay, 12, { bg: S3 }), { x: Math.round(ax + dx / len * 15), y: Math.round(ay + dy / len * 15), line: [Math.round(cx - dx / len * 16), Math.round(cy - dy / len * 16)], h: 2.5, bg: S2, arrow: 'end', waive: 1 }] : []),
        dot(cx, cy, d, extra.color ? {} : { bg: S2 }),
        lab(onLeft ? cx - off - w : cx + off, cy - 7, w, name, { ...extra, ...(onLeft ? { align: 'right' } : {}), nowrap: 1 }) ]; };
    return [ { slot: 'supertitle', text: 'Quad · F' }, { slot: 'title', text: 'Two of them are moving on us.' },
    { x: 300, y: 430, line: [820, 430], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    { x: 300, y: 430, line: [300, 176], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    rule(560, 176, 560, { line: [560, 430], bg: S3 }), rule(300, 303, 820, { line: [820, 303], bg: S3 }),
    ...player(1, 'Incumbent A', 14, 140, 20, true), ...player(2, 'Entrant', 14, 140, 16, false), ...player(3, 'Us', 18, 100, 22, false, { color: S1 }),
    lab(300, 452, 520, 'Delivery →'), lab(180, 176, 110, 'Selection ↑', { align: 'right' }),
    lab(M, 200, 200, 'Hollow dot · a year ago', { color: S2 }) ]; } },

{ id: 'quad-where-we-play', textOnly: true, tier: 'core', density: 'speaker', name: 'One quadrant lit', cat: 'Quad', note: 'Three quadrants muted, one owned. Use when the slide is a recommendation, not a survey.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · G' }, { slot: 'title', text: 'We only play in the top right.' },
    rect(480, 176, 420, 127, { bg: S1, op: 0.16, bd: '1px solid var(--accent)', radius: 4 }),
    rule(M, 176, W - M), vrule(480, 176, 430), rule(M, 303, W - M), rule(M, 430, W - M),
    lab(M + 12, 186, 240, 'Broad · slow', { color: S2 }), t(492, 186, 340, 'H2', 'Broad · fast', { color: S1, nowrap: 1 }),
    lab(M + 12, 313, 240, 'Narrow · slow', { color: S2 }), lab(492, 313, 240, 'Narrow · fast', { color: S2 }),
    body(492, 220, 390, 'Fifty suppliers, next-day. Everything else is someone else’s business.'),
    lab(M, 452, 400, 'Delivery → · Selection ↑') ] },

{ id: 'quad-conceptual', textOnly: true, tier: 'core', density: 'reading', name: 'Conceptual 2×2, no data', cat: 'Quad', note: 'Four ideas, one line each, no plotted points. A framework slide, not a chart.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · H' }, { slot: 'title', text: 'Four ways an order can fail.' },
    ...[['Wrong item', 'Picked against a stale list.', M, 176], ['Wrong count', 'Scan skipped at the bin.', 492, 176],
        ['Late', 'Dock slot missed by an hour.', M, 306], ['Damaged', 'Stacked over the limit.', 492, 306]]
      .flatMap(([h, s, x, y]) => [ rect(x, y, 408, 118, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8 }),
        t(x + 18, y + 20, 340, 'H2', h, { nowrap: 1 }), body(x + 18, y + 56, 372, s, { color: S2 }) ]),
    lab(M, 452, 500, 'Accuracy ↑ · Timing →') ] },

{ id: 'quad-nine-box', tier: 'fringe', density: 'reading', name: 'Nine box', cat: 'Quad', note: 'A 3×3 when two bands are not enough. Diagonal shading reads as the target band.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · I' }, { slot: 'title', text: 'Nine boxes, one diagonal that matters.' },
    ...[0, 1, 2].flatMap(r => [0, 1, 2].map(c => rect(300 + c * 190, 176 + r * 86, 182, 78,
      { bg: S1, op: [[0.30, 0.42, 0.55], [0.18, 0.30, 0.42], [0.06, 0.18, 0.30]][r][c], radius: 3 }))),
    ...[['Grow', 2, 0], ['Invest', 2, 2], ['Hold', 1, 1], ['Exit', 0, 0]]
      .map(([s, c, r]) => lab(312 + c * 190, 200 + r * 86, 160, s, { nowrap: 1 })),
    lab(300, 452, 520, 'Capability →'), lab(170, 176, 120, 'Value ↑', { align: 'right' }),
    body(M, 210, 200, 'Three bands on each axis when a binary split hides the middle.', { color: S2 }) ] },

{ id: 'quad-with-panel', tier: 'standard', density: 'reading', name: 'Quad plus reading panel', cat: 'Quad', note: 'The matrix keeps two thirds; the conclusion is boxed beside it. The document version.', layout: 'content', hideFoot: 1,
  // the three suppliers at x#/y# on the 60..580 × 420..176 plot; the third is the one the panel is about (lit)
  vals: Object.assign({}, ...[[23.1, 28.7], [36.5, 69.7], [78.8, 82]].map((s, i) => xy(i + 1, `supplier ${i + 1}${i === 2 ? ' (the lit dot)' : ''}`, s))),
  els: v => [ { slot: 'supertitle', text: 'Quad · J' }, { slot: 'title', text: 'The matrix, and what to do about it.' },
    { x: M, y: 420, line: [580, 420], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    { x: M, y: 420, line: [M, 176], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    rule(320, 176, 320, { line: [320, 420], bg: S3 }), rule(M, 298, 580, { line: [580, 298], bg: S3 }),
    ...[1, 2, 3].map(i => dot(Math.round(60 + v['x' + i] * 5.2), Math.round(420 - v['y' + i] * 2.44), i === 3 ? 18 : 14, i === 3 ? {} : { bg: S2 })),
    lab(M + 8, 186, 200, 'Broad · slow'), lab(332, 186, 200, 'Broad · fast', { color: S1 }),
    lab(M + 8, 396, 200, 'Narrow · slow'), lab(332, 396, 200, 'Narrow · fast'),
    lab(M, 440, 400, 'Delivery →'),
    rect(620, 176, 280, 244, { bg: 'var(--box)', radius: 10 }),
    lab(640, 196, 220, 'So what', { color: S1 }),
    body(640, 222, 240, 'Only one supplier clears both bars, and its contract ends in March. Start the second source now.'),
    rule(640, 340, 880), lab(640, 356, 240, 'Owner · Ops director'), lab(640, 380, 240, 'By · 14 Oct') ] },
];
