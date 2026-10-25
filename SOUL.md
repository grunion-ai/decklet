# decklet soul

## Purpose

decklet turns any content into an editable slide deck, delivered as one self-contained HTML file. The deck is a JSON model, the file is the editor, and a verifier checks the layout before a person sees it (README.md).

## Audience

Agents (Claude Code, Codex, Cursor, any tool-using model) that must turn content into a deck a person will then edit. The person gets a file they can open and change; the agent gets a contract it can validate before a browser is involved (README.md, "Who it is for").

## Positioning

decklet is an open-source alternative to PowerPoint, Keynote, Gamma and the PPTX-generator skills for coding agents. Next to HTML slide skills in the frontend-slides mould it adds in-place editing, an enforced brand type scale, an in-file PDF writer and a layout gate, with zero dependencies, zero network and an MIT license. Pick decklet when an agent drafts the deck and a person finishes it by hand. Pick a PPTX skill when the deliverable has to be a `.pptx`, and Slidev or Marp when the author writes markdown by hand (README.md, "How decklet compares").

## Refusals

- No runtime dependency, build step, network request or second file next to `deck.html`. A change that adds one is declined on shape, whatever its quality (CONTRIBUTING.md).
- No webfonts, CDNs or remote images. Images are data: URIs, and nothing is fetched when a deck opens (README.md, "Guarantees").
- No ninth text role and no per-element font size (CONTRIBUTING.md).
- No version history in the file: that left for weave in 0.9.0 (README.md).
- No deck content in a bug report: no word, image or token from the deck, and nothing is sent until the person presses send (README.md, "Bugs").
