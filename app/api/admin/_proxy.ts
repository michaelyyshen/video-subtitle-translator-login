// Server-side proxy from the Vercel-deployed marketing site to the
// `admin-grant` Supabase Edge Function.
//
// Why a proxy instead of letting the browser call the function directly:
//   - The edge function is deployed with `--no-verify-jwt` so it accepts any
//     Authorization header. Forwarding from the server lets us centralize
//     the admin API call, keep the response shape consistent, and short-
//     circuit before a network round-trip if the user isn't authenticated.
//   - The marketing site never holds `SUPABASE_SERVICE_ROLE_KEY`. The admin
//     edge function does. The proxy only forwards the user's own Bearer
//     token; the edge function validates the `is_admin` claim against
//     `auth.users.app_metadata` before performing any mutation.
//
// All callers must already have a valid session whose `app_metadata.is_admin`
// is true; the edge function rejects everyone else with 403.

import { NextResponse, type NextRequest } from 'next/server';
import { siteConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EDGE_BASE = () => `${siteConfig.supabaseUrl.replace(/\/$/, '')}/functions/v1/admin-grant`;

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Content-Type': 'application/json'
};

function unauthorized(reason: string) {
  return NextResponse.json({ error: reason, code: 'unauthorized' }, { status: 401, headers: NO_CACHE });
}

function getBearer(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1].trim() : null;
}

export async function forwardToEdge(req: NextRequest, init: { method: 'GET' | 'POST'; path: string; body?: unknown }): Promise<NextResponse> {
  const token = getBearer(req);
  if (!token) return unauthorized('Missing Bearer token.');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    apikey: siteConfig.supabaseAnonKey,
    'Content-Type': 'application/json'
  };

  const upstream = await fetch(`${EDGE_BASE()}${init.path}`, {
    method: init.method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store'
  });
  const text = await upstream.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  return NextResponse.json(data, { status: upstream.status, headers: NO_CACHE });
}
