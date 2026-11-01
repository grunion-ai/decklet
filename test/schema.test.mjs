import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {schemas} from '../schemas/build.mjs';
import {ROLES, ANIMS, FORMATS, ARROWS, HEADS, PAGES, validateModel} from '../bin/validate.mjs';
import {DENSITY} from '../lib/layouts.mjs';
import {TEMPLATE} from '../lib/templates.mjs';
import {PLATES} from '../lib/logo.mjs';
import {STYLES} from '../lib/connector.mjs';
import {MARKS} from '../lib/chart.mjs';
import {create} from '../bin/create.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decklet-schema-'));

const ref = (schema, s) => s.$ref ? ref(schema, s.$ref.split('/').slice(1).reduce((o, k) => o[k], schema)) : s;
const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;
const fits = (t, v) => [t].flat().some(x => x === typeOf(v) || (x === 'number' && typeOf(v) === 'integer'));
function check(schema, s, v, at, out) {
  s = ref(schema, s);
  if (s.anyOf) { if (!s.anyOf.some(o => !check(schema, o, v, at, []).length)) out.push(`${at}: matches none of anyOf`); return out; }
  if (s.const !== undefined && v !== s.const) out.push(`${at}: ${JSON.stringify(v)} is not ${JSON.stringify(s.const)}`);
  if (s.type && !fits(s.type, v)) { out.push(`${at}: ${typeOf(v)} is not ${s.type}`); return out; }
  if (s.enum && !s.enum.includes(v)) out.push(`${at}: ${JSON.stringify(v)} not in enum`);
  if (typeOf(v) === 'string' && s.pattern && !new RegExp(s.pattern).test(v)) out.push(`${at}: does not match ${s.pattern}`);
  if (typeOf(v) === 'array') {
    if (s.minItems && v.length < s.minItems) out.push(`${at}: fewer than ${s.minItems} items`);
    if (s.items) v.forEach((x, k) => check(schema, s.items, x, `${at}[${k}]`, out));
  }
  if (typeOf(v) === 'object') {
    for (const k of s.required || []) if (!(k in v)) out.push(`${at}: missing ${k}`);
    for (const [k, x] of Object.entries(v)) {
      const sub = s.properties?.[k] ?? (typeof s.additionalProperties === 'object' ? s.additionalProperties : null);
      if (sub) check(schema, sub, x, `${at}.${k}`, out);
    }
  }
  return out;
}

test('schema: the committed files are what schemas/build.mjs writes (#203)', () => {
  for (const [file, json] of Object.entries(schemas())) assert.equal(fs.readFileSync(path.join(root, 'schemas', file), 'utf8'), JSON.stringify(json, null, 2) + '\n', `rebuild with: node schemas/build.mjs (${file})`);
});

test('schema: every enum is the constant the engine checks against (#203)', () => {
  const {['model.schema.json']: m, ['style.schema.json']: st} = schemas();
  const row = m.$defs.row.properties, slide = m.$defs.slide.properties;
  assert.deepEqual(m.properties.format.enum, FORMATS);
  assert.deepEqual(m.properties.page.enum, PAGES);
  assert.deepEqual(m.properties.density.enum, Object.keys(DENSITY));
  assert.deepEqual(slide.density.enum, Object.keys(DENSITY));
  assert.deepEqual(slide.template.enum, Object.keys(TEMPLATE));
  assert.deepEqual(row.anim.enum, ANIMS);
  assert.deepEqual(row.arrow.enum, ARROWS);
  assert.deepEqual(row.head.enum, HEADS);
  assert.deepEqual(row.style.enum, STYLES);
  assert.deepEqual(row.plate.enum, PLATES);
  assert.deepEqual(row.chart.properties.mark.enum, MARKS);
  for (const r of ROLES) assert.ok(st.properties.roles.properties[r], `style schema names role ${r}`);
  assert.deepEqual(m.properties.styles.properties.roles.properties, st.properties.roles.properties, 'one role shape in both schemas');
});

test('schema: every shipped model and style kit passes the schema (#203)', () => {
  const {['model.schema.json']: m, ['style.schema.json']: st} = schemas();
  const models = fs.readdirSync(path.join(root, 'examples'), {withFileTypes: true}).filter(d => d.isDirectory()).map(d => `examples/${d.name}/model.json`).filter(f => fs.existsSync(path.join(root, f)));
  assert.ok(models.length >= 3);
  for (const f of models) assert.deepEqual(check(m, m, read(f), f, []), [], f);
  const kits = fs.readdirSync(path.join(root, 'examples/styles'), {withFileTypes: true}).filter(d => d.isDirectory()).map(d => `examples/styles/${d.name}/style.json`);
  for (const f of kits) assert.deepEqual(check(st, st, read(f), f, []), [], f);
  assert.ok(check(m, m, {format: 'slides', slides: [{els: [{anim: 'spin'}]}]}, 'bad', []).some(e => /anim: "spin" not in enum/.test(e)), 'the checker catches a bad enum');
});

test('schema: new.mjs points the model at the schema, validate accepts it, and create keeps it out of the deck (#203)', () => {
  const out = path.join(tmp, 'm.json');
  assert.equal(spawnSync(process.execPath, [path.join(root, 'bin/new.mjs'), '--out', out, '--slides', '3'], {encoding: 'utf8'}).status, 0);
  const model = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(Object.keys(model)[0], '$schema');
  assert.equal(path.resolve(tmp, model.$schema), path.join(root, 'schemas/model.schema.json'));
  const {['model.schema.json']: m} = schemas();
  assert.deepEqual(check(m, m, model, 'new.mjs model', []), []);
  assert.equal(validateModel(model, null).errors.length, 0);
  const {deck, html} = create(model, {});
  assert.equal(deck.$schema, undefined);
  assert.ok(!html.includes('model.schema.json'), 'no local path leaks into the deck');
});

test('schema: package.json ships schemas/ (#203)', () => {
  assert.ok(read('package.json').files.includes('schemas'));
});
