'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { siteConfig } from '@/lib/config';
import { formatPrice } from '@/lib/format';
import { callFunction, getSession, notifyExtensionCheckout } from '@/lib/auth';

const FEATURES = [
  'Unlimited subtitle translation',
  'All 12+ target languages',
  'Word book, playback overlay, export',
  'Cancel anytime'
];

export function Pricing() {
  const router = useRouter();
  const params = useSearchParams();
  const initialPlan = params?.get('plan') === 'yearly' ? 'yearly' : 'monthly';
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; kind: 'error' | 'info' } | null>(null);

  const plans = [
    { key: 'monthly' as const, ...siteConfig.pricing.monthly, period: 'month' },
    { key: 'yearly' as const, ...siteConfig.pricing.yearly, period: 'year' }
  ];

  async function onSubscribe(plan: 'monthly' | 'yearly') {
    setBusy(plan);
    setMessage(null);
    try {
      const session = await getSession();
      if (!session) {
        router.push(`/signup?next=${encodeURIComponent(`/pricing?plan=${plan}`)}`);
        return;
      }
      const { url } = await callFunction<{ url: string }>('create-checkout-session', { plan });
      notifyExtensionCheckout();
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start checkout.';
      setMessage({ text: msg, kind: 'error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="pricing-page">
      <div className="container-x">
        <p className="eyebrow">Pricing</p>
        <h1 className="section-title">Pick a plan that fits your study schedule</h1>
        <p className="section-subtitle">
          Every paid plan unlocks the full extension. Donations are welcome but separate.
        </p>

        <div className="plan-list">
          {plans.map((plan) => {
            const isFeatured = plan.key === 'yearly';
            return (
              <div key={plan.key} className={`plan-card ${isFeatured ? 'is-featured' : ''}`}>
                {isFeatured && <span className="plan-badge">Save 17%</span>}
                <h3>{plan.label}</h3>
                <div className="plan-price">
                  {formatPrice(plan.amount, plan.currency)}
                  <span className="plan-period">/{plan.period}</span>
                </div>
                <ul className="plan-features">
                  {FEATURES.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => onSubscribe(plan.key)}
                  disabled={busy === plan.key || busy !== null}
                  data-default={plan.key === initialPlan ? 'true' : undefined}
                >
                  {busy === plan.key ? 'Loading...' : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>

        {message && (
          <p className={`form-message ${message.kind === 'error' ? 'is-error' : ''}`} style={{ marginTop: 24 }}>
            {message.text}
          </p>
        )}

        <p className="pricing-footnote">
          Subscriptions are billed in USD. Cancel or change plans anytime from your{' '}
          <a href="/account">account</a>.
        </p>
      </div>
    </main>
  );
}
