# The chart row

One row is one chart. `create` expands it into bars, lines, dots, labels and a baseline — ordinary rows you can then drag, retype or delete. Linked from [SKILL.md](../SKILL.md)'s GRAPHICS.


`{x, y, w, h, chart: {mark: 'bar'|'line'|'hbar', data: [{label, value, compare?, muted?, text?, logo?, aspect?, plate?}], lead?: px, encoding?: {max, min}, annotations?: [{at, text}], source?}}` — or `{slot:'chart', chart:{…}}` on the `chart` library layout. `create` expands it into the ordinary rows you would otherwise hand-build (bars, `line` segments, dot rects, `Label` rows), so the deck stays hand-editable and the runtime draws no charts; `validate` refuses a chart with fewer than two points, a non-numeric value, or no numbers at all — no numbers, no chart. The drawing rules are baked in and are the rules a reviewer holds a hand-built chart to:

- **Bars start at zero.** Every bar stands on the baseline; `encoding.min` is honoured on a line only (a rate hovering at 58–66 need not be plotted from zero).
- **One explicit scale with a max label.** The top of the plot is `encoding.max` or the smallest 1·1.2·1.5·2·2.5·3·4·5·6·8 × 10ⁿ above the data, stated as a `Label` tick at the left; `0` (or `min`) sits at the baseline.
- **Direct value labels, no legend.** Every point or bar carries its number in `Label`, `var(--fg)`; `text` on a datum overrides the formatting (`"$1.2M"`).
- **Grey dashed baseline.** `var(--muted)`, 1px, `dash:1`.
- **Monochrome depth.** The first series is the full accent; a `compare` value draws a second bar or stroke at 60% opacity; an item flagged `muted:true` goes grey so the takeaway reads in the chart.
- **A line is one stroke with dots.** 2.5px accent segments, 8px dots. Value labels beside a rising stroke are placed automatically at the first of six spots (above, above-left, above-right, then below) that touches no stroke, dot, leader or other label — the offset the branded deck had to find by hand.
- **Annotations are words at a point.** `{at: index, text}` turns that dot green (`var(--ok, var(--accent))`) and hangs a hairline leader from a `Caption` at the top of the box; the point's own value label moves below to keep the leader clear.
- **Source line in Caption at the bottom** of the box, from `source`.

## Ranked horizontal bars: `mark: 'hbar'`

`{chart: {mark: 'hbar', data: [{label, value, text?, muted?, highlight?}], sort?: 'desc'|'asc', lead?: px, encoding?: {max}, source?}}` draws the landscape form: one bar per row, top to bottom, a label column at the left, a grey dashed vertical zero baseline, and the value `Label` at each bar end. The same rules hold: every bar starts at zero on one scale, stated by a `0` label under the baseline and a max label under the plot's right end; direct value labels, no legend; source in `Caption` at the bottom.

- **Sort.** `sort: 'desc'` ranks largest first, `'asc'` smallest first; without `sort` the model order stands. Sorting never reorders the model.
- **One highlighted bar.** `highlight: true` on one datum keeps that bar in the accent and turns the rest grey at 60%, so the takeaway reads in the chart. `validate` refuses two highlights. With no highlight every bar is the accent and `muted: true` greys one.
- **No compare series.** `validate` refuses `compare` on an hbar; use `mark: 'bar'` for two series.
- **The lead box.** `lead: 60` reserves 60px at the left of the label column on every row and moves the names over by that width plus 8px. `hbarGeometry(row, roles)` from `lib/chart.mjs` returns, per datum in drawn order, `{datum, lead, label, bar, value}` boxes (and `.scale`), for anything that needs the raw numbers; a `logo` on the datum (below) draws into `lead` on its own.

## A logo per datum

Any datum on `mark: 'bar'` or `mark: 'hbar'` (not `'line'`) can carry `logo` — a `data:` URI, or an asset `'#id'` another build step resolves; `chart.mjs` never inspects the value, it only places it — plus the optional `aspect` (width/height) and `plate` (`'auto'|'light'|'dark'|'none'|'any'`) that a [logo row](logo.md) takes. `chart.lead` must be set to a px width (hbar) or height (bar) to give the logo room; `validate` refuses a logo with no `lead`. The logo is sized and plated by the same geometry a logo row uses (`lib/logo.mjs`'s `logoGeom`), so a chart logo matches every other logo in the deck:

- **hbar** draws the logo in the reserved lead box at the left of its row, beside the label.
- **bar** draws the logo in a band under the category label, `lead` px tall, at each bar's own column.

```json
{"chart": {"mark": "hbar", "lead": 60, "sort": "desc",
  "data": [{"label": "Vizcom", "value": 52, "text": "$52M", "logo": "data:image/svg+xml;base64,…"}, …]}}
```

After `create`, the rows are the chart: drag a bar, retype a value label, delete a dot, drag a logo's plate — the model round-trips like any other row. To change the data, edit the `chart` row in the model and re-create.
