// Candidate variants for review: flow/sankey forms, and header/footer chrome kits.
// Chrome variants draw their chrome as SLIDE rows and hide the deck master, so one
// sheet can show eight chrome kits; in a real deck each is a master, authored once.
import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols } from '../lib/templates/kit.mjs';

const S1 = 'var(--accent)', S2 = 'var(--muted)', S3 = 'var(--line)';

export const FLOW_BLOCKED = ['flow-ribbon-curve'];
export const FLOW = [
{ id: 'flow-bands-straight', name: 'Straight bands', fam: 'Flow', note: 'Ships today. Band height is volume, no curve. Honest, and the least like a Sankey.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Flow · A' }, { slot: 'title', text: 'Most of what arrives never gets picked.' },
    rect(M + 20, 190, 40, 220, { bg: 'var(--fg)' }), lab(M + 20, 168, 200, 'Received', { nowrap: 1 }),
    rect(120, 191, 700, 118, { bg: S1, op: 0.28 }), rect(120, 331, 700, 78, { bg: S2, op: 0.22 }),
    rect(820, 190, 40, 120, { bg: S1 }), lab(660, 168, 200, 'Picked', { align: 'right', nowrap: 1 }),
    rect(820, 330, 40, 80, { bg: S3 }), lab(660, 418, 200, 'Held', { align: 'right', nowrap: 1 }),
    lab(330, 462, 130, '640 units', { align: 'right', nowrap: 1, color: S1 }), lab(490, 462, 130, '600 held', { nowrap: 1 }) ] },

{ id: 'flow-stepped', name: 'Stepped bands, mid column', fam: 'Flow', note: 'A middle stage carries the drop. Reads as a process, not a chart.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Flow · B' }, { slot: 'title', text: 'The drop happens at inspection.' },
    rect(M, 200, 46, 200, { bg: 'var(--fg)' }), lab(M, 178, 200, 'Received', { nowrap: 1 }),
    rect(150, 210, 260, 180, { bg: S1, op: 0.22 }),
    rect(430, 232, 46, 136, { bg: S2 }), lab(430, 210, 200, 'Inspected', { nowrap: 1 }),
    rect(496, 240, 260, 120, { bg: S1, op: 0.3 }),
    rect(790, 250, 46, 100, { bg: S1 }), lab(676, 206, 160, 'Picked', { align: 'right', nowrap: 1 }),
    { x: 476, y: 392, line: [476, 440], h: 1.5, bg: S3, dash: [5, 4] }, lab(490, 428, 200, '−120 held at inspection', { nowrap: 1 }) ] },

{ id: 'flow-ribbon-curve', name: 'Curved ribbons', fam: 'Flow', note: 'The real Sankey shape: a thick curve per ribbon. Needs an engine fill primitive if verify rejects it.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Flow · C' }, { slot: 'title', text: 'A true ribbon bends toward its target.' },
    rect(M, 190, 40, 220, { bg: 'var(--fg)' }), lab(M, 168, 200, 'Received', { nowrap: 1 }),
    { x: 100, y: 230, curve: [300, 230, 560, 220, 800, 220], h: 80, bg: S1, op: 0.3 },
    { x: 100, y: 350, curve: [300, 350, 560, 372, 800, 372], h: 56, bg: S2, op: 0.24 },
    rect(800, 180, 40, 80, { bg: S1 }), lab(640, 158, 200, 'Picked', { align: 'right', nowrap: 1 }),
    rect(800, 344, 40, 56, { bg: S3 }), lab(640, 410, 200, 'Held', { align: 'right', nowrap: 1 }) ] },

