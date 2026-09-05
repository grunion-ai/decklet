// decklet chart row — `{x,y,w,h, chart:{mark:'bar'|'line', data:[{label,value,compare?,muted?,text?}], encoding?:{max,min},
// annotations?:[{at,text}], source?}}` expands at create time into the ordinary rows agents were hand-building: bars, lines,
// dots and Label rows. The output deck stays hand-editable and the runtime draws no charts. The drawing rules are baked in:
//   bars start at zero · one explicit scale with a max label · direct value labels, no legend · grey dashed baseline ·
//   monochrome depth (first series full accent, a `compare` series at 60%, a `muted:true` item grey) · a line is one stroke
//   with dots · an annotation is a green dot + words + a hairline leader · the source sits in Caption at the bottom ·
//   value labels beside a rising stroke are placed where they touch nothing (the branded deck had to offset them by hand).
// library: import {chartRows, expandCharts, checkChart} from './chart.mjs'
const MARKS = ['bar', 'line'];
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const ACC = 'var(--accent)', OK = 'var(--ok,var(--accent))', GREY = 'var(--muted)';
const fmt = v => v.toLocaleString('en-US', {maximumFractionDigits: 2});
// the smallest 1·2·5 × 10^k at or above v — the one explicit scale
const nice = v => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => m * p).find(m => m >= v - 1e-9); };

export function checkChart(c) {
  const e = [];
  if (!c || typeof c !== 'object') return ['chart must be an object'];
  if (!MARKS.includes(c.mark)) e.push(`chart mark "${c.mark}" not one of ${MARKS.join('|')}`);
  const data = Array.isArray(c.data) ? c.data : [];
  if (data.length < 2) e.push(`chart needs at least two data points (${data.length})`);
  else if (!data.some(d => d && isNum(d.value))) e.push('chart has no numbers — no numbers, no chart');
  else data.forEach((d, k) => { if (!d || !isNum(d.value)) e.push(`chart data[${k}]: value must be a number`); if (d && d.compare != null && !isNum(d.compare)) e.push(`chart data[${k}]: compare must be a number`); });
  for (const a of c.annotations || []) if (!a || !Number.isInteger(a.at) || a.at < 0 || a.at >= data.length || typeof a.text !== 'string') e.push(`chart annotation at ${a && a.at} is off the data (${data.length} points) or has no text`);
  if (c.encoding && c.encoding.max != null && !(isNum(c.encoding.max) && c.encoding.max > 0)) e.push('chart encoding.max must be a positive number');
  return e;
}

