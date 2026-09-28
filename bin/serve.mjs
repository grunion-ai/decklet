#!/usr/bin/env node
// decklet serve: host one deck on 127.0.0.1 so every browser's edits land in the file (Safari and Firefox have no File System
// Access) and an agent's rebuild reaches the open page. Node built-ins only.
// usage: node bin/serve.mjs deck.html [--port N]   prints http://127.0.0.1:<port>/ ; ctrl-C stops it
//        node bin/serve.mjs deck.html --checkout [--by NAME] [--ttl SECONDS]   hold the open page read-only while you rebuild
//        node bin/serve.mjs deck.html --checkin                                  hand it back (the page rebases on your version)
//   GET /                    the file, plus <meta name="decklet-host" content="<token>"> after <head> (the file on disk never has it)
//   GET /__decklet           {ok, rev, name}                             X-Decklet-Token
//   PUT /__decklet/file      {model, log} spliced into the file          X-Decklet-Token + If-Match: the rev the edit was made on
//                            403 bad token · 412 {rev} the file moved on (an agent rebuilt it) · 200 {rev}; the file as it was
//                            is kept in .decklet-history/<rev>-<ms>.html, the new one lands by rename (atomic) · 423 {lease} checked out
//                            Once a spell request has loaded the dictionary, the SPELL block is rewritten from the new model
//                            (flagMap, as create does), so a word flagged live is in the file on reload; else it stays as it was.
//   POST /__decklet/heartbeat {pending}  the page's unacknowledged edit count: on every save, every 20 s while it has any
//   POST /__decklet/checkout {by, ttl}   200 {lease} · 409 {pending} the page sent edits in the last 60 s that no PUT has
//                            acknowledged, or {lease} someone else holds it. The lease lives here, in memory, never in the file.
//   POST /__decklet/checkin  clears the lease (expiry does the same); `changed` first when the file moved under it
//   POST /__decklet/spell    {words} ≤ 500 strings of ≤ 64 chars, the words of one edited row: 200 {ok, flags: {word: [suggestions]}},
//                            lib/spell.mjs with the build's dictionary and the file's spell.ignore; {words: []} is the page's probe
//                            · 503 {reason: 'no dictionary'} nspell/dictionary-en absent (dev deps) or a lang with none: build-time only
//   GET /__decklet/events?t= SSE `changed` {rev} when anything but our own PUT rewrote the file (EventSource sets no headers);
//                            `lease` {by, since, until} or null, and the current lease on connect
// .decklet-host.json beside the deck = {port, token, pid}, mode 0600, removed on shutdown: how --checkout finds the server.
// Security: a Host other than 127.0.0.1:<port> / localhost:<port> is 421 (DNS rebinding cannot read the token). No CORS
// headers, ever: the custom token header forces a preflight nobody answers, so another site in the same browser cannot write.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {blockOf, splice} from '../lib/edits.mjs';
import {isMain} from '../lib/is-main.mjs';
import {Worker} from 'node:worker_threads';

const hostFile = file => path.join(path.dirname(path.resolve(file)), '.decklet-host.json');

