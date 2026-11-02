const {
  STOCK_LEN, RAIL_SPEC, BLOCK_SPECS, DEFAULT_RAILS, DEFAULT_BLOCKS, DEFAULT_PRICING,
} = require('./_catalog.js');

/**
 * The crawlable specification and price page.
 *
 * index.html is a calculator: a visitor gets a price by typing a length into
 * it. A crawler that does not run JavaScript — which is most of the AI ones —
 * gets the prose and the spec tables but no price and no part number, so an
 * assistant asked what a 1 m LSH25 costs cannot answer from this site.
 *
 * This renders those figures as plain HTML from catalog.js, the same file the
 * browser reads, so the page cannot drift from what the calculator charges.
 * Rendering it per request rather than committing a copy is the whole point:
 * a stale price quoted confidently by an assistant is worse than none.
 */

const SITE = 'https://industriallinearrail.com';

function money(n) {
  return '$' + n.toFixed(2);
}

function markup(item) {
  return typeof item.markup === 'number' ? item.markup : DEFAULT_PRICING.webMarkup;
}

function factor(item) {
  return 1 + markup(item) / 100;
}

// Same model as computeRail: list per usable mm of stock, times the markup,
// plus the cut fee, which is charged as entered and never marked up.
function railPrice(rail, length) {
  const spec = RAIL_SPEC[rail.series][rail.size];
  const usable = STOCK_LEN - (2 * spec.stdE + DEFAULT_PRICING.buffer);
  const material = (rail.list / usable) * length * factor(rail);
  return material + DEFAULT_PRICING.cutFee + DEFAULT_PRICING.handling;
}

const SAMPLE_LENGTHS = [500, 1000, 1500, 2000, 3000];

function railRows() {
  return DEFAULT_RAILS.map(r => {
    const spec = RAIL_SPEC[r.series][r.size];
    const prices = SAMPLE_LENGTHS
      .filter(L => L <= spec.Lmax)
      .map(L => `<td>${money(railPrice(r, L))}</td>`)
      .join('');
    return `<tr>
      <th scope="row">${r.series}${r.size}</th>
      <td>${spec.W} × ${spec.Hr} mm</td>
      <td>${spec.P} mm</td>
      <td>${spec.stdE} mm</td>
      <td>${spec.minE}–${spec.maxE} mm</td>
      <td>${spec.kgm} kg/m</td>
      ${prices}
    </tr>`;
  }).join('\n');
}

function blockRows() {
  return DEFAULT_BLOCKS.map(b => {
    const s = BLOCK_SPECS[b.pn] || {};
    return `<tr>
      <th scope="row"><code>${b.pn}</code></th>
      <td>${b.family}${b.size}</td>
      <td>${b.type}</td>
      <td>${s.H != null ? s.H + ' mm' : '—'}</td>
      <td>${s.F != null ? s.F + ' mm' : '—'}</td>
      <td>${s.C != null ? s.C + ' mm' : '—'}</td>
      <td>${s.dynC != null ? s.dynC + ' kN' : '—'}</td>
      <td>${s.statC != null ? s.statC + ' kN' : '—'}</td>
      <td>${money(b.list * factor(b))}</td>
    </tr>`;
  }).join('\n');
}

/* One Offer per catalogue block, plus one per rail at each sample length.
   Prices carry priceValidUntil because they are generated, not negotiated —
   an assistant should treat a figure it read months ago as stale. */