{ id: 'flow-stacked-split', name: 'Stacked split with leaders', fam: 'Flow', note: 'One 100% input bar, two output bars, hairline leaders tying segment to segment.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Flow · D' }, { slot: 'title', text: 'Every input segment lands somewhere.' },
    rect(M + 20, 190, 90, 130, { bg: S1 }), rect(M + 20, 320, 90, 90, { bg: S2 }),
    lab(M + 20, 168, 200, 'Received', { nowrap: 1 }),
    lab(M + 26, 246, 78, '640', { align: 'center', nowrap: 1, color: 'var(--card)' }),
    lab(M + 26, 360, 78, '600', { align: 'center', nowrap: 1, color: 'var(--card)' }),
    rect(790, 190, 90, 130, { bg: S1, op: 0.45 }), rect(790, 320, 90, 90, { bg: S3 }),
    lab(700, 168, 180, 'Outcome', { align: 'right', nowrap: 1 }),
    { x: 176, y: 255, line: [782, 255], h: 1, bg: S3 }, { x: 176, y: 365, line: [782, 365], h: 1, bg: S3 },
    lab(360, 224, 240, 'picked, shipped same week', { nowrap: 1 }), lab(360, 378, 240, 'held for the next cycle', { nowrap: 1 }) ] },

{ id: 'flow-weighted-nodes', name: 'Weighted nodes and strokes', fam: 'Flow', note: 'Node size and stroke weight carry volume. No fills, so nothing can collide.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Flow · E' }, { slot: 'title', text: 'Thickness is volume; the boxes are the stages.' },
    { id: 'fa', ...box(M, 240, 170, 84, 'H2', 'Received') },
    { id: 'fb', ...box(400, 178, 170, 72, 'H2', 'Picked') },
    { id: 'fc', ...box(400, 330, 170, 72, 'H2', 'Held') },
    { id: 'fd', ...box(730, 240, 170, 84, 'H2', 'Shipped') },
    { x: 238, y: 262, line: [390, 214], h: 9, bg: S1, op: 0.8, arrow: 'end', to: 'fb', waive: 1 },
    { x: 238, y: 302, line: [390, 366], h: 5, bg: S2, op: 0.6, arrow: 'end', to: 'fc', waive: 1 },
    { x: 578, y: 214, line: [720, 262], h: 9, bg: S1, op: 0.8, arrow: 'end', to: 'fd', waive: 1 },
    lab(M, 430, 300, '640 received · 520 shipped', { nowrap: 1 }) ] },

{ id: 'flow-bridge', name: 'Bridge (waterfall as flow)', fam: 'Flow', note: 'Volume in, each loss named, volume out. The clearest of the five when the drops matter.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Flow · F' }, { slot: 'title', text: 'Name every unit that leaves.' },
    ...[['Received', 0, 180, S2, '640'], ['Damaged', 140, 40, S3, '−40'], ['Held', 60, 80, S3, '−80'], ['Shipped', 0, 140, S1, '520']]
      .flatMap(([lbl, base, h, tone, v], i) => { const x = 160 + i * 170, y = 400 - base - h;
        const r = [ rect(x, y, 118, h, { bg: tone, radius: 3 }), lab(x, y - 20, 118, v, { align: 'center', nowrap: 1 }), lab(x, 412, 118, lbl, { align: 'center', nowrap: 1 }) ];
        if (i < 3) r.push({ x: x + 118, y, line: [x + 170, y], h: 1.5, bg: S3, dash: [5, 4] });
        return r; }),
    rule(150, 400, 850) ] },
];

const foot = (text, extra = {}) => lab(M, 506, 340, text, { ...extra });

export const CHROME = [
{ id: 'chrome-foot-band', name: 'Foot band (ships today)', fam: 'Chrome', note: 'Source line left, page counter in the corner. One band, every slide.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Chrome · A' }, { slot: 'title', text: 'The band that ships today.' },
    body(M, 180, 560, 'A left-anchored label carries the source line; the engine writes the counter into the same row, right edge on the margin.'),
    { override: 'foot', text: 'chrome · foot band' } ] },

{ id: 'chrome-hairline-foot', name: 'Hairline over the foot', fam: 'Chrome', note: 'A rule at the content edge separates chrome from canvas. Costs one row.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Chrome · B' }, { slot: 'title', text: 'A rule says where the slide ends.' },
    body(M, 180, 560, 'The hairline sits on the same margin as the foot, so the chrome reads as a band rather than two floating labels.'),
    rule(M, 492, W - M), { override: 'foot', text: 'chrome · hairline' } ] },