const SPELL_WORDS = 500, SPELL_LEN = 64;
// the spell worker: lib/spell.mjs, the build's own code, off the request thread. nspell parses the dictionary for seconds and
// suggest() can take a second a word; a PUT or the stream must never wait behind that. Answers flagMap(deck) or null (no dictionary).
const SPELL_WORKER = `const {parentPort, workerData} = require('node:worker_threads');
const lib = import(workerData.lib), dicts = new Map();
parentPort.on('message', async ({id, lang, deck, had}) => { let flags = null; try {
  const {flagMap, loadChecker} = await lib;
  if (!dicts.has(lang)) dicts.set(lang, loadChecker(lang).then(c => { if (!c) return null; const memo = new Map(), ok = w => c(w);
    ok.memo = memo; ok.suggest = w => { if (!memo.has(w)) memo.set(w, c.suggest(w)); return memo.get(w); }; return ok; }));
  const c = await dicts.get(lang);
  if (c) { for (const w in had || {}) if (!c.memo.has(w) && Array.isArray(had[w])) c.memo.set(w, had[w]); flags = flagMap(deck, c); } // the file's suggestions: no suggest() for them
} catch {} parentPort.postMessage({id, lang, flags}); });`;
export function serve(file, {port = 0, guard = 60000, spell = true} = {}) {
  file = path.resolve(file);
  const dir = path.dirname(file), name = path.basename(file), token = randomBytes(24).toString('base64url'), hf = hostFile(file);
  const meta = `<meta name="decklet-host" content="${token}">`;
  const read = () => fs.readFileSync(file, 'utf8');
  const revOf = html => { try { return blockOf(html, 'DECK').rev || ''; } catch { return ''; } };
  const authed = t => typeof t === 'string' && t.length === token.length && timingSafeEqual(Buffer.from(t), Buffer.from(token));
  const send = (res, code, body, type = 'application/json') => { res.writeHead(code, {'content-type': type, 'cache-control': 'no-store'}); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
  const clients = new Set();
  const emit = (ev, data) => { const m = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`; for (const c of clients) c.write(m); };
  const body = (req, done) => { const c = []; req.on('data', x => c.push(x)); req.on('end', () => { let b; try { b = JSON.parse(Buffer.concat(c).toString('utf8')); } catch {} done(b && typeof b === 'object' ? b : null); }); };
  let last = read(); // the file as last seen: our own PUT sets it, so the watcher stays quiet about that write
  // the lease: who holds the deck and until when, plus the rev at checkout (a release announces a file that moved under it)
  let lease = null, leaseT = null;
  const pub = () => lease && {by: lease.by, since: lease.since, until: lease.until};
  const release = () => { clearTimeout(leaseT); if (!lease) return; const was = lease.rev, h = read(); lease = null; if (revOf(h) !== was) emit('changed', {rev: revOf(h)}); emit('lease', null); };
  // the page's unacknowledged edits: its last heartbeat count and when a human edit last arrived (heartbeat or PUT)
  const human = {pending: 0, at: 0};
  // spellOf(lang, deck, had) → flagMap(deck) from the worker, or null. The first spell request (the page's probe) starts it;
  // ready = the langs it has answered for: a PUT rewrites SPELL only for those, so it never waits for a dictionary to load.
  // spell: false = no worker, every answer null (the no-dictionary path, for tests).
  let wk = null, seq = 0; const waits = new Map(), ready = new Set();
  const spellOf = (lang, deck, had) => new Promise(ok => {
    if (!spell) return ok(null);
    if (!wk) {
      wk = new Worker(SPELL_WORKER, {eval: true, workerData: {lib: new URL('../lib/spell.mjs', import.meta.url).href}}); wk.unref();
      wk.on('message', m => { if (m.flags) ready.add(m.lang); const f = waits.get(m.id); waits.delete(m.id); if (f) f(m.flags); });
      wk.on('error', () => { spell = false; for (const f of waits.values()) f(null); waits.clear(); }); // a dead worker: build-time only from here on
    }
    const id = ++seq; waits.set(id, ok); wk.postMessage({id, lang, deck, had});
  });
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), p = server.address().port;
    if (req.headers.host !== `127.0.0.1:${p}` && req.headers.host !== `localhost:${p}`) return send(res, 421, {ok: false});
    if (req.method === 'GET' && u.pathname === '/') { const h = read(); const at = h.search(/<head[^>]*>/i); return send(res, 200, at < 0 ? meta + h : h.replace(/<head[^>]*>/i, m => m + meta), 'text/html; charset=utf-8'); }
    if (req.method === 'GET' && u.pathname === '/__decklet/events') {
      if (!authed(u.searchParams.get('t'))) return send(res, 403, {ok: false});
      res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-store'}); res.write(': decklet\n\n');
      if (lease) res.write(`event: lease\ndata: ${JSON.stringify(pub())}\n\n`);
      clients.add(res); req.on('close', () => clients.delete(res)); return;
    }
    if (!u.pathname.startsWith('/__decklet')) return send(res, 404, 'not found', 'text/plain');
    if (!authed(req.headers['x-decklet-token'])) return send(res, 403, {ok: false});
    if (req.method === 'GET' && u.pathname === '/__decklet') return send(res, 200, {ok: true, rev: revOf(read()), name});
    if (req.method === 'POST' && u.pathname === '/__decklet/heartbeat') return body(req, b => {
      if (!b || !Number.isInteger(b.pending) || b.pending < 0) return send(res, 400, {ok: false});
      human.pending = b.pending; if (b.pending) human.at = Date.now(); send(res, 200, {ok: true});
    });
    if (req.method === 'POST' && u.pathname === '/__decklet/checkout') return body(req, b => {
      const by = b && (b.by == null ? 'agent' : b.by), ttl = b && (b.ttl == null ? 900 : b.ttl);
      if (typeof by !== 'string' || !by.trim() || by.length > 60 || typeof ttl !== 'number' || !(ttl > 0) || ttl > 86400) return send(res, 400, {ok: false});
      if (lease && lease.by !== by.trim()) return send(res, 409, {ok: false, lease: pub()});
      if (!lease && human.pending && Date.now() - human.at < guard) return send(res, 409, {ok: false, pending: human.pending});
      const now = Date.now();
      lease = {by: by.trim(), since: lease ? lease.since : new Date(now).toISOString(), until: new Date(now + ttl * 1000).toISOString(), rev: lease ? lease.rev : revOf(read())};
      clearTimeout(leaseT); leaseT = setTimeout(release, ttl * 1000);
      emit('lease', pub()); send(res, 200, {ok: true, lease: pub()});
    });
    if (req.method === 'POST' && u.pathname === '/__decklet/spell') return body(req, async b => {
      const w = b && b.words;
      if (!Array.isArray(w) || w.length > SPELL_WORDS || !w.every(x => typeof x === 'string' && x.length <= SPELL_LEN)) return send(res, 400, {ok: false});
      let d; try { d = blockOf(read(), 'DECK'); } catch { d = {}; }
      const flags = await spellOf(d.lang || 'en', {...d, master: [], slides: [{els: [{text: w.join(' ')}]}]}); // the file's deck with one row: every deck-level exception the build honours (spell.ignore)
      send(res, ...(flags ? [200, {ok: true, flags}] : [503, {ok: false, reason: 'no dictionary'}]));
    });
    if (req.method === 'POST' && u.pathname === '/__decklet/checkin') { release(); return send(res, 200, {ok: true, lease: null}); }
    if (req.method !== 'PUT' || u.pathname !== '/__decklet/file') return send(res, 404, {ok: false});
    body(req, async b => {
      const lang = b && b.model && typeof b.model === 'object' && (b.model.lang || 'en');
      let sp, had; // the file's own suggestions go along, so a word it already carries costs no suggest()
      if (lang && ready.has(lang)) { try { had = blockOf(read(), 'SPELL', {}); } catch {} sp = await spellOf(lang, b.model, Array.isArray(had) ? null : had) || undefined; }
      const cur = read(), rev = revOf(cur); // nothing awaits from this read to the rename
      if (req.headers['if-match'] !== rev) return send(res, 412, {ok: false, rev});
      if (!b || typeof b.model !== 'object' || !Array.isArray(b.log)) return send(res, 400, {ok: false});
      if (lease) return send(res, 423, {ok: false, lease: pub()}); // checked out: the page's journal keeps the edit for checkin
      const next = splice(cur, b.model, b.log, sp), hist = path.join(dir, '.decklet-history'), tmp = path.join(dir, `.${name}.${process.pid}.tmp`);
      fs.mkdirSync(hist, {recursive: true}); fs.writeFileSync(path.join(hist, `${rev || 'norev'}-${Date.now()}.html`), cur);
      fs.writeFileSync(tmp, next); last = next; fs.renameSync(tmp, file);
      human.pending = 0; human.at = Date.now(); // the PUT carries every entry the page had: acknowledged
      send(res, 200, {ok: true, rev: revOf(next)});
    });
  });
  // watch the directory, not the file: a rename over the deck (ours, an editor's, create's) ends a watch on the old inode
  let t = null;
  const watcher = fs.watch(dir, (ev, f) => {
    if (f && f !== name) return;
    clearTimeout(t); t = setTimeout(() => {
      let h; try { h = read(); } catch { return; } // mid-rename: the next event reads it
      if (h === last) return; last = h;
      emit('changed', {rev: revOf(h)});
    }, 100);
  });
  const beat = setInterval(() => { for (const c of clients) c.write(': \n\n'); }, 15000); // proxies and sleeping laptops drop a silent stream
  const unlink = () => { try { if (JSON.parse(fs.readFileSync(hf, 'utf8')).token === token) fs.unlinkSync(hf); } catch {} };
  const close = () => new Promise(r => { if (wk) wk.terminate(); clearInterval(beat); clearTimeout(t); clearTimeout(leaseT); watcher.close(); unlink(); for (const c of clients) c.end(); server.close(() => r()); server.closeAllConnections(); });
  return new Promise((ok, no) => { server.once('error', no); server.listen(port, '127.0.0.1', () => {
    const p = server.address().port;
    fs.writeFileSync(hf, JSON.stringify({port: p, token, pid: process.pid}), {mode: 0o600}); fs.chmodSync(hf, 0o600); // chmod: an old file keeps its mode through writeFileSync
    ok({url: `http://127.0.0.1:${p}/`, port: p, token, close});
  }); });
}

