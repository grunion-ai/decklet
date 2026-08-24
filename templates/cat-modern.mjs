import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols, bars } from './kit.mjs';

const shot = (x, y, w, h, extra = {}) => rect(x, y, w, h, { bg: 'linear-gradient(135deg,var(--box),var(--line))', radius: 10, ...extra });

export default [
{ id: 'bento-grid', name: 'Bento grid — mixed tile sizes', tier: 'standard', cat: 'Modern', note: 'One hero cell, satellites around it. Dense without reading as clutter.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'At a glance' }, { slot: 'title', text: 'The quarter in one frame.' },
    rect(M, 168, 420, 268, { bg: 'var(--box)', radius: 12 }),
    lab(M + 22, 190, 200, 'Revenue'), t(M + 22, 214, 380, 'Title', '$86K', { color: 'var(--accent)' }),
    ...bars([62, 71, 78, 92], { x0: M + 22, span: 376, base: 410, bw: 76, gut: 24, labels: null, fmt: () => '' }).filter(r => !r.text),
    rect(510, 168, 190, 128, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 12 }),
    lab(528, 186, 150, 'Churn'), t(528, 210, 150, 'Stat', '2.4%'),
    rect(716, 168, 184, 128, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 12 }),
    lab(734, 186, 150, 'NPS'), t(734, 210, 150, 'Stat', '46'),
    rect(510, 308, 390, 128, { bg: 'var(--accent)', radius: 12 }),
    lab(530, 326, 300, 'What we do next', { color: 'var(--card)' }),
    body(530, 350, 350, 'Two engineers move to retention for Q4.', { color: 'var(--card)' }) ] },

{ id: 'image-hero-overlay', name: 'Full-bleed image with overlay', tier: 'core', cat: 'Modern', note: 'Image fills the canvas, a scrim carries the type. Swap the placeholder for img.', layout: null,
  els: [ shot(0, 0, 960, 540, { radius: 0 }), rect(0, 300, 960, 240, { bg: 'linear-gradient(transparent,rgba(0,0,0,.72))' }),
    lab(M, 360, 400, 'Field report', { color: '#fff' }),
    t(M, 386, 'auto', 'Title', 'Ninety seconds a packet.', { color: '#fff', nowrap: 1 }),
    cap(M, 470, 520, 'Kessler Capital · Newark, NJ', { color: 'rgba(255,255,255,.75)' }) ] },

{ id: 'image-split', name: 'Split — image half, argument half', tier: 'core', cat: 'Modern', note: 'The one image layout that never fights the type.', layout: null,
  els: [ shot(520, 0, 440, 540, { radius: 0 }),
    lab(M, 150, 300, 'The product'), t(M, 176, 400, 'H1', 'One screen, every statement.'),
    body(M, 268, 400, 'Brokers drop a packet and get graded terms back before the call ends. Nothing to install.'),
    rect(M, 372, 180, 46, { bg: 'var(--accent)', radius: 8, href: 'https://example.com' }),
    lab(M, 386, 180, 'See it run', { align: 'center', color: 'var(--card)', href: 'https://example.com', nowrap: 1 }) ] },

{ id: 'annotated-shot', name: 'Annotated screenshot — leaders', tier: 'standard', cat: 'Modern', note: 'Callouts pinned to a screenshot with hairline leaders. Sells software fast.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'The screen' }, { slot: 'title', text: 'Three things a reviewer actually touches.' },
    { id: 'ui', ...shot(M, 170, 520, 270) },
    ...[[0, 'Flagged fields only', 210], [1, 'Confidence per row', 300], [2, 'One-click terms', 390]]
      .flatMap(([i, txt, y]) => [ { id: `c${i}`, ...rect(660, y - 18, 240, 56, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8 }) },
        body(676, y - 6, 208, txt), { x: 590, y: y + 10, line: [650, y + 10], h: 1, bg: 'var(--line)' },
        dot(M + 120 + i * 130, y + 10, 10) ]) ] },

{ id: 'three-up-cards', name: 'Three cards — parallel points', tier: 'core', cat: 'Modern', note: 'Three equal cards, a rule under each heading. The safest three-idea slide.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'What you get' }, { slot: 'title', text: 'Three things, priced as one.' },
    ...cols(3).flatMap((c, i) => { const s = [['Parse', 'Thirty-one formats, ninety seconds, no template setup.'],
        ['Monitor', 'Three weeks of early warning before a default shows up in the ledger.'],
        ['Explain', 'Every decision traces back to the line on the statement.']][i];
      return [ rect(c.x, 168, c.w, 240, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 10 }),
        lab(c.x + 20, 190, 60, `0${i + 1}`, { color: 'var(--accent)' }),
        t(c.x + 20, 216, c.w - 40, 'H2', s[0]), rule(c.x + 20, 254, c.x + c.w - 20),
        body(c.x + 20, 270, c.w - 40, s[1]) ]; }) ] },

