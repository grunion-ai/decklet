# Contributing to decklet

Thanks for looking. decklet stays small on purpose: one HTML file is the engine, the editor and the deck, and four Node scripts are the whole toolchain. The constraints below are why it keeps working from a `git clone`.

## Before you start

- **Open an issue before a large change.** A feature that adds a runtime dependency, a build step, a network request, or a second file next to `deck.html` will be declined on shape, whatever its quality.
- **Read [`SKILL.md`](SKILL.md) first.** It is the contract the engine, the validator and the verifier all enforce. A change that makes the three disagree is a bug even when each part looks right on its own.

## Setup

```bash
git clone https://github.com/grunion-ai/decklet && cd decklet
npm test                       # node --test; live browser tests skip when Playwright is absent
npm i -D playwright && npx playwright install chromium && npm run test:live
```

Node 22 or newer. Nothing else to install for the engine or the CLI.

## The rules

1. **Tests first, and green.** `npm test` runs the gate: engine contract, validator, `create`, `import-html`, and the live proofs. Add a test for the behaviour you change; a fix without a failing test first is a guess.
2. **The eight roles stay the only type scale.** No per-element font sizes, no ninth role. Brand-true output depends on it, and `validate` will reject the model anyway.
3. **Motion never changes what is measured.** Print, the contact sheet, the PDF and `verify` draw the settled frame. Keep it that way.
4. **One file, zero network.** No webfonts, no CDNs, no remote images. The gate greps for it.
5. **Template and engine stay in sync.** `template.html` is the engine with an empty model; `deck.html` is the same engine carrying the explainer. Change the engine in one place and rebuild the other with `npm run build:deck`.
6. **Atomic pull requests.** One change, one PR, a description that says what changed, why, and how you verified it. Screenshots for anything visual.

## Where things go

| Change | Place |
| --- | --- |
| Engine, editor, renderer | `template.html` (then `npm run build:deck`) |
| Model contract, errors, warnings | `bin/validate.mjs` + `SKILL.md` |
| Layout parity, collisions, pixel diff | `bin/verify.mjs` |
| HTML pages to model | `bin/import-html.mjs` |
| Worked examples | `examples/<name>/brief.md` + `model.json` |
| Layout library | `templates/` |

## License

By contributing you agree that your work is licensed under the [MIT License](LICENSE) that covers the repo.
