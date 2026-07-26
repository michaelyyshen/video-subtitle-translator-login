# Video Subtitle Translator — Marketing Website

Next.js 14 (App Router) + TypeScript + Tailwind app. This is the marketing
site and the host for sign-in, account, pricing, and donate pages. The
underlying Supabase project and Edge Functions are the same ones the Chrome
extension uses.

## Local development

```bash
cd website
cp .env.example .env.local  # fill in the values below
npm install
npm run dev
```

The dev server runs on <http://localhost:3000>.

## Required env vars (Vercel project settings)

| Variable                              | What it is                                                          |
| ------------------------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`            | Supabase project URL (e.g. `https://abcdefghij.supabase.co`)        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | Supabase anon key (publishable, safe in the browser)                 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`  | Stripe publishable key (`pk_live_…` / `pk_test_…`)                  |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`    | Stripe Price ID for the $4.99/month plan                            |
| `NEXT_PUBLIC_STRIPE_PRICE_YEARLY`     | Stripe Price ID for the $49.99/year plan                            |
| `NEXT_PUBLIC_EXTENSION_ID`            | Chrome Web Store extension ID, used for post-checkout refresh        |
| `NEXT_PUBLIC_SITE_URL`                | Canonical site URL for OG/Twitter metadata (optional)               |

The Edge Functions (under `supabase/functions/`) need the **secret** values
on the Supabase side — see `supabase/README.md`.

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set the **Root Directory** to `website`.
4. Vercel auto-detects Next.js. The framework preset is locked in `vercel.json`.
5. Add the env vars above in the Vercel project settings.
6. Deploy. The production URL will be something like
   `https://video-subtitle-translator.vercel.app`.

After the first deploy, update `extension/lib/config.js` and
`extension/config.example.js` to point `WEBSITE_ORIGIN` at the production URL
so the extension's "Sign in" button opens the live site. (The companion
extension lives in the `video-subtitle-translator` repo.)

## Pages

| Route        | Description                                                  |
| ------------ | ------------------------------------------------------------ |
| `/`          | Marketing home with hero, features, how-it-works, FAQ        |
| `/pricing`   | Plan cards, kicks off Stripe Checkout via Edge Function      |
| `/login`     | Email + password sign-in (Supabase Auth)                     |
| `/signup`    | Email + password sign-up (Supabase Auth)                     |
| `/account`   | Subscription summary + Stripe Customer Portal                |
| `/admin`     | Back-office console: list users, grant / extend / revoke subs, promote / demote admins. Visible only to users with `app_metadata.is_admin = true`. |
| `/donate`    | One-time donations via Stripe Checkout                       |
| `/privacy`   | Privacy policy                                               |
| `/terms`     | Terms of service                                             |

## Architecture notes

- Auth uses a minimal hand-rolled Supabase client (`lib/supabaseAuth.ts`)
  rather than `@supabase/supabase-js` to keep the bundle tiny and avoid
  the network round-trips that library version brings. It persists the
  session in `localStorage`.
- All billing flows go through the Supabase Edge Functions in
  `supabase/functions/`, which hold the Stripe secret key and the
  upstream translation provider key. The website never sees either
  secret.
- After a successful Stripe checkout, `notifyExtensionCheckout()` pings
  the extension via `chrome.runtime.sendMessage(extensionId, …)` so the
  entitlement cache refreshes without a full reload.
- Server components are used everywhere except the auth/billing pages
  (which need client-side state and browser globals).

## Admin console

The `/admin` page is a back-office for listing users and managing their
subscriptions. It is gated by a per-user `is_admin` claim in
`auth.users.raw_app_meta_data` (flows through the JWT automatically).
The Nav only shows the "Admin" menu item when the signed-in user has
that claim; the edge function re-verifies server-side, so a hand-crafted
localStorage session cannot grant access.

Two auth modes for the underlying `admin-grant` Edge Function:

- **JWT** — used by the UI. The function calls `auth.getUser(token)` and
  checks `user.app_metadata.is_admin === true`.
- **Shared secret** — used as a break-glass and for the original curl
  one-liner (`x-admin-secret: $ADMIN_GRANT_SECRET`). The audit log
  records `actor_id = NULL` and `actor_kind = 'break_glass'`.

Every action (grant, extend, revoke, promote, demote) writes a row to
`public.admin_audit_log` with the actor's id (or null for break-glass),
the target's id, and a metadata JSONB blob with before/after state.

Full API reference and curl examples live in
[`supabase/functions/admin-grant/README.md`](supabase/functions/admin-grant/README.md).

