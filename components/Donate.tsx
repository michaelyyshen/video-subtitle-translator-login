'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { callFunction, getSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/config';

const PRESETS = [
  { cents: 300, label: '$3' },
  { cents: 500, label: '$5' },
  { cents: 1000, label: '$10' }
];

export function Donate() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'error' | 'info' } | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ text: string; kind: 'info' | 'success' } | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    const status = params?.get('status');
    if (!status) return;
    if (status === 'success') {
      setStatusBanner({ text: 'Thank you for your support!', kind: 'success' });
    } else {
      setStatusBanner({ text: 'Donation was canceled. No charge was made.', kind: 'info' });
    }
  }, [params]);

  async function startDonation(amountCents: number) {
    if (!supabaseReady) {
      setMessage({ text: 'Donations are not configured yet. Set the public env vars in Vercel.', kind: 'error' });
      return;
    }
    setBusy(true);
    setMessage({ text: 'Opening checkout...', kind: 'info' });
    try {
      // Touch getSession so the user can donate signed-out too (per the
      // existing donate.html flow); the Edge Function handles both.
      await getSession();
      const { url } = await callFunction<{ url: string }>('create-donation-session', { amount: amountCents });
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start checkout.';
      setMessage({ text: msg, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  function onCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseInt(customAmount, 10);
    if (!Number.isFinite(value) || value < 1) {
      setMessage({ text: 'Enter a positive dollar amount.', kind: 'error' });
      return;
    }
    // Snap to nearest preset on the server side.
    if (value <= 4) startDonation(300);
    else if (value <= 7) startDonation(500);
    else startDonation(1000);
  }

  return (
    <main className="donate-page">
      <div className="container-x donate-container">
        <h1>Support the project</h1>
        <p className="donate-subtitle">
          Donations help cover translation API costs and ongoing development. They never unlock features — that&rsquo;s what{' '}
          <a href="/pricing">subscriptions</a> are for.
        </p>

        {statusBanner && (
          <p className={`donation-status ${statusBanner.kind === 'success' ? 'is-success' : 'is-info'}`}>
            {statusBanner.text}
          </p>
        )}

        <div className="donate-presets">
          {PRESETS.map((p, i) => (
            <button
              key={p.cents}
              className={`preset-button ${i === 1 ? 'is-featured' : ''}`}
              onClick={() => startDonation(p.cents)}
              disabled={busy}
            >
              {p.label}
            </button>
          ))}
        </div>

        <form className="donate-custom" onSubmit={onCustomSubmit}>
          <label>
            <span>Or enter a custom amount (USD)</span>
            <div className="custom-input">
              <span className="prefix">$</span>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="5"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                disabled={busy}
              />
            </div>
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Opening...' : 'Donate'}
          </button>
        </form>

        {message && (
          <p className={`form-message ${message.kind === 'error' ? 'is-error' : ''}`} style={{ marginTop: 16 }}>
            {message.text}
          </p>
        )}

        <p className="donate-footnote">Payments are processed securely by Stripe. No account is required.</p>
      </div>
    </main>
  );
}
