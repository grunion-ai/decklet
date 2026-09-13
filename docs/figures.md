# Figures

## The spec API

`import {diagramSlide} from '@grunion/decklet/diagram'`: `diagramSlide(spec, {supertitle, title, caption})` returns a ready `diagram` slide from a spec of `nodes` (`shape` rect / pill / diamond / circle, `state` chosen / lost, `title`, `sub`), `edges` (`from`, `to`, `label`, `state`), dashed `groups`, a `timeline` of ticks and a `note`, plus the one `label` the figure claims; `diagramRows(spec, frame)` gives the rows alone for a free frame. Nodes carry explicit x/y/w/h on the spec's own canvas (840×320 fills the frame 1:1) and keep 4px inside it; a target to the right routes H-V-H, anything else V-H-V; the chosen path wears the accent, a lost branch is dashed. An `svg` row is for a fill the engine has no primitive for (a Sankey ribbon, an area band) — never for text, never for a whole figure. **Where the labels land:** a group's label sits inside its top-left corner, at `X(g.x) + 12, Y(g.y) + 6`, so start the first node in a zone at least 32px below the group's `y` or the two share that corner. An edge label rides the run nearest the target — centred 18px above a horizontal run, beside the vertical on a bend — and when it does not fit that run it lifts to `Y(tops) - 22`, clear above the tops of the two nodes it joins, which is the band a group label occupies. One rule decides both, and the auto-router asks it before every placement: `fits(run, text)` wants the label's own width (8px a character, plus 8) plus 16px of air, so a channel narrower than that is what turns a label into a lifted one and widening the channel is what puts it back on its run. For a figure the templates do not cover, import the module directly: `import {diagramSlide} from '@grunion/decklet/diagram'` from a package consumer (the `./diagram` export in package.json), or `import {diagramSlide} from './lib/diagram.mjs'` from a script beside a checkout — the same file by either path.

## The nine figures

**Figures** are the figure kinds as templates, each the rows `diagramSlide()` makes from a spec (§ GRAPHICS) on the `diagram` layout, reading density, with a caption that states the claim:

| id | figure | the sample shows |
|---|---|---|
| `figure-decision` | options → one pick, a timeline, a note | three options into one contract; chosen path in accent, loser dashed, three release ticks |
| `figure-flow` | a request through hops | order → storefront → warehouse; the stock-out branch dashed to the supplier |
| `figure-before-after` | the edge that changes | invoices by email (dashed, above) against a portal hop (accent, below) |
| `figure-data-model` | entities and relations | account → order → shipment has-many chain; contact linked off account |
| `figure-states` | a record's lifecycle | a lead new → won in accent; lost the dashed branch off new |
| `figure-release` | versions on a rule | six ticks, 1.0 filled, a note naming the gate for 2.0 |
| `figure-boundaries` | regions a request crosses | shop · head office · bank as dashed groups; the daily close in accent |
| `figure-boundaries-6` | seven nodes across three zones | the advanced architecture: storefront · our platform · partner bank, six labelled edges, the money path in accent |
| `figure-tree` | questions and answers | two diamonds, three pills; full refund in accent, decline dashed |
| `figure-layers` | dependencies one way | three full-width layers, two downward edges, a note for the missing edge |

Fill the keys like any template, or copy the spec shape from `lib/templates/cat-figures.mjs` and call `diagramSlide()` for a figure of your own.
