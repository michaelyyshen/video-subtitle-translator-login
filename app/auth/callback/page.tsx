'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exchangeCodeForSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/config';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const [message, setMessage] = useState<string>('Completing sign-in…');

  useEffect(() => {
    const code = params?.get('code');
    const errorParam = params?.get('error_description') || params?.get('error');
    if (!isSupabaseConfigured()) {
      setStatus('error');
      setMessage('Supabase is not configured. Add the public env vars to your Vercel project.');
      return;
    }
    if (errorParam) {
      setStatus('error');
      setMessage(errorParam);
      router.replace(`/login?error=${encodeURIComponent(errorParam)}`);
      return;
    }
    if (!code) {
      setStatus('error');
      setMessage('Missing authorization code. Please try signing in again.');
      router.replace('/login?error=missing_code');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { error } = await exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          const errMsg = error.message || 'Could not complete sign-in.';
          setStatus('error');
          setMessage(errMsg);
          router.replace(`/login?error=${encodeURIComponent(errMsg)}`);
          return;
        }
        router.replace('/');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Could not complete sign-in.';
        setStatus('error');
        setMessage(msg);
        router.replace(`/login?error=${encodeURIComponent(msg)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>{status === 'error' ? 'Sign-in failed' : 'Signing you in…'}</h1>
        <p className="auth-sub">{message}</p>
        {status === 'error' && (
          <p style={{ marginTop: 16 }}>
            <a href="/login" className="btn btn-secondary btn-block">
              Back to sign in
            </a>
          </p>
        )}
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <main className="auth-page">
        <div className="auth-card">
          <h1>Signing you in…</h1>
          <p className="auth-sub">Completing sign-in…</p>
        </div>
      </main>
    }>
      <CallbackInner />
    </Suspense>
  );
}