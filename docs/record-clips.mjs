#!/usr/bin/env node
// The three clips on the explainer's "filmed" slide — drive deck.html headlessly, film a cropped region of the
// real editor, and write each GIF back into examples/explainer/model.json as a data: URI. The clips are therefore
// a build product of the engine, not a screen capture: re-run this, then rebuild the deck.
//   node docs/record-clips.mjs && node bin/create.mjs --model examples/explainer/model.json --out deck.html --title decklet
//   CHROME=<chromium> PW_ROOT=<dir with node_modules/playwright> FFMPEG=<ffmpeg> to override the toolchain.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(process.env.PW_ROOT ? process.env.PW_ROOT + "/" : import.meta.url)("playwright");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const W = 960, H = 540, FPS = 10, GIF_W = 360, COLORS = 48;   // 360 px of GIF inside a 270 px row: sharp on retina, small on disk

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: "dark" });
const ev = (fn, arg) => page.evaluate(fn, arg);
const box = async sel => { const b = await page.locator(sel).first().boundingBox(); return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, ...b } };
// crop: a 16:9 window named in MODEL pixels (the coordinates the deck is authored in), mapped through the live canvas rect
const crop = async (x, y, w) => { const c = await page.locator("#canvas").boundingBox(), k = c.width / W, h = w * 9 / 16;
  return { x: Math.round(c.x + x * k), y: Math.round(c.y + y * k), width: Math.round(w * k), height: Math.round(h * k) } };
const viewport = { x: 0, y: 0, width: W, height: H };

async function film(name, region, act) {
  const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "decklet-clip-"));
  let n = 0;
  const shot = () => page.screenshot({ path: join(dir, `f${String(n++).padStart(4, "0")}.png`), clip: region });
  const hold = async s => { for (let i = 0; i < Math.round(s * FPS); i++) { await page.waitForTimeout(1000 / FPS); await shot() } };
  const glide = async (x0, y0, x1, y1, s) => { const k = Math.round(s * FPS); for (let i = 1; i <= k; i++) { const t = i / k, e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; await page.mouse.move(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e); await page.waitForTimeout(1000 / FPS); await shot() } };
  await act({ hold, glide, shot });
  const out = join(dir, name + ".gif");
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%04d.png"),
    "-vf", `scale=${GIF_W}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${COLORS}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
    "-loop", "0", out]);
  const gif = readFileSync(out);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${name}: ${n} frames @ ${FPS} fps = ${(n / FPS).toFixed(1)} s · ${(gif.length / 1024).toFixed(0)} KB`);
  return "data:image/gif;base64," + gif.toString("base64");
}

const reset = async () => { await page.goto(pathToFileURL(join(root, "deck.html")).href); await ev(() => { try { localStorage.clear() } catch {} }); await page.reload(); await page.waitForSelector("#canvas .el"); await page.mouse.move(W / 2, H + 40) };
const go = async n => { await ev(k => { i = k; render() }, n); await page.waitForTimeout(700) };

await reset();
// ── 1. drag · multi-select — the Stat and its label move together, inside the roles slide's right column ──
await go(2);
const stat = await box('#canvas .el:has-text("1,024")'), lab = await box('#canvas .el:has-text("Stat · 40 / 44")');
const drag1 = await film("drag", await crop(600, 122, 360), async ({ hold, glide }) => {
  await hold(0.4);
  await page.mouse.click(stat.cx, stat.cy); await hold(0.35);
  await page.mouse.click(lab.cx, lab.cy, { modifiers: ["Meta"] }); await hold(0.45);
  await page.mouse.move(stat.cx, stat.cy); await page.mouse.down();
  await glide(stat.cx, stat.cy, stat.cx - 34, stat.cy + 80, 0.9);
  await page.mouse.up(); await hold(0.7);
  await page.keyboard.press("Escape"); await hold(0.4);
});

// ── 2. retype · marks — double-click into a row, replace it, embolden a run ──
await reset(); await go(5);
const row = await box('#canvas .el:has-text("⌘Z undoes")');
const retype = await film("retype", await crop(40, 244, 455), async ({ hold }) => {
  await hold(0.4);
  await page.mouse.dblclick(row.cx, row.cy); await hold(0.5);
  await page.keyboard.press("Meta+a"); await hold(0.3);
  await page.keyboard.type("Type straight onto the slide.", { delay: 45 }); await hold(0.5);
  await page.keyboard.press("Meta+a"); await hold(0.3);
  await page.click('#tb button[data-cmd="bold"]').catch(() => {}); await hold(0.8);
});

// ── 3. contact sheet · reorder — grab slide 3, drop it first ──
await reset();
await page.click("#grid-btn"); await page.waitForSelector("#sheet:not([hidden]) .cell"); await page.waitForTimeout(300);
const sheet = await film("sheet", viewport, async ({ hold, glide }) => {
  await hold(0.6);
  const c3 = await box('#grid .cell[data-n="2"]'), c1 = await box('#grid .cell[data-n="0"]');
  await page.mouse.move(c3.cx, c3.cy); await hold(0.2);
  await page.mouse.down(); await page.mouse.move(c3.cx + 6, c3.cy + 6);
  await glide(c3.cx + 6, c3.cy + 6, c1.cx, c1.cy, 0.9);
  await page.mouse.up(); await hold(0.8);
});
await browser.close();

// write the three clips back into the model, in slide order, without reformatting the hand-authored JSON
const file = join(root, "examples", "explainer", "model.json");
let src = readFileSync(file, "utf8"), k = 0;
const clips = [drag1, retype, sheet];
src = src.replace(/"img": "data:image\/gif;base64,[^"]*"/g, () => `"img": "${clips[k++]}"`);
if (k !== clips.length) throw new Error(`model has ${k} gif rows, recorded ${clips.length}`);
writeFileSync(file, src);
console.log(`wrote ${k} clips into examples/explainer/model.json — rebuild with: node bin/create.mjs --model examples/explainer/model.json --out deck.html --title decklet`);
