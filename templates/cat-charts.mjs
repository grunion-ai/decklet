import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols, bars, poly } from './kit.mjs';

const S1 = 'var(--accent)', S2 = 'var(--muted)', S3 = 'var(--line)';

export default [
{ id: 'chart-column', name: 'Column chart — one series', tier: 'core', cat: 'Charts', note: 'Bars on a baseline, values above, periods below. The default chart.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Revenue' }, { slot: 'title', text: 'Four quarters, one direction.' },
    ...bars([62, 71, 78, 92], { x0: 200, span: 560, base: 400, bw: 104, gut: 48, labels: ['Q1', 'Q2', 'Q3', 'Q4'], fmt: v => `$${v}K` }),
    lab(M, 420, 300, 'Recognised revenue · $000s') ] },

{ id: 'chart-bar-ranked', name: 'Ranked bars — horizontal', tier: 'core', cat: 'Charts', note: 'Sorted, long labels readable, the leader tinted. Beats a pie every time.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Where volume comes from' }, { slot: 'title', text: 'Two brokers are half the book.' },
    ...[['Kessler Capital', 240], ['Northbridge', 196], ['Vantage Funding', 128], ['Direct', 84], ['Everyone else', 52]]
      .flatMap(([k, v], i) => { const y = 178 + i * 52;
        return [ body(M, y + 4, 220, k), rect(300, y, Math.round(v * 2.1), 26, { bg: i < 2 ? S1 : S3, radius: 3 }),
          lab(300 + Math.round(v * 2.1) + 12, y + 6, 80, `${v}`, { nowrap: 1 }) ]; }),
    rule(300, 172, 300, { line: [300, 424] }) ] },

{ id: 'chart-stacked-100', name: 'Stacked bars — 100% composition', tier: 'core', cat: 'Charts', note: 'Part-to-whole across periods; the mix shift is the story.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Mix' }, { slot: 'title', text: 'The low tier took the growth.' },
    ...[[52, 30, 18], [46, 32, 22], [38, 34, 28], [30, 36, 34]]
      .flatMap((stack, i) => { const x = 240 + i * 150; let y = 190;
        const out = stack.map((v, j) => { const h = Math.round(v * 2.1); const r = rect(x, y, 108, h, { bg: [S1, S2, S3][j] }); const lb = lab(x, y + h / 2 - 7, 108, `${v}%`, { align: 'center', nowrap: 1, color: j === 0 ? 'var(--card)' : 'var(--fg)' }); y += h; return [r, lb]; }).flat();
        out.push(lab(x, y + 12, 108, ['Q1', 'Q2', 'Q3', 'Q4'][i], { align: 'center', nowrap: 1 })); return out; }),
    ...['Enterprise', 'Mid', 'Low'].flatMap((k, i) => [ rect(M, 200 + i * 34, 14, 14, { bg: [S1, S2, S3][i], radius: 3 }), lab(M + 24, 202 + i * 34, 130, k, { nowrap: 1 }) ]) ] },

{ id: 'chart-grouped', name: 'Grouped bars — two series', tier: 'core', cat: 'Charts', note: 'Plan against actual, period by period, one legend.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Plan vs actual' }, { slot: 'title', text: 'We beat plan twice and missed once.' },
    ...[[70, 62], [74, 81], [80, 78], [86, 96]].flatMap((pair, i) => { const x = 230 + i * 165;
      return pair.flatMap((v, j) => { const h = Math.round(v * 1.7), bx = x + j * 62;
        return [ rect(bx, 400 - h, 54, h, { bar: 1, bg: j ? S1 : S3 }), lab(bx, 400 - h - 18, 54, `${v}`, { align: 'center', nowrap: 1 }) ]; })
        .concat([ lab(x, 412, 116, ['Q1', 'Q2', 'Q3', 'Q4'][i], { align: 'center', nowrap: 1 }) ]); }),
    rule(220, 400, 900),
    ...['Plan', 'Actual'].flatMap((k, i) => [ rect(M, 200 + i * 34, 14, 14, { bg: i ? S1 : S3, radius: 3 }), lab(M + 24, 202 + i * 34, 120, k, { nowrap: 1 }) ]) ] },

