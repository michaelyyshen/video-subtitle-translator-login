# Supabase backend

This folder contains the server-side code for the paid extension: Supabase
Edge Functions and the database migration that holds subscriptions and
donations.

## One-time setup

1. Create a Supabase project and link it:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
2. Apply the database migration:
   ```bash
   npx supabase db push
   ```
3. Create the Stripe products in the Dashboard (or via the Stripe CLI):
   - `vst_pro_monthly` — recurring, $4.99 / month
   - `vst_pro_yearly` — recurring, $49.99 / year
4. Copy `.env.example` to `supabase/.env` and fill in the secrets. The
   Supabase CLI picks them up automatically when you deploy.
5. Deploy the Edge Functions:
   ```bash
   npx supabase functions deploy translate
   npx supabase functions deploy create-checkout-session
   npx supabase functions deploy create-portal-session
   npx supabase functions deploy create-donation-session
   npx supabase functions deploy stripe-webhook --no-verify-jwt
   ```
6. In the Stripe Dashboard, create a webhook endpoint that points to:
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   Subscribe to `checkout.session.completed`,
   `customer.subscription.created|updated|deleted`,
   `invoice.payment_succeeded`, `invoice.payment_failed`. The signing
   secret goes into `STRIPE_WEBHOOK_SECRET`.

## Edge Function inventory

- `translate/` — authenticated translate proxy. The extension calls this
  with the user's JWT; it checks the `subscriptions` table and forwards to
  the upstream translation provider.
- `create-checkout-session/` — returns a Stripe Checkout URL in
  subscription mode. Looks up an existing Stripe customer by user_id to
  reuse it.
- `create-portal-session/` — returns a Stripe Customer Portal URL.
- `create-donation-session/` — returns a Stripe Checkout URL in payment
  mode. $3 / $5 / $10 presets; no entitlement is granted.
- `stripe-webhook/` — verifies the signature, switches on event type, and
  upserts the `subscriptions` / `donations` tables. Idempotent via the
  `processed_stripe_events` table.
- `_shared.ts` — small helpers used by every function.

## Schema

`supabase/migrations/20260101000000_subscriptions.sql` creates the
`subscriptions` table (one row per paid user). The follow-up
`20260102000000_paywall_supporting.sql` adds the unique index on `user_id`
that the Stripe webhook's `onConflict: 'user_id'` upsert needs, plus the
`donations` and `processed_stripe_events` tables.

Row Level Security is enabled; users can only read their own
subscription. Writes happen through the service-role key from inside the
Edge Functions.
