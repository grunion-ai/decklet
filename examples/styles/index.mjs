// The style shelf, in sheet order: the neutral five a deck starts from, then the eight cut on 2026-09-13 from a survey of
// colour combinations and display faces. ONE list — templates/build-sheet.mjs builds the sheet's Styles section from it and
// test/styles.test.mjs gates every kit against the STYLE CONTRACT, so a new kit is a directory plus a line here.
export const KITS = ['warm', 'dark', 'graphite-amber', 'navy-blue', 'display',
  'ocean-ember', 'grove-maroon', 'cyan-charcoal', 'cocoa-peach', 'turquoise-midnight', 'liberty-red', 'black-cherry', 'yellow-forest'];
export default KITS;
