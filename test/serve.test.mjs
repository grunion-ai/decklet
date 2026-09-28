// decklet serve: bin/serve.mjs hosts one deck on 127.0.0.1 so any browser's edits land in the file and an agent's rebuild
// reaches the open page. Node only (no browser): the token rides a <meta> the server injects into the response (the file on disk
// is untouched), a foreign Host is refused (DNS rebinding), a PUT is {model, log} spliced into the file through the same pure
// function fileHtml() writes with, a stale If-Match is a 412, a write is atomic and keeps the old file in .decklet-history/,
// and the SSE stream says `changed` for someone else's write and stays quiet about its own. Live proofs: serve-live.test.mjs.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {create} from '../bin/create.mjs';
import {blockOf, splice, applyLog} from '../lib/edits.mjs';
import {serve} from '../bin/serve.mjs';
import {edits} from '../bin/edits.mjs';
import {flagMap, loadChecker} from '../lib/spell.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'serve.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-serve-'));
const model = (two = 'Two') => ({w: 960, h: 540, title: 'serve', slides: [
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: 'One'}]},
  {els: [{x: 60, y: 80, w: 800, role: 'H1', text: two}]},
]});
let n = 0;
const deckFile = () => { const d = path.join(tmp, 'd' + ++n); fs.mkdirSync(d); const f = path.join(d, 'deck.html'); fs.writeFileSync(f, create(model()).html); return f; };

// start the server as the person would; resolves on the one line it prints
async function start(file, args = []) {
  const child = spawn(process.execPath, [bin, file, ...args], {stdio: ['ignore', 'pipe', 'pipe']});
  const line = await new Promise((ok, no) => { let out = ''; child.stdout.on('data', c => { out += c; if (out.includes('\n')) ok(out); }); child.on('exit', c => no(new Error('exited ' + c))); });
  const port = +new URL(line.trim()).port;
  const s = {child, line, port, origin: `http://127.0.0.1:${port}`};
  s.token = (await get(s, '/')).body.match(/<meta name="decklet-host" content="([^"]+)">/)[1];
  return s;
}
const stop = s => new Promise(r => { if (s.child.exitCode != null) return r(s.child.exitCode); s.child.on('exit', r); s.child.kill('SIGTERM'); });
// raw http so the Host header is ours to set
function req(s, method, p, {headers = {}, body, host = `127.0.0.1:${s.port}`} = {}) {
  return new Promise((ok, no) => {
    const r = http.request({host: '127.0.0.1', port: s.port, method, path: p, headers: {host, ...headers}}, res => {
      const c = []; res.on('data', x => c.push(x)); res.on('end', () => ok({status: res.statusCode, headers: res.headers, buf: Buffer.concat(c), body: Buffer.concat(c).toString()}));
    });
    r.on('error', no); if (body != null) r.write(body); r.end();
  });
}
const get = (s, p, o) => req(s, 'GET', p, o);
const put = (s, body, {token = s.token, rev} = {}) => req(s, 'PUT', '/__decklet/file', {headers: {'content-type': 'application/json', ...(token ? {'x-decklet-token': token} : {}), ...(rev != null ? {'if-match': rev} : {})}, body: JSON.stringify(body)});
const edited = file => { const html = fs.readFileSync(file, 'utf8'), d = blockOf(html, 'DECK'), log = blockOf(html, 'LOG', []); d.slides[0].els[0].text = 'Uno'; return {html, model: d, log: [...log, {t: '2026-09-27T00:00:00.000Z', s: d.slides[0].id, r: d.slides[0].els[0].id, k: {text: ['One', 'Uno']}, rev: d.rev}]}; };

test('prints the plain origin (no token in it) and nothing else; --port fixes the port', async () => {
  const f = deckFile(), s = await start(f);
  assert.match(s.line, /^http:\/\/127\.0\.0\.1:\d+\/\n$/, s.line);
  await stop(s);
  const free = await new Promise(r => { const t = net.createServer().listen(0, '127.0.0.1', () => { const p = t.address().port; t.close(() => r(p)); }); });
  const s2 = await start(f, ['--port', String(free)]);
  assert.equal(s2.port, free); await stop(s2);
});

