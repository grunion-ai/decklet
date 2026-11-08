#!/usr/bin/env node
// decklet authoring benchmark — does an agent following SKILL.md reach FINALIZE PASS on attempt 1, with the deck the prompt asked for?
//   node benchmarks/authoring/benchmark.mjs check [--manifest manifest.json]
//   node benchmarks/authoring/benchmark.mjs score <run-dir> [--out result.json] [--no-webkit] [--no-verify]
// A run dir holds <case>/model.json (and an optional style.json) per case plus run.json {agent, model, cases: {id: {minutes, repairs}}}.
// This script never launches a model: the runner owns models, prompts, timing and transcripts. README.md has the protocol.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {finalize} from '../../bin/finalize.mjs';
import {FORMATS} from '../../bin/validate.mjs';
import {DENSITY} from '../../lib/layouts.mjs';
import {isMain} from '../../lib/is-main.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const COUNTS = ['chart', 'logo', 'donut', 'img'];
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));

export function check(manifest, dir = here) {
  const problems = [], ids = new Set();
  if (!Array.isArray(manifest.cases) || !manifest.cases.length) return {problems: ['cases must be a non-empty array']};
  for (const c of manifest.cases) {
    const id = c.id || '?', P = m => problems.push(`${id}: ${m}`);
    if (!/^[a-z0-9-]+$/.test(c.id || '')) P('id must be a slug');
    if (ids.has(c.id)) P('duplicate id'); ids.add(c.id);
    if (!c.prompt || !fs.existsSync(path.join(dir, c.prompt)) || !fs.readFileSync(path.join(dir, c.prompt), 'utf8').trim()) P(`prompt ${c.prompt} not found`);
    if (!FORMATS.includes(c.format)) P(`format "${c.format}" is not one of ${FORMATS.join('|')}`);
    if (!DENSITY[c.density]) P(`density "${c.density}" is not one of ${Object.keys(DENSITY).join('|')}`);
    if (!(Array.isArray(c.slides) && c.slides.length === 2 && c.slides.every(Number.isInteger) && c.slides[0] >= 1 && c.slides[0] <= c.slides[1])) P('slides must be [min, max]');
    if (!Array.isArray(c.entities)) P('entities must be an array');
    if (!c.counts || typeof c.counts !== 'object' || Array.isArray(c.counts)) P('counts must be an object');
    else for (const k of Object.keys(c.counts)) if (!COUNTS.includes(k)) P(`counts.${k} is not one of ${COUNTS.join('|')}`);
    if (c.inputs && !fs.existsSync(path.join(dir, c.inputs))) P(`inputs ${c.inputs} not found`);
  }
  return {problems};
}

const rowsOf = m => [...(m.slides || []).flatMap(s => s?.els || []), ...(m.master || [])];
const fillMedia = m => (m.slides || []).flatMap(s => Object.values(s?.fill || {})).filter(v => v && typeof v === 'object' && !Array.isArray(v));
const count = (m, kind) => {
  const rows = rowsOf(m);
  if (kind === 'chart') return rows.filter(r => r?.chart).length + (m.slides || []).filter(s => /^chart/.test(s?.template || '')).length;
  if (kind === 'logo') return rows.filter(r => r?.logo != null).length + fillMedia(m).filter(v => v.logo != null).length;
  if (kind === 'img') return rows.filter(r => r?.img).length + fillMedia(m).filter(v => v.img).length;
  return rows.filter(r => r?.[kind] != null).length;
};

export function semanticMisses(c, m) {
  const misses = [], n = (m.slides || []).length, fmt = m.format || 'slides';
  if (fmt !== c.format) misses.push(`format ${fmt}, wanted ${c.format}`);
  if (n < c.slides[0] || n > c.slides[1]) misses.push(`slides ${n}, wanted ${c.slides[0]}-${c.slides[1]}`);
  const listed = new Set((m.entities || []).flat().map(e => String(e).toLowerCase()));
  for (const e of c.entities) if (!listed.has(e.toLowerCase())) misses.push(`entities missing ${e}`);
  for (const [k, want] of Object.entries(c.counts)) { const got = count(m, k); if (got < want) misses.push(`${k} ${got}, wanted at least ${want}`); }
  return misses;
}

