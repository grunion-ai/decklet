// decklet bug — node side of the bug-report builder. The functions are defined ONCE, in template.html between
// /*BUG*/ markers (the ⓘ popover runs them on open); this module lifts that block out so bin/bug.mjs and the tests
// run the identical code. Never duplicate them here.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const tpl = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'template.html'), 'utf8');
const src = tpl.match(/\/\*BUG\*\/([\s\S]*?)\/\*\/BUG\*\//)[1];
const lifted = new Function(src + '\nreturn {bugReport, bugFacts, scrub, BUG_TO, BUG_CAP};')();
export const {bugReport, bugFacts, scrub, BUG_TO, BUG_CAP} = lifted;
// the version a deck file was built with (its ENGINE literal), or null for a file from before the marker
export const engineOf = html => { const m = html.match(/const ENGINE=\/\*ENGINE\*\/'([^']*)'\/\*\/ENGINE\*\//); return m ? m[1] : null; };