test('GET / is the file plus exactly one injected <meta name="decklet-host">; the file on disk is untouched', async () => {
  const f = deckFile(), disk = fs.readFileSync(f), s = await start(f);
  try {
    const r = await get(s, '/');
    assert.equal(r.status, 200); assert.match(r.headers['content-type'], /text\/html/); assert.equal(r.headers['access-control-allow-origin'], undefined, 'no CORS, ever');
    const meta = `<meta name="decklet-host" content="${s.token}">`;
    assert.ok(s.token.length >= 20, 'a real token');
    assert.equal(r.body, disk.toString().replace(/<head>/, '<head>' + meta), 'the file bytes plus the meta right after <head>');
    assert.deepEqual(fs.readFileSync(f), disk, 'disk unchanged');
  } finally { await stop(s); }
});

test('a Host other than 127.0.0.1:<port> or localhost:<port> is refused (DNS rebinding)', async () => {
  const f = deckFile(), s = await start(f);
  try {
    assert.equal((await get(s, '/', {host: `localhost:${s.port}`})).status, 200);
    for (const host of ['evil.example', `evil.example:${s.port}`, `127.0.0.1:${s.port + 1}`, `localhost.evil.example:${s.port}`]) {
      const r = await get(s, '/', {host});
      assert.equal(r.status, 421, host); assert.ok(!r.body.includes(s.token), host + ': no token leaks');
    }
    assert.equal((await req(s, 'PUT', '/__decklet/file', {host: 'evil.example', headers: {'x-decklet-token': s.token, 'if-match': 'x'}, body: '{}'})).status, 421);
  } finally { await stop(s); }
});

test('the probe and the stream need the token; a PUT with a missing or wrong token is 403 and writes nothing', async () => {
  const f = deckFile(), disk = fs.readFileSync(f), rev = blockOf(disk.toString(), 'DECK').rev, s = await start(f);
  try {
    assert.equal((await get(s, '/__decklet')).status, 403);
    const pr = await get(s, '/__decklet', {headers: {'x-decklet-token': s.token}});
    assert.equal(pr.status, 200); assert.deepEqual(JSON.parse(pr.body), {ok: true, rev, name: 'deck.html'});
    assert.equal((await get(s, '/__decklet/events?t=nope')).status, 403);
    const e = edited(f);
    assert.equal((await put(s, {model: e.model, log: e.log}, {token: null, rev})).status, 403);
    assert.equal((await put(s, {model: e.model, log: e.log}, {token: s.token.slice(1) + 'x', rev})).status, 403);
    assert.deepEqual(fs.readFileSync(f), disk);
  } finally { await stop(s); }
});

test('a stale If-Match is 412 with the current rev; a missing one is 412 too', async () => {
  const f = deckFile(), s = await start(f);
  try {
    const rev = blockOf(fs.readFileSync(f, 'utf8'), 'DECK').rev, e = edited(f);
    const r = await put(s, {model: e.model, log: e.log}, {rev: 'deadbeef00'});
    assert.equal(r.status, 412); assert.equal(JSON.parse(r.body).rev, rev);
    assert.equal((await put(s, {model: e.model, log: e.log})).status, 412);
    assert.ok(!fs.existsSync(path.join(path.dirname(f), '.decklet-history')), 'nothing written');
  } finally { await stop(s); }
});

