// Logo and icon placement. Every mark here is a FICTIONAL stand-in and carries `placeholder`,
// which validate turns into an error in any deck that does not set `draft` — a sample sheet may
// show these, a real deck must swap in the client's own mark. Icons are engine `icon:` rows.
import { M, CW, W, t, lab, cap, body, rect, rule, vrule, dot, tile, box, cols } from './kit.mjs';

const S1 = 'var(--accent)', S2 = 'var(--muted)', S3 = 'var(--line)';
const ph = name => ({ placeholder: name });

// six fictional marks, each built from primitives so nothing has to be embedded
export const MARKS = {
  northwind: (x, y, s, c = S1) => [ rect(x, y, s, s, { bg: c, radius: 3, ...ph('northwind') }),
    { x: x + s * 0.24, y: y + s * 0.72, line: [x + s * 0.76, y + s * 0.28], h: Math.max(2, s * 0.12), bg: 'var(--card)', ...ph('northwind') } ],
  halcyon: (x, y, s, c = S1) => [ { x, y, w: s, donut: 100, color: c, ...ph('halcyon') },
    dot(x + s / 2, y + s / 2, s * 0.34, { bg: c, ...ph('halcyon') }) ],
  meridian: (x, y, s, c = S1) => [ rect(x, y + s * 0.18, s * 0.78, s * 0.2, { bg: c, radius: 2, ...ph('meridian') }),
    rect(x + s * 0.22, y + s * 0.62, s * 0.78, s * 0.2, { bg: c, op: 0.55, radius: 2, ...ph('meridian') }) ],
  castellan: (x, y, s, c = S1) => [0, 1, 2].map(i => rect(x + i * s * 0.36, y + s * (0.55 - i * 0.22), s * 0.24, s * (0.45 + i * 0.22), { bg: c, op: 0.5 + i * 0.25, radius: 2, ...ph('castellan') })),
  oakline: (x, y, s, c = S1) => [ { x, y, w: s, donut: 100, color: c, ...ph('oakline') },
    rect(x + s * 0.22, y + s * 0.44, s * 0.56, Math.max(2, s * 0.12), { bg: c, ...ph('oakline') }) ],
  brightmoor: (x, y, s, c = S1) => [ rect(x, y, s * 0.44, s, { bg: c, radius: 2, ...ph('brightmoor') }),
    rect(x + s * 0.56, y + s * 0.3, s * 0.44, s * 0.7, { bg: c, op: 0.5, radius: 2, ...ph('brightmoor') }) ],
};
const word = (x, y, w, name, extra = {}) => lab(x, y, w, name, { nowrap: 1, ...ph(name.toLowerCase().replace(/\s+/g, '-')), ...extra });

