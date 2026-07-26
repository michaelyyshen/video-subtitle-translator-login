// Minimal Supabase Auth client for the marketing website. Same shape as the
// extension's supabaseAuth.js (signInWithPassword, signUp, signOut,
// getSession, getUser, onAuthStateChange) but persists the session in
// localStorage so the user stays signed in across browser tabs and reloads.

const STORAGE_KEY = 'vst.sb_session';

export interface SupabaseUser {
  id: string;
  email?: string;
  [key: string]: unknown;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_in: number;
  expires_at: number; // ms epoch
  user: SupabaseUser | null;
}

export interface SupabaseAuthClient {
  signInWithPassword(args: { email: string; password: string }): Promise<{ data: { session: SupabaseSession | null; user: SupabaseUser | null }; error: Error | null }>;
  signUp(args: { email: string; password: string }): Promise<{ data: { session: SupabaseSession | null; user: SupabaseUser | null }; error: Error | null }>;
  signOut(): Promise<void>;
  getSession(): Promise<SupabaseSession | null>;
  getUser(): Promise<SupabaseUser | null>;
  onAuthStateChange(cb: (event: string, session: SupabaseSession | null) => void): { data: { subscription: { unsubscribe: () => void } } };
}

interface CreateOptions {
  url: string;
  anonKey: string;
  storage?: Storage;
}

export function createSupabaseAuth({ url, anonKey, storage }: CreateOptions): SupabaseAuthClient {
  const backing: Storage | undefined = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!backing) {
    throw new Error('Supabase auth requires a browser environment (no localStorage available).');
  }
  const store: Storage = backing;

  const listeners = new Set<(event: string, session: SupabaseSession | null) => void>();

  function readSession(): SupabaseSession | null {
    try {
      const raw = store.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SupabaseSession) : null;
    } catch {
      return null;
    }
  }

  function writeSession(session: SupabaseSession | null) {
    if (!session) {
      store.removeItem(STORAGE_KEY);
    } else {
      store.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }

  function notify(event: string, session: SupabaseSession | null) {
    for (const cb of listeners) {
      try {
        cb(event, session);
      } catch (err) {
        console.error('auth listener threw', err);
      }
    }
  }

  async function request<T = unknown>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
    const resp = await fetch(`${url}/auth/v1${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await resp.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!resp.ok) {
      const obj = (data && typeof data === 'object' ? (data as Record<string, unknown>) : {}) as {
        error_description?: string;
        msg?: string;
        message?: string;
        error_code?: string;
      };
      const message = obj.error_description || obj.msg || obj.message || `Auth error ${resp.status}`;
      const error = new Error(message) as Error & { status: number; code: string };
      error.status = resp.status;
      error.code = obj.error_code || `http_${resp.status}`;
      throw error;
    }
    return data as T;
  }

  function buildSession(authResponse: Partial<SupabaseSession> & { access_token?: string; user?: SupabaseUser }): SupabaseSession | null {
    if (!authResponse?.access_token) return null;
    return {
      access_token: authResponse.access_token,
      refresh_token: authResponse.refresh_token ?? null,
      token_type: authResponse.token_type ?? 'bearer',
      expires_in: authResponse.expires_in ?? 3600,
      expires_at: Date.now() + (authResponse.expires_in ?? 3600) * 1000,
      user: authResponse.user ?? null
    };
  }

  async function refreshSession(): Promise<SupabaseSession | null> {
    const session = readSession();
    if (!session?.refresh_token) return null;
    try {
      const data = await request<{ access_token: string; refresh_token?: string; expires_in?: number; token_type?: string; user?: SupabaseUser }>(
        '/token?grant_type=refresh_token',
        { refresh_token: session.refresh_token },
        { Authorization: `Bearer ${session.access_token}` }
      );
      const next = buildSession(data);
      writeSession(next);
      return next;
    } catch {
      writeSession(null);
      return null;
    }
  }

  async function getSession(): Promise<SupabaseSession | null> {
    const session = readSession();
    if (!session) return null;
    if (session.expires_at && session.expires_at - Date.now() < 30_000) {
      const refreshed = await refreshSession();
      return refreshed || session;
    }
    return session;
  }

  async function getUser(): Promise<SupabaseUser | null> {
    const session = await getSession();
    if (!session) return null;
    if (!session.user) {
      try {
        const data = await request<SupabaseUser>('/user', null, { Authorization: `Bearer ${session.access_token}` });
        session.user = data;
        writeSession(session);
      } catch {
        return null;
      }
    }
    return session.user;
  }

  async function signInWithPassword({ email, password }: { email: string; password: string }) {
    const data = await request<{ access_token: string; refresh_token?: string; expires_in?: number; token_type?: string; user?: SupabaseUser }>(
      '/token?grant_type=password',
      { email, password }
    );
    const session = buildSession(data);
    writeSession(session);
    notify('SIGNED_IN', session);
    return { data: { session, user: session?.user ?? null }, error: null };
  }

  async function signUp({ email, password }: { email: string; password: string }) {
    const data = await request<{ access_token?: string; refresh_token?: string; expires_in?: number; token_type?: string; user?: SupabaseUser }>(
      '/signup',
      { email, password }
    );
    const session = buildSession(data);
    if (session) {
      writeSession(session);
      notify('SIGNED_IN', session);
    }
    return { data: { session, user: session?.user ?? null }, error: null };
  }

  async function signOut() {
    const session = readSession();
    if (session?.access_token) {
      try {
        await fetch(`${url}/auth/v1/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${session.access_token}` }
        });
      } catch {
        /* best-effort */
      }
    }
    writeSession(null);
    notify('SIGNED_OUT', null);
  }

  function onAuthStateChange(cb: (event: string, session: SupabaseSession | null) => void) {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  }

  return { signInWithPassword, signUp, signOut, getSession, getUser, onAuthStateChange };
}
