---
name: decklet
description: Author presentations, carousels and one-page documents as a decklet JSON model and build them into ONE self-contained, editable HTML file — zero dependencies, zero network, verified layout. Use when asked to "make a deck / slides / presentation / carousel / one-pager" from any content (outline, notes, markdown, transcript, data), when converting finished HTML pages into an editable deck, or when a deck must be brand-true and hand-editable by a human afterwards. Not for interactive web apps or PPTX/Google Slides output.
triggers:
  - make a deck
  - build slides
  - presentation from these notes
  - turn this into a carousel
  - one-pager from this doc
  - editable deck, single html
  - convert these html mockups into a deck
---

# decklet — agent authoring skill

You produce a **model** (JSON). The toolchain produces a **deck** (one `.html` file) that a human can drag, retype, present and print. Your job is to get the model right; the validator and verifier tell you when you haven't.

## START HERE

    node bin/new.mjs --out model.json --slides 8 --density reading
    node bin/validate.mjs model.json --style style.json --strict
    node bin/create.mjs --model model.json --style style.json --out deck.html --format slides
    node bin/verify.mjs deck.html --strict

`node bin/validate.mjs --layouts` prints every slot box and free band; `--templates` prints every fill key and the `fixed:` rows no key reaches.
A first `VERIFY PASS` is half the job — the second pass is [docs/building.md](docs/building.md).

- a figure → [docs/figures.md](docs/figures.md); a chart → [docs/charts.md](docs/charts.md)
- logos, screenshots, the asset table → [docs/assets.md](docs/assets.md), [docs/logo.md](docs/logo.md)
- what `verify` measures → [docs/verify.md](docs/verify.md)
- the editor, PDF, versions → [docs/editor.md](docs/editor.md)
- worked models → [docs/examples.md](docs/examples.md)

---

All commands run from the repo root with plain Node ≥ 22. Installed as a Claude Code plugin, the repo root is `${CLAUDE_PLUGIN_ROOT}`; installed with `npx skills add`, it is the skill's own directory. Only `verify` (and `import-html`) need the optional `playwright` devDependency.

---

## INPUTS

### 1. Content — anything
Outline, markdown, meeting notes, a transcript, a spreadsheet, a brief; finished HTML pages: [docs/import-html.md](docs/import-html.md). You distil it; nothing is pasted verbatim. One idea per slide. Numbers become `Stat` rows, lists become 2–4 short `Body` rows or tiles, sequences become boxes with arrows, comparisons become two columns.

### 2. Format — one of
| format | canvas (model px) | print page | status |
|---|---|---|---|
| `slides` | 960×540 (or 1600×900 via `--space 1600x900`) | Letter, slide zoomed to page width | **supported** |

Eight more are **experimental**, same model: `carousel` (1080×1080), `carousel-4x5` (1080×1350), `document-letter` / `document-a4` and their `-landscape` pairs, `slides-4x3` (960×720), `story` (1080×1920), `poster-a3` (1123×1587). The library is cut for 960×540 and stretches on the rest.

Experimental means: sizing, editing and PDF work, but **text does not flow across pages**, so split a document into fixed pages yourself; on non-16:9 canvases define the deck's own layouts or draw free rows.

### 3. Style — a style guide, an inferred brand, or the neutral fallback
`style.json` = `{tokens, roles, pad}` (STYLE CONTRACT below). Obtain it in this order:
1. **Style guide / brand file given** → map its palette to `tokens`, its type scale to the eight `roles`. Fonts must be installed on the viewer's machine or be system stacks — the deck loads no webfonts. Put the brand font first, a system fallback after.
2. **URL or screenshots given** → infer: background, ink, muted ink, one accent, a card surface, a hairline. Headline family (serif/sans/mono), body family. Build `tokens` + `roles` from that. Say in the hand-off what you inferred.
3. **Nothing given** → omit `--style`; the template's neutral dark scale is used.

Eleven kits ship ready to copy in `examples/styles/<name>/style.json`, listed in `examples/styles/index.mjs`. Each is a complete STYLE CONTRACT (eight tokens, eight roles with measured `cw`, system font stacks only). Copy one, change the tokens, keep the roles.

Sizes in `roles` are **model pixels** for the chosen canvas: 960-wide ×1, 1600-wide ×1.67, 1080 carousel ×1.9 (viewed small), 816 document ×0.75.

---

## PROCESS

### Step 1 — slide plan (write it down before any JSON)
For each slide: `name · layout or template · supertitle · title · visual · body elements (kind + count)`. **The visual is one non-text thing per slide** (a logo group, an image, a chart, a figure, a proportional mark), and the plan names the graphic per slide before any copy. An icon is decoration, not the visual; so are a chip, one bar, a lone logo and a Stat row. `validate` warns on any slide of three or more text rows whose graphic covers under ~8% of the content box, templates and layouts included; a slide that is words on purpose sets `textOnly: true` (covers, sections, statements, quotes, agendas and closers are words by kind). Route an executive summary and market numbers to their graphic templates (TEMPLATE LIBRARY), never to a row of stat tiles.
**List every company the deck names** in `deck.entities`, and give every listed company its real logo. Fetch the files with `decklet-assets` before Step 2; when it prints `missed:`, rerun with `--domain` or supply the file, and never ship a monogram for a known company. Cap: ~60 words of `Body` per 16:9 slide, 3–4 tiles per row, 5 bars per chart, 4 boxes per flow. A content-slide title is one line at `H1`; a cover or closing headline uses `Title`, two lines at most.