{ id: 'dashboard-composite', name: 'Dashboard — KPIs, chart, takeaways', tier: 'standard', cat: 'Modern', note: 'Numbers on top, evidence in the middle, the so-what pinned at the bottom.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Monthly review' }, { slot: 'title', text: 'Everything the operator checks.' },
    ...cols(4, CW, 16).flatMap((c, i) => { const s = [['$86K', 'MRR'], ['2.4%', 'Churn'], ['$412', 'CAC'], ['46', 'NPS']][i];
      return [ rect(c.x, 160, c.w, 74, { bg: 'var(--box)', radius: 8 }), t(c.x + 14, 172, c.w - 28, 'Stat', s[0]), lab(c.x + 14, 212, c.w - 28, s[1], { nowrap: 1 }) ]; }),
    ...bars([62, 71, 78, 92], { x0: M, span: 500, base: 430, bw: 104, gut: 28, labels: ['Q1', 'Q2', 'Q3', 'Q4'], fmt: v => `$${v}K` }),
    rect(600, 262, 300, 168, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8 }),
    lab(620, 282, 200, 'Read', { color: 'var(--accent)' }),
    body(620, 308, 260, 'Growth is real but CAC is eating it. Retention work starts before more spend.') ] },

{ id: 'table-insight', name: 'Table + insight panel', tier: 'standard', cat: 'Modern', note: 'Data on the left, the conclusion boxed on the right. Opens an analysis section.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Cohorts' }, { slot: 'title', text: 'The 2025 cohort still pays best.' },
    ...['Cohort', 'Accounts', 'Retained', 'ARPA'].map((h, i) => lab([M, 210, 320, 430][i], 170, [140, 100, 100, 100][i], h)),
    rule(M, 194, 560, { bg: 'var(--fg)', h: 2 }),
    ...[['2023', '38', '61%', '$310'], ['2024', '64', '72%', '$342'], ['2025', '91', '84%', '$401'], ['2026', '46', '—', '$388']]
      .flatMap((r, i) => { const y = 208 + i * 42;
        return [ ...r.map((cell, j) => t([M, 210, 320, 430][j], y + 10, [140, 100, 100, 100][j], j === 0 ? 'Body' : 'Label', cell, { nowrap: 1, weight: i === 2 ? 700 : undefined })), rule(M, y + 42, 560) ]; }),
    rect(600, 168, 300, 250, { bg: 'var(--box)', radius: 10 }),
    lab(620, 190, 240, 'So what', { color: 'var(--accent)' }),
    body(620, 216, 260, 'Retention improved every year the onboarding changed. The 2026 read lands in November.'),
    rule(620, 330, 880), lab(620, 346, 260, 'Next check · 12 Nov') ] },

{ id: 'proof-strip', name: 'Proof strip — logos and one number', tier: 'standard', cat: 'Modern', note: 'Social proof without a wall of logos: five marks, one claim.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Who runs on it' }, { slot: 'title', text: 'Five funders, forty thousand packets.' },
    ...[0, 1, 2, 3, 4].map(i => rect(M + i * 172, 200, 148, 64, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8 })),
    ...[0, 1, 2, 3, 4].map(i => lab(M + i * 172, 224, 148, ['Kessler', 'Northbridge', 'Vantage', 'Harbor', 'Trine'][i], { align: 'center', nowrap: 1 })),
    rule(M, 310, W - M),
    ...cols(3).flatMap((c, i) => { const s = [['41,200', 'packets parsed'], ['99.1%', 'field accuracy'], ['0', 'templates configured']][i];
      return [ t(c.x, 336, c.w, 'Stat', s[0]), lab(c.x, 386, c.w, s[1], { nowrap: 1 }) ]; }) ] },

{ id: 'team-grid', name: 'Team — faces and one line each', tier: 'standard', cat: 'Modern', note: 'Four people, one credential each. Never a paragraph of bio.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Who you work with' }, { slot: 'title', text: 'Four people, forty years of underwriting.' },
    ...cols(4, CW, 20).flatMap((c, i) => { const s = [['A. Rivera', 'Ex-head of credit, 12 yrs'], ['Kyle A.', 'Built the parser'], ['Roshan M.', 'Forward-deployed'], ['Dana P.', 'Ops, ex-Kessler']][i];
      return [ rect(c.x, 172, c.w, c.w, { bg: 'linear-gradient(140deg,var(--box),var(--line))', radius: 10 }),
        t(c.x, 372, c.w, 'H2', s[0], { nowrap: 1 }), cap(c.x, 404, c.w, s[1]) ]; }) ] },
];
