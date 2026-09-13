// Header and footer chrome kits. Each draws its chrome as slide rows and hides the deck foot,
// so one sheet can show eight; in a real deck the winning kit is the master, authored once.
// The page counter's corner is fixed by the engine — a kit moves the source line, never the counter.
import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols, bars } from './kit.mjs';

const S1 = 'var(--accent)', S2 = 'var(--muted)', S3 = 'var(--line)';
const chip = (x, y, text, tone = S1) => ({ x, y, w: 'auto', p: 'chip', radius: 4, bd: `1px solid ${tone}`, role: 'Label', color: tone, text, nowrap: 1 });

export default [

{ id: 'chrome-foot-band', tier: 'core', density: 'reading', name: 'Foot band (ships today)', cat: 'Chrome', note: 'Source line left, page counter in the corner. One band, every slide.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Chrome · A' }, { slot: 'title', text: 'The band that ships today.' },
    body(M, 180, 560, 'A left-anchored label carries the source line; the engine writes the counter into the same row, right edge on the margin.'),
    rect(M, 452, CW, 1, { bg: 'transparent' }), lab(M, 462, 340, 'chrome · foot band'), lab(700, 462, 200, 'counter', { align: 'right', nowrap: 1, color: S2 }) ] },

{ id: 'chrome-hairline-foot', tier: 'core', density: 'reading', name: 'Hairline over the foot', cat: 'Chrome', note: 'A rule at the content edge separates chrome from canvas. Costs one row.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Chrome · B' }, { slot: 'title', text: 'A rule says where the slide ends.' },
    body(M, 180, 560, 'The hairline sits on the same margin as the foot, so the chrome reads as a band rather than two floating labels.'),
    rule(M, 446, W - M), lab(M, 462, 340, 'chrome · hairline'), lab(700, 462, 200, 'counter', { align: 'right', nowrap: 1, color: S2 }) ] },

{ id: 'chrome-header-kicker', tier: 'core', density: 'reading', name: 'Header kicker, no foot', cat: 'Chrome', note: 'Mark and section across the top, the counter alone in its corner. Frees the lower third.', layout: null,
  els: [ lab(M, 40, 200, 'Northwind', { color: S1, nowrap: 1 }), lab(620, 40, 280, 'Operations · 03', { align: 'right', nowrap: 1 }),
    rule(M, 62, W - M),
    t(M, 150, 700, 'Supertitle', 'Chrome · C'), t(M, 176, 760, 'H1', 'Give the bottom third back.'),
    body(M, 250, 620, 'With the chrome at the top, a full-width chart or a figure can run to the bottom margin without stepping on a counter.') ] },

{ id: 'chrome-side-rail', tier: 'standard', density: 'reading', name: 'Side rail', cat: 'Chrome', note: 'A tinted left rail carries the section; the counter sits bottom-right. Costs 56px of canvas.', layout: null,
  els: [ rect(0, 0, 56, 540, { bg: S1 }), lab(8, 40, 40, '03', { align: 'center', color: 'var(--card)', nowrap: 1 }),
    t(96, 52, 700, 'Supertitle', 'Chrome · D'), t(96, 76, 760, 'H1', 'The rail names the section.'),
    body(96, 180, 620, 'Useful in a long deck where the reader needs to know which section a slide belongs to without a table of contents.'),
    lab(620, 462, 280, 'Operations · counter', { align: 'right', nowrap: 1, color: S2 }) ] },

{ id: 'chrome-tabs', tier: 'standard', density: 'reading', name: 'Section tabs', cat: 'Chrome', note: 'Every section across the top, the current one accented. Shows the reader where they are.', layout: null,
  els: [ ...['Position', 'Numbers', 'Operations', 'Ask'].map((s, i) => lab(M + i * 150, 40, 140, s, { nowrap: 1, color: i === 2 ? S1 : 'var(--muted)' })),
    ...[0, 1, 2, 3].map(i => rect(M + i * 150, 62, 120, 2, { bg: i === 2 ? S1 : S3 })),
    t(M, 150, 700, 'Supertitle', 'Chrome · E'), t(M, 176, 760, 'H1', 'Four sections, one of them lit.'),
    body(M, 250, 620, 'The tab row is a master; only the accent moves, which a slide does with a partial override rather than a redraw.'),
    lab(620, 462, 280, 'counter', { align: 'right', nowrap: 1, color: S2 }) ] },

{ id: 'chrome-dots', tier: 'standard', density: 'speaker', name: 'Dot progress', cat: 'Chrome', note: 'Quietest progress cue there is. No words, no counter.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Chrome · F' }, { slot: 'title', text: 'Progress without a number.' },
    body(M, 180, 560, 'Six dots, one filled. It survives a screenshot and never argues with a full-bleed image the way a counter does.'),
    ...[0, 1, 2, 3, 4, 5].map(i => dot(424 + i * 22, 470, 9, { bg: i === 2 ? S1 : S3 })) ] },

{ id: 'chrome-brand-bar', tier: 'standard', density: 'reading', name: 'Brand bar', cat: 'Chrome', note: 'A solid accent bar carries mark and counter in the card colour. Loud, and unmistakable in a deck wall.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Chrome · G' }, { slot: 'title', text: 'A bar the brand owns.' },
    body(M, 180, 560, 'Best on a deck that will be screenshotted into someone else’s document, where the bar is the only thing that survives the crop.'),
    rect(0, 440, 960, 46, { bg: S1 }),
    lab(M, 456, 340, 'Northwind · operations', { color: 'var(--card)' }),
    lab(620, 456, 280, 'counter', { align: 'right', nowrap: 1, color: 'var(--card)', op: 0.8 }) ] },

{ id: 'chrome-none', tier: 'core', density: 'speaker', name: 'No chrome', cat: 'Chrome', note: 'Covers, section dividers and full-bleed images. The slide is the whole canvas.', layout: null, hideFoot: 1,
  els: [ t(M, 210, 760, 'Title', 'Nothing but the slide.'), lab(M, 330, 400, 'Chrome · H', { color: S1 }) ] },
];
