# Assets: logos, screenshots, monograms

`decklet-assets` (`node bin/assets.mjs`) gathers the images a deck needs before you write the model. Each command writes one file and upserts a row into `manifest.json` in the same folder:

```json
{"name": "xometry", "file": "xometry.svg", "source": "site", "url": "https://…/xometry-logo.svg", "aspect": 4.507, "plate": "any"}
```

| Field | Meaning |
| --- | --- |
| `name` | The key. A bare name slugs as-is (`"3D Systems"` → `3dsystems`); a domain slugs its first label (`xometry.com` → `xometry`). `--name` overrides it. |
| `file` | The file beside the manifest. |
| `source` | `simple-icons`, `site`, `site-icon`, `s2` or `monogram` for a logo; the page URL for a screenshot. |
| `url` | The exact file a logo came from, so you can cite or replace it. |
| `aspect` | Width over height of the painted area. Size the image box from it: `w = h * aspect`. |
| `plate` | The background the logo needs. `dark`: a white or light mark that vanishes on a light slide. `light`: a black or navy mark that vanishes on a dark slide. `any`: coloured or opaque, reads on either. |

Re-running a command replaces that row; it never duplicates it.

## logo

```bash
node bin/assets.mjs logo xometry --out assets/logos
node bin/assets.mjs logo "Formlabs" --out assets/logos
node bin/assets.mjs logo "3D Systems" --domain 3dsystems.com --out assets/logos
```

The command tries four sources in order and keeps the first usable file:

1. **simple-icons** from jsDelivr, by the simple-icons slug of the name and of the domain. These are black single-path marks in a 24×24 box, so the command re-fits the viewBox to the painted bounding box. Without the re-fit a wordmark renders at a third of its height.
2. **The company site.** It fetches `https://<domain>` (then `www.`), ranks header `<img>` logos (SVG first, then those naming the company, inverse variants last), then SVG icon links, `apple-touch-icon` and PNG icons. `.ico`, JPEG and WebP are skipped.
3. **Google s2**, a 256px site favicon.
4. **A monogram**: the initials on a colour hashed from the name. It always succeeds, so check `source` in the manifest and replace monograms by hand when a real logo matters.

The domain is guessed as `<slug>.com` for a bare name; pass `--domain` when that guess is wrong. Skipped sources print to stderr with the reason.

Every SVG gets its viewBox fitted to what it paints (a pure path parser; Playwright's `getBBox` for SVGs with transforms or shapes other than paths). The plate comes from rendering the logo on a transparent page and averaging how bright its painted pixels are, so a light wordmark with a grey accent still reads as `dark`. Without Playwright it falls back to the SVG's fill colours. PNG logos are decoded and weighed the same way; one that is fully opaque brings its own background and reads `any`.

Use the manifest when you build the model. Put a `plate: dark` logo on a dark chip or a dark slide, never directly on white.

## shot

```bash
node bin/assets.mjs shot https://www.xometry.com/quoting/home/ --out assets/shots/quote.webp --crop 0,80,1440,760 --width 1440
```

Loads the page in Playwright Chromium at `--width` (default 1440), waits `--wait` ms after load (default 800), and captures the `--crop x,y,w,h` region in CSS pixels, or the first 900px of the viewport without a crop. The extension picks the format: `.webp` (quality 0.82, the smallest), `.png` or `.jpg`. The row records the source URL, the crop and the width, so the shot can be retaken after the page changes.

## monogram

```bash
node bin/assets.mjs monogram "Hexagon AB" --out assets/logos
```

Writes the fallback directly: a 64×64 rounded square with up to two initials in white.

## Offline and tests

`lib/assets.mjs` holds the pure half: slugs, path bounding boxes (lines, both Bézier kinds with their extrema, arcs), viewBox fitting, plate detection, a PNG decoder, candidate ranking and the manifest upsert. `test/assets.test.mjs` covers it offline. The network tests skip when jsDelivr is unreachable and the screenshot test skips without Playwright.
