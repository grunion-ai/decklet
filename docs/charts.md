# The chart row

One row is one chart. `create` expands it into bars, lines, dots, labels and a baseline — ordinary rows you can then drag, retype or delete. Linked from [SKILL.md](../SKILL.md)'s GRAPHICS.


`{x, y, w, h, chart: {mark: 'bar'|'line', data: [{label, value, compare?, muted?, text?}], encoding?: {max, min}, annotations?: [{at, text}], source?}}` — or `{slot:'chart', chart:{…}}` on the `chart` library layout. `create` expands it into the ordinary rows you would otherwise hand-build (bars, `line` segments, dot rects, `Label` rows), so the deck stays hand-editable and the runtime draws no charts; `validate` refuses a chart with fewer than two points, a non-numeric value, or no numbers at all — no numbers, no chart. The drawing rules are baked in and are the rules a reviewer holds a hand-built chart to:

- **Bars start at zero.** Every bar stands on the baseline; `encoding.min` is honoured on a line only (a rate hovering at 58–66 need not be plotted from zero).
- **One explicit scale with a max label.** The top of the plot is `encoding.max` or the smallest 1·1.2·1.5·2·2.5·3·4·5·6·8 × 10ⁿ above the data, stated as a `Label` tick at the left; `0` (or `min`) sits at the baseline.
- **Direct value labels, no legend.** Every point or bar carries its number in `Label`, `var(--fg)`; `text` on a datum overrides the formatting (`"$1.2M"`).
- **Grey dashed baseline.** `var(--muted)`, 1px, `dash:1`.
- **Monochrome depth.** The first series is the full accent; a `compare` value draws a second bar or stroke at 60% opacity; an item flagged `muted:true` goes grey so the takeaway reads in the chart.
- **A line is one stroke with dots.** 2.5px accent segments, 8px dots. Value labels beside a rising stroke are placed automatically at the first of six spots (above, above-left, above-right, then below) that touches no stroke, dot, leader or other label — the offset the branded deck had to find by hand.
- **Annotations are words at a point.** `{at: index, text}` turns that dot green (`var(--ok, var(--accent))`) and hangs a hairline leader from a `Caption` at the top of the box; the point's own value label moves below to keep the leader clear.
- **Source line in Caption at the bottom** of the box, from `source`.

After `create`, the rows are the chart: drag a bar, retype a value label, delete a dot — the model round-trips like any other row. To change the data, edit the `chart` row in the model and re-create.
