/**
 * THE CATALOGUE — the single source of truth for every price and dimension.
 *
 * SERVER ONLY. Three readers, none of them a browser:
 *   - api/catalog.js       emits the browser's copy, prices already multiplied
 *   - api/specifications.js renders the crawlable spec-and-price page
 *   - api/customer.js      builds an account's rate table
 *
 * Keeping it here is what keeps Airtac list and the markup off the wire. The
 * browser used to hold both side by side, which handed anyone reading
 * view-source the whole pricing formula.
 *
 * It is also why the figures cannot drift. Everything priced anywhere — the
 * calculator, the spec page, an account's rates — is derived from this one
 * file at request time, so there is no committed copy to go stale, and no
 * build step either.
 *
 * EDITING: change a value, commit, and Vercel redeploys within a minute or so.
 * The new figure is then what every visitor AND the spec page shows. You can
 * edit this straight from GitHub in a browser: open api/_catalog.js, click the
 * pencil, change the number, Commit changes.
 */

/* ════════════════════════════════════════════════════════════════
   CATALOG DEFAULTS — Airtac published list prices and catalogue
   dimensions. Edited here; takes effect on deploy.

   Nothing about what stock costs belongs in this file: it is served to
   every browser. The margin and net-of-list figures are in README.md.
   ════════════════════════════════════════════════════════════════ */
const STOCK_LEN = 4000; // mm, fixed stock rail length

// Rail specification per series and size. The limits come from Airtac's own
// rail_dimension_calculator workbook, which supersedes the values first
// transcribed from the brochures (LSH p.15-18, LSD p.42-45) — the brochure
// figures were rounded conservatively and the maximum lengths were wrong.
//   P     mounting-hole pitch
//   stdE  the edge pitch supplied as standard: 20mm, which matches the HG hole
//         pattern so rails drop into existing installations. LSH45 is Airtac's
//         own 22.5mm. (The catalog's nominal 40/55/67.5 is a different figure
//         and is not what either Airtac's calculator or TSI cuts to.)
//   minE  minimum permitted edge pitch; below this the bolt hole breaks out
//   maxE  maximum permitted edge pitch, always P - minE
//   Lmax  maximum length of a single rail, before the offset allowance below
//         (beyond this a joint rail is required)
//   W/Hr  rail cross-section width x height (G x H2 in the catalog)
//   Q/U   counterbore and through-hole diameter (ΦQ / ΦU)
//   H3    counterbore depth
//   kgm   rail weight, kg per metre
const RAIL_SPEC = {
  LSH: {
    15: { P: 60,  stdE: 20,   minE: 4,   maxE: 56,   Lmax: 4000, W: 15, Hr: 15,   Q: 8,    U: 4.8, H3: 5.3, kgm: 1.43 },
    20: { P: 60,  stdE: 20,   minE: 4.8, maxE: 55.2, Lmax: 4000, W: 20, Hr: 17.5, Q: 9.5,  U: 5.8, H3: 8.5, kgm: 2.23 },
    25: { P: 60,  stdE: 20,   minE: 5.6, maxE: 54.4, Lmax: 4000, W: 23, Hr: 22,   Q: 11.2, U: 7,   H3: 9,   kgm: 3.32 },
    30: { P: 80,  stdE: 20,   minE: 7.1, maxE: 72.9, Lmax: 4000, W: 28, Hr: 26,   Q: 14.2, U: 9,   H3: 12,  kgm: 4.5 },
    35: { P: 80,  stdE: 20,   minE: 7.1, maxE: 72.9, Lmax: 4000, W: 34, Hr: 29,   Q: 14.2, U: 9,   H3: 12,  kgm: 6.37 },
    45: { P: 105, stdE: 22.5, minE: 10,  maxE: 95,   Lmax: 4000, W: 45, Hr: 38,   Q: 20,   U: 14,  H3: 17,  kgm: 10.7 },
  },
  LSD: {
    15: { P: 60, stdE: 20, minE: 4,    maxE: 56,    Lmax: 4000, W: 15, Hr: 12.5, Q: 8,    U: 4.8, H3: 5.3, kgm: 1.23 },
    20: { P: 60, stdE: 20, minE: 4.75, maxE: 55.25, Lmax: 4000, W: 20, Hr: 15.5, Q: 9.5,  U: 5.8, H3: 8.5, kgm: 2.11 },
    25: { P: 60, stdE: 20, minE: 5.6,  maxE: 54.4,  Lmax: 4000, W: 23, Hr: 18,   Q: 11.2, U: 7,   H3: 9,   kgm: 2.76 },
  },
};

