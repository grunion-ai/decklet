import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols } from './kit.mjs';

export default [
{ id: 'two-by-two', name: '2×2 positioning matrix', tier: 'core', cat: 'Frameworks', note: 'Two labelled axes, four quadrant names, plotted players.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Landscape' }, { slot: 'title', text: 'Nobody is fast and broad at once.' },
    { x: 300, y: 430, line: [820, 430], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    { x: 300, y: 430, line: [300, 176], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    rule(560, 176, 560, { line: [560, 430], bg: 'var(--line)' }), rule(300, 303, 820, { line: [820, 303], bg: 'var(--line)' }),
    lab(310, 186, 230, 'Broad · slow'), lab(570, 186, 230, 'Broad · fast', { color: 'var(--accent)' }),
    lab(310, 405, 230, 'Narrow · slow'), lab(570, 405, 230, 'Narrow · fast'),
    lab(300, 452, 520, 'Delivery →'), lab(180, 176, 110, 'Selection ↑', { align: 'right' }),
    dot(390, 370, 14, { bg: 'var(--muted)' }), lab(410, 363, 140, 'Incumbent A', { nowrap: 1 }),
    dot(500, 248, 14, { bg: 'var(--muted)' }), lab(330, 241, 150, 'Incumbent B', { align: 'right', nowrap: 1 }),
    dot(720, 215, 18), lab(742, 208, 100, 'Us', { color: 'var(--accent)', nowrap: 1 }),
    body(M, 192, 200, 'Selection is supplier count; speed is median delivery time.', { color: 'var(--muted)' }) ] },   // under the axis label's line box

{ id: 'swot', name: 'SWOT — four quadrants', tier: 'core', cat: 'Frameworks', note: 'Four tinted quadrants, one line of copy each. No bullets.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Position' }, { slot: 'title', text: 'The honest square.' },
    ...[['Strengths', 'Battery life nobody matches.', 'var(--box)'], ['Weaknesses', 'One supplier makes the radio.', 'var(--card)'],
        ['Opportunities', 'Insurers want the same data.', 'var(--card)'], ['Threats', 'Incumbent bundles sensors free.', 'var(--box)']]
      .flatMap(([h, s, bgc], i) => { const x = M + (i % 2) * 432, y = 170 + Math.floor(i / 2) * 140;
        return [ rect(x, y, 408, 124, { bg: bgc, bd: '1px solid var(--line)', radius: 8 }),
          lab(x + 18, y + 18, 260, h, { color: 'var(--accent)' }), body(x + 18, y + 44, 372, s) ]; }) ] },

{ id: 'temple', name: 'Temple — roof, pillars, foundation', tier: 'standard', cat: 'Frameworks', note: 'A goal held up by three capabilities standing on one base.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Operating model' }, { slot: 'title', text: 'One goal, three pillars, one base.' },
    rect(M + 60, 168, CW - 120, 52, { bg: 'var(--accent)', radius: 6 }),
    t(M + 60, 184, CW - 120, 'H2', 'Ship every two weeks', { align: 'center', color: 'var(--card)', nowrap: 1 }),
    ...[['Plan', 'one backlog'], ['Build', 'small batches'], ['Measure', 'one dashboard']]
      .flatMap(([h, s], i) => { const x = M + 90 + i * 220; return [ rect(x, 240, 180, 130, { bg: 'var(--box)', bd: '1px solid var(--line)', radius: 6 }),
        t(x, 274, 180, 'H2', h, { align: 'center', nowrap: 1 }), cap(x + 12, 306, 156, s, { align: 'center' }) ]; }),
    rect(M + 60, 390, CW - 120, 46, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 6 }),
    lab(M + 60, 406, CW - 120, 'One team, one cadence', { align: 'center', nowrap: 1 }) ] },

{ id: 'venn-3', name: 'Venn — three overlapping sets', tier: 'standard', cat: 'Frameworks', note: 'Three tinted circles; the centre is the claim.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Why now' }, { slot: 'title', text: 'The overlap is the product.' },
    { x: 330, y: 168, w: 200, h: 200, radius: 100, bg: 'var(--accent)', op: 0.28 },
    { x: 460, y: 168, w: 200, h: 200, radius: 100, bg: 'var(--accent)', op: 0.28 },
    { x: 395, y: 262, w: 200, h: 200, radius: 100, bg: 'var(--accent)', op: 0.28 },
    lab(310, 140, 180, 'Open APIs', { align: 'center', nowrap: 1 }),   // 180 wide, centred on each circle: the two label boxes clear each other
    lab(500, 140, 180, 'Cheap compute', { align: 'center', nowrap: 1 }),
    lab(395, 470, 200, 'Buyer demand', { align: 'center', nowrap: 1 }),
    body(700, 200, 200, 'All three landed inside eighteen months. That window is the whole thesis.', { color: 'var(--muted)' }) ] },

{ id: 'pyramid-layers', name: 'Layer stack — narrowing hierarchy', tier: 'standard', cat: 'Frameworks', note: 'Four stacked bands, widest at the base — hierarchy without a triangle.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Stack' }, { slot: 'title', text: 'Everything rests on the reading.' },
    ...[['Alerts', 240, 'var(--accent)'], ['Signals', 400, 'var(--box)'], ['Clean readings', 560, 'var(--box)'], ['Raw sensor data', 720, 'var(--card)']]
      .flatMap(([lbl, w, bgc], i) => { const y = 176 + i * 66, x = M + 40 + (720 - w) / 2;
        return [ rect(x, y, w, 54, { bg: bgc, bd: '1px solid var(--line)', radius: 4 }),
          t(x, y + 16, w, 'H2', lbl, { align: 'center', nowrap: 1, color: i === 0 ? 'var(--card)' : 'var(--fg)' }) ]; }),
    lab(828, 190, 82, 'Acted on'), lab(828, 400, 82, 'Collected') ] },   // 8px off the base band's edge

{ id: 'value-chain', name: 'Value chain — end-to-end run', tier: 'standard', cat: 'Frameworks', note: 'Five stages left to right, each with the number that matters under it.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Pipeline' }, { slot: 'title', text: 'Where an order goes.' },
    ...['Order', 'Confirm', 'Pick', 'Deliver', 'Invoice'].flatMap((s, i) => { const x = M + i * 172;
      const r = [ rect(x, 210, 148, 72, { bg: i === 4 ? 'var(--accent)' : 'var(--box)', bd: '1px solid var(--line)', radius: 6 }),
        t(x, 234, 148, 'H2', s, { align: 'center', nowrap: 1, color: i === 4 ? 'var(--card)' : 'var(--fg)' }),
        lab(x, 296, 148, ['2 min', '1 hr', '4 hrs', '18 hrs', 'same day'][i], { align: 'center', nowrap: 1 }) ];
      if (i < 4) r.push({ x: x + 148, y: 246, line: [x + 172, 246], h: 2.5, bg: 'var(--fg)', arrow: 'end', gap: 0 });
      return r; }),
    rule(M, 350, W - M), lab(M, 364, 400, 'Median end to end · 1 business day') ] },
];
