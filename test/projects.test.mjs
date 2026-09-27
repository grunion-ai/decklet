// The browser matrix itself (test/helpers/projects.mjs): every project launches, and the embedded project really behaves like
// an in-app pane: no File System Access, beforeunload ignored, downloads refused. The deck on it still saves: ⌘S falls to a
// copy, the download is refused, and nothing throws. The CI workflow installs every engine the matrix names.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {create} from '../bin/create.mjs';
import {PROJECTS, projects, withProject} from './helpers/projects.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw = null; try { pw = await import('playwright'); } catch {}
const live = pw ? test : test.skip;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-projects-'));
const f = path.join(tmp, 'deck.html');
fs.writeFileSync(f, create({w: 960, h: 540, title: 'matrix', slides: [{els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}]}]}).html);

test('the matrix is Chromium, WebKit, Firefox and the embedded Chromium pane; CI installs all three engines', () => {
  assert.deepEqual(Object.keys(PROJECTS), ['chromium', 'webkit', 'firefox', 'embedded']);
  assert.deepEqual([...new Set(Object.values(PROJECTS).map(p => p.type))].sort(), ['chromium', 'firefox', 'webkit']);
  const yml = fs.readFileSync(path.join(root, '.github/workflows/test.yml'), 'utf8');
  assert.match(yml, /playwright install --with-deps chromium webkit firefox/);
});

for (const name of projects()) live(`${name}: launches, and File System Access, beforeunload and downloads are what the project says`, async () => withProject(pw, name, async ({context}) => {
  const p = await (await context()).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(pathToFileURL(f).href); await p.waitForSelector('#canvas .el');
  const cap = await p.evaluate(() => { let heard = false; addEventListener('beforeunload', e => { heard = true; e.preventDefault(); });
    const e = new Event('beforeunload', {cancelable: true}); dispatchEvent(e); return {fsa: 'showOpenFilePicker' in window || 'showSaveFilePicker' in window, heard, prompted: e.defaultPrevented}; });
  assert.deepEqual(cap, name === 'embedded' ? {fsa: false, heard: false, prompted: false} : {fsa: name === 'chromium', heard: true, prompted: true});
  if (name === 'embedded') { // ⌘S with no File System Access downloads a copy; the pane refuses it and the page carries on
    const [d] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => saveFile())]);
    assert.ok(await d.failure(), 'the download was refused (Playwright names acceptDownloads as the reason)');
    await p.evaluate(() => { snap(); deck.slides[0].els[0].text = 'Still editing'; save(); });
    assert.equal(await p.evaluate(() => deck.slides[0].els[0].text), 'Still editing');
  }
  assert.deepEqual(errs, []);
}));

test.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
