#!/usr/bin/env node
// decklet schemas — writes schemas/model.schema.json and schemas/style.schema.json from the constants the engine checks against.
//   node schemas/build.mjs
// test/schema.test.mjs fails when a committed file differs from what this writes, so an enum never drifts from the code.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROLES, OPTIONAL, ANIMS, FORMATS, ARROWS, HEADS, PAGES} from '../bin/validate.mjs';
import {DENSITY} from '../lib/layouts.mjs';
import {TEMPLATE} from '../lib/templates.mjs';
import {PLATES} from '../lib/logo.mjs';
import {STYLES} from '../lib/connector.mjs';
import {MARKS} from '../lib/chart.mjs';
import {isMain} from '../lib/is-main.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const num = {type: 'number'}, str = {type: 'string'}, flag = {type: ['integer', 'boolean']}, ref = {type: ['string', 'integer']};
const d = (description, s) => ({...s, description});

const role = {
  type: 'object',
  required: ['font', 'size', 'weight', 'color'],
  properties: {
    font: d('a font stack: an installed or system family first, a generic fallback last; the deck loads no webfonts', str),
    size: d('model px', num), weight: {type: ['number', 'string']}, lh: d('line height, model px', {type: ['number', 'null']}),
    ls: d('letter spacing, model px', num), color: str, tt: d('text-transform, e.g. uppercase', str),
    cw: d('measured average glyph width in em (bin/measure-cw.mjs)', num),
  },
};
const roles = {type: 'object', description: 'the eight text roles (plus the optional Stat2): the whole type system', properties: Object.fromEntries([...ROLES, ...OPTIONAL].map(r => [r, {$ref: '#/$defs/role'}]))};

const row = {
  type: 'object',
  description: 'a row is whatever its props make it: text, a painted box, a line, a connector, an image, a logo, a chart',
  properties: {
    id: str, x: num, y: num, right: d('the right edge N px from the canvas right edge; exclusive with x', num),
    w: {anyOf: [num, {const: 'auto'}]}, h: num, slot: str, role: d('a role from styles.roles; required for text', str),
    text: str, html: d('inline runs only: <b> <i> <u> <s> <span style="color:…"> <a href="…">', str),
    weight: {type: ['number', 'string']}, color: str, tt: str, italic: flag, align: {enum: ['left', 'center', 'right']},
    valign: {enum: ['middle', 'bottom']}, nowrap: flag, bullet: flag, ws: str, p: {type: ['string', 'number']},
    bg: str, bd: str, bt: str, br: str, bb: str, bl: str, radius: {type: ['number', 'string']}, shadow: str, op: num,
    box: flag, tile: flag, bar: flag,
    line: d('[x2, y2]', {type: 'array', items: num, minItems: 2}),
    curve: d('[c1x, c1y, c2x, c2y, x2, y2]', {type: 'array', items: num, minItems: 6}),
    arrow: {enum: ARROWS}, to: ref, from: ref, gap: num, after: ref,
    style: d('a connector row: {from, to, style}', {enum: STYLES}), head: {enum: HEADS},
    dash: {anyOf: [flag, {type: 'array', items: num, minItems: 2}]}, waive: flag, over: flag, butt: flag,
    href: d('http/https/mailto, or #n / #slide-id into the deck', str),
    donut: num, hole: num, svg: str, icon: d('a Lucide icon name (validate --icons)', str),
    img: d("a data: URI or '#id' naming deck.assets", str), fit: str, pos: str,
    logo: d("a data: URI, '#id' or '' for a monogram", str), name: str, col: num, aspect: num, plate: {enum: PLATES}, monogram: str, entity: str,
    alt: str, anim: {enum: ANIMS},
    chart: {type: 'object', properties: {mark: {enum: MARKS}, data: {type: 'array'}}},
    css: str, override: d('a master id: only the props this row carries replace the master on this slide', str),
    footer: flag, placeholder: str,
  },
};

const slide = {
  type: 'object',
  properties: {
    id: str, name: str, layout: d('a deck layout or one of the library layouts (validate --layouts)', str), bg: str,
    hide: {type: 'array', items: str}, notes: str, textOnly: {type: 'boolean'}, kind: {enum: ['summary']},
    density: {enum: Object.keys(DENSITY)}, template: d('a library template (validate --templates)', {enum: Object.keys(TEMPLATE)}),
    fill: {type: 'object'}, els: {type: 'array', items: {$ref: '#/$defs/row'}},
  },
};

export function schemas() {
  const model = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'decklet model',
    description: 'The JSON model bin/create.mjs builds into one deck.html. Structure and enums only: bin/validate.mjs checks fit, air, density, coverage and the rest.',
    type: 'object',
    required: ['slides'],
    properties: {
      $schema: str, w: num, h: num, format: {enum: FORMATS}, page: {enum: PAGES}, title: str, lang: str, id: str, rev: str,
      spell: {type: 'object', properties: {ignore: {type: 'array', items: str}}}, counter: {const: 0},
      density: {enum: Object.keys(DENSITY)}, draft: {type: 'boolean'},
      styles: {type: 'object', properties: {roles, margin: num, pad: {type: 'object', additionalProperties: str}, gap: num}},
      slots: {type: 'object'}, layouts: {type: 'object'},
      master: {type: 'array', items: {$ref: '#/$defs/row'}},
      slides: {type: 'array', minItems: 1, items: {$ref: '#/$defs/slide'}},
      assets: {type: 'object', additionalProperties: {type: 'string', pattern: '^data:'}},
      entities: {type: 'array', items: {anyOf: [str, {type: 'array', items: str}]}},
    },
    $defs: {role, row, slide},
  };
  const style = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'decklet style',
    description: 'style.json: tokens, the eight roles, pad, margin and gap (SKILL.md STYLE CONTRACT).',
    type: 'object',
    required: ['tokens', 'roles'],
    properties: {
      tokens: {type: 'object', properties: Object.fromEntries(['bg', 'fg', 'muted', 'accent', 'card', 'line', 'sel', 'box'].map(k => [k, str])), additionalProperties: str},
      roles, pad: {type: 'object', additionalProperties: str}, margin: num, gap: num,
    },
    $defs: {role},
  };
  return {'model.schema.json': model, 'style.schema.json': style};
}

if (isMain(import.meta.url)) for (const [file, json] of Object.entries(schemas())) { fs.writeFileSync(path.join(here, file), JSON.stringify(json, null, 2) + '\n'); console.log('wrote schemas/' + file); }
