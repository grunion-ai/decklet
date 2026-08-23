# Publish notes (delete before push)

## Repo description (one line)
Agent-generated, brand-true, real-time editable presentations and assets — one portable HTML file, no office suite.

## GitHub topics
```
gh repo edit grunion-ai/decklet --add-topic slides,presentation,slide-deck,single-file,html,editable,zero-dependency,agent,llm,ai-agents,claude-code,codex,cursor,skill,carousel,one-pager,pdf,json-model,wysiwyg
```

## Where the name `decklet` appears (sed target if it changes again)
- package.json — `name` (@grunion/decklet), `bin` keys (decklet-create/validate/verify/import-html), scripts
- template.html — `<title>` marker default, storage namespace `decklet:template`, header comment
- deck.html — built from template: title, namespace `decklet:<hash>`, footer master text, cover supertitle + copy (from examples/explainer/model.json)
- bin/create.mjs — default title, namespace prefix `decklet:`
- bin/validate.mjs, bin/verify.mjs, bin/import-html.mjs — header comments
- examples/explainer/model.json — title, footer text, cover text
- SKILL.md — frontmatter `name`, body
- README.md, llms.txt, CHANGELOG.md
- test/gate.test.mjs — namespace assertions (`decklet:template`, `decklet:[hash]`)
- .github/workflows/test.yml — none

Rename: `grep -rl decklet --exclude-dir=node_modules --exclude-dir=.git . | xargs sed -i '' 's/decklet/NEWNAME/g'` then `npm run build:deck && npm test`.

## Before push
- `npm test` green (25 tests; live proofs need Playwright locally)
- `rm NOTES-PUBLISH.md`
- `git remote add origin git@github.com:grunion-ai/decklet.git && git push -u origin main`
- Engine refresh: if the engine file is updated after this snapshot (e.g. the in-file PDF raster writer replacing `print()`), re-run the template patch, rebuild deck.html, and update SKILL.md §6 hand-off item 4 + README feature matrix "PDF" row + the `⤓` test assertion.
