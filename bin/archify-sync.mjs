#!/usr/bin/env node
// Move vendor/archify to an archify release: the packaged archify.zip at that tag, unzipped as is, then the lock and a
// CHANGELOG line under ## Unreleased. docs/archify.md.
//   node bin/archify-sync.mjs               latest release
//   node bin/archify-sync.mjs --tag v2.16.0 one tag
//   node bin/archify-sync.mjs --check       exit 1 and name the tag when a newer release is out
// curl, git and unzip do the network and the archive, no dependency; GITHUB_TOKEN is used when set.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {REPO, VENDOR, LOCK, treeHash, newer} from '../lib/archify.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args, opts) => execFileSync(cmd, args, {encoding: 'utf8', ...opts});
const auth = process.env.GITHUB_TOKEN ? ['-H', `Authorization: Bearer ${process.env.GITHUB_TOKEN}`] : [];
const api = p => JSON.parse(run('curl', ['-fsSL', ...auth, `https://api.github.com/repos/${REPO}/${p}`]));

const args = process.argv.slice(2);
const lockPath = path.join(root, LOCK);
const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : null;
const tag = args.includes('--tag') ? args[args.indexOf('--tag') + 1] : api('releases/latest').tag_name;
if (!/^v\d+\.\d+\.\d+$/.test(tag || '')) throw new Error(`not a release tag: ${tag}`);

if (args.includes('--check')) {
  if (lock && !newer(lock.tag, tag)) { console.log(`archify ${lock.tag} is current`); process.exit(0); }
  console.log(`archify ${lock ? lock.tag : 'none'} → ${tag}`);
  process.exit(1);
}
if (lock && lock.tag === tag && treeHash(path.join(root, VENDOR)) === lock.treeSha256) { console.log(`archify ${tag} already vendored`); process.exit(0); }

// the tag's commit: an annotated tag peels to it at ^{}
const refs = run('git', ['ls-remote', `https://github.com/${REPO}.git`, `refs/tags/${tag}`, `refs/tags/${tag}^{}`]).trim().split('\n');
const commit = (refs.find(l => l.endsWith('^{}')) || refs[0]).split('\t')[0];
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`no commit for ${tag}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-sync-'));
const zip = path.join(tmp, 'archify.zip');
run('curl', ['-fsSL', '-o', zip, `https://raw.githubusercontent.com/${REPO}/${commit}/archify.zip`]);
run('unzip', ['-q', zip, '-d', tmp]);
const pkg = path.join(tmp, 'archify');
const rel = JSON.parse(fs.readFileSync(path.join(pkg, 'skill-release.json'), 'utf8'));
if (`v${rel.version}` !== tag || rel.channel !== 'stable') throw new Error(`archify.zip at ${tag} says ${rel.channel} ${rel.version}`);

const dest = path.join(root, VENDOR);
fs.rmSync(dest, {recursive: true, force: true});
fs.cpSync(pkg, dest, {recursive: true});
const next = {
  repo: REPO, tag, commit,
  zipSha256: crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex'),
  treeSha256: treeHash(dest),
};
fs.writeFileSync(lockPath, JSON.stringify(next, null, 2) + '\n');
fs.rmSync(tmp, {recursive: true, force: true});

// one CHANGELOG line per move, under ## Unreleased
const clPath = path.join(root, 'CHANGELOG.md');
const line = `- **archify ${tag}.** \`vendor/archify\` ${lock ? `moves from ${lock.tag} to ${tag}` : `is ${tag}`}, commit \`${commit.slice(0, 7)}\`, by \`bin/archify-sync.mjs\`. Release notes: https://github.com/${REPO}/releases/tag/${tag}`;
fs.writeFileSync(clPath, fs.readFileSync(clPath, 'utf8').replace(/^## Unreleased\n/m, m => `${m}\n${line}\n`));

// the tag in docs/archify.md follows the lock
const docPath = path.join(root, 'docs/archify.md');
if (lock && fs.existsSync(docPath)) fs.writeFileSync(docPath, fs.readFileSync(docPath, 'utf8').replaceAll(lock.tag, tag));
console.log(`archify ${lock ? lock.tag : 'none'} → ${tag} (${commit.slice(0, 7)})`);
