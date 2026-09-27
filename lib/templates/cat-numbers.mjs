import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols, bars, pair } from './kit.mjs';

const chip = (x, y, text, tone = 'var(--accent)') => ({ x, y, w: 'auto', p: 'chip', radius: 4, bd: `1px solid ${tone}`, role: 'Label', color: tone, text, nowrap: 1 });

// ── the values these templates would otherwise hardcode (ROADMAP U4). `vals` declares them, `els` is a function of them.
const OBJECTIVES = [['p1', 'Pilot conversions', 82], ['p2', 'Sensor accuracy', 94], ['p3', 'Renewal rate', 61], ['p4', 'Support SLA', 92]];
const CRITERIA = ['Coverage', 'Speed', 'Price', 'Support'];
const OPTIONS = [['Incumbent A', [3, 2, 1, 4]], ['Incumbent B', [2, 1, 2, 2]], ['Us', [4, 4, 4, 3]]];
// K15: benchmark-table's rows, columns and highlighted row all key off this one array + one value.
const BENCH_ROWS = [['Incumbent A', '120', '$14', '48 hrs'], ['Incumbent B', '90', '$11', '36 hrs'], ['Us', '310', '$6', '18 hrs'], ['Direct', '1', '—', 'varies']];
const BENCH_X = [M + 14, 380, 560, 720], BENCH_W = [300, 160, 140, 160], FARMS_MAX = Math.max(...BENCH_ROWS.map(r => +r[1]));
// a Harvey ball is a FILLED ball (`hole: 0`) at 44px: at 36px through a 4px ring, three quarters and four read the same
const ball = (x, y, quarters) => ({ x, y, w: 44, donut: quarters * 25, hole: 0, color: 'var(--accent)' });

export default [
{ id: 'stat-hero', name: 'Factoid — one number', tier: 'core', cat: 'Numbers', note: 'A single number at display size with its claim underneath.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'The number' }, { slot: 'title', text: 'Matching is the whole cost.' },
    t(M, 180, 520, 'Title', '11.4 hrs', { color: 'var(--accent)' }),
    body(M, 290, 520, 'Median time a finance team spends each week matching payments to invoices by hand, before the close begins.'),
    // the number at its size: a 40-hour week as five 8-hour days, 11.4 hours lit (one full day and 3.4 hours of the next)
    ...[0, 1, 2, 3, 4].flatMap(d => { const y = 190 + d * 30, lit = Math.min(8, Math.max(0, 11.4 - d * 8)) * 30;
      return [ rect(M + 590, y, 240, 22, { bg: 'var(--line)', radius: 3 }), ...(lit ? [rect(M + 590, y, Math.round(lit), 22, { bg: 'var(--accent)', radius: 3 })] : []) ]; }),
    lab(M + 590, 350, 240, 'One bar · one 8-hour day'), body(M + 590, 372, 240, 'A 40-hour week. 38 companies, 2026 panel.', { color: 'var(--muted)' }) ] },

// the speaker cut of the tiles: three numbers, three labels, and nothing else on the canvas. Every other numbers template
// carries a paragraph or a delta and reads as a leave-behind; this one is what a presenter stands beside.
{ id: 'stat-row-3', name: 'Metric tiles — three across', tier: 'core', cat: 'Numbers', note: 'Three filled tiles, their labels and a before/after pair each, at speaker density.', layout: 'content', density: 'speaker',
  els: [ { slot: 'supertitle', text: 'The kitchen' }, { slot: 'title', text: 'Three numbers a chef feels.' },
    ...cols(3).flatMap((c, i) => { const s = [['21%', 'lower produce bill', 100, 79], ['1', 'order, was six calls', 6, 1], ['24 hrs', 'farm to dock, was 40', 40, 24]][i];
      return [ tile(c.x, 200, c.w, 130, 'Stat', s[0]), lab(c.x, 346, c.w, s[1], { align: 'center', nowrap: 1, item: 1 }), ...pair(c.x, 376, c.w, s[2], s[3], 22, 8) ]; }) ] },

{ id: 'stat-row-4', name: 'Metric tiles — four across', tier: 'core', cat: 'Numbers', note: 'Four filled tiles, label beneath each. The workhorse numbers slide.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Quarter in four numbers' }, { slot: 'title', text: 'Growth held. Install time halved.' },
    // each tile's pair: last quarter over this one, on the metric's own scale (install time shrinks, so its accent bar is the short one)
    ...cols(4).flatMap((c, i) => { const s = [['1,240', 'Units · +18%', 1051], ['$86K', 'MRR · +11%', 77], ['4.6', 'CSAT · flat', 4.6], ['12 d', 'Install · −49%', 23.5]][i];
      return [ tile(c.x, 190, c.w, 120, 'Stat', s[0]), lab(c.x, 326, c.w, s[1], { align: 'center', nowrap: 1, item: 1 }),
        ...pair(c.x, 354, c.w, s[2], parseFloat(s[0].replace(/[^0-9.]/g, ''))) ]; }),
    body(M, 414, 760, 'Bars: last quarter above, this one below. Units grew with the reseller channel; install time halved once the gateway shipped paired.', { color: 'var(--muted)' }) ] },

