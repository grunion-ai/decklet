// decklet edits — node side of the human-edit core. The functions are defined ONCE, in template.html between
// /*EDITS*/ markers (the browser runs them on every save); this module lifts that block out so create --from,
// bin/edits.mjs and the tests run the identical code. Never duplicate them here.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const tpl = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'template.html'), 'utf8');
const src = tpl.match(/\/\*EDITS\*\/([\s\S]*?)\/\*\/EDITS\*\//)[1];
export const {stampIds, diffDecks, applyLog} = new Function('NS', src + ';return {stampIds,diffDecks,applyLog}')('decklet:unstamped');

// the marked JSON blocks a deck file carries: DECK (the model), LOG (human edits), VERSIONS (snapshots). Anchored to the
// data block (`const X=/*X*/…/*/X*/`): fileHtml()'s own source holds the same marker strings as quoted literals, and a
// file from before 0.5.0 has no LOG/VERSIONS data block at all — unanchored, that literal was the match (ROADMAP P1.4).
const re = m => new RegExp(`(?<==)/\\*${m}\\*/([\\s\\S]*?)/\\*/${m}\\*/`);
export const hasBlock = (html, mark) => re(mark).test(html);
export const blockOf = (html, mark, fallback) => { const m = html.match(re(mark)); if (!m) { if (fallback !== undefined) return fallback; throw new Error(`marker ${mark} missing`); } return JSON.parse(m[1].replace(/<\\\/script/g, '</script')); };
export const putBlock = (html, mark, value) => { if (!re(mark).test(html)) throw new Error(`marker ${mark} missing`); return html.replace(re(mark), () => `/*${mark}*/${JSON.stringify(value).replace(/<\/script/gi, '<\\/script')}/*/${mark}*/`); };
export const VERSION_CAP = 20;
