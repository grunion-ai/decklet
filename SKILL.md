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
- **Text-fit.** A label that must stay on one line gets `nowrap:1` and enough `w` (≈ 0.55 × size × chars), or `w:'auto'` to hug. Chips/pills: `w:'auto'` + `p:'chip'` (+ `bg`/`bd`/`radius`); one that sits on a right edge takes `right:` instead of `x`. Body copy gets a `w` that yields ≤ 3 lines at the role's size.
- **Charts are rows.** A bar or line chart is one `chart` row (CHART ROW below) that `create` expands into bars, lines, dots and `Label` rows with the drawing rules applied — write the data, not the geometry. By hand, the same shape: bars `{x,y,w,h,bg,bar:1}` bottom-aligned on a baseline `line`; value labels as `Label` rows above, axis labels below. Donut: `{x,y,w,donut:72}` + a `Stat` row centred on it. Tiles: `{x,y,w,h,tile:1,role:'Stat',text}` + a `Label` row beneath.
- **Cards are groups.** There is no container row: a card is a tile plus its rows sharing one `group` — `{x,y,w,h,bg,bd,radius,group:'card1'}` and each text row inside it with `group:'card1'`, every row at its own canvas x/y. The human drags the card and the rows come along; you still position each row, once.
- **Colour.** Use `var(--accent)`, `var(--fg)`, `var(--muted)`, `var(--line)`, `var(--card)` so a style swap re-themes the deck; literal hex only for chart series.

### Step 3 — validate (no browser)
```
node bin/validate.mjs model.json --style style.json            # 0 errors required; read every warning
node bin/validate.mjs model.json --style style.json --strict   # warnings fail too — use before hand-off
```
**Always pass the same `--style` you will pass to `create`.** Text fit is only meaningful against the scale the deck will actually wear: without it the model is measured against the template's neutral roles, so `validate` can report 0 warnings on a model `create --style` then floods with overflow — and `verify` fails on. Omit `--style` only when there is none.

### Step 4 — create
```
node bin/create.mjs --model model.json [--style style.json] --out deck.html --format slides [--space 1600x900] [--title "…"] [--from prev.html]
```
Refuses an invalid model (`--force` to override while iterating). Stamps `deck.id` (born once, from the first model — the browser's storage namespace, stable across versions), `deck.rev` (this build's content hash), a `slide.id` on every slide and a row `id` on every row that has none — deterministic (`s1, s2… / r1, r2…`), so the same model builds byte-identically.

**Revising a deck a human has touched — `--from` is mandatory.** The deck file carries the human's edits (`/*LOG*/`) and its version history (`/*VERSIONS*/`). Run, in this order:
```
node bin/edits.mjs deck.html                       # 1. READ what the human changed — before you touch the model
node bin/create.mjs --model model.json --out deck.html --from deck.html   # 2. write the new version LAST
node bin/verify.mjs deck.html                      # 3. verify the result
```
`--from` inherits the deck id and the slide/row ids (by content, then by position — carry ids in `model.json` to make it exact), replays every logged edit onto the new model (**human wins**; a key you also changed is reported as a conflict and the human's value stays — put yours in the log's `conflict` if it matters), and pushes the file's previous state into the version history, so nothing the human did can be lost by a rebuild. The diff-and-migrate is the last thing you do, never the first: read the log, keep their geometry and text, then regenerate.

**The deck names itself.** `--title` wins, else the model's own `title`, else `decklet`; the winner is written into the model and the runtime titles the document from it. One short, human name — you are the one who writes it — becomes the browser tab, the `⤓` PDF filename and the `⌘S` save-a-copy filename.