function structuredData() {
  const validUntil = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  const offers = [];

  for (const r of DEFAULT_RAILS) {
    const spec = RAIL_SPEC[r.series][r.size];
    for (const L of SAMPLE_LENGTHS.filter(x => x <= spec.Lmax)) {
      offers.push({
        '@type': 'Offer',
        name: `Airtac ${r.series}${r.size} linear guide rail, cut to ${L} mm`,
        sku: r.pn.replace('4000', String(L)),
        price: railPrice(r, L).toFixed(2),
        priceCurrency: 'USD',
        priceValidUntil: validUntil,
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@type': 'Organization', name: 'TSI Solutions' },
      });
    }
  }
  for (const b of DEFAULT_BLOCKS) {
    offers.push({
      '@type': 'Offer',
      name: `Airtac ${b.pn} ${b.type.toLowerCase()} carriage block`,
      sku: b.pn,
      price: (b.list * factor(b)).toFixed(2),
      priceCurrency: 'USD',
      priceValidUntil: validUntil,
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'TSI Solutions' },
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    name: 'Airtac LSH and LSD profile linear guide rails, cut to length',
    description:
      'Airtac LSH and LSD profile linear guide rails machined to any length '
      + 'from 4000 mm stock, with matching flange and square carriage blocks. '
      + 'Mounting holes are set out to a 20 mm standard edge pitch, matching '
      + 'the Hiwin HG hole pattern.',
    brand: { '@type': 'Brand', name: 'Airtac' },
    url: `${SITE}/specifications`,
    productGroupID: 'airtac-lsh-lsd',
    variesBy: ['https://schema.org/size', 'https://schema.org/length'],
    hasVariant: offers.map(o => ({
      '@type': 'Product',
      name: o.name,
      sku: o.sku,
      brand: { '@type': 'Brand', name: 'Airtac' },
      offers: o,
    })),
  };
}

function page() {
  const lengthCols = SAMPLE_LENGTHS.map(L => `<th scope="col">${L} mm</th>`).join('');
  const mk = DEFAULT_PRICING.webMarkup;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Airtac LSH &amp; LSD Rail Specifications and Prices — Cut to Length</title>
<meta name="description" content="Published specifications and prices for Airtac LSH and LSD profile linear guide rails cut to length, and the matching carriage blocks. Pitch, edge pitch, rail section, weight, load ratings and price per size.">
<link rel="canonical" href="${SITE}/specifications">
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.6;
         max-width: 1100px; margin: 0 auto; padding: 24px 16px 64px; color: #0f172a; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  h2 { font-size: 20px; margin-top: 40px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px; }
  th, td { border: 1px solid #e2e8f0; padding: 7px 10px; text-align: right; }
  th[scope="row"] { text-align: left; white-space: nowrap; }
  thead th { background: #f8fafc; text-align: right; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
  .lede { color: #475569; }
  .note { background: #f8fafc; border-left: 3px solid #94a3b8; padding: 10px 14px; font-size: 14px; }
  caption { text-align: left; font-size: 13px; color: #64748b; padding-bottom: 6px; }
</style>
<script type="application/ld+json">${JSON.stringify(structuredData())}</script>
</head>
<body>
<h1>Airtac LSH and LSD rail specifications and prices</h1>
<p class="lede">Every figure below is generated from the same catalogue the
<a href="${SITE}/">rail calculator</a> prices from, so it cannot drift. Prices are
per rail in single quantity, including the
${money(DEFAULT_PRICING.cutFee)} cut charge, and exclude freight and tax.</p>

<h2>Cut-length rails</h2>
<table>
  <caption>Airtac LSH and LSD profile rails, machined from ${STOCK_LEN} mm stock to the length ordered.</caption>
  <thead><tr>
    <th scope="col">Rail</th><th scope="col">Section W×H</th><th scope="col">Hole pitch P</th>
    <th scope="col">Standard edge pitch S</th><th scope="col">Permitted edge pitch</th>
    <th scope="col">Weight</th>${lengthCols}
  </tr></thead>
  <tbody>
${railRows()}
  </tbody>
</table>
<p class="note">Any length is available, not only those shown. The mounting hole
pattern follows <code>L = (n−1)·P + S + E</code>, where the last edge distance
<code>E</code> is whatever the length leaves once whole pitches are counted, and
must fall inside the permitted range for that rail.</p>

<h2>Carriage blocks</h2>
<table>
  <caption>Flange and square carriage blocks. A block fits only a rail of the same series and size.</caption>
  <thead><tr>
    <th scope="col">Part number</th><th scope="col">Fits rail</th><th scope="col">Style</th>
    <th scope="col">Assembly height H</th><th scope="col">Block width</th><th scope="col">Block length</th>
    <th scope="col">Dynamic C</th><th scope="col">Static C₀</th><th scope="col">Price</th>
  </tr></thead>
  <tbody>
${blockRows()}
  </tbody>
</table>

<h2>Interchange</h2>
<p>The LSH series shares every mounting dimension with the Hiwin HG profile —
assembly height, block width, bolt pattern, rail section and mounting-hole
pitch — at every size from 15 to 45 mm, so it fits designs built around that
standard. Rails are cut with a 20 mm standard edge pitch, matching the HG hole
pattern, so a replacement lands on the holes already in the machine without
re-drilling. Load ratings differ between manufacturers even where dimensions
are identical: compare the figures above against your application.</p>
<p>Paste a Hiwin part number into the
<a href="${SITE}/">interchange checker</a> to see the Airtac equivalent.</p>

<h2>How pricing works</h2>
<p>Prices are Airtac list plus a ${mk}% markup, with the
${money(DEFAULT_PRICING.cutFee)} cut charge added as entered and never marked up.
A rail is priced on the length actually cut, not a grid-snapped length. Volume
and repeat orders are quoted lower — <a href="${SITE}/">request pricing</a>.</p>

<p class="lede"><small>Supplied by TSI Solutions. Generated
${new Date().toISOString().slice(0, 10)}.</small></p>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cached at the edge for an hour, served stale for a day while revalidating,
  // so crawlers are cheap to serve but a price change still lands quickly.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(page());
};
