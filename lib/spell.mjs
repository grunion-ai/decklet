// decklet spell — option C: the build checks every word once, the deck carries the flagged list, the editor underlines
// them on every slide in every browser (CSS Highlight API). The browser's own checker stays on as the second layer: it
// marks the row you type in. Dictionary: nspell + dictionary-en (en-US), OPTIONAL — absent, create writes an empty list
// and says so; nothing ships in the deck but the words.
export const WORD = /[A-Za-z][A-Za-z']*[A-Za-z]|[A-Za-z]/g;
const strip = h => String(h == null ? '' : h).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
// a token worth checking: letters only, three or more, no inner capital (LinkedIn, iPhone), not shouting (MCA, PDF)
export const checkable = w => w.length >= 3 && !/^[A-Z']+$/.test(w) && !/^[A-Za-z]+[A-Z]/.test(w.replace(/^./, c => c.toLowerCase()));
// every text a reader sees: slide rows (text or html), master rows, override rows; icons/svg/lines carry no words
export const textsOf = deck => [...(deck.master || []), ...(deck.slides || []).flatMap(s => s.els || [])].map(r => r && (r.html != null ? strip(r.html) : r.text)).filter(t => typeof t === 'string' && t.trim());
// flags(deck, correct) → sorted unique lowercase words `correct` rejects; a deck may say spell.ignore: ['decklet', …]
export function flags(deck, correct) {
  const ignore = new Set(((deck.spell && deck.spell.ignore) || []).map(w => String(w).toLowerCase()));
  const bad = new Set();
  for (const t of textsOf(deck)) for (const w of t.match(WORD) || []) {
    if (!checkable(w) || ignore.has(w.toLowerCase())) continue;
    if (!correct(w) && !correct(w.toLowerCase())) bad.add(w.toLowerCase());
  }
  return [...bad].sort();
}
// the dictionary is optional: null when nspell or dictionary-en is not installed (create says so and writes [])
export async function loadChecker(lang = 'en') {
  if (!/^en(-|$)/i.test(lang)) return null; // one dictionary ships; other langs get the browser's own checker only
  try { const [{default: nspell}, dict] = await Promise.all([import('nspell'), import('dictionary-en')]); const s = nspell(dict.default || dict); return w => s.correct(w); }
  catch { return null; }
}
