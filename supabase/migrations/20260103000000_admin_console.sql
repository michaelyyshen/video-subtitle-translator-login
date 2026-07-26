-- Admin console: per-user admin role, audit log, RLS for admins.
--
-- The `is_admin` flag lives in `auth.users.raw_app_meta_data` so it flows
-- through Supabase's JWT automatically. We add:
--   1. A trigger that invalidates the user's auth sessions whenever their
--      app_metadata changes — Supabase access tokens are immutable for their
--      lifetime, so removing admin would otherwise leave the demoted user
--      with admin powers until their token expires.
--   2. A `public.admin_audit_log` table that every admin action writes to.
--   3. A new RLS policy on `public.subscriptions` letting admins SELECT any
--      user's subscription. Writes still go through the service role.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_kind text not null check (actor_kind in ('admin_user', 'break_glass')),
  action text not null check (action in ('grant', 'extend', 'revoke', 'promote', 'demote')),
  target_id uuid not null references auth.users(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_target_id_idx
  on public.admin_audit_log (target_id, created_at desc);
create index if not exists admin_audit_log_actor_id_idx
  on public.admin_audit_log (actor_id, created_at desc);

alter table public.admin_audit_log enable row level security;
-- Writes happen exclusively from the admin-grant edge function via the
-- service-role key (RLS bypassed). Reads are intentionally not granted
-- to anon / authenticated — the admin console uses a server-side proxy.

-- Invalidate sessions on app_metadata change. Without this, demoting a user
-- does not take effect until their access token expires (default 1h).
create or replace function public.auth_users_invalidate_sessions()
returns trigger
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.raw_app_meta_data is distinct from new.raw_app_meta_data then
    delete from auth.sessions where user_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists auth_users_invalidate_sessions on auth.users;
create trigger auth_users_invalidate_sessions
  after update on auth.users
  for each row execute function public.auth_users_invalidate_sessions();

-- Admins can read any subscription. Writes still require the service role.
drop policy if exists "admin reads all subscriptions" on public.subscriptions;
create policy "admin reads all subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'is_admin') = 'true');
