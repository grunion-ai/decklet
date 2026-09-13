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
- **AE pixel diff** — when `--refs` exists (needs ImageMagick): `< 0.5%` of pixels differ at 2% fuzz. AE alone passes wrapped labels; parity is what catches them — that is why parity is not optional.

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
| air | `validate` | no two declared boxes closer than `styles.gap` (default 4) unless contained, grouped or `over:1`; estimates warn with `~` |
| occlusion | `verify` parity | no text row under an opaque row painted later in `els` |
| counter | `verify` parity | the page counter's right edge is on `w − styles.margin`, and its box (right edge, top, height) is the same on every slide that shows the footer. The per-slide PNG carries the counter; the AE diff masks its box on both images |
| page errors | `verify` | none |
| AE | `verify --refs` | `< 0.5%` pixels at `-fuzz 2%` (set `--threshold`) |