// --checkout / --checkin: one POST to the running server, one line out. No server = nothing to hold, so exit 0 and say so.
export async function lease(file, mode, {by = 'agent', ttl = 900} = {}) {
  const name = path.basename(file), none = `no decklet server for ${name}; ${mode} is a no-op without one`;
  let h; try { h = JSON.parse(fs.readFileSync(hostFile(file), 'utf8')); process.kill(h.pid, 0); } catch { return {code: 0, line: none}; }
  let r; try {
    r = await fetch(`http://127.0.0.1:${h.port}/__decklet/${mode}`, {method: 'POST', headers: {'content-type': 'application/json', 'x-decklet-token': h.token}, body: JSON.stringify(mode === 'checkout' ? {by, ttl} : {})});
  } catch { return {code: 0, line: none}; }
  const j = await r.json().catch(() => ({}));
  if (mode === 'checkin') return r.ok ? {code: 0, line: `checked in ${name}`} : {code: 1, line: `${name}: checkin refused (${r.status})`};
  if (r.ok) return {code: 0, line: `checked out ${name} for ${j.lease.by} until ${new Date(j.lease.until).toTimeString().slice(0, 5)}`};
  if (r.status === 409 && j.pending) return {code: 1, line: `${name} has ${j.pending} edit${j.pending === 1 ? '' : 's'} the page has not saved yet; retry in a few seconds`};
  if (r.status === 409 && j.lease) return {code: 1, line: `${name} is checked out by ${j.lease.by} until ${new Date(j.lease.until).toTimeString().slice(0, 5)}`};
  return {code: 1, line: `${name}: checkout refused (${r.status})`};
}

if (isMain(import.meta.url)) {
  const a = process.argv.slice(2), val = k => { const n = a.indexOf(k); return n >= 0 ? a[n + 1] : undefined; };
  const file = a.find((x, n) => !x.startsWith('--') && !['--port', '--by', '--ttl'].includes(a[n - 1]));
  if (!file || !fs.existsSync(file)) { console.error('usage: node bin/serve.mjs deck.html [--port N] | --checkout [--by NAME] [--ttl SECONDS] | --checkin'); process.exit(2); }
  if (a.includes('--checkout') || a.includes('--checkin')) {
    const r = await lease(file, a.includes('--checkout') ? 'checkout' : 'checkin', {by: val('--by') || 'agent', ttl: val('--ttl') != null ? +val('--ttl') : 900});
    console.log(r.line); process.exit(r.code);
  }
  const s = await serve(file, {port: val('--port') != null ? +val('--port') : 0});
  console.log(s.url);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => s.close().then(() => process.exit(0)));
}
