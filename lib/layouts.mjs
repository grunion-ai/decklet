// decklet layout library — named layouts in the SAME shape as a deck's `layouts` entry, so `create` needs no new path:
// when a slide names a layout the deck does not define, the library's is merged into `deck.layouts` (scaled to the canvas).
// An accelerant, never a fence — a slide may use a library layout, a deck layout, or free rows, and may mix library
// slots with extra free rows on the same slide. Cut for 960×540 at the neutral scale (Title 64/68, Stat 40/44); a brand
// with a taller display role nudges a slotted row with its own x/y/w/h (the `override` path of slots).
// A slot is a row treatment minus content: geometry + role, and any paint (`tile`, `bg`, `line`, `p`…) the engine spreads
// onto the bound row — so `{slot:'rule'}` alone draws the timeline's rule, and a kpi tile is `{slot:'kpi1', text:'63%'}`.
// Composite slots (a kpi tile, a numbered step, a timeline event, the cta button) share a `group`, so the editor moves them as one.
// library: import {LIBRARY, GROUPS, libraryFor, catalogue} from './layouts.mjs'
export const GROUPS = ['openers', 'chrome', 'text', 'visuals', 'numbers', 'diagrams', 'plans', 'closers'];
const M = 60, CW = 840;   // margin + content width on the 960 canvas
const sup = (x = M, y = 52, w = CW) => ({x, y, w, role: 'Supertitle'});
const h1 = (x = M, y = 76, w = CW) => ({x, y, w, role: 'H1'});
const head = {supertitle: sup(), title: h1()};
const tiles = (n, w, pitch, role = 'Stat2') => {   // Stat2: the KPI allowance — a smaller stat for tiles; the hero `stat` layout keeps Stat
  const o = {};
  for (let k = 0; k < n; k++) {
    const x = M + k * pitch, group = `kpi${k + 1}`;   // tile + chip + label move as one card
    o[`kpi${k + 1}`] = {x, y: 160, w, h: 120, tile: 1, role, align: 'center', group};
    // a w:'auto' chip has no width to place by x — it hangs 12px in from the tile's right edge via `right`
    o[`kpi${k + 1}-delta`] = {right: 960 - (x + w) + 12, y: 172, w: 'auto', role: 'Label', p: 'chip', radius: 4, nowrap: 1, bg: 'var(--box)', color: 'var(--ok,var(--accent))', group};
    o[`kpi${k + 1}-label`] = {x, y: 292, w, role: 'Label', align: 'center', group};
  }
  return o;
};
const cols = (n, mk) => Object.fromEntries([...Array(n)].flatMap((_, k) => mk(k + 1, M + k * 210)));   // k, x at a 210 pitch

