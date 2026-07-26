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

## Legacy static site

`website/_legacy/` contains the original static HTML/JS/CSS, kept for
reference. It is gitignored and excluded from the build.
