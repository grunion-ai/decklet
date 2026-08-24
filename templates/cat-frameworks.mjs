import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols } from './kit.mjs';

export default [
{ id: 'two-by-two', name: '2×2 positioning matrix', tier: 'core', cat: 'Frameworks', note: 'Two labelled axes, four quadrant names, plotted players.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Landscape' }, { slot: 'title', text: 'Nobody is fast and broad at once.' },
    { x: 300, y: 430, line: [820, 430], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    { x: 300, y: 430, line: [300, 176], h: 2.5, bg: 'var(--fg)', arrow: 'end' },
    rule(560, 176, 560, { line: [560, 430], bg: 'var(--line)' }), rule(300, 303, 820, { line: [820, 303], bg: 'var(--line)' }),
    lab(310, 186, 230, 'Broad · slow'), lab(570, 186, 230, 'Broad · fast', { color: 'var(--accent)' }),
    lab(310, 405, 230, 'Narrow · slow'), lab(570, 405, 230, 'Narrow · fast'),
    lab(300, 452, 520, 'Turnaround →'), lab(180, 176, 110, 'Coverage ↑', { align: 'right' }),
    dot(390, 370, 14, { bg: 'var(--muted)' }), lab(410, 363, 140, 'Incumbent A', { nowrap: 1 }),
    dot(500, 248, 14, { bg: 'var(--muted)' }), lab(330, 241, 150, 'Incumbent B', { align: 'right', nowrap: 1 }),
    dot(720, 215, 18), lab(742, 208, 100, 'Us', { color: 'var(--accent)', nowrap: 1 }),
    body(M, 186, 200, 'Coverage is a format count; speed is median turnaround.', { color: 'var(--muted)' }) ] },

{ id: 'swot', name: 'SWOT — four quadrants', tier: 'core', cat: 'Frameworks', note: 'Four tinted quadrants, one line of copy each. No bullets.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Position' }, { slot: 'title', text: 'The honest square.' },
    ...[['Strengths', 'Format coverage nobody matches.', 'var(--box)'], ['Weaknesses', 'One engineer holds the parser.', 'var(--card)'],
        ['Opportunities', 'Brokers want the same file.', 'var(--card)'], ['Threats', 'Incumbent bundles it for free.', 'var(--box)']]
      .flatMap(([h, s, bgc], i) => { const x = M + (i % 2) * 432, y = 170 + Math.floor(i / 2) * 140;
        return [ rect(x, y, 408, 124, { bg: bgc, bd: '1px solid var(--line)', radius: 8 }),
          lab(x + 18, y + 18, 260, h, { color: 'var(--accent)' }), body(x + 18, y + 44, 372, s) ]; }) ] },

{ id: 'temple', name: 'Temple — roof, pillars, foundation', tier: 'standard', cat: 'Frameworks', note: 'A goal held up by three capabilities standing on one base.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Operating model' }, { slot: 'title', text: 'One goal, three pillars, one base.' },
    rect(M + 60, 168, CW - 120, 52, { bg: 'var(--accent)', radius: 6 }),
    t(M + 60, 184, CW - 120, 'H2', 'Underwrite in a day', { align: 'center', color: 'var(--card)', nowrap: 1 }),
    ...[['Parse', 'any statement'], ['Detect', 'the early signal'], ['Explain', 'the decision']]
      .flatMap(([h, s], i) => { const x = M + 90 + i * 220; return [ rect(x, 240, 180, 130, { bg: 'var(--box)', bd: '1px solid var(--line)', radius: 6 }),
        t(x, 274, 180, 'H2', h, { align: 'center', nowrap: 1 }), cap(x + 12, 306, 156, s, { align: 'center' }) ]; }),
    rect(M + 60, 390, CW - 120, 46, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 6 }),
    lab(M + 60, 406, CW - 120, 'One ledger of record', { align: 'center', nowrap: 1 }) ] },

