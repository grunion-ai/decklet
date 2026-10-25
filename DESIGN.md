# decklet design system

decklet's own brand: the mark, the loader, the lockup and the editor HUD. The client style kits a deck is built with live in `examples/styles/` and the STYLE CONTRACT in `SKILL.md`, not here. Source of truth: `brand/README.md` and `brand/build-logos.mjs` (`PALETTE`, `MARKS`), decided 2026-08-23.

## Tokens

The palette is the grunion family.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `blue` | `#2563eb` | | Canonical one-colour mark, favicon, loader, app-icon tile fill, lockup mark on light |
| `sky` | | `#60a5fa` | Lockup mark on dark |
| `ink` | `#0c1b33` | | Lockup wordmark on light, ink mark on light |
| `cream` | | `#e0dcd4` | Lockup wordmark on dark, cream mark and loader on dark, mark on the app-icon tile |
| `white` | `#ffffff` | | Mark on blue |

## Type

- Wordmark: "decklet", lowercase, weight 600, letter-spacing -0.02em.
- Wordmark stack: `Outfit, Inter, system-ui, -apple-system, sans-serif`. No webfont: the lockup SVG carries the stack.

## Marks

The mark is "stack": three 16:9 slides stacked back to front, a deck drawn small. One colour on a 48-unit grid. The under-cards are cut with SVG masks (gap 2.5, favicon 3.5), so every asset is transparent-safe. All files sit in `brand/assets/`.

- `decklet-mark-mono-blue.svg`: the canonical one-colour mark.
- `decklet-mark-ink.svg`, `decklet-mark-white.svg` and `decklet-mark-mono-cream.svg`: on light, on blue and on dark.
- `decklet-tile.svg`: the app icon, a blue squircle (rx 11) carrying a cream mark.
- `decklet-favicon.svg`: 16 to 32 px.
- `decklet-lockup.svg` / `decklet-lockup-dark.svg`: mark plus wordmark, inline, the mark scaled to the wordmark's ascender height.
- `decklet-loader.svg` / `decklet-loader-cream.svg`: the canonical SMIL loader.
- `decklet-loader-light.gif` / `decklet-loader-dark.gif`: the loader for the README and for image proxies that do not run SMIL.

## Components

- Loader: each card advances one slot. The front card drops behind the deck while a new card fades in at the back, so one step leaves the picture as it started and a single 0.9 s step loops without a jump. The under-card cuts carry the same keyframes as the cards that cut them. SMIL only, so it animates inline, in `<img>` and as a CSS background.
- HUD: the control set is the manifest in `docs/editor.md`, and the gate compares it against the template, so a control is never added or dropped without that line changing. Each control is a Lucide shape carrying movingicons.dev motion: it plays once on load, a beat apart, and once per hover, never loops, and reduced motion stills it. Every control's `aria-label` carries the same words as its tooltip, shortcut included (CHANGELOG.md).
- Save button: one Lucide save glyph. Calm when saved, amber with a count when edits are not in the file yet, an amber "Not saving" pill on the tab-only route, a pulse while writing, and a green dot (`#3fb950`) when the file holds every edit (README.md, CHANGELOG.md).
- Touch: under `(pointer: coarse)` HUD and toolbar buttons are 44 px tall and a colour swatch is a 44 px target around a round 20 px dot (`docs/editor.md`).

## Regenerate

- Assets: `node brand/build-logos.mjs`
- Candidate sheet: `node brand/build-logos.mjs docs --candidates`
- Gate: `node --test brand/build-logos.test.mjs`
- PNG previews: `node brand/render-png.mjs in.svg out.png [scale]`. GIFs: `node brand/render-gif.mjs`, which steps the SVG's own SMIL clock, then runs ffmpeg. Both use Playwright Chromium, because ImageMagick drops SVG masks.

## Refusals

- No webfonts, in the lockup or anywhere in a deck.
- No background-coloured gap paint: cuts in the mark are masks.
- No looping HUD motion.
