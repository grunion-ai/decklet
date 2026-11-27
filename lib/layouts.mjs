// decklet layout library — named layouts in the SAME shape as a deck's `layouts` entry, so `create` needs no new path:
// when a slide names a layout the deck does not define, the library's is merged into `deck.layouts` (scaled to the canvas).
// An accelerant, never a fence — a slide may use a library layout, a deck layout, or free rows, and may mix library
// slots with extra free rows on the same slide. Cut for 960×540 at the neutral scale (Title 64/68, Stat 40/44); a brand
// with a taller display role nudges a slotted row with its own x/y/w/h (the `override` path of slots).
// A slot is a row treatment minus content: geometry + role, and any paint (`tile`, `bg`, `line`, `p`…) the engine spreads
// onto the bound row — so `{slot:'rule'}` alone draws the timeline's rule, and a kpi tile is `{slot:'kpi1', text:'63%'}`.
// A composite (a kpi tile, a numbered step, a timeline event, the cta button) is several slots sitting on the same spot of
// canvas — nothing binds them to each other, and in the editor each one selects and moves on its own.
// library: import {LIBRARY, GROUPS, DENSE, COUNTER, libraryFor, catalogue} from './layouts.mjs'
export const GROUPS = ['openers', 'chrome', 'text', 'visuals', 'modern', 'numbers', 'diagrams', 'plans', 'closers'];
const M = 60, CW = 840;   // margin + content width on the 960 canvas
const sup = (x = M, y = 52, w = CW) => ({x, y, w, role: 'Supertitle'});
const h1 = (x = M, y = 76, w = CW) => ({x, y, w, role: 'H1'});
const head = {supertitle: sup(), title: h1()};
const tiles = (n, w, pitch, role = 'Stat2') => {   // Stat2: the KPI allowance — a smaller stat for tiles; the hero `stat` layout keeps Stat
  const o = {};
  for (let k = 0; k < n; k++) {
    const x = M + k * pitch;   // tile, chip and label: three rows on one patch of canvas, each free of the others
    o[`kpi${k + 1}`] = {x, y: 160, w, h: 120, tile: 1, role, align: 'center'};
    // a w:'auto' chip has no width to place by x — it hangs 12px in from the tile's right edge via `right`
    o[`kpi${k + 1}-delta`] = {right: 960 - (x + w) + 12, y: 172, w: 'auto', role: 'Label', p: 'chip', radius: 4, nowrap: 1, bg: 'var(--box)', color: 'var(--ok,var(--accent))'};
    o[`kpi${k + 1}-label`] = {x, y: 292, w, role: 'Label', align: 'center'};
  }
  return o;
};
// MEDIA — a list layout's per-item media slot (F10), `<item>-media`: a box with no role and no paint, bound with an icon, img or
// logo row IN PLACE of the item's marker (its number, its dot, the name in a logo frame), centred on that marker's line. Bind the
// marker or the media, never both. The box is square at the line it replaces, so an icon sits on the text's first line.
// MEDIA_MIN (K11) is the floor for a media box and for a logo in a template's media slot, on the 960 cut: a logo chip under 20px
// does not read, so the engine grows the slot and reflows the rows under it instead of shrinking the mark.
export const MEDIA_MIN = 20;
const five = (mk) => Object.fromEntries([1, 2, 3, 4, 5].flatMap(k => mk(k)));
const seq = (n, mk) => Object.fromEntries(Array.from({length: n}, (_, i) => mk(i + 1)).flat());
const ON = 'var(--card)', INK = 'var(--fg)', TINT = 'var(--box)', BRAND = 'var(--accent)';
const ledger = (y) => seq(4, (k, x = M + (k - 1) * 216) => [[`fact${k}-label`, {x, y, w: 192, role: 'Label'}], [`fact${k}`, {x, y: y + 20, w: 192, role: 'Body'}]]);
const NO_DENSE = {subtitle: false, note: false, source: false, legend: false};
const namePanel = (w, role = 'Title', h = 272) => ({supertitle: sup(M, 44, w), title: {x: M, y: 392 - h, w, h, role, valign: 'bottom'}, tagline: {x: M, y: 404, w, role: 'H2', color: BRAND}, caption: {x: M, y: 484, w, role: 'Caption'}});
const cols = (n, mk) => Object.fromEntries([...Array(n)].flatMap((_, k) => mk(k + 1, M + k * 210)));   // k, x at a 210 pitch
// BULLETS — the plainest content slide there is: a title and four to six points. `bullet: 1` on the slot tells the engine to
// draw the marker, so a bound bullet has a dot and an unbound one draws nothing at all — no dot row to place, none to delete.
// The dot hangs 1.25em to the LEFT of the row's box (an em of the row's own role, so it tracks the canvas and the brand's
// scale), which is why every bullet column is indented 36px from the edge its title sits on. One line per bullet: the pitch
// carries a single line of Body plus air, and a bullet that wraps overlaps the next one, which the gap gate calls out.
const bullets = (n, x, y0, w, pitch) => Object.fromEntries([...Array(n)].map((_, k) => [`b${k + 1}`, {x, y: y0 + k * pitch, w, role: 'Body', bullet: 1}]));

// DENSITY — two named densities, defined here so "make it dense" / "keep it fluffy" builds the same deck every time.
//   speaker (fluffy): the presenter carries the argument; the slide is one idea in big type. ≤ 3 points, ≤ 40 words of body.
//   reading (dense):  a leave-behind read without a speaker; the slide carries its own context: a subtitle under the title,
//                     a note or description, a source line, a legend, the footer naming the deck. ≤ 8 points, ≤ 140 words;
//                     ≤ 60 on a summary slide (kind: 'summary') or a number slide (a Numbers-shelf template, or Stat rows as
//                     half its points or more): the figure carries those, and the CAD/DFM v2 deck's 115- and 88-word ones read as walls (K19).
// A deck says `density`; a slide may override with its own. validate reports the slides that miss their density's shape.
export const DENSITY = {
  speaker: {aka: 'fluffy', for: 'a presented deck — the speaker carries the rest',
    carries: ['supertitle', 'title', 'one figure, number or ≤ 3 points', 'a caption at most'],
    max: {points: 3, words: 40}},
  reading: {aka: 'dense', for: 'a leave-behind read without a speaker — the slide carries its own context',
    carries: ['supertitle', 'title', 'subtitle (the claim in one sentence)', 'the figure or the points', 'note (what to make of it)', 'source', 'legend', 'footer naming the deck'],
    max: {points: 8, words: 140, summary: 60, numbers: 60}},
};
// COUNTER — the corner is the counter's. The engine draws the page counter with its right edge on styles.margin on every slide
// (inline in a right-anchored footer, detached beside a left-anchored one, a pin with no footer); this box is the right foot
// it may occupy on the 960×540 cut, and no library slot enters it: the legend keeps its right alignment 12px to its left.
export const COUNTER = {right: M, y: 466, w: 96, h: 74};
const LEGEND_R = COUNTER.right + COUNTER.w + 12;   // the legend's right edge, clear of the counter
// FOOT (K17) — the slide foot is ONE line. The content area ends at FOOT.y on the 960×540 cut; below it, down to the footer, sits
// the foot line and nothing else: the source on the left of the footer's baseline, the legend just left of the deck name, the
// counter in its corner. A slot that says `foot` is seated there by the engine (its first-line baseline on the footer's, `right`
// feet hung left of the footer's text) — its y is only the fallback for a deck with no footer and no counter. validate warns on
// any other text row that starts in the band. A note is never a stratum of its own: it is a caption beside the visual it explains.
export const FOOT = {y: 472};
// the dense chrome: four optional slots every title-chrome layout carries. Unbound, they draw nothing; a reading deck binds them.
// `note` has no generic seat (null): a layout with a visual names the caption position under or beside it in `dense.note`, and a
// layout with none (a bare canvas, text columns, tiles with their own body) declares `note: false` — the layout drops it.
export const DENSE = {
  subtitle: {x: M, y: 118, w: CW, role: 'H2', weight: 400, color: 'var(--muted)', nowrap: 1},      // the claim in ONE line under the H1 (parity fails a wrap) — regular weight, own of H2's bold (K8)
  note:     null,                                                                      // what to make of the figure — per layout, beside its visual (K17)
  source:   {x: M, y: 500, w: 'auto', role: 'Caption', nowrap: 1, foot: 'left'},        // where the numbers came from: the left of the foot line
  legend:   {right: LEGEND_R, y: 500, w: 'auto', role: 'Label', nowrap: 1, foot: 'right'},   // series or symbol key: on the foot line, left of the deck name
};
const note = (x, y, w) => ({x, y, w, role: 'Body', color: 'var(--muted)'});   // a caption seat: two lines of Body, ending by FOOT.y
const NO_NOTE = {note: false};
// the modern shelf's repeated cells — each returns the slots of one card/callout/logo/person; the rows stand alone
const SHOT = 'linear-gradient(135deg,var(--box),var(--line))';   // the screenshot / photo placeholder until the slide gives `img`
const card = (n, x, w) => ({[`card${n}`]: {x, y: 168, w, h: 128, bg: 'var(--card)', bd: '1px solid var(--line)', radius: 12},
  [`card${n}-label`]: {x: x + 18, y: 186, w: 150, role: 'Label'}, [`card${n}-value`]: {x: x + 18, y: 210, w: 150, role: 'Stat'}});
