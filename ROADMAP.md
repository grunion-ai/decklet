# Roadmap

decklet after 0.5.0: the plan, and the order it lands in.

Four lanes carry new work: functional speaker notes, a deck you can read and present on a phone, more document formats, and more export targets. A fifth lane, `Platform & release`, clears the ground for them.

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

Five lanes, one per product area. A lane groups epics for reading; it sets no owner and caps no work in progress.

`Platform & release` · `Notes & presenting` · `Mobile & touch` · `Documents & formats` · `Export`

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
| **Mobile & touch** | M1 Read it on a phone `S` | M2 Present from the phone `S` | M3 Touch editing `L` |
| **Documents & formats** | D1 Format presets `S` | D2 Aspect-aware composition `XL` | D3 Real documents `XL` |
| **Export** | X1 Cheap wins `S` | X2 Searchable PDF `M` | X3 PPTX export `L` |

### ICE scores

| Epic | I | C | E | Score | Horizon |
| --- | --- | --- | --- | --- | --- |
| P2 Model foundations | 9 | 10 | 9 | **810** | Now |
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

### M1. Read it on a phone · `S` · Now → supported

M1 is the cheapest work in this lane: four small PRs, no new subsystem.

| Story | Size | What |
| --- | --- | --- |
| M1.1 | S | `body{height:100vh}` has no `dvh` fallback and the file uses no `env(safe-area-inset-*)`. On iOS Safari the flex column `fit()` measures into is wrong before any interaction happens. Use `svh` for the shell, add `viewport-fit=cover` and safe-area padding. |
| M1.2 | S | Present mode has no touch navigation at all. The HUD reappears only on `mousemove` hover-peek (`:811`), which never fires from a finger, and no swipe or tap-to-advance handler exists. A phone in fullscreen present mode currently cannot change slides. |
| M1.3 | S | Hit targets under a `pointer: coarse` query. Resize and connector nibs are 13x13px; HUD buttons are 26px tall. WCAG 2.2 AA floors at 24x24 CSS px and Apple recommends 44. Chrome drawn inside the scaled canvas shrinks below the floor as the canvas scales down, so render it outside the transform, or divide by the live scale. |
| M1.4 | S | A touch test lane. Every live test today opens 1280x800 and drives `page.mouse.*`; nothing uses `hasTouch` or a phone-width viewport. |

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
