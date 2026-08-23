# Changelog

## 0.3.0 — initial public release

- Engine: single-file JSON-model deck with in-place editor — drag, ⌘ multi-select, double-click text edit with B/I/U/S and colour runs, corner-nib resize, persisted undo, floating role toolbar, `+` Text/Box/Slide, contact sheet (select/reorder/duplicate/delete), fullscreen presentation with hover-peek HUD, print to PDF with named page sizes (Safari-safe), per-slide backgrounds.
- Model: seven-role strict type scale, layout slots + deck-scope slots, master layer with fork/hide and inline footer counter, primitives box/tile/bar/line/donut/svg/img, `nowrap` / `w:'auto'` / padding tokens for text fit, `anim:'rise'`.
- Formats: `slides` (960×540, 1600×900). Experimental page-size presets `carousel`, `carousel-4x5`, `document-letter`, `document-a4` (no text flow).
- CLI: `bin/validate.mjs` (pure Node), `bin/create.mjs` (per-deck storage namespace from the model hash, style.json tokens/roles merge), `bin/verify.mjs` (layout parity + AE + contract), `bin/import-html.mjs` (HTML pages → model with master/slot/role lifting and line-count intent).
- SKILL.md agent authoring contract, four examples, `node --test` gate with optional live browser proofs.
