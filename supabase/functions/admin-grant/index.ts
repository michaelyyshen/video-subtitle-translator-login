// admin-grant Edge Function
//
// Back-office API for the marketing site. Two auth modes:
//   1. JWT — a logged-in admin user with `app_metadata.is_admin = true`.
//   2. Shared secret — `x-admin-secret` header matching ADMIN_GRANT_SECRET.
//      Used as a break-glass and for the original curl one-liner. Audit
//      log records `actor_id = NULL` and `actor_kind = 'break_glass'`.
//
// Deploy:   supabase functions deploy admin-grant --no-verify-jwt
// Secrets:  ADMIN_GRANT_SECRET (long random string)
//
// Routes:
//   GET  /admin-grant/users?search=&page=&pageSize=
//        → { users: [...], total }
//   GET  /admin-grant/users/:id
//        → { user, subscription, audit: [...] }
//   POST /admin-grant/grant             { email, days, plan }
//   POST /admin-grant/grant-by-email    { email, days, plan }   (legacy alias)
//   POST /admin-grant/revoke            { userId }
//   POST /admin-grant/promote           { userId }
//   POST /admin-grant/demote            { userId }

import { getServiceClient, jsonResponse, errorResponse } from '../_shared.ts';

const ADMIN_SECRET = Deno.env.get('ADMIN_GRANT_SECRET') ?? '';
const MAX_DAYS = 365;
const DEFAULT_DAYS = 30;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

type Actor =
  | { kind: 'admin_user'; id: string; email: string | null }
  | { kind: 'break_glass'; id: null; email: null };

interface AdminUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  status: string;
  plan: string;
  price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function authenticate(req: Request): Promise<Actor | { error: Response }> {
  const provided = req.headers.get('x-admin-secret') ?? '';
  if (ADMIN_SECRET && provided && provided === ADMIN_SECRET) {
    return { kind: 'break_glass', id: null, email: null };
  }
  const auth = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) {
    return { error: errorResponse('Missing Bearer token or admin secret.', 401, 'unauthorized') };
  }
  const token = m[1].trim();
  const admin = getServiceClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return { error: errorResponse('Invalid or expired session.', 401, 'unauthorized') };
  }
  const user = data.user;
  const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
  if (meta.is_admin !== true) {
    return { error: errorResponse('You do not have admin access.', 403, 'forbidden') };
  }
  return { kind: 'admin_user', id: user.id, email: user.email ?? null };
}

async function writeAudit(
  admin: ReturnType<typeof getServiceClient>,
  actor: Actor,
  action: 'grant' | 'extend' | 'revoke' | 'promote' | 'demote',
  targetId: string,
  metadata: Record<string, unknown>
) {
  const row = {
    actor_id: actor.kind === 'admin_user' ? actor.id : null,
    actor_kind: actor.kind,
    action,
    target_id: targetId,
    metadata
  };
  const { error } = await admin.from('admin_audit_log').insert(row);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[admin-grant] audit insert failed', { error, action, targetId });
  }
}

async function fetchUserByEmail(admin: ReturnType<typeof getServiceClient>, email: string): Promise<string | null> {
  const { data: row, error } = await admin
    .from('auth.users')
    .select('id')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!error && row?.id) return row.id as string;
  // Fallback: list users
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) return null;
  const match = list?.users?.find((u) => (u.email || '').toLowerCase() === email);
  return match?.id ?? null;
}

async function fetchUserById(
  admin: ReturnType<typeof getServiceClient>,
  id: string
): Promise<AdminUser | null> {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data?.user) return null;
  const u = data.user;
  const meta = (u.app_metadata ?? {}) as Record<string, unknown>;
  return {
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    is_admin: meta.is_admin === true
  };
}

async function fetchSubscription(
  admin: ReturnType<typeof getServiceClient>,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as SubscriptionRow;
}