{ id: 'chart-line-trend', name: 'Line chart — trend with end label', tier: 'core', cat: 'Charts', note: 'A single series, dotted at each read, named at its end instead of a legend.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Turnaround' }, { slot: 'title', text: 'Median parse time, twelve weeks.' },
    rule(200, 400, 880), vrule(200, 180, 400),
    ...poly([[220, 360], [330, 330], [440, 296], [550, 250], [660, 228], [770, 206]]),
    ...[[220, 360], [330, 330], [440, 296], [550, 250], [660, 228], [770, 206]].map(([x, y]) => dot(x, y, 10)),
    lab(790, 199, 110, '90 secs', { color: S1, nowrap: 1 }),
    ...['W1', 'W3', 'W5', 'W7', 'W9', 'W11'].map((k, i) => lab(180 + i * 110, 412, 80, k, { align: 'center', nowrap: 1 })),
    lab(M, 190, 120, 'Faster ↑') ] },

{ id: 'chart-area-band', name: 'Area band — range plus median', tier: 'standard', cat: 'Charts', note: 'A tinted band for the spread, a line for the middle. Shows uncertainty honestly.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Forecast' }, { slot: 'title', text: 'The band is the honest part.' },
    rule(200, 400, 880), vrule(200, 180, 400),
    ...[0, 1, 2, 3, 4, 5].map(i => rect(220 + i * 110, 250 - i * 12, 100, 60 + i * 20, { bg: S1, op: 0.16 })),
    ...poly([[220, 300], [330, 292], [440, 280], [550, 266], [660, 250], [770, 236]]),
    lab(790, 230, 110, 'median', { color: S1, nowrap: 1 }),
    ...['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'].map((k, i) => lab(180 + i * 110, 412, 80, k, { align: 'center', nowrap: 1 })) ] },

{ id: 'chart-waterfall', name: 'Waterfall — bridge', tier: 'standard', cat: 'Charts', note: 'Start, the drivers, end — with dashed connectors carrying the eye across.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Margin bridge' }, { slot: 'title', text: 'Support hours ate the price gain.' },
    ...[['Q2', 0, 150, S2], ['Price', 150, 40, S1], ['Mix', 130, 20, S3], ['Support', 80, 50, S3], ['Q3', 0, 130, S2]]
      .flatMap(([lbl, base, h, tone], i) => { const x = 180 + i * 150, y = 400 - base - h;
        const r = [ rect(x, y, 108, h, { bg: tone, radius: 3 }), lab(x, y - 20, 108, ['150', '+40', '−20', '−50', '130'][i], { align: 'center', nowrap: 1 }),
          lab(x, 412, 108, lbl, { align: 'center', nowrap: 1 }) ];
        if (i < 4) r.push({ x: x + 108, y, line: [x + 150, y], h: 1.5, bg: 'var(--line)', dash: [5, 4] });
        return r; }),
    rule(170, 400, 900) ] },

{ id: 'chart-donut', name: 'Donut — one share', tier: 'core', cat: 'Charts', note: 'One ring, the number in the hole, the rest in a sentence.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Concentration' }, { slot: 'title', text: 'Two brokers, half the book.' },
    { x: 180, y: 190, w: 200, donut: 52, color: S1 },
    t(180, 268, 200, 'Stat', '52%', { align: 'center', nowrap: 1 }),
    body(460, 210, 400, 'Half of submitted volume arrives from two relationships. Neither is under contract past March.'),
    lab(460, 320, 400, 'Renewal exposure · high') ] },

