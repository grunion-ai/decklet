// Rasterize brand SVGs to PNG via headless Chromium (Playwright). magick drops SVG masks.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const req = createRequire(process.env.PW_ROOT ? process.env.PW_ROOT + "/" : import.meta.url);
const { chromium } = req("playwright");
const [svg, png, scale = "2"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ deviceScaleFactor: +scale });
const s = readFileSync(svg, "utf8");
const [w, h] = s.match(/viewBox="[\d. ]+ ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
await page.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
await page.setContent(`<body style="margin:0">${s.replace("<svg ", `<svg width="${w}" height="${h}" `)}</body>`);
await page.screenshot({ path: png, omitBackground: true });
await browser.close();
