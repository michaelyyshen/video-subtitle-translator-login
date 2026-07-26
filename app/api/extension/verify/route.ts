// Programmatic entitlement verification for the Video Subtitle Translator
// Chrome extension. The extension calls this endpoint with the user's
// Supabase access token (read from localStorage or chrome.storage) and gets
// back a small JSON envelope describing whether the user is signed in and
// whether they have an active subscription.
//
// Endpoint: GET /api/extension/verify
// Headers:  Authorization: Bearer <supabase_access_token>
// Response: { authenticated, entitled, reason?, user?, subscription? }
//
// Why a server route instead of calling Supabase directly from the extension:
//   - Centralizes the "is this user allowed to use paid features?" decision in
//     one place so the extension, the marketing site, and any future client
//     stay in sync.
//   - Lets us add server-only checks later (e.g. abuse signals, feature flags)
//     without shipping a new extension version.
//   - The endpoint runs on Vercel's Edge / Node runtime; it never sees the
//     user's password or refresh token — only the short-lived access token.

import { NextResponse, type NextRequest } from 'next/server';
import { siteConfig } from '@/lib/config';

export const runtime = 'nodejs';
// The extension may poll this on launch; never cache the response.
export const dynamic = 'force-dynamic';

interface VerifyResponse {
  authenticated: boolean;
  entitled: boolean;
  reason?: string;
  user?: { id: string; email: string | null };
  subscription: {
    plan: string | null;
    status: string | null;
    current_period_end: string | null;
  } | null;
}

const ENTITLED_STATUSES = new Set(['active', 'trialing']);

export async function GET(req: NextRequest) {
  const url = siteConfig.supabaseUrl;
  const anonKey = siteConfig.supabaseAnonKey;

  if (!url || !anonKey) {
    // Mirror the rest of the marketing site: if Supabase env vars are missing
    // we still return JSON (not a 500 page) so the extension can degrade
    // gracefully and the user gets a clear error.
    return NextResponse.json<VerifyResponse>(
      {
        authenticated: false,
        entitled: false,
        reason: 'Supabase is not configured on the server.',
        subscription: null
      },
      { status: 503 }
    );
  }

  const auth = req.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) {
    return NextResponse.json<VerifyResponse>(
      {
        authenticated: false,
        entitled: false,
        reason: 'Missing Bearer token.',
        subscription: null
      },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
    );
  }
  const token = match[1].trim();

  // 1. Confirm the token is still valid and pull the user record.
  let user: { id: string; email?: string | null } | null = null;
  try {
    const userResp = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    if (!userResp.ok) {
      return NextResponse.json<VerifyResponse>(
        {
          authenticated: false,
          entitled: false,
          reason: userResp.status === 401 ? 'Session expired or invalid.' : 'Could not validate session.',
          subscription: null
        },
        { status: 200 }
      );
    }
    const body = (await userResp.json()) as { id?: string; email?: string | null };
    if (!body?.id) {
      return NextResponse.json<VerifyResponse>(
        {
          authenticated: false,
          entitled: false,
          reason: 'Session is missing a user id.',
          subscription: null
        },
        { status: 200 }
      );
    }
    user = { id: body.id, email: body.email ?? null };
  } catch {
    return NextResponse.json<VerifyResponse>(
      {
        authenticated: false,
        entitled: false,
        reason: 'Could not reach Supabase to validate session.',
        subscription: null
      },
      { status: 502 }
    );
  }

  // 2. Look up the user's subscription row via PostgREST. RLS limits the
  // result to the caller's own row, so the response cannot leak other
  // users' subscription data even if the token were mis-used.
  let subscription: NonNullable<VerifyResponse['subscription']> | null = null;
  try {
    const subResp = await fetch(
      `${url}/rest/v1/subscriptions?select=plan,status,current_period_end&limit=1`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`
        },
        cache: 'no-store'
      }
    );
    if (subResp.ok) {
      const rows = (await subResp.json()) as Array<{
        plan?: string | null;
        status?: string | null;
        current_period_end?: string | null;
      }>;
      const row = rows?.[0];
      subscription = {
        plan: row?.plan ?? null,
        status: row?.status ?? null,
        current_period_end: row?.current_period_end ?? null
      };
    }
    // If the table is missing or RLS rejects (404 / 403) we still return
    // authenticated=true — the extension can treat that as "signed in but
    // subscription unknown" and prompt the user to refresh.
  } catch {
    /* fall through with subscription=null */
  }

  const status = subscription?.status ?? null;
  const entitled = status !== null && ENTITLED_STATUSES.has(status);

  return NextResponse.json<VerifyResponse>(
    {
      authenticated: true,
      entitled,
      reason: entitled
        ? undefined
        : status === null
          ? 'No subscription on file.'
          : `Subscription is "${status}".`,
      user: { id: user.id, email: user.email ?? null },
      subscription
    },
    {
      status: 200,
      headers: {
        // Discourage any intermediate cache — entitlement is decision-grade.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        // The extension calls this cross-origin from a chrome-extension://
        // page, which counts as a null Origin in some browsers; the
        // wildcard below is safe because the request authenticates with a
        // Bearer token rather than cookies.
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
      }
    }
  );
}

export async function OPTIONS() {
  // Preflight response for the extension's cross-origin fetch.
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}