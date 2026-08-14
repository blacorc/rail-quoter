# Airtac Rail Quoter

Cut-length linear rail and carriage block quoting tool for TSI Solutions.
Single static page plus one serverless function for sending quotes by email.

> This repo previously held an early T-Slot frame quoter prototype. That app was
> superseded by the `frame-quoter` repo and has been removed here; it remains in
> this repo's git history.

## What it does

**Rail Builder** — cut-length calculator using the geometry model published in
the Airtac brochures (LSH p.15, LSD p.42) and `TSI_Airtac_Rail_Calculator_v26`:

```
L = (n-1)·P + S + E
list/mm    = Airtac list price of 4000mm stock ÷ (4000 - scrap allowance)
sell price = list/mm × cut length × price factor + cut fee + handling
```

**`E` is a driven dimension.** Fix the length and the first-hole offset `S` and
the geometry has no freedom left: `n` is however many pitches fit, and `E` is
the remainder. So `E` is computed and displayed as reference, never entered —
the calculator used to take it as an input and then override it, which is the
sketch equivalent of an over-constrained drawing.

`S` is therefore the only edge dimension you set. Two shortcuts fill it in:
**Standard 20 mm S**, and **Balance the ends**, which picks the `S` that splits
the leftover evenly so `E` comes out equal (exactly, when the pitch allows).

The remaining choice is `n`, exposed by the manual hole-count override: ask for
fewer holes than fit and the spare length moves into the end offsets, which the
edge-pitch validation will reject once `E` runs past `maxE`. A live diagram
redraws the hole pattern, and the configured part number carries the result
(e.g. `LSD20RLX900-N-D- e=40.0/s=20`).

### Rail specification and validation

`RAIL_SPEC` in `index.html` holds Airtac's published limits per series and size —
pitch `P`, standard edge pitch, minimum and maximum edge pitch, and maximum
single-rail length. A configuration is blocked from being quoted when:

- `S` falls outside the permitted edge-pitch range for that rail
- the floating `E` lands outside that range (an over- or under-long edge risks
  breaking through the bolt hole)
- the length exceeds `Lmax`, where Airtac requires a joint rail

A blocked edge pitch is never a dead end: the calculator offers the nearby
configurations that do work as one-click chips — a different `S` at the same
length, or the nearest workable length either side at the same `S`. Both are
snapped to round numbers (`S = 30 mm`, `890 mm`) rather than to whatever value
sits first inside the limit. An over-`Lmax` length gets no suggestion, since it
needs a joint rail rather than a different number.

`stdE` is the edge pitch TSI supplies as standard, which is **20 mm at every
size**. Airtac's catalog calls 40 mm standard on sizes 15–25, 55 mm on 30/35 and
67.5 mm on 45, but 20 mm sits inside the permitted range throughout and matches
the Hiwin HG hole pattern, so a rail drops into an existing HG installation
without re-drilling. The `minE`/`maxE` limits are Airtac's and are still enforced.

**Carriage Blocks** — LSH and LSD flange/square blocks, filtered to those that fit
the selected rail.

**Quote** — combined rail + block line items with editable quantity and unit
price, emailed to the customer with a copy of the lead to the rep. A "Request Volume Pricing"
action sends the same build as a pricing enquiry instead of a firm quote.

## 3D CAD

Airtac publishes configurable CAD for these parts on CADENAS PARTcommunity,
so nothing is hosted here and the models stay revised by the manufacturer. The
calculator deep-links into them: a valid rail gets an "Open this rail in 3D"
link, and each expanded block panel links to that block.

Links carry a `varset` that pre-selects the configuration, so a customer who
has just configured a 900 mm rail lands on that rail rather than a family page.
The slots are the ones Airtac's own part numbers are built from, and
`railCadURL`/`blockCadURL` in `index.html` derive them from the part number:

```
LSH25BK-F3N-N-D-M6  ->  WOR=25, BS=F3, BT=N, ACCE=N, PL=D, MT=M6
LSH30RLX900-N-D     ->  WOR=30, L=900, ACCE=N, PL=D, plus S for the cut
```

**Linking, not embedding, is deliberate.** PARTcommunity requires a free
registration before it releases a file. Framing it would put that wall inside
the quote page and hand the lead to CADENAS rather than TSI, so the link is
labelled with the sign-in up front and opens in a new tab. If Airtac ever
grants a whitelabel portal, `airtac-embedded.partcommunity.com` is the host
built for framing.

## Pricing model — list-based, published above list

**No cost basis is stored in this repository.** The catalog ships published Airtac
list prices only, so neither the source nor the browser reveals what stock is
bought for.

