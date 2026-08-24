import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols } from './kit.mjs';

export default [
{ id: 'cover-hero', name: 'Cover — rule + kicker', tier: 'core', cat: 'Narrative', note: 'Accent rule, kicker, display headline, one line of context.', layout: 'title',
  els: [ rect(M, 210, 64, 3, { bg: 'var(--accent)' }),
    { slot: 'supertitle', text: 'Quarterly review' }, { slot: 'title', text: 'Growth held. Cost did not.' },
    body(M, 358, 620, 'What moved this quarter, what it cost, and the two decisions we need from you.', { color: 'var(--muted)' }),
    lab(M, 424, 400, 'August 2026 · Prepared for the board') ] },

{ id: 'cover-split', name: 'Cover — split panel', tier: 'core', cat: 'Narrative', note: 'Half-canvas colour field carries the mark; type sits on the light half.', layout: null,
  els: [ rect(0, 0, 360, 540, { bg: 'var(--accent)' }), lab(48, 60, 264, 'Undersight', { color: 'var(--card)' }),
    lab(48, 440, 264, 'Confidential draft', { color: 'var(--card)', op: 0.7 }),
    t(420, 190, 480, 'Supertitle', 'Series A'), t(420, 218, 480, 'Title', 'The parsing layer.'),
    body(420, 372, 440, 'One number, one claim, one ask — in eleven slides.', { color: 'var(--muted)' }) ] },

{ id: 'section-numeral', name: 'Section — oversized numeral', tier: 'core', cat: 'Narrative', note: 'Chapter break: numeral, rule, section title.', layout: null,
  els: [ t(M, 170, 200, 'Title', '02'), rule(M, 268, W - M, { bg: 'var(--accent)', h: 2 }),
    t(M, 292, 640, 'H1', 'Where the money goes'), cap(M, 348, 520, 'Unit economics, channel by channel.') ] },

{ id: 'agenda-ruled', name: 'Agenda — ruled list', tier: 'core', cat: 'Narrative', note: 'Numbered rows on hairlines; the only list a deck needs.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Agenda' }, { slot: 'title', text: 'Four things, twenty minutes.' },
    ...[['01', 'Where we are', '4 min'], ['02', 'What broke', '6 min'], ['03', 'The fix', '6 min'], ['04', 'What we need', '4 min']]
      .flatMap(([n, txt, min], i) => { const y = 172 + i * 66; return [ lab(M, y + 6, 30, n, { color: 'var(--accent)' }),
        t(M + 60, y, 560, 'H2', txt), lab(W - M - 90, y + 6, 90, min, { align: 'right', nowrap: 1 }), rule(M, y + 48, W - M) ]; }) ] },

{ id: 'exec-summary', name: 'Executive summary — claim + three props', tier: 'core', cat: 'Narrative', note: 'One action title, one tinted claim strip, three supporting columns.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Summary' }, { slot: 'title', text: 'Renewals, not new logos, decide the year.' },
    rect(M, 150, CW, 74, { bg: 'var(--box)', radius: 8 }),
    body(M + 20, 172, CW - 40, 'Retention is worth 3.4× a new logo at current CAC — so the next two quarters buy back churn before they buy reach.'),
    ...cols(3).flatMap((c, i) => { const s = [['Churn', 'Down 2.1 pts since the onboarding rebuild.'], ['CAC', 'Up 18% — paid is the whole increase.'], ['Ask', 'Move two engineers onto retention for Q4.']][i];
      return [ lab(c.x, 262, c.w, s[0], { color: 'var(--accent)' }), rule(c.x, 282, c.x + c.w), body(c.x, 296, c.w, s[1]) ]; }) ] },

{ id: 'quote-pull', name: 'Quote — pulled', tier: 'core', cat: 'Narrative', note: 'Customer voice at display size, attribution beneath a short rule.', layout: null,
  els: [ t(M, 120, 100, 'Title', '“', { color: 'var(--accent)' }),
    t(M, 200, 780, 'H1', 'We stopped reconciling by hand in week two. That was the whole business case.', { italic: 1 }),
    rule(M, 372, M + 64, { bg: 'var(--accent)', h: 2 }), lab(M, 392, 500, 'Head of Ops · 40-truck fleet') ] },

{ id: 'statement', name: 'Statement — one sentence', tier: 'core', cat: 'Narrative', note: 'A single claim, centred, nothing else on the canvas.', layout: null,
  els: [ t(M, 196, CW, 'Title', 'Every deck is a spreadsheet that gave up.', { align: 'center' }),
    lab(M, 356, CW, 'the thesis', { align: 'center' }) ] },

{ id: 'closing-cta', name: 'Closing — live CTA', tier: 'core', cat: 'Narrative', note: 'Headline, painted button carrying a real href, contact line.', layout: null,
  els: [ t(M, 180, 640, 'Title', 'Ready when you are.'),
    rect(M, 320, 220, 52, { bg: 'var(--accent)', radius: 8, href: 'https://example.com' }),
    t(M, 336, 220, 'H2', 'Book the pilot', { align: 'center', color: 'var(--card)', href: 'https://example.com', nowrap: 1 }),
    cap(M + 250, 336, 380, 'or reply to this thread — we start on a Monday.') ] },
];
