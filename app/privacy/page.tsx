import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What we collect, what we do not collect, and your data rights.'
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="container-x legal-container">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: July 26, 2026</p>

        <h2>What we collect</h2>
        <p>
          <strong>Account email and password.</strong> We use Supabase Auth to manage accounts. Your email is used for
          sign-in and to send receipts. We do not sell or share it.
        </p>
        <p>
          <strong>Subscription state.</strong> We store your Stripe customer ID, current plan, and renewal date so the
          extension can verify your entitlement. Card details never touch our servers — they live only with Stripe.
        </p>
        <p>
          <strong>Optional donation email.</strong> If you donate without signing in, we receive the email Stripe returns
          with the receipt. We don&rsquo;t use it for marketing.
        </p>

        <h2>What we do NOT collect</h2>
        <p>
          <strong>Browsing history, video URLs, or watch history.</strong> The extension reads subtitle text in real time;
          nothing about which videos you watch is logged, stored, or transmitted.
        </p>
        <p>
          <strong>The original subtitle text after translation.</strong> Each captured line is sent to our translation
          server for the one call needed to produce your translation. The text is processed in memory and discarded; we
          do not retain a copy.
        </p>
        <p>
          <strong>Analytics or tracking pixels.</strong> We do not embed third-party analytics on the extension or website.
        </p>

        <h2>How data moves during translation</h2>
        <ol>
          <li>The extension captures a subtitle line as you watch a video.</li>
          <li>It sends the line to our Supabase Edge Function over HTTPS, authenticated with your session token.</li>
          <li>
            The server checks your active subscription, calls the upstream translation provider (MiniMax M3), and returns
            the translation.
          </li>
          <li>The translated line is stored locally in your browser; the original is not retained by us.</li>
        </ol>
        <p>
          If you don&rsquo;t want any of this to happen, simply don&rsquo;t subscribe — without an active subscription the
          extension never sends translation requests.
        </p>

        <h2>Where your data lives</h2>
        <p>
          Captured subtitles, translations, and the word book are stored in your browser&rsquo;s local extension storage.
          Backups you export yourself are JSON files on your device.
        </p>

        <h2>Your rights</h2>
        <p>
          You can sign out, request deletion of your account, or request a copy of the data we have on you by emailing{' '}
          <a href="mailto:support@video-subtitle-translator.com">support@video-subtitle-translator.com</a>. We respond
          within 30 days.
        </p>

        <h2>Children</h2>
        <p>The extension is not directed at children under 13. Don&rsquo;t sign up if you&rsquo;re under 13.</p>

        <h2>Changes to this policy</h2>
        <p>
          If we change anything material, we&rsquo;ll post a notice on the website and bump the date above. Continued use
          after a change means you accept the new terms.
        </p>
      </div>
    </main>
  );
}
