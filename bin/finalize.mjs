#!/usr/bin/env node
// decklet finalize — model.json (+ style.json) → a verified deck.html and one receipt, in one command.
//   node bin/finalize.mjs model.json [--style style.json] --out deck.html [--format …] [--space WxH] [--title …] [--from prev.html]
//                         [--verify-out dir] [--webkit | --no-webkit]
//   node bin/finalize.mjs --check deck.html   exit 0 only when the deck's receipt passed and still matches the file's bytes
// Stages, stopping at the first that does not pass: validate --strict (with the style) → create (with the same style) → verify --strict.
// Writes <deck stem>.finalize.json whatever happened. Exit 0 only when every stage passed; a verify that could not render is skipped, not passed.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateModel, validate} from './validate.mjs';
import {create, writeDeck} from './create.mjs';
import {verify} from './verify.mjs';
import {loadChecker} from '../lib/spell.mjs';
import {isMain} from '../lib/is-main.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = () => JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const sha = buf => createHash('sha256').update(buf).digest('hex');
const ident = file => ({path: path.resolve(file), sha256: sha(fs.readFileSync(file))});
export const receiptPath = out => out.replace(/\.html?$/i, '') + '.finalize.json';

export function checkReceipt(deckFile) {
  const rp = receiptPath(deckFile);
  if (!fs.existsSync(rp)) return {ok: false, message: `no receipt at ${rp}: run finalize`};
  const receipt = JSON.parse(fs.readFileSync(rp, 'utf8'));
  if (!receipt.ok || !receipt.deck) return {ok: false, receipt, message: `the run in ${rp} did not pass: rerun finalize`};
  const actual = fs.existsSync(deckFile) ? sha(fs.readFileSync(deckFile)) : null;
  if (actual !== receipt.deck.sha256) return {ok: false, receipt, actual, message: `receipt is for ${receipt.deck.sha256.slice(0, 12)}…, file is ${actual ? actual.slice(0, 12) + '…' : 'missing'}: rerun finalize`};
  return {ok: true, receipt, actual, message: `receipt matches ${actual.slice(0, 12)}…`};
}

export async function finalize(modelFile, {style = null, out, format, space, title, from = null, verifyOut = null, webkit = 'auto', verifyFn = verify, log = console.log} = {}) {
  const model = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
  const styleObj = style ? JSON.parse(fs.readFileSync(style, 'utf8')) : null;
  const receipt = {engine: engine(), model: ident(modelFile), style: style ? ident(style) : null, deck: null, stages: [], ok: false};
  const stage = (name, run) => async () => {
    const t = Date.now(), r = await run();
    receipt.stages.push({stage: name, status: r.status, errors: r.errors || [], warnings: r.warnings || [], ...(r.diagnostics ? {diagnostics: r.diagnostics} : {}), ...(r.skipped?.length ? {skipped: r.skipped} : {}), ms: Date.now() - t});
    return r.status === 'pass';
  };
  const stages = [
    stage('validate', () => {
      const v = validateModel(model, styleObj);
      return {status: v.ok && !v.warnings.length ? 'pass' : 'fail', errors: v.errors, warnings: v.warnings, diagnostics: v.diagnostics};
    }),
    stage('create', async () => {
      const spell = await loadChecker(model.lang || 'en');
      const {html, deck} = create(model, {style: styleObj, format, space, title, from, spell});
      const v = validate(deck);
      if (!v.ok) return {status: 'fail', errors: v.errors, warnings: v.warnings, diagnostics: v.diagnostics};
      fs.writeFileSync(out, html);
      if (!v.ok) return {status: 'fail', errors: v.errors, warnings: v.warnings};
      writeDeck(out, html);
      receipt.deck = ident(out);
      return {status: 'pass', warnings: v.warnings, diagnostics: v.diagnostics};
    }),
    stage('verify', async () => {
      const r = await verifyFn(out, {out: verifyOut, strict: true, webkit, log: () => {}});
      const noRender = (r.skipped || []).some(s => s.startsWith('layout parity'));
      return {status: !r.ok ? 'fail' : noRender ? 'skipped' : 'pass', errors: r.errors, warnings: r.warnings, skipped: r.skipped};
    }),
  ];
  for (const run of stages) if (!await run()) break;
  for (const name of ['validate', 'create', 'verify'].slice(receipt.stages.length)) receipt.stages.push({stage: name, status: 'not-run', errors: [], warnings: [], ms: 0});
  receipt.ok = receipt.stages.every(s => s.status === 'pass');
  fs.writeFileSync(receiptPath(out), JSON.stringify(receipt, null, 1));
  return receipt;
}

if (isMain(import.meta.url)) {
  const a = process.argv.slice(2), o = {}; let file = null;
  if (a[0] === '--check') {
    if (!a[1]) { console.error('usage: node bin/finalize.mjs --check deck.html'); process.exit(2); }
    const c = checkReceipt(a[1]);
    (c.ok ? console.log : console.error)(c.message);
    process.exit(c.ok ? 0 : 1);
  }
  for (let k = 0; k < a.length; k++) if (a[k].startsWith('--')) o[a[k].slice(2)] = a[k + 1] && !a[k + 1].startsWith('--') ? a[++k] : true; else file = a[k];
  if (!file || !o.out) { console.error('usage: node bin/finalize.mjs model.json [--style style.json] --out deck.html [--format …] [--space WxH] [--title …] [--from prev.html] [--verify-out dir] [--webkit | --no-webkit]'); process.exit(2); }
  const r = await finalize(file, {style: o.style || null, out: o.out, format: o.format, space: o.space, title: o.title, from: o.from || null, verifyOut: o['verify-out'] || null, webkit: o['no-webkit'] ? false : o.webkit ? true : 'auto'});
  const mark = {pass: '✓', fail: '✗', skipped: '–', 'not-run': ' '};
  for (const s of r.stages) {
    console.log(`${mark[s.status]} ${s.stage.padEnd(9)} ${s.status}${s.status === 'not-run' ? '' : ` · ${s.errors.length} errors · ${s.warnings.length} warnings · ${s.ms} ms`}`);
    for (const m of s.errors) console.log('  ERROR   ' + m);
    for (const m of s.warnings) console.log('  warning ' + m);
    for (const m of s.skipped || []) console.log('  skipped ' + m);
  }
  console.log(`receipt ${receiptPath(o.out)}`);
  console.log(r.ok ? 'FINALIZE PASS' : 'FINALIZE FAIL');
  process.exit(r.ok ? 0 : 1);
}