const topCodes = receipt => {
  const n = new Map();
  for (const s of receipt.stages) for (const d of s.diagnostics || []) n.set(d.code, (n.get(d.code) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([c]) => c);
};

export async function score(runDir, {manifestPath = path.join(here, 'manifest.json'), verifyFn = null, webkit = 'auto'} = {}) {
  const manifest = read(manifestPath), runFile = path.join(runDir, 'run.json'), run = fs.existsSync(runFile) ? read(runFile) : {};
  const rows = [];
  for (const c of manifest.cases) {
    const dir = path.join(runDir, c.id), modelFile = path.join(dir, 'model.json'), styleFile = path.join(dir, 'style.json');
    const meta = {repairs: run.cases?.[c.id]?.repairs ?? null, minutes: run.cases?.[c.id]?.minutes ?? null};
    if (!fs.existsSync(modelFile)) { rows.push({case: c.id, status: 'missing', pass: false, finalize: false, misses: ['no model.json'], topCodes: [], ...meta}); continue; }
    const receipt = await finalize(modelFile, {style: fs.existsSync(styleFile) ? styleFile : null, out: path.join(dir, 'deck.html'), webkit, ...(verifyFn ? {verifyFn} : {}), log: () => {}});
    const misses = semanticMisses(c, read(modelFile)), failed = receipt.stages.find(s => s.status !== 'pass');
    rows.push({case: c.id, status: receipt.ok ? 'finalized' : 'failed', pass: receipt.ok && !misses.length, finalize: receipt.ok, ...(failed ? {failedStage: failed.stage} : {}), misses, topCodes: topCodes(receipt), ...meta});
  }
  return {benchmark: manifest.benchmark, version: manifest.version, agent: run.agent ?? null, model: run.model ?? null, evidence: run.evidence ?? run.agent !== 'reference',
    engine: JSON.parse(fs.readFileSync(path.join(here, '../../package.json'), 'utf8')).version, scoredAt: new Date().toISOString(),
    rows, summary: {passed: rows.filter(r => r.pass).length, total: rows.length}};
}

if (isMain(import.meta.url)) {
  const [cmd, ...a] = process.argv.slice(2), flag = k => a.includes(k), opt = k => a.includes(k) ? a[a.indexOf(k) + 1] : null;
  if (cmd === 'check') {
    const mp = opt('--manifest') || path.join(here, 'manifest.json'), {problems} = check(read(mp), path.dirname(path.resolve(mp)));
    for (const p of problems) console.error('ERROR   ' + p);
    console.log(problems.length ? `manifest has ${problems.length} problem(s)` : `manifest ok: ${read(mp).cases.length} cases`);
    process.exit(problems.length ? 1 : 0);
  }
  const runDir = a.find(x => !x.startsWith('--') && x !== opt('--out'));
  if (cmd !== 'score' || !runDir) { console.error('usage: node benchmarks/authoring/benchmark.mjs check [--manifest file] | score <run-dir> [--out file] [--no-webkit] [--no-verify]'); process.exit(2); }
  const noVerify = async () => ({ok: true, errors: [], warnings: [], skipped: ['layout parity + AE: --no-verify'], parity: [], diagnostics: []});
  const r = await score(runDir, {webkit: flag('--no-webkit') ? false : 'auto', ...(flag('--no-verify') ? {verifyFn: noVerify} : {})});
  for (const x of r.rows) console.log(`${x.pass ? 'pass' : 'FAIL'}  ${x.case.padEnd(10)} ${x.status.padEnd(9)} ${x.misses.join('; ') || '-'}  ${x.topCodes.join(', ')}`);
  console.log(`${r.summary.passed}/${r.summary.total} passed${r.evidence ? '' : ' (not evidence: reference candidates)'}`);
  if (opt('--out')) fs.writeFileSync(opt('--out'), JSON.stringify(r, null, 1) + '\n');
}
