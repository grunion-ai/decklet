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

All commands run from the repo root with plain Node ≥ 22. Only `verify` (and `import-html`) need the optional `playwright` devDependency.

---

## INPUTS

### 1. Content — anything
Outline, markdown, meeting notes, a transcript, a spreadsheet, a brief. You distil it; nothing is pasted verbatim. One idea per slide. Numbers become `Stat` rows, lists become 2–4 short `Body` rows or tiles, sequences become boxes with arrows, comparisons become two columns.

### 2. Format — one of
| format | canvas (model px) | print page | status |
|---|---|---|---|
| `slides` | 960×540 (or 1600×900 via `--space 1600x900`) | Letter, slide zoomed to page width | **supported** |
| `carousel` | 1080×1080 (1:1) | Letter | experimental |
| `carousel-4x5` | 1080×1350 (4:5) | Letter | experimental |
| `document-letter` | 816×1056 (8.5×11in) | Letter, zoom 1 | experimental |
| `document-a4` | 794×1123 (210×297mm) | A4, zoom 1 | experimental |

Experimental means: canvas sizing, editing, contact sheet and PDF all work; **text does not flow across pages** — every page is a slide you lay out yourself, and a document longer than its page is your problem to split. Treat a document as N fixed pages.

### 3. Style — a style guide, an inferred brand, or the neutral fallback
`style.json` = `{tokens, roles, pad}` (STYLE CONTRACT below). Obtain it in this order:
1. **Style guide / brand file given** → map its palette to `tokens`, its type scale to the eight `roles`. Fonts must be installed on the viewer's machine or be system stacks — the deck loads no webfonts. Put the brand font first, a system fallback after.
2. **URL or screenshots given** → infer: background, ink, muted ink, one accent, a card surface, a hairline. Headline family (serif/sans/mono), body family. Build `tokens` + `roles` from that. Say in the hand-off what you inferred.
3. **Nothing given** → omit `--style`; the template's neutral dark scale is used.

Sizes in `roles` are in **model pixels** for the chosen canvas. Rough scale factors: 960-wide ×1, 1600-wide ×1.67, 1080 carousel ×1.9 (viewed small), 816 document ×0.75.

---

## PROCESS

### Step 1 — slide plan (write it down before any JSON)
For each slide: `name · layout · supertitle · title · body elements (kind + count)`. Cap: ~60 words of `Body` per 16:9 slide, 3–4 tiles per row, 5 bars per chart, 4 boxes per flow. A content-slide title is one line at `H1`; a cover or closing headline uses `Title` (the display size), two lines at most.

### Step 2 — model rows
Discipline, in order of importance:
- **Role discipline.** Every text row has a `role` (or a `slot` whose layout slot has one). A row never sets `font`, `size`, `lh`, `ls` or `mono` — the validator rejects it. Rows may set `weight`, `color`, `tt`, `italic`, `align`.
- **Slot discipline.** Supertitle and title geometry lives in `layouts.<name>`; the slide row is `{slot:'title', text:'…'}` with no x/y/w. Define one layout per slide family (`title`, `content`; add `section`, `two-col` as needed).
- **Master discipline.** Anything that appears on every slide (footer, rule, mark) is a `master` row, once — chrome is deck-wide and never varies per layout. Exactly one master row has `footer:1`; the engine renders the page counter inside it, with its right edge on `styles.margin`. Never type `3 / 9` into a row.
- **Text-fit.** A label that must stay on one line gets `nowrap:1` and enough `w` (≈ 0.55 × size × chars), or `w:'auto'` to hug. Chips/pills: `w:'auto'` + `p:'chip'` (+ `bg`/`bd`/`radius`). Body copy gets a `w` that yields ≤ 3 lines at the role's size.
- **Charts are rows.** Bars: `{x,y,w,h,bg,bar:1}` bottom-aligned on a baseline `line`; value labels as `Label` rows above, axis labels below. Donut: `{x,y,w,donut:72}` + a `Stat` row centred on it. Tiles: `{x,y,w,h,tile:1,role:'Stat',text}` + a `Label` row beneath.
- **Colour.** Use `var(--accent)`, `var(--fg)`, `var(--muted)`, `var(--line)`, `var(--card)` so a style swap re-themes the deck; literal hex only for chart series.

