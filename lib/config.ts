// Runtime config for the marketing website. Reads from public env vars so
// the same values are used by both the server (for SSR metadata) and the
// client (for live auth/billing calls). If values are missing the site still
// renders — pages show clear error messages at the point of use.

export interface PricingPlan {
  amount: number; // cents
  currency: string;
  label: string;
  priceId: string;
}

export interface SiteConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  stripePublishableKey: string;
  extensionId: string;
  pricing: { monthly: PricingPlan; yearly: PricingPlan };
  oauthProviders: string[];
}

const usd = (code: 'monthly' | 'yearly', amount: number, label: string): PricingPlan => ({
  amount,
  currency: 'USD',
  label,
  priceId: process.env[`NEXT_PUBLIC_STRIPE_PRICE_${code.toUpperCase()}`] || ''
});

function parseOauthProviders(raw: string | undefined): string[] {
  // Comma-separated list of provider names (e.g. "google,github,apple").
  // Undefined / empty falls back to ["google"] so the social button is
  // shown by default; set NEXT_PUBLIC_SUPABASE_OAUTH_PROVIDERS="" to hide.
  if (raw === undefined) return ['google'];
  const list = raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  return list;
}

export const siteConfig: SiteConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  // Prefer the legacy ANON_KEY name; fall back to the new PUBLISHABLE_KEY
  // name that Supabase's Vercel integration auto-installs.
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    '',
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  extensionId: process.env.NEXT_PUBLIC_EXTENSION_ID || '',
  pricing: {
    monthly: usd('monthly', 499, 'Monthly'),
    yearly: usd('yearly', 4999, 'Yearly')
  },
  oauthProviders: parseOauthProviders(process.env.NEXT_PUBLIC_SUPABASE_OAUTH_PROVIDERS)
};

export function isSupabaseConfigured() {
  return Boolean(siteConfig.supabaseUrl) && Boolean(siteConfig.supabaseAnonKey);
}