{ id: 'chrome-header-kicker', name: 'Header kicker, no foot', fam: 'Chrome', note: 'Mark and section across the top, the counter alone in its corner. Frees the lower third.', layout: null,
  els: [ lab(M, 40, 200, 'Northwind', { color: S1, nowrap: 1 }), { override: 'foot', x: 620, y: 506, w: 280, align: 'right', text: 'Operations' },
    rule(M, 62, W - M),
    t(M, 150, 700, 'Supertitle', 'Chrome · C'), t(M, 176, 760, 'H1', 'Give the bottom third back.'),
    body(M, 250, 620, 'With the chrome at the top, a full-width chart or a figure can run to the bottom margin without stepping on a counter.') ] },

{ id: 'chrome-side-rail', name: 'Side rail', fam: 'Chrome', note: 'A tinted left rail carries the section; the counter sits bottom-right. Costs 56px of canvas.', layout: null,
  els: [ rect(0, 0, 56, 540, { bg: S1 }), lab(8, 40, 40, '03', { align: 'center', color: 'var(--card)', nowrap: 1 }),
    t(96, 52, 700, 'Supertitle', 'Chrome · D'), t(96, 76, 760, 'H1', 'The rail names the section.'),
    body(96, 180, 620, 'Useful in a long deck where the reader needs to know which section a slide belongs to without a table of contents.'),
    { override: 'foot', x: 620, y: 506, w: 280, align: 'right', text: 'Operations' } ] },

{ id: 'chrome-tabs', name: 'Section tabs', fam: 'Chrome', note: 'Every section across the top, the current one accented. Shows the reader where they are.', layout: null,
  els: [ ...['Position', 'Numbers', 'Operations', 'Ask'].map((s, i) => lab(M + i * 150, 40, 140, s, { nowrap: 1, color: i === 2 ? S1 : 'var(--muted)' })),
    ...[0, 1, 2, 3].map(i => rect(M + i * 150, 62, 120, 2, { bg: i === 2 ? S1 : S3 })),
    t(M, 150, 700, 'Supertitle', 'Chrome · E'), t(M, 176, 760, 'H1', 'Four sections, one of them lit.'),
    body(M, 250, 620, 'The tab row is a master; only the accent moves, which a slide does with a partial override rather than a redraw.'),
    { override: 'foot', x: 620, y: 506, w: 280, align: 'right', text: '' } ] },

{ id: 'chrome-dots', name: 'Dot progress', fam: 'Chrome', note: 'Quietest progress cue there is. No words, no counter.', layout: 'content', hideFoot: 1,
  els: [ { slot: 'supertitle', text: 'Chrome · F' }, { slot: 'title', text: 'Progress without a number.' },
    body(M, 180, 560, 'Six dots, one filled. It survives a screenshot and never argues with a full-bleed image the way a counter does.'),
    ...[0, 1, 2, 3, 4, 5].map(i => dot(M + 10 + i * 22, 508, 9, { bg: i === 2 ? S1 : S3 })) ] },

{ id: 'chrome-brand-bar', name: 'Brand bar', fam: 'Chrome', note: 'A solid accent bar carries mark and counter in the card colour. Loud, and unmistakable in a deck wall.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Chrome · G' }, { slot: 'title', text: 'A bar the brand owns.' },
    body(M, 180, 560, 'Best on a deck that will be screenshotted into someone else’s document, where the bar is the only thing that survives the crop.'),
    rect(0, 494, 960, 46, { bg: S1 }),
    { override: 'foot', color: 'var(--card)', text: 'Northwind · operations' } ] },

{ id: 'chrome-none', name: 'No chrome', fam: 'Chrome', note: 'Covers, section dividers and full-bleed images. The slide is the whole canvas.', layout: null, hideFoot: 1,
  els: [ t(M, 210, 760, 'Title', 'Nothing but the slide.'), lab(M, 330, 400, 'Chrome · H', { color: S1 }) ] },
];
