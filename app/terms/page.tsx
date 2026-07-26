import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms governing your use of Video Subtitle Translator.'
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="container-x legal-container">
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: July 26, 2026</p>

        <h2>1. The service</h2>
        <p>
          Video Subtitle Translator is a Chrome extension that captures video subtitles and translates them. We offer a
          paid subscription that unlocks the translation feature, plus optional voluntary donations.
        </p>

        <h2>2. Accounts</h2>
        <p>
          You need an account to subscribe. Provide a real email and keep your password safe. You&rsquo;re responsible
          for activity on your account.
        </p>

        <h2>3. Subscriptions and billing</h2>
        <p>
          Subscriptions are billed in advance on a monthly or yearly basis. Payments are processed by Stripe; we never
          see your card details. You can cancel any time from your account page — your plan stays active until the end
          of the current billing period.
        </p>
        <p>
          Refunds are handled on a case-by-case basis; email{' '}
          <a href="mailto:support@video-subtitle-translator.com">support@video-subtitle-translator.com</a> within 7 days
          of a charge to request one.
        </p>
        <p>Donations are one-time, non-refundable, and do not grant any entitlement.</p>

        <h2>4. Acceptable use</h2>
        <p>
          Don&rsquo;t use the extension to violate the terms of YouTube, Netflix, or any other platform. Don&rsquo;t
          reverse-engineer the service or abuse the translation API. We may suspend or terminate accounts that do.
        </p>

        <h2>5. The extension is provided as-is</h2>
        <p>
          Translations are machine-generated and may be inaccurate. We&rsquo;re not liable for learning outcomes, exam
          results, or decisions made on the basis of a translation.
        </p>

        <h2>6. Changes to the service or terms</h2>
        <p>
          We may update the extension, the website, or these terms. If a change is material we&rsquo;ll notify active
          subscribers by email. Continued use after a change means you accept it.
        </p>

        <h2>7. Contact</h2>
        <p>
          Questions or complaints:{' '}
          <a href="mailto:support@video-subtitle-translator.com">support@video-subtitle-translator.com</a>.
        </p>
      </div>
    </main>
  );
}