{ id: 'kpi-scorecard', name: 'KPI scorecard — status grid', tier: 'core', cat: 'Numbers', note: 'Six metrics with a status dot and a delta chip each.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Scorecard' }, { slot: 'title', text: 'Two amber, none red.' },
    // each card's last five months as a sparkline beside its delta chip (0 = the five-month low, 1 = the high)
    ...[['MRR', '$86K', '+11%', 'var(--accent)', [0, 0.3, 0.45, 0.7, 1]], ['Churn', '2.4%', '−0.6', 'var(--accent)', [1, 0.8, 0.7, 0.4, 0]],
        ['CAC', '$412', '+18%', '#B45309', [0, 0.25, 0.2, 0.6, 1]], ['NPS', '46', '+3', 'var(--accent)', [0.2, 0, 0.5, 0.6, 1]],
        ['Availability', '99.93%', 'flat', 'var(--accent)', [0.6, 0.4, 1, 0.5, 0.6]], ['Support SLA', '92%', '−4', '#B45309', [0.8, 1, 0.9, 0.5, 0]]]
      .flatMap(([k, v, d, tone, sp], i) => { const c = cols(3)[i % 3], y = 168 + Math.floor(i / 3) * 150;
        const px = j => c.x + c.w - 112 + j * 24, py = j => y + 110 - Math.round(sp[j] * 20);
        return [ rect(c.x, y, c.w, 122, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8 }), dot(c.x + c.w - 24, y + 22, 10, { bg: tone }),
          ...[0, 1, 2, 3].map(j => ({ x: px(j), y: py(j), line: [px(j + 1), py(j + 1)], h: 2, bg: tone, butt: 1 })),
          lab(c.x + 16, y + 15, 150, k, { item: 1 }), t(c.x + 16, y + 38, c.w - 32, 'Stat', v),
          { x: c.x + 16, y: y + 90, w: 'auto', p: 'chip', radius: 4, bd: `1px solid ${tone}`, role: 'Label', color: tone, text: d, nowrap: 1 } ]; }) ] },

{ id: 'stat-plus-chart', name: 'Number + supporting chart', tier: 'core', cat: 'Numbers', note: 'The claim carries the left third; the series proves it on the right.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Downloads' }, { slot: 'title', text: 'Three months of the same curve.' },
    t(M, 190, 260, 'Title', '+18%', { color: 'var(--accent)' }),
    body(M, 300, 260, 'Each month beat the last by the same margin; the curve compounds.'),
    ...bars([380, 410, 450], { x0: 420, span: 480, base: 400, bw: 110, gut: 75, labels: ['Jul', 'Aug', 'Sep'] }) ] },

{ id: 'delta-pair', name: 'Before → after with delta', tier: 'core', cat: 'Numbers', note: 'Two states, one arrow, one badge. The cleanest change slide there is.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Setup v2' }, { slot: 'title', text: 'Time-to-value, before and after.' },
    tile(M, 200, 300, 130, 'Stat', '23 days'), lab(M, 344, 300, 'Before · manual setup', { align: 'center', nowrap: 1 }),
    { x: 396, y: 265, line: [524, 265], h: 3, bg: 'var(--accent)', arrow: 'end' },
    chip(414, 220, '−49%'),
    tile(560, 200, 300, 130, 'Stat', '12 days'), lab(560, 344, 300, 'After · guided setup', { align: 'center', nowrap: 1 }),
    // both states on one scale, one day to 13px: the bar under each tile is its number at its size
    rect(M, 380, 300, 44, { bg: 'var(--line)', radius: 4 }), rect(560, 380, Math.round(300 * 12 / 23), 44, { bg: 'var(--accent)', radius: 4 }) ] },

{ id: 'progress-tracker', name: 'Progress bars — goal tracker', tier: 'core', cat: 'Numbers', note: 'Horizontal fills against a shared track, with a target tick.', layout: 'content',
  vals: Object.fromEntries(OBJECTIVES.map(([k, of, sample]) => [k, { range: [0, 100], sample, of: `${of} · percent of goal` }])),
  els: v => [ { slot: 'supertitle', text: 'Objectives' }, { slot: 'title', text: 'Three of four are tracking.' },
    ...OBJECTIVES.flatMap(([key, k], i) => { const pct = v[key], y = 180 + i * 66, tx = M + 260;
        return [ body(M, y + 4, 230, k), rect(tx, y + 6, 520, 16, { bg: 'var(--line)', radius: 8 }),
          rect(tx, y + 6, Math.round(520 * pct / 100), 16, { bg: 'var(--accent)', radius: 8 }),
          lab(tx + 536, y + 8, 60, `${Math.round(pct)}%`, { nowrap: 1 }) ]; }) ] },

