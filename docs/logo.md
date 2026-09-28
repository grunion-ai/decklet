# Logo rows

A logo row draws a company logo and its name as one row. You state the logo column's width once, and every row in a list with that width puts its name at the same x, whatever shape the logo is. A square mark and a 4.5:1 wordmark line up.

```json
{"logo": "data:image/svg+xml;…", "aspect": 4.507, "plate": "auto", "name": "Xometry", "x": 80, "y": 120, "h": 32, "col": 120, "role": "Body"}
```

| Field | Default | Meaning |
| --- | --- | --- |
| `logo` | none | The image as a `data:` URI. `''` or `null` draws a monogram chip instead. |
| `name` | none | The text beside the logo. Optional. |
| `x`, `y`, `h` | none | The row's origin and the height of the logo column. `h` is required. |
| `col` | `2 × h` | The logo column's width. Give every row in a list the same `col` so the names align. The field is `col` because `slot` already binds a layout slot. |
| `gap` | `8` | Pixels between the column and the name. |
| `plate` | `auto` | The chip behind the logo. `auto` and `light` paint white, `dark` paints near-black (`#15171B`), and `none` and `any` paint nothing. |
| `aspect` | none | The logo's width over its height. With it, the image box and the plate are sized exactly. Without it, the image fills the column's inner box and `object-fit: contain` keeps its shape. |
| `monogram` | the name's initials | The letters on the chip when there is no logo. |
| `role` | `Body` | The type role of the name. |
| `w` | none | The whole row's width. With `w` set, a long name wraps, and later lines run down from the first. Without it, the name stays on one line. |
| `alt` | `<name> logo` | The image's alt text. |

## Geometry

`lib/logo.mjs` holds the arithmetic. The template draws the same boxes, and `test/logo.test.mjs` renders a deck to check that it does.

- **The name** starts at `x + col + gap`. Its first line is centred on the column: the line box's top sits at `y + round((h - lh) / 2)`, where `lh` is the role's line height. A name set larger than the column still centres on it and never aligns to the column's top edge.
- **The plate** is `round(h × 0.14)` px of padding (at least 2) around the image. It is left-aligned in the column and hugs the image when `aspect` is known. The corner radius is `round(h × 0.22)`.
- **The image** contain-fits the space inside the padding and is centred vertically.
- **The monogram chip** is an `h × h` square, or `col × col` when `col` is smaller, drawn in `--fg` with `--card` letters.

## From the asset manifest

`decklet-assets` writes `aspect` and `plate` for every logo (see [assets.md](assets.md)), and both fields drop straight into the row:

```js
const m = manifest.find(r => r.name === 'xometry');
const row = {logo: dataUri(m.file), aspect: m.aspect, plate: m.plate, name: 'Xometry', x: 80, y: 120, h: 32, col: 120};
```

The manifest's `plate` names the background a logo needs. `dark` gets a dark chip, `light` a white one, and `any` gets no chip. Run `decklet-assets logo` with `--style` and the plate is measured against that deck's surface instead (`none` gets no chip either; see [assets.md](assets.md)). To make every chip in a list the same colour, set `plate: "light"` on each row.

## What validate checks

- `logo` must be a `data:` URI or empty. `h` must be positive. `col`, `gap` and `aspect` must be numbers in range. `plate` must be one of the five words.
- A row with no logo, no monogram and no name is an error, because the chip would have nothing to draw.
- **The gap gate** measures the row from `x` to the end of the name. It estimates the name's width from the role unless `w` is set. Two stacked logo rows need `styles.gap` px between them. A text row laid over a name is a collision, because a logo row does not shelter text the way a card does.
- **The coverage gate** counts a logo row as the slide's visual. A monogram chip counts too. With `deck.entities` set, a company named within 120 px of a logo row passes.
