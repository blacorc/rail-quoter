const { lookupCustomer } = require('../lib/customers');

/**
 * Resolve an access code to that customer's discount rates.
 *
 * Only the matching account is ever returned, so the endpoint cannot be used
 * to enumerate the customer list. Unknown codes get a flat 404 with no detail
 * about whether the code was close to a real one.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body || {};
  const account = lookupCustomer(code);

  if (!account) {
    return res.status(404).json({ error: 'Code not recognised' });
  }

  return res.json({
    code: account.code,
    name: account.name,
    rail: account.rail,
    block: account.block,
    parts: account.parts,
  });
};
