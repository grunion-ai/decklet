#!/usr/bin/env node
// README demo GIF — drives the explainer deck (deck.html) headlessly and films it, so the GIF is a
// build product of the engine, not a hand-made screen capture. Same recipe as brand/render-gif.mjs:
// Playwright Chromium frames -> ffmpeg palettegen/paletteuse. Writes docs/demo.gif + docs/demo-poster.png.
//   CHROME=<chromium> PW_ROOT=<dir with node_modules/playwright> FFMPEG=<ffmpeg> node docs/record-demo.mjs
import { mkdtempSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.PW_ROOT ? process.env.PW_ROOT + "/" : import.meta.url)("playwright");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here);
mkdirSync(out, { recursive: true });
const W = 960, H = 540, FPS = 10;
const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "decklet-demo-"));
let n = 0;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: "dark" });
await page.goto(pathToFileURL(resolve(here, "..", "deck.html")).href);
await page.evaluate(() => { try { localStorage.clear() } catch {} });
await page.reload();
await page.waitForSelector("#canvas .el");
await page.waitForTimeout(1400);   // let the cover settle: frame 0 is also the poster
await page.mouse.move(W / 2, H + 40);
const shot = () => page.screenshot({ path: join(dir, `f${String(n++).padStart(4, "0")}.png`) });
// hold(sec): film a still for that long; glide(from,to,sec): move the mouse while filming
const hold = async s => { for (let i = 0; i < Math.round(s * FPS); i++) { await page.waitForTimeout(1000 / FPS); await shot() } };
const glide = async (x0, y0, x1, y1, s) => { const k = Math.round(s * FPS); for (let i = 1; i <= k; i++) { const t = i / k, e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; await page.mouse.move(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e); await page.waitForTimeout(1000 / FPS); await shot() } };
const box = async sel => { const b = await page.locator(sel).first().boundingBox(); return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, ...b } };

await hold(0.8);                                              // cover (settled: frame 0 is the poster)
await page.keyboard.press("ArrowRight"); await hold(0.5);     // model
await page.keyboard.press("ArrowRight"); await hold(0.5);     // roles
// drag the Stat "1,024" down-left, then drop
const stat = await box('#canvas .el:has-text("1,024")');
await page.mouse.move(stat.cx, stat.cy); await hold(0.25);
await page.mouse.down(); await glide(stat.cx, stat.cy, stat.cx - 140, stat.cy + 110, 0.9);
await page.mouse.up(); await hold(0.4);
await page.keyboard.press("Escape"); await hold(0.25);         // deselect
// page through to the filmed slide — every headline enters on its own, which is the point
for (const _ of [0, 1, 2, 3]) { await page.keyboard.press("ArrowRight"); await hold(0.3) }
await hold(1.5);                                               // the three inlined clips play in place
await page.keyboard.press("ArrowRight"); await hold(0.7);      // graphics: the bars wipe in
await page.keyboard.press("ArrowRight"); await hold(1.8);      // motion: rise · fade · pop · wipe, tile then caption
// contact sheet: open, grab slide 3, drag it onto slide 1's spot, drop
await page.click("#grid-btn"); await page.waitForSelector("#sheet:not([hidden]) .cell"); await hold(0.5);
const c3 = await box('#grid .cell[data-n="2"]'), c1 = await box('#grid .cell[data-n="0"]');
await page.mouse.move(c3.cx, c3.cy); await hold(0.2);
await page.mouse.down(); await page.mouse.move(c3.cx + 6, c3.cy + 6);
await glide(c3.cx + 6, c3.cy + 6, c1.cx, c1.cy, 0.9); await page.mouse.up(); await hold(0.6);
await page.keyboard.press("Escape"); await hold(0.3);          // back to the slide
// ⤓ PDF (headless download is discarded) — the autosave dot sits beside it
const pdf = await box("#pdf");
await glide(W / 2, H - 10, pdf.cx, pdf.cy, 0.35);
page.on("download", d => d.cancel().catch(() => {}));
await page.click("#pdf").catch(() => {}); await hold(0.8);

await browser.close();
copyFileSync(join(dir, "f0000.png"), join(out, "demo-poster.png"));
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%04d.png"),
  "-vf", "split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
  "-loop", "0", join(out, "demo.gif")]);
rmSync(dir, { recursive: true, force: true });
console.log(`wrote docs/demo.gif (${n} frames @ ${FPS} fps = ${(n / FPS).toFixed(1)} s) + docs/demo-poster.png`);
