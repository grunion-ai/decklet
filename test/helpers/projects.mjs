// The browser matrix for the save suites: Chromium, WebKit, Firefox, and "embedded", a Chromium that behaves like an in-app
// browser pane (Claude's, Codex's): no File System Access, beforeunload ignored, downloads refused. The deck must choose its
// save route by capability in every one of them, so each save suite runs its live tests once per project.
// DECKLET_PROJECTS=chromium,firefox narrows the set (CI shards by it); a project whose browser is not installed fails loudly.
import {withBrowser} from './browser.mjs';

// the embedded pane, as an init script: runs before the deck's own script in every frame of the context
const embedded = () => {
  for (const k of ['showOpenFilePicker', 'showSaveFilePicker', 'showDirectoryPicker']) { try { delete Window.prototype[k]; } catch {} try { delete window[k]; } catch {} }
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) { if (type === 'beforeunload' && this === window) return; return add.call(this, type, ...rest); };
  Object.defineProperty(window, 'onbeforeunload', {get: () => null, set: () => {}, configurable: true});
};

export const PROJECTS = {
  chromium: {type: 'chromium'},
  webkit: {type: 'webkit'},
  firefox: {type: 'firefox'},
  embedded: {type: 'chromium', init: embedded, context: {acceptDownloads: false}},
};
const only = (process.env.DECKLET_PROJECTS || '').split(',').map(s => s.trim()).filter(Boolean);
// the projects a suite runs: every project, or the ones named, narrowed by DECKLET_PROJECTS
export const projects = (names = Object.keys(PROJECTS)) => names.filter(n => !only.length || only.includes(n));

// withProject(pw, name, fn): launches the project's browser (closed in finally, raced against a deadline) and hands fn
// {browser, context(opts), name, type}. context() applies the project's options and init script before the caller's own.
export function withProject(pw, name, fn, {timeout = 60000} = {}) {
  const P = PROJECTS[name];
  return withBrowser(pw[P.type], async browser => fn({browser, name, type: P.type, context: async (o = {}) => {
    const c = await browser.newContext({...(P.context || {}), ...o});
    if (P.init) await c.addInitScript(P.init);
    return c;
  }}), {timeout});
}
