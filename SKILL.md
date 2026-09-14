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

```
content + format + style  →  slide plan  →  model.json  →  validate  →  create  →  verify  →  hand-off
```

All commands run from the repo root with plain Node ≥ 22. Installed as a Claude Code plugin, the repo root is `${CLAUDE_PLUGIN_ROOT}`; installed with `npx skills add`, it is the skill's own directory. Only `verify` (and `import-html`) need the optional `playwright` devDependency.

---

## INPUTS

### 1. Content — anything
Outline, markdown, meeting notes, a transcript, a spreadsheet, a brief. You distil it; nothing is pasted verbatim. One idea per slide. Numbers become `Stat` rows, lists become 2–4 short `Body` rows or tiles, sequences become boxes with arrows, comparisons become two columns.

### 2. Format — one of
| format | canvas (model px) | print page | status |
|---|---|---|---|
| `slides` | 960×540 (or 1600×900 via `--space 1600x900`) | Letter, slide zoomed to page width | **supported** |

Eight more are **experimental**, same model: `carousel` (1080×1080), `carousel-4x5` (1080×1350), `document-letter` / `document-a4` and their `-landscape` pairs, `slides-4x3` (960×720), `story` (1080×1920), `poster-a3` (1123×1587). The library is cut for 960×540 and stretches on the rest.

Experimental means: canvas sizing, editing, contact sheet and PDF all work; **text does not flow across pages** — every page is a slide you lay out yourself, and a document longer than its page is your problem to split. Treat a document as N fixed pages. **Library stretches** means: every library layout and template is cut for 16:9, so on that canvas `validate` warns per slide that a library layout or a template will render stretched (ROADMAP D2) — define the deck's own layouts or draw free rows there.

### 3. Style — a style guide, an inferred brand, or the neutral fallback
`style.json` = `{tokens, roles, pad}` (STYLE CONTRACT below). Obtain it in this order:
1. **Style guide / brand file given** → map its palette to `tokens`, its type scale to the eight `roles`. Fonts must be installed on the viewer's machine or be system stacks — the deck loads no webfonts. Put the brand font first, a system fallback after.
2. **URL or screenshots given** → infer: background, ink, muted ink, one accent, a card surface, a hairline. Headline family (serif/sans/mono), body family. Build `tokens` + `roles` from that. Say in the hand-off what you inferred.
3. **Nothing given** → omit `--style`; the template's neutral dark scale is used.

Eleven kits ship ready to copy in `examples/styles/<name>/style.json`, listed in `examples/styles/index.mjs`. Each is a complete STYLE CONTRACT — eight tokens, eight roles with measured `cw`, system font stacks only — and its own scale: Title 54–74px, inset 48–72px. The explainer builds and verifies under every one (`test/styles.test.mjs`). Copy one, change the tokens, keep the roles.

Sizes in `roles` are **model pixels** for the chosen canvas: 960-wide ×1, 1600-wide ×1.67, 1080 carousel ×1.9 (viewed small), 816 document ×0.75.

---

## PROCESS

### Step 1 — slide plan (write it down before any JSON)
For each slide: `name · layout · supertitle · title · body elements (kind + count)`. Cap: ~60 words of `Body` per 16:9 slide, 3–4 tiles per row, 5 bars per chart, 4 boxes per flow. A content-slide title is one line at `H1`; a cover or closing headline uses `Title` (the display size), two lines at most.

