// The connector row (K3, K4, K16): {from:'rowId', to:'rowId', style:'arrow'|'dashed'|'blocked', gap}. The engine routes the
// stroke between the two rows' edges and insets BOTH ends by the gap, so an arrow never starts flush on the box it leaves or
// tips onto the chip it points at. validate routes on the declared boxes; template.html routes on the rendered ones (the
// same arithmetic, held equal by test/connector.test.mjs — ROUTE there is this function's text).
export const STYLES = ['arrow', 'dashed', 'blocked'];
export const CGAP = 6;   // the air at each end when neither the row nor styles.gap names one
export const isConnector = r => !!r && typeof r === 'object' && r.style != null && r.line == null && r.curve == null;
export const gapOf = (r, styles) => typeof r.gap === 'number' ? r.gap : styles && typeof styles.gap === 'number' ? styles.gap : CGAP;

// route(A, B, g): boxes {x,y,w,h} → {x, y, line:[x2,y2], len}. Side by side (the wider gutter is horizontal) runs across at the
// middle of the rows' shared height; stacked runs down at the middle of their shared width; boxes that share no band run from
// centre line to centre line (validate calls that diagonal). null when the boxes overlap — there is no gutter to cross.
export const route = (A, B, g) => {
  if (!A || !B) return null;
  const gx = Math.max(B.x - (A.x + A.w), A.x - (B.x + B.w)), gy = Math.max(B.y - (A.y + A.h), A.y - (B.y + B.h));
  if (gx <= 0 && gy <= 0) return null;
  const mid = (a0, a1, b0, b1, ca, cb) => { const lo = Math.max(a0, b0), hi = Math.min(a1, b1); return lo <= hi ? [(lo + hi) / 2, (lo + hi) / 2] : [ca, cb]; };
  let x, y, x2, y2;
  if (gx >= gy) {
    const d = B.x > A.x ? 1 : -1;
    [y, y2] = mid(A.y, A.y + A.h, B.y, B.y + B.h, A.y + A.h / 2, B.y + B.h / 2);
    x = d > 0 ? A.x + A.w + g : A.x - g; x2 = d > 0 ? B.x - g : B.x + B.w + g;
  } else {
    const d = B.y > A.y ? 1 : -1;
    [x, x2] = mid(A.x, A.x + A.w, B.x, B.x + B.w, A.x + A.w / 2, B.x + B.w / 2);
    y = d > 0 ? A.y + A.h + g : A.y - g; y2 = d > 0 ? B.y - g : B.y + B.h + g;
  }
  return {x, y, line: [x2, y2], len: Math.max(gx, gy) > 2 * g ? Math.hypot(x2 - x, y2 - y) : 0};   // len 0: the insets meet or cross
};

// what each style draws: an arrow carries a head at `to`; a dashed link and a blocked link are dashed and headless unless the
// row says otherwise. A blocked link also carries a marker at its midpoint, sized to the run (never a hand-placed disc).
export const strokeOf = r => r.style === 'arrow' ? {arrow: r.arrow ?? 'end'} : {dash: r.dash ?? 1, ...(r.arrow ? {arrow: r.arrow} : {})};
export const markerSize = len => Math.max(14, Math.min(40, Math.round(len * 0.6)));