export default [
{ id: 'logo-corner-mark', name: 'Corner mark', tier: 'core', cat: 'Logo', density: 'reading',
  note: 'Mark and wordmark top-left, on the content margin. The quietest place a logo can sit and still be seen.', layout: null,
  els: [ ...MARKS.northwind(M, 38, 26), word(M + 36, 44, 200, 'Northwind'),
    rule(M, 80, W - M),
    t(M, 150, 700, 'Supertitle', 'Logo · corner'), t(M, 176, 760, 'H1', 'The mark sits on the margin, not over the title.'),
    body(M, 268, 620, 'A 26px mark on the same left edge as everything else. It reads as chrome, which is what a logo on a content slide is.'),
    lab(M, 462, 400, 'placement · top-left, 26px') ] },

{ id: 'logo-foot-mark', name: 'Foot mark', tier: 'core', cat: 'Logo', density: 'reading',
  note: 'A small mark inside the foot band, ahead of the source line and sharing the row with the page counter.', layout: 'content',
  foot: { x: 200, w: 260 },   // the mark and its wordmark own the left of the band; the source line starts clear of them
  els: [ { slot: 'supertitle', text: 'Logo · foot' }, { slot: 'title', text: 'Down in the band with the counter.' },
    body(M, 180, 600, 'Cheapest possible placement: the mark joins the chrome you already have, and the canvas stays entirely free.'),
    ...MARKS.halcyon(M, 502, 16), word(M + 24, 505, 92, 'Halcyon', { color: S2 }) ] },

{ id: 'logo-cover-lockup', name: 'Cover lockup', tier: 'core', cat: 'Logo', density: 'speaker',
  note: 'Mark over wordmark, centred, with the deck title beneath. The one slide where a logo may be large.', layout: null,
  els: [ ...MARKS.northwind(456, 130, 48), word(M, 196, CW, 'NORTHWIND', { align: 'center' }),
    t(M, 240, CW, 'Title', 'Operations review', { align: 'center' }),
    cap(M, 330, CW, 'Third quarter · prepared for the board', { align: 'center' }),
    rule(430, 380, 530, { bg: S1, h: 2 }) ] },

{ id: 'logo-co-brand', name: 'Co-brand lockup', tier: 'standard', cat: 'Logo', density: 'speaker',
  note: 'Two marks, one divider. For a partner deck where neither logo may lead.', layout: null,
  els: [ ...MARKS.northwind(300, 180, 40), word(300, 234, 160, 'Northwind'),
    vrule(480, 172, 256, { bg: S3 }),
    ...MARKS.meridian(530, 180, 40), word(530, 234, 160, 'Meridian'),
    t(M, 310, CW, 'H1', 'A joint pilot, on one page.', { align: 'center' }),
    cap(M, 356, CW, 'Two teams, one dock, ninety days', { align: 'center' }) ] },

{ id: 'logo-rail-mark', name: 'Mark in the rail', tier: 'standard', cat: 'Logo', density: 'reading',
  note: 'The mark rides a tinted edge rail. The rail owns the left of the foot band, so the source line is inset past it.', layout: null,
  foot: { x: 110, w: 340 },   // 64px rail + a 46px gutter: the band never runs under the rail
  els: [ rect(0, 0, 64, 540, { bg: S1 }), ...MARKS.halcyon(18, 34, 28, 'var(--card)'),
    t(110, 52, 700, 'Supertitle', 'Logo · rail'), t(110, 76, 760, 'H1', 'A rail buys you a permanent mark.'),
    body(110, 180, 620, 'Costs 64px of canvas on every slide and pays it back in a long deck that gets screenshotted a section at a time.'),
    lab(110, 462, 400, 'placement · rail, 28px reversed') ] },

{ id: 'logo-watermark', name: 'Backdrop watermark', tier: 'fringe', cat: 'Logo', density: 'speaker',
  note: 'One oversized mark at low opacity behind the words. Use on a divider, never on data.', layout: null,
  els: [ ...MARKS.castellan(620, 150, 240).map(r => ({ ...r, op: 0.12 })),
    t(M, 190, 520, 'Supertitle', 'Section three'), t(M, 216, 520, 'Title', 'Operations'),
    body(M, 350, 420, 'The mark is a texture here, not a signature; keep it off anything with a number on it.', { color: S2 }) ] },

{ id: 'icon-three-up', name: 'Icons over three cards', tier: 'core', cat: 'Logo', density: 'reading',
  note: 'One icon per card, sized to the heading, in the accent. The most useful icon placement there is.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Icons · cards' }, { slot: 'title', text: 'Three things, one icon each.' },
    ...cols(3).flatMap((c, i) => { const s = [['scan', 'Scan', 'Every pallet read at the door, no clipboard.'],
        ['route', 'Route', 'Slots assigned before the truck is unloaded.'],
        ['shield-check', 'Prove', 'A photograph and a timestamp on every exception.']][i];
      return [ rect(c.x, 168, c.w, 240, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 10 }),
        { x: c.x + 20, y: 190, w: 28, h: 28, icon: s[0], color: S1 },
        t(c.x + 20, 236, c.w - 40, 'H2', s[1]), rule(c.x + 20, 274, c.x + c.w - 20),
        body(c.x + 20, 290, c.w - 40, s[2]) ]; }) ] },

{ id: 'icon-capability-grid', name: 'Icon capability grid', tier: 'standard', cat: 'Logo', density: 'reading',
  note: 'Six capabilities, icon and label only. Replaces a bullet list nobody reads.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Icons · grid' }, { slot: 'title', text: 'Six things it does out of the box.' },
    ...[['scan', 'Barcode intake'], ['clock', 'Dock scheduling'], ['chart-column', 'Daily throughput'],
        ['triangle-alert', 'Exception alerts'], ['file-text', 'Signed manifests'], ['users', 'Crew rosters']]
      .flatMap(([ic, label], i) => { const c = cols(3, CW, 24)[i % 3], y = 180 + Math.floor(i / 3) * 118;
        return [ rect(c.x, y, c.w, 96, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8 }),
          { x: c.x + 18, y: y + 20, w: 26, h: 26, icon: ic, color: S1 },
          t(c.x + 58, y + 24, c.w - 76, 'H2', label, { nowrap: 1 }) ]; }) ] },