### Step 5 — verify (mandatory)
```
node bin/verify.mjs deck.html [--refs shots/] [--out verify-out/] [--threshold 0.5] [--strict]
```
- **Contract** — always.
- **Layout parity** — always (needs Playwright): no text row overflows its box, every `nowrap` row renders one line, imported rows render their source line count, every element is inside the canvas, **no painted row is drawn through a text row**, zero page errors.
  Five shapes — four measured on real geometry (glyph rects and sampled strokes, never bounding boxes), the fifth asked of the compositor:
  1. **ink through text** — a line, curve or rule crossing a label's glyphs;
  2. **text straddling a container** — a label crossing a box/tile border, or hanging half out of the box meant to hold it;
  3. **an arrow head inside a fill** — a connector aimed at a target's centre instead of stopped on its edge (fix with `to:`);
  4. **text over text** — a title landing on a caption;
  5. **text under paint** (occlusion) — a text row hidden by an opaque row painted later in `els` (a tinted box, an image, a bar). The compositor is asked, not the geometry: `elementFromPoint` at five samples per line rect. Reported as `slide 2: row 3 (Label 'kicker') under row 9 (box)` — reorder `els` (paint first) or move the box; `--strict` fails it, otherwise it is a warning.
  Containment is not collision: text on a tile, a label inside a box, a slide backdrop all pass. A tint with no border is a backdrop and a circle/pill outline is decoration — neither is a container edge. A headless stroke crossing a card is routing, not a landing. `over:1` opts a row out of all five.
- **AE pixel diff** — when `--refs` exists (needs ImageMagick): `< 0.5%` of pixels differ at 2% fuzz. AE alone passes wrapped labels; parity is what catches them — that is why parity is not optional.

Fix the model, not the output. Re-run until `VERIFY PASS`. Attach `verify-out/results.json` to your report.

### Step 6 — hand-off notes for the human editor
Say, in this order:
1. Where the file is and that it opens from disk in any browser, no install, no network.
2. **HUD (the full set, left to right):** prev / next (chevrons) · autosave dot (green = the file has everything · amber = saved in this browser, N edits not in the file yet · red = nothing persists; click = ⌘S) · `+` (Text / Box / Slide) · contact sheet (grid icon; G or Esc) · spellcheck (spell-check icon; on by default, dims when off) · grid + guides + snap (grip icon, a 3×3 dot lattice; **off by default**, dims when off: a 16px dot grid over the slide — one dot per intersection — and this slide's layout lines — its slot edges, the content margin and the canvas mid-lines, every one seated on the grid — of which only the line being held shows, while it is held; a drag, a resize or a connector nib snaps to a layout line within 10px (a held line keeps its grip 4px further), else to the grid; a circle snaps by its centre; a connector end also snaps to the eight 45° rays out of its other end, same reach and hold measured across the ray — per browser, never in the model, never in present, print or the PDF) · save a copy (copy icon — only shown when the browser blocks storage) · versions (history icon: pin this version, restore an earlier one) · PDF (file-down icon) · fullscreen (maximize icon; F) · shortcuts (question mark). The icons are Lucide shapes with movingicons.dev motion — each playing once on load and once per hover, never on a loop.
   <!-- HUD: prev next autosave addbtn grid-btn spell snap savecopy vers pdf fs help -->
   This manifest is a contract: the gate compares it against the template, so the HUD cannot gain or lose a control without this line changing. While presenting, the HUD peeks back as a centred pill above the bottom edge — never over the page counter in the corner. On the contact sheet the HUD stays, pinned above the thumbnails, with prev/next/present disabled (the sheet is the navigator) and `+` adding a slide after the current one. Drag to move (a connector travels whole — both ends and every control point; a `group` travels whole and wears one dashed box), ⌘-click to multi-select (or to take one member of a group alone), drag from empty canvas for a marquee that takes every row it wholly contains (⇧ adds to the selection), double-click to retype, corner nib to resize, a connector's **point nibs** move one end (or a curve's control point) while a drag on its shaft moves it whole, ⌘Z to undo (persists across reloads), ⌘B / ⌘I / ⌘U mark a text selection or a whole selected row. Selecting text shows a floating toolbar: role segment, **B / I / U / S̶ / link** (marks never change size; the link takes http, https or mailto — an empty field unlinks), the deck's own colours as swatches, "Apply to all slides".
