# Connectors — the shapes a deck may draw

`diagramRows()` (`lib/diagram.mjs`, and every figure template) already routes to these rules, so a figure built through the spec path needs none of this. Read it when you draw a `line` or `curve` by hand. Linked from [SKILL.md](../SKILL.md)'s GRAPHICS.


Ruled on two connector probes. `validate` warns on the ones it can measure; the rest are here. A deliberate exception is
declared with `waive:1` on the row — never by ignoring the warning.

**A connector is a stroke with a head.** Every rule below is about a line that *points at* something. A headless stroke is
a rule, an underline, an annotation leader, a chart series or decoration — it has no target, so none of these apply to it
and `validate` says nothing about it. That boundary was ruled by hand (G1's 1.5px *with* a head rejected; H5's 1px hairline
leader accepted), and it is what keeps the warnings worth reading: a validator that flags a chart for being diagonal
teaches you to ignore it. A headed stroke under 40px is an icon, not a run between boxes, and is exempt too.

| rule | do | not |
|---|---|---|
| **Straight runs are orthogonal** | horizontal, vertical, right-to-left | a diagonal — draw an elbow of two orthogonal segments *(warned)* |
| **S-curves need room** | a channel of **96px or more** | squeezing a curve into a tighter channel — re-cut the layout. A harder bend does not rescue it *(warned)* |
| **Control points** | 50% or 90% of the run, or straight out perpendicular (vertical-out / horizontal-in) | 25% of the run, past the endpoint, or a quarter turn *(first two warned)* |
| **Termination** | leave air — `gap` 10 is the default; `to:`/`from:` applies it | touching a border or landing inside a fill *(warned + a `verify` failure)* |
| **Even air** | the same gap at both ends | 4px at one end and 16px at the other *(warned)* |
| **Weight** | **2.5px or heavier** for a headed connector | 1.5px with a head. A *headless* annotation leader may be a 1px hairline *(warned)* |
| **Fan-out** | two S-curves from one edge, or straight diagonals / elbows when the geometry is orthogonal | a **shared stub** — a segment that feeds a point two connectors leave from, even with matched tangents *(warned)*. Two curves straight off one point, with nothing feeding it, is fine |
| **Entry** | enter the target on the face the connector comes from | top-edge entry, or a back-edge return to the side it left |

`dash` and `head` are engine features, not hand-work: never fake a dash with a `repeating-linear-gradient` on `bg` (it
cannot know the run length, so the last dash is sliced, and it silently eats the head), and never mock a dot or bar
terminator out of extra rows (they land off centre).