{ id: 'chart-donut-row', name: 'Donut row — three shares', tier: 'standard', cat: 'Charts', note: 'Three rings read as one comparison; keep them the same size.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Coverage' }, { slot: 'title', text: 'Where the parser is already strong.' },
    ...[['Bank statements', 94], ['Broker packets', 71], ['Tax returns', 38]]
      .flatMap(([k, v], i) => { const x = 130 + i * 250;
        return [ { x, y: 190, w: 160, donut: v, color: S1 }, t(x, 250, 160, 'Stat', `${v}%`, { align: 'center', nowrap: 1 }),
          lab(x - 20, 372, 200, k, { align: 'center', nowrap: 1 }) ]; }) ] },

{ id: 'chart-gauge', name: 'Gauge — single health read', tier: 'standard', cat: 'Charts', note: 'One ring against a target line. For a status page, not an analysis.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Accuracy' }, { slot: 'title', text: 'Above the contractual floor.' },
    { x: 340, y: 176, w: 260, donut: 94, color: S1 },
    t(340, 276, 260, 'Title', '94%', { align: 'center', nowrap: 1 }),
    lab(340, 350, 260, 'field-level accuracy', { align: 'center', nowrap: 1 }),
    rect(M, 240, 200, 76, { bg: 'var(--box)', radius: 8 }), lab(M + 16, 256, 170, 'Floor'), t(M + 16, 276, 170, 'H2', '90%'),
    rect(700, 240, 200, 76, { bg: 'var(--box)', radius: 8 }), lab(716, 256, 170, 'Headroom'), t(716, 276, 170, 'H2', '+4 pts') ] },

{ id: 'chart-scatter', name: 'Scatter / bubble — two variables', tier: 'standard', cat: 'Charts', note: 'Position for two variables, size for a third, labels only on outliers.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Accounts' }, { slot: 'title', text: 'Volume and margin are not the same book.' },
    { x: 240, y: 410, line: [900, 410], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    { x: 240, y: 410, line: [240, 176], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    ...[[330, 350, 22], [400, 300, 34], [470, 330, 18], [540, 260, 46], [610, 300, 26], [680, 220, 30], [760, 340, 20], [820, 250, 24]]
      .map(([x, y, d]) => dot(x, y, d, { op: 0.55 })),
    dot(540, 260, 46, { bg: S1 }), lab(576, 236, 150, 'Kessler', { color: S1, nowrap: 1 }),
    lab(250, 430, 260, 'Volume →'), lab(120, 180, 110, 'Margin ↑', { align: 'right' }),
    cap(M, 210, 150, 'Bubble size = open exposure.') ] },

{ id: 'chart-heatmap', name: 'Heatmap — intensity grid', tier: 'standard', cat: 'Charts', note: 'A matrix where tint carries the value; labels stay outside the cells.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Exceptions' }, { slot: 'title', text: 'Fridays and tax returns.' },
    ...['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => lab(280 + i * 116, 176, 100, d, { align: 'center', nowrap: 1 })),
    ...[['Bank', [0.1, 0.15, 0.1, 0.2, 0.35]], ['Broker', [0.2, 0.3, 0.25, 0.4, 0.6]], ['Tax', [0.5, 0.55, 0.6, 0.7, 0.95]]]
      .flatMap(([row, vals], i) => { const y = 200 + i * 74;
        return [ body(M, y + 20, 200, row), ...vals.map((v, j) => rect(280 + j * 116, y, 100, 62, { bg: S1, op: v, radius: 4 })) ]; }),
    ...[0.15, 0.5, 0.95].map((v, i) => rect(720 + i * 30, 440, 26, 12, { bg: S1, op: v })),
    lab(600, 438, 100, 'low', { align: 'right', nowrap: 1 }), lab(820, 438, 80, 'high', { nowrap: 1 }) ] },

