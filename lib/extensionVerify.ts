// Client-side wrapper around the /api/extension/verify endpoint. Same shape
// the Chrome extension calls into, exposed as a typed helper so the
// marketing site's /account page can render the same entitlement verdict
// the extension would see.

import { getAccessToken } from './auth';

export interface VerifyEnvelope {
  authenticated: boolean;
  entitled: boolean;
  reason?: string;
  user?: { id: string; email: string | null };
  subscription?: {
    plan: string | null;
    status: string | null;
    current_period_end: string | null;
  };
}

export async function verifyEntitlement(origin?: string): Promise<VerifyEnvelope> {
  const token = await getAccessToken();
  if (!token) {
    return { authenticated: false, entitled: false, reason: 'Not signed in.' };
  }
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  let resp: Response;
  try {
    resp = await fetch(`${base}/api/extension/verify`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
  } catch (err) {
    return {
      authenticated: false,
      entitled: false,
      reason: err instanceof Error ? err.message : 'Network error contacting verify endpoint.'
    };
  }
  let body: VerifyEnvelope;
  try {
    body = (await resp.json()) as VerifyEnvelope;
  } catch {
    return {
      authenticated: false,
      entitled: false,
      reason: `Verify endpoint returned HTTP ${resp.status} with a non-JSON body.`
    };
  }
  if (!resp.ok && body?.authenticated === undefined) {
    return {
      authenticated: false,
      entitled: false,
      reason: body?.reason || `Verify endpoint returned HTTP ${resp.status}.`
    };
  }
  return body;
}