**List is the anchor.** Every price is that part's Airtac list price times
`1 + markup`. There is no admin panel and no runtime configuration — the settings
are constants near the top of `index.html`:

| Constant | What it sets |
|---|---|
| `DEFAULT_RAILS` / `DEFAULT_BLOCKS` | Per-part list price and markup |
| `DEFAULT_PRICING` | Default markup, cut fee, handling, scrap buffer |
| `REP_INFO` | Name, phone, company and logo on the quote email |

Markup is per part, so one SKU can be repositioned without moving the rest;
anything without its own `markup` inherits `DEFAULT_PRICING.webMarkup`.

**To change a price:** edit the value, commit, and Vercel redeploys — the new
figure is then what every visitor sees. This works from GitHub in a browser
(open `index.html`, pencil icon, edit, Commit changes), so no local checkout is
needed. Every change is versioned, so `git log` shows when a price moved and why.

**To quote one customer below list**, edit the unit price on the quote line
itself. Those fields are editable and affect only that quote, never the site.


The 150% default is benchmarked against AutomationDirect's WON H-series, which is
dimensionally identical to Airtac LSH (same H, W, W1 and H1 at every size) and so
directly substitutable. At 150% rails sit at roughly 75% and blocks at roughly
91% of their advertised price. Two flange blocks — LSH20 and LSH30 — land 1-2%
above their base (UU, no inside seal) price, though still under their sealed (SS)
price; adjust those two list values or the markup if that matters.

Note that list is not a uniform margin: the two source spreadsheets used different
net conventions — rail net was 50% of list, block net 32%. **17% off rails and 47%
off blocks** reproduces the 40% gross margin the original v26 sheet targeted.

Two deliberate differences from the v26 sheet:

- Cut and handling fees are charged as entered. The sheet divided them by
  `(1 - margin)`, which marked a $10 cut charge up to $16.67; set the fee to what
  you intend to charge.
- The material charge is based on the length actually cut. v26 charged for a
  grid-snapped length, which drifted from the delivered length in both
  directions — an LSH45 cut to 400 mm was priced as 355 mm, and an LSH35 cut to
  400 mm was priced as 440 mm. Making `E` driven removed the second length, so
  there is now one number and it is the one the customer receives. Across a
  9-rail × 6-length matrix this moved prices by 1.4% on average, at most 11.7%
  (that LSH45 short cut), in whichever direction the old snap was wrong.

The scrap allowance is the standard end allowance on the stock bar
(`2 × stdE`), not the customer's own offsets, so the published per-mm rate does
not shift when someone chooses a different `S`.

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
| `REP_EMAIL` | Where lead notifications are sent — must be a real mailbox |
| `REPLY_TO` | Optional. Where customer replies land; defaults to `REP_EMAIL` |
| `CUSTOMER_CODES` | Optional. Customer account pricing as JSON; see `.env.example` |

Without `RESEND_API_KEY` the app still calculates and quotes normally — only the
email button returns "Email service not configured".

`FROM_EMAIL` is typically a send-only address on a domain with no mailbox, so
both emails set a reply-to: the customer's quote replies to `REPLY_TO` (or
`REP_EMAIL`), and the lead notification replies straight to the customer.

## Customer account pricing

An OEM given a link like `https://industriallinearrail.com/?c=ACME-7K2F` sees
their negotiated rates instead of published pricing, with the published figure
shown alongside so the saving is visible. The code can also be typed via the
"Account code" link in the header, and is held for the browser session.

Rates live in the `CUSTOMER_CODES` environment variable and are resolved by
`/api/customer`, which returns only the matching account — so the code list and
everyone else's rates are never sent to a browser and cannot be enumerated.
Precedence is per-part override, then the rail or block line rate, then the
published web price.

Quotes from a coded session are tagged on the lead notification
(`New Lead: Jane Smith @ Acme [Acme Automation]`), with the code re-resolved
server-side rather than trusted from the client.

See `lib/customers.js` for the margin guardrail: rails and blocks are bought at
different fractions of list, so they are not equally discountable.

## Analytics

Vercel Web Analytics is wired up with a script tag at the bottom of
`index.html`. It is cookieless, so no consent banner is required, and Vercel
serves the script itself — nothing to install. It only records anything once
Analytics is enabled on the project (project → Analytics → Enable); until then
the request 404s harmlessly and the page is unaffected. Delete the tag to turn
it off.

## Local development

Any static file server works for the UI; the email endpoint needs `vercel dev`.

```bash
python3 -m http.server 8000    # UI only
vercel dev                     # UI + /api/send-quote
```
