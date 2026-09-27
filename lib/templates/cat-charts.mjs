import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols, bars, poly } from './kit.mjs';

const S1 = 'var(--accent)', S2 = 'var(--muted)', S3 = 'var(--line)';

// K22: every mark below reads a value key. A matrix (stacked shares, heat cells, marimekko) is one number key per cell,
// c#s# / r#c#, like harvey-balls; a series is one `data` key whose length is the template's (its text rows stay t1..tn);
// a plotted point is x#/y# on 0..100, like two-by-two. The samples are the shipped cut, so an unfilled slide is unchanged.
const isN = x => typeof x === 'number' && Number.isFinite(x);
const signed = n => `${n < 0 ? '−' : '+'}${Math.abs(n)}`;
const exactly = (n, what) => d => d.length === n ? [] : [`${what} takes exactly ${n} points, not ${d.length}`];
const fields = (d, names, min = 0) => d.flatMap((p, i) => names.filter(f => !(isN(p && p[f]) && p[f] >= min)).map(f => `data[${i}].${f} must be a number ≥ ${min}`));
// c#s#: column c's segment s, drawn as its share of the column's sum
const mixVals = (samples, cols, segs) => Object.fromEntries(samples.flatMap((m, c) => m.map((n, s) => [`c${c + 1}s${s + 1}`,
  { range: [0, 1e9], sample: n, of: `${cols[c]} · ${segs[s]} (segment ${s + 1} of column ${c + 1}; the column draws each as its share of the three)` }])));
const shares = (v, c) => { const m = [1, 2, 3].map(s => v[`c${c}s${s}`]), sum = m.reduce((a, b) => a + b, 0) || 1; return m.map(n => n * 100 / sum); };
// x#/y#/s#: a point on the 0..100 plot, and a bubble's area (the largest draws at `dmax`)
const xy = (i, who, s) => ({ [`x${i}`]: { range: [0, 100], sample: s[0], of: `${who} · across (0 … 100)` }, [`y${i}`]: { range: [0, 100], sample: s[1], of: `${who} · up (0 … 100)` },
  ...(s.length > 2 ? { [`s${i}`]: { range: [0, 1e9], sample: s[2], of: `${who} · bubble area (the largest draws full size)` } } : {}) });

