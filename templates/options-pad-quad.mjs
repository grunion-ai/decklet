// Candidate variants for review: padding / density kits, and 2x2-family exemplars.
// Padding variants draw explicit x so one sheet can show four insets; in a real deck
// the inset is `styles.margin` plus the layout slots, set once.
import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols, bars } from '../lib/templates/kit.mjs';

const S1 = 'var(--accent)', S2 = 'var(--muted)', S3 = 'var(--line)';
const chip = (x, y, text, tone = S1) => ({ x, y, w: 'auto', p: 'chip', radius: 4, bd: `1px solid ${tone}`, role: 'Label', color: tone, text, nowrap: 1 });

export const PAD = [
{ id: 'pad-tight-40', name: 'Tight inset · 40px', fam: 'Padding', note: 'Buys 40px of canvas on each side. For tables, matrices and anything that wants width.', layout: null, hideFoot: 1,
  els: [ lab(40, 36, 300, 'Padding · 40'), t(40, 58, 880, 'H1', 'Forty gives the table its columns back.'),
    rect(40, 120, 880, 300, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 6 }),
    ...['Region', 'Units', 'Held', 'Shipped', 'On time'].map((h, i) => lab(60 + i * 172, 140, 160, h)),
    ...[0, 1, 2, 3].map(r => rule(60, 176 + r * 56, 900)),
    ...[['North', '240', '18', '222', '94%'], ['South', '196', '31', '165', '84%'], ['Central', '128', '9', '119', '93%']]
      .flatMap((row, r) => row.map((cell, i) => t(60 + i * 172, 188 + r * 56, 160, i ? 'Label' : 'Body', cell, { nowrap: 1 }))),
    lab(40, 500, 400, 'inset 40 · rows breathe at 56') ] },

{ id: 'pad-default-60', name: 'Default inset · 60px', fam: 'Padding', note: 'What the library ships. Balanced for a title, a body and one graphic.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Padding · 60' }, { slot: 'title', text: 'Sixty is the house default.' },
    body(M, 176, 420, 'Wide enough for a chart beside a paragraph, tight enough that a full-width table still fits without feeling boxed.'),
    ...bars([62, 71, 78, 92], { x0: 540, span: 360, base: 400, bw: 72, gut: 24, labels: ['Q1', 'Q2', 'Q3', 'Q4'], fmt: v => `${v}` }),
    lab(M, 500, 400, 'inset 60 · the shipped margin') ] },

{ id: 'pad-generous-96', name: 'Generous inset · 96px', fam: 'Padding', note: 'A statement slide wants air. Costs a third of the canvas; never use it for data.', layout: null, hideFoot: 1,
  els: [ lab(96, 150, 300, 'Padding · 96', { color: S1 }), t(96, 182, 700, 'Title', 'Air is a choice, not a leftover.'),
    body(96, 330, 560, 'At ninety-six the eye has nowhere else to go, which is the whole point of a statement slide.'),
    lab(96, 470, 400, 'inset 96 · statement only') ] },

{ id: 'pad-asymmetric-rail', name: 'Asymmetric · 180 left', fam: 'Padding', note: 'A wide left rail for labels and notes, a narrow right margin for the content. Editorial.', layout: null, hideFoot: 1,
  els: [ vrule(150, 40, 500, { bg: S3 }),
    lab(40, 60, 96, 'Section', { align: 'right' }), body(40, 82, 96, 'Ops', { align: 'right' }),
    lab(40, 130, 96, 'Read', { align: 'right' }), body(40, 152, 96, '2 min', { align: 'right' }),
    t(180, 56, 720, 'Supertitle', 'Padding · asymmetric'), t(180, 80, 720, 'H1', 'The rail carries the metadata.'),
    body(180, 170, 620, 'Everything that is not the argument moves left of the rule: section, reading time, source. The argument keeps one column and one measure.'),
    lab(180, 500, 400, 'inset 180 / 60 · editorial') ] },

{ id: 'density-speaker', name: 'Density · speaker', fam: 'Padding', note: 'One claim, one number, nothing to read. The slide is the backdrop to what you say.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Density · speaker' }, { slot: 'title', text: 'On-time delivery is the whole story.' },
    t(M, 200, 520, 'Title', '94%', { color: S1 }),
    body(M, 316, 520, 'Up from 84% last quarter.', { color: S2 }) ] },

