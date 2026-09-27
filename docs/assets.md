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
| `url` | The exact file a logo came from, so you can cite or replace it. An SVG drawn inline in the site's header records the page URL with `#inline-svg`. |
| `fallback` | `true` on a monogram the `logo` command fell back to. The explicit `monogram` command leaves it off. |
| `aspect` | Width over height of the painted area. Size the image box from it: `w = h * aspect`. |
| `plate` | The background the logo needs. `dark`: a white or light mark that vanishes on a light slide. `light`: a black or navy mark that vanishes on a dark slide. `any`: coloured or opaque, reads on either. |

Re-running a command replaces that row; it never duplicates it. Each write takes `manifest.json.lock`, merges its row into the current file and renames a temp file over it, so commands run in parallel into one folder keep every row.

## logo

```bash
node bin/assets.mjs logo xometry --out assets/logos
node bin/assets.mjs logo "Formlabs" --out assets/logos
node bin/assets.mjs logo "3D Systems" --domain 3dsystems.com --out assets/logos
node bin/assets.mjs logo sendcutsend.com vizcom.ai protolabs.com --out assets/logos --strict
node bin/assets.mjs logo Plasticity --file downloads/plasticity-mark.svg --out assets/logos
```

`logo` takes several names in one run and prints one manifest row per line.

Pass `--file <path>` to import a local SVG or PNG instead of fetching one: it normalises the file the same way as any other source (viewBox re-fit, transparent-padding trim, plate detection) and writes a manifest row with `source: "file"` and `url` the file's resolved path. `--file` takes exactly one name. A file that is missing, has an extension other than `.svg`/`.png`, or turns out unusable falls straight to the monogram; it never tries simple-icons, the site or s2, since an explicit file is the whole point of the flag.

Without `--file`, the command tries four sources in order and keeps the first usable one:

1. **simple-icons** from jsDelivr, by the simple-icons slug of the name and of the domain. These are black single-path marks in a 24×24 box, so the command re-fits the viewBox to the painted bounding box. Without the re-fit a wordmark renders at a third of its height.
2. **The company site.** It fetches `https://<domain>` (then `www.`) and ranks the site's own mark first: an `<img>` or inline `<svg>` inside a link to the home page, then one inside `<header>` or `<nav>`, SVG before PNG, those naming the company before others, inverse variants and customer or partner strips last. A candidate whose file name, alt text or title names a different company is dropped, so a vendor homepage's "trusted by" strip (Cisco on SendCutSend, Dell on Vizcom) never lands. The company is matched by the name and the domain's first label; words such as `logo`, `white`, `header` and hashed build suffixes don't count as a name. SVG icon links, `apple-touch-icon` and PNG icons follow. `.ico`, JPEG and WebP are skipped. If the domain itself now redirects to a different company (an acquired or sold domain), the whole site is refused, and every individual candidate's fetch is checked the same way: its final URL, after every redirect, must land on that domain or a subdomain of it, or it is refused and the reason recorded. This is what stopped `logo altair.com` from saving Siemens' icon after Altair's domain started forwarding there.
3. **Google s2**, a 256px site favicon.
4. **A monogram**: the initials on a colour hashed from the name. The row carries `fallback: true`, and the run ends with `missed: <names>` on stderr. Add `--strict` to exit 1 when anything was missed, so a build script stops instead of shipping an "H" for Hexagon. Replace the file by hand, or pass `--domain` when the guessed site was wrong.

The domain is guessed as `<slug>.com` for a bare name; pass `--domain` when that guess is wrong. Skipped sources print to stderr with the reason.

Every SVG gets its viewBox fitted to what it paints (a pure path parser; Playwright's `getBBox` for SVGs with transforms or shapes other than paths). The bounding box counts invisible geometry too, such as an unfilled background rect, so with Playwright the command then renders the fitted SVG and trims the viewBox to the painted pixels; that is what made Protolabs draw at a third of its size. A PNG with transparent padding is cropped to its painted pixels the same way. A logo that paints nothing is rejected and the next source is tried; so is one that paints one colour edge to edge, such as an SVG using `currentColor` with no stylesheet around it, which renders as a flat plate rather than a mark (this is what stopped a Plasticity import from landing as a black square). A real mark that happens to be a single flat colour, like most simple-icons marks, is unaffected, since it always leaves negative space around its own shape once fitted. The plate comes from rendering the logo on a transparent page and averaging how bright its painted pixels are, so a light wordmark with a grey accent still reads as `dark`. Without Playwright it falls back to the SVG's fill colours. PNG logos are decoded and weighed the same way; one that is fully opaque brings its own background and reads `any`.

Use the manifest when you build the model. Put a `plate: dark` logo on a dark chip or a dark slide, never directly on white.

## shot

```bash
node bin/assets.mjs shot https://www.xometry.com/quoting/home/ --out assets/shots/quote.webp --crop 0,80,1440,760 --width 1440
```

Loads the page in Playwright Chromium at `--width` (default 1440), waits `--wait` ms after load (default 800), and captures the `--crop x,y,w,h` region in CSS pixels, or the first 900px of the viewport without a crop. Before capture it hides cookie and consent overlays: the common consent-manager containers (OneTrust, Cookiebot, Usercentrics, Didomi, Osano and others), elements whose id or class names cookies or consent, and any fixed or sticky element whose text mentions cookies, consent or GDPR. `html` and `body` are never hidden. The extension picks the format: `.webp` (quality 0.82, the smallest), `.png` or `.jpg`. The row records the source URL, the crop and the width, so the shot can be retaken after the page changes.

## monogram

```bash
node bin/assets.mjs monogram "Hexagon AB" --out assets/logos
```

Writes the fallback directly: a 64×64 rounded square with up to two initials in white.

## Offline and tests

`lib/assets.mjs` holds the pure half: slugs, path bounding boxes (lines, both Bézier kinds with their extrema, arcs), viewBox fitting, plate detection, a PNG decoder and encoder, transparent-padding trim, candidate ranking with the wrong-company check, the redirect-host check (`sameOrSubdomain`), the blank-plate check (`nearUniformColor`), the consent-overlay CSS and the locked manifest write. `test/assets.test.mjs` covers it offline against fixtures: a vendor homepage with a customer-logo strip, sixteen parallel writes into one manifest, local SVG/PNG fixtures for `--file` (a real mark, a blank plate, a missing file, a bad extension), and a mocked `fetch` for the redirect guard, so the off-domain and same-domain-redirect cases never touch the network. `DECKLET_ASSETS_OFFLINE=1` makes every network source fail, which is how the test drives the monogram fallback and `--strict`. The network tests skip when jsDelivr is unreachable and the screenshot test skips without Playwright.