export default [
{ id: 'chart-column', name: 'Column chart — one series', tier: 'core', cat: 'Charts', note: 'Bars on a baseline, values above, periods below. The default chart.', layout: 'content',
  vals: { data: { kind: 'data', mark: 'bar', of: 'the series — [{label, value}], two points or more; the chart row draws it',
    sample: [{ label: 'Q1', value: 62, text: '$62K' }, { label: 'Q2', value: 71, text: '$71K' }, { label: 'Q3', value: 78, text: '$78K' }, { label: 'Q4', value: 92, text: '$92K' }] } },
  els: v => [ { slot: 'supertitle', text: 'Revenue' }, { slot: 'title', text: 'Four quarters, one direction.' },
    lab(M, 432, 300, 'Recognized revenue · $000s'),   // clear of the category labels' line boxes
    { x: 150, y: 176, w: 770, h: 244, chart: { mark: 'bar', data: v.data } } ] },

// Each bar's length is its value key v1..v5, all on one scale: the largest value fills the 504px track. The number past the
// bar reads the value; its text key still takes a formatted string ('$240M') in its place.
{ id: 'chart-bar-ranked', name: 'Ranked bars — horizontal', tier: 'core', cat: 'Charts', note: 'Sorted, long labels readable, the leader tinted. Beats a pie every time.', layout: 'content',
  vals: Object.fromEntries([['Harbor Hotels', 240], ['Summit Catering', 196], ['Cedar Bistro Group', 128], ['Walk-in', 84], ['Everyone else', 52]]
    .map(([k, n], i) => ['v' + (i + 1), { range: [0, 1e6], sample: n, of: `${k} · the bar's length, one scale for all five (the largest fills the track)` }])),
  els: v => { const ns = [1, 2, 3, 4, 5].map(i => v['v' + i]), top = Math.max(...ns) || 1, len = n => Math.round(n * 504 / top);
    return [ { slot: 'supertitle', text: 'Where volume comes from' }, { slot: 'title', text: 'Two accounts are half the volume.' },
    ...['Harbor Hotels', 'Summit Catering', 'Cedar Bistro Group', 'Walk-in', 'Everyone else']
      .flatMap((k, i) => { const y = 178 + i * 52, n = ns[i];
        return [ body(M, y + 4, 220, k), rect(300, y, len(n), 26, { bg: i < 2 ? S1 : S3, radius: 3 }),
          lab(300 + len(n) + 12, y + 6, 80, `${n}`, { nowrap: 1 }) ]; }),
    rule(300, 172, 300, { line: [300, 424] }) ]; } },

{ id: 'chart-stacked-100', name: 'Stacked bars — 100% composition', tier: 'core', cat: 'Charts', note: 'Part-to-whole across periods; the mix shift is the story.', layout: 'content',
  vals: mixVals([[52, 30, 18], [46, 32, 22], [38, 34, 28], [30, 36, 34]], ['Q1', 'Q2', 'Q3', 'Q4'], ['Enterprise', 'Mid', 'Low']),
  els: v => [ { slot: 'supertitle', text: 'Mix' }, { slot: 'title', text: 'The low tier took the growth.' },
    ...['Q1', 'Q2', 'Q3', 'Q4']
      .flatMap((q, i) => { const x = 240 + i * 150; let y = 190;
        const out = shares(v, i + 1).map((p, j) => { const h = Math.round(p * 2.1); const r = rect(x, y, 108, h, { bg: [S1, S2, S3][j] }); const lb = lab(x, y + h / 2 - 7, 108, `${Math.round(p)}%`, { align: 'center', nowrap: 1, color: j === 0 ? 'var(--card)' : 'var(--fg)' }); y += h; return [r, lb]; }).flat();
        out.push(lab(x, y + 12, 108, q, { align: 'center', nowrap: 1 })); return out; }),
    ...['Enterprise', 'Mid', 'Low'].flatMap((k, i) => [ rect(M, 200 + i * 34, 14, 14, { bg: [S1, S2, S3][i], radius: 3 }), lab(M + 24, 202 + i * 34, 130, k, { nowrap: 1 }) ]) ] },

{ id: 'chart-grouped', name: 'Grouped bars — two series', tier: 'core', cat: 'Charts', note: 'Plan against actual, period by period, one legend.', layout: 'content',
  // two series: `value` is the near bar (full accent), `compare` the one beside it (accent at 60%) — the legend rows say which
  vals: { data: { kind: 'data', mark: 'bar', series: ['Actual', 'Plan'], of: 'the two series — [{label, value, compare}]; value is Actual, compare is Plan',
    sample: [{ label: 'Q1', value: 62, compare: 70 }, { label: 'Q2', value: 81, compare: 74 }, { label: 'Q3', value: 78, compare: 80 }, { label: 'Q4', value: 96, compare: 86 }] } },
  els: v => [ { slot: 'supertitle', text: 'Plan vs actual' }, { slot: 'title', text: 'We beat plan twice and missed twice.' },
    ...['Actual', 'Plan'].flatMap((k, i) => [ rect(M, 200 + i * 34, 14, 14, { bg: S1, radius: 3, ...(i ? { op: 0.6 } : {}) }), lab(M + 24, 202 + i * 34, 120, k, { nowrap: 1 }) ]),
    { x: 230, y: 176, w: 690, h: 244, chart: { mark: 'bar', data: v.data } } ] },

{ id: 'chart-line-trend', name: 'Line chart — trend with end label', tier: 'core', cat: 'Charts', note: 'A single series, dotted at each read, values on the stroke instead of a legend.', layout: 'content',
  vals: { data: { kind: 'data', mark: 'line', of: 'the series — [{label, value}]; the stroke, its dots and its labels come from the chart row',
    sample: [{ label: 'W1', value: 210 }, { label: 'W3', value: 180 }, { label: 'W5', value: 150 }, { label: 'W7', value: 120 }, { label: 'W9', value: 104 }, { label: 'W11', value: 90 }] } },
  els: v => [ { slot: 'supertitle', text: 'Latency' }, { slot: 'title', text: 'Median delivery time, twelve weeks.' },
    lab(M, 190, 120, 'Faster ↓'),
    { x: 230, y: 176, w: 690, h: 250, chart: { mark: 'line', data: v.data, source: 'Median delivery time · ms' } } ] },

// the band is low..high per period, the line the median (value); one scale from zero, the highest high at the plot's top
{ id: 'chart-area-band', name: 'Area band — range plus median', tier: 'standard', cat: 'Charts', note: 'A tinted band for the spread, a line for the middle. Shows uncertainty honestly.', layout: 'content',
  vals: { data: { kind: 'data', mark: 'line', of: 'six periods — [{label, value, low, high}]; the band spans low..high, the line runs through value (the median)',
    check: d => [...exactly(6, 'the band')(d), ...fields(d, ['value', 'low', 'high']), ...d.flatMap((p, i) => p && !(p.low <= p.value && p.value <= p.high) ? [`data[${i}]: low ≤ value ≤ high`] : [])],
    sample: [[50, 45, 75], [54, 41, 81], [60, 37, 87], [67, 33, 93], [75, 29, 99], [82, 25, 105]].map(([value, low, high], i) => ({ label: `Q${i + 1}`, value, low, high })) } },
  els: v => { const top = Math.max(...v.data.map(p => p.high)) || 1, Y = n => 400 - 210 * n / top, pts = v.data.map((p, i) => [220 + i * 110, Y(p.value)]);
    return [ { slot: 'supertitle', text: 'Forecast' }, { slot: 'title', text: 'The band is the honest part.' },
    rule(200, 400, 880), vrule(200, 180, 400),
    ...v.data.map((p, i) => rect(220 + i * 110, Y(p.high), 100, Y(p.low) - Y(p.high), { bg: S1, op: 0.16 })),
    ...poly(pts),
    lab(790, pts[5][1] - 6, 70, 'median', { color: S1, nowrap: 1 }),   // inside the band, not across its edge
    ...v.data.map((p, i) => lab(180 + i * 110, 412, 80, p.label, { align: 'center', nowrap: 1 })) ]; } },

// start, three drivers (signed), end: the end must be start plus the drivers. The highest running level fills 190px.
{ id: 'chart-waterfall', name: 'Waterfall — bridge', tier: 'standard', cat: 'Charts', note: 'Start, the drivers, end — with dashed connectors carrying the eye across.', layout: 'content',
  vals: { data: { kind: 'data', mark: 'bar', of: 'five bars — [{label, value, text?}]: the start, three signed drivers, the end (start plus the drivers)',
    check: d => { const e = [...exactly(5, 'the bridge')(d), ...d.flatMap((p, i) => isN(p && p.value) ? [] : [`data[${i}].value must be a number`])]; if (e.length) return e;
      const run = d.slice(0, 4).reduce((a, p) => [...a, a[a.length - 1] + p.value], [0]).slice(1), end = run[3];
      if (Math.abs(d[4].value - end) > 1e-9) e.push(`the end is the start plus the three drivers: ${end}, not ${d[4].value}`);
      if (run.some(n => n < 0)) e.push('the bridge dips under zero — a waterfall here starts and runs above its baseline');
      return e; },
    sample: [['Q2', 150], ['Price', 40], ['Mix', -20], ['Support', -40], ['Q3', 130]].map(([label, value]) => ({ label, value })) } },
  els: v => { const d = v.data, lv = d.slice(0, 4).reduce((a, p) => [...a, a[a.length - 1] + p.value], [0]).slice(1);   // the level after each bar
    const k = 190 / (Math.max(...lv, d[4].value) || 1);
    return [ { slot: 'supertitle', text: 'Margin bridge' }, { slot: 'title', text: 'Support hours ate the price gain.' },
    ...d.flatMap((p, i) => { const x = 180 + i * 150, ends = i === 0 || i === 4 ? [0, p.value] : [lv[i - 1], lv[i]];
        const lo = Math.min(...ends), hi = Math.max(...ends), y = 400 - hi * k, tone = i === 0 || i === 4 ? S2 : p.value >= 0 ? S1 : S3;
        const r = [ rect(x, y, 108, (hi - lo) * k, { bg: tone, radius: 3 }), lab(x, y - 20, 108, p.text ?? (i === 0 || i === 4 ? String(p.value) : signed(p.value)), { align: 'center', nowrap: 1 }),
          lab(x, 412, 108, p.label, { align: 'center', nowrap: 1 }) ];
        if (i < 4) { const ly = 400 - lv[i] * k; r.push({ x: x + 108, y: ly, line: [x + 150, ly], h: 1.5, bg: 'var(--line)', dash: [5, 4] }); }
        return r; }),
    rule(170, 400, 900) ]; } },

{ id: 'chart-donut', name: 'Donut — one share', tier: 'core', cat: 'Charts', note: 'One ring, the number in the hole, the rest in a sentence.', layout: 'content',
  vals: { v1: { range: [0, 100], sample: 52, of: 'the share — the ring and the number in its hole' } },
  els: v => [ { slot: 'supertitle', text: 'Concentration' }, { slot: 'title', text: 'Two accounts, half the volume.' },
    { x: 180, y: 190, w: 200, donut: v.v1, color: S1 },
    t(180, 268, 200, 'Stat', `${v.v1}%`, { align: 'center', nowrap: 1 }),
    body(460, 210, 400, 'Half of weekly orders come from two hotel groups. Neither is under contract past March.'),
    lab(460, 320, 400, 'Renewal exposure · high') ] },

{ id: 'chart-donut-row', name: 'Donut row — three shares', tier: 'standard', cat: 'Charts', note: 'Three rings read as one comparison; keep them the same size.', layout: 'content',
  vals: { v1: { range: [0, 100], sample: 94, of: 'first ring' }, v2: { range: [0, 100], sample: 71, of: 'second ring' }, v3: { range: [0, 100], sample: 38, of: 'third ring' } },
  els: v => [ { slot: 'supertitle', text: 'Coverage' }, { slot: 'title', text: 'Where the sensors already read well.' },
    ...['Soil moisture', 'Tank level', 'Gate position']
      .flatMap((k, i) => { const x = 130 + i * 250, val = v['v' + (i + 1)];
        return [ { x, y: 190, w: 160, donut: val, color: S1 }, t(x, 250, 160, 'Stat', `${val}%`, { align: 'center', nowrap: 1 }),
          lab(x - 20, 372, 200, k, { align: 'center', nowrap: 1 }) ]; }) ] },

{ id: 'chart-gauge', name: 'Gauge — single health read', tier: 'standard', cat: 'Charts', note: 'One ring against a target line. For a status page, not an analysis.', layout: 'content',
  vals: { v1: { range: [0, 100], sample: 94, of: 'the read — the ring and its number (the floor and headroom are text keys)' } },
  els: v => [ { slot: 'supertitle', text: 'Accuracy' }, { slot: 'title', text: 'Above the contractual floor.' },
    { x: 340, y: 176, w: 260, donut: v.v1, color: S1 },
    t(340, 276, 260, 'Title', `${v.v1}%`, { align: 'center', nowrap: 1 }),
    lab(340, 350, 260, 'auto-match accuracy', { align: 'center', nowrap: 1 }),
    rect(M, 240, 200, 76, { bg: 'var(--box)', radius: 8 }), lab(M + 16, 256, 170, 'Floor'), t(M + 16, 276, 170, 'H2', '90%'),
    rect(700, 240, 200, 76, { bg: 'var(--box)', radius: 8 }), lab(716, 256, 170, 'Headroom'), t(716, 276, 170, 'H2', '+4 points') ] },

// eight accounts at x#/y# on 0..100 (the plot runs 240..900 across, 410..176 up), bubble area s#: the largest (46px) is lit and named
{ id: 'chart-scatter', name: 'Scatter / bubble — two variables', tier: 'standard', cat: 'Charts', note: 'Position for two variables, size for a third, labels only on outliers.', layout: 'content',
  vals: Object.assign({}, ...[[13.6, 25.6, 484], [24.2, 47, 1156], [34.8, 34.2, 324], [45.5, 64.1, 2116], [56.1, 47, 676], [66.7, 81.2, 900], [78.8, 29.9, 400], [87.9, 68.4, 576]]
    .map((s, i) => xy(i + 1, `account ${i + 1}${i === 3 ? ' (Harbor)' : ''}`, s))),
  els: v => { const P = [1, 2, 3, 4, 5, 6, 7, 8].map(i => [Math.round(240 + v['x' + i] * 6.6), Math.round(410 - v['y' + i] * 2.34), v['s' + i]]);
    const top = Math.max(...P.map(p => p[2])) || 1, D = P.map(p => Math.max(4, Math.round(46 * Math.sqrt(p[2] / top)))), lit = P.findIndex(p => p[2] === top);
    const [lx, ly] = P[lit], ld = D[lit];
    return [ { slot: 'supertitle', text: 'Accounts' }, { slot: 'title', text: 'Volume and margin pick different accounts.' },
    { x: 240, y: 410, line: [900, 410], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    { x: 240, y: 410, line: [240, 176], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    ...P.map(([x, y], i) => dot(x, y, D[i], { op: 0.55 })),
    dot(lx, ly, ld, { bg: S1 }), lab(lx + ld / 2 + 13, ly - 24, 80, 'Harbor', { color: S1, nowrap: 1 }),   // the box ends before the next bubble
    lab(250, 430, 260, 'Volume →'), lab(120, 180, 110, 'Margin ↑', { align: 'right' }),
    cap(M, 210, 150, 'Bubble size = open balance.') ]; } },

// r#c#: row r, weekday c; the tint is the value's share of the largest (the largest draws at 0.95)
{ id: 'chart-heatmap', name: 'Heatmap — intensity grid', tier: 'standard', cat: 'Charts', note: 'A matrix where tint carries the value; labels stay outside the cells.', layout: 'content',
  vals: Object.fromEntries([['Email', [10, 15, 10, 20, 35]], ['Events', [20, 30, 25, 40, 60]], ['Payments', [50, 55, 60, 70, 95]]]
    .flatMap(([row, ns], r) => ns.map((n, c) => [`r${r + 1}c${c + 1}`, { range: [0, 1e9], sample: n, of: `${row} · ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][c]} (row ${r + 1}, column ${c + 1}; tint is its share of the largest cell)` }]))),
  els: v => { const ns = Object.keys(v).map(k => v[k]), top = Math.max(...ns) || 1;
    return [ { slot: 'supertitle', text: 'Retries' }, { slot: 'title', text: 'Fridays and the payments API.' },
    ...['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => lab(280 + i * 116, 176, 100, d, { align: 'center', nowrap: 1 })),
    ...['Email', 'Events', 'Payments']
      .flatMap((row, i) => { const y = 200 + i * 74;
        return [ body(M, y + 20, 200, row), ...[1, 2, 3, 4, 5].map((c, j) => rect(280 + j * 116, y, 100, 62, { bg: S1, op: Math.round(95 * v[`r${i + 1}c${c}`] / top) / 100, radius: 4 })) ]; }),
    ...[0.15, 0.5, 0.95].map((n, i) => rect(720 + i * 30, 440, 26, 12, { bg: S1, op: n })),
    lab(600, 438, 100, 'low', { align: 'right', nowrap: 1 }), lab(820, 438, 80, 'high', { nowrap: 1 }) ]; } },

// b1..b10: the ten bins' counts, the tallest at 197px; median: its place on the axis in bins from the left edge (its bin is lit)
{ id: 'chart-histogram', name: 'Distribution — histogram', tier: 'standard', cat: 'Charts', note: 'Shape of a population, with the median called out. Kills the average.', layout: 'content',
  vals: { ...Object.fromEntries([8, 22, 41, 58, 44, 30, 19, 12, 7, 4].map((n, i) => [`b${i + 1}`, { range: [0, 1e9], sample: n, of: `bin ${i + 1}'s count (the tallest bin draws full height)` }])),
    median: { range: [0, 10], sample: 3.82, of: 'the median line, in bins from the left edge (3.5 is the middle of bin 4); its bin is lit' } },
  els: v => { const ns = Array.from({ length: 10 }, (_, i) => v[`b${i + 1}`]), top = Math.max(...ns) || 1, lit = Math.min(9, Math.floor(v.median)), mx = Math.round(220 + v.median * 68);
    return [ { slot: 'supertitle', text: 'Deal size' }, { slot: 'title', text: 'The average deal does not exist.' },
    ...ns.map((n, i) => rect(220 + i * 68, 400 - n * 197.2 / top, 64, n * 197.2 / top, { bg: i === lit ? S1 : S3 })),
    rule(210, 400, 910),
    { x: mx, y: 180, line: [mx, 400], h: 2, bg: 'var(--fg)', dash: [6, 5] },
    lab(mx + 12, 184, 140, 'median $54K', { nowrap: 1 }),
    ...['10', '50', '90', '130'].map((k, i) => lab(190 + i * 204, 412, 80, `$${k}K`, { align: 'center', nowrap: 1 })) ]; } },

// each line runs from `from` (Q2) to `value` (Q3) on one scale from zero; the biggest riser is lit
{ id: 'chart-slope', name: 'Slope chart — two points, many lines', tier: 'fringe', cat: 'Charts', note: 'Rank or level at two dates; crossing lines are the whole message.', layout: 'content',
  vals: { data: { kind: 'data', mark: 'line', of: 'three lines — [{label, from, value, text?}]: from is the left date, value the right; text prints at the right end in place of value',
    check: d => [...exactly(3, 'the slope chart')(d), ...fields(d, ['from', 'value'])],
    sample: [['Paid', 44, 31], ['Direct', 30, 44], ['Referral', 26, 25]].map(([label, from, value]) => ({ label, from, value, text: `${value}% of volume` })) } },
  els: v => { const top = Math.max(...v.data.flatMap(p => [p.from, p.value])) || 1, Y = n => Math.round(400 - 190 * n / top);
    const rise = v.data.map(p => p.value - p.from), lit = rise.indexOf(Math.max(...rise));
    return [ { slot: 'supertitle', text: 'Channel mix' }, { slot: 'title', text: 'Direct overtook paid in one quarter.' },
    vrule(340, 190, 400), vrule(700, 190, 400),
    lab(280, 168, 120, 'Q2', { align: 'center', nowrap: 1 }), lab(640, 168, 120, 'Q3', { align: 'center', nowrap: 1 }),
    ...v.data.flatMap((p, i) => { const tone = i === lit ? S1 : S3, y1 = Y(p.from), y2 = Y(p.value);
      return [ { x: 340, y: y1, line: [700, y2], h: 2.5, bg: tone }, dot(340, y1, 10, { bg: tone }), dot(700, y2, 10, { bg: tone }),
        lab(180, y1 - 7, 140, p.label, { align: 'right', nowrap: 1, color: tone }),
        lab(720, y2 - 7, 160, p.text ?? String(p.value), { nowrap: 1, ...(i === lit ? { color: S1 } : {}) }) ]; }) ]; } },

// today (value) and target on one axis from zero, the largest of either at 760; the gap prints signed, the widest is lit
{ id: 'chart-dumbbell', name: 'Dumbbell — gap between two states', tier: 'fringe', cat: 'Charts', note: 'The distance is the point; two dots and a connector say it faster than bars.', layout: 'content',
  vals: { data: { kind: 'data', mark: 'bar', of: 'four rows — [{label, value, target}]: value is today (grey dot), target the accent dot; the gap prints as target − value',
    check: d => [...exactly(4, 'the dumbbell')(d), ...fields(d, ['value', 'target'])],
    sample: [['Install time', 5, 60], ['Accuracy', 85, 105], ['Renewals', 25, 120], ['Support SLA', 90, 110]].map(([label, value, target]) => ({ label, value, target })) } },
  els: v => { const top = Math.max(...v.data.flatMap(p => [p.value, p.target])) || 1, X = n => Math.round(280 + 480 * n / top);
    const gaps = v.data.map(p => Math.abs(p.target - p.value)), lit = gaps.indexOf(Math.max(...gaps));
    return [ { slot: 'supertitle', text: 'Target vs actual' }, { slot: 'title', text: 'Four gaps, one that matters.' },
    ...v.data.flatMap((p, i) => { const y = 190 + i * 62, a = X(p.value), b = X(p.target);
        return [ body(M, y - 7, 210, p.label), { x: a, y, line: [b, y], h: 3, bg: 'var(--line)' },
          dot(a, y, 14, { bg: S3 }), dot(b, y, 14, { bg: S1 }),
          lab(Math.max(a, b) + 16, y - 7, 80, signed(p.target - p.value), { nowrap: 1, color: i === lit ? S1 : 'var(--muted)' }) ]; }),
    ...['Today', 'Target'].flatMap((k, i) => [ dot(M + 8 + i * 110, 452, 12, { bg: i ? S1 : S3 }), lab(M + 22 + i * 110, 445, 80, k, { nowrap: 1 }) ]) ]; } },   // the label box ends before the next dot

// p1..p6: four bars a panel, every panel on ONE scale (the tallest bar of all six fills 74px) — the comparison is the point
{ id: 'chart-small-multiples', name: 'Small multiples — six panels', tier: 'fringe', cat: 'Charts', note: 'Same axis, six times. The comparison a single crowded chart cannot make.', layout: 'content',
  vals: Object.fromEntries([['Northeast', [30, 44, 58, 74]], ['Southeast', [50, 46, 44, 41]], ['Midwest', [38, 40, 39, 42]],
      ['Southwest', [44, 41, 43, 40]], ['Mountain', [26, 28, 27, 30]], ['Pacific', [48, 50, 47, 49]]]
    .map(([k, ns], i) => [`p${i + 1}`, { kind: 'data', mark: 'bar', check: exactly(4, `panel ${i + 1}`), of: `${k} · four bars [{label, value}] (labels name the periods; not drawn)${i === 0 ? ' — the lit panel' : ''}`,
      sample: ns.map((value, j) => ({ label: `Q${j + 1}`, value })) }])),
  els: v => { const P = [1, 2, 3, 4, 5, 6].map(i => v['p' + i].map(p => p.value)), top = Math.max(...P.flat()) || 1;
    return [ { slot: 'supertitle', text: 'By region' }, { slot: 'title', text: 'One shape repeats; the Northeast does not.' },
    ...['Northeast', 'Southeast', 'Midwest', 'Southwest', 'Mountain', 'Pacific']
      .flatMap((k, i) => { const x = M + (i % 3) * 290, y = 180 + Math.floor(i / 3) * 130;
        return [ lab(x, y, 200, k, { nowrap: 1, color: i === 0 ? S1 : 'var(--muted)' }),
          ...P[i].map((n, j) => { const h = Math.round(n * 74 / top); return rect(x + j * 56, y + 96 - h, 44, h, { bg: i === 0 ? S1 : S3 }); }),
          rule(x, y + 96, x + 236) ]; }) ]; } },

// w1..w4: each column's size (its width is its share of 740px); c#s#: the column's mix, drawn as shares of the column
{ id: 'chart-marimekko', name: 'Marimekko — share within share', tier: 'fringe', cat: 'Charts', note: 'Column width is market size, segment height is mix. Two dimensions, one picture.', layout: 'content',
  vals: { ...Object.fromEntries([['Hotels', 3000], ['Restaurants', 2200], ['Caterers', 1300], ['Other', 900]]
      .map(([k, n], i) => [`w${i + 1}`, { range: [0, 1e9], sample: n, of: `${k} · deals (the column's width is its share of the four; the label under it prints this)` }])),
    ...mixVals([[52, 30, 18], [28, 42, 30], [70, 20, 10], [15, 25, 60]], ['Hotels', 'Restaurants', 'Caterers', 'Other'], ['us', 'second', 'the rest']) },
  els: v => { const ws = [1, 2, 3, 4].map(i => v['w' + i]), sum = ws.reduce((a, b) => a + b, 0) || 1;
    return [ { slot: 'supertitle', text: 'Market structure' }, { slot: 'title', text: 'Our share is best where the market is smallest.' },
    ...['Hotels', 'Restaurants', 'Caterers', 'Other']
      .reduce((acc, k, i) => { const x = acc.x, w = Math.round(740 * ws[i] / sum); let y = 190;
        shares(v, i + 1).forEach((p, j) => { const h = Math.round(p * 2.0); acc.els.push(rect(x, y, w - 6, h, { bg: [S1, S2, S3][j] }));
          // every segment keeps its label row (the text keys never shift); a segment too thin for it prints nothing
          acc.els.push(lab(x, y + h / 2 - 7, w - 6, h > 26 ? `${Math.round(p)}%` : '', { align: 'center', nowrap: 1, color: j === 0 ? 'var(--card)' : 'var(--fg)' })); y += h; });
        acc.els.push(lab(x, 404, w - 6, k, { align: 'center', nowrap: 1 }));
        acc.els.push(lab(x, 424, w - 6, `${ws[i]} deals`, { align: 'center', nowrap: 1, color: 'var(--muted)' }));
        acc.x += w; return acc; }, { x: 160, els: [] }).els ]; } },

// six causes, largest first (the tallest fills 210px); the running total rides above, and the causes before it reaches 80% are lit
{ id: 'chart-pareto', name: 'Pareto — bars plus cumulative line', tier: 'fringe', cat: 'Charts', note: 'Sorted bars with the running total on top; where it crosses 80% is the answer.', layout: 'content',
  vals: { data: { kind: 'data', mark: 'bar', of: 'six causes, largest first — [{label, value}]; the cumulative line is their running share of the total',
    check: d => { const e = [...exactly(6, 'the pareto')(d), ...fields(d, ['value'])]; if (e.length) return e;
      return d.some((p, i) => i && p.value > d[i - 1].value) ? ['pareto bars go largest first — sort data by value, descending'] : !d.some(p => p.value > 0) ? ['pareto needs a count above zero'] : []; },
    sample: [['Amount', 42], ['Reference', 26], ['Duplicate', 14], ['Currency', 8], ['Timing', 6], ['Other', 4]].map(([label, value]) => ({ label, value })) } },
  els: v => { const ns = v.data.map(p => p.value), top = Math.max(...ns) || 1, sum = ns.reduce((a, b) => a + b, 0) || 1;
    const cum = ns.map((n, i) => ns.slice(0, i + 1).reduce((a, b) => a + b, 0) * 100 / sum), pts = cum.map((c, i) => [256 + i * 116, 240 - 1.1 * c]);
    return [ { slot: 'supertitle', text: 'Exceptions by cause' }, { slot: 'title', text: 'Three causes are eighty percent of the queue.' },
    ...ns.map((n, i) => { const h = Math.round(n * 210 / top); return rect(210 + i * 116, 400 - h, 92, h, { bg: (i ? cum[i - 1] : 0) < 80 ? 'var(--accent)' : 'var(--line)' }); }),
    rule(200, 400, 910),
    ...poly(pts, { bg: 'var(--fg)', h: 2 }),
    ...pts.map(([x, y]) => dot(x, y, 8, { bg: 'var(--fg)' })),
    { x: 200, y: 152, line: [910, 152], h: 1.5, bg: 'var(--accent)', dash: [5, 4] },   // 80% of the running total: 240 − 1.1 × 80
    lab(M, 145, 130, '80% line', { color: 'var(--accent)', nowrap: 1 }),
    ...v.data.map((p, i) => lab(200 + i * 116, 412, 112, p.label, { align: 'center', nowrap: 1 })) ]; } }
];