{ id: 'density-reading', name: 'Density · reading', fam: 'Padding', note: 'The same slide sent as a document: subtitle, note, source and legend all present.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Density · reading' }, { slot: 'title', text: 'On-time delivery is the whole story.' },
    body(M, 124, 620, 'Up from 84% last quarter, on 564 shipments across three regions.', { color: S2 }),
    t(M, 170, 300, 'Title', '94%', { color: S1 }),
    body(M, 290, 300, 'Central held its rate all quarter; South carried the improvement and still trails.'),
    ...bars([84, 88, 91, 94], { x0: 430, span: 400, base: 380, bw: 76, gut: 32, labels: ['Q1', 'Q2', 'Q3', 'Q4'], fmt: v => `${v}%` }),
    rule(M, 424, W - M),
    lab(M, 438, 300, 'Note · excludes freight returns'),
    lab(M, 462, 400, 'Source · warehouse scans, 30 Jun'),
    ...['Shipped on time', 'Late'].flatMap((k, i) => [ rect(600 + i * 175, 466, 12, 12, { bg: i ? S3 : S1, radius: 2 }), lab(620 + i * 175, 462, 150, k, { nowrap: 1 }) ]) ] },
];

export const QUAD = [
{ id: 'quad-positioning', name: 'Positioning (ships today)', fam: 'Quad', note: 'Two axes, four named quadrants, players plotted. The baseline.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · A' }, { slot: 'title', text: 'Nobody is fast and broad at once.' },
    { x: 300, y: 430, line: [820, 430], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    { x: 300, y: 430, line: [300, 176], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    rule(560, 176, 560, { line: [560, 430], bg: S3 }), rule(300, 303, 820, { line: [820, 303], bg: S3 }),
    lab(310, 186, 230, 'Broad · slow'), lab(570, 186, 230, 'Broad · fast', { color: S1 }),
    lab(310, 405, 230, 'Narrow · slow'), lab(570, 405, 230, 'Narrow · fast'),
    lab(300, 452, 520, 'Delivery →'), lab(180, 176, 110, 'Selection ↑', { align: 'right' }),
    dot(390, 370, 14, { bg: S2 }), lab(410, 363, 140, 'Incumbent A', { nowrap: 1 }),
    dot(500, 248, 14, { bg: S2 }), lab(330, 241, 150, 'Incumbent B', { align: 'right', nowrap: 1 }),
    dot(720, 215, 18), lab(742, 208, 100, 'Us', { color: S1, nowrap: 1 }),
    body(M, 192, 200, 'Selection is supplier count; speed is median delivery.', { color: S2 }) ] },

{ id: 'quad-growth-share', name: 'Growth / share with size', fam: 'Quad', note: 'Bubble area adds a third variable. Quadrant names do the interpreting.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · B' }, { slot: 'title', text: 'Two lines carry the portfolio.' },
    rect(300, 176, 260, 127, { bg: S1, op: 0.08 }), rect(560, 176, 260, 127, { bg: S1, op: 0.16 }),
    { x: 300, y: 430, line: [820, 430], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    { x: 300, y: 430, line: [300, 176], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    rule(560, 176, 560, { line: [560, 430], bg: S3 }), rule(300, 303, 820, { line: [820, 303], bg: S3 }),
    lab(310, 186, 240, 'Question marks'), lab(570, 186, 240, 'Leaders', { color: S1 }),
    lab(310, 405, 240, 'Retire'), lab(570, 405, 240, 'Cash'),
    lab(300, 452, 520, 'Share of segment →'), lab(170, 176, 120, 'Growth ↑', { align: 'right' }),
    dot(660, 230, 52, { op: 0.5 }), dot(400, 250, 22, { bg: S2 }), dot(480, 380, 30, { bg: S2, op: 0.6 }), dot(700, 370, 40, { bg: S2, op: 0.4 }),
    lab(M, 200, 200, 'Bubble area is revenue.', { color: S2 }) ] },

{ id: 'quad-effort-impact', name: 'Effort / impact with chips', fam: 'Quad', note: 'Items sit as named chips, not dots. No legend to cross-reference.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · C' }, { slot: 'title', text: 'Do the top-left four first.' },
    rule(M, 176, W - M, { line: [W - M, 176] }), vrule(480, 176, 430), rule(M, 303, W - M),
    lab(M + 12, 186, 200, 'Quick wins', { color: S1 }), lab(492, 186, 200, 'Big bets'),
    lab(M + 12, 313, 200, 'Fill-ins'), lab(492, 313, 200, 'Money pits'),
    chip(M + 12, 214, 'Relabel the bins'), chip(M + 12, 246, 'Two-scan check'), chip(M + 12, 278, 'Night pick slot'),
    chip(492, 214, 'New WMS'), chip(492, 250, 'Second dock'),
    chip(M + 12, 342, 'Tidy the aisles'), chip(492, 342, 'Custom conveyor', S2),
    lab(M, 452, 400, 'Impact ↑ · Effort →'), rule(M, 430, W - M) ] },

