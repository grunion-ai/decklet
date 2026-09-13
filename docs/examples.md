# Worked examples

Three briefs carried end to end, each with its model and style in `examples/`. Linked from [SKILL.md](../SKILL.md). A fourth path — finished HTML pages into a model — is [docs/import-html.md](import-html.md).

### A — outline → 16:9 slides (`examples/quarterly-update`)
Input (`brief.md`): "Q3 in one page — 1,240 signups (+18%), $86K MRR (+11%), 4.6 CSAT, 12 days TTV; signups Jul 380 · Aug 410 · Sep 450; next: onboarding v2, 3 design partners, hire support." Style: warm paper, serif headlines.

Slide plan: `cover · title` → `numbers · content · 4 Stat tiles + Labels` → `signups · content · 3 bars` → `next · content · 3 tiles`.

Model (the numbers slide):
```json
{ "name": "numbers", "layout": "content", "els": [
  { "slot": "supertitle", "text": "The numbers" },
  { "slot": "title", "text": "Growth held. Time-to-value halved." },
  { "x": 60,  "y": 170, "w": 195, "h": 110, "tile": 1, "role": "Stat", "text": "1,240" },
  { "x": 60,  "y": 292, "w": 195, "role": "Label", "align": "center", "text": "Signups · +18%" },
  { "x": 60, "y": 360, "w": 840, "role": "Body", "text": "Signups and revenue grew on the same curve as Q2. …" }
]}
```
```
node bin/validate.mjs examples/quarterly-update/model.json --style examples/quarterly-update/style.json
node bin/create.mjs --model examples/quarterly-update/model.json --style examples/quarterly-update/style.json --out q3.html --format slides
node bin/verify.mjs q3.html
```

### B — social post → carousel (`examples/launch-carousel`)
Input: four beats (hook, problem, how, CTA). Style inferred from product screenshots: near-black, violet accent. Canvas 1080×1080, so roles scale ×1.9 (Title 120, H1 72, Body 30, Stat 120).

One layout `card` with `supertitle` at y 120 and `title` at y 170; the "how" card is three `box` rows in a row.
```json
{ "format": "carousel", "layouts": { "card": { "supertitle": { "x": 90, "y": 120, "w": 900, "role": "Supertitle" }, "title": { "x": 90, "y": 170, "w": 900, "role": "H1" } } },
  "master": [ { "id": "foot", "footer": 1, "x": 690, "y": 990, "w": 300, "align": "right", "role": "Label", "text": "swipe" } ],
  "slides": [ { "name": "hook", "layout": "card", "els": [ { "slot": "supertitle", "text": "New" }, { "slot": "title", "text": "Your docs are a deck now." } ] } ] }
```
```
node bin/create.mjs --model examples/launch-carousel/model.json --style examples/launch-carousel/style.json --out carousel.html --format carousel
node bin/verify.mjs carousel.html
```
Experimental: 1:1 sizing, editing and one-page-per-card PDF work; per-card PNGs come from `node bin/export.mjs carousel.html --png --scale 2` (one square PNG per card, the way LinkedIn and Instagram take a carousel); `node bin/pdf.mjs carousel.html` gives one card per page (vector) for a document post.

### C — doc → two-page one-pager (`examples/one-pager`)
Input: title, problem, three benefits, one number; page 2: three steps, pricing, contact. No brand → neutral light style in `style.json`. Canvas 816×1056 so roles scale ×0.75 (Title 48, H1 28, Body 12).

Each page is a slide on layout `page` (supertitle y 72, title y 92, 72 px margins). Page 2 starts a new slide — text does not flow.
```
node bin/create.mjs --model examples/one-pager/model.json --style examples/one-pager/style.json --out one-pager.html --format document-letter
node bin/verify.mjs one-pager.html
```
Print zoom is exactly 1 for `document-*` formats: the page IS the canvas.
