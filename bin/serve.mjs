#!/usr/bin/env node
// decklet serve: host one deck on 127.0.0.1 so every browser's edits land in the file (Safari and Firefox have no File System
// Access) and an agent's rebuild reaches the open page. Node built-ins only.
// usage: node bin/serve.mjs deck.html [--port N]   prints http://127.0.0.1:<port>/ ; ctrl-C stops it
//   GET /                    the file, plus <meta name="decklet-host" content="<token>"> after <head> (the file on disk never has it)
//   GET /__decklet           {ok, rev, name}                             X-Decklet-Token
//   PUT /__decklet/file      {model, log} spliced into the file          X-Decklet-Token + If-Match: the rev the edit was made on
//                            403 bad token · 412 {rev} the file moved on (an agent rebuilt it) · 200 {rev}; the file as it was
//                            is kept in .decklet-history/<rev>-<ms>.html, the new one lands by rename (atomic)
//   GET /__decklet/events?t= SSE `changed` {rev} when anything but our own PUT rewrote the file (EventSource sets no headers)
// Security: a Host other than 127.0.0.1:<port> / localhost:<port> is 421 (DNS rebinding cannot read the token). No CORS
// headers, ever: the custom token header forces a preflight nobody answers, so another site in the same browser cannot write.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {blockOf, splice} from '../lib/edits.mjs';
import {isMain} from '../lib/is-main.mjs';

export function serve(file, {port = 0} = {}) {
  file = path.resolve(file);
  const dir = path.dirname(file), name = path.basename(file), token = randomBytes(24).toString('base64url');
  const meta = `<meta name="decklet-host" content="${token}">`;
  const read = () => fs.readFileSync(file, 'utf8');
  const revOf = html => { try { return blockOf(html, 'DECK').rev || ''; } catch { return ''; } };
  const authed = t => typeof t === 'string' && t.length === token.length && timingSafeEqual(Buffer.from(t), Buffer.from(token));
  const send = (res, code, body, type = 'application/json') => { res.writeHead(code, {'content-type': type, 'cache-control': 'no-store'}); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
  const clients = new Set();
  let last = read(); // the file as last seen: our own PUT sets it, so the watcher stays quiet about that write
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), p = server.address().port;
    if (req.headers.host !== `127.0.0.1:${p}` && req.headers.host !== `localhost:${p}`) return send(res, 421, {ok: false});
    if (req.method === 'GET' && u.pathname === '/') { const h = read(); const at = h.search(/<head[^>]*>/i); return send(res, 200, at < 0 ? meta + h : h.replace(/<head[^>]*>/i, m => m + meta), 'text/html; charset=utf-8'); }
    if (req.method === 'GET' && u.pathname === '/__decklet/events') {
      if (!authed(u.searchParams.get('t'))) return send(res, 403, {ok: false});
      res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-store'}); res.write(': decklet\n\n');
      clients.add(res); req.on('close', () => clients.delete(res)); return;
    }
    if (!u.pathname.startsWith('/__decklet')) return send(res, 404, 'not found', 'text/plain');
    if (!authed(req.headers['x-decklet-token'])) return send(res, 403, {ok: false});
    if (req.method === 'GET' && u.pathname === '/__decklet') return send(res, 200, {ok: true, rev: revOf(read()), name});
    if (req.method !== 'PUT' || u.pathname !== '/__decklet/file') return send(res, 404, {ok: false});
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      const cur = read(), rev = revOf(cur);
      if (req.headers['if-match'] !== rev) return send(res, 412, {ok: false, rev});
      let b; try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {}
      if (!b || typeof b.model !== 'object' || !Array.isArray(b.log)) return send(res, 400, {ok: false});
      const next = splice(cur, b.model, b.log), hist = path.join(dir, '.decklet-history'), tmp = path.join(dir, `.${name}.${process.pid}.tmp`);
      fs.mkdirSync(hist, {recursive: true}); fs.writeFileSync(path.join(hist, `${rev || 'norev'}-${Date.now()}.html`), cur);
      fs.writeFileSync(tmp, next); last = next; fs.renameSync(tmp, file);
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
      const msg = `event: changed\ndata: ${JSON.stringify({rev: revOf(h)})}\n\n`; for (const c of clients) c.write(msg);
    }, 100);
  });
  const beat = setInterval(() => { for (const c of clients) c.write(': \n\n'); }, 15000); // proxies and sleeping laptops drop a silent stream
  const close = () => new Promise(r => { clearInterval(beat); clearTimeout(t); watcher.close(); for (const c of clients) c.end(); server.close(() => r()); server.closeAllConnections(); });
  return new Promise((ok, no) => { server.once('error', no); server.listen(port, '127.0.0.1', () => ok({url: `http://127.0.0.1:${server.address().port}/`, port: server.address().port, token, close})); });
}

if (isMain(import.meta.url)) {
  const a = process.argv.slice(2), file = a.find((x, n) => !x.startsWith('--') && a[n - 1] !== '--port'), pi = a.indexOf('--port');
  if (!file || !fs.existsSync(file)) { console.error('usage: node bin/serve.mjs deck.html [--port N]'); process.exit(2); }
  const s = await serve(file, {port: pi >= 0 ? +a[pi + 1] : 0});
  console.log(s.url);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => s.close().then(() => process.exit(0)));
}
