// decklet release check — is a newer decklet on main than the one installed? Read once a day, never installs anything.
// The version comes from package.json on main (git tags lag the releases), fetched with curl like bin/archify-sync.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {newer} from './archify.mjs';

export const PACKAGE_URL = 'https://raw.githubusercontent.com/grunion-ai/decklet/main/package.json';
const DAY = 24 * 3600e3;
const run = promisify(execFile);
const curl = async url => (await run('curl', ['-fsSL', '--max-time', '4', url], {timeout: 5000})).stdout;
const defaultCache = () => path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'decklet', 'update.json');
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

export async function updateCheck({installed, fetchText = curl, cacheFile = defaultCache(), env = process.env, now = Date.now()} = {}) {
  if (env.DECKLET_NO_UPDATE_CHECK === '1') return null;
  const answer = (available, source, checkedAt) => ({installed, available, noticeRequired: !!available && newer(installed, available), source, checkedAt: new Date(checkedAt).toISOString()});
  const cached = read(cacheFile);
  if (cached?.available && now - Date.parse(cached.checkedAt) < DAY) return answer(cached.available, 'cache', Date.parse(cached.checkedAt));
  try {
    const available = JSON.parse(await fetchText(PACKAGE_URL)).version;
    if (!/^\d+\.\d+\.\d+$/.test(available || '')) throw new Error('no version');
    try { fs.mkdirSync(path.dirname(cacheFile), {recursive: true}); fs.writeFileSync(cacheFile, JSON.stringify({available, checkedAt: new Date(now).toISOString()})); } catch {}
    return answer(available, 'network', now);
  } catch {
    return {installed, available: null, noticeRequired: false, source: 'unavailable', checkedAt: new Date(now).toISOString()};
  }
}