function getSpec(series, size) { return RAIL_SPEC[series]?.[size] || null; }

// Block dimensions and ratings, transcribed from the Airtac catalog pages for
// the exact models sold here (normal-length universal-mount flange F3N and
// square HN blocks; LSH p.16/18, LSD p.42/45). Keys follow Airtac's symbols:
//   H assembly height · F block width · C block length (standard end caps) ·
//   C1/A/B mounting bolt pattern · M block thread · screw rail bolt ·
//   C/C0 dynamic/static load (kN) · MR/MP/MY static moments (kN.m) · wt kg
const BLOCK_SPECS = {
  'LSH15BK-F3N-N-D-M4':  { H1: 3.5, H: 24, F: 47,  C: 60,    C1: 40,   A: 30, B: 38,  M: 'M5×0.8',   screw: 'M4',  dynC: 11.3, statC: 17.9,  MR: 0.12, MP: 0.12, MY: 0.12, wt: 0.20 },
  'LSH20BK-F3N-N-D-M6':  { H1: 4.3, H: 30, F: 63,  C: 76.5,  C1: 52,   A: 40, B: 53,  M: 'M6×1.0',   screw: 'M5',  dynC: 18.6, statC: 28.6,  MR: 0.27, MP: 0.25, MY: 0.25, wt: 0.40 },
  'LSH25BK-F3N-N-D-M6':  { H1: 6.5, H: 36, F: 70,  C: 83.5,  C1: 58.5, A: 45, B: 57,  M: 'M8×1.25',  screw: 'M6',  dynC: 26.9, statC: 39.4,  MR: 0.44, MP: 0.38, MY: 0.38, wt: 0.59 },
  'LSH30BK-F3N-N-D-M6':  { H1: 6.5, H: 42, F: 90,  C: 95.5,  C1: 70.5, A: 52, B: 72,  M: 'M10×1.5',  screw: 'M8',  dynC: 37.4, statC: 55.0,  MR: 0.66, MP: 0.67, MY: 0.67, wt: 1.09 },
  'LSH35BK-F3N-N-D-M6':  { H1: 7, H: 48, F: 100, C: 109,   C1: 80,   A: 62, B: 82,  M: 'M10×1.5',  screw: 'M8',  dynC: 50.8, statC: 72.3,  MR: 1.05, MP: 0.92, MY: 0.92, wt: 1.32 },
  'LSH45BK-F3N-N-D-P01': { H1: 10, H: 60, F: 120, C: 132,   C1: 98,   A: 80, B: 100, M: 'M12×1.75', screw: 'M12', dynC: 80.7, statC: 110.3, MR: 1.95, MP: 1.62, MY: 1.62, wt: 2.77 },
  'LSH15BK-HN-N-D-M4':   { H1: 3.5, H: 28, F: 34,  C: 60,    C1: 40,   A: 26, B: 26,  M: 'M4×0.7',   screw: 'M4',  dynC: 11.3, statC: 17.9,  MR: 0.12, MP: 0.12, MY: 0.12, wt: 0.20 },
  'LSH20BK-HN-N-D-M6':   { H1: 4.3, H: 30, F: 44,  C: 76.5,  C1: 52,   A: 36, B: 32,  M: 'M5×0.8',   screw: 'M5',  dynC: 18.6, statC: 28.6,  MR: 0.27, MP: 0.25, MY: 0.25, wt: 0.33 },
  'LSH25BK-HN-N-D-M6':   { H1: 6.5, H: 40, F: 48,  C: 83.5,  C1: 58.5, A: 35, B: 35,  M: 'M6×1.0',   screw: 'M6',  dynC: 26.9, statC: 39.4,  MR: 0.44, MP: 0.38, MY: 0.38, wt: 0.53 },
  'LSH30BK-HN-N-D-M6':   { H1: 6.5, H: 45, F: 60,  C: 95.5,  C1: 70.5, A: 40, B: 40,  M: 'M8×1.25',  screw: 'M8',  dynC: 37.4, statC: 55.0,  MR: 0.66, MP: 0.67, MY: 0.67, wt: 0.91 },
  'LSH35BK-HN-N-D-M6':   { H1: 7, H: 55, F: 70,  C: 109,   C1: 80,   A: 50, B: 50,  M: 'M8×1.25',  screw: 'M8',  dynC: 50.8, statC: 72.3,  MR: 1.05, MP: 0.92, MY: 0.92, wt: 1.26 },
  'LSH45BK-HN-N-D-P01':  { H1: 10, H: 70, F: 86,  C: 132,   C1: 98,   A: 60, B: 60,  M: 'M10×1.5',  screw: 'M12', dynC: 80.7, statC: 110.3, MR: 1.95, MP: 1.62, MY: 1.62, wt: 2.72 },
  'LSD15BK-F3N-N-D-M4':  { H1: 4.5, H: 24, F: 52,  C: 57,    C1: 40,   A: 26, B: 41,  M: 'M5×0.8',   screw: 'M4',  dynC: 8.9,  statC: 16.5,  MR: 0.12, MP: 0.10, MY: 0.10, wt: 0.21 },
  'LSD20BK-F3N-N-D-M6':  { H1: 6, H: 28, F: 59,  C: 65,    C1: 48,   A: 32, B: 49,  M: 'M6×1.0',   screw: 'M5',  dynC: 12.1, statC: 22.4,  MR: 0.20, MP: 0.15, MY: 0.15, wt: 0.31 },
  'LSD25BK-F3N-N-D-M6':  { H1: 7, H: 33, F: 73,  C: 83,    C1: 60.5, A: 35, B: 60,  M: 'M8×1.25',  screw: 'M6',  dynC: 19.3, statC: 34.7,  MR: 0.36, MP: 0.31, MY: 0.31, wt: 0.60 },
  'LSD25BK-HN-N-D-M6':   { H1: 7, H: 33, F: 48,  C: 83,    C1: 60.5, A: 35, B: 35,  M: 'M6×1.0',   screw: 'M6',  dynC: 19.3, statC: 34.7,  MR: 0.36, MP: 0.31, MY: 0.31, wt: 0.42 },
};

