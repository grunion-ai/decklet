#!/usr/bin/env node
// Loader SVG → GIF (GitHub's image proxy does not run SMIL). Frames are taken by
// stepping the SVG's own SMIL clock, so the GIF is a build product of the same
// generator, not a hand-made file. Needs Playwright Chromium + ffmpeg.
//   CHROME=<chromium|headless-shell> PW_ROOT=<dir with node_modules/playwright> FFMPEG=<ffmpeg> node brand/render-gif.mjs
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loaderStack, PALETTE, LOADER_CYCLE_MS } from "./build-logos.mjs";

const { chromium } = createRequire(process.env.PW_ROOT ? process.env.PW_ROOT + "/" : import.meta.url)("playwright");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const out = join(dirname(fileURLToPath(import.meta.url)), "assets");
mkdirSync(out, { recursive: true });
const S = 96, FRAMES = 45, FPS = Math.round(FRAMES / (LOADER_CYCLE_MS / 1000));
const BUILDS = [["decklet-loader-light.gif", PALETTE.blue, "#ffffff"], ["decklet-loader-dark.gif", PALETTE.cream, "#0d1117"]];

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: S, height: S }, deviceScaleFactor: 2 });
for (const [file, c, bg] of BUILDS) {
  const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "decklet-gif-"));
  await page.setContent(`<body style="margin:0;background:${bg}">${loaderStack({ c }).replace("<svg ", `<svg width="${S}" height="${S}" `)}</body>`);
  await page.evaluate(() => document.querySelector("svg").pauseAnimations());
  for (let i = 0; i < FRAMES; i++) {
    await page.evaluate(t => document.querySelector("svg").setCurrentTime(t), (i / FRAMES) * LOADER_CYCLE_MS / 1000);
    await page.screenshot({ path: join(dir, `f${String(i).padStart(3, "0")}.png`) });
  }
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%03d.png"),
    "-vf", "split[a][b];[a]palettegen=reserve_transparent=0[p];[b][p]paletteuse=dither=none", "-loop", "0", join(out, file)]);
  rmSync(dir, { recursive: true, force: true });
  console.log("wrote", file);
}
await browser.close();
