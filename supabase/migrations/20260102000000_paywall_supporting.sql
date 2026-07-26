-- Paywall supporting tables for the marketing site. The `subscriptions`
-- table already exists in 20260101000000_subscriptions.sql; this migration
-- adds the missing pieces the Stripe webhook and donation flows need.
--
-- 1. Align the existing `subscriptions` table with the columns the
--    stripe-webhook upserts (cancel_at_period_end, current_period_start,
--    and a unique constraint on user_id so the webhook's
--    `onConflict: 'user_id'` works). The original migration only
--    constrained stripe_customer_id / stripe_subscription_id, so the
--    webhook would silently insert duplicate rows.
--
-- 2. Add `donations` for the one-time support flow.
--
-- 3. Add `processed_stripe_events` for the webhook idempotency guard.

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists current_period_start timestamptz;

-- Enforce one subscription row per user. Existing rows are de-duplicated
-- by keeping the most recently updated one.
do $$
declare
  dup_row record;
begin
  for dup_row in
    select user_id
    from public.subscriptions
    group by user_id
    having count(*) > 1
  loop
    delete from public.subscriptions s
    where s.user_id = dup_row.user_id
      and s.id <> (
        select id
        from public.subscriptions
        where user_id = dup_row.user_id
        order by updated_at desc nulls last, created_at desc nulls last
        limit 1
      );
  end loop;
end
$$;

drop index if exists public.subscriptions_user_id_uidx;
create unique index if not exists subscriptions_user_id_uidx
  on public.subscriptions (user_id);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  amount_cents integer not null,
  currency text not null default 'usd',
  stripe_session_id text unique,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists donations_user_id_idx on public.donations (user_id);

alter table public.donations enable row level security;

drop policy if exists "users read own donations" on public.donations;
create policy "users read own donations"
  on public.donations for select
  to authenticated
  using (user_id = auth.uid());

create table if not exists public.processed_stripe_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.processed_stripe_events enable row level security;
-- Webhook uses the service role key (RLS bypassed) so no policies are needed.
