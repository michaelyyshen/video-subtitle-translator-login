'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { callFunction, getSession, loadAccount, signOut, type AccountInfo } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/config';

export function Account() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'error' | 'info' } | null>(null);

  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    if (!supabaseReady) {
      setAccount(null);
      return;
    }
    let active = true;
    (async () => {
      const session = await getSession();
      if (!active) return;
      if (!session) {
        setAccount(null);
        return;
      }
      const info = await loadAccount();
      if (active) setAccount(info);
    })();
    return () => {
      active = false;
    };
  }, [supabaseReady]);

  if (account === undefined) {
    return (
      <main className="account-page">
        <div className="container-x account-container">
          <div className="account-card">
            <p className="auth-sub">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!account) {
    return (
      <main className="account-page">
        <div className="container-x account-container">
          <div className="account-card">
            <h1>Sign in to manage your account</h1>
            <p>You&rsquo;re a few seconds away from translating unlimited videos.</p>
            {!supabaseReady && (
              <p className="form-message is-info" style={{ marginTop: 12 }}>
                Supabase is not configured yet. Add the public env vars to your Vercel project.
              </p>
            )}
            <div className="account-actions">
              <Link href="/login" className="btn btn-primary">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-secondary">
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const sub = account.subscription;
  const isActive = sub?.status === 'active' || sub?.status === 'trialing';
  const planName = sub?.plan ? sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1) : '—';
  const renew = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—';

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
      router.replace('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to sign out.';
      setMessage({ text: msg, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function onManageBilling() {
    setMessage({ text: 'Opening billing portal...', kind: 'info' });
    try {
      const { url } = await callFunction<{ url: string }>('create-portal-session');
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open billing portal.';
      setMessage({ text: msg, kind: 'error' });
    }
  }

  return (
    <main className="account-page">
      <div className="container-x account-container">
        <div className="account-card">
          <h1>Your account</h1>
          {message && (
            <p className={`account-message ${message.kind === 'error' ? 'is-error' : ''}`}>{message.text}</p>
          )}

          <dl className="account-fields">
            <div>
              <dt>Email</dt>
              <dd>{account.email || '—'}</dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>{planName}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{sub?.status || 'inactive'}</dd>
            </div>
            <div>
              <dt>Renews on</dt>
              <dd>{renew}</dd>
            </div>
          </dl>

          <div className="account-actions">
            {isActive ? (
              <button type="button" className="btn btn-primary" onClick={onManageBilling} disabled={busy}>
                Manage billing
              </button>
            ) : (
              <Link href="/pricing" className="btn btn-primary">
                Upgrade
              </Link>
            )}
            <button type="button" className="btn btn-secondary" onClick={onSignOut} disabled={busy}>
              Sign out
            </button>
          </div>

          <p className="account-footnote">
            Manage billing opens Stripe&rsquo;s Customer Portal — you can cancel, change plan, or update your card there.
          </p>
        </div>
      </div>
    </main>
  );
}
