// The style shelf, in sheet order: the neutral five a deck starts from, then the six cut on 2026-09-13 from a survey of
// colour combinations and display faces (eight were built; `cocoa-peach` and `black-cherry` were cut on review). ONE list — templates/build-sheet.mjs builds the sheet's Styles section from it and
// test/styles.test.mjs gates every kit against the STYLE CONTRACT, so a new kit is a directory plus a line here.
export const KITS = ['warm', 'dark', 'graphite-amber', 'navy-blue', 'display',
  'ocean-ember', 'grove-maroon', 'cyan-charcoal', 'turquoise-midnight', 'liberty-red', 'yellow-forest'];
export default KITS;
