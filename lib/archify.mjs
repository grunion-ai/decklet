// archify (github.com/tt-a1i/archify, MIT) ships vendored under vendor/archify at one release tag; these are the pure parts
// of that pin. bin/archify-sync.mjs does the network and file work, test/archify.test.mjs holds the tree to the lock.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const REPO = 'tt-a1i/archify';
export const VENDOR = 'vendor/archify';
export const LOCK = 'vendor/archify.lock.json';

const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// One hash for a directory: every file's relative path and content hash, sorted. .DS_Store never counts.
export function treeHash(dir) {
  const lines = [];
  const walk = rel => {
    for (const e of fs.readdirSync(path.join(dir, rel), {withFileTypes: true})) {
      if (e.name === '.DS_Store') continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else lines.push(`${r}\0${sha(fs.readFileSync(path.join(dir, r)))}`);
    }
  };
  walk('');
  return sha(lines.sort().join('\n'));
}

// true when tag b is a later release than tag a (vX.Y.Z)
export function newer(a, b) {
  const n = t => t.replace(/^v/, '').split('.').map(Number);
  const [x, y] = [n(a), n(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] > x[i];
  return false;
}