{ id: 'venn-3', name: 'Venn — three overlapping sets', tier: 'standard', cat: 'Frameworks', note: 'Three tinted circles; the centre is the claim.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Why now' }, { slot: 'title', text: 'The overlap is the product.' },
    { x: 330, y: 168, w: 200, h: 200, radius: 100, bg: 'var(--accent)', op: 0.28 },
    { x: 460, y: 168, w: 200, h: 200, radius: 100, bg: 'var(--accent)', op: 0.28 },
    { x: 395, y: 262, w: 200, h: 200, radius: 100, bg: 'var(--accent)', op: 0.28 },
    lab(300, 140, 200, 'Regulation', { align: 'center', nowrap: 1 }),
    lab(490, 140, 200, 'Model cost', { align: 'center', nowrap: 1 }),
    lab(395, 470, 200, 'Broker demand', { align: 'center', nowrap: 1 }),
    body(700, 200, 200, 'All three landed inside eighteen months. That window is the whole thesis.', { color: 'var(--muted)' }) ] },

{ id: 'pyramid-layers', name: 'Layer stack — narrowing hierarchy', tier: 'standard', cat: 'Frameworks', note: 'Four stacked bands, widest at the base — hierarchy without a triangle.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Stack' }, { slot: 'title', text: 'Everything rests on the parse.' },
    ...[['Decision', 240, 'var(--accent)'], ['Signal', 400, 'var(--box)'], ['Normalised data', 560, 'var(--box)'], ['Raw statements', 720, 'var(--card)']]
      .flatMap(([lbl, w, bgc], i) => { const y = 176 + i * 66, x = M + 40 + (720 - w) / 2;
        return [ rect(x, y, w, 54, { bg: bgc, bd: '1px solid var(--line)', radius: 4 }),
          t(x, y + 16, w, 'H2', lbl, { align: 'center', nowrap: 1, color: i === 0 ? 'var(--card)' : 'var(--fg)' }) ]; }),
    lab(820, 190, 90, 'Decided'), lab(820, 400, 90, 'Ingested') ] },

{ id: 'logic-tree', name: 'Issue tree — MECE branches', tier: 'standard', cat: 'Frameworks', note: 'One question, orthogonal elbows, three mutually exclusive branches.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Diagnostic' }, { slot: 'title', text: 'Why did margin fall?' },
    { id: 'root', ...box(M, 265, 200, 76, 'H2', 'Margin −4 pts') },
    ...[0, 1, 2].map(i => ({ id: `br${i}`, ...box(520, 176 + i * 106, 340, 76, 'Body', ['Price held — volume mix moved to the low tier', 'Cost of parse rose with document length', 'Support hours doubled on two accounts'][i]) })),
    ...[0, 1, 2].flatMap(i => { const my = 214 + i * 106; return [
      { x: 300, y: my, line: [410, my], h: 2.5, bg: 'var(--line)' },
      { x: 410, y: my, line: [410, 303], h: 2.5, bg: 'var(--line)' } ]; }),
    { x: 280, y: 303, line: [410, 303], h: 2.5, bg: 'var(--line)' },
    ...[0, 1, 2].map(i => ({ x: 410, y: 214 + i * 106, line: [500, 214 + i * 106], h: 2.5, bg: 'var(--fg)', arrow: 'end', to: `br${i}` })) ] },

{ id: 'value-chain', name: 'Value chain — end-to-end run', tier: 'standard', cat: 'Frameworks', note: 'Five stages left to right, each with the number that matters under it.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Pipeline' }, { slot: 'title', text: 'Where a statement goes.' },
    ...['Intake', 'Parse', 'Normalise', 'Score', 'Decide'].flatMap((s, i) => { const x = M + i * 172;
      const r = [ rect(x, 210, 148, 72, { bg: i === 4 ? 'var(--accent)' : 'var(--box)', bd: '1px solid var(--line)', radius: 6 }),
        t(x, 234, 148, 'H2', s, { align: 'center', nowrap: 1, color: i === 4 ? 'var(--card)' : 'var(--fg)' }),
        lab(x, 296, 148, ['4 formats', '90 secs', '31 fields', '6 signals', '1 day'][i], { align: 'center', nowrap: 1 }) ];
      if (i < 4) r.push({ x: x + 148, y: 246, line: [x + 172, 246], h: 2.5, bg: 'var(--fg)', arrow: 'end', gap: 0 });
      return r; }),
    rule(M, 350, W - M), lab(M, 364, 400, 'Median end to end · 1 business day') ] },
];