### Step 3 — validate (no browser)
```
node bin/validate.mjs model.json --style style.json            # 0 errors required; read every warning
node bin/validate.mjs model.json --style style.json --strict   # warnings fail too — use before hand-off
```
**Always pass the same `--style` you will pass to `create`.** Text fit is only meaningful against the scale the deck will actually wear: without it the model is measured against the template's neutral roles, so `validate` can report 0 warnings on a model `create --style` then floods with overflow — and `verify` fails on. Omit `--style` only when there is none.

### Step 4 — create
```
node bin/create.mjs --model model.json [--style style.json] --out deck.html --format slides [--space 1600x900] [--title "…"]
```
Refuses an invalid model (`--force` to override while iterating). Stamps a per-deck storage namespace from the model hash, so a rebuilt deck never loads a stale local edit.

**The deck names itself.** `--title` wins, else the model's own `title`, else `decklet`; the winner is written into the model and the runtime titles the document from it. One short, human name — you are the one who writes it — becomes the browser tab, the `⤓` PDF filename and the `⌘S` save-a-copy filename.

### Step 5 — verify (mandatory)
```
node bin/verify.mjs deck.html [--refs shots/] [--out verify-out/] [--threshold 0.5] [--strict]
```
- **Contract** — always.
- **Layout parity** — always (needs Playwright): no text row overflows its box, every `nowrap` row renders one line, imported rows render their source line count, every element is inside the canvas, zero page errors.
- **AE pixel diff** — when `--refs` exists (needs ImageMagick): `< 0.5%` of pixels differ at 2% fuzz. AE alone passes wrapped labels; parity is what catches them — that is why parity is not optional.

Fix the model, not the output. Re-run until `VERIFY PASS`. Attach `verify-out/results.json` to your report.

### Step 6 — hand-off notes for the human editor
Say, in this order:
1. Where the file is and that it opens from disk in any browser, no install, no network.
2. **Toolbar:** `‹ prev` / `next ›` · `+` (Text / Box / Slide) · `⊞` contact sheet (G or Esc) · `⤓` PDF · `⛶` fullscreen (F). Drag to move, ⌘-click to multi-select, double-click to retype, corner nib to resize, ⌘Z to undo (persists across reloads). Selecting text shows a floating toolbar: role segment, B/I/U/S and sub/superscript marks (marks never change size), the deck's own colours as swatches, "Apply to layout", "Apply to all slides".
3. **Contact sheet:** live thumbnails 3-across; click / ⌘ / shift select, double-click opens, grab-and-drag reorders (mouse or touch — the other cells slide aside), ⌫ deletes (never the last), ⌘C ⌘V ⌘D ⌘Z. It also opens in present mode.
4. **PDF:** `⤓` downloads a **true slide-sized PDF written inside the file** — no library, no server. Each slide is rasterised from its live DOM (SVG `foreignObject` → canvas at 2× → JPEG) onto a W×H pt page, so a 16:9 deck is a 16:9 PDF with no letterboxing; fonts must be local (they are — the deck loads none). Verified in Chromium; **Safari's `foreignObject` path is unconfirmed** — if rasterising throws or the canvas is tainted, `⤓` falls back to `print()`. **⌘P is the paper path:** one page per slide, each with its own background, on a **named** page size — Letter (A4 for `document-a4`) — because Safari ignores pixel `@page` sizes; the slide is zoomed to the printable width. Choose "Save as PDF" there for a paper-shaped file.
5. **Presenting:** F or `⛶`; chrome hides, backdrop = current slide's background, HUD peeks back when the pointer rests at the bottom edge and stays pinned while the + menu, the text toolbar or the contact sheet is open. Arrow keys / space advance; Esc opens the contact sheet to jump.
6. Edits persist in the browser's local storage per deck. To publish an edited deck, copy the model back: in the console `copy(JSON.stringify(deck))` (or read the `decklet:<hash>:model` storage key) → `model.json` → re-create.
7. What you inferred (style, layout choices) and anything marked experimental.

---

## MODEL CONTRACT

