# Security

## What decklet does and does not do

- A deck is one static HTML file. It opens from disk, makes **no network requests**, and stores its autosave in the browser's `localStorage` for that file only.
- The CLI (`validate`, `create`, `verify`, `import-html`) reads the files you name and writes the files you name. It does not phone home.
- A model may carry inline SVG and `html` rows, which render **inside the deck's own origin**. Treat a deck from someone you do not trust the way you would treat any HTML file from them: open it in a browser profile you do not mind, or read the model first.
- `import-html` runs a real browser (Playwright) against the pages you point it at. Only point it at pages you trust.

## Supported versions

The latest tagged release and `main`.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repo (Security tab, "Report a vulnerability"); it is enabled and reaches the maintainers without a public issue. Include the deck or model that demonstrates the problem. You will get a reply from a person within seven days, and a fix or a written reason before any public disclosure. Please do not open a public issue for an unpatched vulnerability.
