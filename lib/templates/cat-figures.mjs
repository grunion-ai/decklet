// Figures — the nine figure kinds as templates: decision, flow, before / after, data model, states, release, boundaries,
// tree, layers. Every sample is a spec through lib/diagram.mjs, so the rows are the same rows an agent gets from
// diagramSlide(); the template is the worked example to fill (or to copy the spec shape from). Drawn on an 840×320
// canvas, the `diagram` frame 1:1. The samples speak for the sheet's fictional companies (Forage, Tallyline, Meridian
// Partners, Stride, Relay, Fieldsense) — placeholder copy a buyer pictures swapping for their own.
import {diagramRows, diagramLayout} from '../diagram.mjs';

const {frame} = diagramLayout('960x540');
const W = 840, H = 320;
const node = (id, x, y, title, sub, state, extra = {}) => ({id, x: x + 8, y, w: 200, h: 60, title, sub, ...(state ? {state} : {}), ...extra});
const fig = (id, name, tier, note, spec, supertitle, title, caption) => ({id, name, tier, cat: 'Figures', density: 'reading', note, layout: 'diagram',
  els: [{slot: 'supertitle', text: supertitle}, {slot: 'title', text: title}, ...diagramRows({w: W, h: H, ...spec}, frame), {slot: 'caption', text: caption}]});