3. **Contact sheet:** live thumbnails 3-across; click / ⌘ / shift select, double-click opens, grab-and-drag reorders (mouse or touch — the other cells slide aside), ⌫ deletes (never the last), ⌘C ⌘V ⌘D ⌘Z. It also opens in present mode.
4. **PDF:** links become real `/Link` annotations, so a LinkedIn document post is clickable. the PDF button downloads a **true slide-sized PDF written inside the file** — no library, no server. Each slide is rasterised from its live DOM (SVG `foreignObject` → canvas at 2× → JPEG) onto a W×H pt page, so a 16:9 deck is a 16:9 PDF with no letterboxing; fonts must be local (they are — the deck loads none). Verified in Chromium; **Safari's `foreignObject` path is unconfirmed** — if rasterising throws or the canvas is tainted, the PDF button falls back to `print()`. **⌘P is the paper path:** one page per slide, each with its own background, on a **named** page size — Letter (A4 for `document-a4`) — because Safari ignores pixel `@page` sizes; the slide is zoomed to the printable width. Choose "Save as PDF" there for a paper-shaped file.
5. **Presenting:** F or the fullscreen button; chrome hides, backdrop = current slide's background, HUD peeks back when the pointer rests at the bottom edge and stays pinned while the + menu, the text toolbar or the contact sheet is open. Arrow keys / space advance; Esc opens the contact sheet to jump.
6. **Persistence, honestly.** Every edit autosaves to the browser's storage under `deck.id`, and is appended to the in-file **edit log** (slide id, row id, keys before → after). **⌘S saves the deck file itself:** in Chrome/Edge the first ⌘S asks for the file once (File System Access, remembered per browser), then every save — ⌘S and autosave alike — rewrites it in place with the model, the log and the versions inside, so an agent reading the file sees exactly what the human did. The dot is green only when the file has everything; amber counts the edits that have not reached it. Safari (and any browser without File System Access) cannot write the file: there ⌘S downloads a self-contained copy, and on `file://` Safari blocks storage entirely — the dot goes red at load and the Save-a-copy button appears. A live text edit or a drag in flight is committed when the tab hides or unloads, so a refresh mid-edit loses nothing.
   **Position:** a new window opens on slide 1; a refresh, and a new version of the file, keep the slide you were on — by slide id, so inserting slides above does not move you. A stored working copy is trusted only on the same `rev`; a newer file wins as the base and the browser replays its own edit log onto it (human wins, conflicts flagged on the entries), so an agent's rewrite neither hides its changes nor drops the human's.
   **Versions:** the history control lists every version in the file — one per agent write (`create --from`), one per ⌘S, one per pin — and restores any of them (the state you leave is pinned first, so a restore is reversible). Capped at 20.
7. To revise an edited deck, run `node bin/edits.mjs deck.html` to read the log, then `create --from deck.html` (Step 4). Everything a human applies in the editor — geometry, text, links, arrows — round-trips that way; the console `copy(JSON.stringify(deck))` still works for a raw model.
8. What you inferred (style, layout choices) and anything marked experimental.

---

## MODEL CONTRACT

Top level:
| prop | type | default | example |
|---|---|---|---|
| `w`, `h` | number | from format | `960`, `540` |
| `format` | enum | `slides` | `"carousel"` |
| `page` | `letter`\|`a4` | from format | set by create |
| `title` | string | `decklet` | `"Q3 update"` — tab title + `⤓`/`⌘S` filename; `--title` overwrites it |
| `lang` | BCP 47 tag | `en` | `"de"` — the dictionary the browser's spellcheck uses on the canvas; optional |
| `id` | string | content hash, by create | the deck's identity: the browser's storage namespace, kept across versions by `--from` |
| `rev` | string | content hash, by create | this build; the browser trusts a stored working copy only when its `rev` matches the file's |
| `styles.roles` | `{Role: treatment}` | template neutral | see STYLE CONTRACT |
| `styles.margin` | number | `round(w × 0.06)` | content inset chrome sits on: the footer counter's right edge = `w − margin` |
| `styles.pad` | `{token: css}` | `{chip:'3px 8px', pill:'5px 12px'}` | `p:'chip'` on a row |
| `slots` | `{slot: geometry}` | `{}` | deck-scope slots under every layout (`{supertitle:{x:60,y:52,w:840,role:'Supertitle'}}`) |
| `layouts` | `{name: {slot: geometry}}` | `{}` | `{content:{title:{x:60,y:76,w:840,role:'H1'}}}` |
| `master` | row[] with `id` | `[]` | `[{id:'foot',footer:1,…}]` |
| `slides` | slide[] (≥1) | — | |

