import { test } from "node:test";
import assert from "node:assert/strict";
import { MARKS, CANON, markSvg, tileSvg, faviconSvg, lockupSvg, PALETTE } from "./build-logos.mjs";

test("canonical mark exists and is one colour, no masks, no external refs", () => {
  assert.ok(MARKS[CANON]);
  const svg = markSvg(CANON);
  assert.match(svg, /viewBox="0 0 48 48"/);
  assert.equal((svg.match(/#[0-9a-f]{6}/gi) ?? []).filter(h => h.toLowerCase() !== PALETTE.blue).length, 0);
  assert.doesNotMatch(svg, /<mask|href=|<script/);
});
test("bowl is 16:9", () => {
  const [, w, h] = markSvg(CANON).match(/width="([\d.]+)" height="([\d.]+)" rx/);
  assert.ok(Math.abs(w / h - 16 / 9) < 1e-3, `${w}/${h}`);
});
test("tile, favicon, lockup render with family palette", () => {
  assert.match(tileSvg(CANON), new RegExp(PALETTE.blue)); assert.match(tileSvg(CANON), new RegExp(PALETTE.cream));
  assert.match(faviconSvg(), /stroke-width="6"/);
  assert.match(lockupSvg(CANON), />decklet</);
});
