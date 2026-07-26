-- Subscription tables for the marketing website.
-- The marketing site reads via PostgREST at /rest/v1/subscriptions using the
-- caller's Supabase JWT, so RLS must let a user SELECT only their own row(s).
-- Inserts / updates are written by the `create-checkout-session` and
-- `stripe-webhook` edge functions using the service-role key, so RLS for
-- those operations is restrictive on purpose.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null,
  plan text not null,
  price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);

-- Trigger to keep updated_at in sync.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- RLS: users can read their own subscriptions; writes only via service role.
alter table public.subscriptions enable row level security;

drop policy if exists "users read their own subscriptions" on public.subscriptions;
create policy "users read their own subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

-- Inserts / updates / deletes are performed by edge functions using the
-- service-role key, which bypasses RLS. No policies for those operations are
-- needed; without them, role-authenticated users cannot mutate the table
-- directly from the client.
