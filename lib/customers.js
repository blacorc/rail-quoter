/**
 * Customer account pricing.
 *
 * Accounts live in one CUSTOMER_CODES environment variable, so there is no
 * database to run and the list is edited in the Vercel dashboard. Because it
 * is read server-side only, the codes and the rates behind them never reach
 * the browser — a visitor cannot enumerate who gets what.
 *
 * Shape:
 *
 *   CUSTOMER_CODES={
 *     "ACME-7K2F": {
 *       "name": "Acme Automation",
 *       "rail": 25,                 // % off list on every rail
 *       "block": 30,                // % off list on every block
 *       "parts": {                  // optional, wins over the line rate
 *         "LSH20RLX4000-N-D": 40,
 *         "LSH25BK-F3N-N-D-M6": 35
 *       },
 *       "expires": "2027-01-31"     // optional, ISO date
 *     }
 *   }
 *
 * Discounts are percentages off Airtac list, matching how the rest of the
 * app anchors pricing. A part with no override falls back to its line rate;
 * a line with no rate falls back to the published web price.
 *
 * MARGIN GUARDRAIL — rails and blocks are not equally discountable, because
 * they are bought at different fractions of list:
 *
 *   Rails   net 50% of list -> material margin hits zero at 50% off list
 *   Blocks  net 32% of list -> material margin hits zero at 68% off list
 *
 * So a 30% rail discount leaves ~29% on the material, while the same 30% on
 * a block leaves ~54%. Rail rates past about 40% are thin once the material
 * is the only thing earning; the cut fee is charged separately and is not
 * discounted, which is what carries a heavily discounted rail.
 */

const MAX_DISCOUNT = 95;

function allAccounts() {
  try {
    const parsed = JSON.parse(process.env.CUSTOMER_CODES || '{}');
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};   // malformed config must not take the site down
  }
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_DISCOUNT, n);
}

function cleanParts(parts) {
  if (!parts || typeof parts !== 'object') return {};
  const out = {};
  for (const [pn, value] of Object.entries(parts)) {
    const p = pct(value);
    if (p > 0) out[String(pn)] = p;
  }
  return out;
}

/**
 * Resolve an access code to its account, or null if unknown or expired.
 * Matching is case- and whitespace-insensitive so a code can be typed by hand
 * or pasted out of an email without tripping over formatting.
 */
function lookupCustomer(code) {
  const wanted = String(code || '').trim().toUpperCase();
  if (!wanted) return null;

  const accounts = allAccounts();
  const key = Object.keys(accounts).find(k => k.trim().toUpperCase() === wanted);
  if (!key) return null;

  const account = accounts[key] || {};

  if (account.expires) {
    const until = Date.parse(account.expires);
    if (Number.isFinite(until) && Date.now() > until) return null;
  }

  return {
    code: key,
    name: String(account.name || key),
    rail: pct(account.rail),
    block: pct(account.block),
    parts: cleanParts(account.parts),
  };
}

module.exports = { lookupCustomer };
