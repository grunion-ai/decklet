// kit.mjs — the shared vocabulary every candidate template is written in.
// Authored on the 960×540 model canvas; scale() maps a whole template to any
// slide canvas of the same aspect (1600×900 = ×1.667).
export const W = 960, H = 540, M = 60, CW = W - M * 2;

export const t = (x, y, w, role, text, extra = {}) => ({ x, y, w, role, text, ...extra });
export const lab = (x, y, w, text, extra = {}) => t(x, y, w, 'Label', text, extra);
export const cap = (x, y, w, text, extra = {}) => t(x, y, w, 'Caption', text, extra);
export const body = (x, y, w, text, extra = {}) => t(x, y, w, 'Body', text, extra);
export const rect = (x, y, w, h, extra = {}) => ({ x, y, w, h, ...extra });
export const rule = (x, y, x2, extra = {}) => ({ x, y, line: [x2, y], h: 1, bg: 'var(--line)', ...extra });
export const vrule = (x, y, y2, extra = {}) => ({ x, y, line: [x, y2], h: 1, bg: 'var(--line)', ...extra });
export const dot = (x, y, d, extra = {}) => ({ x: x - d / 2, y: y - d / 2, w: d, h: d, radius: d, bg: 'var(--accent)', ...extra });
export const tile = (x, y, w, h, role, text, extra = {}) => ({ x, y, w, h, tile: 1, role, text, ...extra });
export const box = (x, y, w, h, role, text, extra = {}) => ({ x, y, w, h, box: 1, role, text, ...extra });

// A scorecard cell, inside the column box [x, y, w, h]: a 0..4 rating draws the harvey-balls ring (0 · 25 · 50 · 75 · 100
// percent of one 36px donut), anything else is short text centred in the column. The box rides along on `cell`, so `fill`
// can swap one form for the other from the key alone (lib/templates.mjs) and the ring lands centred where the text was.
export const RING = 36;
export const cell = (x, y, w, h, v) => typeof v === 'number'
  ? { x: x + (w - RING) / 2, y: y + (h - RING) / 2, w: RING, donut: v * 25, color: 'var(--accent)', cell: [x, y, w, h] }
  : { ...lab(x, y + (h - 14) / 2, w, String(v), { align: 'center', nowrap: 1 }), cell: [x, y, w, h] };   // 14 = the Label line box

// n columns across a span, with a gutter
export const cols = (n, span = CW, gut = 24, x0 = M) => {
  const w = (span - gut * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + gut), w }));
};
// a column-chart series: bars bottom-aligned on `base`, value labels above, axis labels below
export const bars = (vals, { x0 = M, span = CW, base = 400, max = null, bw = null, gut = 28, color = 'var(--accent)', labels = null, fmt = v => String(v) } = {}) => {
  const top = max ?? Math.max(...vals);
  const w = bw ?? (span - gut * (vals.length - 1)) / vals.length;
  const out = [];
  vals.forEach((v, i) => {
    const h = Math.max(6, Math.round((v / top) * 150));
    const x = x0 + i * (w + gut);
    out.push(rect(x, base - h, w, h, { bar: 1, bg: color }));
    out.push(lab(x, base - h - 20, w, fmt(v), { align: 'center', nowrap: 1 }));
    if (labels) out.push(lab(x, base + 12, w, labels[i], { align: 'center', nowrap: 1 }));
  });
  out.push(rule(x0, base, x0 + span));
  return out;
};
// polyline through points, as straight segments
export const poly = (pts, extra = {}) => pts.slice(1).map((p, i) => ({ x: pts[i][0], y: pts[i][1], line: [p[0], p[1]], h: 2.5, bg: 'var(--accent)', ...extra }));
export const scale = (els, k) => els.map(e => {
  const o = { ...e };
  for (const p of ['x', 'y', 'w', 'h', 'radius', 'gap']) if (typeof o[p] === 'number') o[p] = Math.round(o[p] * k);
  if (Array.isArray(o.cell)) o.cell = o.cell.map(v => Math.round(v * k));
  if (Array.isArray(o.line)) o.line = o.line.map(v => Math.round(v * k));
  if (Array.isArray(o.curve)) o.curve = o.curve.map(v => Math.round(v * k));
  return o;
});
