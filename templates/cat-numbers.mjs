import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols, bars } from './kit.mjs';

const chip = (x, y, text, tone = 'var(--accent)') => ({ x, y, w: 'auto', p: 'chip', radius: 4, bd: `1px solid ${tone}`, role: 'Label', color: tone, text, nowrap: 1 });

export default [
{ id: 'stat-hero', name: 'Factoid — one number', tier: 'core', cat: 'Numbers', note: 'A single number at display size with its claim underneath.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'The number' }, { slot: 'title', text: 'Reconciliation is the whole cost.' },
    t(M, 180, 520, 'Title', '11.4 hrs', { color: 'var(--accent)' }),
    body(M, 290, 520, 'Median time an ops team spends per week reconciling statements by hand — before anything is decided.'),
    rule(M + 580, 190, M + 580, { line: [M + 580, 380] }),
    lab(M + 620, 190, 220, 'Sample'), body(M + 620, 210, 220, '38 fleets, 2026 panel.', { color: 'var(--muted)' }) ] },

{ id: 'stat-row-4', name: 'Metric tiles — four across', tier: 'core', cat: 'Numbers', note: 'Four filled tiles, label beneath each. The workhorse numbers slide.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Quarter in four numbers' }, { slot: 'title', text: 'Growth held. Time-to-value halved.' },
    ...cols(4).flatMap((c, i) => { const s = [['1,240', 'Signups · +18%'], ['$86K', 'MRR · +11%'], ['4.6', 'CSAT · flat'], ['12 d', 'TTV · −49%']][i];
      return [ tile(c.x, 180, c.w, 108, 'Stat', s[0]), lab(c.x, 300, c.w, s[1], { align: 'center', nowrap: 1 }) ]; }) ] },

{ id: 'kpi-scorecard', name: 'KPI scorecard — status grid', tier: 'core', cat: 'Numbers', note: 'Six metrics with a status dot and a delta chip each.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Scorecard' }, { slot: 'title', text: 'Two amber, none red.' },
    ...[['MRR', '$86K', '+11%', 'var(--accent)'], ['Churn', '2.4%', '−0.6', 'var(--accent)'], ['CAC', '$412', '+18%', '#B45309'],
        ['NPS', '46', '+3', 'var(--accent)'], ['Uptime', '99.93%', 'flat', 'var(--accent)'], ['Support SLA', '92%', '−4', '#B45309']]
      .flatMap(([k, v, d, tone], i) => { const c = cols(3)[i % 3], y = 168 + Math.floor(i / 3) * 150;
        return [ rect(c.x, y, c.w, 122, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8 }), dot(c.x + c.w - 24, y + 22, 10, { bg: tone }),
          lab(c.x + 16, y + 15, 150, k), t(c.x + 16, y + 38, c.w - 32, 'Stat', v),
          { x: c.x + 16, y: y + 90, w: 'auto', p: 'chip', radius: 4, bd: `1px solid ${tone}`, role: 'Label', color: tone, text: d, nowrap: 1 } ]; }) ] },

{ id: 'stat-plus-chart', name: 'Number + supporting chart', tier: 'core', cat: 'Numbers', note: 'The claim carries the left third; the series proves it on the right.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Signups' }, { slot: 'title', text: 'Three months of the same curve.' },
    t(M, 190, 260, 'Title', '+18%', { color: 'var(--accent)' }),
    body(M, 300, 260, 'Compounding, not a spike — each month beat the last by the same margin.'),
    ...bars([380, 410, 450], { x0: 420, span: 480, base: 400, bw: 110, gut: 75, labels: ['Jul', 'Aug', 'Sep'] }) ] },

{ id: 'delta-pair', name: 'Before → after with delta', tier: 'core', cat: 'Numbers', note: 'Two states, one arrow, one badge. The cleanest change slide there is.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Onboarding v2' }, { slot: 'title', text: 'Time-to-value, before and after.' },
    tile(M, 200, 300, 130, 'Stat', '23 days'), lab(M, 344, 300, 'Before · manual setup', { align: 'center', nowrap: 1 }),
    { x: 396, y: 265, line: [524, 265], h: 3, bg: 'var(--accent)', arrow: 'end' },
    chip(414, 220, '−49%'),
    tile(560, 200, 300, 130, 'Stat', '12 days'), lab(560, 344, 300, 'After · guided setup', { align: 'center', nowrap: 1 }) ] },

