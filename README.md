# Airtac Rail Quoter

Cut-length linear rail and carriage block quoting tool for TSI Solutions.
Single static page plus one serverless function for sending quotes by email.

> This repo previously held an early T-Slot frame quoter prototype. That app was
> superseded by the `frame-quoter` repo and has been removed here; it remains in
> this repo's git history.

## What it does

**Rail Builder** — cut-length calculator using the geometry model from
`TSI_Airtac_Rail_Calculator_v26`:

```
L = (n-1)·P + S + E
list/mm    = list price of 4000mm stock ÷ (4000 - scrap allowance)
sell price = list/mm × priced length × (1 - rail discount) + cut fee + handling
```

Exact-length mode lets `E` float so the delivered rail matches the customer's
requested length, and generates the configured part number
(e.g. `LSD20RLX900-N-D- e=40.0/s=20`). Manual hole-count override is available.

**Carriage Blocks** — LSH and LSD flange/square blocks, priced at list less any
configured block discount.

**Quote** — combined rail + block line items, editable qty and price, emailed to
the customer with a copy of the lead to the rep. A "Request Volume Pricing"
action sends the same build as a pricing enquiry instead of a firm quote.

## Pricing model — list-based by design

**No cost basis is stored in this repository.** The catalog ships published Airtac
list prices only, so the deployed site quotes list to anyone who opens it, and
neither the source nor the browser reveals what stock is bought for.

Discounts off list are set per product line in the admin panel (gear icon,
PIN-gated) and live in that browser's localStorage only — they are never part of
the deployed site. A visitor with no configuration always sees list.

Both discounts default to 0. Quoting at straight list is not a uniform margin,
because the two source spreadsheets used different net conventions — rail net was
50% of list, block net 32%. Setting **17% off rails and 47% off blocks**
reproduces the 40% gross margin the original v26 sheet targeted.

Two deliberate differences from the v26 sheet:

- Cut and handling fees are charged as entered. The sheet divided them by
  `(1 - margin)`, which marked a $10 cut charge up to $16.67; set the fee to what
  you intend to charge.
- Pricing still follows v26 in charging for the grid-snapped length rather than
  the delivered length. Both figures are shown in the calculator.

## Deploying to Vercel

Zero-config — no `vercel.json` or build step needed.

1. vercel.com/new → import this repository
2. Framework Preset: **Other**; leave Build Command and Output Directory empty
3. Add the environment variables below, ticking **Production, Preview and
   Development** for each
4. Deploy

### Environment variables

See `.env.example`.

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Sending quote emails |
| `FROM_EMAIL` | Sender address; must be a Resend-verified domain (`onboarding@resend.dev` works for testing) |
| `REP_EMAIL` | Where lead notifications are sent |

Without `RESEND_API_KEY` the app still calculates and quotes normally — only the
email button returns "Email service not configured".

## Local development

Any static file server works for the UI; the email endpoint needs `vercel dev`.

```bash
python3 -m http.server 8000    # UI only
vercel dev                     # UI + /api/send-quote
```
