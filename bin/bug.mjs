#!/usr/bin/env node
// decklet bug — a prefilled bug report for decklet@grunion.ai (receive-only; a person answers from their own mailbox).
// usage: node bin/bug.mjs [deck.html] [--tool verify|validate|create] [--log out.txt] [--open]
//   deck.html   adds the deck's shape (format, size, slide count, id) and the version it was built with — never its words
//   --log FILE  a tool's captured output, scrubbed (quotes, JSON, directories stripped) and cut to fit, as the snippet
//   --open      hands the mailto to the OS (open / xdg-open / start) — otherwise it is printed to paste
// Prints the body (to read and edit) and, last, the mailto line. Nothing is sent by this command.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {bugReport, bugFacts, engineOf} from '../lib/bug.mjs';
import {blockOf} from '../lib/edits.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8')).version;

export function report({deck = null, tool = null, log = null} = {}) {
  const o = {engine: pkg, mode: 'cli', client: `node ${process.version} · ${os.platform()} ${os.release()}`, tool, output: log};
  if (deck) { const html = fs.readFileSync(deck, 'utf8'); Object.assign(o, bugFacts(blockOf(html, 'DECK')), {built: engineOf(html) || 'a version before 0.7.1'}); }
  return bugReport(o);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), o = {}; let deck = null;
  for (let n = 0; n < a.length; n++) { if (a[n] === '--open') o.open = true; else if (a[n].startsWith('--')) o[a[n].slice(2)] = a[++n]; else deck = a[n]; }
  if (o.help) { console.error('usage: node bin/bug.mjs [deck.html] [--tool verify|validate|create] [--log out.txt] [--open]'); process.exit(2); }
  const r = report({deck, tool: o.tool || null, log: o.log ? fs.readFileSync(o.log, 'utf8') : null});
  console.log(`Subject: ${r.subject}\n\n${r.body}\n\n${r.mailto}`);
  if (o.open) { const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'; spawn(cmd, [r.mailto], {stdio: 'ignore', detached: true, shell: process.platform === 'win32'}).unref(); }
}
