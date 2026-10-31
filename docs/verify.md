# What parity measures

`node bin/verify.mjs deck.html` renders the deck in a real browser and measures it. Step 5 of [SKILL.md](../SKILL.md) is mandatory and names the five collision shapes; this is the full statement of each, and of how the pixel diff relates to them.

- **Layout parity** — always (needs Playwright): no text row overflows its box, every `nowrap` row renders one line, imported rows render their source line count, every element is inside the canvas, **no painted row is drawn through a text row**, zero page errors.
  Five shapes — four measured on real geometry (glyph rects and sampled strokes, never bounding boxes), the fifth asked of the compositor:
  1. **ink through text** — a line, curve or rule crossing a label's glyphs;
  2. **text straddling a container** — a label crossing a box/tile border, or hanging half out of the box meant to hold it;
  3. **an arrow head inside a fill** — a connector aimed at a target's centre instead of stopped on its edge (fix with `to:`);
  4. **text over text** — a title landing on a caption;
  5. **text under paint** (occlusion) — a text row hidden by an opaque row painted later in `els` (a tinted box, an image, a bar). The compositor is asked, not the geometry (`elementFromPoint`), and it fails like the other four — a hidden row is never a warning. Fix by reordering `els` (paint first) or moving the box.
  Containment is not collision: text on a tile, a label inside a box, a slide backdrop all pass. A tint with no border is a backdrop and a circle/pill outline is decoration — neither is a container edge. A headless stroke crossing a card is routing, not a landing. `over:1` opts a row out of all five.
- **Two engines**: parity runs in Chromium and, on macOS when Playwright's WebKit is installed, in WebKit too, one browser per engine reused across every slide. Safari lays some text out wider than Chromium (a `ui-monospace` stack is SF Mono in Safari and Menlo in Chromium), so a label can wrap onto the row under it in Safari while Chromium passes. Results are per engine: `results.json` carries `engines.chromium` (the same array as `parity`) and `engines.webkit`, the CLI prints one `parity` line per engine and slide, a WebKit failure reads `layout parity failed in webkit on <slides>`, and WebKit's per-slide PNGs land in `<out>/webkit/`. The AE diff stays Chromium-only. `--no-webkit` (API: `webkit: false`) skips the second engine and `--webkit` (`webkit: true`) forces it on any OS; a missing WebKit install is reported under `skipped`. The default is macOS only because Safari exists only on Apple platforms: Playwright's Linux WebKit picks fonts through fontconfig, so it wraps text where neither Safari nor Chromium does (the explainer's H1 wrapped on a Linux runner and nowhere else).
- **Font-stack warning**: a role whose `font` stack starts with `ui-monospace`, `ui-sans-serif`, `ui-serif`, `ui-rounded` or `system-ui` resolves to a different font per engine. Verify prints `warning font:` for each such role (`res.warnings`); it does not fail. Lead the stack with a named family (`Menlo, ui-monospace, monospace`) so both engines measure the same text.
- **AE pixel diff** — when `--refs` exists (needs ImageMagick): `< 0.5%` of pixels differ at 2% fuzz. AE alone passes wrapped labels; parity is what catches them — that is why parity is not optional.

## Finalize

`node bin/finalize.mjs model.json --style style.json --out deck.html` runs `validate --strict` against the model merged with the style, `create` with the same style, and `verify --strict`, in that order, and stops at the first stage that does not pass. It writes `<deck stem>.finalize.json` either way:

| field | holds |
|---|---|
| `engine` | the `package.json` version that ran |
| `model`, `style` | path and sha256 of each input (`style` is `null` without `--style`) |
| `deck` | path and sha256 of the written deck, `null` when `create` did not run |
| `stages` | `validate`, `create`, `verify`, each `{status, errors, warnings, ms}`; status is `pass`, `fail`, `skipped` or `not-run` |
| `ok` | true only when all three passed |

