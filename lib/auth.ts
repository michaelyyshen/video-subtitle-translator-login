'use client';

import { createSupabaseAuth, type SupabaseAuthClient, type SupabaseSession } from './supabaseAuth';
import { siteConfig } from './config';

let cached: SupabaseAuthClient | null = null;

function getClient(): SupabaseAuthClient {
  if (cached) return cached;
  if (!siteConfig.supabaseUrl || !siteConfig.supabaseAnonKey) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel project settings.');
  }
  cached = createSupabaseAuth({ url: siteConfig.supabaseUrl, anonKey: siteConfig.supabaseAnonKey });
  return cached;
}

export async function getSession(): Promise<SupabaseSession | null> {
  try {
    return await getClient().getSession();
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

export async function signIn(email: string, password: string) {
  return getClient().signInWithPassword({ email, password });
}

export async function signUp(email: string, password: string) {
  return getClient().signUp({ email, password });
}

export async function signOut() {
  return getClient().signOut();
}

export function onAuthStateChange(cb: (event: string, session: SupabaseSession | null) => void) {
  return getClient().onAuthStateChange(cb);
}

export async function signInWithOAuth(provider: string, options?: { redirectTo?: string; scopes?: string }) {
  return getClient().signInWithOAuth({ provider, options });
}

export async function exchangeCodeForSession(code: string) {
  return getClient().exchangeCodeForSession(code);
}

export async function callFunction<T = Record<string, unknown>>(name: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const resp = await fetch(`${siteConfig.supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: siteConfig.supabaseAnonKey,
      Authorization: `Bearer ${token || ''}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await resp.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!resp.ok) {
    const obj = (data && typeof data === 'object' ? (data as Record<string, unknown>) : {}) as { error?: string; code?: string };
    const error = new Error(obj.error || `Request failed (${resp.status})`) as Error & { status: number; code?: string };
    error.status = resp.status;
    error.code = obj.code;
    throw error;
  }
  return data as T;
}

export interface SubscriptionRow {
  status: string;
  plan: string;
  current_period_end: string;
  current_period_start?: string;
  price_id?: string;
}

export interface AccountInfo {
  user: SupabaseSession['user'];
  email: string | null;
  subscription: SubscriptionRow | null;
}

export async function loadAccount(): Promise<AccountInfo | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    const resp = await fetch(
      `${siteConfig.supabaseUrl}/rest/v1/subscriptions?select=status,plan,current_period_end,price_id,current_period_start&limit=1`,
      {
        headers: {
          apikey: siteConfig.supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );
    if (!resp.ok) {
      // eslint-disable-next-line no-console
      console.error('[auth] loadAccount: subscriptions fetch failed', {
        status: resp.status,
        body: await resp.text().catch(() => '')
      });
      return null;
    }
    const rows = (await resp.json()) as SubscriptionRow[];
    return {
      user: session.user,
      email: session.user?.email ?? null,
      subscription: rows?.[0] ?? null
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth] loadAccount: unexpected error', err);
    return null;
  }
}

// After a successful Stripe checkout, ping the extension so its entitlement
// cache refreshes. Best-effort — the extension may not be installed yet.
export function notifyExtensionCheckout() {
  if (typeof window === 'undefined') return;
  if (!siteConfig.extensionId) return;
  try {
    const runtime = (window as unknown as { chrome?: { runtime?: { sendMessage?: (id: string, msg: unknown) => void } } }).chrome?.runtime;
    if (runtime?.sendMessage) {
      runtime.sendMessage(siteConfig.extensionId, { type: 'CHECKOUT_COMPLETE' });
    }
  } catch {
    /* extension not present */
  }
}