To make someone an admin (one-off, from the Supabase SQL editor):

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb
where email = 'someone@example.com';
```

The migration `20260103000000_admin_console.sql` installs a trigger on
`auth.users` that deletes the user's `auth.sessions` rows whenever
`raw_app_meta_data` changes, so the next request picks up the new role.

## Database schema

The marketing site reads subscription state from `public.subscriptions`
(via PostgREST) and from `auth.users` (via the Supabase Auth API). The
schema lives in this repo under `supabase/migrations/`.

If you ever need to bootstrap a fresh Supabase project for this site:

1. `supabase db push` from this directory — applies
   `supabase/migrations/20260101000000_subscriptions.sql` (the
   `subscriptions` table),
   `supabase/migrations/20260102000000_paywall_supporting.sql` (the
   unique index the Stripe webhook's `onConflict: 'user_id'` upsert
   needs, plus the `donations` and `processed_stripe_events` tables),
   and
   `supabase/migrations/20260103000000_admin_console.sql` (the
   `admin_audit_log` table, an `app_metadata` change trigger on
   `auth.users`, and the admin SELECT policy on `public.subscriptions`).

Without the `public.subscriptions` table, `/account` will still render
the email and an "inactive" status — the marketing site now degrades
gracefully when the table is missing — but subscription-aware UI
("Manage billing", the active plan badge) will be blank.

### One-off setup via the Supabase dashboard

If you just want to apply the migrations right now without touching the
CLI:

1. Open <https://supabase.com/dashboard/project/lzubnnlstujwjficryac/sql/new>
   (replace the project ref with yours).
2. Paste the contents of
   `supabase/migrations/20260101000000_subscriptions.sql`,
   `supabase/migrations/20260102000000_paywall_supporting.sql`, and
   `supabase/migrations/20260103000000_admin_console.sql`.
3. Click **Run** for each. This creates `public.subscriptions` with RLS so
   a signed-in user can only read their own row, and adds the admin
   console's audit log + `app_metadata` change trigger.

## Extension entitlement verification

The Chrome extension needs a programmatic way to ask "is this signed-in user
allowed to use paid features?" before it calls the upstream translation
provider. The marketing site exposes a small JSON endpoint for that:

```
GET /api/extension/verify
Authorization: Bearer <supabase_access_token>
```

Response (always 200 unless the server itself is unhealthy — the extension
treats every field, not the HTTP status, as the source of truth):

```jsonc
{
  "authenticated": true,
  "entitled": true,
  "user": { "id": "…", "email": "user@example.com" },
  "subscription": {
    "plan": "monthly",
    "status": "active",
    "current_period_end": "2026-08-12T00:00:00.000Z"
  }
}
```

Rules:

- `authenticated: false` — the Bearer token is missing or invalid. Extension
  should send the user to `/login`.
- `authenticated: true, entitled: false` — user is signed in but has no row
  in `public.subscriptions`, or the row's status is not `active`/`trialing`
  (e.g. `past_due`, `canceled`). Extension should send the user to
  `/pricing`.
- `authenticated: true, entitled: true` — the extension may call the
  translation Edge Function with this access token.

The endpoint reads the user's session via `/auth/v1/user` and the
subscription row via PostgREST (`/rest/v1/subscriptions`). RLS on
`public.subscriptions` (`20260101000000_subscriptions.sql`) ensures the
endpoint only ever sees the caller's own row, even if the token were
mis-used. Responses are `Cache-Control: no-store` and CORS is wide-open
because the extension authenticates with a Bearer token, not cookies.

## Edge Function CORS

Each Edge Function (`create-checkout-session`, `create-portal-session`,
`create-donation-session`) returns `Access-Control-Allow-Origin: '*'` on
its preflight `OPTIONS` response. That is safe here because the functions
authenticate with a Supabase **Bearer token** in the request (not
cookies), so the wildcard CORS does not leak the caller's credentials.

If you ever need to lock this down to specific origins (recommended for
stricter compliance audits), update the `corsHeaders()` helper in
`supabase/functions/_shared.ts` and the per-function `OPTIONS` handlers
in the relevant `index.ts` files, then redeploy:

```bash
cd supabase
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy create-donation-session
```

Symptoms of a missing or wrong origin in the allow-list:

- Browser console: `Access to fetch at '…create-checkout-session' from
  origin '…vercel.app' has been blocked by CORS policy: Response to
  preflight request doesn't pass access control check`.
- Network tab: preflight returns a non-2xx status, request never
  reaches the handler.

## Legacy static site

`website/_legacy/` contains the original static HTML/JS/CSS, kept for
reference. It is gitignored and excluded from the build.
