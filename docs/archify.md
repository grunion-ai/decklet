# archify

decklet ships [archify](https://github.com/tt-a1i/archify) (MIT, tt-a1i) at **v3.0.0** in `vendor/archify`. archify turns a typed JSON spec into one standalone, explorable HTML diagram: architecture, workflow, sequence, data flow and lifecycle, with its own validator and export to PNG, SVG and WebM.

## Figure or archify

| Need | Use |
|---|---|
| A diagram on a slide that a person will drag and retype | a decklet figure: `diagramSlide()` or a `figure-*` template, [figures.md](figures.md) |
| A system map, request trace or state machine that stands alone, is read in a browser and gets exported | archify |
| An archify diagram shown inside a deck | its PNG export as an `img` row through `deck.assets`, with the HTML linked by `href` |

An archify SVG never goes in as an `svg` row. The deck contract keeps an `svg` row for fills the engine has no primitive for, and a whole figure is not one.

## Run it

Node 18 or later, nothing to install:

```bash
node vendor/archify/bin/archify.mjs doctor
node vendor/archify/bin/archify.mjs validate architecture spec.json --quality showcase --json
node vendor/archify/bin/archify.mjs deliver architecture spec.json out.html --quality showcase --json
```

The authoring contract is `vendor/archify/SKILL.md`. An agent building a diagram reads that file, never this one.

## The pin

`vendor/archify/` holds the release package, `archify.zip` at the tag, unzipped and unedited. `vendor/archify.lock.json` records the tag, its commit, the zip's SHA-256 and a hash of the unpacked tree. `test/archify.test.mjs` fails on any byte under `vendor/archify` that the lock does not account for, so a local patch belongs upstream.

To move the pin, run one command:

```bash
node bin/archify-sync.mjs               # the latest release
node bin/archify-sync.mjs --tag v3.0.0 # one tag, forward or back
node bin/archify-sync.mjs --check       # exit 1 when a newer release is out
```

The script replaces the tree, rewrites the lock, adds a line under `## Unreleased` in CHANGELOG.md and updates the tag in this page. Review the upstream release notes, run `npm test`, and ship it as its own PR.

The `archify` workflow runs `--check` every Monday. On a newer upstream release it runs the sync, runs the archify gate, pushes branch `archify/<tag>` and stops with a notice on the run that links the compare page. GitHub Actions may not open pull requests in this repository, so open the PR by hand from that branch; the `test` gate starts on its own. Each later run repeats the notice until the branch is merged.