// the rows for ONE chart row whose x/y/w/h are resolved; `roles` supplies Label/Caption line heights
export function chartRows(r, roles) {
  const c = r.chart, {x, y, w, h} = r, L = roles.Label.lh, C = roles.Caption.lh, data = c.data, n = data.length;
  const G = 52, x0 = x + G, pw = w - G;                                     // left gutter holds the scale ticks
  const srcH = c.source ? C + 6 : 0, top = y + L + (c.mark === 'line' ? 10 : 6), base = y + h - srcH - (L + 8), ph = base - top;
  const vals = data.flatMap(d => [d.value, d.compare]).filter(isNum);
  const min = c.mark === 'line' && c.encoding && isNum(c.encoding.min) ? c.encoding.min : 0;   // bars ALWAYS start at zero
  const max = (c.encoding && c.encoding.max) || nice(Math.max(...vals));
  const py = v => Math.round(base - ph * (v - min) / (max - min));
  const slot = pw / n, sx = k => Math.round(x0 + k * slot);
  const label = (o, text) => ({role: 'Label', nowrap: 1, ...o, text});
  const rows = [
    {x: x0, y: base, line: [x0 + pw, base], h: 1, bg: GREY, dash: 1},                                   // grey dashed baseline
    {x: x + G - 8, y: top, line: [x + G - 2, top], h: 1, bg: GREY},                                     // the max tick…
    label({x, y: top - Math.round(L / 2), w: G - 10, align: 'right'}, fmt(max)),                        // …and its label: the scale
    label({x, y: base - Math.round(L / 2), w: G - 10, align: 'right'}, fmt(min)),
  ];
  const cmp = data.some(d => isNum(d.compare));
  if (c.mark === 'bar') {
    const bw = Math.round(slot * (cmp ? 0.3 : 0.6));
    data.forEach((d, k) => {
      const bx = Math.round(sx(k) + (slot - (cmp ? bw * 2 + 4 : bw)) / 2);
      const put = (bx, v, series) => { const by = py(v);
        rows.push({x: bx, y: by, w: bw, h: base - by, bar: 1, bg: series ? ACC : d.muted ? GREY : ACC, ...(series || d.muted ? {op: 0.6} : {})});
        rows.push(label({x: cmp ? bx : sx(k), y: by - L - 4, w: cmp ? bw : Math.round(slot), align: 'center', color: 'var(--fg)'}, series ? fmt(v) : (d.text ?? fmt(v)))); };
      put(bx, d.value, 0); if (cmp && isNum(d.compare)) put(bx + bw + 4, d.compare, 1);
      rows.push(label({x: sx(k), y: base + 8, w: Math.round(slot), align: 'center'}, d.label));
    });
  } else {
    const pt = (k, v) => ({x: Math.round(sx(k) + slot / 2), y: py(v)});
    const P = data.map((d, k) => pt(k, d.value)), ann = new Map((c.annotations || []).map(a => [a.at, a.text]));
    const segs = [], obstacles = [];   // obstacles: [x0,y0,x1,y1] strokes and {x,y,w,h} rects a label may not touch
    const series = (pts, op) => { for (let k = 0; k + 1 < pts.length; k++) { const s = {x: pts[k].x, y: pts[k].y, line: [pts[k + 1].x, pts[k + 1].y], h: 2.5, bg: ACC, ...(op ? {op} : {})}; rows.push(s); segs.push([s.x, s.y, ...s.line]); obstacles.push(segs.at(-1)); } };
    if (cmp) series(data.map((d, k) => pt(k, isNum(d.compare) ? d.compare : d.value)), 0.6);
    series(P);
    P.forEach((p, k) => { const a = ann.has(k), d = a ? 5 : 4; rows.push({x: p.x - d, y: p.y - d, w: d * 2, h: d * 2, radius: d, bg: a ? OK : ACC}); obstacles.push({x: p.x - d, y: p.y - d, w: d * 2, h: d * 2}); });
    // annotation: words at the top of the box, a hairline leader straight down to the dot
    for (const [k, text] of ann) { const p = P[k], ww = 200, wx = Math.max(x0, Math.min(x + w - ww, p.x - ww / 2));
      rows.push({x: wx, y, w: ww, role: 'Caption', align: 'center', nowrap: 1, text});
      rows.push({x: p.x, y: y + C + 2, line: [p.x, p.y - 9], h: 1, bg: GREY});
      obstacles.push({x: wx, y, w: ww, h: C}, [p.x, y + C + 2, p.x, p.y - 9]); }
    // value labels: the first candidate spot that touches no stroke, dot or placed label. A rising stroke leaves the
    // upper-right occupied, so above-left wins there; an annotated point keeps its leader clear by going below.
    // parity judges a dot with its radius+1 of tolerance around the glyphs, a stroke with half its width+1: keep 7px from a
    // rect, 3px from a stroke, and stand every candidate dot-radius+8 off the point so a diagonal spot clears the dot's corner
    const LW = 46, clear = rect => !obstacles.some(o => Array.isArray(o) ? cross(o, rect, 3) : overlap(o, rect, 7)) && rect.x >= x && rect.x + rect.w <= x + w && rect.y >= y;
    P.forEach((p, k) => {
      const o = (ann.has(k) ? 5 : 4) + 8;
      const above = [[p.x - LW / 2, p.y - o - L], [p.x - o - LW, p.y - o - L], [p.x + o, p.y - o - L]], below = [[p.x - LW / 2, p.y + o], [p.x - o - LW, p.y + o], [p.x + o, p.y + o]];
      const cands = (ann.has(k) ? [...below, ...above] : [...above, ...below]).map(([cx, cy]) => ({x: Math.round(cx), y: Math.round(cy), w: LW, h: L}));
      const spot = cands.find(clear) || {...cands[0], over: 1};
      rows.push(label({x: spot.x, y: spot.y, w: LW, align: 'center', color: 'var(--fg)', ...(spot.over ? {over: 1} : {})}, data[k].text ?? fmt(data[k].value)));
      obstacles.push({x: spot.x, y: spot.y, w: LW, h: L});
    });
    data.forEach((d, k) => rows.push(label({x: sx(k), y: base + 8, w: Math.round(slot), align: 'center'}, d.label)));
  }
  if (c.source) rows.push({x, y: y + h - C, w, role: 'Caption', text: c.source});
  return rows;
}
const overlap = (a, b, m) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > -m && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > -m;
const cross = (s, r, m) => { for (let k = 0; k <= 32; k++) { const t = k / 32, px = s[0] + (s[2] - s[0]) * t, py = s[1] + (s[3] - s[1]) * t;
  if (px > r.x - m && px < r.x + r.w + m && py > r.y - m && py < r.y + r.h + m) return true; } return false; };

// replace every VALID chart row in the deck with its rows (slot geometry resolved); invalid ones stay for validate to report
export function expandCharts(deck) {
  const roles = deck.styles && deck.styles.roles; if (!roles || !roles.Label || !roles.Caption) return deck;
  for (const s of deck.slides || []) {
    if (!s || !Array.isArray(s.els)) continue;
    for (let k = s.els.length - 1; k >= 0; k--) {
      const r = s.els[k]; if (!r || !r.chart || checkChart(r.chart).length) continue;
      const sl = (r.slot && ((deck.slots || {})[r.slot] || ((deck.layouts || {})[s.layout] || {})[r.slot])) || {};
      const g = {x: r.x ?? sl.x ?? 0, y: r.y ?? sl.y ?? 0, w: r.w ?? sl.w ?? 0, h: r.h ?? sl.h ?? 0};
      s.els.splice(k, 1, ...chartRows({...g, chart: r.chart}, roles));
    }
  }
  return deck;
}
