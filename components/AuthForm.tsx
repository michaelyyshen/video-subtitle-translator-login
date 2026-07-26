'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn, signUp, getSession, callFunction } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/config';

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
  const [message, setMessage] = useState<{ text: string; kind: 'info' | 'error' | 'success' } | null>(null);

  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    if (!supabaseReady) return;
    let active = true;
    (async () => {
      const session = await getSession();
      if (!active || !session) return;
      try {
        await callFunction('create-portal-session');
        router.replace('/account');
      } catch {
        router.replace('/pricing');
      }
    })();
    return () => {
      active = false;
    };
  }, [router, supabaseReady]);

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