{ id: 'quad-risk-heat', name: 'Risk heat quadrant', fam: 'Quad', note: 'Tint carries severity, numbers key to a list. The compliance version.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · D' }, { slot: 'title', text: 'Two risks sit in the red corner.' },
    rect(M, 176, 320, 127, { bg: S1, op: 0.18 }), rect(380, 176, 320, 127, { bg: S1, op: 0.42 }),
    rect(M, 303, 320, 127, { bg: S1, op: 0.06 }), rect(380, 303, 320, 127, { bg: S1, op: 0.18 }),
    lab(M + 12, 186, 240, 'Monitor'), lab(392, 186, 240, 'Act now'),
    lab(M + 12, 412, 240, 'Accept'), lab(392, 412, 240, 'Plan for'),
    ...[[250, 220, '1'], [470, 210, '2'], [560, 250, '3'], [180, 350, '4'], [520, 370, '5']]
      .map(([x, y, n]) => tile(x, y, 26, 26, 'Label', n, { radius: 13, bg: 'var(--fg)', bd: 'none', color: 'var(--card)', nowrap: 1 })),
    lab(M, 452, 400, 'Likelihood → · Impact ↑'),
    ...['1 Single radio supplier', '2 Dock closure', '3 Peak staffing', '4 Label printer', '5 Customs delay']
      .map((s, i) => lab(730, 186 + i * 30, 190, s, { nowrap: 1 })) ] },

{ id: 'quad-stakeholder', name: 'Stakeholder map with actions', fam: 'Quad', note: 'Each quadrant names the action, not the category. The most useful 2×2 in a working session.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · E' }, { slot: 'title', text: 'Four groups, four different jobs.' },
    rule(M, 176, W - M), vrule(480, 176, 430), rule(M, 303, W - M), rule(M, 430, W - M),
    ...[['Keep satisfied', 'Ops director · Finance', M + 12, 186], ['Manage closely', 'Plant manager · Head of supply', 492, 186],
        ['Monitor', 'Night shift leads', M + 12, 313], ['Keep informed', 'Warehouse crew · Carriers', 492, 313]]
      .flatMap(([h, s, x, y]) => [ t(x, y, 340, 'H2', h, { nowrap: 1 }), body(x, y + 30, 340, s, { color: S2 }) ]),
    lab(M, 452, 400, 'Interest → · Influence ↑') ] },

{ id: 'quad-movement', name: 'Movement arrows', fam: 'Quad', note: 'Where each player was, where it is going. The arrow is the argument.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · F' }, { slot: 'title', text: 'Two of them are moving on us.' },
    { x: 300, y: 430, line: [820, 430], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    { x: 300, y: 430, line: [300, 176], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    rule(560, 176, 560, { line: [560, 430], bg: S3 }), rule(300, 303, 820, { line: [820, 303], bg: S3 }),
    dot(380, 360, 12, { bg: S3 }), { x: 394, y: 354, line: [486, 300], h: 2.5, bg: S2, arrow: 'end', waive: 1 }, dot(500, 292, 14, { bg: S2 }),
    lab(340, 285, 140, 'Incumbent A', { align: 'right', nowrap: 1 }),
    dot(620, 390, 12, { bg: S3 }), { x: 632, y: 382, line: [700, 330], h: 2.5, bg: S2, arrow: 'end', waive: 1 }, dot(714, 322, 14, { bg: S2 }),
    lab(730, 315, 140, 'Entrant', { nowrap: 1 }),
    dot(740, 220, 18), lab(762, 213, 100, 'Us', { color: S1, nowrap: 1 }),
    lab(300, 452, 520, 'Delivery →'), lab(180, 176, 110, 'Selection ↑', { align: 'right' }),
    lab(M, 200, 200, 'Hollow dot · a year ago', { color: S2 }) ] },