// DENSITY — two named densities, defined here so "make it dense" / "keep it fluffy" builds the same deck every time.
//   speaker (fluffy): the presenter carries the argument; the slide is one idea in big type. ≤ 3 points, ≤ 40 words of body.
//   reading (dense):  a leave-behind read without a speaker; the slide carries its own context: a subtitle under the title,
//                     a note or description, a source line, a legend, the footer naming the deck. ≤ 8 points, ≤ 140 words.
// A deck says `density`; a slide may override with its own. validate reports the slides that miss their density's shape.
export const DENSITY = {
  speaker: {aka: 'fluffy', for: 'a presented deck — the speaker carries the rest',
    carries: ['supertitle', 'title', 'one figure, number or ≤ 3 points', 'a caption at most'],
    max: {points: 3, words: 40}},
  reading: {aka: 'dense', for: 'a leave-behind read without a speaker — the slide carries its own context',
    carries: ['supertitle', 'title', 'subtitle (the claim in one sentence)', 'the figure or the points', 'note (what to make of it)', 'source', 'legend', 'footer naming the deck'],
    max: {points: 8, words: 140}},
};
// the dense chrome: four optional slots every title-chrome layout carries. Unbound, they draw nothing; a reading deck binds them.
export const DENSE = {
  subtitle: {x: M, y: 118, w: CW, role: 'H2', color: 'var(--muted)', nowrap: 1},      // the claim in ONE line under the H1 (parity fails a wrap)
  note:     {x: M, y: 424, w: 700, role: 'Body', color: 'var(--muted)'},              // what to make of the figure — two lines end at 472
  source:   {x: M, y: 474, w: 560, role: 'Caption'},                                   // where the numbers came from, left foot (ends 492, above the footer)
  legend:   {right: M, y: 474, w: 'auto', role: 'Label', nowrap: 1},                   // series or symbol key, right foot
};
export const LIBRARY = {
  // ── openers
  cover:   {group: 'openers', density: 'speaker', use: 'Open the deck: name, one-line promise, who and when.',
    slots: {supertitle: sup(M, 160), title: {x: M, y: 186, w: CW, role: 'Title'}, body: {x: M, y: 380, w: 700, role: 'Body', color: 'var(--muted)'}, caption: {x: M, y: 450, w: CW, role: 'Caption'}}},
  agenda:  {group: 'openers', density: 'reading', use: 'List what the deck covers, up to five numbered items.',
    slots: {...head, ...cols(5, (k) => [[`n${k}`, {x: M, y: 155 + (k - 1) * 60, w: 40, role: 'Label'}], [`item${k}`, {x: M + 50, y: 150 + (k - 1) * 60, w: 790, role: 'Body'}]])}},
  section: {group: 'openers', density: 'speaker', use: 'Divide the deck: a section number and its title, with one line of context.',
    slots: {number: {x: M, y: 190, w: CW, role: 'Label'}, title: {x: M, y: 214, w: CW, role: 'Title'}, body: {x: M, y: 400, w: 700, role: 'Body', color: 'var(--muted)'}}},
  // ── chrome: the template library's own title chrome — a bare canvas under a supertitle + title (content) or a display title (title)
  content: {group: 'chrome', density: 'reading', use: 'Title chrome only — supertitle and H1 — with the canvas free for a template, a figure or free rows.',
    slots: {...head}},
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
    slots: {...head, left: {x: M, y: 160, w: 400, role: 'Body'}, right: {x: 500, y: 160, w: 400, role: 'Body'}}},
  'two-cols-header': {group: 'text', density: 'reading', use: 'Set a spanning lede above two columns of text.',
    slots: {...head, header: {x: M, y: 150, w: CW, role: 'H2'}, left: {x: M, y: 210, w: 400, role: 'Body'}, right: {x: 500, y: 210, w: 400, role: 'Body'}}},
  // ── visuals
  'image-left': {group: 'visuals', density: 'reading', use: 'Pair an image on the left with a title and text on the right.',
    slots: {image: {x: M, y: 140, w: 400, h: 320}, supertitle: sup(500, 140, 400), title: h1(500, 164, 400), body: {x: 500, y: 300, w: 400, role: 'Body'}},   // a 400px H1 wraps: two lines end at 244, the subtitle sits at 250, the body at 300
    dense: {subtitle: {x: 500, y: 250, w: 400, role: 'H2', color: 'var(--muted)', nowrap: 1}, note: {x: 500, y: 400, w: 400, role: 'Body', color: 'var(--muted)'}, source: {x: M, y: 476, w: 560, role: 'Caption'}, legend: {right: M, y: 476, w: 'auto', role: 'Label', nowrap: 1}}},
  'image-right': {group: 'visuals', density: 'reading', use: 'Pair a title and text on the left with an image on the right.',
    slots: {supertitle: sup(M, 140, 400), title: h1(M, 164, 400), body: {x: M, y: 300, w: 400, role: 'Body'}, image: {x: 500, y: 140, w: 400, h: 320}},
    dense: {subtitle: {x: M, y: 250, w: 400, role: 'H2', color: 'var(--muted)', nowrap: 1}, note: {x: M, y: 400, w: 400, role: 'Body', color: 'var(--muted)'}, source: {x: M, y: 476, w: 560, role: 'Caption'}, legend: {right: M, y: 476, w: 'auto', role: 'Label', nowrap: 1}}},
  // ── numbers
  'kpi-grid': {group: 'numbers', density: 'reading', use: 'Show three KPIs as tiles, each a value with a label and a delta chip.',
    slots: {...head, ...tiles(3, 260, 290), body: {x: M, y: 350, w: CW, role: 'Body'}}},
  'kpi-grid-4': {group: 'numbers', density: 'reading', use: 'Show four KPIs as tiles, each a value with a label and a delta chip.',
    slots: {...head, ...tiles(4, 195, 215), body: {x: M, y: 350, w: CW, role: 'Body'}}},
  stat:    {group: 'numbers', density: 'speaker', use: 'State one hero number at the deck Stat size, with a title above and a caption beneath.',
    slots: {...head, stat: {x: M, y: 170, w: CW, role: 'Stat', align: 'center'}, caption: {x: M, y: 300, w: CW, role: 'Caption', align: 'center'}}},
  chart:   {group: 'numbers', density: 'reading', use: 'Plot one series (a chart row in the chart slot), then say the takeaway and the source.',
    slots: {...head, chart: {x: M, y: 150, w: CW, h: 262}, takeaway: {x: M, y: 420, w: CW, role: 'Body'}, source: {x: M, y: 476, w: 560, role: 'Caption'}},
    dense: {note: false, legend: {right: M, y: 476, w: 'auto', role: 'Label', nowrap: 1}}},   // takeaway is the note (two lines fit above the source); the media moved down 14px to seat the subtitle
  comparison: {group: 'numbers', density: 'reading', use: 'Compare two options: a heading and a body for each, side by side.',
    slots: {...head, 'left-head': {x: M, y: 150, w: 400, role: 'H2'}, 'right-head': {x: 500, y: 150, w: 400, role: 'H2'}, left: {x: M, y: 190, w: 400, role: 'Body'}, right: {x: 500, y: 190, w: 400, role: 'Body'}}},
  // ── diagrams
  'process-steps': {group: 'diagrams', density: 'reading', use: 'Walk through up to four numbered steps as a row of tiles.',
    slots: {...head, ...cols(4, (k, x) => [[`n${k}`, {x, y: 160, w: 190, role: 'Label', group: `step${k}`}], [`step${k}`, {x, y: 184, w: 190, h: 130, tile: 1, role: 'Body', group: `step${k}`}]]), body: {x: M, y: 350, w: CW, role: 'Body'}}},
  diagram: {group: 'diagrams', density: 'reading', use: 'Draw one figure (nodes, connectors, a timeline) as rows inside the figure frame, then state its claim in the caption.',
    slots: {...head, supertitle: sup(M, 44), title: h1(M, 68), figure: {x: M, y: 130, w: CW, h: 320}, caption: {x: M, y: 470, w: CW, role: 'Caption'}},
    dense: {subtitle: false, note: false, source: false, legend: false}},   // the figure fills the canvas; the caption is its note
  // ── plans
  timeline: {group: 'plans', density: 'reading', use: 'Place up to four dated events along one rule.',
    slots: {...head, rule: {x: M, y: 220, w: CW, h: 2, line: [900, 220], bg: 'var(--line)'},
      ...cols(4, (k, x) => [[`d${k}`, {x, y: 214, w: 12, h: 12, radius: 6, bg: 'var(--accent)', group: `e${k}`}], [`t${k}`, {x, y: 236, w: 190, role: 'Label', group: `e${k}`}], [`e${k}`, {x, y: 258, w: 190, role: 'Body', group: `e${k}`}]])}},
  // ── closers
  cta:     {group: 'closers', density: 'speaker', use: 'Ask for the one next step, with a painted button that carries the link.',
    slots: {title: {x: M, y: 150, w: CW, role: 'Title'}, body: {x: M, y: 320, w: 700, role: 'Body'}, button: {x: M, y: 400, w: 260, h: 48, bg: 'var(--accent)', radius: 8, group: 'button'}, 'button-label': {x: M, y: 400, w: 260, h: 48, valign: 'middle', role: 'Body', align: 'center', weight: 600, color: 'var(--card)', group: 'button'}}},
  end:     {group: 'closers', density: 'speaker', use: 'Close the deck: thanks, how to reach you, and a last caption.',
    slots: {title: {x: M, y: 190, w: CW, role: 'Title'}, body: {x: M, y: 300, w: 700, role: 'Body'}, caption: {x: M, y: 450, w: CW, role: 'Caption'}}},
};

