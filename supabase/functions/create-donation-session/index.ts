// create-donation-session Edge Function
//
// Creates a Stripe Checkout Session in payment mode for one-time
// donations. Donations do NOT grant entitlement; the row in the donations
// table is purely for analytics. The session can be created anonymously
// (user_id is optional) so the donate page works whether the user is
// signed in or not.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const ALLOWED_AMOUNTS_CENTS = new Set([300, 500, 1000]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }
  const amount = Number(body.amount);
  if (!ALLOWED_AMOUNTS_CENTS.has(amount)) {
    return new Response(
      JSON.stringify({ error: 'Amount must be one of 300, 500, 1000 cents' }),
      { status: 400 }
    );
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  let userId = null;
  if (token) {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData } = await userClient.auth.getUser();
    if (userData?.user) userId = userData.user.id;
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });
  const websiteOrigin = Deno.env.get('WEBSITE_ORIGIN') || 'https://video-subtitle-translator.vercel.app';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Video Subtitle Translator — Support',
            description: 'One-time voluntary contribution. No subscription or entitlement is granted.'
          },
          unit_amount: amount
        },
        quantity: 1
      }
    ],
    success_url: `${websiteOrigin}/donate?status=success`,
    cancel_url: `${websiteOrigin}/donate?status=canceled`,
    metadata: { type: 'donation', user_id: userId || '' }
  });

  if (userId) {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await serviceClient.from('donations').insert({
      user_id: userId,
      amount_cents: amount,
      currency: 'usd',
      stripe_session_id: session.id,
      status: 'pending'
    });
  }

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
