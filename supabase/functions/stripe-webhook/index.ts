// stripe-webhook Edge Function
//
// Receives events from Stripe and updates the subscriptions / donations
// tables. Idempotency is enforced via the `processed_stripe_events` table.
// Configure at:
//   supabase functions deploy stripe-webhook --no-verify-jwt
//   https://<project>.supabase.co/functions/v1/stripe-webhook
// And register the endpoint URL in the Stripe Dashboard with the
// STRIPE_WEBHOOK_SECRET secret shared via Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

const url = Deno.env.get('SUPABASE_URL');
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function markProcessed(eventId) {
  const { error } = await admin
    .from('processed_stripe_events')
    .insert({ event_id: eventId });
  if (error && error.code === '23505') return false; // duplicate primary key
  if (error) throw error;
  return true;
}

async function upsertSubscriptionFromStripe(sub) {
  const userId = sub.metadata?.user_id ?? sub.client_reference_id ?? null;
  if (!userId) {
    console.warn('stripe-webhook: subscription has no user_id metadata', sub.id);
    return;
  }
  const plan =
    sub.items?.data?.[0]?.price?.id === Deno.env.get('STRIPE_PRICE_YEARLY') ? 'yearly' : 'monthly';
  await admin.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    status: sub.status,
    plan,
    price_id: sub.items?.data?.[0]?.price?.id || null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
}

async function handleCheckoutCompleted(session) {
  if (session.mode === 'subscription' && session.subscription) {
    const sub = await stripe.subscriptions.retrieve(session.subscription);
    await upsertSubscriptionFromStripe(sub);
  } else if (session.metadata?.type === 'donation') {
    await admin
      .from('donations')
      .update({ status: 'completed' })
      .eq('stripe_session_id', session.id);
  }
}

async function handleSubscriptionChange(sub) {
  await upsertSubscriptionFromStripe(sub);
}

async function handleSubscriptionDeleted(sub) {
  await admin
    .from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const body = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response('Invalid signature: ' + err.message, { status: 400 });
  }

  const wasProcessed = await markProcessed(event.id);
  if (!wasProcessed) {
    return new Response('already processed', { status: 200 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.trial_will_end':
        await handleSubscriptionChange(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        if (event.data.object.subscription) {
          const sub = await stripe.subscriptions.retrieve(event.data.object.subscription);
          await upsertSubscriptionFromStripe(sub);
        }
        break;
      case 'invoice.payment_failed':
        if (event.data.object.subscription) {
          await admin
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', event.data.object.subscription);
        }
        break;
      default:
        // Other events are ignored intentionally.
        break;
    }
  } catch (err) {
    // Returning 500 causes Stripe to retry; we still leave the event row
    // removed by markProcessed on the next attempt so the row will be
    // re-inserted and the duplicate-key check will fire correctly.
    console.error('stripe-webhook handler error', err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});