const callout = (n, y) => ({[`callout${n}`]: {x: 660, y: y - 18, w: 240, h: 56, bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8},
  [`callout${n}-text`]: {x: 676, y: y - 6, w: 208, role: 'Body'},
  [`callout${n}-leader`]: {x: 185 + (n - 1) * 130, y: y + 10, w: 475 - (n - 1) * 130, h: 1, line: [660, y + 10], bg: 'var(--line)'},   // the dot's edge to the callout's (#163)
  [`callout${n}-dot`]: {x: 175 + (n - 1) * 130, y: y + 5, w: 10, h: 10, radius: 10, bg: 'var(--accent)'}});
const threeCard = (n, x) => ({[`card${n}`]: {x, y: 168, w: 264, h: 240, bg: 'var(--card)', bd: '1px solid var(--line)', radius: 10},
  [`card${n}-number`]: {x: x + 20, y: 190, w: 60, role: 'Label', color: 'var(--accent)'}, [`card${n}-media`]: {x: x + 20, y: 185, w: 24, h: 24}, [`card${n}-head`]: {x: x + 20, y: 216, w: 224, role: 'H2'},   // two lines end at 272
  [`card${n}-rule`]: {x: x + 20, y: 282, w: 224, h: 1, line: [x + 244, 282], bg: 'var(--line)'}, [`card${n}-body`]: {x: x + 20, y: 298, w: 224, role: 'Body'}});
const kpiCell = (n, x) => ({[`kpi${n}`]: {x, y: 160, w: 198, h: 74, bg: 'var(--box)', radius: 8},
  [`kpi${n}-value`]: {x: x + 14, y: 172, w: 170, role: 'Stat'}, [`kpi${n}-label`]: {x: x + 14, y: 212, w: 170, role: 'Label', nowrap: 1}});
const logo = (n, x) => ({[`logo${n}`]: {x, y: 200, w: 148, h: 64, bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8},
  [`logo${n}-name`]: {x, y: 224, w: 148, role: 'Label', align: 'center', nowrap: 1},
  [`logo${n}-media`]: {x: x + 14, y: 211, w: 120, h: 40}});   // in place of the name: the mark itself, contain-fit in the frame
const proofStat = (n, x) => ({[`stat${n}`]: {x, y: 336, w: 264, role: 'Stat'}, [`stat${n}-label`]: {x, y: 386, w: 264, role: 'Label', nowrap: 1}});
const person = (n, x) => ({[`photo${n}`]: {x, y: 172, w: 195, h: 180, bg: 'linear-gradient(140deg,var(--box),var(--line))', radius: 10},
  [`name${n}`]: {x, y: 360, w: 195, role: 'H2'}, [`role${n}`]: {x, y: 420, w: 195, role: 'Caption'}});
