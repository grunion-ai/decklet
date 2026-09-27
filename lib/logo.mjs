// decklet logo row, the pure half: one row {logo, name, x, y, h, col, gap, plate, aspect, monogram} → the geometry the
// runtime draws and validate measures. template.html repeats these few lines (the deck is one self-contained file);
// test/logo.test.mjs renders both and holds them to the same numbers.
//
// The slot is FIXED: `col` is its width (not `slot`, which binds a layout slot), and every row in a list that states the same col puts its name at the same x, whatever the logo's
// aspect. The name's FIRST line is centred on the slot (top = (h - lh) / 2), so a name never hangs off the top of a
// taller box. The image contain-fits the slot's inner box; the plate, when painted, hugs the image.
import {initials} from './assets.mjs';

export const PLATES = ['auto', 'light', 'dark', 'none', 'any'];   // 'any' is the manifest's word for "reads on either": no plate
export const PLATE_BG = {light: '#FFFFFF', dark: '#15171B'};
export const GAP = 8;
// the manifest (bin/assets.mjs) says what background a logo NEEDS; a row says what to paint. auto paints the light chip
export const plateOf = p => (p == null || p === 'auto' || p === 'light') ? 'light' : p === 'dark' ? 'dark' : 'none';
export const isLogoRow = r => !!r && typeof r === 'object' && (r.logo !== undefined || r.monogram != null);
export const monogramOf = r => String(r.monogram || initials(r.name || '?')).slice(0, 3);
export const padOf = (h, plate) => plate === 'none' ? 0 : Math.max(2, Math.round(h * 0.14));

// K26: col:'auto' is the painted logo's own width — the plate hugging the mark at full height ((h − 2·pad)·aspect + 2·pad),
// the monogram's square, or the 2h default when the aspect is unknown — so a name sits one GAP after the logo. expandTemplates
// writes the number into the row before validate or create reads it, so the runtime only ever sees a number.
export function autoCol(r) {
  if (r.col !== 'auto') return r.col;
  if (!r.logo) return r.h;
  if (!(r.aspect > 0)) return r.h * 2;
  const p = padOf(r.h, plateOf(r.plate));
  return (r.h - 2 * p) * r.aspect + 2 * p;
}

// {h, col, gap, aspect, plate, logo} + the name's line height → boxes relative to the row origin. col defaults to 2h; lh to h.
export function logoGeom(r, lh) {
  const h = r.h, slot = autoCol(r) ?? h * 2, gap = r.gap ?? GAP, L = lh ?? h;
  const name = {x: slot + gap, y: Math.round((h - L) / 2), lh: L};
  const top = Math.min(0, name.y), bottom = Math.max(h, name.y + L);
  if (!r.logo) {   // the monogram chip: a square the height of the row, never wider than the slot
    const s = Math.min(h, slot);
    return {slot, gap, name, top, bottom, plate: null, img: null, mono: {x: 0, y: Math.round((h - s) / 2), w: s, h: s, text: monogramOf(r), radius: Math.round(s * 0.22)}};
  }
  const kind = plateOf(r.plate), p = padOf(h, kind), iw0 = slot - 2 * p, ih0 = h - 2 * p;
  // with the manifest's aspect the image box is exact; without it the image gets the whole inner box and object-fit contains it
  const iw = r.aspect > 0 ? Math.min(iw0, ih0 * r.aspect) : iw0, ih = r.aspect > 0 ? Math.min(ih0, iw / r.aspect) : ih0;
  const img = {x: p, y: (h - ih) / 2, w: iw, h: ih};
  const plate = kind === 'none' ? null : {x: 0, y: 0, w: iw + 2 * p, h, bg: PLATE_BG[kind], radius: Math.round(h * 0.22)};
  return {slot, gap, name, top, bottom, plate, img, mono: null};
}
