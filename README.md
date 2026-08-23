# decklet

Agent-generated, brand-true, real-time editable presentations and assets — one portable HTML file, no office suite.

**What it is.** A slide engine where the deck is a JSON model and the renderer is the editor. `create` turns `model.json` into one self-contained `deck.html`: open it from disk, drag and retype in place, present fullscreen, print to PDF. No install, no server, no network request, ever.

**Who it is for.** Agents (Claude Code, Codex, Cursor, any tool-using model) that must turn content into a deck a human will then edit. Humans get a file they can open and change; agents get a contract they can validate before a browser is involved.

**Inputs → outputs.**
- in: any content (outline, notes, markdown, transcript, data) + a format (`slides`, `carousel`, `document-letter`, `document-a4`) + a style (brand tokens + eight text roles, or the neutral default)
- out: `deck.html` — one file, ~40 KB, editable, printable, verifiable

**Zero dependencies.** The engine is plain HTML/CSS/JS in a single file. The CLI is plain Node ≥ 22. Playwright is an *optional* devDependency used only by `verify` and `import-html`.

**One file.** The model, the styles, the renderer and the editor ship inside the deck. Copy it, email it, commit it.

## For agents

Read [`SKILL.md`](SKILL.md) — it is the product. It defines the inputs, the process, the model and style contracts, verification thresholds, anti-patterns and three worked examples. The whole loop:

```
node bin/validate.mjs model.json                                   # contract check, no browser
node bin/create.mjs --model model.json --style style.json --out deck.html --format slides
node bin/verify.mjs deck.html [--refs shots/]                     # layout parity always; AE diff when refs exist
node bin/import-html.mjs --w 1600 --h 900 --out model.json 'pages/*.html'   # finished HTML → model
```

[`llms.txt`](llms.txt) is the machine summary and file map. [`deck.html`](deck.html) is the engine explaining itself — ten slides built from [`examples/explainer/model.json`](examples/explainer/model.json) by the same CLI.

## Guarantees

- **Single file.** Model + renderer + editor in one `.html`; nothing is fetched at runtime.
- **Zero network.** No webfonts, CDNs or remote images; images are data: URIs. The gate greps for it.
- **Editable.** Drag, ⌘-multi-select, double-click to retype, corner-nib resize, floating role/mark/colour toolbar (B/I/U/S, sub/sup, the deck's own swatches), undo that survives reload, contact sheet with grab-and-drag reordering.
- **Brand-true.** Eight text roles (Title, Supertitle, H1, H2, Body, Caption, Label, Stat) are the only source of font/size/leading; rows cannot override them. Chrome is one deck-wide master layer on a `margin` token. Tokens re-theme every deck.
- **PDF.** `⤓` writes a true slide-sized PDF inside the file (foreignObject → canvas → JPEG → PDF, zero dependencies); `⌘P` is the paper path with named Letter/A4 pages (Safari-safe), one page per slide. Safari's in-file raster path is unconfirmed — it falls back to print.
- **Verified.** `validate` (pure Node) + `verify` (layout parity in a real browser, AE pixel diff against references). A deck that fails parity is not done.

## Model snippet

```json
{
  "w": 960, "h": 540,
  "layouts": { "content": { "supertitle": { "x": 60, "y": 52, "w": 840, "role": "Supertitle" },
                            "title":      { "x": 60, "y": 76, "w": 840, "role": "H1" } } },
  "master": [ { "id": "foot", "footer": 1, "x": 660, "y": 500, "w": 240, "align": "right", "role": "Label", "text": "decklet" } ],
  "slides": [ { "layout": "content", "els": [
    { "slot": "supertitle", "text": "THE MODEL" },
    { "slot": "title", "text": "Every slide is rows in a JSON array." },
    { "x": 60, "y": 170, "w": 195, "h": 110, "tile": 1, "role": "Stat", "text": "1,240" },
    { "x": 120, "y": 340, "w": 70, "h": 60, "bg": "#2F4E7A", "bar": 1 },
    { "x": 730, "y": 200, "w": 150, "donut": 72 }
  ] } ]
}
```

A row is text by default; `box`, `tile`, `bar`, `line`, `donut`, `svg`, `img` are props on the same row. Roles come from `styles.roles` (or `style.json`); a row may set weight/colour/case, never size. Full reference: SKILL.md → MODEL CONTRACT.

## Feature matrix

| capability | status | notes |
|---|---|---|
| `slides` 16:9 (960×540, 1600×900) | supported | editing, contact sheet, present, PDF, verify |
| `carousel` 1:1 / `carousel-4x5` | experimental | sizing, editing, PDF work; no per-card PNG export |
| `document-letter` / `document-a4` | experimental | page = canvas, print zoom 1; text does not flow across pages |
| drag / multi-select / resize / undo | supported | undo history persisted per deck |
| inline text editing + B/I/U/S + colour runs | supported | stored as `html` on the row |
| roles · slots · master layer · footer counter | supported | see SKILL.md |
| bars, lines, donuts, tiles, boxes | supported | one row each, no SVG layer |
| SVG / raster images | supported | inline `svg`, data: `img` |
| entrance animation | supported | `anim:'rise'`, respects reduced-motion |
| contact sheet (select, reorder, dup, delete) | supported | 3-across live thumbnails; pointer-drag reorder (mouse + touch), also in present mode |
| fullscreen presentation | supported | F / ⛶, hover-peek HUD (pinned while a menu or the sheet is open) |
| PDF | supported | ⤓ → slide-sized PDF written in-file (Chromium verified; Safari unconfirmed → print fallback); ⌘P → paper, Letter/A4 named sizes |
| HTML pages → model | supported | `bin/import-html.mjs` (Playwright) |
| validate / verify | supported | parity mandatory, AE optional |
| PPTX / Google Slides export | no | out of scope |
| presenter view, notes | roadmap | |

## Repo map

```
deck.html            the engine + the explainer deck (built from examples/explainer)
template.html        the engine with an empty model — create.mjs fills it
bin/validate.mjs     model contract, pure Node
bin/create.mjs       model (+style) → deck.html; format presets
bin/verify.mjs       parity + AE + contract proof (Playwright optional)
bin/import-html.mjs  finished HTML pages → model.json (Playwright)
SKILL.md             the agent authoring skill
llms.txt             machine summary
examples/            explainer, quarterly-update, launch-carousel, one-pager (brief → model + style)
test/gate.test.mjs   engine + validator + create + import + live proofs
```

## Test

```
npm test            # node --test; live browser tests skip when Playwright is absent
npm run test:live   # same, after: npm i -D playwright && npx playwright install chromium
```

## Roadmap

- Document types: text flow across pages, running headers, real page numbering for `document-*`.
- Carousel export: one PNG per card from `verify`.
- Slide backend: each slide an entity with a revision log; decks composed from slides; published versions pin revisions (Fibery-style store).
- Presenter mode: speaker view + audience window synced over BroadcastChannel, no server.
- Redo, URL-hash deep links (`#4`), content-anchored annotations.

## License

MIT © Grunion