test('a PUT splices {model, log} into the file through splice() (the function fileHtml() writes with), atomically, and keeps the old file in .decklet-history/', async () => {
  const f = deckFile(), s = await start(f);
  try {
    const before = fs.readFileSync(f, 'utf8'), rev = blockOf(before, 'DECK').rev, e = edited(f);
    const r = await put(s, {model: e.model, log: e.log}, {rev});
    assert.equal(r.status, 200, r.body); assert.deepEqual(JSON.parse(r.body), {ok: true, rev});
    const after = fs.readFileSync(f, 'utf8');
    assert.equal(after, splice(before, e.model, e.log), 'no spell request has loaded a dictionary, so the SPELL block stays: byte for byte what the page\'s own splice makes of the same model and log');
    assert.equal(blockOf(after, 'DECK').slides[0].els[0].text, 'Uno'); assert.equal(blockOf(after, 'LOG').length, 1);
    assert.ok(!after.includes(s.token), 'the injected meta never reaches the file');
    const dir = path.dirname(f), hist = fs.readdirSync(path.join(dir, '.decklet-history'));
    assert.equal(hist.length, 1); assert.match(hist[0], new RegExp(`^${rev}-\\d+\\.html$`));
    assert.equal(fs.readFileSync(path.join(dir, '.decklet-history', hist[0]), 'utf8'), before, 'the history copy is the file as it was');
    assert.deepEqual(fs.readdirSync(dir).sort(), ['.decklet-history', '.decklet-host.json', 'deck.html'], 'no temp file left behind (.decklet-host.json is the running server\'s, test/checkout.test.mjs)');
    assert.equal((await put(s, {nope: 1}, {rev})).status, 400, 'a body without model + log is refused');
  } finally { await stop(s); }
});

