// Proportion (K10, K19): a market number drawn at its size instead of printed in a tile. Each template computes its geometry
// from the filled values: area-bubbles draws a circle whose AREA is the value (a dashed ring, concentric, for a high estimate
// or a forecast), waffle lights one cell of a 10×10 grid per percent, range-bar sets each low–high range on one shared axis
// with an optional marker. Each ships a reading cut (subtitle, a note beside the visual, the source on the foot line — K17)
// and a speaker cut (title, the visual, its labels). Rows a value drives come after the fixed text rows, so t1…tn stay put
// whatever the data's length.
import { M, CW, t, lab, body, rect } from './kit.mjs';

const A = 'var(--accent)';
const num = x => typeof x === 'number' && Number.isFinite(x);
const circle = (cx, cy, d, extra) => rect(Math.round(cx - d / 2), Math.round(cy - d / 2), d, d, { radius: d, ...extra });
// 1 · 2 · 2.5 · 5 × 10ⁿ: the step that splits `max` into at most five intervals
const niceStep = max => { const raw = max / 5, p = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw); };
const fmt = n => String(Math.round(n * 100) / 100);

// ── area-bubbles: 2–5 values across one band, bottom-aligned on a shared baseline; the largest mark (circle or ring) sets the scale
const bubbleCheck = d => {
  const out = [];
  if (d.length < 2 || d.length > 5) out.push(`area-bubbles takes 2–5 values, not ${d.length}`);
  d.forEach((p, k) => { if (p && !(p.value > 0)) out.push(`data[${k}]: value must be positive — a circle's area is its value`);
    if (p && p.ring != null && !(num(p.ring) && p.ring > 0)) out.push(`data[${k}]: ring must be a positive number (the high estimate or forecast the dashed ring draws)`); });
  return out;
};
function bubbles(data, { x0, span, top, dmax, gut = 24 }) {
  const n = data.length, w = (span - gut * (n - 1)) / n, D = Math.min(dmax, w);
  const peak = Math.max(...data.map(p => Math.max(p.value, p.ring || 0)));
  const dia = v => Math.max(2, Math.round(D * Math.sqrt(v / peak))), base = top + D;
  const marks = [], words = [];
  data.forEach((p, i) => {
    const cx = x0 + i * (w + gut) + w / 2, d = dia(p.value), outer = p.ring ? Math.max(d, dia(p.ring)) : d, cy = base - outer / 2;
    if (p.ring) marks.push(circle(cx, cy, dia(p.ring), { bd: `2px dashed ${A}` }));
    marks.push(circle(cx, cy, d, { bg: A }));
    words.push(t(x0 + i * (w + gut), base + 14, w, 'H2', p.text ?? fmt(p.value), { align: 'center', color: A, nowrap: 1 }),
      lab(x0 + i * (w + gut), base + 48, w, p.label ?? '', { align: 'center' }));
  });
  return [...marks, ...words];
}
const BUBBLES = [{ label: 'Farm sensors · 2026', value: 4.2, ring: 5.1, text: '$4.2–5.1B' }, { label: 'Farm software · 2026', value: 2.6, text: '$2.6B' },
  { label: 'Soil probes · 2026–30', value: 0.6, ring: 1.4, text: '$0.6B → $1.4B' }];
const bubbleVals = { data: { kind: 'data', mark: 'bar', check: bubbleCheck, sample: BUBBLES,
  of: '2–5 values — [{label, value, ring?, text?}]; circle area is value, a dashed ring is ring (a high estimate or a forecast), text prints in place of the value' } };

// ── waffle: one percentage as a 10×10 grid, row by row from the top left
function waffle(pct, x0, y0, cell, gap) {
  const on = Math.round(pct);
  return Array.from({ length: 100 }, (_, i) => rect(x0 + (i % 10) * (cell + gap), y0 + Math.floor(i / 10) * (cell + gap), cell, cell,
    { radius: 3, bg: i < on ? A : 'var(--line)' }));
}
const PCT = { pct: { range: [0, 100], sample: 72, of: 'the share the grid lights, one cell per percent; the figure reads it unless its text key is filled' } };

