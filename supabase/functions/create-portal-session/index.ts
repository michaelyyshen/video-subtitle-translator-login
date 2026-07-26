// create-portal-session Edge Function
//
// Creates a Stripe Customer Portal session for the authenticated user so
// the user can manage their subscription, payment methods, and invoices.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }
  const userId = userData.user.id;

  const serviceClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: existing } = await serviceClient
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing?.stripe_customer_id) {
    return new Response(
      JSON.stringify({ error: 'No Stripe customer for this user yet' }),
      { status: 404 }
    );
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
  const websiteOrigin = Deno.env.get('WEBSITE_ORIGIN') || 'https://video-subtitle-translator.vercel.app';
  const portal = await stripe.billingPortal.sessions.create({
    customer: existing.stripe_customer_id,
    return_url: `${websiteOrigin}/account`
  });

  return new Response(JSON.stringify({ url: portal.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
