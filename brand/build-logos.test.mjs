import { test } from "node:test";
import assert from "node:assert/strict";
import { MARKS, CANON, markSvg, tileSvg, faviconSvg, lockupSvg, loaderStack, PALETTE } from "./build-logos.mjs";

test("canonical mark is one colour (cuts are masks, not paint), no external refs", () => {
  assert.equal(CANON, "stack");
  const svg = markSvg(CANON);
  assert.match(svg, /viewBox="0 0 48 48"/);
  const paints = [...svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map(m => m[1].toLowerCase()).filter(h => !["#fff", "#000", "#ffffff", "#000000"].includes(h));
  assert.deepEqual([...new Set(paints)], [PALETTE.blue]);
  assert.doesNotMatch(svg, /href=|<script/);
});
test("every card is 16:9", () => {
  for (const [, w, h] of markSvg(CANON).matchAll(/width="([\d.]+)" height="([\d.]+)" rx="3"/g))
    assert.ok(Math.abs(w / h - 16 / 9) < 1e-3, `${w}/${h}`);
});
test("loader: SMIL only, seamless single step, cuts share card keyframes", () => {
  const svg = loaderStack();
  assert.doesNotMatch(svg, /<script|<style|href=/);
  assert.match(svg, /repeatCount="indefinite"/);
  const vals = [...svg.matchAll(/values="([^"]+)"/g)].map(m => m[1].split(";"));
  for (const v of vals) assert.equal(v[1], v[2], "move then hold");
  // a cut's x keyframes = its card's x keyframes shifted by the gap (2.5)
  const xs = [...svg.matchAll(/attributeName="x" values="([\d.]+);([\d.]+)/g)].map(m => [+m[1], +m[2]]);
  assert.ok(xs.some(([a]) => a === 12 - 2.5) && xs.some(([a]) => a === 12), "slot-0 card and its cut both present");
});
test("tile, favicon, lockup render with family palette", () => {
  assert.match(tileSvg(CANON), new RegExp(PALETTE.blue)); assert.match(tileSvg(CANON), new RegExp(PALETTE.cream));
  assert.match(faviconSvg(), /<mask id="fav/);
  assert.match(lockupSvg(CANON), />decklet</);
});