// Order here is the order the series buttons render in.
const SERIES_INFO = {
  LSH: { label: 'LSH', desc: 'Standard Linear Guide', sizes: [15, 20, 25, 30, 35, 45] },
  LSD: { label: 'LSD', desc: 'Low Profile Linear Guide', sizes: [15, 20, 25] },
};

// Published Airtac list prices for 4000mm stock rails. What TSI pays for them
// is not here and must not be added — this file reaches the browser.
const DEFAULT_RAILS = [
  { series: 'LSD', size: 15, pn: 'LSD15RLX4000-N-D', list: 193.70 },
  { series: 'LSD', size: 20, pn: 'LSD20RLX4000-N-D', list: 209.50 },
  { series: 'LSD', size: 25, pn: 'LSD25RLX4000-N-D', list: 247.60 },
  { series: 'LSH', size: 15, pn: 'LSH15RLX4000-N-D', list: 200.00 },
  { series: 'LSH', size: 20, pn: 'LSH20RLX4000-N-D', list: 222.20 },
  { series: 'LSH', size: 25, pn: 'LSH25RLX4000-N-D', list: 260.30 },
  { series: 'LSH', size: 30, pn: 'LSH30RLX4000-N-D', list: 298.40 },
  { series: 'LSH', size: 35, pn: 'LSH35RLX4000-N-D', list: 355.60 },
  { series: 'LSH', size: 45, pn: 'LSH45RLX4000-N-D', list: 527.00 },
];

