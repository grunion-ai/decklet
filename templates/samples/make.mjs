#!/usr/bin/env node
// make.mjs — renders the sample media the library sheet binds to its image templates and layouts, so every byte in
// templates/samples/ is a build product of this file: nothing photographed, nothing downloaded, nothing to licence.
//   photo-1.jpg   an abstract hillside at dusk (an SVG scene rasterised by Chromium, JPEG q72)
//   photo-2.jpg   an abstract harbour at night (same route)
//   ui-shot.png   a mocked event dashboard for a fictional company (HTML rasterised at 1×)
//   clip.gif      the same dashboard, a retry clicked and the row flipping to delivered — 24 frames at 10 fps,
//                 48 colours through ffmpeg palettegen/paletteuse, the way docs/record-clips.mjs films the editor
//   node templates/samples/make.mjs        CHROME=<chromium> FFMPEG=<ffmpeg> to override the toolchain
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const out = dirname(fileURLToPath(import.meta.url));
const FPS = 10, FRAMES = 24;

// ── two "photos": layered gradients and soft shapes, blurred a little so they read as pictures, not diagrams
const hillside = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" width="960" height="640">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a4a"/><stop offset=".55" stop-color="#d9784a"/><stop offset="1" stop-color="#f6c98b"/></linearGradient>
<linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b5d3a"/><stop offset="1" stop-color="#1e3320"/></linearGradient>
<linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a7d46"/><stop offset="1" stop-color="#2f4a2b"/></linearGradient>
<linearGradient id="h3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8aa35a"/><stop offset="1" stop-color="#4c6a38"/></linearGradient>
<radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3c4"/><stop offset=".6" stop-color="#f9b567" stop-opacity=".9"/><stop offset="1" stop-color="#f9b567" stop-opacity="0"/></radialGradient>
<filter id="soft"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="haze"><feGaussianBlur stdDeviation="14"/></filter></defs>
<rect width="960" height="640" fill="url(#sky)"/>
<circle cx="690" cy="330" r="150" fill="url(#sun)" filter="url(#haze)"/><circle cx="690" cy="330" r="46" fill="#fff0c0"/>
<g filter="url(#soft)">
<path d="M0 420 C160 360 300 380 460 350 C620 320 760 330 960 300 L960 640 L0 640 Z" fill="url(#h1)" opacity=".92"/>
<path d="M0 480 C140 430 320 470 480 440 C660 410 800 450 960 400 L960 640 L0 640 Z" fill="url(#h2)"/>
<path d="M0 560 C180 500 380 540 560 520 C740 500 860 540 960 510 L960 640 L0 640 Z" fill="url(#h3)"/>
</g>
<g fill="#fff" opacity=".5"><circle cx="120" cy="90" r="1.6"/><circle cx="240" cy="60" r="1.2"/><circle cx="410" cy="110" r="1.4"/><circle cx="540" cy="50" r="1"/><circle cx="820" cy="80" r="1.5"/><circle cx="900" cy="150" r="1.1"/></g>
<rect width="960" height="640" fill="#000" opacity=".06"/>
</svg>`;
const harbour = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" width="960" height="640">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b1a"/><stop offset=".7" stop-color="#26325c"/><stop offset="1" stop-color="#5a6a9a"/></linearGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2748"/><stop offset="1" stop-color="#0a0f22"/></linearGradient>
<filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter><filter id="glow"><feGaussianBlur stdDeviation="6"/></filter></defs>
<rect width="960" height="640" fill="url(#sky)"/>
<rect y="392" width="960" height="248" fill="url(#sea)"/>
<g fill="#0c1230">${[[40, 250, 70, 150], [130, 190, 60, 210], [210, 300, 90, 100], [320, 160, 80, 240], [420, 230, 60, 170], [500, 120, 110, 280], [630, 270, 70, 130], [720, 200, 90, 200], [830, 260, 60, 140], [900, 210, 60, 190]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}</g>
<g fill="#ffd27a" opacity=".85">${[[58, 270], [72, 310], [150, 220], [162, 260], [340, 190], [356, 240], [372, 300], [520, 150], [540, 190], [560, 250], [580, 320], [740, 230], [760, 290], [850, 290], [920, 240], [930, 300]].map(([x, y]) => `<rect x="${x}" y="${y}" width="6" height="9"/>`).join('')}</g>
<g filter="url(#glow)" opacity=".55">${[[58, 470], [150, 440], [340, 500], [520, 430], [560, 520], [740, 460], [850, 510], [920, 450]].map(([x, y]) => `<rect x="${x - 4}" y="${y}" width="14" height="70" fill="#ffd27a"/>`).join('')}</g>
<g filter="url(#soft)" stroke="#8fa3d8" stroke-opacity=".35" fill="none">${[410, 440, 470, 500, 530, 560, 590, 620].map(y => `<path d="M0 ${y} Q120 ${y - 4} 240 ${y} T480 ${y} T720 ${y} T960 ${y}"/>`).join('')}</g>
<path d="M0 392 L960 392" stroke="#3a4a7a" stroke-width="2"/>
<rect x="600" y="360" width="280" height="34" fill="#141a36"/><rect x="600" y="352" width="280" height="8" fill="#1f2a4f"/>
</svg>`;

