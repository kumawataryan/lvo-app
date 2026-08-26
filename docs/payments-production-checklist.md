# Payments: pre-production checklist

Everything below reflects the current implementation: **Razorpay** (INR, live-mode-capable), **PayPal**
(USD, redirect-based checkout), and **Etsy** (external purchase, manually activated). Work through this
before charging real users.

## 1. Environment variables — set in your hosting provider, not just `.env`

Local `.env` only affects `npm run dev` on your machine. Every var in `.env.example` needs to be set in
your actual hosting platform's environment settings (Vercel/Railway/etc.) before deploying, including:

- `SUPABASE_SERVICE_ROLE_KEY` — never expose this to the client; it bypasses RLS.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_WEBHOOK_SECRET`,
  `RAZORPAY_PLAN_ID_MONTHLY`, `RAZORPAY_PLAN_ID_YEARLY`
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, `PAYPAL_WEBHOOK_ID`,
  `PAYPAL_PLAN_ID_MONTHLY`, `PAYPAL_PLAN_ID_YEARLY`
- `NEXT_PUBLIC_ETSY_SHOP_URL`

## 2. Database

- [ ] Apply all migrations under `supabase/migrations/` to the **production** Supabase project (not just
      your dev/staging one) — especially `202608260004_payments.sql`, `202608260005_purchase_cancellation.sql`,
      and `202608260006_multi_gateway.sql`.
- [ ] Confirm RLS on `purchases`: users can only `select`/`insert` their own rows; only the service-role
      key can `update` status. Verify this hasn't drifted from the migrations.
- [ ] Decide who (and how) reviews pending Etsy purchases — there's no admin UI for this yet. At minimum,
      save a Supabase SQL snippet like:
      ```sql
      select id, user_id, plan_id, amount, external_reference, created_at
      from purchases
      where gateway = 'etsy' and status = 'created'
      order by created_at desc;
      ```

## 3. Razorpay

- [ ] Currently **INR only** — this account does not have International/Export Payments enabled (confirmed:
      attempting USD returned "Currency provided is not supported"). If you want USD later, that has to be
      enabled by Razorpay first (may need KYC/business docs), then re-run the plan setup script with
      `currency: "USD"` restored.
- [ ] Switch from **test-mode keys to live keys** in the Razorpay dashboard before go-live.
- [ ] Re-run `node --env-file=.env scripts/setup-razorpay-plans.mjs` **against live-mode keys** — test-mode
      Plan IDs do not carry over to live mode. Update `RAZORPAY_PLAN_ID_MONTHLY`/`_YEARLY` in production env.
- [ ] Re-create the webhook in the **live** dashboard (not sandbox/test) pointing at
      `https://<your-domain>/api/payments/razorpay/webhook`, with the events: `payment.captured`,
      `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`,
      `subscription.cancelled`, `subscription.paused`. Generate a fresh webhook secret for live mode.
- [ ] Do a full test purchase with a real (small) charge or Razorpay's documented live-mode test flow before
      announcing launch.

## 4. PayPal

- [ ] Currently pointed at **sandbox** (`PAYPAL_ENV=sandbox` unless you changed it). Create a **live** PayPal
      app in the developer dashboard to get live `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`.
- [ ] Re-run `node --env-file=.env scripts/setup-paypal-plans.mjs` with `PAYPAL_ENV=live` and live credentials
      to create live Billing Plans. Update `PAYPAL_PLAN_ID_MONTHLY`/`_YEARLY`.
- [ ] Re-create the webhook under the **live** app (webhooks are per-app, sandbox and live are separate) at
      `/api/payments/paypal/webhook`, subscribed to: `Billing subscription activated`, `cancelled`,
      `suspended`, `payment failed`, and `Payment sale completed`. Copy the new live `PAYPAL_WEBHOOK_ID`.
- [ ] Test the full redirect flow end-to-end in live mode with a real low-value purchase — the return-URL
      capture logic (`/subscription/paypal/return`) hasn't been exercised with real PayPal credentials yet.
- [ ] Confirm your PayPal business account can actually receive USD (varies by country/account type).

## 5. Etsy

- [ ] Confirm `NEXT_PUBLIC_ETSY_SHOP_URL` points at the real, live shop/listing.
- [ ] Define your actual manual-activation process: how often you check pending rows (query above), how you
      match a Supabase `purchases` row to a real Etsy order (currently just `external_reference`, optional
      free text the buyer can leave blank), and your target turnaround time (the UI currently promises
      "within 24 hours" — make sure that's realistic for your process).
- [ ] Decide what happens if an Etsy "subscription" (Monthly/Yearly bought via Etsy) needs to be renewed or
      cancelled — this is entirely manual today; there's no automated reminder or expiry.

## 6. Currency & pricing sanity check

- Razorpay charges **INR** (₹129 / ₹1,299 / ₹8,299).
- PayPal and Etsy charge **USD** (Etsy is base + $1 to cover their fees: $2.50 / $16 / $101; PayPal is
  base: $1.50 / $15 / $100).
- These are genuinely different currencies for different gateways by design — re-confirm this is still the
  intended pricing/positioning before launch, and that the numbers still make sense relative to each other
  (e.g. FX rates may have drifted since these were set).

## 7. Legal

- [ ] `/terms` and `/privacy` currently contain **placeholder text** ("Placeholder content — replace with
      your actual terms before launch"). Replace with real, reviewed copy before accepting real payments —
      the subscription screen already links to both and states purchases are non-refundable, which needs to
      be legally accurate for your jurisdiction.

## 8. End-to-end QA pass (do this last, in test/sandbox mode first)

For each gateway, walk through: select plan → checkout → success → confirm `purchases` row flips to
`active`/`completed` → confirm the app unlocks downloads → (for subscriptions) cancel → confirm access
persists until period end (Razorpay) or ends immediately (PayPal) → for Razorpay only, resume → confirm
webhook-driven renewal updates `current_period_end`. Also test the failure paths: declined card, closing the
Razorpay modal, cancelling mid-PayPal-redirect (`?paypal=cancelled`).