{ id: 'icon-bullets', name: 'Icon bullets', tier: 'standard', cat: 'Logo', density: 'reading',
  note: 'An icon where a bullet would be, one per line. The icon has to mean something or it is noise.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Icons · list' }, { slot: 'title', text: 'What changes on Monday.' },
    ...[['clock', 'Dock slots move to thirty-minute windows.'], ['scan', 'Every pallet is scanned at the door, not at the rack.'],
        ['triangle-alert', 'An exception pages the shift lead, not the inbox.'], ['file-text', 'The manifest is signed on the tablet before the truck leaves.']]
      .flatMap(([ic, s], i) => { const y = 184 + i * 68;
        return [ { x: M, y, w: 24, h: 24, icon: ic, color: S1 }, body(M + 44, y + 2, 700, s), rule(M, y + 48, W - M) ]; }) ] },

{ id: 'logo-proof-wall', name: 'Logo wall', tier: 'standard', cat: 'Logo', density: 'reading',
  note: 'Five stand-in client marks on one row, muted so the number beneath them leads.', layout: 'content',
  els: [ { slot: 'supertitle', text: 'Logo · wall' }, { slot: 'title', text: 'Five yards run on it.' },
    ...[['northwind', 'Northwind'], ['halcyon', 'Halcyon'], ['meridian', 'Meridian'], ['oakline', 'Oakline'], ['brightmoor', 'Brightmoor']]
      .flatMap(([key, name], i) => { const x = M + i * 172;
        return [ rect(x, 186, 148, 84, { bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8 }),
          ...MARKS[key](x + 20, 206, 26, S2), word(x + 54, 216, 86, name, { color: S2 }) ]; }),
    rule(M, 306, W - M),
    ...cols(3).flatMap((c, i) => { const s = [['41,200', 'pallets a month'], ['99.1%', 'scanned at the door'], ['0', 'clipboards']][i];
      return [ t(c.x, 330, c.w, 'Stat', s[0]), lab(c.x, 382, c.w, s[1], { nowrap: 1 }) ]; }) ] },

{ id: 'logo-top-right-mark', name: 'Top-right mark', tier: 'core', cat: 'Logo', density: 'reading',
  note: 'The mark alone in the opposite corner from the title. Nothing competes with it and nothing moves.', layout: null,
  els: [ ...MARKS.meridian(874, 38, 26),
    t(M, 52, 700, 'Supertitle', 'Logo · top right'), t(M, 76, 700, 'H1', 'The corner the eye leaves last.'),
    body(M, 180, 620, 'A reader scans left to right and down; a mark parked top-right is seen on the way in and never again. That is usually what you want from a logo.'),
    lab(M, 462, 400, 'placement · top-right, 26px') ] },

{ id: 'logo-top-right-lockup', name: 'Top-right lockup', tier: 'standard', cat: 'Logo', density: 'reading',
  note: 'Wordmark and mark right-aligned under a hairline that runs the content width.', layout: null,
  els: [ word(660, 44, 180, 'Northwind', { align: 'right' }), ...MARKS.northwind(874, 38, 26),
    rule(M, 78, W - M),
    t(M, 108, 700, 'Supertitle', 'Logo · lockup'), t(M, 132, 700, 'H1', 'A rule ties the mark to the page.'),
    body(M, 240, 620, 'The hairline is what stops a top-right lockup reading as a sticker: it belongs to the same grid as the title beneath it.'),
    lab(M, 462, 420, 'placement · top-right lockup, rule at 78') ] },

{ id: 'logo-top-right-badge', name: 'Top-right badge', tier: 'standard', cat: 'Logo', density: 'speaker',
  note: 'The mark in a filled badge, so it survives over a photograph or a dark ground.', layout: null,
  els: [ rect(0, 0, 960, 540, { bg: 'linear-gradient(135deg,var(--box),var(--line))' }),
    rect(838, 32, 84, 60, { bg: 'var(--card)', radius: 10, shadow: '0 2px 10px rgba(0,0,0,.12)' }),
    ...MARKS.halcyon(867, 46, 26),
    t(M, 300, 700, 'Title', 'It reads on any ground.'),
    body(M, 404, 560, 'A badge is the only top-right placement that works over an image you do not control.', { color: S2 }),
    lab(M, 462, 420, 'placement · badge, 84×60 at 838,32') ] },
];