function isValidPlan(p: unknown): p is 'monthly' | 'yearly' {
  return p === 'monthly' || p === 'yearly';
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  // Strip the function base path so the rest of the routing reads naturally.
  // e.g. /admin-grant/users → /users
  const rawPath = url.pathname.replace(/^\/admin-grant/, '') || '/';
  const segments = rawPath.split('/').filter(Boolean);

  // Authenticate every route (including break-glass). Without a valid
  // bearer or matching secret, return 401/403.
  const authResult = await authenticate(req);
  if ('error' in authResult) {
    return new Response(authResult.error.body, {
      status: authResult.error.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
  const actor = authResult;
  const admin = getServiceClient();

  try {
    // GET /users
    if (req.method === 'GET' && segments.length === 1 && segments[0] === 'users') {
      const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
      const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
      const requested = Number.parseInt(url.searchParams.get('pageSize') ?? `${DEFAULT_PAGE_SIZE}`, 10) || DEFAULT_PAGE_SIZE;
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));

      const perPage = Math.max(pageSize, 50); // listUsers doesn't take arbitrary page sizes; pad to 50 to keep calls cheap
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        return jsonResponse({ error: `List users failed: ${error.message}`, code: 'list_failed' }, 500, CORS_HEADERS);
      }
      let users = (data?.users ?? []).map<AdminUser>((u) => {
        const meta = (u.app_metadata ?? {}) as Record<string, unknown>;
        return {
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          is_admin: meta.is_admin === true
        };
      });
      if (search) users = users.filter((u) => (u.email ?? '').toLowerCase().includes(search));

      // Hydrate subscriptions in a single round-trip keyed by user_id.
      const userIds = users.map((u) => u.id);
      let subsByUser: Record<string, SubscriptionRow> = {};
      if (userIds.length > 0) {
        const { data: subRows } = await admin
          .from('subscriptions')
          .select('*')
          .in('user_id', userIds);
        subsByUser = Object.fromEntries(((subRows ?? []) as SubscriptionRow[]).map((r) => [r.user_id, r]));
      }

      const enriched = users.map((u) => ({ ...u, subscription: subsByUser[u.id] ?? null }));
      return jsonResponse(
        {
          users: enriched,
          page,
          pageSize,
          // `data.total` is only populated when a single page fits; Supabase
          // doesn't expose an exact count for `listUsers` so we return -1
          // to mean "unknown" and let the UI fall back to next-page detection.
          total: data?.users?.length === perPage ? page * perPage + 1 : page * perPage - perPage + (data?.users?.length ?? 0)
        },
        200,
        CORS_HEADERS
      );
    }

    // GET /users/:id
    if (req.method === 'GET' && segments.length === 2 && segments[0] === 'users' && isUuid(segments[1])) {
      const userId = segments[1];
      const u = await fetchUserById(admin, userId);
      if (!u) return errorResponse('User not found', 404, 'not_found');
      const sub = await fetchSubscription(admin, userId);
      const { data: audit } = await admin
        .from('admin_audit_log')
        .select('id, actor_id, actor_kind, action, metadata, created_at')
        .eq('target_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      return jsonResponse(
        { user: u, subscription: sub, audit: audit ?? [] },
        200,
        CORS_HEADERS
      );
    }

    // POST routes — require JSON body
    if (req.method === 'POST') {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        return errorResponse('Invalid JSON body', 400, 'bad_request');
      }

      // POST /grant
      if (segments.length === 1 && segments[0] === 'grant') {
        const userId = typeof body.userId === 'string' ? body.userId : null;
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;
        if (!userId && !email) return errorResponse('userId or email is required', 400, 'bad_request');
        if (body.plan !== undefined && !isValidPlan(body.plan)) return errorResponse('plan must be monthly or yearly', 400, 'bad_request');
        const days = Number.isFinite(body.days) ? Math.floor(Number(body.days)) : DEFAULT_DAYS;
        if (days <= 0 || days > MAX_DAYS) return errorResponse(`days must be between 1 and ${MAX_DAYS}`, 400, 'bad_request');
        const plan = isValidPlan(body.plan) ? body.plan : 'monthly';

        let targetId = userId;
        if (!targetId) {
          const found = email ? await fetchUserByEmail(admin, email) : null;
          if (!found) return errorResponse(`No auth user for ${email}`, 404, 'user_not_found');
          targetId = found;
        }

        const existing = await fetchSubscription(admin, targetId);
        const now = new Date();
        // Extension logic: if an active row already exists, extend from its
        // current period end (or now if it's in the past or missing). If
        // the row is canceled, start fresh from now.
        const base =
          existing &&
          existing.status === 'active' &&
          existing.current_period_end &&
          new Date(existing.current_period_end) > now
            ? new Date(existing.current_period_end)
            : now;
        const periodEnd = new Date(base.getTime() + days * 86400_000);

        const upsertRow = {
          user_id: targetId,
          status: 'active',
          plan,
          price_id: 'admin-grant',
          current_period_start: (existing?.current_period_start ?? now.toISOString()),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
          stripe_customer_id: `admin-grant-${targetId}`,
          stripe_subscription_id: `admin-grant-${targetId}`,
          updated_at: now.toISOString()
        };
        const { data: upserted, error: upsertError } = await admin
          .from('subscriptions')
          .upsert(upsertRow, { onConflict: 'user_id' })
          .select('*')
          .single();
        if (upsertError) {
          return errorResponse(`Upsert failed: ${upsertError.message}`, 500, 'upsert_failed');
        }
        const action: 'grant' | 'extend' = existing ? 'extend' : 'grant';
        await writeAudit(admin, actor, action, targetId, {
          days,
          plan,
          previous: existing ? { status: existing.status, current_period_end: existing.current_period_end } : null,
          new: { status: 'active', current_period_end: periodEnd.toISOString() }
        });
        return jsonResponse(
          {
            granted: true,
            extended: action === 'extend',
            subscription: upserted,
            user_id: targetId
          },
          200,
          CORS_HEADERS
        );
      }

      // POST /grant-by-email — backward compat with the original curl flow
      if (segments.length === 1 && segments[0] === 'grant-by-email') {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (!email || !email.includes('@')) {
          return errorResponse('email is required', 400, 'bad_request');
        }
        const days = Number.isFinite(body.days) ? Math.floor(Number(body.days)) : DEFAULT_DAYS;
        if (days <= 0 || days > MAX_DAYS) {
          return errorResponse(`days must be between 1 and ${MAX_DAYS}`, 400, 'bad_request');
        }
        const plan = isValidPlan(body.plan) ? body.plan : 'monthly';
        const userId = await fetchUserByEmail(admin, email);
        if (!userId) return errorResponse(`No auth user for ${email}`, 404, 'user_not_found');
        const now = new Date();
        const periodEnd = new Date(now.getTime() + days * 86400_000);
        const { data: upserted, error: upsertError } = await admin
          .from('subscriptions')
          .upsert(
            {
              user_id: userId,
              status: 'active',
              plan,
              price_id: 'admin-grant',
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              cancel_at_period_end: false,
              stripe_customer_id: `admin-grant-${userId}`,
              stripe_subscription_id: `admin-grant-${userId}`,
              updated_at: now.toISOString()
            },
            { onConflict: 'user_id' }
          )
          .select('user_id, status, plan, current_period_end')
          .single();
        if (upsertError) {
          return errorResponse(`Upsert failed: ${upsertError.message}`, 500, 'upsert_failed');
        }
        await writeAudit(admin, actor, 'grant', userId, { days, plan, via: 'grant-by-email' });
        return jsonResponse(
          { granted: true, user_id: upserted.user_id, status: upserted.status, plan: upserted.plan, current_period_end: upserted.current_period_end },
          200,
          CORS_HEADERS
        );
      }

      // POST /revoke
      if (segments.length === 1 && segments[0] === 'revoke') {
        const userId = typeof body.userId === 'string' ? body.userId : null;
        if (!userId || !isUuid(userId)) return errorResponse('userId is required', 400, 'bad_request');
        const existing = await fetchSubscription(admin, userId);
        if (!existing) return errorResponse('No subscription on file', 404, 'not_found');
        const now = new Date().toISOString();
        const { data, error } = await admin
          .from('subscriptions')
          .update({ status: 'canceled', canceled_at: now, cancel_at_period_end: false, updated_at: now })
          .eq('user_id', userId)
          .select('*')
          .single();
        if (error) return errorResponse(`Revoke failed: ${error.message}`, 500, 'update_failed');
        await writeAudit(admin, actor, 'revoke', userId, {
          previous: { status: existing.status, current_period_end: existing.current_period_end },
          new: { status: 'canceled', canceled_at: now }
        });
        return jsonResponse({ revoked: true, subscription: data }, 200, CORS_HEADERS);
      }

      // POST /promote
      if (segments.length === 1 && segments[0] === 'promote') {
        const userId = typeof body.userId === 'string' ? body.userId : null;
        if (!userId || !isUuid(userId)) return errorResponse('userId is required', 400, 'bad_request');
        const target = await fetchUserById(admin, userId);
        if (!target) return errorResponse('User not found', 404, 'not_found');
        if (target.is_admin) {
          return jsonResponse({ promoted: false, reason: 'already_admin' }, 200, CORS_HEADERS);
        }
        const { error } = await admin.auth.admin.updateUserById(userId, {
          app_metadata: { is_admin: true }
        });
        if (error) return errorResponse(`Promote failed: ${error.message}`, 500, 'update_failed');
        await writeAudit(admin, actor, 'promote', userId, { target_email: target.email });
        return jsonResponse({ promoted: true }, 200, CORS_HEADERS);
      }

      // POST /demote
      if (segments.length === 1 && segments[0] === 'demote') {
        const userId = typeof body.userId === 'string' ? body.userId : null;
        if (!userId || !isUuid(userId)) return errorResponse('userId is required', 400, 'bad_request');
        if (actor.kind === 'admin_user' && actor.id === userId) {
          return errorResponse('You cannot demote yourself.', 400, 'self_demote_blocked');
        }
        const target = await fetchUserById(admin, userId);
        if (!target) return errorResponse('User not found', 404, 'not_found');
        if (!target.is_admin) {
          return jsonResponse({ demoted: false, reason: 'not_admin' }, 200, CORS_HEADERS);
        }
        // Preserve any other app_metadata fields by patching just is_admin.
        const { error } = await admin.auth.admin.updateUserById(userId, {
          app_metadata: { is_admin: false }
        });
        if (error) return errorResponse(`Demote failed: ${error.message}`, 500, 'update_failed');
        await writeAudit(admin, actor, 'demote', userId, { target_email: target.email });
        return jsonResponse({ demoted: true }, 200, CORS_HEADERS);
      }
    }

    return errorResponse('Not found', 404, 'not_found');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return jsonResponse({ error: message, code: 'unhandled' }, 500, CORS_HEADERS);
  }
});