// ── range-bar: 2–5 ranges (2–4 in the reading cut, which keeps a note under the axis) on one axis from 0 to a nice maximum.
// The ticks, labels and values are the data's (label, text), never text keys: `nokey` (#160)
const rangeCheck = most => d => {
  const out = [];
  if (d.length < 2 || d.length > most) out.push(`range-bar takes 2–${most} ranges, not ${d.length}`);
  d.forEach((p, k) => { if (!p) return;
    if (!(p.value >= 0)) out.push(`data[${k}]: value (the low end) must be 0 or more`);
    if (!(num(p.high) && p.high >= p.value)) out.push(`data[${k}]: high must be a number at or above value (the low end)`);
    if (p.mark != null && !(num(p.mark) && p.mark >= p.value && p.mark <= p.high)) out.push(`data[${k}]: mark must sit inside its range, ${p.value}–${p.high}`); });
  return out;
};
function ranges(data, { y0, pitch, labelW, x0, x1, role }) {
  const top = Math.max(...data.map(p => p.high)), step = niceStep(top), max = Math.ceil(top / step - 1e-9) * step || 1;
  const X = v => x0 + (x1 - x0) * v / max, axisY = y0 + data.length * pitch - 12, out = [], words = [];
  for (let v = 0; v <= max + 1e-9; v += step) {
    out.push({ x: Math.round(X(v)), y: y0 - 10, line: [Math.round(X(v)), axisY], h: 1, bg: 'var(--line)' });
    words.push(lab(Math.round(X(v)) - 30, axisY + 8, 60, fmt(v), { align: 'center', nowrap: 1, nokey: 1 }));
  }
  out.push({ x: x0, y: axisY, line: [x1, axisY], h: 1.5, bg: 'var(--fg)' });
  data.forEach((p, i) => { const y = y0 + i * pitch, bx = Math.round(X(p.value));
    out.push(rect(bx, y + 3, Math.max(2, Math.round(X(p.high)) - bx), 14, { bar: 1, bg: A, radius: 7 }));
    if (p.mark != null) out.push(circle(X(p.mark), y + 10, 14, { bg: 'var(--fg)', bd: '2px solid var(--card)' }));
    words.push(t(M, y + (role === 'Body' ? -2 : 1), labelW, role, p.label ?? '', { nowrap: 1, nokey: 1 }),
      lab(x1 + 16, y + 3, 900 - x1 - 16, p.text ?? `${fmt(p.value)}–${fmt(p.high)}`, { nowrap: 1, nokey: 1 }));
  });
  return { rows: [...out, ...words], axisY };
}
const RANGES = [{ label: 'Northwind Research', value: 3.8, high: 5.1, mark: 4.4 }, { label: 'Halcyon Insights', value: 4.2, high: 4.9, mark: 4.5 },
  { label: 'Oakline Partners', value: 3.5, high: 5.6, mark: 4.6 }];
const rangeVals = most => ({ data: { kind: 'data', mark: 'bar', check: rangeCheck(most), sample: RANGES,
  of: `2–${most} ranges — [{label, value, high, mark?, text?}]; the bar runs value→high on one axis from 0, mark draws a point estimate, text prints in place of "value–high"` } });

const chrome = (sup, title) => [{ slot: 'supertitle', text: sup }, { slot: 'title', text: title }];
const NOTE = { color: 'var(--muted)' };

