'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSession, signIn, signInWithOAuth, signUp } from '@/lib/auth';
import { isSupabaseConfigured, siteConfig } from '@/lib/config';

type Mode = 'login' | 'signup';

interface Props {
  mode: Mode;
}

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get('next') || (mode === 'login' ? '/account' : '/pricing');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'info' | 'error' | 'success' } | null>(null);

  const supabaseReady = isSupabaseConfigured();
  const googleEnabled = supabaseReady && siteConfig.oauthProviders.includes('google');
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const callbackUrl = `${siteOrigin}/auth/callback`;

  useEffect(() => {
    if (!supabaseReady) return;
    let active = true;
    (async () => {
      const session = await getSession();
      if (!active || !session) return;
      // Already signed in — bounce to /account. Don't pre-fetch anything; the
      // account page handles its own data loading and tolerates failures.
      router.replace('/account');
    })();
    return () => {
      active = false;
    };
  }, [router, supabaseReady]);

  async function onGoogle() {
    if (!supabaseReady) {
      setMessage({ text: 'Supabase is not configured. Set the public env vars in your Vercel project.', kind: 'error' });
      return;
    }
    setGoogleBusy(true);
    setMessage(null);
    try {
      const { data, error } = await signInWithOAuth('google', { redirectTo: callbackUrl });
      if (error) {
        setMessage({ text: error.message || 'Could not start Google sign-in.', kind: 'error' });
        return;
      }
      if (!data.url) {
        setMessage({ text: 'Could not start Google sign-in. Please try again.', kind: 'error' });
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessage({ text: msg, kind: 'error' });
    } finally {
      setGoogleBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseReady) {
      setMessage({ text: 'Supabase is not configured. Set the public env vars in your Vercel project.', kind: 'error' });
      return;
    }
    setBusy(true);
    setMessage({ text: 'Working...', kind: 'info' });
    try {
      if (mode === 'login') {
        const result = await signIn(email, password);
        if (result.error) {
          setMessage({ text: result.error.message, kind: 'error' });
          return;
        }
        setMessage({ text: 'Signed in! Redirecting...', kind: 'success' });
        setTimeout(() => router.replace(next), 400);
      } else {
        const result = await signUp(email, password);
        if (result.error) {
          setMessage({ text: result.error.message, kind: 'error' });
          return;
        }
        if (!result.data?.session) {
          setMessage({ text: 'Check your inbox to confirm your email, then sign in.', kind: 'success' });
          setTimeout(() => router.replace('/login'), 1500);
          return;
        }
        setMessage({ text: 'Account created! Redirecting...', kind: 'success' });
        setTimeout(() => router.replace(next), 400);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessage({ text: msg, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'login' ? 'Welcome back' : 'Create your account';
  const sub =
    mode === 'login'
      ? 'Sign in to keep translating subtitles.'
      : 'A free account gets you started. Pick a plan after sign-up.';
  const submitLabel = mode === 'login' ? 'Sign in' : 'Create account';
  const switchHref = mode === 'login' ? '/signup' : '/login';
  const switchText = mode === 'login' ? 'New here?' : 'Already have an account?';
  const switchLink = mode === 'login' ? 'Create an account' : 'Sign in';
  const formId = mode === 'login' ? 'login-form' : 'signup-form';

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>{title}</h1>
        <p className="auth-sub">{sub}</p>

        {!supabaseReady && (
          <p className="form-message is-info" style={{ marginTop: 0, marginBottom: 16 }}>
            Supabase is not configured yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your Vercel project to enable sign-in.
          </p>
        )}

        {googleEnabled && (
          <>
            <button
              type="button"
              className="btn btn-oauth btn-block"
              onClick={onGoogle}
              disabled={googleBusy || busy}
              aria-label="Continue with Google"
            >
              <svg
                className="oauth-icon"
                width="18"
                height="18"
                viewBox="0 0 48 48"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="#4285F4"
                  d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
                />
                <path
                  fill="#34A853"
                  d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
                />
                <path
                  fill="#FBBC05"
                  d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
                />
                <path
                  fill="#EA4335"
                  d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
                />
              </svg>
              <span>{googleBusy ? 'Opening Google…' : 'Continue with Google'}</span>
            </button>
            <div className="auth-divider" role="separator" aria-label="or continue with email">
              <span>or</span>
            </div>
          </>
        )}

        <form id={formId} onSubmit={onSubmit} autoComplete="on">
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!supabaseReady || busy}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!supabaseReady || busy}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={!supabaseReady || busy}>
            {busy ? 'Working...' : submitLabel}
          </button>
        </form>

        {message && (
          <p
            className={`form-message ${message.kind === 'error' ? 'is-error' : message.kind === 'success' ? 'is-success' : ''}`}
            style={{ marginTop: 16 }}
          >
            {message.text}
          </p>
        )}

        <p className="auth-switch">
          {switchText} <Link href={switchHref}>{switchLink}</Link>.
        </p>
      </div>
    </main>
  );
}
