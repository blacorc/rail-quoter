/**
 * Customer account pricing.
 *
 * Accounts live in one CUSTOMER_CODES environment variable, so there is no
 * database to run and the list is edited in the Vercel dashboard. Because it
 * is read server-side only, the codes and the rates behind them never reach
 * the browser — a visitor cannot enumerate who gets what.
 *
 * A rate is a MULTIPLIER ON AIRTAC LIST. List stays the anchor it has always
 * been; the multiplier just says where on it this account sits:
 *
 *   0.75  ->  25% off list
 *   1.00  ->  at list
 *   1.80  ->  above list, still under the published web price
 *   2.50  ->  the web price itself, at the default 150% markup
 *
 * A plain discount could only ever reach list, so everything between list and
 * the web price — and anything above it — was unreachable. The multiplier
 * covers the whole range with one number.
 *
 *   CUSTOMER_CODES={
 *     "ACME-7K2F": {
 *       "name": "Acme Automation",
 *       "railMult": 0.75,           // every rail at list x 0.75
 *       "blockMult": 0.70,          // every block at list x 0.70
 *       "partsMult": {              // optional, wins over the line rate
 *         "LSH20RLX4000-N-D": 0.60
 *       },
 *       "expires": "2027-01-31"     // optional, ISO date
 *     }
 *   }
 *
 * LEGACY: `rail`, `block` and `parts` hold a percentage off list and still
 * work, so codes already issued keep their pricing. They are converted to a
 * multiplier here, and the browser only ever sees multipliers. The fields are
 * deliberately named differently rather than reinterpreted in place: a live
 * code reading `"rail": 5` means 5% off, and silently rereading it as 5x list
 * would be a pricing incident, not a migration.
 *
 * MARGIN GUARDRAIL — rails and blocks are not equally discountable, because
 * they are bought at different fractions of list:
 *
 *   Rails   net 50% of list -> material margin hits zero at a 0.50 multiplier
 *   Blocks  net 32% of list -> material margin hits zero at a 0.32 multiplier
 *
 * So 0.70 leaves ~29% on a rail and ~54% on a block. Rail multipliers below
 * about 0.60 are thin once the material is the only thing earning; the cut fee
 * is charged separately and is not discounted, which is what carries a heavily
 * discounted rail.
 */

const MAX_DISCOUNT = 95;

// A multiplier outside this range is a typo or a legacy percentage that has
// been pasted into the wrong field, not a price anyone intends. Rejecting it
// drops the account to published pricing, which is visible and safe; honouring
// it could bill a customer many times list.
const MIN_MULT = 0.05;
const MAX_MULT = 20;

function allAccounts() {
  try {
    const parsed = JSON.parse(process.env.CUSTOMER_CODES || '{}');
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};   // malformed config must not take the site down
  }
}

/** A legacy percentage off list, or 0 when unset. */
function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_DISCOUNT, n);
}

/** A multiplier on list, or 0 when unset or out of range. */
function mult(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < MIN_MULT || n > MAX_MULT) return 0;
  return n;
}

/**
 * One line's rate as a multiplier: the explicit multiplier if given, else the
 * legacy percentage converted, else 0 meaning "no account rate, use the
 * published web price".
 */
function lineRate(multValue, discountValue) {
  const m = mult(multValue);
  if (m) return m;
  const d = pct(discountValue);
  return d ? 1 - d / 100 : 0;
}

/**
 * Per-part overrides, also as multipliers. Legacy percentages are read first
 * so an explicit multiplier for the same part wins.
 */
function cleanParts(partsMult, parts) {
  const out = {};
  if (parts && typeof parts === 'object') {
    for (const [pn, value] of Object.entries(parts)) {
      const d = pct(value);
      if (d) out[String(pn)] = 1 - d / 100;
    }
  }
  if (partsMult && typeof partsMult === 'object') {
    for (const [pn, value] of Object.entries(partsMult)) {
      const m = mult(value);
      if (m) out[String(pn)] = m;
    }
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
    // Always multipliers on list by the time they leave here, whichever
    // field they were written in.
    rail: lineRate(account.railMult, account.rail),
    block: lineRate(account.blockMult, account.block),
    parts: cleanParts(account.partsMult, account.parts),
  };
}

module.exports = { lookupCustomer };
