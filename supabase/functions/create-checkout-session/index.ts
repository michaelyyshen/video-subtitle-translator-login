// create-checkout-session Edge Function
//
// Creates a Stripe Checkout Session in subscription mode for the
// authenticated user. Returns the URL the extension/website should
// redirect the user to.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const PLAN_TO_PRICE_ENV = {
  monthly: 'STRIPE_PRICE_MONTHLY',
  yearly: 'STRIPE_PRICE_YEARLY'
};

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
  const user = userData.user;

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }
  const plan = body.plan;
  const envName = PLAN_TO_PRICE_ENV[plan];
  if (!envName) {
    return new Response(JSON.stringify({ error: 'Unknown plan' }), { status: 400 });
  }
  const priceId = Deno.env.get(envName);
  if (!priceId) {
    return new Response(JSON.stringify({ error: 'Price not configured' }), { status: 500 });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

  // Reuse an existing customer if one exists for this user.
  const serviceClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: existing } = await serviceClient
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const websiteOrigin = Deno.env.get('WEBSITE_ORIGIN') || 'https://video-subtitle-translator.vercel.app';
  const successUrl = `${websiteOrigin}/account?checkout=success`;
  const cancelUrl = `${websiteOrigin}/pricing?checkout=canceled`;

  const sessionParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.id,
    metadata: { user_id: user.id, plan }
  };
  if (existing?.stripe_customer_id) {
    sessionParams.customer = existing.stripe_customer_id;
  } else {
    sessionParams.customer_email = user.email;
    sessionParams.customer_creation = 'always';
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return new Response(JSON.stringify({ url: session.url, id: session.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