// every layout with H1 title chrome carries the dense slots (a deck-defined slot of the same name still wins)
// (a layout's `dense` names its own geometry for a key, or `false` where the key cannot fit — the figure of `diagram`, the note of `chart`)
for (const lay of Object.values(LIBRARY)) if (lay.slots.title && lay.slots.title.role === 'H1') {
  const own = lay.dense || {};
  lay.slots = {...lay.slots, ...Object.fromEntries(Object.entries(DENSE).filter(([k]) => !(k in lay.slots) && own[k] !== false).map(([k, v]) => [k, own[k] || v]))};
}
// does one slide have its density's shape? null when it does, else one sentence naming what is missing or over budget
const CHROME = new Set(['supertitle', 'title', 'subtitle', 'note', 'source', 'legend', 'caption', 'number']);
export function densityReport(s, layouts, density) {
  const d = DENSITY[density]; if (!d || !s || !Array.isArray(s.els)) return null;
  const lay = (s.layout && layouts[s.layout] && layouts[s.layout].slots) || (s.layout && layouts[s.layout]) || {};
  const text = s.els.filter(r => r && (r.text != null || r.html != null));
  const bound = new Set(text.map(r => r.slot).filter(Boolean));
  const words = text.reduce((n, r) => n + String(r.text ?? r.html).replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length, 0);
  const points = text.filter(r => !CHROME.has(r.slot) && !['Supertitle', 'Title', 'H1', 'Caption', 'Label'].includes(r.role || (lay[r.slot] || {}).role)).length;
  if (density === 'speaker') {
    if (points > d.max.points) return `speaker density carries ≤ ${d.max.points} points, this slide has ${points}`;
    if (words > d.max.words) return `speaker density carries ≤ ${d.max.words} words, this slide has ${words}`;
    return null;
  }
  const dense = Object.keys(DENSE).filter(k => bound.has(k));
  if (lay.title && lay.title.role === 'H1' && !dense.length && Object.keys(DENSE).some(k => lay[k])) return `reading density: bind at least one of subtitle · note · source · legend (${Object.keys(DENSE).filter(k => lay[k]).join(' · ') || 'none in this layout'})`;
  if (points > d.max.points) return `reading density carries ≤ ${d.max.points} points, this slide has ${points}`;
  if (words > d.max.words) return `reading density carries ≤ ${d.max.words} words, this slide has ${words}`;
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
