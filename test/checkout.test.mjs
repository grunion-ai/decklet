// decklet checkout: an agent holds the served deck while it rebuilds, so the person's page goes read-only instead of racing it.
// The lease lives in bin/serve.mjs's memory ({by, since, until}); the deck file never carries it. Node only (no browser): the
// endpoints and their token + Host rules, the 409 guard while the page holds unacknowledged edits, expiry, the SSE `lease`
// event, the .decklet-host.json the CLI finds the server by (0600, gone on shutdown), and the --checkout / --checkin modes.
// Live proofs: checkout-live.test.mjs.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn, execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {create} from '../bin/create.mjs';
import {serve} from '../bin/serve.mjs';
import {blockOf} from '../lib/edits.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'serve.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-checkout-'));
const model = (two = 'Two') => ({w: 960, h: 540, title: 'checkout', slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: two}]},
]});
let n = 0;
const deckFile = () => { const d = path.join(tmp, 'd' + ++n); fs.mkdirSync(d); const f = path.join(d, 'deck.html'); fs.writeFileSync(f, create(model()).html); return f; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// in-process: serve() takes the guard window as an option, so the 60 s rule is testable in milliseconds
async function start(file, o = {}) { const s = await serve(file, o); return {...s, file}; }
function req(s, method, p, {headers = {}, body, host = `127.0.0.1:${s.port}`, token = s.token} = {}) {
  return new Promise((ok, no) => {
    const r = http.request({host: '127.0.0.1', port: s.port, method, path: p, headers: {host, ...(token ? {'x-decklet-token': token} : {}), ...(body != null ? {'content-type': 'application/json'} : {}), ...headers}}, res => {
      const c = []; res.on('data', x => c.push(x)); res.on('end', () => { const t = Buffer.concat(c).toString(); let j = null; try { j = JSON.parse(t); } catch {} ok({status: res.statusCode, body: t, json: j}); });
    });
    r.on('error', no); if (body != null) r.write(typeof body === 'string' ? body : JSON.stringify(body)); r.end();
  });
}
const post = (s, p, body, o) => req(s, 'POST', p, {body, ...o});
const put = (s, rev) => { const html = fs.readFileSync(s.file, 'utf8'), d = blockOf(html, 'DECK'); d.slides[0].els[0].text = 'Uno'; return req(s, 'PUT', '/__decklet/file', {headers: {'if-match': rev}, body: {model: d, log: [{t: '2026-09-27T00:00:00.000Z', s: d.slides[0].id, r: d.slides[0].els[0].id, k: {text: ['One', 'Uno']}, rev: d.rev}]}}); };
// an SSE client: every named event in arrival order
function listen(s) {
  const events = []; let res0;
  const r = http.get({host: '127.0.0.1', port: s.port, path: '/__decklet/events?t=' + s.token, headers: {host: `127.0.0.1:${s.port}`}}, res => {
    res0 = res; res.setEncoding('utf8'); let buf = '';
    res.on('data', c => { buf += c; let k; while ((k = buf.indexOf('\n\n')) >= 0) { const m = buf.slice(0, k); buf = buf.slice(k + 2); const ev = m.match(/^event: (.+)$/m), da = m.match(/^data: (.+)$/m); if (ev) events.push({event: ev[1], data: JSON.parse(da[1])}); } });
  });
  return {events, close: () => { r.destroy(); if (res0) res0.destroy(); }, until: async (pred, ms = 2000) => { const t0 = Date.now(); while (!pred(events)) { if (Date.now() - t0 > ms) assert.fail('no such event: ' + JSON.stringify(events)); await wait(20); } }};
}

test('checkout and checkin need the token and the Host rule, like every other endpoint', async () => {
  const s = await start(deckFile());
  try {
    assert.equal((await post(s, '/__decklet/checkout', {by: 'Claude'}, {token: null})).status, 403);
    assert.equal((await post(s, '/__decklet/checkout', {by: 'Claude'}, {token: s.token.slice(1) + 'x'})).status, 403);
    assert.equal((await post(s, '/__decklet/checkout', {by: 'Claude'}, {host: 'evil.example'})).status, 421);
    assert.equal((await post(s, '/__decklet/checkin', {}, {token: null})).status, 403);
    assert.equal((await post(s, '/__decklet/heartbeat', {pending: 1}, {token: null})).status, 403);
    assert.equal((await req(s, 'GET', '/__decklet/checkout')).status, 404, 'POST only');
  } finally { await s.close(); }
});

test('checkout returns the lease and the stream says `lease`; a page that connects later hears it at once; checkin clears it', async () => {
  const s = await start(deckFile()), a = listen(s), disk0 = fs.readFileSync(s.file, 'utf8');
  try {
    await wait(100);
    const t0 = Date.now(), r = await post(s, '/__decklet/checkout', {by: 'Claude', ttl: 900});
    assert.equal(r.status, 200, r.body);
    const {lease} = r.json;
    assert.equal(lease.by, 'Claude');
    assert.ok(Math.abs(Date.parse(lease.since) - t0) < 1000, 'since is now');
    assert.ok(Math.abs(Date.parse(lease.until) - Date.parse(lease.since) - 900e3) < 5, 'until = since + ttl seconds');
    await a.until(e => e.some(x => x.event === 'lease'));
    assert.deepEqual(a.events, [{event: 'lease', data: lease}]);
    const b = listen(s); await b.until(e => e.length);
    assert.deepEqual(b.events, [{event: 'lease', data: lease}], 'a late page learns who holds the deck on connect');
    assert.equal((await post(s, '/__decklet/checkout', {by: 'Codex'})).status, 409, 'someone else holds it');
    const held = await put(s, blockOf(disk0, 'DECK').rev);
    assert.equal(held.status, 423, 'a page write under the lease waits (its journal keeps it until checkin)'); assert.equal(held.json.lease.by, 'Claude');
    assert.equal(fs.readFileSync(s.file, 'utf8'), disk0, 'nothing written');
    const again = await post(s, '/__decklet/checkout', {by: 'Claude', ttl: 60});
    assert.equal(again.status, 200, 'the holder may renew'); assert.equal(again.json.lease.since, lease.since, 'a renewal keeps since');
    const ci = await post(s, '/__decklet/checkin', {});
    assert.equal(ci.status, 200); assert.deepEqual(ci.json, {ok: true, lease: null});
    await a.until(e => e.at(-1).data === null);
    assert.deepEqual(a.events.map(x => x.event), ['lease', 'lease', 'lease'], 'no `changed`: the file did not move');
    b.close();
    assert.equal(fs.readFileSync(s.file, 'utf8'), disk0, 'the file never carries the lease: checkout and checkin leave it byte for byte');
    assert.equal((await post(s, '/__decklet/checkout', {by: 'x', ttl: -1})).status, 400, 'a ttl must be a positive number of seconds');
    assert.equal((await post(s, '/__decklet/checkout', 'not json')).status, 400);
  } finally { a.close(); await s.close(); }
});

test('409 while the page has unacknowledged edits from the last 60 s (heartbeat); a PUT that lands acknowledges them', async () => {
  const s = await start(deckFile(), {guard: 400});
  try {
    const rev = blockOf(fs.readFileSync(s.file, 'utf8'), 'DECK').rev;
    assert.equal((await post(s, '/__decklet/heartbeat', {pending: 2})).status, 200);
    const r = await post(s, '/__decklet/checkout', {by: 'Claude'});
    assert.equal(r.status, 409); assert.equal(r.json.pending, 2, 'says how many edits the page holds');
    assert.equal((await put(s, rev)).status, 200);
    assert.equal((await post(s, '/__decklet/checkout', {by: 'Claude'})).status, 200, 'the PUT acknowledged them');
    await post(s, '/__decklet/checkin', {});
    await post(s, '/__decklet/heartbeat', {pending: 1});
    assert.equal((await post(s, '/__decklet/checkout', {by: 'Claude'})).status, 409);
    await wait(450);
    assert.equal((await post(s, '/__decklet/checkout', {by: 'Claude'})).status, 200, 'past the window a silent page does not block the agent');
    await post(s, '/__decklet/checkin', {});
    await post(s, '/__decklet/heartbeat', {pending: 0});
    assert.equal((await post(s, '/__decklet/checkout', {by: 'Claude'})).status, 200, 'nothing pending, nothing to wait for');
    assert.equal((await post(s, '/__decklet/heartbeat', {pending: 'x'})).status, 400);
  } finally { await s.close(); }
});

test('a lease expires on its own: the stream says `lease` null; a rebuild under the lease is announced again at release', async () => {
  const s = await start(deckFile()), a = listen(s);
  try {
    await wait(100);
    assert.equal((await post(s, '/__decklet/checkout', {by: 'Claude', ttl: 0.3})).status, 200);
    await a.until(e => e.length === 2, 2000);
    assert.equal(a.events[1].event, 'lease'); assert.equal(a.events[1].data, null, 'expired');
    assert.equal((await post(s, '/__decklet/checkout', {by: 'Codex', ttl: 900})).status, 200, 'an expired lease is free');
    fs.writeFileSync(s.file, create(model('Two, rebuilt'), {from: s.file}).html);
    const nrev = blockOf(fs.readFileSync(s.file, 'utf8'), 'DECK').rev;
    await a.until(e => e.some(x => x.event === 'changed'));
    const k = a.events.length;
    await post(s, '/__decklet/checkin', {});
    await a.until(e => e.length >= k + 2);
    assert.deepEqual(a.events.slice(k), [{event: 'changed', data: {rev: nrev}}, {event: 'lease', data: null}], 'checkin: the new rev first, then the lease clears');
  } finally { a.close(); await s.close(); }
});

// ── the CLI: the server writes .decklet-host.json beside the deck; --checkout / --checkin find it there ──
function spawnServe(file) {
  const child = spawn(process.execPath, [bin, file], {stdio: ['ignore', 'pipe', 'pipe']});
  return new Promise((ok, no) => { let out = ''; child.stdout.on('data', c => { out += c; if (out.includes('\n')) ok({child, port: +new URL(out.trim()).port}); }); child.on('exit', c => no(new Error('exited ' + c))); });
}
const stop = (c, sig = 'SIGTERM') => new Promise(r => { if (c.exitCode != null) return r(c.exitCode); c.on('exit', r); c.kill(sig); });
const cli = (...args) => new Promise(r => execFile(process.execPath, [bin, ...args], (err, stdout, stderr) => r({code: err ? err.code : 0, stdout, stderr})));

test('.decklet-host.json: {port, token, pid} beside the deck, mode 0600, removed on SIGTERM and SIGINT', async () => {
  const f = deckFile(), hf = path.join(path.dirname(f), '.decklet-host.json');
  for (const sig of ['SIGTERM', 'SIGINT']) {
    const {child, port} = await spawnServe(f);
    const j = JSON.parse(fs.readFileSync(hf, 'utf8'));
    assert.deepEqual(Object.keys(j).sort(), ['pid', 'port', 'token']);
    assert.equal(j.port, port); assert.equal(j.pid, child.pid);
    assert.equal(fs.statSync(hf).mode & 0o777, 0o600, 'only this user can read the token');
    const page = await new Promise(ok => http.get({host: '127.0.0.1', port, path: '/', headers: {host: `127.0.0.1:${port}`}}, res => { let b = ''; res.on('data', c => b += c); res.on('end', () => ok(b)); }));
    assert.ok(page.includes(`content="${j.token}"`), 'the same token the page carries');
    assert.equal(await stop(child, sig), 0);
    assert.equal(fs.existsSync(hf), false, sig + ': gone on shutdown');
  }
});

test('--checkout / --checkin: one line each through the running server; without one, a no-op that says so (exit 0); 409 exits 1', async () => {
  const f = deckFile(), {child, port} = await spawnServe(f);
  const s = {port, token: JSON.parse(fs.readFileSync(path.join(path.dirname(f), '.decklet-host.json'), 'utf8')).token, file: f};
  const a = listen(s);
  try {
    await wait(100);
    const co = await cli(f, '--checkout', '--by', 'Claude', '--ttl', '600');
    assert.equal(co.code, 0, co.stderr); assert.match(co.stdout, /^checked out deck\.html for Claude until \d\d:\d\d\n$/);
    await a.until(e => e.some(x => x.event === 'lease'));
    assert.equal(a.events[0].data.by, 'Claude');
    assert.ok(Math.abs(Date.parse(a.events[0].data.until) - Date.parse(a.events[0].data.since) - 600e3) < 5);
    const ci = await cli(f, '--checkin');
    assert.equal(ci.code, 0, ci.stderr); assert.equal(ci.stdout, 'checked in deck.html\n');
    await a.until(e => e.at(-1).data === null);
    await post(s, '/__decklet/heartbeat', {pending: 3});
    const busy = await cli(f, '--checkout', '--by', 'Claude');
    assert.equal(busy.code, 1); assert.match(busy.stdout, /^deck\.html has 3 edits the page has not saved yet; retry in a few seconds\n$/);
  } finally { a.close(); await stop(child); }
  for (const mode of [['--checkout', '--by', 'Claude'], ['--checkin']]) {
    const r = await cli(f, ...mode);
    assert.equal(r.code, 0, mode[0]); assert.match(r.stdout, /^no decklet server for deck\.html; check(out|in) is a no-op without one\n$/, mode[0]);
  }
  // a host file left by a server that died without cleaning up is not a server
  fs.writeFileSync(path.join(path.dirname(f), '.decklet-host.json'), JSON.stringify({port: 1, token: 'x', pid: 999999}));
  assert.match((await cli(f, '--checkin')).stdout, /^no decklet server/);
});

test.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
