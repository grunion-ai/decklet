import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols } from './kit.mjs';
import { initials } from '../assets.mjs';

// exec-summary's three camps: head, the logos a column names (fictional; the sample draws their monogram chips), one line
const CAMPS = [['Incumbents', ['Northwind', 'Halcyon', 'Meridian', 'Oakline'], 'Own the files and the seats; none checks a part while it is drawn.'],
  ['Challengers', ['Tallyline', 'Relay', 'Fieldsense', 'Stride'], 'Built on AI-first design tools; manufacturing checks are still planned.'],
  ['Marketplaces', ['Forage', 'Castellan', 'Brightmoor'], 'Check parts at upload, after the design is done.']];

// Sample copy speaks for fictional companies (Tallyline, Fieldsense, Stride, Meridian Partners, Forage, Relay) so a
// buyer pictures swapping it for their own. No real company, no client residue.
export default [
{ id: 'cover-hero', textOnly: true, name: 'Cover — rule + kicker', tier: 'core', cat: 'Narrative', note: 'Accent rule, kicker, display headline, one line of context.', layout: 'title',
  els: [ rect(M, 210, 64, 3, { bg: 'var(--accent)' }),
    { slot: 'supertitle', text: 'Board update' }, { slot: 'title', text: 'Growth held. Burn did not.' },
    body(M, 358, 620, 'What moved this quarter, what it cost, and the two decisions we need from the board.', { color: 'var(--muted)' }),
    lab(M, 424, 400, 'Q3 2026 · Tallyline board pack') ] },

{ id: 'cover-split', textOnly: true, name: 'Cover — split panel', tier: 'core', cat: 'Narrative', note: 'Half-canvas colour field carries the mark; type sits on the light half.', layout: null,
  els: [ rect(0, 0, 360, 540, { bg: 'var(--accent)' }), lab(48, 60, 264, 'Fieldsense', { color: 'var(--card)' }),
    lab(48, 440, 264, 'Confidential draft', { color: 'var(--card)', op: 0.7 }),
    t(420, 190, 480, 'Supertitle', 'Seed round'), t(420, 218, 480, 'Title', 'Sensors for the field.'),
    body(420, 372, 440, 'One device, one number, one ask, in ten slides.', { color: 'var(--muted)' }) ] },

{ id: 'section-numeral', textOnly: true, name: 'Section — oversized numeral', tier: 'core', cat: 'Narrative', note: 'Chapter break: numeral, rule, section title.', layout: null,
  els: [ t(M, 170, 200, 'Title', '02'), rule(M, 268, W - M, { bg: 'var(--accent)', h: 2 }),
    t(M, 292, 640, 'H1', 'Where the margin goes'), cap(M, 348, 520, 'Take rate, category by category.') ] },

{ id: 'agenda-ruled', textOnly: true, name: 'Agenda — ruled list', tier: 'core', cat: 'Narrative', note: 'Numbered rows on hairlines; the only list a deck needs.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Agenda' }, { slot: 'title', text: 'Four things, twenty minutes.' },
    ...[['01', 'Where we are', '4 min'], ['02', 'What shipped', '6 min'], ['03', 'What broke', '6 min'], ['04', 'What we need', '4 min']]
      .flatMap(([n, txt, min], i) => { const y = 172 + i * 66; return [ lab(M, y + 6, 30, n, { color: 'var(--accent)' }),
        t(M + 60, y, 560, 'H2', txt, { item: 1 }), lab(W - M - 90, y + 6, 90, min, { align: 'right', nowrap: 1 }), rule(M, y + 48, W - M) ]; }) ] },

// the plainest content slide in any deck, and the one the library was missing: a title and five points on the `bullets` layout,
// a dot per bound bullet drawn by the engine. Ships at reading density (subtitle · note · source bound); bind three or fewer
// bullets and drop the dense chrome and the same layout is a speaker slide.
{ id: 'bullet-page', textOnly: true, name: 'Bullets — title and points', tier: 'core', cat: 'Narrative', note: 'A title and four to six points, one line each, an engine-drawn dot per point.', layout: 'bullets',
  els: [ { slot: 'supertitle', text: 'What ships' }, { slot: 'title', text: 'Everything in the box, and nothing else to buy.' },
    { slot: 'subtitle', text: 'One gateway a site, one probe a field, no wiring and no monthly fee.' },
    { slot: 'b1', text: 'Six soil probes, calibrated at the factory, two seasons to a battery.' },
    { slot: 'b2', text: 'One gateway on the only power outlet, covering forty hectares.' },
    { slot: 'b3', text: 'A reading every fifteen minutes, held a week when the link drops.' },
    { slot: 'b4', text: 'Frost and irrigation alerts by text, set per field from the browser.' },
    { slot: 'b5', text: 'Mounting stakes, a spare battery and the season calibration card.' },
    { slot: 'note', text: 'The dashboard is included for the life of the gateway; nothing here is a subscription.' },
    { slot: 'source', text: 'Source · Fieldsense hardware spec, September 2026' } ] },