// ── the dashboard: a fictional event platform (Relay), the screen a reviewer touches. `state` flips the third row.
const dashboard = (state = 0, cursor = null) => `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0 } body { width: 1040px; height: 540px; overflow: hidden; background: #f4f5f8; font: 13px/1.4 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1c2130; position: relative }
  aside { position: absolute; left: 0; top: 0; width: 200px; height: 540px; background: #141a2b; color: #cfd5e6; padding: 22px 18px }
  aside b { display: block; color: #fff; font-size: 16px; margin-bottom: 26px; letter-spacing: .2px } aside i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; background: #5b8cff; margin-right: 8px; vertical-align: -1px }
  aside div { padding: 9px 10px; border-radius: 6px; margin-bottom: 4px; font-size: 13px } aside .on { background: #263252; color: #fff }
  main { position: absolute; left: 200px; top: 0; right: 0; height: 540px; padding: 22px 26px }
  h1 { font-size: 18px; font-weight: 600; margin-bottom: 4px } .sub { color: #6b7284; margin-bottom: 18px }
  .cards { display: flex; gap: 14px; margin-bottom: 18px } .card { flex: 1; background: #fff; border: 1px solid #e3e6ee; border-radius: 10px; padding: 14px 16px }
  .card small { color: #6b7284; display: block; margin-bottom: 4px } .card strong { font-size: 22px; font-weight: 600 } .card em { font-style: normal; color: #1f9d55; font-size: 12px; margin-left: 8px } .card em.bad { color: #c0392b }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e3e6ee; border-radius: 10px; overflow: hidden }
  th { text-align: left; font-weight: 500; color: #6b7284; padding: 10px 14px; border-bottom: 1px solid #e3e6ee; background: #fafbfd } td { padding: 11px 14px; border-bottom: 1px solid #eef0f5 } tr:last-child td { border: 0 }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #e6f6ec; color: #1f7a44 } .chip.bad { background: #fdeaea; color: #b03a2e } .chip.wait { background: #fff4d6; color: #8a6100 }
  .mono { font-family: "SF Mono", Menlo, monospace; font-size: 12px; color: #4a5164 }
  button { font: inherit; font-size: 12px; padding: 5px 11px; border-radius: 6px; border: 1px solid #cfd5e6; background: #fff; color: #1c2130 } button.hot { background: #2f5bff; border-color: #2f5bff; color: #fff }
  .cursor { position: absolute; width: 18px; height: 24px; pointer-events: none }
</style>
<aside><b><i></i>Relay</b><div>Overview</div><div class="on">Events</div><div>Endpoints</div><div>Retries</div><div>Keys</div><div>Billing</div></aside>
<main><h1>Events · last hour</h1><div class="sub">4 endpoints · 2 failing · retry queue 3</div>
<div class="cards"><div class="card"><small>Delivered</small><strong>41,208</strong><em>+3.1%</em></div><div class="card"><small>Failed</small><strong>${state ? 16 : 17}</strong><em class="bad">−${state ? 6 : 5}</em></div><div class="card"><small>Median latency</small><strong>84 ms</strong><em>−6 ms</em></div><div class="card"><small>Retrying</small><strong>${state === 1 ? 4 : 3}</strong></div></div>
<table><tr><th>Event</th><th>Endpoint</th><th>Attempts</th><th>Status</th><th></th></tr>
<tr><td class="mono">evt_9f3a…c21</td><td>payments.granite.example</td><td>1</td><td><span class="chip">delivered</span></td><td></td></tr>
<tr><td class="mono">evt_9f3a…c1e</td><td>orders.summit.example</td><td>1</td><td><span class="chip">delivered</span></td><td></td></tr>
<tr><td class="mono">evt_9f39…b77</td><td>hooks.cedar.example</td><td>${state === 2 ? 4 : 3}</td><td>${state === 2 ? '<span class="chip">delivered</span>' : state === 1 ? '<span class="chip wait">retrying</span>' : '<span class="chip bad">failed · 503</span>'}</td><td>${state === 0 ? '<button class="hot">Retry</button>' : ''}</td></tr>
<tr><td class="mono">evt_9f39…b70</td><td>payments.granite.example</td><td>1</td><td><span class="chip">delivered</span></td><td></td></tr>
<tr><td class="mono">evt_9f38…a02</td><td>hooks.harbor.example</td><td>2</td><td><span class="chip bad">failed · timeout</span></td><td><button>Retry</button></td></tr>
</table></main>
${cursor ? `<svg class="cursor" style="left:${cursor[0]}px;top:${cursor[1]}px" viewBox="0 0 18 24"><path d="M2 2 L2 19 L6.5 15 L9.5 22 L12.5 20.5 L9.5 13.5 L15 13.5 Z" fill="#111" stroke="#fff" stroke-width="1.4"/></svg>` : ''}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
for (const [name, svg] of [['photo-1.jpg', hillside], ['photo-2.jpg', harbour]]) {
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  writeFileSync(join(out, name), await page.screenshot({ type: 'jpeg', quality: 72, clip: { x: 0, y: 0, width: 960, height: 640 } }));
}
await page.setViewportSize({ width: 1040, height: 540 });
await page.setContent(dashboard());
writeFileSync(join(out, 'ui-shot.png'), await page.screenshot({ type: 'png' }));

// the clip: the pointer glides to Retry, presses it, the row goes retrying, then delivered — filmed at half size
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const dir = mkdtempSync(join(tmpdir(), 'decklet-clip-'));
const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const from = [560, 470], to = [940, 336];   // the Retry button on the third row
for (let f = 0; f < FRAMES; f++) {
  const t = f / (FRAMES - 1);
  let state = 0, cur;
  if (t < .45) { const k = ease(t / .45); cur = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]; }
  else if (t < .55) { cur = to; }
  else if (t < .8) { state = 1; cur = to; }
  else { state = 2; cur = [to[0] + 30 * (t - .8) / .2, to[1] + 18 * (t - .8) / .2]; }
  await page.setContent(dashboard(state, cur));
  writeFileSync(join(dir, `f${String(f).padStart(4, '0')}.png`), await page.screenshot({ type: 'png' }));
}
await browser.close();
const vf = 'fps=10,scale=520:-1:flags=lanczos';
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-vf', `${vf},palettegen=max_colors=48:stats_mode=diff`, join(dir, 'p.png')]);
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-i', join(dir, 'p.png'), '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=none`, '-loop', '0', join(out, 'clip.gif')]);
rmSync(dir, { recursive: true, force: true });
for (const n of ['photo-1.jpg', 'photo-2.jpg', 'ui-shot.png', 'clip.gif']) console.log(`${n}\t${Math.round(statSync(join(out, n)).size / 1024)} KB`);