test('splice() rewrites only the DECK and LOG data blocks, escapes </script, and is what fileHtml() calls', () => {
  const html = create(model()).html, d = blockOf(html, 'DECK');
  d.slides[0].els[0].text = 'a </script> b';
  const out = splice(html, d, [{x: 1}]);
  assert.equal(blockOf(out, 'DECK').slides[0].els[0].text, 'a </script> b');
  assert.doesNotMatch(out.slice(out.indexOf('=/*DECK*/'), out.indexOf('/*/DECK*/')), /<\/script/i);
  assert.deepEqual(blockOf(out, 'LOG'), [{x: 1}]);
  assert.equal(out.replace(/=\/\*DECK\*\/[\s\S]*?\/\*\/DECK\*\//, '').replace(/=\/\*LOG\*\/[\s\S]*?\/\*\/LOG\*\//, ''), html.replace(/=\/\*DECK\*\/[\s\S]*?\/\*\/DECK\*\//, '').replace(/=\/\*LOG\*\/[\s\S]*?\/\*\/LOG\*\//, ''), 'nothing else moves');
  assert.deepEqual(blockOf(splice(html, d, [], {dekjck: ['deck']}), 'SPELL'), {dekjck: ['deck']}, 'a fourth argument rewrites the SPELL block (the server\'s PUT, issue 86)');
  const old = html.replace(/const SPELL0=\/\*SPELL\*\/[\s\S]*?\/\*\/SPELL\*\//, 'const SPELL0=[]');
  assert.equal(blockOf(splice(old, d, [], {dekjck: []}), 'DECK').slides[0].els[0].text, 'a </script> b', 'a file from before the SPELL block keeps working: no block, nothing to rewrite');
  const tpl = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
  assert.match(tpl.slice(tpl.indexOf('function fileHtml(')), /^function fileHtml\(\)\{[\s\S]*?sc\.textContent=splice\(sc\.textContent,deck,log\)/, 'fileHtml writes through splice()');
});

// ── live spellcheck (issue 86): the page asks the server about the words of a committed row; the server runs lib/spell.mjs,
// the build's own code and dictionary, so the build and the live check never disagree about a word ──
const spellReq = (s, body, {token = s.token, host} = {}) => req(s, 'POST', '/__decklet/spell', {host, headers: {'content-type': 'application/json', ...(token ? {'x-decklet-token': token} : {})}, body: typeof body === 'string' ? body : JSON.stringify(body)});

test('POST /__decklet/spell answers the refused words of a word list with their suggestions, through lib/spell.mjs, honouring the deck\'s spell.ignore', async () => {
  const c = await loadChecker('en'); if (!c) return; // the dictionary is an optional peer: the no-dictionary answer is proved below
  const d = path.join(tmp, 'spell-ignore'); fs.mkdirSync(d); const f = path.join(d, 'deck.html');
  fs.writeFileSync(f, create({...model(), spell: {ignore: ['Grunion']}}).html);
  const s = await start(f);
  try {
    const words = ['Untityled', 'dekjck', 'plan', 'MCA', 'grunion', 'Untityled'];
    const r = await spellReq(s, {words});
    assert.equal(r.status, 200, r.body); assert.equal(r.headers['access-control-allow-origin'], undefined, 'no CORS, ever');
    const j = JSON.parse(r.body);
    assert.deepEqual(j, {ok: true, flags: flagMap({slides: [{els: [{text: words.join(' ')}]}], spell: {ignore: ['Grunion']}}, c)}, 'exactly what the build computes for the same words');
    assert.deepEqual(Object.keys(j.flags), ['dekjck', 'untityled'], 'shouting and ignored words pass, as they do at build time');
    assert.ok(j.flags.untityled.includes('untitled'), 'with the dictionary\'s suggestions: ' + j.flags.untityled);
    assert.deepEqual(JSON.parse((await spellReq(s, {words: []})).body), {ok: true, flags: {}}, 'the empty list is the probe');
  } finally { await stop(s); }
});

test('POST /__decklet/spell is guarded like the write endpoints: token, Host, and a bounded list of short strings', async () => {
  const f = deckFile(), s = await start(f);
  try {
    assert.equal((await spellReq(s, {words: ['dekjck']}, {token: null})).status, 403, 'no token');
    assert.equal((await spellReq(s, {words: ['dekjck']}, {token: s.token.slice(1) + 'x'})).status, 403, 'a wrong token');
    assert.equal((await spellReq(s, {words: ['dekjck']}, {host: 'evil.example'})).status, 421, 'a foreign Host');
    for (const bad of [{}, {words: 'dekjck'}, {words: [1]}, {words: ['x'.repeat(65)]}, {words: Array(501).fill('word')}, 'not json'])
      assert.equal((await spellReq(s, bad)).status, 400, JSON.stringify(bad).slice(0, 40));
    assert.equal((await get(s, '/__decklet/spell', {headers: {'x-decklet-token': s.token}})).status, 404, 'POST only');
  } finally { await stop(s); }
});

test('a PUT rewrites the SPELL block from the new model, so a reload shows the live flags; bin/edits.mjs and create --from still read the file', async () => {
  const c = await loadChecker('en'); if (!c) return;
  const f = deckFile(), s = await start(f);
  try {
    assert.equal((await spellReq(s, {words: []})).status, 200, 'the page\'s probe loads the dictionary; a PUT never waits for it');
    const before = fs.readFileSync(f, 'utf8'), rev = blockOf(before, 'DECK').rev, e = edited(f);
    e.model.slides[1].els[0].text = 'Untityled dekjck';
    assert.equal((await put(s, {model: e.model, log: e.log}, {rev})).status, 200);
    const after = fs.readFileSync(f, 'utf8');
    assert.deepEqual(blockOf(after, 'SPELL'), flagMap(e.model, c), 'the words the build would flag in this model, with their suggestions');
    assert.ok('untityled' in blockOf(after, 'SPELL') && 'dekjck' in blockOf(after, 'SPELL'));
    assert.equal(edits(after).log.length, 1, 'bin/edits.mjs reads the log');
    assert.equal(blockOf(create(model(), {from: f}).html, 'DECK').slides[0].els[0].text, 'Uno', 'create --from reads the file and replays the edit');
  } finally { await stop(s); }
});

test('without a dictionary the endpoint says checking is unavailable (503) and a PUT leaves the build\'s SPELL block as it was', async () => {
  const f = deckFile(), html = fs.readFileSync(f, 'utf8').replace(/=\/\*SPELL\*\/[\s\S]*?\/\*\/SPELL\*\//, '=/*SPELL*/{"built":["kept"]}/*/SPELL*/');
  fs.writeFileSync(f, html);
  const s = await serve(f, {checker: async () => null}), p = s.port, host = `127.0.0.1:${p}`;
  const call = (method, pth, body, h = {}) => fetch(`http://${host}${pth}`, {method, headers: {'content-type': 'application/json', 'x-decklet-token': s.token, ...h}, body: body && JSON.stringify(body)});
  try {
    const r = await call('POST', '/__decklet/spell', {words: ['dekjck']});
    assert.equal(r.status, 503); assert.deepEqual(await r.json(), {ok: false, reason: 'no dictionary'});
    const rev = blockOf(html, 'DECK').rev, e = edited(f);
    assert.equal((await call('PUT', '/__decklet/file', {model: e.model, log: e.log}, {'if-match': rev})).status, 200);
    assert.deepEqual(blockOf(fs.readFileSync(f, 'utf8'), 'SPELL'), {built: ['kept']}, 'no dictionary, no opinion: the build\'s words stay');
  } finally { await s.close(); }
});

test('the SSE stream says `changed` with the new rev for a write that is not its own PUT, and nothing for its own', async () => {
  const f = deckFile(), s = await start(f);
  const events = []; const es = http.get({host: '127.0.0.1', port: s.port, path: '/__decklet/events?t=' + s.token, headers: {host: `127.0.0.1:${s.port}`}}, res => {
    assert.equal(res.headers['content-type'], 'text/event-stream'); res.setEncoding('utf8'); let buf = '';
    res.on('data', c => { buf += c; let k; while ((k = buf.indexOf('\n\n')) >= 0) { const m = buf.slice(0, k); buf = buf.slice(k + 2); const ev = m.match(/^event: (.+)$/m), da = m.match(/^data: (.+)$/m); if (ev) events.push({event: ev[1], data: JSON.parse(da[1])}); } });
  });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    await wait(200);
    const rev = blockOf(fs.readFileSync(f, 'utf8'), 'DECK').rev, e = edited(f);
    assert.equal((await put(s, {model: e.model, log: e.log}, {rev})).status, 200);
    await wait(500);
    assert.deepEqual(events, [], 'our own PUT is not news');
    const next = create(model('Two, rebuilt'), {from: f}).html, nrev = blockOf(next, 'DECK').rev;   // the agent: create --from
    fs.writeFileSync(f, next);
    for (let k = 0; k < 40 && !events.length; k++) await wait(50);
    assert.deepEqual(events, [{event: 'changed', data: {rev: nrev}}]);
    assert.notEqual(nrev, rev);
  } finally { es.destroy(); await stop(s); }
});

test('binds 127.0.0.1 only: another interface of this machine is refused', async () => {
  const f = deckFile(), s = await start(f);
  const refused = host => new Promise(r => { const c = net.connect({host, port: s.port}); c.on('connect', () => { c.destroy(); r(false); }); c.on('error', () => r(true)); });
  try {
    const others = Object.values(os.networkInterfaces()).flat().filter(a => a && !a.internal && a.family === 'IPv4').map(a => a.address);
    for (const a of ['::1', ...others]) assert.equal(await refused(a), true, a);
    assert.equal(await refused('127.0.0.1'), false);
  } finally { await stop(s); }
});

test('SIGINT and SIGTERM stop it cleanly (exit 0)', async () => {
  const f = deckFile();
  for (const sig of ['SIGINT', 'SIGTERM']) { const s = await start(f); const code = await new Promise(r => { s.child.on('exit', r); s.child.kill(sig); }); assert.equal(code, 0, sig); }
});

test('applyLog(deck, log, true): a key the agent also changed keeps the agent\'s value, the entry records it (yielded), and a later human-wins replay leaves it', () => {
  const agent = {slides: [{id: 's1', els: [{id: 'r1', text: 'Agent'}, {id: 'r2', text: 'b'}]}]};
  const log = [{s: 's1', r: 'r1', k: {text: ['One', 'Human']}}, {s: 's1', r: 'r2', k: {text: ['b', 'B']}}];
  const r = applyLog(agent, log, true);
  assert.equal(agent.slides[0].els[0].text, 'Agent'); assert.equal(agent.slides[0].els[1].text, 'B');
  assert.deepEqual(r.conflicts, [{s: 's1', r: 'r1', key: 'text', human: 'Human', agent: 'Agent', kept: 'agent'}]);
  assert.deepEqual(log[0].yielded, {text: 'Agent'});
  const again = {slides: [{id: 's1', els: [{id: 'r1', text: 'Agent'}, {id: 'r2', text: 'b'}]}]};
  applyLog(again, log);
  assert.equal(again.slides[0].els[0].text, 'Agent', 'create --from never brings a yielded value back');
});

test.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
