import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols } from './kit.mjs';

export default [
{ id: 'process-flow-4', name: 'Process flow — four boxes', tier: 'core', cat: 'Process', note: 'Linear steps with real arrow heads stopped on the border.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'How it runs' }, { slot: 'title', text: 'Four steps, one business day.' },
    ...[['Upload', 'Broker drops the packet'], ['Parse', 'Every page, every format'], ['Review', 'Only the flagged fields'], ['Decide', 'Signed terms out']]
      .flatMap(([h, s], i) => { const x = M + i * 212; const r = [
        { id: `st${i}`, ...rect(x, 200, 180, 132, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8 }) },
        lab(x + 16, 216, 60, `0${i + 1}`, { color: 'var(--accent)' }),
        t(x + 16, 240, 148, 'H2', h), cap(x + 16, 274, 148, s) ];
        if (i < 3) r.push({ x: x + 180, y: 266, line: [x + 212, 266], h: 2.5, bg: 'var(--fg)', arrow: 'end', to: `st${i + 1}`, gap: 6 });
        return r; }),
    rule(M, 386, W - M), lab(M, 400, 500, 'Human touches step three only') ] },

{ id: 'timeline-horizontal', name: 'Timeline — milestones on a spine', tier: 'core', cat: 'Process', note: 'One spine, dated dots, labels alternating above and below.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Plan' }, { slot: 'title', text: 'Pilot to production in five months.' },
    { x: M, y: 300, line: [W - M, 300], h: 2, bg: 'var(--line)' },
    ...[['Sep', 'Pilot signed'], ['Oct', 'Data live'], ['Nov', 'First decisions'], ['Dec', 'Broker portal'], ['Jan', 'Production']]
      .flatMap(([mo, ev], i) => { const x = M + 100 + i * 175, up = i % 2 === 0;
        return [ dot(x, 300, 14, { bg: i === 4 ? 'var(--accent)' : 'var(--fg)' }),
          { x, y: up ? 262 : 310, line: [x, up ? 292 : 338], h: 1, bg: 'var(--line)' },
          lab(x - 80, up ? 222 : 344, 160, mo, { align: 'center', nowrap: 1, color: 'var(--accent)' }),
          t(x - 80, up ? 238 : 360, 160, 'Body', ev, { align: 'center', nowrap: 1 }) ]; }) ] },

{ id: 'gantt-lanes', name: 'Gantt — swimlanes', tier: 'core', cat: 'Process', note: 'Three lanes, bars on a month grid, one hairline for today.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Schedule' }, { slot: 'title', text: 'Two workstreams overlap in November.' },
    ...['Sep', 'Oct', 'Nov', 'Dec', 'Jan'].map((mo, i) => lab(300 + i * 120, 168, 120, mo, { align: 'center', nowrap: 1 })),
    ...[0, 1, 2, 3, 4, 5].map(i => ({ x: 300 + i * 120, y: 190, line: [300 + i * 120, 400], h: 1, bg: 'var(--line)' })),
    ...[['Parsing', 0, 3, 'var(--accent)'], ['Portal', 2, 2, 'var(--muted)'], ['Rollout', 3, 2, 'var(--accent)']]
      .flatMap(([lane, start, span, tone], i) => { const y = 216 + i * 64;
        return [ body(M, y + 6, 220, lane), rect(300 + start * 120 + 8, y, span * 120 - 16, 34, { bg: tone, radius: 6 }),
          rule(M, y + 52, W - M) ]; }),
    { x: 660, y: 190, line: [660, 400], h: 2, bg: 'var(--fg)', dash: [6, 5] }, lab(668, 194, 90, 'today', { nowrap: 1 }) ] },

{ id: 'vertical-steps', name: 'Vertical steps — numbered rail', tier: 'core', cat: 'Process', note: 'A rail with numbered stops; reads top to bottom like a checklist.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Next' }, { slot: 'title', text: 'What happens after you sign.' },
    ...[0, 1, 2].map(i => ({ x: M + 17, y: 208 + i * 82, line: [M + 17, 258 + i * 82], h: 2, bg: 'var(--line)' })),
    ...[['Kickoff', 'Two people, ninety minutes.'], ['Connect', 'Read-only access to the folder.'], ['Calibrate', 'We tune to your grading.'], ['Go live', 'Decisions inside the same week.']]
      .flatMap(([h, s], i) => { const y = 178 + i * 82;
        return [ tile(M + 4, y - 2, 26, 26, 'Label', `${i + 1}`, { radius: 13, bg: 'var(--accent)', bd: 'none', color: 'var(--card)', nowrap: 1 }),
          t(M + 56, y - 4, 400, 'H2', h), cap(M + 56, y + 28, 500, s) ]; }) ] },

{ id: 'cycle-loop', name: 'Cycle — four-stage loop', tier: 'standard', cat: 'Process', note: 'Four nodes, four curved arrows, no beginning. For anything iterative.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Operating loop' }, { slot: 'title', text: 'It never stops on a slide either.' },
    { id: 'n0', ...box(395, 160, 170, 62, 'H2', 'Ingest') },
    { id: 'n1', ...box(680, 272, 170, 62, 'H2', 'Score') },
    { id: 'n2', ...box(395, 384, 170, 62, 'H2', 'Decide') },
    { id: 'n3', ...box(110, 272, 170, 62, 'H2', 'Learn') },
    { x: 573, y: 191, curve: [700, 191, 765, 210, 765, 266], h: 2.5, bg: 'var(--accent)', arrow: 'end', to: 'n1' },
    { x: 765, y: 340, curve: [765, 396, 700, 415, 573, 415], h: 2.5, bg: 'var(--accent)', arrow: 'end', to: 'n2' },
    { x: 387, y: 415, curve: [260, 415, 195, 396, 195, 340], h: 2.5, bg: 'var(--accent)', arrow: 'end', to: 'n3' },
    { x: 195, y: 266, curve: [195, 210, 260, 191, 387, 191], h: 2.5, bg: 'var(--accent)', arrow: 'end', to: 'n0' },
    body(M, 470, 400, 'Every decision feeds the next parse.', { color: 'var(--muted)' }) ] },

{ id: 'funnel-stages', name: 'Funnel — narrowing stages', tier: 'core', cat: 'Process', note: 'Centred bands that shrink, with the drop-off named on the right.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Conversion' }, { slot: 'title', text: 'The leak is between submit and decision.' },
    ...[['Submissions', 620, '1,240'], ['Parsed clean', 500, '1,190'], ['Underwritten', 300, '640'], ['Funded', 180, '210']]
      .flatMap(([lbl, w, v], i) => { const y = 176 + i * 66, x = 300 + (620 - w) / 2;
        return [ rect(x, y, w, 52, { bg: i === 3 ? 'var(--accent)' : 'var(--box)', bd: '1px solid var(--line)', radius: 4 }),
          t(x, y + 14, w, 'H2', v, { align: 'center', nowrap: 1, color: i === 3 ? 'var(--card)' : 'var(--fg)' }),
          lab(M, y + 18, 220, lbl, { nowrap: 1 }) ]; }),
    lab(760, 300, 140, '−46% here', { color: 'var(--accent)', nowrap: 1 }) ] },
];