{ id: 'two-col-compare', textOnly: true, name: 'Option A vs option B', tier: 'core', cat: 'Comparison', note: 'Two columns, one divider, matched rows — never two floating lists.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'The decision' }, { slot: 'title', text: 'Build the queue or rent one.' },
    vrule(W / 2, 168, 430),
    ...[0, 1].flatMap(side => { const x = side ? W / 2 + 30 : M, w = 380, head = ['Build', 'Rent'][side];
      const rows = [['Cost', ['2 engineers, 2 quarters', '$1,500/mo, live now']], ['Risk', ['Ours end to end', 'Their release plan']], ['Ceiling', ['Any scale we reach', 'Their quota tiers']]];
      return [ t(x, 168, w, 'H2', head, { color: side ? 'var(--fg)' : 'var(--accent)', item: 1 }),
        ...rows.flatMap(([k, v], i) => [ lab(x, 214 + i * 74, w, k), body(x, 232 + i * 74, w, v[side]) ]) ]; }) ] },

{ id: 'pros-cons', textOnly: true, name: 'Pros and cons — tinted panels', tier: 'core', cat: 'Comparison', note: 'Two tinted fields; marks carry the sign so the copy does not have to.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Rent the queue' }, { slot: 'title', text: 'What we gain, what we owe.' },
    rect(M, 168, 400, 268, { bg: 'var(--box)', radius: 10 }), rect(500, 168, 400, 268, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 10 }),
    lab(M + 20, 188, 200, 'Gain', { color: 'var(--accent)' }), lab(520, 188, 200, 'Owe'),
    ...['Live in a week', 'Their region list is longer', 'No hiring against it']
      .flatMap((s, i) => [ t(M + 20, 222 + i * 62, 16, 'Label', '+', { color: 'var(--accent)' }), body(M + 44, 218 + i * 62, 336, s) ]),
    ...['$18K a year, forever', 'Release plan is theirs', 'Exit costs a migration']
      .flatMap((s, i) => [ t(520, 222 + i * 62, 16, 'Label', '–'), body(544, 218 + i * 62, 336, s) ]) ] },

{ id: 'benchmark-table', name: 'Benchmark table — ruled rows', tier: 'core', cat: 'Comparison', note: 'Hairline rows, mono figures, one tinted row for the recommendation.', layout: 'content',
  // K15: v1 and v3 both tinted one row and bolded another — the tint was hardcoded to a y-position, the bold to a row
  // index, and the two drifted apart. One value key now drives both, so they always name the same row.
  vals: { highlight: { range: [-1, 3], sample: -1, of: 'the row to tint and bold — 0 Incumbent A, 1 Incumbent B, 2 Us, 3 Direct; -1 for none' } },
  els: v => { const hi = Math.round(v.highlight), y = 208 + Math.max(hi, 0) * 40;
    return [ { slot: 'supertitle', text: 'Market' }, { slot: 'title', text: 'Where we sit on price and reach.' },
      rect(M, y, CW, 40, { bg: hi >= 0 ? 'var(--box)' : 'transparent' }),
      ...['Supplier', 'Farms', 'Per order', 'Lead time'].map((h, i) => lab(BENCH_X[i], 170, BENCH_W[i], h)),
      rule(M, 194, W - M, { bg: 'var(--fg)', h: 2 }),
      ...BENCH_ROWS.flatMap((r, i) => { const ry = 208 + i * 40;
        return [ ...r.map((cell, j) => t(BENCH_X[j], ry + 10, j === 1 ? 40 : BENCH_W[j], j === 0 ? 'Body' : 'Label', cell, { nowrap: 1, weight: i === hi ? 700 : undefined, ...(j === 0 ? { item: 1 } : {}) })),
          rect(BENCH_X[1] + 48, ry + 10, Math.max(2, Math.round(110 * +r[1] / FARMS_MAX)), 20, { bg: i === hi ? 'var(--accent)' : 'var(--line)', radius: 3 }),   // reach at its size
          rule(M, ry + 40, W - M) ]; }) ]; } },

{ id: 'harvey-balls', name: 'Harvey-ball evaluation matrix', tier: 'standard', cat: 'Comparison', note: 'Options × criteria, filled balls instead of prose. Consulting shorthand.', layout: 'content',
  // twelve ratings, row-major: r<option><criterion>, 0–4 quarters. The option names and criteria stay text keys.
  vals: Object.fromEntries(OPTIONS.flatMap(([name, vs], i) => vs.map((v, j) => [`r${i + 1}c${j + 1}`, { range: [0, 4], sample: v, of: `${name} · ${CRITERIA[j]}` }]))),
  els: v => [ { slot: 'supertitle', text: 'Shortlist' }, { slot: 'title', text: 'Four criteria, three vendors, no adjectives.' },
    ...CRITERIA.map((h, i) => lab(340 + i * 140, 176, 120, h, { align: 'center', nowrap: 1 })),
    rule(M, 200, W - M),
    ...OPTIONS.flatMap(([name], i) => { const y = 220 + i * 72;
        return [ body(M, y + 14, 260, name, { weight: i === 2 ? 700 : 400, item: 1 }),
          ...CRITERIA.map((_, j) => ball(340 + j * 140 + 38, y + 4, v[`r${i + 1}c${j + 1}`])), rule(M, y + 60, W - M) ]; }) ] },
];
