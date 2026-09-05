// decklet layout library — named layouts in the SAME shape as a deck's `layouts` entry, so `create` needs no new path:
// when a slide names a layout the deck does not define, the library's is merged into `deck.layouts` (scaled to the canvas).
// An accelerant, never a fence — a slide may use a library layout, a deck layout, or free rows, and may mix library
// slots with extra free rows on the same slide. Cut for 960×540 at the neutral scale (Title 64/68, Stat 40/44); a brand
// with a taller display role nudges a slotted row with its own x/y/w/h (the `override` path of slots).
// A slot is a row treatment minus content: geometry + role, and any paint (`tile`, `bg`, `line`, `p`…) the engine spreads
// onto the bound row — so `{slot:'rule'}` alone draws the timeline's rule, and a kpi tile is `{slot:'kpi1', text:'63%'}`.
// library: import {LIBRARY, GROUPS, libraryFor, catalogue} from './layouts.mjs'
export const GROUPS = ['openers', 'text', 'visuals', 'numbers', 'diagrams', 'plans', 'closers'];
const M = 60, CW = 840;   // margin + content width on the 960 canvas
const sup = (x = M, y = 52, w = CW) => ({x, y, w, role: 'Supertitle'});
const h1 = (x = M, y = 76, w = CW) => ({x, y, w, role: 'H1'});
const head = {supertitle: sup(), title: h1()};
const tiles = (n, w, pitch, role = 'Stat2') => {   // Stat2: the KPI allowance — a smaller stat for tiles; the hero `stat` layout keeps Stat
  const o = {};
  for (let k = 0; k < n; k++) {
    const x = M + k * pitch;
    o[`kpi${k + 1}`] = {x, y: 160, w, h: 120, tile: 1, role, align: 'center'};
    o[`kpi${k + 1}-delta`] = {x: x + 12, y: 172, w: 'auto', role: 'Label', p: 'chip', radius: 4, nowrap: 1, bg: 'var(--box)', color: 'var(--ok,var(--accent))'};
    o[`kpi${k + 1}-label`] = {x, y: 292, w, role: 'Label', align: 'center'};
  }
  return o;
};
const cols = (n, mk) => Object.fromEntries([...Array(n)].flatMap((_, k) => mk(k + 1, M + k * 210)));   // k, x at a 210 pitch