// Published Airtac list prices for carriage blocks.
const DEFAULT_BLOCKS = [
  { family: 'LSH', type: 'Flange', size: 15, pn: 'LSH15BK-F3N-N-D-M4',  list: 25.40 },
  { family: 'LSH', type: 'Flange', size: 20, pn: 'LSH20BK-F3N-N-D-M6',  list: 31.00 },
  { family: 'LSH', type: 'Flange', size: 25, pn: 'LSH25BK-F3N-N-D-M6',  list: 38.90 },
  { family: 'LSH', type: 'Flange', size: 30, pn: 'LSH30BK-F3N-N-D-M6',  list: 45.30 },
  { family: 'LSH', type: 'Flange', size: 35, pn: 'LSH35BK-F3N-N-D-M6',  list: 57.20 },
  { family: 'LSH', type: 'Flange', size: 45, pn: 'LSH45BK-F3N-N-D-P01', list: 82.50 },
  { family: 'LSH', type: 'Square', size: 15, pn: 'LSH15BK-HN-N-D-M4',   list: 21.40 },
  { family: 'LSH', type: 'Square', size: 20, pn: 'LSH20BK-HN-N-D-M6',   list: 26.20 },
  { family: 'LSH', type: 'Square', size: 25, pn: 'LSH25BK-HN-N-D-M6',   list: 32.50 },
  { family: 'LSH', type: 'Square', size: 30, pn: 'LSH30BK-HN-N-D-M6',   list: 38.10 },
  { family: 'LSH', type: 'Square', size: 35, pn: 'LSH35BK-HN-N-D-M6',   list: 49.20 },
  { family: 'LSH', type: 'Square', size: 45, pn: 'LSH45BK-HN-N-D-P01',  list: 71.40 },
  { family: 'LSD', type: 'Flange', size: 15, pn: 'LSD15BK-F3N-N-D-M4',  list: 23.80 },
  { family: 'LSD', type: 'Flange', size: 20, pn: 'LSD20BK-F3N-N-D-M6',  list: 29.40 },
  { family: 'LSD', type: 'Flange', size: 25, pn: 'LSD25BK-F3N-N-D-M6',  list: 36.50 },
  { family: 'LSD', type: 'Square', size: 25, pn: 'LSD25BK-HN-N-D-M6',   list: 31.70 },
];

/* ════════════════════════════════════════════════════════════════════════
   PRICING AND CONTACT SETTINGS — edit here, then commit
   ────────────────────────────────────────────────────────────────────────
   These are the site's live settings. Change a value, commit it, and Vercel
   redeploys within a minute or so — the new figure is then what every
   visitor sees. You can edit this straight from GitHub in a browser: open
   catalog.js, click the pencil, change the number, Commit changes.

   Per-part list prices and markups are in DEFAULT_RAILS and DEFAULT_BLOCKS
   above. To quote one customer below list, edit the unit price on the quote
   line itself — those fields are editable and do not change the site.
   ════════════════════════════════════════════════════════════════════════ */
const DEFAULT_PRICING = {
  webMarkup: 150,   // default % above list, for any part without its own markup
  cutFee: 10,       // $ per cut rail, charged as entered (never marked up)
  handling: 0,      // $ per rail, charged as entered
  buffer: 0,        // mm of extra scrap beyond S + E when costing a cut
};

/* Server-only. This file is never served: an api/_ prefix is neither routed
   as an endpoint nor exposed as a static asset, which is what keeps the list
   prices and the markup off the wire. api/catalog.js emits the browser's copy
   with prices already multiplied; api/specifications.js and api/customer.js
   read these figures directly. */
module.exports = {
  STOCK_LEN, RAIL_SPEC, BLOCK_SPECS, SERIES_INFO,
  DEFAULT_RAILS, DEFAULT_BLOCKS, DEFAULT_PRICING, getSpec,
};