Slot geometry: `{x, y, w, h?, role}` — or `right` in place of `x`; a slotted row's own `right` overrides the slot's `x` the way its own `x` would.

Slide: `{id?, name?, layout?, bg?, hide?: masterId[], els: row[]}` — `id` (unique per deck; `s1, s2…` when create stamps it) is how a tab remembers the slide it was on and how the edit log addresses a slide. Rows carry `id` (unique per slide; `r1, r2…`) for the same reason and for `to:`/`from:`.

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
| `href` | url | — | http/https/mailto only. One inset anchor over the whole row (a painted CTA box + its label each carry it); live in present mode, a real `/Link` annotation in the `⤓` PDF |
| `over` | 1 | — | declares a deliberate overlay: `verify`'s collision check leaves this row (and what it crosses) alone |
| `donut` | 0–100 | — | ring, `w` = diameter, `color` = fill |
| `svg` | string | — | inline SVG markup (no script, no external href) |
| `icon` | name | — | a Lucide icon by name (see GRAPHICS; `--icons` lists them) — expands to an `svg` row at create, `color` paints it |
| `img` | data: URI | — | image; `fit`, `pos` = object-fit/position |
| `anim` | `rise`\|`fade`\|`pop`\|`wipe` | — | entrance motion on slide entry, staggered 120 ms in model order (see MOTION) |
| `chart` | `{mark, data, …}` | — | a bar or line chart drawn into this row's x/y/w/h at create time (CHART ROW) |
| `css` | string | — | raw CSS escape hatch — validator warns |
| `group` | string | — | rows on a slide sharing one `group` are one unit in the editor: drag, nudge and marquee move them together, the selection draws one box round them, ⌘-click takes a member alone. Every row keeps canvas-space x/y — nothing is relative. A `chart` row's expansion shares one group; the library's kpi tiles, steps, timeline events and cta button are born grouped |
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
- The eight roles are the whole type system — exactly these names: `Title` (display headline for cover/closing slides), `Supertitle` (kicker), `H1` (content-slide title), `H2`, `Body`, `Caption`, `Label` (mono, uppercase — chips, axis labels, footer), `Stat`. No H3, no Subtitle. One allowance: **`Stat2`**, an optional ninth role for the KPI tile — a hero "63%" and a card "$1.2M" cannot share one size. A style may define it; when it does not, `create` derives it from `Stat` at **0.6** (size, line height, tracking) and only when a row or slot asks for it, so a deck that never uses `Stat2` never carries it. The `kpi-grid` tiles wear it; the hero `stat` layout keeps `Stat`. A role is a complete treatment: `font`, `size`, `weight`, `lh`, `ls`, `color`, optional `tt`. One font and one size per role — never two sizes of "Body". A row may add `weight`, `color`, `tt`, `italic`; it can never carry `font`, `size`, `lh`, `ls` or `mono` (the validator rejects it, the engine ignores it).
- `margin` is the content inset the chrome sits on (footer counter's right edge, default 6% of `w`). Set it to match your layouts' left edge.
- The model's own `styles.roles` win over `style.json` per role; a model with no roles inherits the template's neutral scale.

## LAYOUTS (slots)
- `layouts.<name>.<slot> = {x, y, w, h?, role}`; a slide opts in with `layout:'<name>'`.
- `slots.<slot>` (deck scope) applies under every layout — use it for a supertitle shared by all.
- A slotted row may carry local x/y/w/h overrides; edit the slot in the model to move every slide at once.
- Conventional slot names: `supertitle`, `title`, `body`, `body2`. Conventional layouts: `title` (cover), `content`, `section`.
- A slot may carry any row treatment besides geometry and role — `tile:1`, `bg`, `p:'chip'`, `align`, `nowrap`, `italic`, even `line` — and the engine spreads it onto the bound row. A roleless slot with `h` is paint or media: `{slot:'rule'}` alone draws it.

## LAYOUT LIBRARY

Thirty-one named layouts ship with the engine (`lib/layouts.mjs`), in the same shape as a `layouts` entry. Name one on a slide the deck does not define and `create` merges it into `deck.layouts`, scaled from its 960×540 cut to the canvas (1600×900 = ×1.67). Print the catalogue — name, group, density, use, slots — with:
```
node bin/validate.mjs --layouts
```
Read that instead of inventing geometry. The library is an accelerant, never a fence: a slide may use a library layout, a deck-defined layout, or free rows, and may mix library slots with extra free rows on the same slide (`layout:'kpi-grid'` plus a caption and a rule at y 400 is a normal slide). A deck-defined layout of the same name wins. A slotted row still takes its own x/y/w/h — the `override` path — so a brand with a display role taller than the neutral scale (Title 64/68, Stat 40/44 — what the library is cut for) nudges a slot without redefining the layout. An unknown name is still an error, and the error lists the library.

| group | layout | density | slots |
|---|---|---|---|
| openers | `cover` | speaker | supertitle · title (Title) · body · caption |
| | `agenda` | reading | supertitle · title · n1–n5 (Label) + item1–item5 (Body) |
| | `section` | speaker | number (Label) · title (Title) · body |
| chrome | `content` | reading | supertitle · title (H1) — the template library's title chrome, the canvas free |
| | `title` | speaker | supertitle · title (Title, lower half) — a cover or divider |
| text | `statement` | speaker | title (Title) · caption |
| | `fact` | speaker | stat (Stat) · label · body |
| | `quote` | speaker | quote (H2, italic) · attribution (Caption) |
| | `two-cols` | reading | supertitle · title · left · right (Body) |
| | `two-cols-header` | reading | supertitle · title · header (H2) · left · right |
| visuals | `image-left` | reading | image (400×320 media) · supertitle · title · body |
| | `image-right` | reading | supertitle · title · body · image |
| modern | `bento-grid` | reading | supertitle · title · hero (paint) · hero-label · hero-value (Title) · hero-chart (376×160 media) · card1–2 (paint) + card1–2-label + card1–2-value (Stat) · action (accent paint) · action-label · action-body |
| | `image-hero-overlay` | speaker | image (full-bleed media, give it `img`) · scrim (paint) · label · title (Title) · caption — `hide` the footer on the slide |
| | `image-split` | speaker | image (440×540 media, right) · label · title (H1) · body · button (paint, give it `href`) · button-label (Label, same `href`) |
| | `annotated-shot` | reading | supertitle · title · shot (520×270 media) · callout1–3 (paint) + callout1–3-text (Body) + -leader (line) + -dot |
| | `three-up-cards` | reading | supertitle · title · card1–3 (paint) + card1–3-number (Label) + -head (H2) + -rule + -body |
| | `dashboard-composite` | reading | supertitle · title · kpi1–4 (paint) + kpi1–4-value (Stat) + -label · chart (500×180 media) · panel (paint) · panel-label · panel-body |
| | `table-insight` | reading | supertitle · title · table (500×210 media frame: place the table's rows inside it) · panel (paint) · panel-label · panel-body · panel-rule · panel-next (Label) |
| | `proof-strip` | reading | supertitle · title · logo1–5 (paint, give them `img`) + logo1–5-name (Label) · rule · stat1–3 (Stat) + stat1–3-label |
| | `team-grid` | reading | supertitle · title · photo1–4 (195×180 media, give them `img`) + name1–4 (H2) + role1–4 (Caption) |
| numbers | `kpi-grid` | reading | supertitle · title · kpi1–3 (tiles) · kpi1–3-delta (chips) · kpi1–3-label · body |
| | `kpi-grid-4` | reading | the same with four 195px tiles |
| | `stat` | speaker | supertitle · title · stat (the deck Stat size, centred) · caption |
| | `chart` | reading | supertitle · title · chart (840×276 media) · takeaway (Body) · source (Caption) |
| | `comparison` | reading | supertitle · title · left-head · right-head (H2) · left · right |
| diagrams | `process-steps` | reading | supertitle · title · n1–n4 (Label) · step1–step4 (tiles, Body) · body |
| | `diagram` | reading | supertitle · title · figure (840×320 media frame: place the figure's rows inside it) · caption (Caption, the claim) |
| plans | `timeline` | reading | supertitle · title · rule (paint) · d1–d4 (dots) · t1–t4 (Label) · e1–e4 (Body) |
| closers | `cta` | speaker | title (Title) · body · button (paint, give it `href`) · button-label (Body, same `href`) |
| | `end` | speaker | title (Title) · body · caption |

Density is defined in DENSITY below: a **speaker** (fluffy) slide carries ≤ 3 points, a **reading** (dense) slide up to 8 with its own context. Every layout with H1 title chrome also carries the four dense slots `subtitle` · `note` · `source` · `legend` (unbound they draw nothing). Delta chips are `Label` on a `chip` pad in `var(--box)`, coloured `var(--ok, var(--accent))`; a falling delta sets `color:'var(--bad, var(--accent))'` on the row — the deck's `ok`/`bad` tokens if the style defines them, else the accent.

Picking a layout by what the content is:

| the slide's content is… | layout |
|---|---|
| the deck's name and promise | `cover`; `end` closes |
| what the deck will cover | `agenda`; `section` between parts |
| one claim | `statement`; with a number in it → `fact`; the number alone → `stat` |
| someone's words | `quote` |
| two bodies of text, a lede over two columns | `two-cols`, `two-cols-header` |
| a picture and a paragraph | `image-left` / `image-right` |
| three or four numbers with movement | `kpi-grid` / `kpi-grid-4` |
| a series with real numbers | `chart` — no numbers, no chart layout |
| A against B | `comparison` |
| steps in order | `process-steps`; dated → `timeline` |
| the ask | `cta` |

## TEMPLATE LIBRARY
Fifty-nine finished slides ship with the engine (`lib/templates.mjs`, sources in `lib/templates/cat-*.mjs`): the candidate sheet surveyed across the open-source slide catalogs and promoted whole (2026-09-07). A template is a layout PLUS sample rows — an issue tree, a Sankey, a scorecard, a bento grid — so the agent binds content instead of drawing. Print the catalogue — id · tier · density · note, then every text key with its sample — with:
```
node bin/validate.mjs --templates
```
A slide names one and fills its keys: `{template: 'three-up-cards', fill: {t1: 'What you get', t2: 'Three things, one price.', t3: '01', …}}`. Every text row of the template is a key, `t1`…`tn` in row order; a key left out keeps the sample text (so fill them all before shipping). `create` expands the slide into the template's rows, scaled from the 960×540 cut to the canvas, sets the slide's `layout` to the template's chrome (`content` or `title` from the library — a deck-defined layout of that name wins) and its `density`, and keeps any free `els` after the template rows. An unknown template or fill key is a validate error listing what exists. A template is an accelerant like a layout: edit the rows it produced, add rows beside them, or draw free — nothing here is a fence.
Tiers: **core** (in 4+ surveyed catalogs), **standard** (consulting catalogs), **fringe** (dataviz literature, rare on slides). Categories: Narrative · Numbers · Comparison · Frameworks · Process · Charts · Modern.
## DENSITY
Two named densities, defined in `lib/layouts.mjs` (`DENSITY`) so "dense" and "fluffy" build the same deck every time. A deck says `density: 'speaker' | 'reading'`; a slide may carry its own. `validate` warns on every slide that misses its density's shape; an unknown density is an error.
| density | aka | for | the slide carries | max |
|---|---|---|---|---|
| `speaker` | **fluffy** | a presented deck — the speaker carries the rest | supertitle · title · one figure, number or ≤ 3 points · a caption at most | 3 points · 40 words |
| `reading` | **dense** | a leave-behind read without a speaker — the slide carries its own context | supertitle · title · `subtitle` (the claim in one sentence) · the figure or the points · `note` (what to make of it) · `source` · `legend` · footer naming the deck | 8 points · 140 words |
The dense chrome is four optional slots every H1-titled library layout carries (`DENSE`): `subtitle` (H2, muted, under the title), `note` (Body, muted, two lines above the foot), `source` (Caption, left foot), `legend` (Label, right foot via `right`); the subtitle is `nowrap`, one sentence, and parity fails a wrap. A layout that cannot seat one says so (`dense: {note: false}` on `chart`, whose `takeaway` is the note; all four on `diagram`). A reading slide binds at least one; a speaker slide leaves them alone. "Points" are the text rows that are not chrome (not supertitle/title/subtitle/note/source/legend/caption, not Label). The template library carries a density per template (`--templates` prints it): the speaker ones are covers, dividers, quotes, statements, hero numbers, the donut and gauge, the cycle and the tree; everything with a table, a grid or a series is reading.
## GRAPHICS
Five kinds of picture, one rule each. Colour is always a token; nothing loads from the network.
- **Icons** — `{icon: 'shield-check', x, y, w: 24, h: 24, color: 'var(--accent)'}`. The set is Lucide (ISC), 169 names, `node bin/validate.mjs --icons` prints them; `create` inlines the svg (stroke `currentColor`, so `color` paints it) and only the icons a deck uses reach the file. One icon per point, on the 24 grid (24/32/40 px), left of its label on the label's cap line, the same weight throughout. An icon says what the label says — never decoration, never a second idea, never a filled emoji.
- **Glyphs** — a number in a circle, a letter chip, a status dot: rows, not images. A step glyph is a `dot` (or a `radius:'50%'` box) with a `Label` centred in it (`valign:'middle'`); a status dot is a 10px `bg` circle in `var(--ok)`/`var(--bad)`. Group the glyph with its text.
- **Images** — `img` is a data: URI, `fit:'cover'`, explicit `w`/`h`, one per slide, never stretched, never behind text unless a tint band (`bg` with `op`) sits between. Budget ≈ 100 KB an image, the file under ~1 MB. Photographs carry the `image-left`/`image-right`/`image-hero-overlay`/`image-split` layouts; a screenshot gets `annotated-shot` with callout rows.
- **Figures** — nodes, connectors, timelines, trees as rows (the diagram helper, the `diagram` layout, the framework and process templates), so every box and edge stays editable. An `svg` row is for a fill the engine has no primitive for (a Sankey ribbon, an area band) — never for text, never for a whole figure.
- **Clips** — a short GIF of a real interaction (`docs/record-clips.mjs`), ≤ 3 s, ≤ 48 colours, ~10 fps; the same inline rule.
## CHART ROW

`{x, y, w, h, chart: {mark: 'bar'|'line', data: [{label, value, compare?, muted?, text?}], encoding?: {max, min}, annotations?: [{at, text}], source?}}` — or `{slot:'chart', chart:{…}}` on the `chart` library layout. `create` expands it into the ordinary rows you would otherwise hand-build (bars, `line` segments, dot rects, `Label` rows), so the deck stays hand-editable and the runtime draws no charts; `validate` refuses a chart with fewer than two points, a non-numeric value, or no numbers at all — no numbers, no chart. The drawing rules are baked in and are the rules a reviewer holds a hand-built chart to:

- **Bars start at zero.** Every bar stands on the baseline; `encoding.min` is honoured on a line only (a rate hovering at 58–66 need not be plotted from zero).
- **One explicit scale with a max label.** The top of the plot is `encoding.max` or the smallest 1·1.2·1.5·2·2.5·3·4·5·6·8 × 10ⁿ above the data, stated as a `Label` tick at the left; `0` (or `min`) sits at the baseline.
- **Direct value labels, no legend.** Every point or bar carries its number in `Label`, `var(--fg)`; `text` on a datum overrides the formatting (`"$1.2M"`).
- **Grey dashed baseline.** `var(--muted)`, 1px, `dash:1`.
- **Monochrome depth.** The first series is the full accent; a `compare` value draws a second bar or stroke at 60% opacity; an item flagged `muted:true` goes grey so the takeaway reads in the chart.
- **A line is one stroke with dots.** 2.5px accent segments, 8px dots. Value labels beside a rising stroke are placed automatically at the first of six spots (above, above-left, above-right, then below) that touches no stroke, dot, leader or other label — the offset the branded deck had to find by hand.
- **Annotations are words at a point.** `{at: index, text}` turns that dot green (`var(--ok, var(--accent))`) and hangs a hairline leader from a `Caption` at the top of the box; the point's own value label moves below to keep the leader clear.
- **Source line in Caption at the bottom** of the box, from `source`.

After `create`, the rows are the chart: drag a bar, retype a value label, delete a dot — the model round-trips like any other row. To change the data, edit the `chart` row in the model and re-create.

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
| contract | `validate --style` | 0 errors (0 warnings with `--strict`) |
| self-contained | `verify` | no `http(s)` src/href, no loaders, no sockets |
| overflow | `verify` parity | `scrollWidth ≤ clientWidth + 1` on every text row |
| single line | `verify` parity | `nowrap` rows and imported single-line rows render 1 line |
| line count | `verify` parity | imported rows: rendered lines == source `_lines` |
| bounds | `verify` parity | every element inside the canvas |
| collision | `verify` parity | no ink through glyphs, no text straddling a container edge, no arrow head inside a fill, no text over text (`over:1` opts out) |
| occlusion | `verify` parity | no text row under an opaque row painted later in `els` (`--strict` fails, else warns) |
| page errors | `verify` | none |
| AE | `verify --refs` | `< 0.5%` pixels at `-fuzz 2%` (set `--threshold`) |

## CONNECTORS — the shapes a deck may draw

Ruled on two connector probes. `validate` warns on the ones it can measure; the rest are here. A deliberate exception is
declared with `waive:1` on the row — never by ignoring the warning.

**A connector is a stroke with a head.** Every rule below is about a line that *points at* something. A headless stroke is
a rule, an underline, an annotation leader, a chart series or decoration — it has no target, so none of these apply to it
and `validate` says nothing about it. That boundary was ruled by hand (G1's 1.5px *with* a head rejected; H5's 1px hairline
leader accepted), and it is what keeps the warnings worth reading: a validator that flags a chart for being diagonal
teaches you to ignore it. A headed stroke under 40px is an icon, not a run between boxes, and is exempt too.

| rule | do | not |
|---|---|---|
| **Straight runs are orthogonal** | horizontal, vertical, right-to-left | a diagonal — draw an elbow of two orthogonal segments *(warned)* |
| **S-curves need room** | a channel of **96px or more** | squeezing a curve into a tighter channel — re-cut the layout. A harder bend does not rescue it *(warned)* |
| **Control points** | 50% or 90% of the run, or straight out perpendicular (vertical-out / horizontal-in) | 25% of the run, past the endpoint, or a quarter turn *(first two warned)* |
| **Termination** | leave air — `gap` 10 is the default; `to:`/`from:` applies it | touching a border or landing inside a fill *(warned + a `verify` failure)* |
| **Even air** | the same gap at both ends | 4px at one end and 16px at the other *(warned)* |
| **Weight** | **2.5px or heavier** for a headed connector | 1.5px with a head. A *headless* annotation leader may be a 1px hairline *(warned)* |
| **Fan-out** | two S-curves from one edge, or straight diagonals / elbows when the geometry is orthogonal | a **shared stub** — a segment that feeds a point two connectors leave from, even with matched tangents *(warned)*. Two curves straight off one point, with nothing feeding it, is fine |
| **Entry** | enter the target on the face the connector comes from | top-edge entry, or a back-edge return to the side it left |

`dash` and `head` are engine features, not hand-work: never fake a dash with a `repeating-linear-gradient` on `bg` (it
cannot know the run length, so the last dash is sliced, and it silently eats the head), and never mock a dot or bar
terminator out of extra rows (they land off centre).

## ANTI-PATTERNS (each is a review failure)
- **Implicit padding / chrome on plain text.** A text row is text. Padding, radius, pre-wrap belong to `box`/`tile` or explicit `p`. Never fake a card with a padded text row.
- **Per-slide chrome drift.** A footer or mark redrawn on each slide with slightly different x/y. It is one master row; slides fork only when a human edits.
- **Size overrides.** `size:18` on a Body row "because it needs to be bigger". Change the role, or use the right role (`Title` for a display headline, `H1` for a slide title). Same for `font`, `lh`, `ls`, `mono`.
- **Wrapping labels.** Chips, axis labels, step numbers, supertitles that wrap to two lines. `nowrap:1` + width, or `w:'auto'`. Parity fails these on purpose.
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
node bin/validate.mjs examples/quarterly-update/model.json --style examples/quarterly-update/style.json
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