{ id: 'progress-tracker', name: 'Progress bars — goal tracker', tier: 'core', cat: 'Numbers', note: 'Horizontal fills against a shared track, with a target tick.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Objectives' }, { slot: 'title', text: 'Three of four are tracking.' },
    ...[['Pilot conversions', 0.82], ['Parsing accuracy', 0.94], ['Renewal rate', 0.61], ['Support SLA', 0.92]]
      .flatMap(([k, v], i) => { const y = 180 + i * 66, tx = M + 260;
        return [ body(M, y + 4, 230, k), rect(tx, y + 6, 520, 16, { bg: 'var(--line)', radius: 8 }),
          rect(tx, y + 6, Math.round(520 * v), 16, { bg: 'var(--accent)', radius: 8 }),
          lab(tx + 536, y + 8, 60, `${Math.round(v * 100)}%`, { nowrap: 1 }) ]; }) ] },

{ id: 'two-col-compare', name: 'Option A vs option B', tier: 'core', cat: 'Comparison', note: 'Two columns, one divider, matched rows — never two floating lists.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'The decision' }, { slot: 'title', text: 'Build the parser or licence one.' },
    vrule(W / 2, 168, 430),
    ...[0, 1].flatMap(side => { const x = side ? W / 2 + 30 : M, w = 380, head = ['Build', 'Licence'][side];
      const rows = [['Cost', ['2 engineers, 2 quarters', '$1,500/mo, live now']], ['Risk', ['Ours end to end', 'Vendor roadmap']], ['Ceiling', ['Any format we meet', 'Their format list']]];
      return [ t(x, 168, w, 'H2', head, { color: side ? 'var(--fg)' : 'var(--accent)' }),
        ...rows.flatMap(([k, v], i) => [ lab(x, 214 + i * 74, w, k), body(x, 232 + i * 74, w, v[side]) ]) ]; }) ] },

{ id: 'pros-cons', name: 'Pros and cons — tinted panels', tier: 'core', cat: 'Comparison', note: 'Two tinted fields; marks carry the sign so the copy does not have to.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Licence the parser' }, { slot: 'title', text: 'What we gain, what we owe.' },
    rect(M, 168, 400, 268, { bg: 'var(--box)', radius: 10 }), rect(500, 168, 400, 268, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 10 }),
    lab(M + 20, 188, 200, 'Gain', { color: 'var(--accent)' }), lab(520, 188, 200, 'Owe'),
    ...['Live in a week, not a quarter', 'Their format list is longer', 'No hiring against it']
      .flatMap((s, i) => [ t(M + 20, 222 + i * 62, 16, 'Label', '+', { color: 'var(--accent)' }), body(M + 44, 218 + i * 62, 336, s) ]),
    ...['$18K a year, forever', 'Roadmap is theirs', 'Exit costs a migration']
      .flatMap((s, i) => [ t(520, 222 + i * 62, 16, 'Label', '–'), body(544, 218 + i * 62, 336, s) ]) ] },

{ id: 'benchmark-table', name: 'Benchmark table — ruled rows', tier: 'core', cat: 'Comparison', note: 'Hairline rows, mono figures, one tinted row for the recommendation.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Market' }, { slot: 'title', text: 'Where we sit on price and coverage.' },
    rect(M, 246, CW, 40, { bg: 'var(--box)' }),
    ...['Vendor', 'Formats', 'Per doc', 'Turnaround'].map((h, i) => lab([M + 14, 380, 560, 720][i], 170, [300, 160, 140, 160][i], h)),
    rule(M, 194, W - M, { bg: 'var(--fg)', h: 2 }),
    ...[['Incumbent A', '12', '$1.80', '4 hrs'], ['Incumbent B', '9', '$1.40', '9 hrs'], ['Us', '31', '$0.89', '90 secs'], ['Open source', '6', '—', 'self-run']]
      .flatMap((r, i) => { const y = 208 + i * 40; return [ ...r.map((cell, j) => t([M + 14, 380, 560, 720][j], y + 10, [300, 160, 140, 160][j], j === 0 ? 'Body' : 'Label', cell, { nowrap: 1, weight: i === 2 ? 700 : undefined })), rule(M, y + 40, W - M) ]; }) ] },

{ id: 'harvey-balls', name: 'Harvey-ball evaluation matrix', tier: 'standard', cat: 'Comparison', note: 'Options × criteria, filled rings instead of prose. Consulting shorthand.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Shortlist' }, { slot: 'title', text: 'Four criteria, three vendors, no adjectives.' },
    ...['Coverage', 'Speed', 'Price', 'Support'].map((h, i) => lab(340 + i * 140, 176, 120, h, { align: 'center', nowrap: 1 })),
    rule(M, 200, W - M),
    ...[['Incumbent A', [75, 50, 25, 100]], ['Incumbent B', [50, 25, 50, 50]], ['Us', [100, 100, 100, 75]]]
      .flatMap(([name, vals], i) => { const y = 220 + i * 72;
        return [ body(M, y + 14, 260, name, { weight: i === 2 ? 700 : 400 }),
          ...vals.map((v, j) => ({ x: 340 + j * 140 + 42, y, w: 36, donut: v, color: 'var(--accent)' })), rule(M, y + 60, W - M) ]; }) ] },
];