export const LIBRARY = {
  // ── openers
  cover:   {group: 'openers', density: 'speaker', use: 'Open the deck: name, one-line promise, who and when.',
    slots: {supertitle: sup(M, 160), title: {x: M, y: 186, w: CW, role: 'Title'}, body: {x: M, y: 380, w: 700, role: 'Body', color: 'var(--muted)'}, caption: {x: M, y: 450, w: CW, role: 'Caption'}}},
  agenda:  {group: 'openers', density: 'reading', use: 'List what the deck covers, up to five numbered items.',
    slots: {...head, ...cols(5, (k) => [[`n${k}`, {x: M, y: 155 + (k - 1) * 60, w: 40, role: 'Label'}], [`item${k}`, {x: M + 50, y: 150 + (k - 1) * 60, w: 790, role: 'Body'}],
      [`item${k}-media`, {x: M + 18, y: 150 + (k - 1) * 60, w: 24, h: 24}]])},
    dense: {note: note(M + 50, 424, 790)}},   // under the list, on the items' own column: the fifth item ends at 414   // in place of n: a 24px mark on the item's line, 8px before it
  section: {group: 'openers', density: 'speaker', use: 'Divide the deck: a section number and its title, with one line of context.',
    slots: {number: {x: M, y: 190, w: CW, role: 'Label'}, title: {x: M, y: 214, w: CW, role: 'Title'}, body: {x: M, y: 400, w: 700, role: 'Body', color: 'var(--muted)'}}},
  'cover-agenda-rail': {group: 'openers', density: 'reading', use: 'Open the deck and list its agenda on one slide: up to five numbered, timed items in a rail on the left, the title and purpose on the right (hide the footer on this slide).',
    slots: {rail: {x: 0, y: 0, w: 326, h: 540, bg: 'var(--fg)'}, 'rail-label': {x: M, y: 44, w: 242, role: 'Label'},
      ...five((k) => [[`n${k}`, {x: M, y: 175 + (k - 1) * 44, w: 24, role: 'Label'}], [`item${k}`, {x: 88, y: 170 + (k - 1) * 44, w: 150, role: 'Body', color: 'var(--card)'}],
        [`time${k}`, {x: 242, y: 173 + (k - 1) * 44, w: 60, role: 'Caption', align: 'right', nowrap: 1}]]),
      total: {x: M, y: 484, w: 242, role: 'Label'}, supertitle: sup(374, 44, 526), title: {x: 374, y: 108, w: 526, h: 272, role: 'Title', valign: 'bottom'},
      body: {x: 374, y: 396, w: 526, role: 'Body', color: 'var(--muted)'}, caption: {x: 374, y: 478, w: 526, role: 'Caption'}}},
  'cover-contents-column': {group: 'openers', density: 'reading', use: 'Open the deck as a contents page: the title and purpose on an accent panel, up to five sections in a column on the right, each under its slide number and each a link to its slide (hide the footer on this slide).',
    slots: {panel: {x: 0, y: 0, w: 701, h: 540, bg: 'var(--accent)'}, column: {x: 701, y: 0, w: 259, h: 540, bg: 'var(--card)'},
      supertitle: {...sup(M, 44, 593), color: 'var(--card)'}, title: {x: M, y: 134, w: 593, h: 272, role: 'Title', valign: 'middle', color: 'var(--card)'}, body: {x: M, y: 448, w: 593, role: 'Body', color: 'var(--card)'},
      'column-label': {x: 725, y: 44, w: 175, role: 'Label'},
      ...five((k) => [[`page${k}`, {x: 725, y: 92 + (k - 1) * 80, w: 175, role: 'Label', color: 'var(--accent)'}], [`section${k}`, {x: 725, y: 110 + (k - 1) * 80, w: 175, role: 'Body', weight: 600}]])}},
  'cover-agenda-strip': {group: 'openers', density: 'reading', use: 'Open the deck over its agenda: the title and purpose on top, up to five numbered, timed sections in a strip of equal columns along the bottom (hide the footer on this slide).',
    slots: {strip: {x: 0, y: 410, w: 960, h: 130, bg: 'var(--fg)'}, ...Object.fromEntries([2, 3, 4, 5].map(k => [`rule${k}`, {x: M + (k - 1) * 172 - 10, y: 410, w: 1, h: 130, bg: 'var(--muted)', op: 0.4}])),
      supertitle: sup(M, 44), title: {x: M, y: 100, w: CW, h: 204, role: 'Title', valign: 'bottom'}, body: {x: M, y: 328, w: 700, role: 'Body', color: 'var(--muted)'},
      ...five((k, x = M + (k - 1) * 172) => [[`n${k}`, {x, y: 426, w: 152, role: 'Label'}], [`item${k}`, {x, y: 462, w: 152, role: 'Body', weight: 600, color: 'var(--card)', nowrap: 1}],
        [`time${k}`, {x, y: 490, w: 152, role: 'Caption'}]])}},
  'cover-front-page': {group: 'openers', density: 'reading', use: 'Open the deck as a front page: a masthead over a rule, the headline and a description, then up to five section teasers along the bottom, each a link to its slide (hide the footer on this slide).',
    slots: {rule: {x: M, y: 72, w: CW, h: 3, bg: INK}, ...seq(5, (k) => [[`rule${k}`, {x: M + (k - 1) * 172, y: 380, w: 152, h: 1, bg: INK}]]),
      masthead: {x: M, y: 36, w: 520, role: 'H2', nowrap: 1}, meta: {x: 600, y: 44, w: 300, role: 'Label', align: 'right', nowrap: 1},
      title: {x: M, y: 96, w: 720, h: 136, role: 'Title'}, description: {x: M, y: 248, w: 620, role: 'Body', color: 'var(--muted)'},
      ...seq(5, (k, x = M + (k - 1) * 172) => [[`section${k}`, {x, y: 392, w: 152, role: 'Body', weight: 600}], [`page${k}`, {x, y: 452, w: 152, role: 'Label', color: BRAND}]])}},
  'cover-contents-page': {group: 'openers', density: 'reading', use: 'Open the deck as a contents page: the title on a tinted panel over the left 42%, up to five ruled contents rows on the right, each a link to its slide number (hide the footer on this slide).',
    slots: {panel: {x: 0, y: 0, w: 403, h: 540, bg: TINT}, ...seq(5, (k) => [[`rule${k}`, {x: 451, y: 190 + (k - 1) * 60, w: 449, h: 1, bg: 'var(--line)'}]]),
      ...namePanel(295, 'H1', 200), 'contents-label': {x: 451, y: 112, w: 449, role: 'Label'},
      ...seq(5, (k, y = 156 + (k - 1) * 60) => [[`section${k}`, {x: 451, y, w: 330, role: 'Body', weight: 600, nowrap: 1}], [`page${k}`, {x: 800, y: y + 5, w: 100, role: 'Label', color: BRAND, align: 'right', nowrap: 1}]])},
    dense: NO_DENSE},
  'cover-decision': {group: 'openers', density: 'speaker', use: 'Open on the decision the deck asks for, set in the largest type on an inverse ground, with the deck title as a caption above it (hide the footer on this slide).',
    slots: {ground: {x: 0, y: 0, w: 960, h: 540, bg: INK}, title: {x: M, y: 44, w: 600, role: 'Body', weight: 600, color: ON}, meta: {x: 700, y: 49, w: 200, role: 'Label', align: 'right', nowrap: 1},
      'decision-label': {x: M, y: 196, w: 780, role: 'Label'}, decision: {x: M, y: 218, w: 780, h: 204, role: 'Title', color: BRAND},
      ...seq(4, (k) => [[`item${k}`, {x: M + (k - 1) * 210, y: 478, w: 190, role: 'Caption', nowrap: 1}]])}},
  'cover-title-block': {group: 'openers', density: 'speaker', use: 'Open the deck as a drawing sheet: the title on an open framed canvas and up to six labelled facts ruled into a block in the lower right corner (hide the footer on this slide).',
    slots: {frame: {x: 48, y: 36, w: 864, h: 468, bd: '1px solid var(--fg)'}, block: {x: 504, y: 372, w: 408, h: 132, bg: ON, bd: '1px solid var(--fg)'},
      'block-rule1': {x: 504, y: 416, w: 408, h: 1, bg: INK}, 'block-rule2': {x: 504, y: 460, w: 408, h: 1, bg: INK}, 'block-rule3': {x: 776, y: 416, w: 1, h: 44, bg: INK},
      'block-rule4': {x: 640, y: 460, w: 1, h: 44, bg: INK}, 'block-rule5': {x: 830, y: 460, w: 1, h: 44, bg: INK},
      supertitle: sup(76, 60, 480), title: {x: 76, y: 84, w: 560, h: 204, role: 'Title'},
      ...Object.fromEntries([[504, 372, 408], [504, 416, 272], [776, 416, 136], [504, 460, 136], [640, 460, 190], [830, 460, 82]].flatMap(([x, y, w], i) =>
        [[`fact${i + 1}-label`, {x: x + 12, y: y + 7, w: w - 24, role: 'Label', nowrap: 1}], [`fact${i + 1}`, {x: x + 12, y: y + 22, w: w - 24, role: 'Caption', color: INK, nowrap: 1}]]))}},
  'cover-presenter-panel': {group: 'openers', density: 'reading', use: 'Open the deck on who is presenting: the title and purpose on the left, an inverse panel over the right 36% with the presenter, two facts and the ask (hide the footer on this slide).',
    slots: {panel: {x: 614, y: 0, w: 346, h: 540, bg: INK}, avatar: {x: 646, y: 124, w: 48, h: 48, radius: 24, bg: BRAND},
      supertitle: sup(M, 44, 506), title: {x: M, y: 134, w: 506, h: 272, role: 'Title', valign: 'middle'}, purpose: {x: M, y: 452, w: 506, role: 'Body', color: 'var(--muted)'},
      'avatar-label': {x: 646, y: 124, w: 48, h: 48, role: 'Label', align: 'center', valign: 'middle', color: ON, nowrap: 1},
      presenter: {x: 708, y: 124, w: 192, role: 'H2', color: ON, nowrap: 1}, 'presenter-label': {x: 708, y: 154, w: 192, role: 'Caption', nowrap: 1},
      'fact1-label': {x: 646, y: 212, w: 254, role: 'Label'}, fact1: {x: 646, y: 230, w: 254, role: 'Body', color: ON},
      'fact2-label': {x: 646, y: 292, w: 254, role: 'Label'}, fact2: {x: 646, y: 310, w: 254, role: 'Body', color: ON},
      'ask-label': {x: 646, y: 372, w: 254, role: 'Label'}, ask: {x: 646, y: 390, w: 254, role: 'H2', color: BRAND}}},
  'cover-margin-notes': {group: 'openers', density: 'reading', use: 'Open the deck on a large title with up to four labelled notes hanging in a ruled margin on the right (hide the footer on this slide).',
    slots: {...seq(4, (k) => [[`note${k}-rule`, {x: 696, y: 106 + (k - 1) * 88, w: 2, h: 64, bg: BRAND}]]),
      supertitle: sup(M, 44, 560), title: {x: M, y: 134, w: 560, h: 272, role: 'Title', valign: 'middle'},
      ...seq(4, (k, y = 106 + (k - 1) * 88) => [[`note${k}-label`, {x: 712, y, w: 188, role: 'Label'}], [`note${k}`, {x: 712, y: y + 17, w: 188, role: 'Body'}]])}},
  'cover-purpose-ask-footer': {group: 'openers', density: 'reading', use: 'Open the deck on its title and a description, with the purpose and the ask in two panels that split the bottom 24% (hide the footer on this slide).',
    slots: {'purpose-panel': {x: 0, y: 410, w: 480, h: 130, bg: TINT}, 'ask-panel': {x: 480, y: 410, w: 480, h: 130, bg: INK},
      supertitle: sup(M, 44), title: {x: M, y: 96, w: CW, h: 136, role: 'Title', valign: 'bottom'}, description: {x: M, y: 250, w: 640, role: 'Body'},
      'purpose-label': {x: M, y: 432, w: 380, role: 'Label'}, purpose: {x: M, y: 452, w: 380, role: 'Body'},
      'ask-label': {x: 516, y: 432, w: 384, role: 'Label'}, ask: {x: 516, y: 450, w: 384, role: 'H2', color: BRAND}}},
  'cover-description-column': {group: 'openers', density: 'reading', use: 'Open the deck with the title on the left and a tinted column on the right that stacks a description, the purpose and the ask (hide the footer on this slide).',
    slots: {column: {x: 499, y: 0, w: 461, h: 540, bg: TINT}, 'column-rule': {x: 540, y: 290, w: 360, h: 1, bg: 'var(--line)'},
      ...namePanel(403), 'about-label': {x: 540, y: 96, w: 360, role: 'Label'}, description: {x: 540, y: 116, w: 360, role: 'Body'},
      'purpose-label': {x: 540, y: 308, w: 360, role: 'Label'}, purpose: {x: 540, y: 326, w: 360, role: 'Body'},
      'ask-label': {x: 540, y: 398, w: 360, role: 'Label'}, ask: {x: 540, y: 416, w: 360, role: 'H2', color: BRAND}}},
  'cover-description-headline': {group: 'openers', density: 'reading', use: 'Open the deck on a description set as the headline, with the title as a byline above it and four labelled facts under a rule (hide the footer on this slide).',
    slots: {rule: {x: M, y: 404, w: CW, h: 2, bg: INK}, title: {x: M, y: 40, w: 500, role: 'H2', nowrap: 1}, meta: {x: 640, y: 48, w: 260, role: 'Label', align: 'right', nowrap: 1},
      description: {x: M, y: 108, w: CW, h: 280, role: 'H1', valign: 'middle'}, ...ledger(420)}},
  'cover-fact-ledger': {group: 'openers', density: 'reading', use: 'Open the deck on its title and a tagline, with a short description at the top right and four labelled facts in a ruled row along the bottom (hide the footer on this slide).',
    slots: {rule: {x: M, y: 404, w: CW, h: 1, bg: INK}, supertitle: sup(M, 44, 300), description: {x: 580, y: 40, w: 320, role: 'Caption'},
      title: {x: M, y: 168, w: CW, h: 136, role: 'Title', valign: 'bottom'}, tagline: {x: M, y: 316, w: CW, role: 'H2', color: BRAND}, ...ledger(420)}},
  'cover-description-card': {group: 'openers', density: 'reading', use: 'Open the deck with the title on a tinted ground and one card on the right that holds a description and the ask (hide the footer on this slide).',
    slots: {ground: {x: 0, y: 0, w: 960, h: 540, bg: TINT}, card: {x: 573, y: 110, w: 346, h: 320, bg: ON, radius: 8}, 'card-rule': {x: 599, y: 318, w: 294, h: 1, bg: 'var(--line)'},
      supertitle: sup(M, 44, 440), title: {x: M, y: 100, w: 440, h: 272, role: 'Title', valign: 'bottom'}, tagline: {x: M, y: 384, w: 440, role: 'H2', color: BRAND}, purpose: {x: M, y: 470, w: 440, role: 'Body'},
      'about-label': {x: 599, y: 136, w: 294, role: 'Label'}, description: {x: 599, y: 156, w: 294, role: 'Body'},
      'ask-label': {x: 599, y: 334, w: 294, role: 'Label'}, ask: {x: 599, y: 352, w: 294, role: 'H2', color: BRAND}}},
  'cover-ask-sticker': {group: 'openers', density: 'reading', use: 'Open the deck on an accent ground with the title, a tagline and a description, and the ask on a round sticker at the top right (hide the footer on this slide).',
    slots: {ground: {x: 0, y: 0, w: 960, h: 540, bg: BRAND}, sticker: {x: 716, y: 38, w: 180, h: 180, radius: 90, bg: ON},
      supertitle: {...sup(M, 44, 500), color: ON}, title: {x: M, y: 150, w: 620, h: 204, role: 'Title', valign: 'bottom', color: ON}, tagline: {x: M, y: 366, w: 620, role: 'H2', color: ON},
      description: {x: M, y: 440, w: 620, role: 'Body', color: ON},
      'ask-label': {x: 740, y: 88, w: 132, role: 'Label', align: 'center', color: INK}, ask: {x: 740, y: 108, w: 132, role: 'Body', weight: 600, align: 'center', color: INK}}},
  'cover-three-bands': {group: 'openers', density: 'reading', use: 'Open the deck in three bands: the title on an inverse band, a description in the middle, and up to five section names along a tinted strip, each a link to its slide (hide the footer on this slide).',
    slots: {band: {x: 0, y: 0, w: 960, h: 266, bg: INK}, strip: {x: 0, y: 443, w: 960, h: 97, bg: TINT},
      supertitle: sup(M, 76), title: {x: M, y: 101, w: CW, h: 136, role: 'Title', valign: 'bottom', color: ON},
      description: {x: M, y: 284, w: 720, h: 140, role: 'H2', weight: 400, valign: 'middle'},
      ...seq(5, (k) => [[`section${k}`, {x: M + (k - 1) * 140, y: 480, w: 130, role: 'Body', weight: 600, nowrap: 1}]]), meta: {x: 770, y: 485, w: 130, role: 'Label', align: 'right', nowrap: 1}}},
  'cover-section-rows': {group: 'openers', density: 'reading', use: 'Open the deck with the title on the left 42% and up to five equal section rows in two quiet tones on the right, each a link to its slide (hide the footer on this slide).',
    slots: {...seq(5, (k) => [[`row${k}`, {x: 403, y: (k - 1) * 108, w: 557, h: 108, bg: k % 2 ? TINT : ON}]]), ...namePanel(295, 'H1', 200),
      ...seq(5, (k, y = (k - 1) * 108) => [[`section${k}`, {x: 439, y: y + 40, w: 340, role: 'H2', nowrap: 1}], [`page${k}`, {x: 790, y: y + 47, w: 110, role: 'Label', align: 'right', nowrap: 1}]])},
    dense: NO_DENSE},
  'cover-two-anchors': {group: 'openers', density: 'reading', use: 'Open the deck on a large title and a description at the left, anchored by one fact at the top right and the ask at the bottom right (hide the footer on this slide).',
    slots: {supertitle: sup(M, 112, 540), meta: {x: 640, y: 44, w: 260, role: 'Label', align: 'right', nowrap: 1}, title: {x: M, y: 136, w: CW, h: 136, role: 'Title', valign: 'bottom'},
      description: {x: M, y: 290, w: 600, role: 'H2', weight: 400}, 'ask-label': {x: 540, y: 450, w: 360, role: 'Label', align: 'right'}, ask: {x: 540, y: 468, w: 360, role: 'H2', color: BRAND, align: 'right', nowrap: 1}}},
  'cover-framed': {group: 'openers', density: 'speaker', use: 'Open the deck on a rounded frame over a tinted ground: the title and a tagline in the middle, one short fact in each corner (hide the footer on this slide).',
    slots: {ground: {x: 0, y: 0, w: 960, h: 540, bg: TINT}, frame: {x: 22, y: 22, w: 916, h: 484, radius: 14, bg: ON},
      supertitle: sup(M, 52, 300), meta: {x: 600, y: 53, w: 300, role: 'Label', align: 'right', nowrap: 1}, title: {x: M, y: 134, w: CW, h: 204, role: 'Title', valign: 'bottom'},
      tagline: {x: M, y: 350, w: CW, role: 'H2', color: BRAND}, caption: {x: M, y: 452, w: 400, role: 'Caption'}, ask: {x: 500, y: 452, w: 400, role: 'Caption', color: INK, weight: 600, align: 'right'}}},
  // ── chrome: the template library's own title chrome — a bare canvas under a supertitle + title (content) or a display title (title)
  content: {group: 'chrome', density: 'reading', use: 'Title chrome only — supertitle and H1 — with the canvas free for a template, a figure or free rows.',
    slots: {...head}, dense: NO_NOTE},   // a bare canvas: whatever fills it brings its own caption
  title:   {group: 'chrome', density: 'speaker', use: 'Display-title chrome for a cover or a divider: supertitle above a Title in the lower half.',
    slots: {supertitle: sup(M, 236), title: {x: M, y: 262, w: CW, role: 'Title'}}},
  // ── text
  statement: {group: 'text', density: 'speaker', use: 'Make one claim in display type, alone on the slide.',
    slots: {title: {x: M, y: 180, w: CW, role: 'Title'}, caption: {x: M, y: 420, w: CW, role: 'Caption'}}},
  fact:    {group: 'text', density: 'speaker', use: 'Lead with a number, then name what it is and why it matters.',
    slots: {stat: {x: M, y: 140, w: CW, role: 'Stat'}, label: {x: M, y: 250, w: CW, role: 'Label'}, body: {x: M, y: 290, w: 700, role: 'Body'}}},
  quote:   {group: 'text', density: 'speaker', use: 'Quote someone: the words in italic, the attribution beneath.',
    slots: {quote: {x: M, y: 160, w: CW, role: 'H2', italic: 1}, attribution: {x: M, y: 340, w: CW, role: 'Caption'}}},
  'two-cols': {group: 'text', density: 'reading', use: 'Set two bodies of text side by side under one title.',
    slots: {...head, left: {x: M, y: 160, w: 400, role: 'Body'}, right: {x: 500, y: 160, w: 400, role: 'Body'}}, dense: NO_NOTE},
  'two-cols-header': {group: 'text', density: 'reading', use: 'Set a spanning lede above two columns of text.',
    slots: {...head, header: {x: M, y: 150, w: CW, role: 'H2'}, left: {x: M, y: 210, w: 400, role: 'Body'}, right: {x: 500, y: 210, w: 400, role: 'Body'}}, dense: NO_NOTE},
  bullets: {group: 'text', density: 'reading', use: 'Make four to six points under one title, one line each, a dot per point.',
    slots: {...head, ...bullets(6, M + 36, 160, 780, 44)}, dense: {note: note(M + 36, 416, 780)}},   // under the points, on their column: the sixth ends at 404   // bind three or fewer and the slide is a speaker slide; six is the reading ceiling
  memo: {group: 'text', density: 'reading', use: 'Set the slide as a memo: a title over four ruled header fields, then a paragraph and the ask beside a contents list of up to five sections, each a link to its slide (hide the footer on this slide).',
    slots: {rule: {x: M, y: 222, w: CW, h: 2, bg: INK}, ...seq(4, (k) => [[`field${k}-rule`, {x: M, y: 92 + (k - 1) * 30, w: CW, h: 1, bg: 'var(--line)'}]]),
      title: {x: M, y: 36, w: 560, role: 'H1', nowrap: 1}, meta: {x: 640, y: 54, w: 260, role: 'Label', align: 'right', nowrap: 1},
      ...seq(4, (k, y = 92 + (k - 1) * 30) => [[`field${k}-label`, {x: M, y: y + 9, w: 80, role: 'Label', nowrap: 1}], [`field${k}`, {x: 150, y: y + 7, w: 750, role: 'Caption', color: INK, nowrap: 1}]]),
      body: {x: M, y: 242, w: 450, role: 'Body'}, ask: {x: M, y: 410, w: 450, role: 'Body', weight: 600}, 'contents-label': {x: 570, y: 246, w: 330, role: 'Label'},
      ...seq(5, (k, y = 270 + (k - 1) * 34) => [[`section${k}`, {x: 570, y, w: 280, role: 'Body', nowrap: 1}], [`page${k}`, {x: 860, y: y + 5, w: 40, role: 'Label', align: 'right', nowrap: 1}]])},
    dense: NO_DENSE},
  letter: {group: 'text', density: 'reading', use: 'Set the slide as a letter: a greeting, one paragraph and a signature on the left, and up to five numbered sections down a tinted column on the right, each a link to its slide (hide the footer on this slide).',
    slots: {column: {x: 672, y: 0, w: 288, h: 540, bg: TINT}, supertitle: sup(M, 44, 540), greeting: {x: M, y: 150, w: 560, role: 'H1'}, body: {x: M, y: 204, w: 520, role: 'Body'},
      name: {x: M, y: 420, w: 540, role: 'H2', nowrap: 1}, caption: {x: M, y: 452, w: 540, role: 'Caption'}, 'contents-label': {x: 700, y: 84, w: 200, role: 'Label'},
      ...seq(5, (k, y = 116 + (k - 1) * 76) => [[`n${k}`, {x: 700, y, w: 200, role: 'Label', color: BRAND}], [`section${k}`, {x: 700, y: y + 18, w: 200, role: 'Body', weight: 600}]])}},
  'brief-sheet': {group: 'text', density: 'reading', use: 'Set the slide as a brief sheet: one ruled grid of labelled cells for the subject, a description, the purpose, the ask and a contents list of up to five sections, each a link to its slide (hide the footer on this slide).',
    slots: {grid: {x: 40, y: 30, w: 880, h: 480, bd: '1px solid var(--fg)'}, 'grid-rule1': {x: 668, y: 30, w: 1, h: 480, bg: INK}, 'grid-rule2': {x: 40, y: 215, w: 628, h: 1, bg: INK},
      'grid-rule3': {x: 40, y: 362, w: 628, h: 1, bg: INK}, 'grid-rule4': {x: 417, y: 362, w: 1, h: 148, bg: INK},
      'title-label': {x: M, y: 46, w: 588, role: 'Label'}, title: {x: M, y: 66, w: 588, h: 80, role: 'H1', valign: 'bottom'}, tagline: {x: M, y: 158, w: 588, role: 'Label', color: BRAND},
      'about-label': {x: M, y: 231, w: 588, role: 'Label'}, description: {x: M, y: 251, w: 588, role: 'Body'},
      'purpose-label': {x: M, y: 378, w: 337, role: 'Label'}, purpose: {x: M, y: 398, w: 337, role: 'Body'}, 'fact1-label': {x: M, y: 458, w: 337, role: 'Label'}, fact1: {x: M, y: 476, w: 337, role: 'Caption', color: INK, nowrap: 1},
      'ask-label': {x: 437, y: 378, w: 211, role: 'Label'}, ask: {x: 437, y: 398, w: 211, role: 'Body', weight: 600}, 'fact2-label': {x: 437, y: 458, w: 211, role: 'Label'}, fact2: {x: 437, y: 476, w: 211, role: 'Caption', color: INK, nowrap: 1},
      'contents-label': {x: 688, y: 46, w: 212, role: 'Label'},
      ...seq(5, (k, y = 82 + (k - 1) * 56) => [[`page${k}`, {x: 688, y: y + 5, w: 28, role: 'Label', nowrap: 1}], [`section${k}`, {x: 724, y, w: 176, role: 'Body', weight: 600}]])},
    dense: NO_DENSE},
  // ── visuals
  // beside the image, `body` is the paragraph and b1…b4 are the points — one or the other, never both (validate errors on the pair).
  // The bullet column is indented 36px from the panel edge to leave the dot its 1.25em, and the note sits at the foot (y 424) so
  // four bullets and a note both fit in the panel.
  'image-left': {group: 'visuals', density: 'reading', use: 'Pair an image on the left with a title and a paragraph or points on the right.',
    slots: {image: {x: M, y: 140, w: 400, h: 320}, supertitle: sup(500, 140, 400), title: h1(500, 164, 400), body: {x: 500, y: 300, w: 400, role: 'Body'}, ...bullets(4, 536, 290, 364, 34)},   // a 400px H1 wraps: two lines end at 244, the subtitle sits at 250, the body at 300
    dense: {subtitle: {x: 500, y: 250, w: 400, role: 'H2', weight: 400, color: 'var(--muted)', nowrap: 1}, note: note(500, 424, 400)}},   // beside the image, at the foot of its panel
  'image-right': {group: 'visuals', density: 'reading', use: 'Pair a title and a paragraph or points on the left with an image on the right.',
    slots: {supertitle: sup(M, 140, 400), title: h1(M, 164, 400), body: {x: M, y: 300, w: 400, role: 'Body'}, ...bullets(4, M + 36, 290, 364, 34), image: {x: 500, y: 140, w: 400, h: 320}},
    dense: {subtitle: {x: M, y: 250, w: 400, role: 'H2', weight: 400, color: 'var(--muted)', nowrap: 1}, note: note(M, 424, 400)}},
  // ── modern: the nine Modern templates as slot maps — paint and media slots carry the frame, the slide binds the words
  // (a paint slot bound bare — `{slot:'card1'}` — paints; an `image` or `photo` slot takes `img`; a media frame takes rows placed inside it)
  'bento-grid': {group: 'modern', density: 'reading', use: 'Frame the quarter: one hero cell with a number and a chart, two stat cards, one accent action cell.',
    slots: {...head, hero: {x: M, y: 168, w: 420, h: 268, bg: 'var(--box)', radius: 12}, 'hero-label': {x: 82, y: 190, w: 200, role: 'Label'}, 'hero-value': {x: 82, y: 214, w: 380, role: 'Title', color: 'var(--accent)'}, 'hero-chart': {x: 82, y: 286, w: 376, h: 128},
      ...card(1, 510, 190), ...card(2, 716, 184),
      action: {x: 510, y: 308, w: 390, h: 128, bg: 'var(--accent)', radius: 12}, 'action-label': {x: 530, y: 326, w: 300, role: 'Label', color: 'var(--card)'}, 'action-body': {x: 530, y: 350, w: 350, role: 'Body', color: 'var(--card)'}},
    dense: {note: false}},
  // K20: title dropped `nowrap` and moved up — CW is already the full content width, so a wide title had nowhere to grow into
  // and a font stack a webkit build measures wider than Chromium's overflowed it (995px in a 840px box). Wrapping to two
  // lines is the fallback every other Title-role slot already takes; the scrim gives it room (label/title/caption raised).
  'image-hero-overlay': {group: 'modern', density: 'speaker', use: 'Fill the canvas with one image and carry the words on a scrim across its lower half (hide the footer on this slide).',
    slots: {image: {x: 0, y: 0, w: 960, h: 540, bg: SHOT}, scrim: {x: 0, y: 300, w: 960, h: 240, bg: 'linear-gradient(transparent,rgba(0,0,0,.72))'},
      label: {x: M, y: 320, w: 400, role: 'Label', color: '#fff'}, title: {x: M, y: 344, w: CW, role: 'Title', color: '#fff'}, caption: {x: M, y: 492, w: 520, role: 'Caption', color: 'rgba(255,255,255,.75)'}}},
  'image-split': {group: 'modern', density: 'speaker', use: 'Split the canvas: the argument on the left, one image on the right, a button that carries the link.',
    slots: {image: {x: 520, y: 0, w: 440, h: 540, bg: SHOT}, label: {x: M, y: 150, w: 300, role: 'Label'}, title: {x: M, y: 176, w: 400, role: 'H1'}, body: {x: M, y: 268, w: 400, role: 'Body'},
      button: {x: M, y: 372, w: 180, h: 46, bg: 'var(--accent)', radius: 8}, 'button-label': {x: M, y: 372, w: 180, h: 46, valign: 'middle', role: 'Label', align: 'center', color: 'var(--card)', nowrap: 1}},
    dense: {subtitle: false, note: false, legend: false, source: {x: M, y: 436, w: 400, role: 'Caption'}}},   // the photo owns the right foot: the source is a caption under the button, not a foot-line row
  'annotated-shot': {group: 'modern', density: 'reading', use: 'Pin three callouts to one screenshot with hairline leaders and dots on the screen.',
    slots: {...head, shot: {x: M, y: 170, w: 520, h: 270, bg: SHOT, radius: 10}, ...callout(1, 210), ...callout(2, 300), ...callout(3, 390)},
    dense: {note: false}},
  'three-up-cards': {group: 'modern', density: 'reading', use: 'Set three equal cards, each a number, a heading over a rule, and a body.',
    slots: {...head, ...threeCard(1, M), ...threeCard(2, 348), ...threeCard(3, 636)}, dense: {note: note(M, 420, CW)}},   // under the cards (they end at 408)
  'dashboard-composite': {group: 'modern', density: 'reading', use: 'Stack four KPI cells over a chart, with the reading boxed beside it.',
    slots: {...head, ...kpiCell(1, 60), ...kpiCell(2, 274), ...kpiCell(3, 488), ...kpiCell(4, 702), chart: {x: M, y: 262, w: 500, h: 180},
      panel: {x: 600, y: 262, w: 300, h: 168, bg: 'var(--card)', bd: '1px solid var(--line)', radius: 8}, 'panel-label': {x: 620, y: 282, w: 200, role: 'Label', color: 'var(--accent)'}, 'panel-body': {x: 620, y: 308, w: 260, role: 'Body'}},
    dense: {note: false}},
  'table-insight': {group: 'modern', density: 'reading', use: 'Place a table on the left (its rows inside the frame) and box the conclusion on the right.',
    slots: {...head, table: {x: M, y: 168, w: 500, h: 210}, panel: {x: 600, y: 168, w: 300, h: 250, bg: 'var(--box)', radius: 10},
      'panel-label': {x: 620, y: 190, w: 240, role: 'Label', color: 'var(--accent)'}, 'panel-body': {x: 620, y: 216, w: 260, role: 'Body'},
      'panel-rule': {x: 620, y: 330, w: 260, h: 1, line: [880, 330], bg: 'var(--line)'}, 'panel-next': {x: 620, y: 346, w: 260, role: 'Label'}},
    dense: {note: note(M, 390, 500)}},   // under the table, on its column
  'proof-strip': {group: 'modern', density: 'reading', use: 'Show five logo marks in a strip, then three numbers under one rule.',
    slots: {...head, ...logo(1, 60), ...logo(2, 232), ...logo(3, 404), ...logo(4, 576), ...logo(5, 748), rule: {x: M, y: 310, w: CW, h: 1, line: [900, 310], bg: 'var(--line)'},
      ...proofStat(1, 60), ...proofStat(2, 348), ...proofStat(3, 636)}, dense: {note: note(M, 416, CW)}},   // under the numbers (their labels end at 400)
  'team-grid': {group: 'modern', density: 'reading', use: 'Show four people: a photo, a name and one credential each.',
    slots: {...head, ...person(1, 60), ...person(2, 275), ...person(3, 490), ...person(4, 705)},
    dense: {note: false}},
  // ── numbers
  'kpi-grid': {group: 'numbers', density: 'reading', use: 'Show three KPIs as tiles, each a value with a label and a delta chip.',
    slots: {...head, ...tiles(3, 260, 290), body: {x: M, y: 350, w: CW, role: 'Body'}}, dense: NO_NOTE},   // the body is the reading
  'kpi-grid-4': {group: 'numbers', density: 'reading', use: 'Show four KPIs as tiles, each a value with a label and a delta chip.',
    slots: {...head, ...tiles(4, 195, 215), body: {x: M, y: 350, w: CW, role: 'Body'}}, dense: NO_NOTE},
  stat:    {group: 'numbers', density: 'speaker', use: 'State one hero number at the deck Stat size, with a title above and a caption beneath.',
    slots: {...head, stat: {x: M, y: 170, w: CW, role: 'Stat', align: 'center'}, caption: {x: M, y: 300, w: CW, role: 'Caption', align: 'center'}}, dense: NO_NOTE},   // the caption is the note
  chart:   {group: 'numbers', density: 'reading', use: 'Plot one series (a chart row in the chart slot), then say the takeaway and the source.',
    slots: {...head, chart: {x: M, y: 150, w: CW, h: 262}, takeaway: {x: M, y: 420, w: CW, role: 'Body'}, source: DENSE.source},
    dense: NO_NOTE},   // takeaway is the note, a caption under the chart; the media moved down 14px to seat the subtitle
  comparison: {group: 'numbers', density: 'reading', use: 'Compare two options: a heading and a body for each, side by side.',
    slots: {...head, 'left-head': {x: M, y: 150, w: 400, role: 'H2'}, 'right-head': {x: 500, y: 150, w: 400, role: 'H2'}, left: {x: M, y: 190, w: 400, role: 'Body'}, right: {x: 500, y: 190, w: 400, role: 'Body'}}, dense: NO_NOTE},
  // ── diagrams
  'process-steps': {group: 'diagrams', density: 'reading', use: 'Walk through up to four numbered steps as a row of tiles.',
    slots: {...head, ...cols(4, (k, x) => [[`n${k}`, {x, y: 160, w: 190, role: 'Label'}], [`step${k}-media`, {x, y: 155, w: 24, h: 24}], [`step${k}`, {x, y: 184, w: 190, h: 130, tile: 1, role: 'Body'}]]), body: {x: M, y: 350, w: CW, role: 'Body'}},
    dense: {note: note(M, 410, CW)}},   // under the reading (two lines of body end at 398)
  diagram: {group: 'diagrams', density: 'reading', use: 'Draw one figure (nodes, connectors, a timeline) as rows inside the figure frame, then state its claim in the caption.',
    slots: {...head, supertitle: sup(M, 44), title: h1(M, 68), figure: {x: M, y: 130, w: CW, h: 320}, caption: {x: M, y: 470, w: CW, role: 'Caption'}},
    dense: {subtitle: false, note: false, source: false, legend: false}},   // the figure fills the canvas; the caption is its note
  // ── plans
  timeline: {group: 'plans', density: 'reading', use: 'Place up to four dated events along one rule.',
    slots: {...head, rule: {x: M, y: 220, w: CW, h: 2, line: [900, 220], bg: 'var(--line)'},
      ...cols(4, (k, x) => [[`d${k}`, {x, y: 214, w: 12, h: 12, radius: 6, bg: 'var(--accent)'}], [`d${k}-media`, {x: x - 6, y: 208, w: 24, h: 24}], [`t${k}`, {x, y: 236, w: 190, role: 'Label'}], [`e${k}`, {x, y: 258, w: 190, role: 'Body'}]])},
    dense: {note: note(M, 330, CW)}},   // under the events (two lines end at 306)
  // ── closers
  cta:     {group: 'closers', density: 'speaker', use: 'Ask for the one next step, with a painted button that carries the link.',
    slots: {title: {x: M, y: 150, w: CW, role: 'Title'}, body: {x: M, y: 320, w: 700, role: 'Body'}, button: {x: M, y: 400, w: 260, h: 48, bg: 'var(--accent)', radius: 8}, 'button-label': {x: M, y: 400, w: 260, h: 48, valign: 'middle', role: 'Body', align: 'center', weight: 600, color: 'var(--card)'}}},
  // K20: body moved from 300 to 356 — a Title-role headline that wraps to two lines (136px at the role's line height) reaches
  // 326 from a 190 top; a webkit build measuring the font wider than Chromium's wrapped this row where Chromium's kept it on
  // one line, and body was seated as if the title could never take a second line.
  end:     {group: 'closers', density: 'speaker', use: 'Close the deck: thanks, how to reach you, and a last caption.',
    slots: {title: {x: M, y: 190, w: CW, role: 'Title'}, body: {x: M, y: 356, w: 700, role: 'Body'}, caption: {x: M, y: 450, w: CW, role: 'Caption'}}},
};

