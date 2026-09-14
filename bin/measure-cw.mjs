#!/usr/bin/env node
// measure-cw.mjs — the `cw` of a style kit's roles, measured instead of guessed.
// `cw` is the average advance per character in em, INCLUDING the role's tracking: validate sizes `w:'auto'` rows and
// counts lines as chars × size × cw, and a role's own `ls` is part of what a line costs. Without it the blanket 0.55
// stands — ~20% wide on a sans, ~20% narrow on uppercase mono. Chromium measures the same stack the deck will wear,
// so run this on the machine whose fonts the brand actually names.
//   node bin/measure-cw.mjs examples/styles/warm/style.json          # print role · cw · current
//   node bin/measure-cw.mjs examples/styles/warm/style.json --write  # rewrite the cw fields in place
import fs from 'node:fs';
import path from 'node:path';
// one representative sentence per role shape: a headline is short and title-case, body is a sentence, a label is a chip
const SAMPLE = {Title: 'The quarter the pipeline turned', Supertitle: 'Operating review', H1: 'Where the revenue came from',
  H2: 'Three things changed', Body: 'Renewals held at ninety-one percent while new logos slowed through the summer.',
  Caption: 'Source: internal billing, through 30 June.', Label: 'Gross margin', Stat: '$12.4M', Stat2: '63%'};
const file = process.argv[2], write = process.argv.includes('--write');
if (!file) { console.error('usage: node bin/measure-cw.mjs <style.json> [--write]'); process.exit(2); }
const style = JSON.parse(fs.readFileSync(file, 'utf8'));
const {chromium} = await import('playwright');
const b = await chromium.launch(); const p = await b.newPage();
const out = {};
for (const [role, t] of Object.entries(style.roles)) {
  const text = SAMPLE[role] || SAMPLE.Body;
  out[role] = await p.evaluate(([t, text]) => {
    const s = document.createElement('span');
    Object.assign(s.style, {position: 'absolute', whiteSpace: 'pre', fontFamily: t.font, fontSize: t.size + 'px',
      fontWeight: t.weight, letterSpacing: (t.ls || 0) + 'px', textTransform: t.tt || 'none'});
    s.textContent = text; document.body.append(s);
    const w = s.getBoundingClientRect().width; s.remove();
    return Math.round(w / text.length / t.size * 100) / 100;   // em per character, tracking included
  }, [t, text]);
}
await b.close();
for (const [role, cw] of Object.entries(out)) {
  const was = style.roles[role].cw;
  console.log(`${role.padEnd(11)} ${cw.toFixed(2)}${was != null && was !== cw ? `   (was ${was})` : ''}`);
  style.roles[role].cw = cw;
}
if (write) { fs.writeFileSync(file, JSON.stringify(style, null, 1) + '\n'); console.log(`→ ${path.relative(process.cwd(), file)}`); }