// K19: Kyle rejected this slide twice as words with nothing to look at. Each prop draws its before/after pair on its own
// scale (the kit's `pair`, the same mark the stat rows use): three props are three measured moves, so the graphic sits in
// the column it proves and the eye reads the change before the sentence. kind: 'summary' holds it to the reading cap.
// K22 replaced the pairs: their numbers were the sample's, with no fill key, so v4's agent hand-built the slide. A summary
// names who each finding is about far more often than it has a measured before/after per column (the numbers have their
// own slides: stat-row-*, delta-pair), and v4's hand-built logo groups were the version Kyle rated strong. So each column
// draws a group of up to four logos from its value key l1…l3 — no number to invent. A column left out drops its group and
// its line moves up under the rule.
{ id: 'exec-summary', kind: 'summary', name: 'Executive summary — claim + three logo groups', tier: 'core', cat: 'Narrative', note: 'One action title, one tinted claim strip, three columns each naming its players with a group of up to four logos.', layout: 'content',
  vals: Object.fromEntries(CAMPS.map(([k, names], i) => [`l${i + 1}`, { kind: 'logos', optional: true, unset: null, sample: names.map(alt => ({ logo: '', alt })),
    of: `${k} column · 1–4 logos [{logo, aspect?, plate?, alt}], a 2×2 group under the head; logo '' draws the monogram of alt` }])),
  els: v => [ { slot: 'supertitle', text: 'Summary' }, { slot: 'title', text: 'Three camps, one open lane.' },
    rect(M, 150, CW, 74, { bg: 'var(--box)', radius: 8 }),
    body(M + 20, 172, CW - 40, 'Nobody checks a part for manufacture while it is being drawn.'),
    ...cols(3).flatMap((c, i) => { const [k, , txt] = CAMPS[i], L = v[`l${i + 1}`], cw = (c.w - 12) / 2;
      return [ lab(c.x, 248, c.w, k, { color: 'var(--accent)' }), rule(c.x, 268, c.x + c.w),
        ...(L || []).map((m, j) => ({ logo: m.logo, ...(m.aspect ? { aspect: m.aspect } : {}), ...(m.plate ? { plate: m.plate } : {}), alt: m.alt,
          ...(m.logo === '' ? { monogram: m.monogram || initials(m.alt) } : {}), x: c.x + (j % 2) * (cw + 12), y: 284 + Math.floor(j / 2) * 48, h: 36, col: cw, q: `l${i + 1}` })),
        body(c.x, L ? 392 : 284, c.w, txt) ]; }),
    { slot: 'source', text: 'Source · company filings and product pages, 2026' } ] },

{ id: 'quote-pull', textOnly: true, name: 'Quote — pulled', tier: 'core', cat: 'Narrative', note: 'Customer voice at display size, attribution beneath a short rule.', layout: null,
  els: [ t(M, 120, 100, 'Title', '“', { color: 'var(--accent)' }),
    t(M, 200, 780, 'H1', 'We closed the books in four days instead of eleven. That was the whole business case.', { italic: 1 }),
    rule(M, 372, M + 64, { bg: 'var(--accent)', h: 2 }), lab(M, 392, 500, 'Head of Finance · Granite Logistics') ] },

{ id: 'statement', textOnly: true, name: 'Statement — one sentence', tier: 'core', cat: 'Narrative', note: 'A single claim, centred, nothing else on the canvas.', layout: null,
  els: [ t(M, 196, CW, 'Title', 'Every late invoice is a conversation nobody had.', { align: 'center' }),
    lab(M, 356, CW, 'the thesis', { align: 'center' }) ] },

{ id: 'closing-cta', textOnly: true, name: 'Closing — live CTA', tier: 'core', cat: 'Narrative', note: 'Headline, painted button carrying a real href, contact line.', layout: null,
  els: [ t(M, 180, 640, 'Title', 'Ready when you are.'),
    rect(M, 320, 220, 52, { bg: 'var(--accent)', radius: 8, href: 'https://example.com' }),
    t(M, 320, 220, 'H2', 'Book a call', { h: 52, valign: 'middle', align: 'center', color: 'var(--card)', href: 'https://example.com', nowrap: 1 }),
    cap(M + 250, 336, 380, 'or reply to this thread; engagements start on a Monday.') ] },
];