// every layout with H1 title chrome carries the dense slots (a deck-defined slot of the same name still wins)
// (a layout's `dense` names its own geometry for a key, or `false` where the key cannot fit — the figure of `diagram`, the note of `chart`)
for (const lay of Object.values(LIBRARY)) if (lay.slots.title && lay.slots.title.role === 'H1') {
  const own = lay.dense || {};
  lay.slots = {...lay.slots, ...Object.fromEntries(Object.entries(DENSE).filter(([k, v]) => !(k in lay.slots) && own[k] !== false && (own[k] || v)).map(([k, v]) => [k, own[k] || v]))};
}
// does one slide have its density's shape? null when it does, else one sentence naming what is missing or over budget
// Over budget, the sentence also LISTS the rows the cap counted (`Body "We moved the date"`) and names the chrome it
// skipped, so the row to cut is visible in the warning — the study's authors read this function to learn the rule.
const CHROME = new Set(['supertitle', 'title', 'subtitle', 'note', 'source', 'legend', 'caption', 'number']);
const CHROME_ROLES = ['Supertitle', 'Title', 'H1', 'Caption', 'Label'];
const SKIPPED = `chrome is not a point: the ${CHROME_ROLES.join(' · ')} roles, and the ${[...CHROME].join(' · ')} slots`;
const plainOf = r => String(r.text ?? r.html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const wordsOf = r => plainOf(r).split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;   // a separator (· → –) is not a word
// one row as `role "the first few words"` — role first, since the fix is almost always to drop or merge a row of one role
const named = (r, lay) => `${r.role || (lay[r.slot] || {}).role || 'Body'} "${plainOf(r).slice(0, 24)}${plainOf(r).length > 24 ? '…' : ''}"`;
const listed = (rows, fn) => rows.slice(0, 12).map(fn).join(' · ') + (rows.length > 12 ? ` · +${rows.length - 12} more` : '');
// one line while it fits a terminal, a clause a line when it does not: this prints once per failing slide, so it stays scannable
const say = (head, ...clauses) => { const one = `${head} — ${clauses.join('; ')}`; return one.length <= 120 ? one : `${head}\n        ${clauses.join('\n        ')}`; };
const STAT_ROLES = ['Stat', 'Stat2'];
const KIND_NAME = {summary: 'a summary slide', numbers: 'a number slide'};
// kind: 'summary' | 'numbers' — validate passes 'numbers' for a Numbers-shelf template; the slide's own kind: 'summary' and
// Stat-led points (Stat rows at least half of the points) are read here
export function densityReport(s, layouts, density, kind) {
  const d = DENSITY[density]; if (!d || !s || !Array.isArray(s.els)) return null;
  const lay = (s.layout && layouts[s.layout] && layouts[s.layout].slots) || (s.layout && layouts[s.layout]) || {};
  const text = s.els.filter(r => r && (r.text != null || r.html != null));
  const bound = new Set(text.map(r => r.slot).filter(Boolean));
  const counted = text.filter(r => !r.graphic);   // a template graphic's value and axis labels are the figure, not words (#165)
  const words = counted.reduce((n, r) => n + wordsOf(r), 0);
  const pointRows = text.filter(r => !CHROME.has(r.slot) && !CHROME_ROLES.includes(r.role || (lay[r.slot] || {}).role));
  const points = pointRows.length;
  const overPoints = k => say(`${k} density carries ≤ ${d.max.points} points, this slide has ${points}`,
    `points: ${listed(pointRows, r => named(r, lay))}`, SKIPPED);
  const statLed = points > 0 && pointRows.filter(r => STAT_ROLES.includes(r.role || (lay[r.slot] || {}).role)).length * 2 >= points;
  const k2 = density === 'reading' && (s.kind === 'summary' ? 'summary' : kind || (statLed ? 'numbers' : null));
  const cap = (k2 && d.max[k2]) || d.max.words;
  const overWords = k => say(`${k} density carries ≤ ${cap} words${k2 ? ` on ${KIND_NAME[k2]}` : ''}, this slide has ${words}`,
    `words: ${listed(counted, r => `${named(r, lay)} ${wordsOf(r)}`)}`, 'every text row counts here, chrome included, but a graphic\'s own labels');
  if (density === 'speaker') {
    if (points > d.max.points) return overPoints('speaker');
    if (words > d.max.words) return overWords('speaker');
    return null;
  }
  const dense = Object.keys(DENSE).filter(k => bound.has(k));
  if (lay.title && lay.title.role === 'H1' && !dense.length && Object.keys(DENSE).some(k => lay[k])) return `reading density: bind at least one of subtitle · note · source · legend (${Object.keys(DENSE).filter(k => lay[k]).join(' · ') || 'none in this layout'})`;
  if (points > d.max.points) return overPoints('reading');
  if (words > cap) return overWords('reading');
  return null;
}
// the layouts a deck references but does not define, scaled from the 960×540 cut to the deck's canvas
export function libraryFor(deck) {
  const sx = (deck.w || 960) / 960, sy = (deck.h || 540) / 540, out = {};
  const scale = sl => Object.fromEntries(Object.entries(sl).map(([k, v]) => [k,
    (k === 'x' || k === 'w' || k === 'right') && typeof v === 'number' ? Math.round(v * sx) : (k === 'y' || k === 'h') && typeof v === 'number' ? Math.round(v * sy)
    : k === 'line' ? [Math.round(v[0] * sx), Math.round(v[1] * sy)] : v]));
  for (const s of deck.slides || []) {
    const n = s && s.layout;
    if (n && LIBRARY[n] && !(deck.layouts || {})[n] && !out[n]) out[n] = Object.fromEntries(Object.entries(LIBRARY[n].slots).map(([k, sl]) => [k, scale(sl)]));
  }
  return out;
}

// the neutral leading the library is cut against (template.html's styles.roles) — how far a slot's box reaches when it declares no h.
// test/layouts.test.mjs holds it to template.html, so a change to the neutral scale cannot drift the printed geometry.
export const NEUTRAL_LH = {Title: 68, Supertitle: 16, H1: 40, H2: 28, Body: 24, Caption: 18, Label: 14, Stat: 44, Stat2: 44};
const CHROME_SLOTS = ['supertitle', 'title', 'subtitle'];              // the title block at the top of a layout
const FOOT_SLOTS = ['note', 'source', 'legend', 'footer'];             // the dense chrome's foot, plus the counter's reserve

// the band a free row may take: under the lowest chrome slot, above the highest foot row (the counter's reserve when there is none).
// Printed with every layout so placing a row beside a bound slot needs no read of this file.
export function freeArea(lay) {
  const s = (lay && lay.slots) || {};
  const ends = CHROME_SLOTS.filter(n => s[n]).map(n => s[n].y + (s[n].h ?? NEUTRAL_LH[s[n].role] ?? 0));
  const feet = FOOT_SLOTS.filter(n => s[n]).map(n => s[n].y);
  const y = ends.length ? Math.max(...ends) : 0, bottom = Math.min(COUNTER.y, ...feet);
  return {x: M, y, w: CW, h: Math.max(0, bottom - y)};
}

const box = sl => {   // x y w h as printed: `r120` = anchored 120 from the right edge, `auto` = width from the text, `-` = no declared height
  const x = sl.right != null ? 'r' + sl.right : String(sl.x ?? 0);
  return [x.padStart(5), String(sl.y ?? 0).padStart(4), String(sl.w ?? '-').padStart(5), String(sl.h ?? '-').padStart(4)].join(' ');
};
const roleOf = sl => sl.role || (sl.line ? 'rule' : sl.h != null && !sl.bg ? 'media' : 'paint');

// what the building agent reads instead of inventing geometry: name · density · use, the free band, then every slot with its box
export function catalogue() {
  const lines = ['geometry is the 960×540 cut (create scales it to the canvas): slot · role · x y w h — r120 = 120 from the right edge, auto = width from the text, - = no declared height',
    'free: the band left under the chrome and above the foot — put free rows there'];
  for (const g of GROUPS) {
    lines.push(g);
    for (const [name, lay] of Object.entries(LIBRARY).filter(([, l]) => l.group === g)) {
      lines.push(`  ${name.padEnd(16)} ${lay.density.padEnd(8)} ${lay.use}`);
      const fa = freeArea(lay);
      lines.push(`  ${''.padEnd(16)} free: x ${fa.x} y ${fa.y} w ${fa.w} h ${fa.h}`);
      for (const [s, sl] of Object.entries(lay.slots)) lines.push(`  ${''.padEnd(16)} ${s.padEnd(14)} ${roleOf(sl).padEnd(11)} ${box(sl)}`);
    }
  }
  return lines.join('\n');
}