{ id: 'chart-histogram', name: 'Distribution — histogram', tier: 'standard', cat: 'Charts', note: 'Shape of a population, with the median called out. Kills the average.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Deal size' }, { slot: 'title', text: 'The average deal does not exist.' },
    ...[8, 22, 41, 58, 44, 30, 19, 12, 7, 4].map((v, i) => rect(220 + i * 68, 400 - v * 3.4, 64, v * 3.4, { bg: i === 3 ? S1 : S3 })),
    rule(210, 400, 910),
    { x: 480, y: 180, line: [480, 400], h: 2, bg: 'var(--fg)', dash: [6, 5] },
    lab(492, 184, 140, 'median $54K', { nowrap: 1 }),
    ...['10', '50', '90', '130'].map((k, i) => lab(190 + i * 204, 412, 80, `$${k}K`, { align: 'center', nowrap: 1 })) ] },

{ id: 'chart-slope', name: 'Slope chart — two points, many lines', tier: 'fringe', cat: 'Charts', note: 'Rank or level at two dates; crossing lines are the whole message.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Channel mix' }, { slot: 'title', text: 'Direct overtook paid in one quarter.' },
    vrule(340, 190, 400), vrule(700, 190, 400),
    lab(280, 168, 120, 'Q2', { align: 'center', nowrap: 1 }), lab(640, 168, 120, 'Q3', { align: 'center', nowrap: 1 }),
    ...[['Paid', 210, 320, S3], ['Direct', 300, 210, S1], ['Broker', 350, 300, S3]]
      .flatMap(([k, y1, y2, tone]) => [ { x: 340, y: y1, line: [700, y2], h: 2.5, bg: tone },
        dot(340, y1, 10, { bg: tone }), dot(700, y2, 10, { bg: tone }),
        lab(180, y1 - 7, 140, k, { align: 'right', nowrap: 1, color: tone }),
        lab(720, y2 - 7, 140, ['—', '', ''][0] ? '' : '', { nowrap: 1 }) ]),
    lab(720, 313, 160, '31% of volume', { nowrap: 1 }), lab(720, 203, 160, '44% of volume', { color: S1, nowrap: 1 }), lab(720, 293, 160, '25% of volume', { nowrap: 1 }) ] },

{ id: 'chart-dumbbell', name: 'Dumbbell — gap between two states', tier: 'fringe', cat: 'Charts', note: 'The distance is the point; two dots and a connector say it faster than bars.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Target vs actual' }, { slot: 'title', text: 'Four gaps, one that matters.' },
    ...[['Parse time', 300, 520], ['Accuracy', 620, 700], ['Renewals', 380, 760], ['Support SLA', 640, 720]]
      .flatMap(([k, a, b], i) => { const y = 190 + i * 62;
        return [ body(M, y - 7, 210, k), { x: a, y, line: [b, y], h: 3, bg: 'var(--line)' },
          dot(a, y, 14, { bg: S3 }), dot(b, y, 14, { bg: S1 }),
          lab(b + 16, y - 7, 80, `+${Math.round((b - a) / 4)}`, { nowrap: 1, color: i === 2 ? S1 : 'var(--muted)' }) ]; }),
    ...['Today', 'Target'].flatMap((k, i) => [ dot(M + 8 + i * 110, 452, 12, { bg: i ? S1 : S3 }), lab(M + 22 + i * 110, 445, 90, k, { nowrap: 1 }) ]) ] },

{ id: 'chart-small-multiples', name: 'Small multiples — six panels', tier: 'fringe', cat: 'Charts', note: 'Same axis, six times. The comparison a single crowded chart cannot make.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'By region' }, { slot: 'title', text: 'One shape repeats; the Northeast does not.' },
    ...[['Northeast', [30, 44, 58, 74]], ['Southeast', [50, 46, 44, 41]], ['Midwest', [38, 40, 39, 42]],
        ['Southwest', [44, 41, 43, 40]], ['Mountain', [26, 28, 27, 30]], ['Pacific', [48, 50, 47, 49]]]
      .flatMap(([k, vals], i) => { const x = M + (i % 3) * 290, y = 180 + Math.floor(i / 3) * 130;
        return [ lab(x, y, 200, k, { nowrap: 1, color: i === 0 ? S1 : 'var(--muted)' }),
          ...vals.map((v, j) => rect(x + j * 56, y + 96 - v, 44, v, { bg: i === 0 ? S1 : S3 })),
          rule(x, y + 96, x + 236) ]; }) ] },

