// Inset and density. The four insets show what `styles.margin` buys; the last pair is one slide
// at both densities — speaker carries the claim, reading carries the note, source and legend.
import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols, bars } from './kit.mjs';

const S1 = 'var(--accent)', S2 = 'var(--muted)', S3 = 'var(--line)';
const chip = (x, y, text, tone = S1) => ({ x, y, w: 'auto', p: 'chip', radius: 4, bd: `1px solid ${tone}`, role: 'Label', color: tone, text, nowrap: 1 });

export default [

{ id: 'pad-tight-40', tier: 'standard', density: 'reading', name: 'Tight inset · 40px', cat: 'Density', note: 'Buys 40px of canvas on each side. For tables, matrices and anything that wants width.', layout: null, hideFoot: 1,
  els: [ lab(40, 36, 300, 'Padding · 40'), t(40, 58, 880, 'H1', 'Forty gives the table its columns back.'),
    rect(40, 120, 880, 300, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 6 }),
    ...['Region', 'Units', 'Held', 'Shipped', 'On time'].map((h, i) => lab(60 + i * 172, 140, 160, h)),
    ...[0, 1, 2, 3].map(r => rule(60, 176 + r * 56, 900)),
    ...[['North', '240', '18', '222', '94%'], ['South', '196', '31', '165', '84%'], ['Central', '128', '9', '119', '93%']]
      .flatMap((row, r) => row.map((cell, i) => t(60 + i * 172, 188 + r * 56, 160, i ? 'Label' : 'Body', cell, { nowrap: 1 }))),
    lab(40, 462, 400, 'inset 40 · rows breathe at 56') ] },

{ id: 'pad-default-60', tier: 'core', density: 'reading', name: 'Default inset · 60px', cat: 'Density', note: 'What the library ships. Balanced for a title, a body and one graphic.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Padding · 60' }, { slot: 'title', text: 'Sixty is the house default.' },
    body(M, 176, 420, 'Wide enough for a chart beside a paragraph, tight enough that a full-width table still fits without feeling boxed.'),
    ...bars([62, 71, 78, 92], { x0: 540, span: 360, base: 400, bw: 72, gut: 24, labels: ['Q1', 'Q2', 'Q3', 'Q4'], fmt: v => `${v}` }),
    lab(M, 462, 400, 'inset 60 · the shipped margin') ] },

{ id: 'pad-generous-96', tier: 'core', density: 'speaker', name: 'Generous inset · 96px', cat: 'Density', note: 'A statement slide wants air. Costs a third of the canvas; never use it for data.', layout: null, hideFoot: 1,
  els: [ lab(96, 150, 300, 'Padding · 96', { color: S1 }), t(96, 182, 700, 'Title', 'Air is a choice, not a leftover.'),
    body(96, 330, 560, 'At ninety-six the eye has nowhere else to go, which is the whole point of a statement slide.'),
    lab(96, 470, 400, 'inset 96 · statement only') ] },

{ id: 'pad-asymmetric-rail', tier: 'fringe', density: 'reading', name: 'Asymmetric · 180 left', cat: 'Density', note: 'A wide left rail for labels and notes, a narrow right margin for the content. Editorial.', layout: null, hideFoot: 1,
  els: [ vrule(150, 40, 500, { bg: S3 }),
    lab(40, 60, 96, 'Section', { align: 'right' }), body(40, 82, 96, 'Ops', { align: 'right' }),
    lab(40, 130, 96, 'Read', { align: 'right' }), body(40, 152, 96, '2 min', { align: 'right' }),
    t(180, 56, 720, 'Supertitle', 'Padding · asymmetric'), t(180, 80, 720, 'H1', 'The rail carries the metadata.'),
    body(180, 170, 620, 'Everything that is not the argument moves left of the rule: section, reading time, source. The argument keeps one column and one measure.'),
    lab(180, 462, 400, 'inset 180 / 60 · editorial') ] },

{ id: 'density-speaker', tier: 'core', density: 'speaker', name: 'Density · speaker', cat: 'Density', note: 'One claim, one number, nothing to read. The slide is the backdrop to what you say.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Density · speaker' }, { slot: 'title', text: 'On-time delivery is the whole story.' },
    t(M, 200, 520, 'Title', '94%', { color: S1 }),
    body(M, 316, 520, 'Up from 84% last quarter.', { color: S2 }) ] },

{ id: 'density-reading', tier: 'core', density: 'reading', name: 'Density · reading', cat: 'Density', note: 'The same slide sent as a document: subtitle, note, source and legend all present.', layout: 'content', hideFoot: 1,
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