A verify that cannot render (Playwright absent) is `skipped`, and `ok` stays false: a gate that did not run is not a pass. The deck stays on disk when only `verify` fails, so its PNGs can be read.

## Diagnostic codes

Every `validate` finding also lands in `diagnostics`, one per line of `errors` and `warnings`, in the same order: `{code, severity, message, subject, evidence?, fixes}`. `subject` is `{slide, el, id}` for a row (slide 1-based, `el` the row's index in `els`, `id` when the row has one), `{slide}` for a slide, `{master, id}` for a master row, and `{}` for the deck. `node bin/validate.mjs model.json --json` prints them; the `finalize` receipt carries them per stage. The `errors` and `warnings` strings are unchanged.

| family | what it names | example |
|---|---|---|
| `deck/` | canvas size, format, page | `deck/format` |
| `style/` | the roles and `styles.gap` | `style/role-incomplete` |
| `slot/` | slots, layouts, paint slots | `slot/unknown` |
| `contract/` | row and slide props the model contract fixes | `contract/row-type-override` |
| `connector/` | lines, curves, arrows, heads, dashes, routed connectors | `connector/target-unknown` |
| `links/` | `href` targets and link runs | `links/href` |
| `motion/` | `anim` | `motion/anim` |
| `chart/` | chart rows `create` cannot expand | `chart/expand` |
| `template/` | template names and fill keys | `template/fill` |
| `format/` | 16:9 cuts on another canvas | `format/stretched-layout` |
| `density/` | density, word budgets, the foot band | `density/budget` |
| `coverage/` | a slide with words and no graphic | `coverage/text-only` |
| `fit/` | text wider than its box, rows off the canvas | `fit/nowrap-width` (evidence `{need, have}`) |
| `air/` | the gap gate: rows, arrow ends and the foot line | `air/gap` |
| `logo/` | logo row props | `logo/plate` |
| `assets/` | `deck.assets`, image sources, monograms, placeholders | `assets/monogram-known` |
| `entity/` | `deck.entities` and the logo each named company needs | `entity/named-without-logo` |

`fixes` lists the usual repairs for the common codes (`fit/nowrap-width` gives `w: <need>`, `w: 'auto'` and a shorter text) and is empty elsewhere. A code never changes once shipped; a new check takes a new code.

## Thresholds

Every check the two tools run, and what passes:

| check | tool | pass |
|---|---|---|
| contract | `validate --style` | 0 errors (0 warnings with `--strict`) |
| self-contained | `verify` | no `http(s)` src/href, no loaders, no sockets |
| overflow | `verify` parity | `scrollWidth ≤ clientWidth + 1` on every text row |
| single line | `verify` parity | `nowrap` rows and imported single-line rows render 1 line |
| line count | `verify` parity | imported rows: rendered lines == source `_lines` |
| bounds | `verify` parity | every element inside the canvas |
| collision | `verify` parity | no ink through glyphs, no text straddling a container edge, no arrow head inside a fill, no text over text (`over:1` opts out) |
| air | `validate` | no two declared boxes closer than `styles.gap` (default 4) unless contained or `over:1`; estimates warn with `~` |
| occlusion | `verify` parity | no text row under an opaque row painted later in `els` |
| counter | `verify` parity | the page counter's right edge is on `w − styles.margin`, and its box (right edge, top, height) is the same on every slide that shows the footer. The per-slide PNG carries the counter; the AE diff masks its box on both images |
| engines | `verify` parity | every parity check passes in Chromium and in WebKit (macOS by default, `--webkit` forces, `--no-webkit` skips) |
| font stack | `verify` | warning only: no role's stack leads with `ui-monospace`, `ui-sans-serif`, `ui-serif`, `ui-rounded` or `system-ui` |
| page errors | `verify` | none, in either engine |
| AE | `verify --refs` | `< 0.5%` pixels at `-fuzz 2%` (set `--threshold`) |
