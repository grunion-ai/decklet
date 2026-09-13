# The build loop

`validate` and `verify` measure geometry. Neither one has read the brief, so a deck can pass both and still drop a
must-include, put a five-year series in a bullet list, or print a number the brief never gave. This page is the loop
that closes that gap: a coverage manifest written before the model, then a mandatory second pass over the rendered
PNGs. Step 5 of [SKILL.md](../SKILL.md) is where it hangs.

## Why the loop exists

Thirty decks — five briefs, seven setups — were built blind and scored against a hand-built reference deck for the
same brief. An agent working from SKILL.md alone reached 0.878 of the reference; the review pass alone raised the mean
to 0.952 but left its worst deck at 0.691. The manifest plus the review pass reached 0.994 mean and 0.944 on its worst
deck, and beat the reference on three briefs of five at the same 14-minute mean wall time.

## 1. Write the coverage manifest

Before any JSON, write `MANIFEST.md` in the run directory.

- Copy the brief's **must-include** list verbatim, one line each, then add every numbered content bullet the brief
  gives. Beside each line write the slide number that will carry it and the shape that will carry it — template or
  layout, plus the row kind.
- **The brief's slide count is the deck's slide count.** Eight means eight; the manifest is where you find out you have
  nine things and eight slides.
- Every number in the brief gets a manifest line and a slide. A number with no slide is a gap in the plan, and the plan
  is cheap to change. Derived numbers get their arithmetic written out beside them (`0.65 × 14 + 0.35 × 23 = 17.15`),
  so the second pass checks a computation rather than re-doing it.

A manifest that turns up nothing missing still pays: it is the thing that makes you read each slide later as a set of
claims instead of as a layout.

## 2. Build, and pick the shape the content wants

One shape decision per slide, before any row geometry:

- A process or flow has **arrows between its boxes** (`to:` connectors), never unconnected boxes.
- A series of numbers over time is a **chart row**, never a list.
- A before/after is a **delta** — old muted, new accent, a `+/−` chip — never two sentences.
- Options or criteria are a table or a grid with **one row per option**; pricing tiers are cards; goals are tiles with
  a tag each.
- Bullets are for lists of unlike things. Bullets carrying numbers become stats or a table.

## 3. `validate --strict`

Zero errors and zero warnings, against the same `--style` you will pass to `create`. Fix the model, not the output.

## 4. `create`

Run it once and **read the spell flags it prints**. Every real name, product and domain term goes into the model's
`spell.ignore`, then rebuild — a red underline under a customer's name is the first thing a human sees.

## 5. `verify --strict`

`VERIFY PASS`, contract and layout parity on every slide. This is the first pass, not the end of the build.

## 6. The second pass (mandatory)

After the first `VERIFY PASS`, and before anything else, open the PNGs.

**Tick the manifest.** Take `MANIFEST.md` line by line and name the PNG that shows each line. **A line with no PNG is a
missing item** — add the slide or the row before touching anything cosmetic. A brief number that landed on no slide
goes on the slide carrying its subject.

**Then read every PNG against this checklist.**

*Shape* — the four rules in §2, one slide at a time. The shape is easy to get right in the plan and easy to lose in
the JSON.

*Facts* — every number on every slide appears in the brief or is derived from it, and the derivation is right (compute
it). No invented specifics: no "fourth straight quarter", no "GAAP basis", no figure the brief does not give. Edges in
a figure point the way the brief says, with the brief's labels. Every must-include is present.

*Chrome and copy* —

- No slide at reading density leaves its **lower 40% empty**. Deepen the tiles, bind the note or source slot, or move
  content down.
- No slide at speaker density carries a paragraph.
- Cover, footer and supertitle do not say the same thing three times.
- **No orphaned last word.** A label ending on a lone "it." or "overnight." gets rewritten to fit its line; a title
  wrapping to two lines gets shortened. `validate --strict` and `verify --strict` both pass an orphan — the PNG is the
  only place it shows.
- The close is an ask or a CTA.

## 7. Fix, rebuild, verify again

Every fix goes into the model; `create` and `verify` again; `VERIFY PASS` again. Expect two or three rebuilds — in the
study most of them existed for line-breaking alone, which no gate catches and every reader sees.

Hand off on the second PASS, with `verify-out/results.json` and the ticked manifest.
