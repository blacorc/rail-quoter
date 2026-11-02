const { lookupCustomer } = require('./_customers');
const { DEFAULT_RAILS, DEFAULT_BLOCKS } = require('./_catalog.js');
const { rates } = require('./catalog.js');

/**
 * Resolve an access code to that customer's prices.
 *
 * Returns finished rates, not the multiplier behind them. The browser has no
 * list price to multiply any more — that is the point of serving the catalogue
 * from api/catalog.js — so sending a bare 0.75 would be useless to it, and
 * sending list alongside would undo the whole exercise.
 *
 * Only the matching account is ever returned, so the endpoint cannot be used
 * to enumerate the customer list. Unknown codes get a flat 404 with no detail
 * about whether the code was close to a real one.
 */

function rateFor(account, item, kind) {
  const override = account.parts ? account.parts[item.pn] : undefined;
  const mult = (typeof override === 'number' && override > 0)
    ? override
    : (kind === 'rail' ? account.rail : account.block);
  return (typeof mult === 'number' && mult > 0) ? mult : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body || {};
  const account = lookupCustomer(code);

  if (!account) {
    return res.status(404).json({ error: 'Code not recognised' });
  }

  // A multiplier is on list, so the account rate is list x mult — computed
  // here against the same usable-stock basis the published rate uses.
  const railRates = {};
  for (const r of DEFAULT_RAILS) {
    const mult = rateFor(account, r, 'rail');
    if (mult !== null) {
      railRates[r.pn] = (r.list / rates.usableFor(r.series, r.size)) * mult;
    }
  }

  const blockPrices = {};
  for (const b of DEFAULT_BLOCKS) {
    const mult = rateFor(account, b, 'block');
    if (mult !== null) blockPrices[b.pn] = b.list * mult;
  }

  return res.json({
    code: account.code,
    name: account.name,
    rails: railRates,
    blocks: blockPrices,
  });
};