Top level:
| prop | type | default | example |
|---|---|---|---|
| `w`, `h` | number | from format | `960`, `540` |
| `format` | enum | `slides` | `"carousel"` |
| `page` | `letter`\|`a4` | from format | set by create |
| `title` | string | `decklet` | `"Q3 update"` — tab title + `⤓`/`⌘S` filename; `--title` overwrites it |
| `styles.roles` | `{Role: treatment}` | template neutral | see STYLE CONTRACT |
| `styles.margin` | number | `round(w × 0.06)` | content inset chrome sits on: the footer counter's right edge = `w − margin` |
| `styles.pad` | `{token: css}` | `{chip:'3px 8px', pill:'5px 12px'}` | `p:'chip'` on a row |
| `slots` | `{slot: geometry}` | `{}` | deck-scope slots under every layout (`{supertitle:{x:60,y:52,w:840,role:'Supertitle'}}`) |
| `layouts` | `{name: {slot: geometry}}` | `{}` | `{content:{title:{x:60,y:76,w:840,role:'H1'}}}` |
| `master` | row[] with `id` | `[]` | `[{id:'foot',footer:1,…}]` |
| `slides` | slide[] (≥1) | — | |

Slot geometry: `{x, y, w, h?, role}`.

Slide: `{name?, layout?, bg?, hide?: masterId[], els: row[]}`.

