# Airtac Rail Quoter

Cut-length linear rail and carriage block quoting tool for TSI Solutions.
Single static page plus one serverless function for sending quotes by email.

> This repo previously held an early T-Slot frame quoter prototype. That app was
> superseded by the `frame-quoter` repo and has been removed here; it remains in
> this repo's git history.

## What it does

**Rail Builder** — cut-length calculator replicating `TSI_Airtac_Rail_Calculator_v26`:

```
L = (n-1)·P + S + E
cost/mm   = net cost of 4000mm stock ÷ (4000 - scrap allowance)
sell price = (cost/mm × priced length + cut fee + handling) ÷ (1 - margin)
```

Exact-length mode lets `E` float so the delivered rail matches the customer's
requested length, and generates the configured part number
(e.g. `LSD20RLX900-N-D- e=40.0/s=20`). Manual hole-count override is available.

**Carriage Blocks** — LSH and LSD flange/square blocks priced from TSI net cost.

**Quote** — combined rail + block line items, editable qty and price, emailed to
the customer with a copy of the lead to the rep.

## Pricing data

Defaults come from the two source spreadsheets and are all editable in the admin
panel (gear icon, PIN-gated), stored in the browser's localStorage:

- Rail net costs are 50% of list (the v26 calculator's convention)
- Block net costs are 32% of list ("TSI Net" in the carriage spreadsheet)
- Margin, cut fee, handling and scrap buffer are global settings

Pricing follows v26 in charging for the grid-snapped length rather than the
delivered length. Both figures are shown in the calculator.

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