export default [
fig('figure-decision', 'Decision — options, the pick, a timeline', 'standard', 'Three options into one outcome: the chosen path in accent, the loser dashed, release ticks and a note beside.', {
  label: 'Buying won; the build stays as the fallback',
  nodes: [node('build', 0, 24, 'Build in-house', 'two engineers, a year'), node('buy', 0, 128, 'Buy a platform', 'twelve-month contract', 'chosen'),
    node('partner', 0, 232, 'Partner', 'revenue share', 'lost'), node('pick', 280, 128, 'One vendor contract', 'signed in March', 'chosen')],
  edges: [{from: 'build', to: 'pick'}, {from: 'buy', to: 'pick', state: 'chosen', label: 'signed'}, {from: 'partner', to: 'pick', state: 'lost'}],
  timeline: {x: 560, y: 158, w: 260, ticks: [{label: 'Q1', sub: 'shortlist', filled: true}, {label: 'Q2', sub: 'pilot'}, {label: 'Q3', sub: 'rollout'}]},
  note: {x: 560, y: 236, lines: ['exit clause at month six:', 'two stores live on the platform', 'or the build resumes']},
}, 'Decision', 'Three options, one pick', 'Buying won on time to market; the in-house build stays as the fallback, and partnering is off the table until next year.'),

fig('figure-flow', 'Flow — the path a request takes', 'core', 'Left to right through three hops, one same-column branch dashed for the exception path.', {
  label: 'An order goes storefront, hub, kitchen; only a short crop reaches the farm',
  nodes: [node('c', 0, 128, 'Kitchen', 'orders by 9 pm'), node('shop', 240, 128, 'Storefront', 'builds the basket'), node('hub', 480, 128, 'Hub', 'packed overnight', 'chosen'), node('farm', 480, 232, 'Farm', 'confirms by 6 pm')],
  edges: [{from: 'c', to: 'shop', label: 'order'}, {from: 'shop', to: 'hub', state: 'chosen', label: 'pick'}, {from: 'hub', to: 'farm', state: 'lost', label: 'short crop'}],
  note: {x: 0, y: 40, lines: ['96% on the dock by 7 am, last quarter', 'the short-crop path is the dashed edge']},
}, 'Flow', 'Where an order goes', 'The hub sits between the storefront and the kitchen; the dashed short-crop edge is the only path that waits on a farm.'),

fig('figure-before-after', 'Before / after — the edge that changes', 'core', 'Two rows of the same system: the old path dashed above, the new hop in accent below.', {
  label: 'Invoices move from a shared inbox to a portal; the portal owns the queue',
  nodes: [node('c1', 0, 32, 'Client', 'before'), node('inbox', 560, 32, 'Shared inbox', 'threads go missing', 'lost'),
    node('c2', 0, 200, 'Client', 'after', 'chosen'), node('portal', 280, 200, 'Portal', 'one queue, one owner', 'chosen'), node('ledger', 560, 200, 'Ledger', 'posted same day', 'chosen')],
  edges: [{from: 'c1', to: 'inbox', state: 'lost', label: 'email'}, {from: 'c2', to: 'portal', state: 'chosen', label: 'upload'}, {from: 'portal', to: 'ledger', state: 'chosen', label: 'in order'}],
  note: {x: 0, y: 130, lines: ['the edge that changes: client to inbox is gone']},
}, 'Before / after', 'One edge changes', 'Invoices stop arriving by email. The portal is the new hop, and it is what puts every invoice in one queue with one owner.'),

fig('figure-data-model', 'Data model — entities and their relations', 'standard', 'A has-many chain with labelled edges, one bent edge carrying its label beside the vertical.', {
  label: 'An account owns orders, orders own shipments, contacts hang off accounts',
  nodes: [node('acct', 0, 24, 'Account', 'tier, region, owner', 'chosen'), node('order', 300, 24, 'Order', 'number, total'), node('ship', 600, 24, 'Shipment', 'carrier, status'),
    node('ct', 300, 200, 'Contact', 'name, role')],
  edges: [{from: 'acct', to: 'order', label: 'has many'}, {from: 'order', to: 'ship', label: 'has many'}, {from: 'acct', to: 'ct', label: 'linked to', state: 'lost'}],
  note: {x: 600, y: 216, lines: ['dedup key: account +', 'normalized order number,', 'never the email subject']},
}, 'Data model', 'Four entities, three relations', 'Account is the root. Two orders with the same account and number collapse into one, so a forwarded email never makes a duplicate.'),

fig('figure-states', 'States — a record through its lifecycle', 'standard', 'Five states, the winning path in accent, the exit branch dashed.', {
  label: 'A lead moves new to won; lost is the branch off new',
  nodes: [node('new', 0, 60, 'New', 'no contact yet'), node('contacted', 240, 60, 'Contacted', 'call booked', 'chosen'), node('proposal', 480, 60, 'Proposal', 'terms sent', 'chosen'),
    node('won', 480, 200, 'Won', 'contract signed', 'chosen'), node('lost', 240, 200, 'Lost', 'closed', 'lost')],
  edges: [{from: 'new', to: 'contacted', label: 'reply'}, {from: 'contacted', to: 'proposal', state: 'chosen', label: 'call went well'}, {from: 'proposal', to: 'won', state: 'chosen', label: 'terms accepted'}, {from: 'new', to: 'lost', state: 'lost', label: 'no reply 30 d'}],
}, 'States', 'A lead, five states', 'The accent path is the one that ends in a signed contract; lost is the branch off new, dashed, after thirty days of silence.'),

fig('figure-release', 'Release — versions on a timeline', 'core', 'One accent rule, filled ticks shipped and hollow ticks ahead, a note for the gate.', {
  label: 'Six releases from launch to marketplace; 1.0 is shipped',
  timeline: {x: 40, y: 140, w: 760, ticks: [{label: '1.0', sub: 'launch', filled: true}, {label: '1.1', sub: 'billing'}, {label: '1.2', sub: 'reports'}, {label: '1.3', sub: 'mobile'}, {label: '1.4', sub: 'partner api'}, {label: '2.0', sub: 'marketplace'}]},
  note: {x: 40, y: 220, lines: ['one release a month', 'the marketplace waits for a measured need:', '200 active accounts or ten partner asks']},
}, 'Release', 'Launch to marketplace in six releases', '1.0 is shipped. The marketplace stays last until two hundred accounts are active or ten partners have asked.'),

fig('figure-boundaries', 'Boundaries — regions a request crosses', 'standard', 'Dashed regions with labels, nodes inside each, the hot path in accent across the boundaries.', {
  label: 'A sale crosses three boundaries: shop, head office, bank',
  groups: [{x: 8, y: 8, w: 236, h: 300, label: 'shop'}, {x: 264, y: 8, w: 280, h: 300, label: 'head office'}, {x: 564, y: 8, w: 268, h: 300, label: 'bank'}],
  nodes: [node('till', 16, 120, 'Till', 'card, cash', '', {w: 190}), node('ledger', 296, 60, 'Ledger', 'daily close', 'chosen', {w: 210}), node('payroll', 296, 200, 'Payroll', 'reads the ledger', '', {w: 210}),
    node('clearing', 588, 60, 'Clearing', 'card settlements', '', {w: 210}), node('acct', 588, 200, 'Account', 'cash in', '', {w: 210})],
  edges: [{from: 'till', to: 'ledger', state: 'chosen', label: 'close'}, {from: 'ledger', to: 'payroll', label: 'read'}, {from: 'ledger', to: 'clearing', state: 'lost', label: 'disputes'}, {from: 'clearing', to: 'acct', label: 'settle'}],
}, 'Boundaries', 'Three boundaries, one sale', 'Dashed regions are the boundaries a sale crosses; the daily close is the accent edge, disputes the dashed one.'),

fig('figure-tree', 'Tree — questions and their answers', 'core', 'Diamonds ask, pills answer; the accent path is the common case, the dashed one the exception.', {
  label: 'Two questions decide a ticket refund: in the window, then unused',
  nodes: [{id: 'q1', x: 24, y: 120, w: 160, h: 76, title: 'in the window?', shape: 'diamond'},   // h 76: the diamond's middle (158) is the credit pill's, so the `no` edge runs level
    {id: 'q2', x: 280, y: 120, w: 160, h: 76, title: 'unused?', shape: 'diamond'},
    {id: 'refund', x: 540, y: 40, w: 160, h: 44, title: 'Full refund', shape: 'pill', state: 'chosen'},
    {id: 'credit', x: 540, y: 136, w: 200, h: 44, title: 'Event credit', shape: 'pill'},
    {id: 'decline', x: 280, y: 232, w: 160, h: 44, title: 'Decline', shape: 'pill', state: 'lost'}],
  edges: [{from: 'q1', to: 'q2', state: 'chosen', label: 'yes'}, {from: 'q1', to: 'decline', state: 'lost', label: 'no'},
    {from: 'q2', to: 'refund', state: 'chosen', label: 'yes'}, {from: 'q2', to: 'credit', label: 'no'}],
}, 'Tree', 'Two questions per refund', 'Diamonds ask, pills answer. The accent path refunds in full; a scanned ticket earns event credit, and outside the window the answer is no.'),

fig('figure-layers', 'Layers — dependencies point one way', 'core', 'Three full-width nodes stacked, two downward edges, a note for the edge that must not exist.', {
  label: 'Three layers, dependencies point down only',
  nodes: [node('front', 120, 16, 'Dashboards', 'web, app, alerts', '', {w: 600}), node('services', 120, 124, 'Services', 'readings, rules, billing', 'chosen', {w: 600}),
    node('records', 120, 232, 'Records', 'sensors, sites, customers', '', {w: 600})],
  edges: [{from: 'front', to: 'services', label: 'calls'}, {from: 'services', to: 'records', label: 'reads, writes'}],
  note: {x: 760, y: 150, lines: ['no edge', 'points up']},
}, 'Layers', 'Dependencies point down', 'Full-width nodes read as layers. Two edges, both downward; the note names the edge that must not exist.'),
];