Row — every prop optional; a row is whatever its props make it:
| prop | type | default | meaning |
|---|---|---|---|
| `x`,`y` | number | `0` | top-left, model px |
| `w` | number \| `'auto'` | `0` | width; `'auto'` hugs content |
| `h` | number | content | height; required for bar/tile/box-with-height |
| `slot` | string | — | inherit geometry + role from the layout/deck slot; own x/y/w/h are overrides |
| `role` | string | slot's role | text treatment from `styles.roles` — **required for text** |
| `text` | string | — | plain text; `\n` = line break |
| `html` | string | — | inline runs: `<b> <i> <u> <s> <span style="color:…">` only; no size/family/leading |
| `weight` | number | role | font-weight override |
| `color` | css | role | text colour (`var(--accent)` etc.) |
| `tt` | css | role | `uppercase` / `none` |
| `italic` | 1 | — | |
| `align` | css | `left` | `center`, `right` |
| `nowrap` | 1 | — | single line, never wraps (parity checks it) |
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
| `donut` | 0–100 | — | ring, `w` = diameter, `color` = fill |
| `svg` | string | — | inline SVG markup (no script, no external href) |
| `img` | data: URI | — | image; `fit`, `pos` = object-fit/position |
| `anim` | `rise`\|`fade`\|`pop`\|`wipe` | — | entrance motion on slide entry, staggered 120 ms in model order (see MOTION) |
| `css` | string | — | raw CSS escape hatch — validator warns |
| `override` | masterId | — | partial row: only the props it carries replace the master's on this slide |
| `footer` | 1 | — | master only: the page counter renders inline here |
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
  "margin": 60
}
```
- `tokens` → CSS custom properties on `:root`. `bg` is the editor chrome behind the slide; `card` is the slide surface; `box` the outlined-box fill; `sel` the selection colour.
- The eight roles are the whole type system — exactly these names: `Title` (display headline for cover/closing slides), `Supertitle` (kicker), `H1` (content-slide title), `H2`, `Body`, `Caption`, `Label` (mono, uppercase — chips, axis labels, footer), `Stat`. No H3, no Subtitle. A role is a complete treatment: `font`, `size`, `weight`, `lh`, `ls`, `color`, optional `tt`. One font and one size per role — never two sizes of "Body". A row may add `weight`, `color`, `tt`, `italic`; it can never carry `font`, `size`, `lh`, `ls` or `mono` (the validator rejects it, the engine ignores it).
- `margin` is the content inset the chrome sits on (footer counter's right edge, default 6% of `w`). Set it to match your layouts' left edge.
- The model's own `styles.roles` win over `style.json` per role; a model with no roles inherits the template's neutral scale.

## LAYOUTS (slots)
- `layouts.<name>.<slot> = {x, y, w, h?, role}`; a slide opts in with `layout:'<name>'`.
- `slots.<slot>` (deck scope) applies under every layout — use it for a supertitle shared by all.
- A slotted row may carry local x/y/w/h overrides; the editor's "Apply to layout" promotes them to the slot.
- Conventional slot names: `supertitle`, `title`, `body`, `body2`. Conventional layouts: `title` (cover), `content`, `section`.

## MASTER layer
- Drawn under every slide, in array order, identically — chrome is deck-wide and never varies per layout. Rows need a unique `id`.
- A slide hides one with `hide:['id']`; overrides one with a **partial** row carrying `override:'id'` plus only the props that change — everything else keeps reading from the master (the editor creates these when a human edits chrome on one slide; "Apply to all slides" merges them back).
- Exactly one `footer:1` row: the counter `· n / N` is appended inside it, inheriting its font and baseline. The row is anchored to the content edge — right edge at `w − styles.margin` when its centre is past W/2, otherwise left edge at `margin` — and grows inward. With no footer row the counter renders as a pin at the same margin.

## MOTION (`anim`)
Four words, and no fifth: `rise` (text — the default), `fade` (quiet chrome), `pop` (stats, tiles, images), `wipe` (bars, lines, rules). Anything else is an error in `validate` and is ignored by the renderer.

- **Entry only.** Animated rows enter in model order, staggered 120 ms, and only when a slide is *entered*. Dragging, selecting, retyping or undoing re-render the same slide without restaggering it. Order the rows the way you want them to arrive.
- **Never in the artifact.** Print, the contact sheet, the `⤓` PDF and `verify` all draw the settled frame — motion cannot change what is measured, printed or exported.
- **Off is a first-class state.** `prefers-reduced-motion: reduce` turns every anim off; a deck must read exactly the same standing still.
- **Motion is punctuation, not decoration.** Animate the rows that carry the beat of the slide (title, then the two or three rows the audience should read in order). A slide where every row moves reads as noise — and a wall of `anim` is a review failure.
- Pair a row with its label (tile then caption, both with the same anim) so they arrive together instead of the labels landing four steps later.

## GIFS AND IMAGES
`img` takes a data: URI — an animated GIF plays as-is. The rule is the same as every other asset: **inline, or it does not ship.** A short cropped clip of a real interaction is worth more than a paragraph describing it; `docs/record-clips.mjs` shows the pattern — drive the deck with Playwright, film a model-space crop, encode with ffmpeg (`palettegen`/`paletteuse`, ≤ 48 colours, ~10 fps, ≤ 3 s), and write the base64 back into the model so the clip is a build product, not a screen capture. Budget ≈ 100 KB per clip; keep the whole file under ~1 MB. Give a clip row explicit `w`/`h` (parity measures rects) and `fit:'cover'`.

## VERIFICATION thresholds
| check | tool | pass |
|---|---|---|
| contract | `validate` | 0 errors (0 warnings with `--strict`) |
| self-contained | `verify` | no `http(s)` src/href, no loaders, no sockets |
| overflow | `verify` parity | `scrollWidth ≤ clientWidth + 1` on every text row |
| single line | `verify` parity | `nowrap` rows and imported single-line rows render 1 line |
| line count | `verify` parity | imported rows: rendered lines == source `_lines` |
| bounds | `verify` parity | every element inside the canvas |
| page errors | `verify` | none |
| AE | `verify --refs` | `< 0.5%` pixels at `-fuzz 2%` (set `--threshold`) |

## ANTI-PATTERNS (each is a review failure)
- **Implicit padding / chrome on plain text.** A text row is text. Padding, radius, pre-wrap belong to `box`/`tile` or explicit `p`. Never fake a card with a padded text row.
- **Per-slide chrome drift.** A footer or mark redrawn on each slide with slightly different x/y. It is one master row; slides fork only when a human edits.
- **Size overrides.** `size:18` on a Body row "because it needs to be bigger". Change the role, or use the right role (`Title` for a display headline, `H1` for a slide title). Same for `font`, `lh`, `ls`, `mono`.
- **Wrapping labels.** Chips, axis labels, step numbers, supertitles that wrap to two lines. `nowrap:1` + width, or `w:'auto'`. Parity fails these on purpose.
- **Hardcoded counters.** `"3 / 9"` typed into a row. The footer master renders the counter.
- **Font pickers / ad-hoc colours.** No per-row font families, no rainbow of hexes. Tokens and roles only; literal hex is for chart series.
- **Walls of text.** More than ~60 Body words on a 16:9 slide, or Body wrapping past 3 lines. Split the slide.
- **Network anything.** No webfonts, CDNs, remote images. Images and clips are data: URIs; fonts are installed or system stacks.
- **Motion everywhere.** Every row carrying `anim`, or an anim invented outside the four. Motion marks the reading order of a few rows; the rest are already there.
- **Unverified hand-off.** A deck without a `VERIFY PASS` is not done.

---

## WORKED EXAMPLES

### A — outline → 16:9 slides (`examples/quarterly-update`)
Input (`brief.md`): "Q3 in one page — 1,240 signups (+18%), $86K MRR (+11%), 4.6 CSAT, 12 days TTV; signups Jul 380 · Aug 410 · Sep 450; next: onboarding v2, 3 design partners, hire support." Style: warm paper, serif headlines.

Slide plan: `cover · title` → `numbers · content · 4 Stat tiles + Labels` → `signups · content · 3 bars` → `next · content · 3 tiles`.

Model (the numbers slide):
```json
{ "name": "numbers", "layout": "content", "els": [
  { "slot": "supertitle", "text": "The numbers" },
  { "slot": "title", "text": "Growth held. Time-to-value halved." },
  { "x": 60,  "y": 170, "w": 195, "h": 110, "tile": 1, "role": "Stat", "text": "1,240" },
  { "x": 60,  "y": 292, "w": 195, "role": "Label", "align": "center", "text": "Signups · +18%" },
  { "x": 60, "y": 360, "w": 840, "role": "Body", "text": "Signups and revenue grew on the same curve as Q2. …" }
]}
```
```
node bin/validate.mjs examples/quarterly-update/model.json
node bin/create.mjs --model examples/quarterly-update/model.json --style examples/quarterly-update/style.json --out q3.html --format slides
node bin/verify.mjs q3.html
```

### B — social post → carousel (`examples/launch-carousel`)
Input: four beats (hook, problem, how, CTA). Style inferred from product screenshots: near-black, violet accent. Canvas 1080×1080, so roles scale ×1.9 (Title 120, H1 72, Body 30, Stat 120).

One layout `card` with `supertitle` at y 120 and `title` at y 170; the "how" card is three `box` rows in a row.
```json
{ "format": "carousel", "layouts": { "card": { "supertitle": { "x": 90, "y": 120, "w": 900, "role": "Supertitle" }, "title": { "x": 90, "y": 170, "w": 900, "role": "H1" } } },
  "master": [ { "id": "foot", "footer": 1, "x": 690, "y": 990, "w": 300, "align": "right", "role": "Label", "text": "swipe" } ],
  "slides": [ { "name": "hook", "layout": "card", "els": [ { "slot": "supertitle", "text": "New" }, { "slot": "title", "text": "Your docs are a deck now." } ] } ] }
