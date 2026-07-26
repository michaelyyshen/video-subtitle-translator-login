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

The Edge Functions (under `../supabase/functions`) need the **secret** values
on the Supabase side — see `../supabase/README.md`.

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
so the extension's "Sign in" button opens the live site.

## Pages

| Route        | Description                                                  |
| ------------ | ------------------------------------------------------------ |
| `/`          | Marketing home with hero, features, how-it-works, FAQ        |
| `/pricing`   | Plan cards, kicks off Stripe Checkout via Edge Function      |
| `/login`     | Email + password sign-in (Supabase Auth)                     |
| `/signup`    | Email + password sign-up (Supabase Auth)                     |
| `/account`   | Subscription summary + Stripe Customer Portal                |
| `/donate`    | One-time donations via Stripe Checkout                       |
| `/privacy`   | Privacy policy                                               |
| `/terms`     | Terms of service                                             |

## Architecture notes

- Auth uses a minimal hand-rolled Supabase client (`lib/supabaseAuth.ts`)
  rather than `@supabase/supabase-js` to keep the bundle tiny and avoid
  the network round-trips that library version brings. It persists the
  session in `localStorage`.
- All billing flows go through the Supabase Edge Functions in
  `../supabase/functions/`, which hold the Stripe secret key and the
  upstream translation provider key. The website never sees either
  secret.
- After a successful Stripe checkout, `notifyExtensionCheckout()` pings
  the extension via `chrome.runtime.sendMessage(extensionId, …)` so the
  entitlement cache refreshes without a full reload.
- Server components are used everywhere except the auth/billing pages
  (which need client-side state and browser globals).

## Database schema

The marketing site reads subscription state from `public.subscriptions`
(via PostgREST) and from `auth.users` (via the Supabase Auth API). The
schema lives in the **parent extension repo** under
`../supabase/migrations/` because the same database is shared.

If you ever need to bootstrap a fresh Supabase project for this site:

1. Copy `supabase/migrations/20260101000000_subscriptions.sql` from this
   repo into the new project's `supabase/migrations/` directory and run
   `supabase db push`.
2. Apply any other migrations the extension relies on (auth triggers,
   RLS helpers, etc.) from `../supabase/migrations/`.

Without the `public.subscriptions` table, `/account` will still render
the email and an "inactive" status — the marketing site now degrades
gracefully when the table is missing — but subscription-aware UI
("Manage billing", the active plan badge) will be blank.

### One-off setup via the Supabase dashboard

If you just want to apply the migration right now without touching the
CLI:

1. Open <https://supabase.com/dashboard/project/lzubnnlstujwjficryac/sql/new>
   (replace the project ref with yours).
2. Paste the contents of
   `supabase/migrations/20260101000000_subscriptions.sql`.
3. Click **Run**. This creates `public.subscriptions` with RLS so a
   signed-in user can only read their own row.

## Edge Function CORS

Every Vercel preview deployment (e.g.
`https://video-subtitle-translator-login-2rnnh07x2.vercel.app`) sends
cross-origin `fetch` calls to your Supabase project's Edge Functions
(`create-checkout-session`, `create-portal-session`, etc.). Each Edge
Function must respond to the preflight `OPTIONS` request with an
`Access-Control-Allow-Origin` header that matches the calling origin.

The pattern in `../supabase/functions/_shared/cors.ts` is:

```ts
const ALLOW_ORIGIN_PATTERNS = [
  /^https:\/\/video-subtitle-translator(-login)?\.vercel\.app$/,
  /^https:\/\/video-subtitle-translator-login-[a-z0-9]+\.vercel\.app$/, // preview
  /^http:\/\/localhost:3000$/
];
```

If you add a new domain (staging, custom domain, additional preview
slugs) you must update the allow-list and redeploy the functions:

```bash
cd ../supabase
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
```

Symptoms of a missing origin in the allow-list:

- Browser console: `Access to fetch at '…create-checkout-session' from
  origin '…vercel.app' has been blocked by CORS policy: Response to
  preflight request doesn't pass access control check`.
- Network tab: preflight returns a non-2xx status, request never
  reaches the handler.

## Legacy static site

`website/_legacy/` contains the original static HTML/JS/CSS, kept for
reference. It is gitignored and excluded from the build.
