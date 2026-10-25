# decklet

A slide engine for agents: the deck is a JSON model, the renderer is the editor, and `create` writes one self-contained `deck.html` a person can drag, retype, present and print. It ships as the `@grunion/decklet` package, a Claude Code plugin and an agent skill (`SKILL.md`).

## Build and run

- Node 22 or newer. Nothing to install for the engine or the CLI.
- Optional browser tooling for `verify`, `pdf` and `import-html`: `npm i -D playwright && npx playwright install chromium`
- The authoring loop, from the repo root:
  - `node bin/new.mjs --out model.json --slides 8 --density reading`
  - `node bin/validate.mjs model.json --style style.json --strict`
  - `node bin/create.mjs --model model.json --style style.json --out deck.html --format slides`
  - `node bin/verify.mjs deck.html --strict`
- Rebuild the explainer deck: `npm run build:deck`
- Rebuild the template pack: `npm run build:library`
- Host a deck so any browser can save edits: `node bin/serve.mjs deck.html`
- Regenerate the brand assets: `node brand/build-logos.mjs`

## Test

- Suite: `npm test` (runs `node --test test/**/*.test.mjs`; live browser tests skip when Playwright is absent)
- Live proofs: `npm run test:live`
- Narrow the browser projects for a local run: `DECKLET_PROJECTS=chromium,firefox`
- Brand assets: `node --test brand/build-logos.test.mjs`
- CI gate: `.github/workflows/test.yml`, job `gate`, on every pull request and every push to `main`. It runs `npm i -D playwright && npx playwright install --with-deps chromium webkit firefox`, then `node --test test/**/*.test.mjs`.
- Rules the gate holds (CONTRIBUTING.md):
  - Every behaviour change comes with a test.
  - The eight text roles stay the only type scale.
  - Motion never changes what print, the contact sheet, the PDF or `verify` measure.
  - One file, zero network: no webfonts, CDNs or remote images.
  - `template.html` and `deck.html` stay in sync.

## Ship

- One change per pull request. The description says what changed, why, and how it was verified, with screenshots for anything visual (CONTRIBUTING.md).
- Open an issue before a large change. A runtime dependency, a build step, a network request or a second file next to `deck.html` is declined on shape.
- `deck.html` and `library.html` are generated under byte-identity gates (`test/kpi.test.mjs`, `test/library.test.mjs`). A change to `template.html`, `bin/create.mjs`, `lib/`, `templates/` or `examples/explainer` rebuilds both with `npm run build:deck` and `npm run build:library` in the same PR, and again on `main` after the merge. Never resolve a conflict in either file by hand: take either side and rebuild.
- A version bump moves `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` and a `CHANGELOG.md` heading together (ROADMAP.md, "Release lockstep").
- Deploy: GitHub Pages serves the repo root from `main`, so a merge publishes https://grunion-ai.github.io/decklet/deck.html and https://grunion-ai.github.io/decklet/library.html.
- Verify the deploy: open both URLs and confirm the change is there.
- Vendored archify updates: `docs/archify.md`. The weekly `archify` workflow pushes `archify/<tag>`, and a person opens the PR by hand.

## Pointers

- Authoring contract (model, style, thresholds, anti-patterns): `SKILL.md`. Machine summary and file map: `llms.txt`.
- Where each kind of change goes: `CONTRIBUTING.md`, "Where things go".
- The build loop and the second pass: `docs/building.md`.
- Editor, HUD, persistence, PDF: `docs/editor.md`.
- Charts, connectors, figures, logos, assets, verify, examples: `docs/`.
- Plan and sequencing: `ROADMAP.md`.
- Visual system: `DESIGN.md`.
- Purpose and positioning: `SOUL.md`.
- Security reports: `SECURITY.md`.
