# Roadmap

decklet after 0.5.0: the plan, and the order it lands in.

**Just shipped (0.6.0, 2026-09-07):** grid + guides + snap in the editor (a HUD toggle, 16px lattice, magnetic guides), and the expanded template pack: 58 templates and 22 layouts, one per slide, grouped by kind at [library.html](https://grunion-ai.github.io/decklet/library.html). Neither is on this board any more.

**Just shipped (unreleased on main, 2026-09-12):** the Library & editor review, eight of ten epics — L1 the sheet keeps its scroll and patches cells in place (#34, #36), L2 the ⤓ export counts `n / N` (#39), L3 the counter owns the corner (#43), L4 one foot band on the sheet (#45), L5 sample photos, a screenshot and a GIF (#41), L6 placeholder copy across six fictional companies (#40), L9 the nine figures as engine templates (#37, #44), L10 five style kits and a Styles section (#38, #42). The sheet is 130 slides. Off the board; L7 stays. **0.9.0 (2026-09-12):** the version history left the file for weave and autosave-everywhere took its place — see L8.

Five lanes carry new work: functional speaker notes, media and links, a deck you can read and present on a phone, more document formats, and more export targets. A sixth lane, `Platform & release`, clears the ground for them.

The one-file rule has not moved. A deck is one self-contained HTML file: no build step, no server, no network request at open time. Every epic here therefore ships as inline JS or CSS in `template.html`, or as a build-time transform in `bin/`. The rule enforces itself, because `bin/verify.mjs:26` fails the gate on any external `src`, `href`, `@import`, `fetch` or `WebSocket`.

---

## How to read this

### Levels

| Level | Means | Size |
| --- | --- | --- |
| **Initiative** | The whole plan. There is exactly one: decklet 1.0. | n/a |
| **Epic** | A shippable capability someone can name. | 2 to 6 weeks |
| **Story** | One PR. Lands, gets gated, gets merged. | a sitting to a few days |

These are Jira's sizes. Read them one rung up if SAFe is your habit.

### Lanes

Nine lanes, one per product area. A lane groups epics for reading; it sets no owner and caps no work in progress.

`Platform & release` · `Notes & presenting` · `Media & links` · `Mobile & touch` · `Documents & formats` · `Export` · `Library & editor` · `Usability` · `Getting started`

### Horizons

**Now / Next / Later.** The columns carry confidence. Confidence rises as an epic moves Later to Next to Now, and a Later estimate can be off by 4x either way, so a Later epic gets a t-shirt size and a goal. Nothing here has an external or contractual deadline, and nothing here is dated.

### Sizes

Each letter is anchored to a day count, so two authors' `M`s mean the same thing.

| Size | Days | Shape |
| --- | --- | --- |
| XS | 0.5 or less | one file, one assertion |
| S | 1 to 2 | one PR, one subsystem |
| M | 3 to 5 | touches 3 or 4 surfaces plus a gate |
| L | 1 to 3 weeks | a new subsystem, or a rewrite of an existing one |
| XL | 3+ weeks | carries an unresolved design question |

### Maturity and status

Maturity uses the ladder the README feature matrix already implies: **experimental → beta → supported**. Status uses five values: **Planned · In progress · At risk · Delayed · Done**. "At risk" means a credible issue could change the outcome, not that the work is late.

### Ranking

Epics rank by **ICE**: Impact x Confidence x Ease, each 1 to 10, multiplied, with Ease inverted from effort so 10 is easiest. Scores are in the table under the board.

---

## The board

| Lane | Now | Next | Later |
| --- | --- | --- | --- |
| **Platform & release** | P1 Contract hygiene `S`<br>P2 Model foundations `S` | P3 Growth-aware parity `M` | P4 Engine-version stamp `S` |
| **Notes & presenting** | N1 Notes as data `M` | N2 Presenter view `L` | N3 Notes to PPTX `S` |
| **Media & links** | V1 Images in the editor `M`<br>V3 Link behaviour `S` | V2 Video and GIF rows `M` | V4 Media budget and the PDF `S` |
| **Mobile & touch** | M1 Read it on a phone `S` | M2 Present from the phone `S` | M3 Touch editing `L` |
| **Documents & formats** | D1 Format presets `S` | D2 Aspect-aware composition `XL` | D3 Real documents `XL` |
| **Export** | X1 Cheap wins `S` | X2 Searchable PDF `M` | X3 PPTX export `L` |
| **Library & editor** | L7 Spellcheck, the rest `M`<br>L11 Type on the sheet `S` | | |
| **Usability** | U9 A `--bad` token in every style `XS`<br>U10 Warn before the browser fails `S` | U8 Two axes on the sheet: look × ladder `L` | |
| **Getting started** | S6 A kit must not collide with the chrome `S`<br>S7 The catalogue says what a template draws `M`<br>S8 Print a slice of the catalogue `S`<br>S9 The first build should not be thrown away `XS` | | |

### ICE scores

| Epic | I | C | E | Score | Horizon |
| --- | --- | --- | --- | --- | --- |
| P2 Model foundations | 9 | 10 | 9 | **810** | Now |
| V3 Link behaviour | 8 | 9 | 9 | **648** | Now |
| V1 Images in the editor | 8 | 8 | 7 | **448** | Now |
| V4 Media budget and the PDF | 5 | 8 | 8 | **320** | Later |
| V2 Video and GIF rows | 7 | 7 | 6 | **294** | Next |
| M1 Read it on a phone | 9 | 9 | 8 | **648** | Now |
| D1 Format presets | 7 | 9 | 9 | **567** | Now |
| X1 Cheap wins | 7 | 9 | 9 | **567** | Now |
| P1 Contract hygiene | 6 | 10 | 9 | **540** | Now |
| N1 Notes as data | 9 | 9 | 6 | **486** | Now |
| M2 Present from the phone | 7 | 8 | 8 | **448** | Next |
| X2 Searchable PDF | 8 | 8 | 6 | **384** | Next |
| P4 Engine-version stamp | 5 | 8 | 8 | **320** | Later |
| P3 Growth-aware parity | 6 | 8 | 6 | **288** | Next |
| N3 Notes to PPTX | 4 | 7 | 7 | **196** | Later |
| N2 Presenter view | 8 | 8 | 3 | **192** | Next |
| X3 PPTX export | 8 | 6 | 3 | **144** | Later |
| D2 Aspect-aware composition | 7 | 6 | 2 | **84** | Next |
| D3 Real documents | 8 | 5 | 2 | **80** | Later |
| M3 Touch editing | 6 | 5 | 3 | **90** | Later |
| L7 Spellcheck, the rest | 8 | 7 | 6 | **336** | Now |
| L11 Type on the sheet | 7 | 8 | 7 | **392** | Now |
| U1 `w`/`h` default in validate | 8 | 10 | 10 | **800** | Now |
| U6 Counter regression | 9 | 9 | 9 | **729** | Now |
| U3 A width warning is a failure | 7 | 10 | 10 | **700** | Now |
| U2 The catalogue says what fills | 8 | 9 | 8 | **576** | Now |
| U4 Ratings are fill keys | 8 | 9 | 7 | **504** | Now |
| U5 The missing starting rungs | 9 | 9 | 6 | **486** | Now |
| U7 SKILL.md: authoring and editor apart | 8 | 8 | 7 | **448** | Now |
| U9 A `--bad` token in every style | 7 | 10 | 10 | **700** | Now |
| S1 Density explains itself | 9 | 10 | 9 | **810** | Now |
| S5 create hands back the spell line | 7 | 10 | 10 | **700** | Now |
| S2 A paint slot cannot vanish | 8 | 10 | 8 | **640** | Now |
| S4 One front door on the skill | 8 | 9 | 9 | **648** | Now |
| S3 new.mjs: a model that already builds | 9 | 8 | 7 | **504** | Now |
| S6 A kit must not collide with the chrome | 7 | 9 | 8 | **504** | Now |
| S7 The catalogue says what a template draws | 9 | 9 | 7 | **567** | Now |
| S9 The first build should not be thrown away | 6 | 10 | 10 | **600** | Now |
| S8 Print a slice of the catalogue | 7 | 9 | 8 | **504** | Now |
| U10 Warn before the browser fails | 8 | 9 | 8 | **576** | Now |
| U8 Two axes on the sheet | 8 | 7 | 4 | **224** | Next |

Three epics sit off their score.

| Epic | Score | Horizon | Why |
| --- | --- | --- | --- |
| N2 Presenter view | 192 | Next | Notes with nowhere to read them during a talk is half of N1. N2 is what N1 is for. |
| P3 Growth-aware parity | 288 | Next | D3 is red from its first commit until the parity semantics change. |
| P4 Engine-version stamp | 320 | Later | P1.4 fixes the crash a stamp would have caught, and nothing else reads the stamp yet. |

---

## Foundations

Five changes gate the rest. Land them first and the four lanes stop colliding.

**1. The model contract (P2): `slide.notes` and `row.alt`.** Both are plain scalars on existing objects, and `diffDecks`'s slide skip list is only `['els','id']` (`template.html:248`), so both ride the existing edit-log, version, conflict and `create --from` machinery for free. Notes gates the notes panel, the handout page, HTML-import recovery, and any future PPTX `notesSlide` mapping. `row.alt` gates accessible export. Ship them together as one PR. Separately they cost three times as much, since each one touches `SKILL.md`'s MODEL CONTRACT, `bin/validate.mjs`'s slide loop, and `test/edits.test.mjs`.

**2. Growth-aware parity (P3), which blocks D3.** `bin/verify.mjs` treats any `scrollWidth`/`scrollHeight` overflow as a hard failure. A flow row exists to grow past its authored box, so the parity semantics have to change *before* anyone writes a paginator, or the flow PR is red from its first commit.

**3. Pointer Events (M3.1), which blocks the rest of M3.** The whole canvas editor is one `mousedown`/`mousemove`/`mouseup` lifecycle (`template.html:557`, `:590`, `:621`). The contact sheet already proves the correct pattern with real `pointerdown`/`move`/`up`/`cancel` handlers at `:728-743`. Replace the mouse block rather than adding a second one alongside it, or hybrid devices fire both.

**4. The HUD contract, batched (P1).** Four surfaces move together for every new control: the `<div id="hud">` markup, `SKILL.md`'s `<!-- HUD: … -->` manifest, `test/gate.test.mjs:95`'s 19-id DOM array, and `:205`'s manifest diff. Add the shortcuts-popover gate at `:173` for any new keybinding, and the Lucide-motion gate at `:186-196`. A notes toggle, a presenter button and an export button all land here, so batching them saves three consecutive red gates.

**5. `deck.html` is regenerated, never merged (P1.7).** It is 334,760 bytes of machine-written output under a byte-identity gate (`test/gate.test.mjs:238-240`). Four parallel branches would conflict on nearly every hunk with no hand-resolvable merge. The rule: rebuild with `npm run build:deck` after the merge, before the gate runs.

One collision is worth naming on its own. `test/gate.test.mjs:224` asserts exactly three un-animated `drawEls` call sites. A presenter next-slide preview, an in-browser PNG export and a notes handout page each add a fourth. Replace the hardcoded integer with a named-site set as part of P1, and the three features stop rebasing onto a moving assertion.

---

## Platform & release

### P1. Contract hygiene · `S` · Now

Seven small fixes, four of them documents that currently contradict the code: `plugin.json`, `marketplace.json`, `llms.txt` and the README roadmap.

| Story | Size | What |
| --- | --- | --- |
| P1.1 | XS | `package.json` says 0.5.0; `.claude-plugin/plugin.json` and `marketplace.json` both say 0.4.0. Reconcile, then gate it. CI checks neither today. |
| P1.2 | XS | `llms.txt:21` names a `/*TITLE*/` marker that does not exist, and omits `LOG` and `VERSIONS`. The real set is `DECK` `TOKENS` `KEY` `LOG` `VERSIONS` `EDITS`. |
| P1.3 | XS | The README roadmap still lists URL-hash deep links as future. They shipped in 0.5.0 (`template.html:296`, `:512`, `:966`). |
| P1.4 | S | `create --from` throws an uncaught `SyntaxError` on any deck built before 0.4.0. `blockOf`'s regex is an unanchored whole-document search, so a missing `/*LOG*/` marker matches the literal inside `fileHtml()`'s own source and parses `'+J(log)+'` as JSON. |
| P1.5 | S | CI runs `node --test` with no browser. 45 of 128 tests skip, including all 8 in `editor.test.mjs`. Install Chromium in CI, or say plainly in CONTRIBUTING that layout proof is a local pre-push step. |
| P1.6 | XS | Swap `gate.test.mjs:224`'s `=== 3` for a named-site set. |
| P1.7 | XS | Write the regenerate-never-merge rule for `deck.html` into CONTRIBUTING. |

**Gate:** a new test asserting `package.json`, `plugin.json` and `marketplace.json` agree; a `create --from` case with a marker-stripped source file.

### P2. Model foundations · `S` · Now

`slide.notes?: string` and `row.alt?: string`, added to `SKILL.md`'s MODEL CONTRACT and type-checked in `bin/validate.mjs`'s slide and row loops. `bin/create.mjs` needs no change, since it stringifies the model whole-cloth.

**Gate:** an explicit notes round-trip case in `test/edits.test.mjs`; a validator case rejecting a non-string `notes`.

### P3. Growth-aware parity · `M` · Next

A row opts into growth with a flag. `bin/verify.mjs`'s overflow, occlusion and collision checks read that flag and measure the grown box instead of failing.

### P4. Engine-version stamp · `S` · Later

A shipped deck records nothing about the engine that built it. `deck.rev` is a content hash for conflict detection, not a compatibility signal, which is exactly why P1.4 crashes rather than reporting "this deck predates the feature". Stamping the engine version gives every later migration something to branch on.

---

## Notes & presenting

Today there is no code at all. `README.md:141` lists presenter view and notes as roadmap, and `README.md:170` proposes syncing over BroadcastChannel, which cannot reach a second `file://` window. N2 uses `document.write` plus `postMessage` instead; P1 should strike the README line.

### N1. Notes as data · `M` · Now → beta

| Story | Size | What |
| --- | --- | --- |
| N1.1 | n/a | The `slide.notes` field, shipped in P2. |
| N1.2 | M | A notes panel outside `#canvas`, toggled from the HUD and a keybinding. It must live outside the canvas the way `#hud` and `#tb` already do, or every slide fails layout parity. |
| N1.3 | S | Teach `bin/import-html.mjs` to route a recognised hidden-notes convention into `slide.notes` instead of discarding it at `:97`. |
| N1.4 | M | A notes handout through the **⌘P** path, not the ⤓ button. ⌘P is the browser's own vector pipeline with real `@page` sizing, and Chrome has auto-tagged that output since Chrome 85, so notes come out selectable and searchable. `exportPdf()` rasterises every page to JPEG, so notes spliced in there would be an unsearchable picture of text. |

### N2. Presenter view · `L` · Next

**The spec, set 2026-09-07.** A **Presenter notes** button on the HUD opens the speaker view in a new browser window. The speaker view shows, clearly and always: the presentation hotkeys, the current slide, the next slide, and the speaker notes stored with the current slide. Advancing or jumping in the speaker view changes the slide on the main view (and the main view's own navigation keeps the speaker view in step). Speaker notes live per slide in the model (`slide.notes`, P2) and show in the main view when the **Notes** button is toggled (N1.2). Not built yet: this section is the plan, not a promise of a date.

**The sync mechanism is settled: `window.open('about:blank')` plus `document.write()` plus `postMessage(msg, '*')`.** A child document written into directly copies the opener's origin, including an opaque `file://` one, so both windows can talk with no server and no secure context. reveal.js ships exactly this, and its own source comment names file:// portability as the reason.

Everything else fails the double-clicked-local-file case. BroadcastChannel and `localStorage` plus `storage` events both need two real same-origin navigations, and most browsers hand each `file://` load its own opaque origin. The Window Management API and Screen Wake Lock both require HTTPS. The W3C Presentation API targets casting to a TV, and is Chromium-only besides.

| Story | Size | What |
| --- | --- | --- |
| N2.0 | S | The **Presenter notes** HUD button (and a keybinding): opens the speaker view as a new window sized for a second screen. Batched with the HUD contract in P1 (markup, `SKILL.md` manifest, gate). |
| N2.1 | L | The channel: handshake, 1s heartbeat, reconnect after either window reloads. Control runs both ways: →/←/Home/End/a typed number in either window moves both; the main view stays the single owner of the slide index, the speaker view sends intents and renders what it is told. |
| N2.2 | S | Storage isolation. The presenter window inherits the same `NS`/`KEY`/`HKEY` namespace (`template.html:278`), and load-time reconciliation at `:292` assumes exactly one browser writer. Two windows calling `save()` would clobber each other's undo history and edit log. The presenter window must be a reader. |
| N2.3 | L | The surface: current slide, next-slide preview, the current slide's `notes`, wall clock and elapsed timer side by side, and a hotkey legend that is always visible (advance, back, first/last, go-to-number, blackout, fullscreen, toggle notes). The legend reads from one key table the main view also uses, so the two never drift. |
| N2.4 | M | Pacing. A deck-level total time or a per-slide budget; the indicator reads ahead, on track, or behind. |
| N2.5 | S | Rehearsal mode: the same layout in one window, for practising without a second screen. Keynote's idea, and it is free once N2.3 exists. |
| N2.6 | S | Remembered layout presets (default, wide, tall, notes-only). |

Multi-monitor placement stays manual: open a sized popup, the speaker drags it to the second screen once, then fullscreens it there. Every portable web framework does this, because `requestFullscreen({screen})` needs an HTTPS-gated Chromium permission a local file never has.

### N3. Notes to PPTX · `S` · Later

Each `slideN.xml` relates to a `notesSlideN.xml` whose root is a shape tree structurally identical to a slide's, so it is a small addition to X3 rather than its own build.

---

## Mobile & touch

The rendered slide already scales correctly. `fit()` (`template.html:314`) is a uniform scale-to-fit, so a slide looks right at any size. The gaps are in the chrome and the input layer.

### M1. Read it on a phone · `S` · Now → supported · M1.1 + M1.4 done (#49)

M1 is the cheapest work in this lane: four small PRs, no new subsystem. M1.1 and M1.4 landed together in #49: `fit()` reads the layout viewport, `svh` + `viewport-fit=cover` + safe-area insets on the shell, and `test/touch.test.mjs` is the phone lane every later story proves itself in.

| Story | Size | What |
| --- | --- | --- |
| M1.1 | S | **Done (#49).** `body{height:100vh}` has no `dvh` fallback and the file uses no `env(safe-area-inset-*)`. On iOS Safari the flex column `fit()` measures into is wrong before any interaction happens. Use `svh` for the shell, add `viewport-fit=cover` and safe-area padding. |
| M1.2 | S | Present mode has no touch navigation at all. The HUD reappears only on `mousemove` hover-peek (`:811`), which never fires from a finger, and no swipe or tap-to-advance handler exists. A phone in fullscreen present mode currently cannot change slides. |
| M1.3 | S | Hit targets under a `pointer: coarse` query. Resize and connector nibs are 13x13px; HUD buttons are 26px tall. WCAG 2.2 AA floors at 24x24 CSS px and Apple recommends 44. Chrome drawn inside the scaled canvas shrinks below the floor as the canvas scales down, so render it outside the transform, or divide by the live scale. |
| M1.4 | S | **Done (#49).** A touch test lane. Every live test today opens 1280x800 and drives `page.mouse.*`; nothing uses `hasTouch` or a phone-width viewport. |

### M2. Present from the phone · `S` · Next

Fullscreen plus a landscape orientation lock, which only works from inside fullscreen and not at all on iOS Safari, so portrait must still read correctly. Screen Wake Lock, feature-detected and wrapped, since it rejects on `file://`. Web Share API to hand the file or an export to the OS share sheet.

### M3. Touch editing · `L` · Later

M3.1 is the Pointer Events rewrite. After it, a tap-to-edit entry point, since text editing is `e.detail>=2` double-click only today (`:585`), then button affordances for the actions that are keyboard-only: undo, and the contact sheet's copy, paste and duplicate.

**Scope: retext a row, nudge an element.** Full authoring parity on a phone is not a target. Pitch and Figma Slides both declined to build it, and Google Slides and Canva ship it while documenting it as degraded.

---

## Documents & formats

`FORMATS` is a five-entry enum (`bin/validate.mjs:27`) and `FORMAT` is a `{w,h,page}` lookup (`bin/create.mjs:18-24`). The runtime branches on none of it: `grep` for any format name in `template.html` returns nothing. Format is a build-time label.

### D1. Format presets · `S` · Now → experimental

Adding a preset is genuinely one line in each of two files, plus widening the `page` enum past `letter`/`a4`. Candidates: 4:3 slides, Letter and A4 landscape, 9:16 story, A3 poster, 600px email.

`lib/layouts.mjs:4` says its 19 layouts are cut for 960x540, and `libraryFor()` only scales geometry anisotropically. `templates/kit.mjs:3` says the same of its 59 templates: "scale() maps a whole template to any slide canvas **of the same aspect**". A new non-16:9 preset therefore renders stretched layouts until D2 lands. Say so in the README matrix rather than shipping a preset that quietly looks wrong.

### D2. Aspect-aware composition · `XL` · Next

Re-cut the 19 library layouts and the 59 templates for square, portrait and 4:5 canvases. The templates directory is the larger half and the riskier one: it appears in no test, no `SKILL.md` section, no README row and no CI step. Give it a gate and a doc surface as part of this epic.

### D3. Real documents · `XL` · Later

Every row is `position:absolute`, with `left`/`top`/`width`/`height` read straight off its own x/y/w/h. There is no flow container, and no notion of a page distinct from a slide; print emits one fixed `.pg` div per slide, with no overflow check anywhere in the loop. `examples/one-pager/model.json` proves it. Two pages, authored as two slides, y-offsets summed by hand.

| Story | Size | What |
| --- | --- | --- |
| D3.1 | M | **Decide id stability under pagination first.** If a paginator mints new slides, `inheritIds()` cannot match a human's logged edits on a page that got re-split, and `applyLog` orphans them. This is a design question rather than an implementation task, and it blocks D3.2. |
| D3.2 | L | Text flow as a build-time measure-and-split pass in Node plus Playwright, reusing `bin/import-html.mjs`'s existing line-measurement walker. Never a runtime CSS mechanism: the runtime has no flow layout. |
| D3.3 | M | Running headers, by computing the current section at build time and emitting a per-slide master `override` row. The fork mechanism already exists (`template.html:545`). |
| D3.4 | M | Real page numbering. Once page and slide diverge, three things break beyond the footer counter: `num()`, the `#n` deep link written at `:512`, and the tab position restore at `:298`. The last two are both gate-locked. |

**Rejected for this lane.** Paged.js closes the browser gap for `string-set`, footnotes and named pages, but its own docs require the CSS served over HTTP; `file://` does not work, which fails the one-file rule. CSS Regions is dead and absent from CSS Snapshot 2026. CSS GCPM (`string-set`, `position: running()`, `target-counter`) is a Working Draft no browser implements. Prince and WeasyPrint are the fidelity ceiling and need a non-browser pipeline.

---

## Export

Four paths exist today, all client-side and dependency-free: the in-file ⤓ PDF, ⌘P print, ⌘S write-back through the File System Access API, and `bin/verify.mjs`'s per-slide Playwright screenshots.

### X1. Cheap wins · `S` · Now

| Story | Size | What |
| --- | --- | --- |
| X1.1 | S | `bin/export.mjs --png`. `bin/verify.mjs:47-155` already navigates, selects each slide and screenshots `#canvas` at native resolution. It just writes into a directory called `verify-out`. Extracting it is close to a pure refactor, and it covers the README's "carousel export" item as the same work rather than a second one. |
| X1.2 | S | Markdown and outline export. `bin/validate.mjs:34`'s `plain()` already strips HTML from a row; walk `deck.slides[].els` and emit Marp-shaped front matter with `---` separators. |
| X1.3 | S | An OG card at 1200x630 with a 60 to 80px safe margin, plus `og:image` and `twitter:card` meta. The `<head>` carries only charset and viewport today. |

### X2. Searchable PDF · `M` · Next

The ⤓ button rasterises. Each page is drawn through an SVG `foreignObject` onto a canvas and read out as `toDataURL('image/jpeg', .92)`, then embedded as one `/DCTDecode` XObject per page. Link annotations are the only vector content. Text is not selectable, and never will be on that path without a rewrite priced at XL.

**So promote ⌘P instead.** It is already the browser's vector print pipeline, already honours named `@page` sizes, and Chrome already walks the DOM into a PDF structure tree. Document the two buttons for what they are: ⤓ gives a pixel-exact picture of the deck, ⌘P gives a searchable, tagged document. Then close the accessibility gap with `row.alt` from P2, and `role="presentation"` on repeating decorative chrome so a screen reader stops announcing the footer on every page.

### X3. PPTX export · `L` · Later

**This reverses the README's "out of scope" ruling, and the reason is that the model changed.** Charts expand to plain rows at create time, so by build time every row is one of a small closed set: text, box, tile, bar, connector, donut, image, inline SVG. PptxGenJS takes `x, y, w, h` in inches, across about 200 autoshape types. The mapping is nearly 1:1. Nothing sits between the row list and the shape call but unit conversion.

The losses are real and belong in the docs rather than a footnote. PPTX references fonts by name instead of embedding them, so a viewer without the deck's font substitutes and reflows. There is no PPTX equivalent for CSS gradients, blend modes, filters or `clip-path`.

Slidev rasterises every slide for its own PPTX export and says so. Vector shapes out of the row model would be the first agent-built deck tool to do it.

**Rejected.** The Google Slides API is a live authenticated REST endpoint with no offline path, valid as a separate publish integration but never as an export. `docxtemplater` needs a hand-designed template with one placeholder per slot, the opposite of a generated row model. `officegen` is Node-only and unmaintained relative to PptxGenJS.

---

## Media & links

The model already carries an image (`img` as a data: URI with `fit`/`pos`), an animated GIF plays through the same row, and `href` is a shipped contract (`SKILL.md` § rows: one inset anchor per row, a new tab when presenting, ⌘-click when editing, a real `/Link` annotation in the ⤓ PDF). Missing: the editor side of media, a video row, and the link work still in flight.

### V1. Images in the editor · `M` · Now

| Story | Size | What |
| --- | --- | --- |
| V1.1 | S | Drop or paste an image onto the canvas: it becomes an `img` row at the drop point, sized to the image aspect at a sane width, encoded to a data: URI on the way in. |
| V1.2 | S | Replace the image of a selected row (drop, paste, or a file picker on the mini toolbar), keeping x/y/w/h/fit/pos. |
| V1.3 | M | Crop and position by hand: `fit` and `pos` on the mini toolbar, and a drag inside a `cover` image that moves `pos`. |
| V1.4 | S | `row.alt` (P2) editable from the toolbar; `verify` warns on an image without one. |

### V2. Video and GIF rows · `M` · Next

GIF needs no new row: `img` already plays one, and its only cost is the budget (V4). Video does need one.

| Story | Size | What |
| --- | --- | --- |
| V2.1 | M | A `video` row: data: URI (mp4/webm), `poster` (a data: URI, or the first frame captured at create), `loop`, `muted`, `autoplay`, `controls`. Presenting: plays on slide entry when `autoplay`, pauses on exit. Editing: the poster, never a playing clip. |
| V2.2 | S | The one-file rule holds: `verify` fails any `src` that is not a data: URI, the same gate as images. |
| V2.3 | S | Export: the poster frame in the ⤓ PDF and on every ⌘P page; PPTX (X3) embeds the clip when that lands. |
| V2.4 | S | The contact sheet and the presenter next-slide preview show the poster, never a second playing copy. |

### V3. Link behaviour · `S` · Now — in flight

The outward `href` contract is shipped. The open thread is what a link can point at inside the deck, and how a human sets one without touching the model.

| Story | Size | What |
| --- | --- | --- |
| V3.1 | S | In-deck targets: `href:'#7'` and `href:'#<slide id>'` jump to a slide when presenting, with the URL hash following, so a table of contents and a back-to-agenda button are rows, not scripts. |
| V3.2 | S | Set or clear a link on any selected row from the mini toolbar (a URL field validated to http/https/mailto/#), and on several selected rows at once (a painted button and its label). |
| V3.3 | XS | `verify` fails a `#` target that names no slide, and lists every outward link so a review can check them. |
| V3.4 | S | The PDF: in-deck links become page-jump annotations; ⌘P pages carry the same anchors. |

### V4. Media budget and the PDF · `S` · Later

| Story | Size | What |
| --- | --- | --- |
| V4.1 | S | `validate` reports media bytes per slide and per deck against the SKILL.md budget (≈100 KB an image, the file under a few MB) as a warning, so a heavy deck is caught before it ships. |
| V4.2 | S | The ⤓ PDF re-encodes images at page resolution instead of embedding the full data: URI on every page that shows one. |

---

## Library & editor

Filed 2026-09-12 from Kyle's review of the rebuilt library deck (89 slides, decklet 0.7.0 at `ea265cc`, opened in Safari). Nine observations, one epic each (eight shipped the same day, collapsed below); L7 and L8 reopen two features the changelog lists as shipped, because the implementation is not done from the user's chair. Each story is one PR; none touches this file (the review closes the row after the merge).

### L1. Sheet keeps its scroll · Done (#34 L1.1, #36 L1.2)

### L2. PDF export shows progress · Done (#39: L2.1 + L2.2; L2.3 Worker deflate not needed, a 60-slide WebKit export measured 1.4 s)

### L3. Counter owns the corner · Done (#43: `COUNTER` reserve in the layout contract, verify checks the box on every slide)

### L4. One foot band on the sheet · Done (#45)

### L5. Sample media on the sheet · Done (#41: `templates/samples/`, 108 KB, size-gated)

### L6. Generic placeholder copy · Done (#40: six fictional companies, spell flags 33 → 12)

### L7. Spellcheck, the rest · `M` · Now

0.7.0 shipped option C (build-time dictionary, painted through the Highlight API) and it works where it paints. Reopened: the feature is not done from the chair.

| Story | Size | What |
| --- | --- | --- |
| L7.1 | S | A typo typed after the build is only flagged by the browser layer until the next `create`; the editor re-checks the row it just committed. |
| L7.2 | M | Suggestions and correct-in-place from the painted layer, not only the browser's own menu. **Done (0.10.0)**: the build bakes each flagged word's suggestions into `/*SPELL*/`; the count badge opens a panel of this slide's flagged words and a pick rewrites the row (every occurrence on the slide, case and markup kept), a click on a marked word while its row is being edited fixes that one, and "Ignore in this deck" writes `spell.ignore`. The same release made the mark visible in Safari (a wash beside the wavy underline). |
| L7.3 | XS | Whatever Kyle hit first goes here as the leading story once named. |

### L8. Versions, the rest · Moved to weave (0.9.0)

0.5.0 shipped the in-file version history, the edit log and `create --from`. Kyle's ruling, 2026-09-12: decklet must autosave and keep itself current in every browser — desktop, phone, embedded — and it does not need version control; version history is weave's job, a separate product. 0.9.0 removed the history from the file (`/*VERSIONS*/`, the popover, pin and restore; `create --from` reads past the block an older file carries) and shipped autosave everywhere instead: a linked file rewrites itself on every edit (800 ms trailing debounce, flushed by ⌘S, the dot, a hidden tab or an unload); storage is a tier chain — localStorage → IndexedDB → memory — so a cross-site iframe or a locked-down `file://` lands on a tier that persists or an honest red dot; every window of one browser converges live (`storage` + BroadcastChannel, last write wins, readers never write); Playwright proofs under Pixel 7 and iPhone 14 emulation and inside same-origin, cross-site and srcdoc iframes run in CI (test/autosave, test/mobile, test/embed). L8.1 (a diff view) goes with the history to weave; L8.2 (Safari cannot write a local file) stays true and stays documented; L8.3 landed as the reader rule.

### L9. Figures in the library · Done (#37 `lib/diagram.mjs` exported as `@grunion/decklet/diagram`, #44 `cat-figures.mjs` + the Figures kind; 67 templates)

### L10. Styles on the sheet · Done (#38 `examples/styles/`, #42 the closing Styles section)

### L11. Type on the sheet · `S` · Now

L10 shows each kit's palette and weights, but a decklet style is deck-wide (roles win `font/size/lh/ls`), so every Styles slide still sets in the neutral sans. Kyle asked for variation in font as well as colour.

| Story | Size | What |
| --- | --- | --- |
| L11.1 | S | A per-slide `styleRef` (or a slot-level role override) the engine honours for `font` and `lh` only, so a Styles slide can wear its kit's family without a second deck. Parity and the gap gate measure with the override's `cw`. |
| L11.2 | XS | The Styles section binds each kit's family through it; the montage shows Georgia, Helvetica Neue, Palatino, Avenir Next side by side. |

### L12. One save door, and an icon that reads · Done (0.11.0)

Filed 2026-09-13 from Kyle's chair on the 0.9.0 build. "Save a copy" was a second button that `#hud button` (1,0,1) beat `#savecopy{display:none}` (1,0,0) into showing in every browser, telling browsers that persist fine that they do not; it is folded into the save button, whose click already falls to `saveCopy()` when there is no file handle. The save indicator itself was a 4×9px dot among 16px icons: it is now the Lucide save glyph at the sibling footprint, state in colour plus a corner badge (calm · amber with the unsynced count · red with a !) and the write pulse kept.


## Usability

Filed 2026-09-12 from a four-subject study: two Opus and two Sonnet agents, each handed only the skill and a nine-rung brief (title → bullet page → image + bullets → stats → block-arrow process → branching diagram → three-tier architecture → six-node architecture with zones → scorecard), one density and one style kit each. All four finished 9/9 `VERIFY PASS` in 60 to 80 minutes and 50 to 62 tool calls. The tools are usable. The same edges cut all four, and three rungs cost more than the advanced diagram did. Reports and decks: harness `scratchpad/usability/<subject>/REPORT.md` (copied into the findings artifact). U1 to U7 landed 2026-09-12/13; U9 and U10 were added 2026-09-13 from the parity study that followed.

### U1. `w`/`h` default in validate · `XS` · Now

MODEL CONTRACT says `w`/`h` come "from format"; `create` applies that default, `validate` does not, so every subject's first run died on `deck.w must be a positive number`. Four of four.

| Story | Size | What |
| --- | --- | --- |
| U1.1 | XS | `validate` resolves `w`/`h` from `format` the way `create` does; one gate case with a model that names only `format`. |

### U2. The catalogue says what fills · `S` · Now

`--templates` prints text keys only, so 67 templates read as fully fillable when charts, timelines and rating rings are literals in `els`. `--layouts` prints slot names and roles with no geometry, under the sentence "read that instead of inventing geometry"; every subject who placed free rows read `lib/layouts.mjs` to find where the title ends. Four of four.

| Story | Size | What |
| --- | --- | --- |
| U2.1 | XS | `--templates` prints, per template, the rows `fill` cannot reach (`fixed: 12 ratings`, `fixed: chart series`). |
| U2.2 | S | `--layouts` prints each slot's box (`x y w h`) and the free area left under the chrome. |

### U3. A width warning is a failure · `XS` · Now

`validate` warns `nowrap … likely wider than w=168`; `verify` fails the same row as `overflows its box`. Nothing says the warning class is blocking. Two of four shipped the warning and lost a verify cycle.

| Story | Size | What |
| --- | --- | --- |
| U3.1 | XS | The nowrap-width warning becomes an error in `validate` (the estimate is the same one verify measures against), or `--strict` is the documented pre-hand-off gate and the text says so in PROCESS. |

### U4. Ratings are fill keys · `S` · Now

`harvey-balls` is the one options × criteria template; its twelve ratings are literals, `fill` only reaches text, and verify says PASS on a slide whose scores are the sample's. Three of four hit it; one shipped it unknowingly, two abandoned it and hand-built a donut grid. The same holds for `progress-tracker`, the gauge and every chart template.

| Story | Size | What |
| --- | --- | --- |
| U4.1 | S | Rating, progress and gauge templates expose their values as fill keys (`r1c1 … r3c4`, `p1 … p4`), with a range check in `validate`. |
| U4.2 | S | Chart templates take `data` through fill (the `chart` row already accepts it; the template binds it). |

### U5. The missing starting rungs · `M` · Now

Four of four hand-built the two most common business slides. Missing from 67 templates and 31 layouts:

| Story | Size | What |
| --- | --- | --- |
| U5.1 | S | `bullets` layout and `bullet-page` template: a title and four to six bullets (`b1 … b6` slots, an engine-drawn dot), at speaker and reading density. |
| U5.2 | S | `image-left` / `image-right` gain `b1 … b4` bullet slots beside the image; an `image-bullets` template binds them. |
| U5.3 | S | `process-flow-3` and `process-flow-5`, or `process-flow` takes the step count from the keys bound. |
| U5.4 | XS | A stats page at speaker density: `stat-row-3` with Stat-role numbers (every numbers layout today is reading). |
| U5.5 | S | `scorecard-grid`: criteria × options with fillable cells (text or a 0–4 rating), the rows-based scorecard two subjects built by hand. |
| U5.6 | M | `figure-boundaries-6` (three zones, six to eight nodes, labelled edges) and a documented spec path for a figure the templates do not cover: three sentences on where group labels and edge labels land (`X(g.x)+12, Y(g.y)+6`; a label that does not fit its run lifts to `Y(tops)−22`). |

### U6. Counter regression · `S` · Now

Reported by the reading-density Opus subject on the #43 engine: a right-anchored footer master warns `master foot overlaps by ~14px counter` on every slide regardless of text, so `--strict` cannot pass with the anchoring the docs recommend; `right:` on the footer master renders bottom-left anyway; and the counter appears in no verify screenshot in either anchoring while a DOM probe finds `.num.corner` live, so the L3 counter-parity check compares a box no artifact contains. Reproduce first, then fix; L3's gate said PASS on all of this.

| Story | Size | What |
| --- | --- | --- |
| U6.1 | S | Reproduce the three symptoms on a two-slide deck in Chromium and WebKit; a live test for each; fix the footer `right:` anchoring, the gap-gate double count, and make verify's screenshots carry the counter (or make the parity check read the DOM it actually compares). |

### U7. SKILL.md: authoring and editor apart · `M` · Now

11,100 words. Every subject named the HUD paragraph in hand-off note 2 (about 1,100 words in one sentence: every control, icon, key, the bug dialog's payload) as the worst thing in the file, and MOTION, GIFS AND IMAGES (a duplicate of GRAPHICS), CONNECTORS (unused once `diagramRows` routes), the eight experimental format rows and worked example D as never opened. Re-read three times: the row prop table (earns it), DENSITY (because the fact that a template overrides the deck's density sits in one clause under TEMPLATE LIBRARY), and the LAYOUT LIBRARY table (no geometry, see U2).

| Story | Size | What |
| --- | --- | --- |
| U7.1 | S | The HUD, persistence, PDF, versions and bug-reporting text moves to `docs/editor.md`; SKILL.md keeps a two-line pointer. The `<!-- HUD -->` manifest gate follows the text. |
| U7.2 | XS | DENSITY states that a template carries its own density and overrides the deck's; TEMPLATE LIBRARY says which are reading. |
| U7.3 | S | CONNECTORS and CHART ROW become `docs/` references linked from GRAPHICS; MOTION shrinks to the four words; GIFS AND IMAGES folds into GRAPHICS; the formats table shows `slides` and one line naming the experimental rest. Target: SKILL.md under 7,000 words with no rule lost (the gate tests that read SKILL.md move with the text). |

### U9. A `--bad` token in every style · `XS` · Now

Two independent builds in the parity study painted a bad number (support tickets up 22%; a 22-point miss) in the same accent as every good number, because the neutral template defines no `--bad` and `var(--bad, var(--accent))` falls through to the accent. A deck's one semantic for "this number is the problem" should not depend on the author shipping a style kit.

| Story | Size | What |
| --- | --- | --- |
| U9.1 | XS | `--bad` (and `--good`, if the pair reads better) in the neutral scale and in every `examples/styles` kit, documented in the STYLE CONTRACT beside the existing tokens. |

### U10. Warn before the browser fails · `S` · Now

`validate` sizes text from one average glyph width per role, so a row near its box width passes validate and fails parity in the browser. U3 established the estimate misses in both directions and cannot be promoted to an error. Every study builder that lost a rebuild lost it here, and the diagram helper compounds it: node width, the 8px snap and the edge-label fit threshold are one coupled system, so widening a node to fit its title can push that node's edge label out of its run.

| Story | Size | What |
| --- | --- | --- |
| U10.1 | XS | `validate` warns when a `nowrap` row's estimate reaches ~90% of its box, naming the row and the margin, so an author widens it before `create`. |
| U10.2 | S | `cw` measured per weight rather than per role (weight-600 Body measures ~15% wider than the role's `cw`), so the estimate is honest for the weights templates actually use. |

### U8. Two axes on the sheet: look × ladder · `L` · Next

Kyle's ask: the library should read as two axes. **Look**: basic or dense spacing (two spacing scales, not only two chrome sets), and the type, colour and tone of a kit. **Ladder**: the same content climbing from a section opener and a bullet page, to an image with bullets and a few stats, to a block-arrow process, to a diagram, to a simple and then an advanced architecture, to a scorecard. Today the sheet is grouped by slide kind and shows kits only in a closing section.

| Story | Size | What |
| --- | --- | --- |
| U8.1 | S | A `spacing` style token (`basic` / `dense`) that scales margin, gap and role line-heights together; the two sheets built from one model. |
| U8.2 | M | The sheet opens with the ladder: one fictional company climbing all nine rungs at basic spacing in the neutral kit, then the same nine at dense spacing, then the nine under two kits. The kind-grouped catalogue follows as the reference half. |
| U8.3 | M | `README` and the Pages index lead with the ladder sheet; the catalogue sheet is linked from it. Depends on U5 (the rungs must exist as templates) and L11 (type per kit). |

## Getting started

Filed 2026-09-13 from the parity study: 30 decks, 5 briefs, 7 setups, blind-judged. Every builder passed, and every builder spent roughly the first third of its run reading — the skill, the catalogues, then engine source for the handful of rules neither prints. The lane exists to delete that third. It is measured, not guessed: the study's own transcripts name what was read and why.

**Round 4 measured the lane.** With S1–S5 shipped, ten fresh builders (five Opus, five Sonnet) built all five briefs from the engine alone — no study scaffolding, the engine's own `docs/building.md` as the procedure. All ten reached `VERIFY PASS` on 8/8 slides; nine opened no engine source at all, and `bin/new.mjs` put a validating model on disk 27 to 90 seconds from a cold start. S7 to S9 are what the round left behind.

**One result shapes the whole lane.** A setup that replaced the contract with a one-page summary scored **0.861** against **0.878** for the skill alone — below baseline. Condensing the rules makes an author skim the rules. So nothing here summarises the contract. Each row either makes a tool answer the question that sent an author to the source, or removes a decision from the first five minutes.

### S7. The catalogue says what a template draws · `M` · Now

Measured in round 4 of the study: with S1–S5 shipped, nine of ten builders opened **no** engine source at all, against two to five source reads each before. One gap accounts for nearly every remaining defect, and it bit four of the ten.

`--templates` prints a template's fill keys and counts its unreachable rows (`fixed: 6 arrows · 7 shapes`). It never says what those rows **depict** or how they are **wired**, so a template's own content is invisible until it renders:

* `figure-release` paints its first tick filled — "shipped". Bound to a roadmap whose first month is October, the slide claimed the October work was already done. Fill reaches text only, so the builder could not correct it and abandoned the template.
* `figure-boundaries-6` chains its middle zone bottom-to-top, so binding the nodes in the order the keys print drew the database writing up into the ingest API.
* `image-bullets`' `image` slot is a gradient placeholder, not an `img` row. Nothing short of the source says whether a real photo may be painted over it.
* `swot`'s quadrant boxes collide with the `note` slot, pushing the dense line down to `source`.

Every one passed `validate --strict` and `verify --strict` and was caught only in the screenshot pass. Two of them are wrong facts, not taste.

| Story | Size | What |
| --- | --- | --- |
| S7.1 | S | `--templates` describes each fixed row in a phrase, not a count: what it draws and any state it asserts (`tick 1 filled = shipped`, `image slot is a gradient placeholder, paint an img row over it`). Generate it from the rows, never a hand-kept list that can drift. |
| S7.2 | S | A figure template prints its wiring: node order and edge direction (`zone 2 chains t18→t19→t20, bottom to top`), so binding in key order cannot silently reverse an arrow. |
| S7.3 | XS | A template whose fixed rows assert a state carries a one-line warning in its catalogue entry, so a builder chooses it knowing what it claims. |

### S8. Print a slice of the catalogue · `S` · Now

The same round: `--templates` and `--layouts` run 1,764 lines together, and three builders had to redirect them to a file and page through in chunks because the harness truncates long output. Printing everything fixed the source-reading problem and created a paging one. The field a builder needs first — which shapes are legal at the density the brief fixes — is one word buried in each entry.

| Story | Size | What |
| --- | --- | --- |
| S8.1 | S | `--templates` and `--layouts` take a filter: `--density speaker`, `--group figures`, `--name <id>`, and a `--brief` one-line-per-entry form. A builder asks for the twelve entries it can actually use. |
| S8.2 | XS | The `## START HERE` line names the filter, so the first catalogue call is already narrow. |

### S9. The first build should not be thrown away · `XS` · Now

`create` prints the words its dictionary refused and now hands back a pasteable `spell.ignore` line (S5). The loop still costs a build: every round-4 run created once to read the flags, pasted, and created again. The words are knowable before the deck is written.

| Story | Size | What |
| --- | --- | --- |
| S9.1 | XS | `validate` runs the same check and prints the same pasteable line, so the flags are known at the gate that runs first and the first `create` is the real one. |

### S6. A kit must not collide with the chrome · `S` · Now

Found while building S3's starter across all eleven style kits: on `ocean-ember`, whose H1 sets a 44px leading, the library's chrome pitch leaves under 4px between the title box and the `subtitle` slot, so `validate --strict` reports an overlap for **any** deck that binds `subtitle` on a dense H1 layout. The kit is shipped, the layout is shipped, and the combination cannot pass the gate — an author who picks that kit and writes a subtitle has done nothing wrong. The starter dodges it by binding `note` and `source` instead, which is a workaround, not a fix.

| Story | Size | What |
| --- | --- | --- |
| S6.1 | XS | A test that walks every shipped kit × every dense H1 layout with all four dense slots bound and expects `validate --strict` clean. It fails today on at least one pair; the point is to know the true count. |
| S6.2 | S | Fix what it finds: derive the chrome pitch from the role's own leading rather than a constant, or cap a kit's H1 leading against the pitch. Whichever, the rule lands in the STYLE CONTRACT so a kit author knows the constraint. |

### S1. Density explains itself · `S` · Now

`densityReport` names the cap and the count (`reading density carries ≤ 8 points, this slide has 12`) but not which rows it counted, and the counting rule — Supertitle, Title, H1, Caption and Label are chrome, everything else is a point — lives only in `lib/layouts.mjs`. Eight of the study's thirty runs read that function, more than any other source read, and several called it the one rule they could not have guessed. Two runs then spent a validate round on the wrong fix.

| Story | Size | What |
| --- | --- | --- |
| S1.1 | S | A density message lists the rows it counted (`points: H2 "Re-plan" · Body "…" · Body "…"`) and names the chrome roles it did not, so the fix is visible without opening the engine. The word count says the same for words. |
| S1.2 | XS | DENSITY states the counting rule in one sentence beside the table. |

### S2. A paint slot cannot vanish · `S` · Now

A layout's `paint` slot draws nothing unless a row binds it, and it must be painted before its own text or it covers it. Two study builds bound a card's text and not its box: one lost a verify round to occlusion after fixing it, and one shipped a decision slide whose two cards were loose text on an empty canvas — `validate --strict` and `verify --strict` both passed it, and only the screenshot pass caught it.

| Story | Size | What |
| --- | --- | --- |
| S2.1 | S | `validate` errors when a slide binds a paint slot's text children and not the paint slot itself, naming the row to add. |
| S2.2 | XS | It warns when a bound paint row is ordered after its own text (the occlusion `verify` would catch, caught one step earlier). |

### S3. `new.mjs`: a model that already builds · `M` · Now

Every run hand-assembled the deck's top level, and the first `validate` of the study was an error on `deck.w` in four runs out of four. The winning practice — a coverage manifest written before the model — also has to be written from nothing each time.

| Story | Size | What |
| --- | --- | --- |
| S3.1 | M | `node bin/new.mjs --out model.json --slides 8 --density reading [--style <kit>]` writes a model that validates and verifies as-is: format, canvas, margin, a master footer, and eight slides on library layouts with placeholder text an author replaces. |
| S3.2 | S | The same command writes `MANIFEST.md` beside it — the coverage table `docs/building.md` asks for, with its columns and its two rules, empty and ready to fill. |
| S3.3 | XS | `docs/building.md` opens with the command instead of describing the file. |

### S4. One front door on the skill · `S` · Now

SKILL.md is 6,997 words over fourteen sections and eight `docs/` references. An author's first question is "what do I run and in what order", and the answer is spread across PROCESS and three catalogues. This is a routing block, not a summary: it points at the contract, it never restates it.

| Story | Size | What |
| --- | --- | --- |
| S4.1 | S | A `## START HERE` block of at most twelve lines directly under the title: the six commands in order, `new.mjs`, the two catalogue flags that print geometry and fill reach, and the one line that says a first `VERIFY PASS` is half the job with the link to `docs/building.md`. Under the 7,000-word budget, paid for from the sections it makes redundant. |
| S4.2 | XS | `test/skill.test.mjs` holds the block's presence and its links, as it holds the others. |

### S5. `create` hands back the spell line · `XS` · Now

`create` prints the words its dictionary refused; the author then writes them into `spell.ignore` and builds again. Every checklist run in the study spent a build on that loop.

| Story | Size | What |
| --- | --- | --- |
| S5.1 | XS | The flag line ends with the line to paste: `spell: {"ignore": ["tallyline", "qoq"]}`. |

## Carried forward

Three entries from the previous README roadmap sit outside the five lanes above. They are not dropped, only unscoped, because none of them has had a survey pass yet.

* **Slide backend** · Later. Each slide becomes an entity with its own revision log; decks compose from slides; a published version pins revisions. This is the largest architectural bet on the list, and it rewrites `/*LOG*/`, `/*VERSIONS*/` and `deck.rev` at once.
* **Redo** · Later. The undo stack at `template.html:311` is one-directional.
* **Content-anchored annotations** · Later.

URL-hash deep links, the fourth entry on that list, shipped in 0.5.0. P1.3 removes it.

---

## Open questions

1. **Does CI get a browser?** 45 of 128 tests skip today. The mobile lane is entirely editor-interaction work, and its natural home, `editor.test.mjs`, has zero CI-provable coverage. Either install Chromium in CI, or state plainly that layout proof is a local pre-push obligation.
2. **`templates/`: re-cut, or fence?** 59 templates, 16:9-locked, with no test and no doc surface. D2 assumes re-cutting. Fencing them to 16:9 and shipping other formats without template support is the cheaper answer.
3. **Id stability under pagination.** D3.1. Decide before anyone writes a paginator.
4. **Does the explainer deck grow?** Repo convention puts every shipped capability into `deck.html`, and `gate.test.mjs:242` asserts exactly 12 slides. Adding notes and presenter controls also makes the three filmed GIF clips stale.

---

## Release lockstep

A version bump moves files in three trees, in this order:

1. **decklet.** `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and a `CHANGELOG.md` heading. Four features are already landed and unreleased under no version heading.
2. **The callable skill.** `~/.claude/skills/decklet/SKILL.md`, a hand-written 13.7 KB condensation of the repo's 45.4 KB `SKILL.md`. It is not a copy and not a symlink; someone re-condenses it by hand.
3. **The harness.** `skills/decklet-skill.md` and the `CLAUDE.md` registry row.

The harness gate reads the version from all three trees, so bumping decklet alone turns it red.

---

*Written against decklet 0.5.0, 128/128 tests passing.*