```
```
node bin/create.mjs --model examples/launch-carousel/model.json --style examples/launch-carousel/style.json --out carousel.html --format carousel
node bin/verify.mjs carousel.html
```
Experimental: 1:1 sizing, editing and one-page-per-card PDF work; there is no per-platform export (PNG per card) yet — print to PDF and split, or screenshot from `verify-out/`.

### C — doc → two-page one-pager (`examples/one-pager`)
Input: title, problem, three benefits, one number; page 2: three steps, pricing, contact. No brand → neutral light style in `style.json`. Canvas 816×1056 so roles scale ×0.75 (Title 48, H1 28, Body 12).

Each page is a slide on layout `page` (supertitle y 72, title y 92, 72 px margins). Page 2 starts a new slide — text does not flow.
```
node bin/create.mjs --model examples/one-pager/model.json --style examples/one-pager/style.json --out one-pager.html --format document-letter
node bin/verify.mjs one-pager.html
```
Print zoom is exactly 1 for `document-*` formats: the page IS the canvas.

### D — finished HTML pages → model (`bin/import-html.mjs`)
When the source is already HTML at a fixed viewport (mockups, a static site's pages):
```
node bin/import-html.mjs --w 1600 --h 900 --out model.json --shots shots/ 'pages/*.html'   # --shots writes shots/<page>.png
node bin/create.mjs --model model.json --out deck.html --space 1600x900
node bin/verify.mjs deck.html --refs shots/
```
The importer lifts recurring chrome into `master`, heading signatures into layout slots, style signatures into the eight roles (a cover headline larger than any content `H1` becomes `Title`), and records `_lines`/`nowrap` intent so parity can compare against the source. `--shots` screenshots each page at the model viewport (before the walker touches the DOM) to `shots/<page-basename>.png` and records the paths under `report.refs` — that is exactly the filename `verify --refs` resolves. Read `model.report.json`: `conflicts` lists rows whose size was snapped to their role — those are the source's own inconsistencies, decide whether to keep the snap.