### Step 2 — model rows
Discipline, in order of importance:
- **Role discipline.** Every text row has a `role` (or a `slot` whose layout slot has one). A row never sets `font`, `size`, `lh`, `ls` or `mono` — the validator rejects it. Rows may set `weight`, `color`, `tt`, `italic`, `align`.
- **Slot discipline.** Supertitle and title geometry lives in `layouts.<name>`; the slide row is `{slot:'title', text:'…'}` with no x/y/w. Define one layout per slide family (`title`, `content`; add `section`, `two-col` as needed).
- **Master discipline.** Anything that appears on every slide (footer, rule, mark) is a `master` row, once (§ MASTER layer). Exactly one master row has `footer:1` and carries the page counter (§ MASTER layer): `{id:'foot', footer:1, right: 60, y: 506, w:'auto', role:'Label', nowrap:1}`. Never type `3 / 9` into a row.
- **Text-fit.** A label that must stay on one line gets `nowrap:1` and enough `w` (≈ `cw` × size × chars — the role's measured glyph width, 0.46 for the neutral sans, 0.69 for the mono Label), or `w:'auto'` to hug. Chips/pills: `w:'auto'` + `p:'chip'` (+ `bg`/`bd`/`radius`); one that sits on a right edge takes `right:` instead of `x`. Body copy gets a `w` that yields ≤ 3 lines at the role's size.
- **Charts are rows.** A bar or line chart is one `chart` row that `create` expands into bars, lines, dots and `Label` rows with the drawing rules applied — write the data, not the geometry. A ranking is `mark:'hbar'`; a datum may carry a `logo`.
- **Images are assets.** `node bin/assets.mjs logo "Xometry" --out assets/` (also `shot <url>`, `monogram <name>`) writes the file and its `{aspect, plate}` into `assets/manifest.json`. Put each file once in `deck.assets` and name it `'#id'` wherever it appears. A logo with its name is one `logo` row ([docs/logo.md](docs/logo.md)); a list template takes one per item (`m1…mn`).
- **Follow, don't guess.** A row after an auto-width row takes `after:'<rowId>'`: x is that row's rendered right edge plus `gap` (10).
- **Cards are painted, not nested.** A card is a painted rect — `{x,y,w,h,bg,bd,radius}` — with text rows drawn over it at their own canvas x/y, each moving alone. Put the paint row first (row order is z-order).
- **Colour.** Use `var(--accent)`, `var(--fg)`, `var(--muted)`, `var(--line)`, `var(--card)` so a style swap re-themes the deck; literal hex only for chart series.

### Step 3 — validate (no browser)
```
node bin/validate.mjs model.json --style style.json [--strict]   # 0 errors required; read every warning — --strict fails on them
```
**Always pass the same `--style` you will pass to `create`.** Text fit is only meaningful against the scale the deck will actually wear: without it the model is measured against the template's neutral roles, so `validate` can report 0 warnings on a model `create --style` then floods with overflow — and `verify` fails on. Omit `--style` only when there is none.

**`--strict` is the pre-hand-off gate.** A `nowrap` width warning is the fit `verify`'s parity check measures in the browser, so fix it in the model (shorten, widen, or `w:'auto'`) before you create. Fix every warning `--strict` fails on, or write the reason into the hand-off note. Width is estimated from an average glyph (`MMMWWWMM` renders twice its estimate), so a silent `validate` is not a pass: Step 5 is mandatory.

### Step 4 — create
```
node bin/create.mjs --model model.json [--style style.json] --out deck.html --format slides [--space 1600x900] [--title "…"] [--from prev.html]
```
Refuses an invalid model (`--force` to override while iterating). Stamps `deck.id`, `deck.rev`, and a deterministic `slide.id`/row `id` (`s1… / r1…`) wherever one is missing, so the same model builds byte-identically.

**Revising a deck a human has touched — `--from` is mandatory.** The deck file carries the human's edits (`/*LOG*/`). Run, in this order:
```
node bin/edits.mjs deck.html                       # 1. READ what the human changed
node bin/create.mjs --model model.json --out deck.html --from deck.html   # 2. write the new version
node bin/verify.mjs deck.html                      # 3. verify the result
```
`--from` inherits the deck id and the slide/row ids and replays every logged edit onto the new build. Full flow: [docs/editor.md](docs/editor.md#revising-an-edited-deck).

**The deck names itself.** `--title` wins, else the model's `title`, else `decklet`. Write one short, human name: it becomes the browser tab and the `⤓`/`⌘S` filenames.

### Step 5 — verify (mandatory)
```
node bin/verify.mjs deck.html [--refs shots/] [--out verify-out/] [--threshold 0.5] [--strict]
```
- **Contract** — always.
- **Air** — always, in `validate`, with no browser: the `gap` gate below. It refuses the layout before it exists; parity measures what actually rendered.
- **Layout parity** — always (needs Playwright): no text row overflows its box, every `nowrap` row renders one line, imported rows render their source line count, every element is inside the canvas, **no painted row is drawn through a text row**, zero page errors.
  Five collision shapes fail it: **ink through text**; **text straddling a container**; **an arrow head inside a fill** (aim at the edge with `to:`); **text over text**; **text under paint** (occlusion — reorder `els`, paint first). Containment is not collision, and `over:1` opts a row out of all five. Ink is a rule (one side ≤ 4px or 6:1) or a dot (≤ 12px): a logo plate beside its name is neither, so it never needs `over:1`.
- **AE pixel diff** — when `--refs` exists (needs ImageMagick): `< 0.5%` of pixels differ at 2% fuzz. AE alone passes wrapped labels; parity is what catches them — that is why parity is not optional.

Fix the model; re-run to `VERIFY PASS`, attach `verify-out/results.json`.

**When the engine is wrong** (verify fails on a layout the model declares cleanly, a control misbehaves, a PDF does not match the slide): `node bin/bug.mjs deck.html --category looks --desc "what happened" --tool verify --log verify.log` prints a prefilled mail to decklet@grunion.ai, never the deck's words ([docs/editor.md](docs/editor.md#reporting-a-bug)). Say so in the hand-off rather than working around the engine.

### Step 6 — hand-off notes for the human editor
Hand off the HTML file only: make a PDF only when the human asks for one (the deck writes its own with ⤓). Say, in this order:
1. Where the file is and that it opens from disk in any browser, no install, no network.
2. **The editor:** [docs/editor.md](docs/editor.md). Quote the lines that matter (⌘S writes the file in Chrome/Edge, a copy in Safari; ⤓ writes the PDF; Esc opens the contact sheet; `node bin/export.mjs deck.html --png` for PNGs) and link the rest.
3. To revise, run Step 4's `--from` commands; every edit a human makes round-trips that way.
4. What you inferred (style, layout choices) and anything marked experimental.

### Hosting the deck for editing
Default: do not host. Chrome and Edge on `file://` write the file after one ⌘S ("Allow on every visit"). Host with `node bin/serve.mjs deck.html` when the person edits in Safari, Firefox or an embedded browser pane, when you will rebuild while it is open, or when edits must survive refresh and close. Give them the printed URL. To rebuild while their page is open, run `node bin/serve.mjs deck.html --checkout --by <your name>` first (their page goes read-only; exit 1 means edits are still saving, so retry), then Step 4's `--from`, then `--checkin`: the page takes your version with their edits on top. Stop the server when the session ends. Browser pane and details: [docs/editor.md](docs/editor.md#hosting).

---

## MODEL CONTRACT

Top level:
| prop | type | default | example |
|---|---|---|---|
| `w`, `h` | number | from `format`, in `validate` as in `create` | `960`, `540` — name `format` or both; a model naming neither is an error |
| `format` | enum | `slides` | `"carousel"` |
| `page` | `letter`\|`a4` | from format | set by create |
| `title` | string | `decklet` | `"Q3 update"` — tab title + `⤓`/`⌘S` filename; `--title` overwrites it |
| `spell` | `{ignore: ["decklet", …]}` | none | words the build's spellcheck must not flag (a name); case-blind; the editor's Ignore appends here |
| `counter` | `0` | on | `0` draws no page counter anywhere — canvas, print, PDF. For a letter or a one-page document, where `1 / 1` is noise |
| `lang` | BCP 47 tag | `en` | `"de"` — the dictionary the browser's spellcheck uses on the canvas; optional |
| `id` | string | content hash, by create | the deck's identity: the browser's storage namespace, kept across versions by `--from` |
| `rev` | string | content hash, by create | this build; the browser trusts a stored working copy only when its `rev` matches the file's |
| `styles.roles` | `{Role: treatment}` | template neutral | see STYLE CONTRACT |
| `styles.margin` | number | `round(w × 0.06)` | content inset chrome sits on: the footer counter's right edge = `w − margin` |
| `styles.pad` | `{token: css}` | `{chip:'3px 8px', pill:'5px 12px'}` | `p:'chip'` on a row |
| `styles.gap` | number | `4` | the air every row owes its neighbours, in px; `validate` fails two declared boxes closer than this (see VERIFY → Air) |
| `slots` | `{slot: geometry}` | `{}` | deck-scope slots under every layout (`{supertitle:{x:60,y:52,w:840,role:'Supertitle'}}`) |
| `layouts` | `{name: {slot: geometry}}` | `{}` | `{content:{title:{x:60,y:76,w:840,role:'H1'}}}` |
| `master` | row[] with `id` | `[]` | `[{id:'foot',footer:1,…}]` |
| `slides` | slide[] (≥1) | — | |
| `assets` | `{id: data URI}` | none | each image embedded once; any `img` or `logo` value (rows, masters, slots, template media, chart data) names one as `'#id'`. `validate` errors on an unknown id, warns on an unused one |
| `entities` | (string \| string[])[] | none | the companies the deck names; an entry may be an alias list (`['nTop','nTopology']`). A company named in a heading, sentence or label needs its own logo on that slide (a short label within 120px); `validate` warns per slide on the ones without and on `monogram for <name>` |

Slot geometry: `{x, y, w, h?, role}` — or `right` in place of `x`; a slotted row's own `right` overrides the slot's `x` the way its own `x` would.

Slide: `{id?, name?, layout?, bg?, hide?: masterId[], notes?: string, textOnly?: true, kind?: 'summary', els: row[]}`. `textOnly: true` declares a words slide to the coverage gate; `kind: 'summary'` caps it at 60 words at reading density (a Numbers template gets the same cap). `notes` is the speaker's text, kept in the file and the edit log (no panel renders it yet). `id` (unique per deck; `s1, s2…` when create stamps it) addresses the slide for the tab and the edit log. Rows carry `id` (unique per slide; `r1, r2…`) for the same reason and for `to:`/`from:`/`after:`.

Row — every prop optional; a row is whatever its props make it:
| prop | type | default | meaning |
|---|---|---|---|
| `x`,`y` | number | `0` | top-left, model px |
| `right` | number | — | the row's right edge N px from the canvas right edge; x is derived at render from the measured width, so a `w:'auto'` chip needs no guessed x. Exclusive with `x`. An editor drag writes `right`, so the anchor survives edits |
| `w` | number \| `'auto'` | `0` | width; `'auto'` hugs content |
| `h` | number | content | height; required for bar/tile/box-with-height |
| `slot` | string | — | inherit geometry + role from the layout/deck slot; own x/y/w/h are overrides |
| `role` | string | slot's role | text treatment from `styles.roles` — **required for text** |
| `text` | string | — | plain text; `\n` = line break |
| `html` | string | — | inline runs: `<b> <i> <u> <s> <span style="color:…"> <a href="…">` only; no size/family/leading |
| `weight` | number | role | font-weight override |
| `color` | css | role | text colour (`var(--accent)` etc.) |
| `tt` | css | role | `uppercase` / `none` |
| `italic` | 1 | — | |
| `align` | css | `left` | `center`, `right` |
| `valign` | `middle` \| `bottom` | top | vertical seat of the text inside a row that carries `h` — a label over a painted button, a floor caption; `box`/`tile` rows centre already |
| `nowrap` | 1 | — | single line, never wraps (parity checks it) |
| `bullet` | 1 | — | the engine draws a half-em dot hanging 1.25em left of the row's box, seated from the role; the box is unchanged. Usually inherited from a `b1…bn` slot (`bullets`, `image-left`, `image-right`) |
| `ws` | css | — | `pre-wrap` etc. (`\n` in text already pre-wraps) |
| `p` | token \| css | — | padding: `'chip'`, `'pill'`, `'4px 10px'`, or a number |
| `bg` | css | — | background (box/bar/rect) |
| `bd`,`bt`,`br`,`bb`,`bl` | css | — | border / per-side border |
| `radius` | number \| css | — | corner radius |
| `shadow` | css | — | box-shadow |
| `op` | 0–1 | — | opacity |
| `box` | 1 | — | outlined card chrome (padding 6/8, radius 8, centred, pre-wrap) |
| `tile` | 1 | — | filled card chrome (card bg, hairline, centred, flex-centred vertically) |
| `bar` | 1 | — | bar: rounded top; needs `h` + `bg` |
| `line` | `[x2,y2]` | — | straight line from (x,y) to (x2,y2); `h` = thickness (3), `bg` = colour |
| `curve` | `[c1x,c1y,c2x,c2y,x2,y2]` | — | cubic bezier connector from (x,y); absolute coords like `line`; `h` = thickness, `bg` = colour |
| `arrow` | `start`\|`end`\|`both` | — | arrow head on a `line` or a `curve` — never hand-build one out of three lines. **The head IS the terminus:** its tip lands on the stated end point and the stroke is shortened to make room, so a connector draws exactly as long as it was authored |
| `to`, `from` | row id \| row index | — | terminate a connector **against another row**: the engine clips where the stroke crosses that row's box and backs off `gap`. Aim at the target, never a hand-computed standoff. Prefer an id; indices shift |
| `gap` | number | `10` | the air `to:`/`from:` leaves between the tip and the target's border, or `after:` leaves after the named row. `0` is flush (situational — K1) |
| `after` | row id | none | x = the named row's **rendered** right edge + `gap`; y = its top unless stated. A `line` is translated whole. Exclusive with `x` (box rows) and `right`. For a chip or arrow after auto-width text |
| `style` | `arrow`\|`dashed`\|`blocked` | none | a **connector row**: `{from, to, style, gap}` routes between the two rows' rendered boxes with `gap` of air at both ends (default `styles.gap`, else 6); `blocked` draws a midpoint marker. `validate` fails an arrow end that touches a painted box; `butt: 1` marks a stroke meant to butt a frame |
| `head` | `triangle`\|`chevron`\|`dot`\|`bar` | `triangle` | what is drawn at the arrow ends. `arrow` says *which* ends, `head` says *what* — centred on the stroke axis by construction |
| `dash` | `1` \| `[on,off]` | — | dashed stroke, **quantised to the run** so it always begins and ends on a whole dash (measured along arc length on a curve). Keeps its head |
| `waive` | 1 | — | this connector breaks a shape rule on purpose — `validate` stays quiet about it (the `over:1` of connector geometry) |
| `over` | 1 | — | declares a deliberate overlay: `validate`'s gap gate and `verify`'s collision check leave this row (and what it crosses) alone |
| `href` | url \| `#slide` | — | http/https/mailto, or **into the deck**: `'#7'` (1-based) or `'#<slide id>'`; `validate` fails a `#` that names no slide. Put it on a painted button **and** its label ([docs/editor.md](docs/editor.md)) |
| `donut` | 0–100 | — | ring, `w` = diameter, `color` = fill |
| `hole` | 0–99 | 55 | the ring's hollow in percent; `0` is a filled ball |
| `svg` | string | — | inline SVG markup (no script, no external href) |
| `icon` | name | — | any Lucide icon name (see GRAPHICS; `--icons` lists them) — expands to an `svg` row at create, `color` paints it |
| `img` | data: URI \| `'#id'` | — | image; `fit` (default `contain`, never stretched; `cover`/`fill` opt in), `pos` = object-position |
| `logo` | data: URI \| `'#id'` \| `''` | none | a **logo row**: `{logo, name, x, y, h, col, gap, plate, aspect, monogram}`. The logo is contain-fit in a `col`-wide column (default `2×h`), `name` starts at `x + col + gap` whatever the logo's shape, `plate` (`light`/`dark`/`none`, from the manifest) paints its chip, `''` draws a monogram. Same `col` down a list and the names align ([docs/logo.md](docs/logo.md)) |
| `alt` | string | — | what the row shows, for a reader who cannot see it — an `img`, an `svg`, a chart's rows. Model-only today |
| `anim` | `rise`\|`fade`\|`pop`\|`wipe` | — | entrance motion on slide entry, staggered 120 ms in model order (see MOTION) |
| `chart` | `{mark, data, …}` | — | a `bar`, `hbar` (ranked, `sort`, one `highlight`, `lead` px) or `line` chart drawn into this row's x/y/w/h at create time; a bar or hbar datum may carry `logo`/`aspect`/`plate` ([docs/charts.md](docs/charts.md)) |
| `css` | string | — | raw CSS escape hatch — validator warns |
| `override` | masterId | — | partial row: only the props it carries replace the master's on this slide |
| `footer` | 1 | — | master only: the page counter renders with this row (§ MASTER layer) |
| `id` | string | — | master only, unique |

Resolution order for any row: slot geometry ← master row (for `override` rows) ← the row's own props ← role treatment. The role fills whatever the row left unset **and always wins** `font`/`size`/`lh`/`ls` — a row can never change family, size, leading or tracking.

## STYLE CONTRACT (`style.json`)
```json
{
  "tokens": { "bg": "#111315", "fg": "#F3F4F6", "muted": "#9CA3AF", "accent": "#5B9CF6", "card": "#1A1D21", "line": "#2C3138", "sel": "#5B9CF6", "box": "#20262E" },
  "roles": {
    "Title": { "font": "…", "size": 64, "weight": 800, "lh": 68, "ls": -1.5, "color": "var(--fg)" },
    "Supertitle": { "font": "ui-monospace,Menlo,monospace", "size": 12, "weight": 500, "lh": 16, "ls": 1.5, "color": "var(--accent)", "tt": "uppercase" },
    "H1":   { "font": "…", "size": 34, "weight": 800, "lh": 40, "ls": -0.5, "color": "var(--fg)" },
    "H2":   { "font": "…", "size": 22, "weight": 600, "lh": 28, "ls": -0.3, "color": "var(--fg)" },
    "Body": { "font": "…", "size": 16, "weight": 400, "lh": 24, "ls": 0, "color": "var(--fg)" },
    "Caption": { "font": "…", "size": 13, "weight": 400, "lh": 18, "ls": 0, "color": "var(--muted)" },
    "Label": { "font": "ui-monospace,Menlo,monospace", "size": 11, "weight": 500, "lh": 14, "ls": 1, "color": "var(--muted)", "tt": "uppercase" },
    "Stat":  { "font": "…", "size": 40, "weight": 800, "lh": 44, "ls": -1, "color": "var(--accent)" }
  },
  "pad": { "chip": "3px 8px", "pill": "5px 12px" },
  "margin": 60,
  "gap": 4
}
```
- `tokens` → CSS custom properties on `:root`. `bg` is the editor chrome behind the slide; `card` is the slide surface; `box` the outlined-box fill; `sel` the selection colour.
- The eight roles are the whole type system — exactly these names: `Title` (display headline for cover/closing slides), `Supertitle` (kicker), `H1` (content-slide title), `H2`, `Body`, `Caption`, `Label` (mono, uppercase — chips, axis labels, footer), `Stat`. No H3, no Subtitle. One allowance: **`Stat2`**, an optional ninth role for the KPI tile; a style that omits it gets `Stat` at **0.6**, derived only when a row asks for it. A role is a complete treatment: `font`, `size`, `weight`, `lh`, `ls`, `color`, optional `tt`. One font and one size per role — never two sizes of "Body". A row may add `weight`, `color`, `tt`, `italic`; it can never carry `font`, `size`, `lh`, `ls` or `mono` (the validator rejects it, the engine ignores it).
- `margin` is the content inset the chrome sits on (footer counter's right edge, default 6% of `w`). Set it to match your layouts' left edge.
- `gap` is the air every row owes its neighbours (default 4px, the offset the chart library itself uses between a bar and its value). Raise it for a roomier deck; `validate` enforces it on declared boxes.
- `cw` on a role is the measured average glyph width in em. `validate` sizes `w:'auto'` rows and line counts with it; without it a blanket 0.55 runs ~20% off. Measure it with `node bin/measure-cw.mjs <style.json> --write`.
- The model's own `styles.roles` win over `style.json` per role; a model with no roles inherits the template's neutral scale.

## LAYOUTS (slots)
- `layouts.<name>.<slot> = {x, y, w, h?, role}`; a slide opts in with `layout:'<name>'`.
- `slots.<slot>` (deck scope) applies under every layout — use it for a supertitle shared by all.
- A slotted row may carry local x/y/w/h overrides; edit the slot in the model to move every slide at once.
- Conventional slot names: `supertitle`, `title`, `body`, `body2`. Conventional layouts: `title` (cover), `content`, `section`.
- A slot may carry any row treatment besides geometry and role — `tile:1`, `bg`, `p:'chip'`, `align`, `nowrap`, `italic`, even `line` — and the engine spreads it onto the bound row. A roleless slot with `h` is paint or media: `{slot:'rule'}` alone draws it.

## LAYOUT LIBRARY

Thirty-two named layouts ship with the engine (`lib/layouts.mjs`), in the same shape as a `layouts` entry. Name one on a slide the deck does not define and `create` merges it into `deck.layouts`, scaled from its 960×540 cut to the canvas (1600×900 = ×1.67). `node bin/validate.mjs --layouts` prints it: name, group, density, use and every slot's box (`x y w h`).
Read that instead of inventing geometry: each layout prints a `free:` band where a free row goes. A slide may mix library slots with free rows, a deck-defined layout of the same name wins, and a slotted row still takes its own x/y/w/h.

- **openers** — `cover` · `agenda` · `section`
- **chrome** — `content` · `title`
- **text** — `statement` · `fact` · `quote` · `two-cols` · `two-cols-header` · `bullets`
- **visuals** — `image-left` · `image-right`
- **modern** — `bento-grid` · `image-hero-overlay` · `image-split` · `annotated-shot` · `three-up-cards` · `dashboard-composite` · `table-insight` · `proof-strip` · `team-grid`
- **numbers** — `kpi-grid` · `kpi-grid-4` · `stat` · `chart` · `comparison`
- **diagrams** — `process-steps` · `diagram`
- **plans** — `timeline`
- **closers** — `cta` · `end`

The corner is the counter's: `COUNTER` (`lib/layouts.mjs`, `{right: 60, y: 466, w: 96, h: 74}` on 960×540) is kept clear by every library slot, and a deck's own rows owe it the same air. Delta chips are `Label` on a `chip` pad, coloured `var(--ok, var(--accent))`, or `var(--bad, var(--accent))` when falling.

Picking a layout by what the content is:

| the slide's content is… | layout |
|---|---|
| four to six points under a title | `bullets` |
| the deck's name and promise | `cover`; `end` closes |
| what the deck will cover | `agenda`; `section` between parts |
| one claim | `statement`; with a number in it → `fact`; the number alone → `stat` |
| someone's words | `quote` |
| two bodies of text, a lede over two columns | `two-cols`, `two-cols-header` |
| a picture and a paragraph, or a picture and three or four points | `image-left` / `image-right` |
| three or four numbers with movement | `kpi-grid` / `kpi-grid-4` |
| a series with real numbers | `chart` — no numbers, no chart layout |
| A against B | `comparison` |
| steps in order | `process-steps`; dated → `timeline` |
| the ask | `cta` |

## TEMPLATE LIBRARY
115 finished slides ship with the engine (`lib/templates.mjs`, sources in `lib/templates/cat-*.mjs`). A template is a layout PLUS sample rows — an issue tree, a Sankey, a scorecard, a bento grid — so the agent binds content instead of drawing. `node bin/validate.mjs --templates` prints it: id · tier · density · note and every text key with its sample.
A slide names one and fills its keys: `{template: 'three-up-cards', fill: {t1: 'What you get', t2: 'Three things, one price.', t3: '01', …}}`. Every text row of the template is a key, `t1`…`tn` in row order; a key left out keeps the sample text (so fill them all before shipping). Two kinds of key: a text row takes a string, and **value keys** take a number in the range `--templates` prints beside them — `harvey-balls` `r1c1`…`r3c4` (0–4 quarters), `progress-tracker` `p1`…`p4`, the gauge and donuts' `v1`… (0–100). `chart-column`, `chart-grouped` and `chart-line-trend` take `data` — the chart row's own `[{label, value, compare?}]`. Out of range is an error; `fixed:` counts the rows no key reaches. Every template's graphic now comes from a value key, never the sample — templates are the first choice again. `create` expands the slide into the template's rows scaled to the canvas, sets its `layout` (`content` or `title`) and `density`, and keeps any free `els` after them. An unknown template or key is an error listing what exists. A **scorecard cell** (`scorecard-grid`, role `Cell`) takes a short string OR a `0`–`4` rating. **Media keys:** twenty list templates take `m1…mn`, one per item, each `{logo, plate, aspect, monogram, col, h}`, `{img, fit, w, h}` or `{icon, color, h}` (`logo`/`img` may be `'#id'`); the media sits beside the item's lead text, and a logo turns the lead into a logo row. The layouts `agenda`, `process-steps`, `timeline`, `three-up-cards` and `proof-strip` take `<item>-media` slots. `--templates` prints the media keys. A template is an accelerant like a layout: edit the rows it produced, add rows beside them, or draw free — nothing here is a fence.
Route by content before you reach for a tile: an executive summary is `exec-summary` (three columns, a before/after bar pair each, `kind: 'summary'`, so reading density caps it at 60 words); market numbers are `area-bubbles` (area equals value, a dashed ring for a high estimate), `waffle` (`pct` of a 10×10 grid) or `range-bar` (low–high ranges on one axis); a two-axis position is `two-by-two` with `x1 y1 … x3 y3`; a ranking is `chart-bar-ranked` (`v1..v5` on one scale); `benchmark-table` tints and bolds the row `highlight` names. Every template draws a graphic or carries `textOnly`, and a slide made from it inherits the mark.
The starting rungs: `bullet-page` (a title and five points on `bullets`, a dot each), `image-bullets` (a photo and three points on `image-left`), `process-flow-3` · `-4` · `-5` (one block-arrow shape whose box width falls out of the count — 251, 180, 138), and `stat-row-3` (three numbers at **speaker** density, where the other numbers templates are reading).
Tiers: **core** (in 4+ surveyed catalogs), **standard** (consulting catalogs), **fringe** (dataviz literature, rare on slides). Categories: Narrative · Numbers · Comparison · Frameworks · Process · Charts · Modern · Figures.

**Figures** are the figure kinds as templates — `figure-decision`, `figure-flow`, `figure-before-after`, `figure-data-model`, `figure-states`, `figure-release`, `figure-boundaries`, `figure-boundaries-6`, `figure-tree`, `figure-layers` — each the rows `diagramSlide()` makes from a spec on the `diagram` layout, reading density, with a caption stating the claim.

The speaker-density templates are the covers, dividers, quotes, statements, hero numbers, the donut and gauge, the cycle and the tree; everything with a table, a grid or a series is **reading**. `--templates` prints each one's density.

## DENSITY
A template carries its own density and **overrides the deck's** on the slide that names it (`create` copies it across unless the slide states one); set the slide's `density` to take the deck's back.
Two densities, in `lib/layouts.mjs` (`DENSITY`), so "dense" and "fluffy" build the same deck every time. A deck says `density`; a slide may override. `validate` warns on every slide that misses it; an unknown density is an error.
| density | aka | for | the slide carries | max |
|---|---|---|---|---|
| `speaker` | **fluffy** | a presented deck — the speaker carries the rest | supertitle · title · one figure, number or ≤ 3 points · a caption at most | 3 points · 40 words |
| `reading` | **dense** | a leave-behind read without a speaker — the slide carries its own context | supertitle · title · `subtitle` (the claim in one sentence) · the figure or the points · `note` (what to make of it) · `source` · `legend` · footer naming the deck | 8 points · 140 words |
The dense chrome is four optional slots (`DENSE`): `subtitle` (H2 at regular weight, muted, `nowrap`: parity fails a wrap), `note`, `source` and `legend`. **The slide foot is one line:** the engine seats `source` on the footer's baseline at the left margin and `legend` on the same line left of the deck name (`foot: 'left'|'right'`; a row with its own `y` opts out), and `validate` warns on any other text row between the content bottom (`FOOT.y`, 472 on 960×540) and the footer. `note` has no generic seat: a layout with a visual names a caption position under or beside it, the rest drop it, and binding a dropped `note` is an error. At reading density a summary or number slide is capped at 60 words. A reading slide binds at least one; a speaker slide none. **The counting rule:** a *point* is a text row whose slot is not `supertitle/title/subtitle/note/source/legend/caption/number` and role not Supertitle/Title/H1/Caption/Label; the word cap counts every text row, chrome included; over budget `validate` lists what it counted.
## GRAPHICS
Five kinds of picture, one rule each. Colour is always a token; nothing loads from the network.
- **Icons** — `{icon: 'factory', x, y, w: 24, h: 24, color: 'var(--accent)'}`. The set is all of Lucide (ISC), 2,147 names (`node bin/validate.mjs --icons`); `create` inlines the svg and `color` paints it. One icon per point, on the 24 grid (24/32/40 px), centred on its label's first line with an 8px gutter. An icon says what the label says, never a second idea or a filled emoji, and it is decoration: it never counts as the slide's graphic.
- **Glyphs** — a number in a circle, a letter chip, a status dot: rows, not images. A step glyph is a `dot` (or a `radius:'50%'` box) with a `Label` centred in it (`valign:'middle'`); a status dot is a 10px `bg` circle in `var(--ok)`/`var(--bad)`. Group the glyph with its text.
- **Logos** — one `logo` row per company: file and `plate` from `decklet-assets`, the file in `deck.assets`, the row naming `'#id'`. A landscape slide carries five to sixteen; give each list one `col` and one `h`. In a template it is a media key, in a chart a datum's `logo`.
- **Images and GIFs** — `img` is a data: URI or `'#id'` (an animated GIF plays as-is), explicit `w`/`h`, `contain` by default (`fit:'cover'` to crop), never behind text unless a tint band (`bg` with `op`) sits between. A photograph wants one per slide; screenshots and logos run several. The budget scales with the deck: ~100 KB an image and ~1 MB a file for a talk, several MB for a landscape or competitive deck, where the asset table keeps a repeated logo to one copy. `decklet-assets shot <url> --crop x,y,w,h` writes a webp. Photographs carry `image-left`/`image-right`/`image-hero-overlay`/`image-split`; a screenshot gets `annotated-shot` with callout rows.
- **Figures** — nodes, connectors, timelines, trees as rows, so every box and edge stays editable. Build one with `diagramSlide(spec, {supertitle, title, caption})` from `@grunion/decklet/diagram`, or `diagramRows(spec, frame)` for a free frame, which routes the connectors: [docs/figures.md](docs/figures.md). An `svg` row is for a fill the engine has no primitive for (a Sankey ribbon), never for text or a whole figure.
- **Clips** — a short cropped GIF of a real interaction (`docs/record-clips.mjs`), ≤ 3 s, ≤ 48 colours, ~10 fps; the same inline rule. A clip of the thing working beats a screenshot of it.

**Charts** are one `chart` row that `create` expands into bars, lines, dots and labels (bars from zero, one explicit max, direct value labels, no legend); `mark:'hbar'` ranks with a logo per datum: [docs/charts.md](docs/charts.md). **Connectors** between two rows are one connector row, `{from, to, style: 'arrow'|'dashed'|'blocked', gap}`: the engine routes it on the rendered boxes and leaves `gap` of air at both ends, so never hand-place a line that touches its boxes. `diagramRows()` routes a figure's connectors to the same rules (orthogonal runs, 96px S-curve channels, 2.5px or heavier); for any other stroke read [docs/connectors.md](docs/connectors.md) first.

## MASTER layer
- Drawn under every slide, in array order, identically — chrome is deck-wide and never varies per layout. Rows need a unique `id`.
- A slide hides one with `hide:['id']`; overrides one with a **partial** row carrying `override:'id'` plus only the props that change — everything else keeps reading from the master (the editor creates these when a human edits chrome on one slide; "Apply to all slides" merges them back).
- Exactly one `footer:1` row, anchored to the content edge: **right-anchored** when it declares `right` (snapped to `w − styles.margin`) or its centre sits past W/2, **left-anchored** otherwise. `w:'auto'` suits both. **The corner is the counter's:** a right-anchored row carries `· n / N` inline; a left-anchored row keeps its text at the left and the counter sits alone in the corner on the same top. Either way the counter's right edge is `w − margin` on every slide, and `verify` fails parity when it moves (a slide that hides the footer gets the pin). With no footer row the counter renders as a pin at the same margin.

## MOTION (`anim`)
Four words, and no fifth: `rise` (text — the default), `fade` (quiet chrome), `pop` (stats, tiles, images), `wipe` (bars, lines, rules). Anything else is an error in `validate`. **Entry only:** animated rows enter in model order, staggered 120 ms, and only when a slide is *entered* — print, the contact sheet, the ⤓ PDF and `verify` all draw the settled frame, and `prefers-reduced-motion: reduce` turns every anim off, so a deck reads exactly the same standing still. When to animate: [docs/editor.md](docs/editor.md#motion).


## VERIFICATION thresholds
[docs/verify.md](docs/verify.md#thresholds) lists every check with its pass criterion. The two that stop a hand-off are `validate --strict` at 0 errors and 0 warnings, and `verify` printing `VERIFY PASS`.

## ANTI-PATTERNS (each is a review failure)
- **Implicit padding / chrome on plain text.** A text row is text. Padding, radius, pre-wrap belong to `box`/`tile` or explicit `p`. Never fake a card with a padded text row.
- **Per-slide chrome drift.** A footer or mark redrawn on each slide with slightly different x/y. It is one master row; slides fork only when a human edits.
- **Size overrides.** `size:18` on a Body row "because it needs to be bigger". Change the role, or use the right role (`Title` for a display headline, `H1` for a slide title). Same for `font`, `lh`, `ls`, `mono`.
- **Wrapping labels.** Chips, axis labels, step numbers, supertitles that wrap to two lines. `nowrap:1` + width, or `w:'auto'`. Parity fails these on purpose.
- **Touching boxes.** A chip 2px from the next chip, a caption resting on the rule under it, a value label on its bar's top edge. `validate` names the pair and the distance; give it `styles.gap` of air, or state the relationship (containment, `over:1`).
- **Guessed x for an auto-width row.** A chip on a card's right edge is `right:`, never a guessed `x`: a `w:'auto'` row has no width until it renders.
- **Hand-built arrows.** Three `line` rows for one head, a centre coordinate for a target, a flush end on a box. A connector row, or `arrow:'end'` with `to:`.
- **A dead CTA.** A painted button with no `href`: no click in the deck, no annotation in the PDF. Put the `href` on the box **and** on its label row.
- **Hand-built logos and rankings.** Three rows per logo with the name's x worked out from its aspect; rects computed into a bar ranking; the same data: URI pasted on nine slides. A `logo` row, `mark:'hbar'`, `deck.assets`.
- **Text-only slides.** Three text rows and no graphic, or an icon standing in for one. `validate` warns; plan the graphic in Step 1, or mark a words slide `textOnly: true`.
- **Monograms for real companies.** A listed company drawn as initials. Rerun `decklet-assets` with `--domain` or supply the file.
- **A PDF nobody asked for.** See Step 6.
- **Hardcoded counters.** `"3 / 9"` typed into a row. The footer master renders the counter.
- **Font pickers / ad-hoc colours.** No per-row font families, no rainbow of hexes. Tokens and roles only; literal hex is for chart series.
- **Walls of text.** More than ~60 Body words on a 16:9 slide, or Body wrapping past 3 lines. Split the slide.
- **Network anything.** No webfonts, CDNs, remote images. Images and clips are data: URIs; fonts are installed or system stacks.
- **Motion everywhere.** Every row carrying `anim`, or an anim invented outside the four. Motion marks the reading order of a few rows; the rest are already there.
- **Unverified hand-off.** A deck without a `VERIFY PASS` is not done.