{ id: 'quad-where-we-play', name: 'One quadrant lit', fam: 'Quad', note: 'Three quadrants muted, one owned. Use when the slide is a recommendation, not a survey.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · G' }, { slot: 'title', text: 'We only play in the top right.' },
    rect(480, 176, 420, 127, { bg: S1, op: 0.16, bd: '1px solid var(--accent)', radius: 4 }),
    rule(M, 176, W - M), vrule(480, 176, 430), rule(M, 303, W - M), rule(M, 430, W - M),
    lab(M + 12, 186, 240, 'Broad · slow', { color: S2 }), t(492, 186, 340, 'H2', 'Broad · fast', { color: S1, nowrap: 1 }),
    lab(M + 12, 313, 240, 'Narrow · slow', { color: S2 }), lab(492, 313, 240, 'Narrow · fast', { color: S2 }),
    body(492, 220, 390, 'Fifty suppliers, next-day. Everything else is someone else’s business.'),
    lab(M, 452, 400, 'Delivery → · Selection ↑') ] },

{ id: 'quad-conceptual', name: 'Conceptual 2×2, no data', fam: 'Quad', note: 'Four ideas, one line each, no plotted points. A framework slide, not a chart.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · H' }, { slot: 'title', text: 'Four ways an order can fail.' },
    ...[['Wrong item', 'Picked against a stale list.', M, 176], ['Wrong count', 'Scan skipped at the bin.', 492, 176],
        ['Late', 'Dock slot missed by an hour.', M, 306], ['Damaged', 'Stacked over the limit.', 492, 306]]
      .flatMap(([h, s, x, y]) => [ rect(x, y, 408, 118, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8 }),
        t(x + 18, y + 20, 340, 'H2', h, { nowrap: 1 }), body(x + 18, y + 56, 372, s, { color: S2 }) ]),
    lab(M, 452, 500, 'Accuracy ↑ · Timing →') ] },

{ id: 'quad-nine-box', name: 'Nine box', fam: 'Quad', note: 'A 3×3 when two bands are not enough. Diagonal shading reads as the target band.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · I' }, { slot: 'title', text: 'Nine boxes, one diagonal that matters.' },
    ...[0, 1, 2].flatMap(r => [0, 1, 2].map(c => rect(300 + c * 190, 176 + r * 86, 182, 78,
      { bg: S1, op: [[0.30, 0.42, 0.55], [0.18, 0.30, 0.42], [0.06, 0.18, 0.30]][r][c], radius: 3 }))),
    ...[['Grow', 2, 0], ['Invest', 2, 2], ['Hold', 1, 1], ['Exit', 0, 0]]
      .map(([s, c, r]) => lab(312 + c * 190, 200 + r * 86, 160, s, { nowrap: 1 })),
    lab(300, 452, 520, 'Capability →'), lab(170, 176, 120, 'Value ↑', { align: 'right' }),
    body(M, 210, 200, 'Three bands on each axis when a binary split hides the middle.', { color: S2 }) ] },

{ id: 'quad-with-panel', name: 'Quad plus reading panel', fam: 'Quad', note: 'The matrix keeps two thirds; the conclusion is boxed beside it. The document version.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Quad · J' }, { slot: 'title', text: 'The matrix, and what to do about it.' },
    { x: M, y: 420, line: [580, 420], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    { x: M, y: 420, line: [M, 176], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    rule(320, 176, 320, { line: [320, 420], bg: S3 }), rule(M, 298, 580, { line: [580, 298], bg: S3 }),
    dot(180, 350, 14, { bg: S2 }), dot(250, 250, 14, { bg: S2 }), dot(470, 220, 18),
    lab(M + 8, 186, 200, 'Broad · slow'), lab(332, 186, 200, 'Broad · fast', { color: S1 }),
    lab(M + 8, 396, 200, 'Narrow · slow'), lab(332, 396, 200, 'Narrow · fast'),
    lab(M, 440, 400, 'Delivery →'),
    rect(620, 176, 280, 244, { bg: 'var(--box)', radius: 10 }),
    lab(640, 196, 220, 'So what', { color: S1 }),
    body(640, 222, 240, 'Only one supplier clears both bars, and its contract ends in March. Start the second source now.'),
    rule(640, 340, 880), lab(640, 356, 240, 'Owner · Ops director'), lab(640, 380, 240, 'By · 14 Oct') ] },
];