{ id: 'chart-marimekko', name: 'Marimekko — share within share', tier: 'fringe', cat: 'Charts', note: 'Column width is market size, segment height is mix. Two dimensions, one picture.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Market structure' }, { slot: 'title', text: 'Our share is best where the market is smallest.' },
    ...[['Bank', 300, [52, 30, 18]], ['Broker', 220, [28, 42, 30]], ['Direct', 130, [70, 20, 10]], ['Other', 90, [15, 25, 60]]]
      .reduce((acc, [k, w, mix]) => { const x = acc.x; let y = 190;
        mix.forEach((v, j) => { const h = Math.round(v * 2.0); acc.els.push(rect(x, y, w - 6, h, { bg: [S1, S2, S3][j] }));
          if (h > 26) acc.els.push(lab(x, y + h / 2 - 7, w - 6, `${v}%`, { align: 'center', nowrap: 1, color: j === 0 ? 'var(--card)' : 'var(--fg)' })); y += h; });
        acc.els.push(lab(x, 404, w - 6, k, { align: 'center', nowrap: 1 }));
        acc.els.push(lab(x, 424, w - 6, `${w}0 deals`, { align: 'center', nowrap: 1, color: 'var(--muted)' }));
        acc.x += w; return acc; }, { x: 160, els: [] }).els ] },

{ id: 'chart-pareto', name: 'Pareto — bars plus cumulative line', tier: 'fringe', cat: 'Charts', note: 'Sorted bars with the running total on top; where it crosses 80% is the answer.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Exceptions by cause' }, { slot: 'title', text: 'Three causes are eighty percent of the queue.' },
    ...[42, 26, 14, 8, 6, 4].map((v, i) => rect(210 + i * 116, 400 - v * 5, 92, v * 5, { bg: i < 3 ? 'var(--accent)' : 'var(--line)' })),
    rule(200, 400, 910),
    ...poly([[256, 190], [372, 162], [488, 148], [604, 140], [720, 134], [836, 130]], { bg: 'var(--fg)', h: 2 }),
    ...[[256, 190], [372, 162], [488, 148], [604, 140], [720, 134], [836, 130]].map(([x, y]) => dot(x, y, 8, { bg: 'var(--fg)' })),
    { x: 200, y: 152, line: [910, 152], h: 1.5, bg: 'var(--accent)', dash: [5, 4] },
    lab(M, 145, 130, '80% line', { color: 'var(--accent)', nowrap: 1 }),
    ...['Format', 'Blur', 'Missing pg', 'Currency', 'Duplicate', 'Other'].map((k, i) => lab(200 + i * 116, 412, 112, k, { align: 'center', nowrap: 1 })) ] },

{ id: 'chart-flow-split', name: 'Flow split — volume in, volume out', tier: 'fringe', cat: 'Charts', note: 'Band thickness is volume. A true curved Sankey ribbon needs an engine primitive decklet does not have yet.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Flow' }, { slot: 'title', text: 'Most of what arrives never gets underwritten.' },
    rect(M + 20, 190, 40, 220, { bg: 'var(--fg)' }), lab(M + 20, 168, 160, 'Submitted', { nowrap: 1 }),
    rect(820, 190, 40, 120, { bg: 'var(--accent)' }), lab(740, 168, 200, 'Underwritten', { align: 'right', nowrap: 1 }),
    rect(820, 330, 40, 80, { bg: 'var(--line)' }), lab(740, 418, 200, 'Dropped', { align: 'right', nowrap: 1 }),
    rect(120, 191, 700, 118, { bg: 'var(--accent)', op: 0.28 }),
    rect(120, 331, 700, 78, { bg: 'var(--muted)', op: 0.22 }),
    lab(330, 462, 130, '640 deals', { align: 'right', nowrap: 1, color: 'var(--accent)' }),
    lab(490, 462, 130, '600 dropped', { nowrap: 1 }) ] },
];