export default [
{ id: 'area-bubbles', name: 'Area bubbles — values at their size', tier: 'core', cat: 'Numbers', density: 'reading', layout: 'content',
  note: '2–5 market numbers as circles whose area is the value, dashed rings for a high estimate or forecast, the note beside.',
  vals: bubbleVals,
  els: v => [ ...chrome('Market size', 'Sensors are the market; probes are the growth.'),
    { slot: 'subtitle', text: 'Analysts put farm sensors at $4.2–5.1B; soil probes more than double by 2030.' },
    body(656, 176, 244, 'Circle area is the value. Dashed rings: the high estimate for sensors, the 2030 forecast for probes.', NOTE),
    { slot: 'source', text: 'Source · three analyst reports, 2026' },
    ...bubbles(v.data, { x0: M, span: 572, top: 176, dmax: 190 }) ] },

{ id: 'area-bubbles-speaker', name: 'Area bubbles — speaker cut', tier: 'core', cat: 'Numbers', density: 'speaker', layout: 'content',
  note: 'The same circles across the full width: title, the values at their size, one label each.',
  vals: bubbleVals,
  els: v => [ ...chrome('Market size', 'Sensors are the market; probes are the growth.'),
    ...bubbles(v.data, { x0: M, span: CW, top: 164, dmax: 210 }) ] },

{ id: 'waffle', name: 'Waffle — a share of 100', tier: 'core', cat: 'Numbers', density: 'reading', layout: 'content',
  note: 'One percentage as a 10×10 grid, the figure and its label beside it, then the note.',
  vals: PCT,
  els: v => [ ...chrome('Latency', 'Most readings land inside fifteen minutes.'),
    { slot: 'subtitle', text: 'Share of field readings that reach the dashboard within 15 minutes.' },
    lab(380, 236, 480, 'of readings arrive inside 15 minutes'),
    body(380, 276, 460, 'The rest wait on gateways that lose power overnight; a battery pack closes most of that gap.', NOTE),
    { slot: 'source', text: 'Source · Fieldsense telemetry, 30 days' },
    ...waffle(v.pct, M, 172, 22, 5),
    t(380, 180, 480, 'Stat', `${Math.round(v.pct)}%`, { color: A, nowrap: 1 }) ] },

{ id: 'waffle-speaker', name: 'Waffle — speaker cut', tier: 'core', cat: 'Numbers', density: 'speaker', layout: 'content',
  note: 'The grid and the figure at display size, one label. Nothing else.',
  vals: PCT,
  els: v => [ ...chrome('Latency', 'Most readings land inside fifteen minutes.'),
    lab(420, 330, 440, 'of readings arrive inside 15 minutes'),
    ...waffle(v.pct, M, 164, 24, 6),
    t(420, 240, 440, 'Title', `${Math.round(v.pct)}%`, { color: A, nowrap: 1 }) ] },

{ id: 'range-bar', name: 'Range bars — estimates on one axis', tier: 'core', cat: 'Numbers', density: 'reading', layout: 'content',
  note: '2–4 low–high ranges on one axis from zero, a point estimate on each, the note under the axis.',
  vals: rangeVals(4),
  els: v => { const r = ranges(v.data, { y0: 184, pitch: 48, labelW: 200, x0: 280, x1: 780, role: 'Label' });
    return [ ...chrome('Market size', 'Three analysts, one range: $4–5B.'),
      { slot: 'subtitle', text: 'Farm sensor market in 2026, each analyst\'s low and high, US$ billions.' },
      body(280, r.axisY + 36, 620, 'The ranges overlap between $4.2B and $4.9B; the dots are each firm\'s point estimate.', NOTE),
      { slot: 'source', text: 'Source · Northwind, Halcyon and Oakline reports, 2026' },
      ...r.rows ]; } },

{ id: 'range-bar-speaker', name: 'Range bars — speaker cut', tier: 'core', cat: 'Numbers', density: 'speaker', layout: 'content',
  note: 'The ranges alone, larger: one label and one figure per row.',
  vals: rangeVals(5),
  els: v => [ ...chrome('Market size', 'Three analysts, one range: $4–5B.'),
    ...ranges(v.data, { y0: 176, pitch: 56, labelW: 200, x0: 280, x1: 780, role: 'Body' }).rows ] },
];