export const LIBRARY = {
  // ── openers
  cover:   {group: 'openers', density: 'speaker', use: 'Open the deck: name, one-line promise, who and when.',
    slots: {supertitle: sup(M, 160), title: {x: M, y: 186, w: CW, role: 'Title'}, body: {x: M, y: 380, w: 700, role: 'Body', color: 'var(--muted)'}, caption: {x: M, y: 450, w: CW, role: 'Caption'}}},
  agenda:  {group: 'openers', density: 'reading', use: 'List what the deck covers, up to five numbered items.',
    slots: {...head, ...cols(5, (k) => [[`n${k}`, {x: M, y: 155 + (k - 1) * 60, w: 40, role: 'Label'}], [`item${k}`, {x: M + 50, y: 150 + (k - 1) * 60, w: 790, role: 'Body'}]])}},
  section: {group: 'openers', density: 'speaker', use: 'Divide the deck: a section number and its title, with one line of context.',
    slots: {number: {x: M, y: 190, w: CW, role: 'Label'}, title: {x: M, y: 214, w: CW, role: 'Title'}, body: {x: M, y: 400, w: 700, role: 'Body', color: 'var(--muted)'}}},
  // ── text
  statement: {group: 'text', density: 'speaker', use: 'Make one claim in display type, alone on the slide.',
    slots: {title: {x: M, y: 180, w: CW, role: 'Title'}, caption: {x: M, y: 420, w: CW, role: 'Caption'}}},
  fact:    {group: 'text', density: 'speaker', use: 'Lead with a number, then name what it is and why it matters.',
    slots: {stat: {x: M, y: 140, w: CW, role: 'Stat'}, label: {x: M, y: 250, w: CW, role: 'Label'}, body: {x: M, y: 290, w: 700, role: 'Body'}}},
  quote:   {group: 'text', density: 'speaker', use: 'Quote someone: the words in italic, the attribution beneath.',
    slots: {quote: {x: M, y: 160, w: CW, role: 'H2', italic: 1}, attribution: {x: M, y: 340, w: CW, role: 'Caption'}}},
  'two-cols': {group: 'text', density: 'reading', use: 'Set two bodies of text side by side under one title.',
    slots: {...head, left: {x: M, y: 160, w: 400, role: 'Body'}, right: {x: 500, y: 160, w: 400, role: 'Body'}}},
  'two-cols-header': {group: 'text', density: 'reading', use: 'Set a spanning lede above two columns of text.',
    slots: {...head, header: {x: M, y: 150, w: CW, role: 'H2'}, left: {x: M, y: 210, w: 400, role: 'Body'}, right: {x: 500, y: 210, w: 400, role: 'Body'}}},
  // ── visuals
  'image-left': {group: 'visuals', density: 'reading', use: 'Pair an image on the left with a title and text on the right.',
    slots: {image: {x: M, y: 140, w: 400, h: 320}, supertitle: sup(500, 140, 400), title: h1(500, 164, 400), body: {x: 500, y: 260, w: 400, role: 'Body'}}},
  'image-right': {group: 'visuals', density: 'reading', use: 'Pair a title and text on the left with an image on the right.',
    slots: {supertitle: sup(M, 140, 400), title: h1(M, 164, 400), body: {x: M, y: 260, w: 400, role: 'Body'}, image: {x: 500, y: 140, w: 400, h: 320}}},
  // ── numbers
  'kpi-grid': {group: 'numbers', density: 'reading', use: 'Show three KPIs as tiles, each a value with a label and a delta chip.',
    slots: {...head, ...tiles(3, 260, 290), body: {x: M, y: 350, w: CW, role: 'Body'}}},
  'kpi-grid-4': {group: 'numbers', density: 'reading', use: 'Show four KPIs as tiles, each a value with a label and a delta chip.',
    slots: {...head, ...tiles(4, 195, 215), body: {x: M, y: 350, w: CW, role: 'Body'}}},
  stat:    {group: 'numbers', density: 'speaker', use: 'State one hero number at the deck Stat size, with a title above and a caption beneath.',
    slots: {...head, stat: {x: M, y: 170, w: CW, role: 'Stat', align: 'center'}, caption: {x: M, y: 300, w: CW, role: 'Caption', align: 'center'}}},
  chart:   {group: 'numbers', density: 'reading', use: 'Plot one series (a chart row in the chart slot), then say the takeaway and the source.',
    slots: {...head, chart: {x: M, y: 136, w: CW, h: 276}, takeaway: {x: M, y: 424, w: CW, role: 'Body'}, source: {x: M, y: 458, w: CW, role: 'Caption'}}},
  comparison: {group: 'numbers', density: 'reading', use: 'Compare two options: a heading and a body for each, side by side.',
    slots: {...head, 'left-head': {x: M, y: 150, w: 400, role: 'H2'}, 'right-head': {x: 500, y: 150, w: 400, role: 'H2'}, left: {x: M, y: 190, w: 400, role: 'Body'}, right: {x: 500, y: 190, w: 400, role: 'Body'}}},
  // ── diagrams
  'process-steps': {group: 'diagrams', density: 'reading', use: 'Walk through up to four numbered steps as a row of tiles.',
    slots: {...head, ...cols(4, (k, x) => [[`n${k}`, {x, y: 160, w: 190, role: 'Label'}], [`step${k}`, {x, y: 184, w: 190, h: 130, tile: 1, role: 'Body'}]]), body: {x: M, y: 350, w: CW, role: 'Body'}}},
  // ── plans
  timeline: {group: 'plans', density: 'reading', use: 'Place up to four dated events along one rule.',
    slots: {...head, rule: {x: M, y: 220, w: CW, h: 2, line: [900, 220], bg: 'var(--line)'},
      ...cols(4, (k, x) => [[`d${k}`, {x, y: 214, w: 12, h: 12, radius: 6, bg: 'var(--accent)'}], [`t${k}`, {x, y: 236, w: 190, role: 'Label'}], [`e${k}`, {x, y: 258, w: 190, role: 'Body'}]])}},
  // ── closers
  cta:     {group: 'closers', density: 'speaker', use: 'Ask for the one next step, with a painted button that carries the link.',
    slots: {title: {x: M, y: 150, w: CW, role: 'Title'}, body: {x: M, y: 320, w: 700, role: 'Body'}, button: {x: M, y: 400, w: 260, h: 48, bg: 'var(--accent)', radius: 8}, 'button-label': {x: M, y: 412, w: 260, role: 'Body', align: 'center', weight: 600, color: 'var(--card)'}}},
  end:     {group: 'closers', density: 'speaker', use: 'Close the deck: thanks, how to reach you, and a last caption.',
    slots: {title: {x: M, y: 190, w: CW, role: 'Title'}, body: {x: M, y: 300, w: 700, role: 'Body'}, caption: {x: M, y: 450, w: CW, role: 'Caption'}}},
};

// the layouts a deck references but does not define, scaled from the 960×540 cut to the deck's canvas
export function libraryFor(deck) {
  const sx = (deck.w || 960) / 960, sy = (deck.h || 540) / 540, out = {};
  const scale = sl => Object.fromEntries(Object.entries(sl).map(([k, v]) => [k,
    (k === 'x' || k === 'w') && typeof v === 'number' ? Math.round(v * sx) : (k === 'y' || k === 'h') && typeof v === 'number' ? Math.round(v * sy)
    : k === 'line' ? [Math.round(v[0] * sx), Math.round(v[1] * sy)] : v]));
  for (const s of deck.slides || []) {
    const n = s && s.layout;
    if (n && LIBRARY[n] && !(deck.layouts || {})[n] && !out[n]) out[n] = Object.fromEntries(Object.entries(LIBRARY[n].slots).map(([k, sl]) => [k, scale(sl)]));
  }
  return out;
}

// what the building agent reads instead of inventing geometry: name · density · use · slots (slot·role, or slot·paint)
export function catalogue() {
  const lines = [];
  for (const g of GROUPS) {
    lines.push(g);
    for (const [name, lay] of Object.entries(LIBRARY).filter(([, l]) => l.group === g)) {
      lines.push(`  ${name.padEnd(16)} ${lay.density.padEnd(8)} ${lay.use}`);
      lines.push(`  ${''.padEnd(16)} slots: ` + Object.entries(lay.slots).map(([s, sl]) => `${s}·${sl.role || (sl.line ? 'rule' : sl.h != null && !sl.bg ? 'media' : 'paint')}`).join(' '));
    }
  }
  return lines.join('\n');
}