### Step 2 — model rows
Discipline, in order of importance:
- **Role discipline.** Every text row has a `role` (or a `slot` whose layout slot has one). A row never sets `font`, `size`, `lh`, `ls` or `mono` — the validator rejects it. Rows may set `weight`, `color`, `tt`, `italic`, `align`.
- **Slot discipline.** Supertitle and title geometry lives in `layouts.<name>`; the slide row is `{slot:'title', text:'…'}` with no x/y/w. Define one layout per slide family (`title`, `content`; add `section`, `two-col` as needed).
- **Master discipline.** Anything that appears on every slide (footer, rule, mark) is a `master` row, once — chrome is deck-wide and never varies per layout. Exactly one master row has `footer:1` and the engine renders the page counter with it (§ MASTER layer): `{id:'foot', footer:1, right: 60, y: 506, w:'auto', role:'Label', nowrap:1}` puts the deck name and `· n / N` together at the right foot; `{… x: 60 …}` keeps the name at the left with the counter alone in the corner. Never type `3 / 9` into a row.
- **Text-fit.** A label that must stay on one line gets `nowrap:1` and enough `w` (≈ `cw` × size × chars — the role's measured glyph width, 0.46 for the neutral sans, 0.69 for the mono Label), or `w:'auto'` to hug. Chips/pills: `w:'auto'` + `p:'chip'` (+ `bg`/`bd`/`radius`); one that sits on a right edge takes `right:` instead of `x`. Body copy gets a `w` that yields ≤ 3 lines at the role's size.
- **Charts are rows.** A bar or line chart is one `chart` row that `create` expands into bars, lines, dots and `Label` rows with the drawing rules applied ([docs/charts.md](docs/charts.md)) — write the data, not the geometry.
- **Cards are groups.** There is no container row: a card is a tile plus its rows sharing one `group` — `{x,y,w,h,bg,bd,radius,group:'card1'}` and each text row inside it with `group:'card1'`, every row at its own canvas x/y. The human drags the card and the rows come along; you still position each row, once.
- **Colour.** Use `var(--accent)`, `var(--fg)`, `var(--muted)`, `var(--line)`, `var(--card)` so a style swap re-themes the deck; literal hex only for chart series.

### Step 3 — validate (no browser)
```
node bin/validate.mjs model.json --style style.json            # 0 errors required; read every warning
node bin/validate.mjs model.json --style style.json --strict   # warnings fail too — use before hand-off
```
**Always pass the same `--style` you will pass to `create`.** Text fit is only meaningful against the scale the deck will actually wear: without it the model is measured against the template's neutral roles, so `validate` can report 0 warnings on a model `create --style` then floods with overflow — and `verify` fails on. Omit `--style` only when there is none.

**`--strict` is the pre-hand-off gate, and a `nowrap` width warning is what `verify` fails on.** `nowrap text "…" likely wider than w=168 — widen or use w:"auto"` is the same fit the parity check measures in the browser, so on ordinary copy the row comes back `overflows its box` and the build is dead. Fix it in the model — shorten the text, widen the row, or `w:'auto'` — before you create. Treat every warning `--strict` fails on the same way: fix it, or write the reason into the hand-off note. The class stays a warning because the estimate is `chars × size × cw` and an average glyph width can miss in both directions: measured in Chromium at Body 16/`cw` 0.46, `lillililliltililliltil` estimates 162px and renders 100, inside its box and warned about; `MMMWWWMM` estimates 59px and renders 114, over its 70px box and never warned. So a silent `validate` is not a pass either, which is why Step 5 is mandatory.

### Step 4 — create
```
node bin/create.mjs --model model.json [--style style.json] --out deck.html --format slides [--space 1600x900] [--title "…"] [--from prev.html]
```
Refuses an invalid model (`--force` to override while iterating). Stamps `deck.id` (born once, from the first model — the browser's storage namespace, stable across versions), `deck.rev` (this build's content hash), a `slide.id` on every slide and a row `id` on every row that has none — deterministic (`s1, s2… / r1, r2…`), so the same model builds byte-identically.

**Revising a deck a human has touched — `--from` is mandatory.** The deck file carries the human's edits (`/*LOG*/`). Run, in this order:
```
node bin/edits.mjs deck.html                       # 1. READ what the human changed
node bin/create.mjs --model model.json --out deck.html --from deck.html   # 2. write the new version
node bin/verify.mjs deck.html                      # 3. verify the result
```
`--from` inherits the deck id and the slide/row ids and replays every logged edit onto the new build. Full flow: [docs/editor.md](docs/editor.md#revising-an-edited-deck).

**The deck names itself.** `--title` wins, else the model's own `title`, else `decklet`; the winner is written into the model and the runtime titles the document from it. One short, human name — you are the one who writes it — becomes the browser tab, the `⤓` PDF filename and the `⌘S` save-a-copy filename.

### Step 5 — verify (mandatory)
```
node bin/verify.mjs deck.html [--refs shots/] [--out verify-out/] [--threshold 0.5] [--strict]
```
- **Contract** — always.
- **Air** — always, in `validate`, with no browser: the `gap` gate below. It refuses the layout before it exists; parity measures what actually rendered.
- **Layout parity** — always (needs Playwright): no text row overflows its box, every `nowrap` row renders one line, imported rows render their source line count, every element is inside the canvas, **no painted row is drawn through a text row**, zero page errors.
  Five collision shapes fail it: **ink through text**; **text straddling a container**; **an arrow head inside a fill** (aim at the edge with `to:`); **text over text**; **text under paint** (occlusion — reorder `els`, paint first). Containment is not collision, and `over:1` opts a row out of all five. Each in full, with the boundary cases: [docs/verify.md](docs/verify.md).
- **AE pixel diff** — when `--refs` exists (needs ImageMagick): `< 0.5%` of pixels differ at 2% fuzz. AE alone passes wrapped labels; parity is what catches them — that is why parity is not optional.

Fix the model; re-run to `VERIFY PASS`, attach `verify-out/results.json`. The hand-off needs a second pass: [docs/building.md](docs/building.md).

**When the engine is wrong** (verify fails on a layout the model declares cleanly, a control misbehaves, a PDF does not match the slide): `node bin/bug.mjs deck.html --category looks --desc "what happened" --tool verify --log verify.log` prints a prefilled mail to decklet@grunion.ai — the engine version and the deck's shape, a scrubbed tool snippet, never the deck's words ([docs/editor.md](docs/editor.md#reporting-a-bug)). Say so in the hand-off notes rather than working around the engine in the model.

### Step 6 — hand-off notes for the human editor
Say, in this order:
1. Where the file is and that it opens from disk in any browser, no install, no network.
2. **The editor:** [docs/editor.md](docs/editor.md) — the HUD and its manifest, phones, the contact sheet, both PDF routes, PNG export (`node bin/export.mjs deck.html --png`), presenting, persistence and the bug door.
   Quote the lines that matter — the save button (⌘S) writes the file in Chrome/Edge, a copy in Safari; ⤓ writes the PDF; Esc opens the contact sheet — and link the rest.
3. To revise an edited deck, run `node bin/edits.mjs deck.html` to read the log, then `create --from deck.html` (Step 4). Everything a human applies in the editor — geometry, text, links, arrows — round-trips that way; the console `copy(JSON.stringify(deck))` still works for a raw model.
4. What you inferred (style, layout choices) and anything marked experimental.

---

## MODEL CONTRACT

Top level:
| prop | type | default | example |
|---|---|---|---|
| `w`, `h` | number | from `format`, in `validate` as in `create` | `960`, `540` — name `format` or both; a model naming neither is an error |
| `format` | enum | `slides` | `"carousel"` |
| `page` | `letter`\|`a4` | from format | set by create |
| `title` | string | `decklet` | `"Q3 update"` — tab title + `⤓`/`⌘S` filename; `--title` overwrites it |
| `spell` | `{ignore: ["decklet", …]}` | none | words the build's dictionary must not flag (a name); case-blind; the editor's Ignore appends here. The build (nspell + dictionary-en, optional) writes each refused word with its suggestions, which the editor marks and offers — HUD · spellcheck |
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

Slot geometry: `{x, y, w, h?, role}` — or `right` in place of `x`; a slotted row's own `right` overrides the slot's `x` the way its own `x` would.

Slide: `{id?, name?, layout?, bg?, hide?: masterId[], notes?: string, els: row[]}` — `notes` is the speaker's text for the slide, one string, kept in the file and in the edit log like any slide key (no panel renders it yet; `bin/edits.mjs` and the model carry it). `id` (unique per deck; `s1, s2…` when create stamps it) is how a tab remembers the slide it was on and how the edit log addresses a slide. Rows carry `id` (unique per slide; `r1, r2…`) for the same reason and for `to:`/`from:`.

Row — every prop optional; a row is whatever its props make it:
| prop | type | default | meaning |
|---|---|---|---|
| `x`,`y` | number | `0` | top-left, model px |
| `right` | number | — | the row's right edge N px from the canvas right edge (canvas-space, like `x`); x is derived at render from the measured width, so a `w:'auto'` chip needs no guessed x. Exclusive with `x` (validate errors on both). A drag or nudge in the editor writes `right`, so the anchor survives edits |
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
| `bullet` | 1 | — | the engine draws this row's list marker: a half-em dot hanging 1.25em left of the row's box, sized and seated from the role. The declared box is unchanged, so parity and the gap gate read what the model says. Usually inherited from a `b1…bn` slot (`bullets`, `image-left`, `image-right`); an unbound bullet draws no row, and no dot |
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
| `to`, `from` | row id \| row index | — | terminate a connector **against another row**: the engine clips where the stroke crosses that row's box and backs off `gap`, so the tip stops clear of the border. Aim at the target, not at a hand-computed standoff. Prefer an id — indices shift when a row is inserted |
| `gap` | number | `10` | the air `to:`/`from:` leaves between the tip and the target's border. `0` is flush (situational — K1) |
| `head` | `triangle`\|`chevron`\|`dot`\|`bar` | `triangle` | what is drawn at the arrow ends. `arrow` says *which* ends, `head` says *what* — centred on the stroke axis by construction |
| `dash` | `1` \| `[on,off]` | — | dashed stroke, **quantised to the run** so it always begins and ends on a whole dash (measured along arc length on a curve). Keeps its head |
| `waive` | 1 | — | this connector breaks a shape rule on purpose — `validate` stays quiet about it (the `over:1` of connector geometry) |
| `over` | 1 | — | declares a deliberate overlay: `validate`'s gap gate and `verify`'s collision check leave this row (and what it crosses) alone |
| `href` | url \| `#slide` | — | http/https/mailto, or **into the deck**: `'#7'` (slide number, 1-based) or `'#<slide id>'` — a table of contents, a back-to-agenda button. Presenting, a click jumps to the slide and the URL hash follows; editing, ⌘-click jumps. `validate` fails a `#` that names no slide; `verify` lists every link with where it lands. In-deck targets get no `/Link` annotation in the PDF (a page is not a URL). Editing, **⌘K** (or the toolbar's link button) is one field for every selected row at once — select the painted button and its label, type once; empty removes it. Outward:  One inset anchor over the whole row (a painted CTA box + its label each carry it); presenting: a click opens it in a new tab; editing: a click selects the row, ⌘-click (Ctrl-click off Mac) opens it and the hover hint says so; a real `/Link` annotation in the `⤓` PDF and an anchor on every ⌘P page |
| `donut` | 0–100 | — | ring, `w` = diameter, `color` = fill |
| `hole` | 0–99 | 55 | the ring's hollow in percent; `0` is a filled ball |
| `svg` | string | — | inline SVG markup (no script, no external href) |
| `icon` | name | — | a Lucide icon by name (see GRAPHICS; `--icons` lists them) — expands to an `svg` row at create, `color` paints it |
| `img` | data: URI | — | image; `fit`, `pos` = object-fit/position |
| `alt` | string | — | what the row shows, for a reader who cannot see it — an `img`, an `svg`, a chart's rows. Model-only today: nothing renders it yet; the editor field and the tagged-PDF export read it later |
| `anim` | `rise`\|`fade`\|`pop`\|`wipe` | — | entrance motion on slide entry, staggered 120 ms in model order (see MOTION) |
| `chart` | `{mark, data, …}` | — | a bar or line chart drawn into this row's x/y/w/h at create time ([docs/charts.md](docs/charts.md)) |
| `css` | string | — | raw CSS escape hatch — validator warns |
| `group` | string | — | rows on a slide sharing one `group` are one unit in the editor: drag, nudge and marquee move them together, the selection draws one box round them, ⌘-click takes a member alone. Every row keeps canvas-space x/y — nothing is relative. A `chart` row's expansion shares one group; the library's kpi tiles, steps, timeline events and cta button are born grouped |
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
- The eight roles are the whole type system — exactly these names: `Title` (display headline for cover/closing slides), `Supertitle` (kicker), `H1` (content-slide title), `H2`, `Body`, `Caption`, `Label` (mono, uppercase — chips, axis labels, footer), `Stat`. No H3, no Subtitle. One allowance: **`Stat2`**, an optional ninth role for the KPI tile — a hero "63%" and a card "$1.2M" cannot share one size. A style may define it; when it does not, `create` derives it from `Stat` at **0.6** (size, line height, tracking) and only when a row or slot asks for it, so a deck that never uses `Stat2` never carries it. The `kpi-grid` tiles wear it; the hero `stat` layout keeps `Stat`. A role is a complete treatment: `font`, `size`, `weight`, `lh`, `ls`, `color`, optional `tt`. One font and one size per role — never two sizes of "Body". A row may add `weight`, `color`, `tt`, `italic`; it can never carry `font`, `size`, `lh`, `ls` or `mono` (the validator rejects it, the engine ignores it).
- `margin` is the content inset the chrome sits on (footer counter's right edge, default 6% of `w`). Set it to match your layouts' left edge.
- `gap` is the air every row owes its neighbours (default 4px, the offset the chart library itself uses between a bar and its value). Raise it for a roomier deck; `validate` enforces it on declared boxes.
- `cw` on a role is the measured average glyph width in em (`width / chars / size` of a representative sentence in that font, weight and case). `validate` sizes `w:'auto'` rows and line counts with it; without it the blanket 0.55 stands, which runs ~20% wide on a sans and ~20% narrow on an uppercase mono. Measure it with `node bin/measure-cw.mjs <style.json> --write`; the neutral roles carry theirs.
- The model's own `styles.roles` win over `style.json` per role; a model with no roles inherits the template's neutral scale.

## LAYOUTS (slots)
- `layouts.<name>.<slot> = {x, y, w, h?, role}`; a slide opts in with `layout:'<name>'`.
- `slots.<slot>` (deck scope) applies under every layout — use it for a supertitle shared by all.
- A slotted row may carry local x/y/w/h overrides; edit the slot in the model to move every slide at once.
- Conventional slot names: `supertitle`, `title`, `body`, `body2`. Conventional layouts: `title` (cover), `content`, `section`.
- A slot may carry any row treatment besides geometry and role — `tile:1`, `bg`, `p:'chip'`, `align`, `nowrap`, `italic`, even `line` — and the engine spreads it onto the bound row. A roleless slot with `h` is paint or media: `{slot:'rule'}` alone draws it.

## LAYOUT LIBRARY

Thirty-two named layouts ship with the engine (`lib/layouts.mjs`), in the same shape as a `layouts` entry. Name one on a slide the deck does not define and `create` merges it into `deck.layouts`, scaled from its 960×540 cut to the canvas (1600×900 = ×1.67). Print the catalogue — name, group, density, use, then every slot's box (`x y w h`) and the free band — with:
```
node bin/validate.mjs --layouts
```
Read that instead of inventing geometry, and instead of `lib/layouts.mjs`: each layout prints a `free:` band, under its lowest chrome slot and above its foot, which is where a free row goes. The library is an accelerant, never a fence: a slide may mix library slots with free rows (`layout:'kpi-grid'` plus a caption and a rule at y 400 is a normal slide), and a deck-defined layout of the same name wins. A slotted row still takes its own x/y/w/h — the `override` path — so a brand with a display role taller than the neutral scale (Title 64/68, Stat 40/44 — what the library is cut for) nudges a slot without redefining the layout. An unknown name is an error that lists the library.

- **openers** — `cover` · `agenda` · `section`
- **chrome** — `content` · `title`
- **text** — `statement` · `fact` · `quote` · `two-cols` · `two-cols-header` · `bullets`
- **visuals** — `image-left` · `image-right`
- **modern** — `bento-grid` · `image-hero-overlay` · `image-split` · `annotated-shot` · `three-up-cards` · `dashboard-composite` · `table-insight` · `proof-strip` · `team-grid`
- **numbers** — `kpi-grid` · `kpi-grid-4` · `stat` · `chart` · `comparison`
- **diagrams** — `process-steps` · `diagram`
- **plans** — `timeline`
- **closers** — `cta` · `end`

The corner is the counter's. `COUNTER` (`lib/layouts.mjs`) is the box the page counter may occupy on the 960×540 cut — `{right: 60, y: 466, w: 96, h: 74}`, the right foot — and no library slot enters it: `legend` keeps its right alignment with its right edge at 792 (`right: 168`, the reserve plus a 12px gap). A deck's own rows owe the counter the same air (§ VERIFICATION thresholds: `air`, `counter`); a slide that hides the footer is exempt from the slide-to-slide half.

Delta chips are `Label` on a `chip` pad in `var(--box)`, coloured `var(--ok, var(--accent))`; a falling delta sets `color:'var(--bad, var(--accent))'` on the row — the deck's `ok`/`bad` tokens if the style defines them, else the accent.

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
Seventy-four finished slides ship with the engine (`lib/templates.mjs`, sources in `lib/templates/cat-*.mjs`), surveyed across the open-source slide catalogs and promoted whole. A template is a layout PLUS sample rows — an issue tree, a Sankey, a scorecard, a bento grid — so the agent binds content instead of drawing. Print the catalogue — id · tier · density · note, what `fill` cannot reach, then every text key with its sample — with:
```
node bin/validate.mjs --templates
```
A slide names one and fills its keys: `{template: 'three-up-cards', fill: {t1: 'What you get', t2: 'Three things, one price.', t3: '01', …}}`. Every text row of the template is a key, `t1`…`tn` in row order; a key left out keeps the sample text (so fill them all before shipping). Two kinds of key: a text row takes a string, and **value keys** take a number in the range `--templates` prints beside them — `harvey-balls` `r1c1`…`r3c4` (0–4 quarters), `progress-tracker` `p1`…`p4`, the gauge and donuts' `v1`… (0–100). `chart-column`, `chart-grouped` and `chart-line-trend` take `data` — the chart row's own `[{label, value, compare?}]`. Out of range is an error; `fixed:` counts the rows no key reaches. `create` expands the slide into the template's rows, scaled from the 960×540 cut to the canvas, sets the slide's `layout` to the template's chrome (`content` or `title` from the library — a deck-defined layout of that name wins) and its `density`, and keeps any free `els` after the template rows. An unknown template or fill key is a validate error listing what exists. A **scorecard cell** (`scorecard-grid`, role `Cell`) takes a short string OR a `0`–`4` rating, which draws the same ball. A template is an accelerant like a layout: edit the rows it produced, add rows beside them, or draw free — nothing here is a fence.
The starting rungs: `bullet-page` (a title and five points on `bullets`, a dot each), `image-bullets` (a photo and three points on `image-left`), `process-flow-3` · `-4` · `-5` (one block-arrow shape whose box width falls out of the count — 251, 180, 138), and `stat-row-3` (three numbers at **speaker** density, where the other numbers templates are reading).
Tiers: **core** (in 4+ surveyed catalogs), **standard** (consulting catalogs), **fringe** (dataviz literature, rare on slides). Categories: Narrative · Numbers · Comparison · Frameworks · Process · Charts · Modern · Figures.

**Figures** are the figure kinds as templates — `figure-decision`, `figure-flow`, `figure-before-after`, `figure-data-model`, `figure-states`, `figure-release`, `figure-boundaries`, `figure-boundaries-6`, `figure-tree`, `figure-layers` — each the rows `diagramSlide()` makes from a spec on the `diagram` layout, reading density, with a caption stating the claim. What each sample shows, and the spec path for one of your own: [docs/figures.md](docs/figures.md).

The speaker-density templates are the covers, dividers, quotes, statements, hero numbers, the donut and gauge, the cycle and the tree; everything with a table, a grid or a series is **reading**. `--templates` prints each one's density.

## DENSITY
A template carries its own density and **overrides the deck's** on the slide that names it (`create` copies it across unless the slide states one); set the slide's `density` to take the deck's back.
Two densities, in `lib/layouts.mjs` (`DENSITY`), so "dense" and "fluffy" build the same deck every time. A deck says `density`; a slide may override. `validate` warns on every slide that misses it; an unknown density is an error.
| density | aka | for | the slide carries | max |
|---|---|---|---|---|
| `speaker` | **fluffy** | a presented deck — the speaker carries the rest | supertitle · title · one figure, number or ≤ 3 points · a caption at most | 3 points · 40 words |
| `reading` | **dense** | a leave-behind read without a speaker — the slide carries its own context | supertitle · title · `subtitle` (the claim in one sentence) · the figure or the points · `note` (what to make of it) · `source` · `legend` · footer naming the deck | 8 points · 140 words |
The dense chrome is four optional slots every H1-titled library layout carries (`DENSE`): `subtitle` (H2, muted, under the title), `note` (Body, muted, above the foot), `source` (Caption, left foot), `legend` (Label, right foot via `right: 168`, clear of the counter); the subtitle is `nowrap` — parity fails a wrap. A layout that cannot seat one says so (`dense: {note: false}` on `chart`, whose `takeaway` is the note; all four on `diagram`). A reading slide binds at least one; a speaker slide none. **The counting rule:** a *point* is a text row whose slot is not `supertitle/title/subtitle/note/source/legend/caption/number` and role not Supertitle/Title/H1/Caption/Label; the word cap counts every text row, chrome included; over budget `validate` lists what it counted.
## GRAPHICS
Five kinds of picture, one rule each. Colour is always a token; nothing loads from the network.
- **Icons** — `{icon: 'shield-check', x, y, w: 24, h: 24, color: 'var(--accent)'}`. The set is Lucide (ISC), 169 names, `node bin/validate.mjs --icons` prints them; `create` inlines the svg (stroke `currentColor`, so `color` paints it) and only the icons a deck uses reach the file. One icon per point, on the 24 grid (24/32/40 px), left of its label on the label's cap line, the same weight throughout. An icon says what the label says — never decoration, never a second idea, never a filled emoji.
- **Glyphs** — a number in a circle, a letter chip, a status dot: rows, not images. A step glyph is a `dot` (or a `radius:'50%'` box) with a `Label` centred in it (`valign:'middle'`); a status dot is a 10px `bg` circle in `var(--ok)`/`var(--bad)`. Group the glyph with its text.
- **Images and GIFs** — `img` is a data: URI (an animated GIF plays as-is), `fit:'cover'`, explicit `w`/`h`, one per slide, never stretched, never behind text unless a tint band (`bg` with `op`) sits between. Budget ≈ 100 KB an image, the file under ~1 MB. Photographs carry the `image-left`/`image-right`/`image-hero-overlay`/`image-split` layouts; a screenshot gets `annotated-shot` with callout rows.
- **Figures** — nodes, connectors, timelines, trees as rows (`lib/diagram.mjs`, the `diagram` layout, the framework and process templates), so every box and edge stays editable. Build one through the spec API — `diagramSlide(spec, {supertitle, title, caption})` from `@grunion/decklet/diagram`, or `diagramRows(spec, frame)` for a free frame — which routes the connectors: [docs/figures.md](docs/figures.md). An `svg` row is for a fill the engine has no primitive for (a Sankey ribbon, an area band) — never for text, never for a whole figure.
- **Clips** — a short cropped GIF of a real interaction (`docs/record-clips.mjs`), ≤ 3 s, ≤ 48 colours, ~10 fps; the same inline rule. A clip of the thing working beats a screenshot of it.

**Charts** are one `chart` row that `create` expands into bars, lines, dots and labels — bars from zero, one explicit max, direct value labels, no legend: [docs/charts.md](docs/charts.md). **Connectors** are strokes with a head, and `diagramRows()` already routes them to the rules (orthogonal runs, 96px S-curve channels, air at both ends, 2.5px or heavier); draw one by hand and read [docs/connectors.md](docs/connectors.md) first.

## MASTER layer
- Drawn under every slide, in array order, identically — chrome is deck-wide and never varies per layout. Rows need a unique `id`.
- A slide hides one with `hide:['id']`; overrides one with a **partial** row carrying `override:'id'` plus only the props that change — everything else keeps reading from the master (the editor creates these when a human edits chrome on one slide; "Apply to all slides" merges them back).
- Exactly one `footer:1` row. The row is anchored to the content edge and grows inward: **right-anchored** when it declares `right` (whatever the value, the engine snaps it to `w − styles.margin`) or when an `x`+numeric `w` put its centre past W/2, **left-anchored** otherwise — left edge at `margin`. `w:'auto'` is the right width for both; a right-anchored row needs no `x` and a left-anchored one needs no `right`. **The corner is the counter's:** a right-anchored row carries `· n / N` inline, inheriting its font and baseline; a left-anchored row keeps its text at the left and the counter detaches to the corner on the same top, wearing the row's font — either way the counter's right edge is `w − margin` on every slide, and `verify` fails parity when it moves off that corner or differs between slides (a slide that hides the footer is exempt from the slide-to-slide check: it gets the pin). With no footer row the counter renders as a pin at the same margin.

## MOTION (`anim`)
Four words, and no fifth: `rise` (text — the default), `fade` (quiet chrome), `pop` (stats, tiles, images), `wipe` (bars, lines, rules). Anything else is an error in `validate`. **Entry only:** animated rows enter in model order, staggered 120 ms, and only when a slide is *entered* — print, the contact sheet, the ⤓ PDF and `verify` all draw the settled frame, and `prefers-reduced-motion: reduce` turns every anim off, so a deck reads exactly the same standing still. When to animate: [docs/editor.md](docs/editor.md#motion).


## VERIFICATION thresholds
Every check with its pass criterion: [docs/verify.md](docs/verify.md#thresholds). The two that stop a hand-off are `validate --strict` at 0 errors and 0 warnings, and `verify` printing `VERIFY PASS`.

## ANTI-PATTERNS (each is a review failure)
- **Implicit padding / chrome on plain text.** A text row is text. Padding, radius, pre-wrap belong to `box`/`tile` or explicit `p`. Never fake a card with a padded text row.
- **Per-slide chrome drift.** A footer or mark redrawn on each slide with slightly different x/y. It is one master row; slides fork only when a human edits.
- **Size overrides.** `size:18` on a Body row "because it needs to be bigger". Change the role, or use the right role (`Title` for a display headline, `H1` for a slide title). Same for `font`, `lh`, `ls`, `mono`.
- **Wrapping labels.** Chips, axis labels, step numbers, supertitles that wrap to two lines. `nowrap:1` + width, or `w:'auto'`. Parity fails these on purpose.
- **Touching boxes.** A chip 2px from the next chip, a caption resting on the rule under it, a value label on its bar's top edge. `validate` names the pair and the distance; give it `styles.gap` of air, or state the relationship (`group`, containment, `over:1`).
- **Guessed x for an auto-width row.** A chip on a card's right edge is `right:`, never a guessed `x` — a `w:'auto'` row has no width until it renders, and the guess runs under its neighbour.
- **Hand-built arrow heads.** Three `line` rows and a trig helper to draw one arrow. `arrow:'end'` on a `line` or a `curve`. Stiff diagonals where the source had a spline: that is what `curve` is for.
- **Connectors aimed at a centre.** Giving a connector the target's coordinate puts the head inside its fill, floating. Give the target itself — `to: 'grade'` — and the engine stops the tip on the border. Hand-computed standoffs ("end it 10px short") are the thing `to` exists to delete: the head no longer overshoots, so paying it back by hand now *under*-shoots.
- **A dead CTA.** A painted button with no `href` looks like a link and is not one — no click in the deck, no annotation in the PDF, and a LinkedIn document post has nothing to follow. Put the `href` on the box **and** on its label row.
- **Leader lines through labels.** Route the line, or declare the overlay with `over:1`. `verify` fails it either way until you decide.
- **Hardcoded counters.** `"3 / 9"` typed into a row. The footer master renders the counter.
- **Font pickers / ad-hoc colours.** No per-row font families, no rainbow of hexes. Tokens and roles only; literal hex is for chart series.
- **Walls of text.** More than ~60 Body words on a 16:9 slide, or Body wrapping past 3 lines. Split the slide.
- **Network anything.** No webfonts, CDNs, remote images. Images and clips are data: URIs; fonts are installed or system stacks.
- **Motion everywhere.** Every row carrying `anim`, or an anim invented outside the four. Motion marks the reading order of a few rows; the rest are already there.
- **Unverified hand-off.** A deck without a `VERIFY PASS` is not done.

---

## WORKED EXAMPLES
Three briefs end to end: [docs/examples.md](docs/examples.md). Finished HTML pages into a model: [docs/import-html.md](docs/import-html.md).
