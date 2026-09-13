# Finished HTML pages → model

When the source is already HTML at a fixed viewport (mockups, a static site's pages):
```
node bin/import-html.mjs --w 1600 --h 900 --out model.json --shots shots/ 'pages/*.html'   # --shots writes shots/<page>.png
node bin/create.mjs --model model.json --out deck.html --space 1600x900
node bin/verify.mjs deck.html --refs shots/
```
The importer lifts recurring chrome into `master`, heading signatures into layout slots, style signatures into the eight roles (a cover headline larger than any content `H1` becomes `Title`), and records `_lines`/`nowrap` intent so parity can compare against the source. `--shots` screenshots each page at the model viewport (before the walker touches the DOM) to `shots/<page-basename>.png` and records the paths under `report.refs` — that is exactly the filename `verify --refs` resolves. Read `model.report.json`: `conflicts` lists rows whose size was snapped to their role — those are the source's own inconsistencies, decide whether to keep the snap.
