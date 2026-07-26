import Link from 'next/link';
import { Faq } from '@/components/Faq';

const faqItems = [
  { q: 'How much does it cost?', a: 'Plans start at $4.99/month or $49.99/year. Cancel any time from your <a href="/account">account</a> page — billing is handled by Stripe.' },
  { q: 'Which platforms are supported?', a: 'YouTube and Netflix today, with more platforms planned.' },
  { q: 'Do I need an API key?', a: 'No. Translation is included in your subscription and runs on our servers — you don\'t need to bring your own key or worry about usage limits.' },
  { q: 'Is my data private?', a: 'Subtitle captures and your word book live locally in your browser. The only network call is sending each new subtitle to our server for translation — we don\'t store it. See our <a href="/privacy">Privacy Policy</a> for details.' },
  { q: 'Can I export my vocabulary?', a: 'Yes — export to CSV for Anki or spreadsheets, or a full JSON backup you can import on another device.' },
  { q: 'Are donations different from subscriptions?', a: 'Yes. Donations are one-time contributions that help cover infrastructure — they never unlock features. The <a href="/pricing">subscription</a> is what gives you access to the extension.' }
];

export default function HomePage() {
  return (
    <main>
      <section className="hero" id="top">
        <div className="container-x hero-inner">
          <div className="hero-text">
            <h1>
              Turn every video into
              <br />
              <span className="gradient-text">a language lesson</span>
            </h1>
            <p>
              Video Subtitle Translator captures subtitles on YouTube and Netflix, translates them in
              real time, and builds a personal vocabulary while you just watch.
            </p>
            <div className="hero-buttons">
              <a href="https://chrome.google.com/webstore" className="btn btn-primary btn-large">
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#fff" d="M24 4a20 20 0 1 0 0 40 20 20 0 0 0 0-40Z" opacity="0" />
                  <path
                    fill="#EA4335"
                    d="M24 6a18 18 0 0 1 15.6 9H24a9 9 0 0 0-7.8 4.5L8.4 10.7A18 18 0 0 1 24 6Z"
                  />
                  <path
                    fill="#4285F4"
                    d="M42 24a18 18 0 0 1-1 5.9H24a9 9 0 0 0 8.7-6.5H24v-7h17.3A18 18 0 0 1 42 24Z"
                  />
                  <path
                    fill="#34A853"
                    d="M8.4 37.3 16.2 27.5A9 9 0 0 0 24 33h8.7A18 18 0 0 1 24 42a18 18 0 0 1-15.6-4.7Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6 24a18 18 0 0 1 2.4-13.3l7.8 9.8A9 9 0 0 0 16.2 27.5L8.4 37.3A18 18 0 0 1 6 24Z"
                  />
                </svg>
                Add to Chrome — It&rsquo;s Free
              </a>
              <a href="#how-it-works" className="btn btn-secondary btn-large">
                See how it works
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <strong>12+</strong>
                <span>Languages</span>
              </div>
              <div className="hero-stat">
                <strong>2</strong>
                <span>Platforms</span>
              </div>
              <div className="hero-stat">
                <strong>$4.99</strong>
                <span>per month</span>
              </div>
            </div>
          </div>

          <div className="hero-image">
            <div className="glow-orb glow-1" />
            <div className="glow-orb glow-2" />
            <div className="panel-mockup">
              <div className="panel-head">
                <span className="panel-title">Side Panel</span>
                <div className="panel-tabs">
                  <span className="panel-tab is-active">Subtitles</span>
                  <span className="panel-tab">Word Book</span>
                </div>
              </div>
              <div className="panel-body">
                <div className="sub-row is-playing">
                  <div className="sub-time">02:14</div>
                  <div className="sub-main">
                    <div className="sub-original">
                      The weather is <mark>beautiful</mark> today.
                    </div>
                    <div className="sub-translation">
                      今天天气真<mark>好</mark>。
                    </div>
                  </div>
                  <span className="playing-badge">▶ now</span>
                </div>
                <div className="sub-row">
                  <div className="sub-time">02:18</div>
                  <div className="sub-main">
                    <div className="sub-original">I could get used to this.</div>
                    <div className="sub-translation">我可以习惯这样。</div>
                  </div>
                </div>
                <div className="sub-row is-selfmade">
                  <div className="sub-time">02:21</div>
                  <div className="sub-main">
                    <div className="sub-original">Let&rsquo;s stay a little longer.</div>
                    <div className="sub-translation">我们再待一会儿吧。</div>
                    <span className="mini-badge">✏️ Self-made</span>
                  </div>
                </div>
              </div>
              <div className="panel-foot">
                <span className="word-chip">weather</span>
                <span className="word-chip">beautiful</span>
                <span className="word-chip is-new">+ used to</span>
              </div>
            </div>
            <div className="video-overlay-demo">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 3v10l9-5-9-5Z" fill="white" />
              </svg>
              <span>今天天气真好。</span>
            </div>
          </div>
        </div>

        <div className="trust-bar">
          <div className="container-x trust-inner">
            <span className="trust-label">Works seamlessly with</span>
            <div className="trust-logos">
              <span className="trust-logo">▶ YouTube</span>
              <span className="trust-logo">N Netflix</span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features">
        <div className="container-x">
          <p className="eyebrow">Features</p>
          <h2 className="section-title">Everything you need to learn from video</h2>
          <p className="section-subtitle">Six focused tools that turn passive watching into active learning</p>

          <div className="bento">
            <div className="bento-card is-large">
              <div className="feature-icon icon-indigo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M17 9.5 21 7v10l-4-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Automatic subtitle capture</h3>
              <p>
                Play any video on YouTube or Netflix and subtitles are captured the moment they appear — no
                clicking, no setup, it just works in the background.
              </p>
            </div>
            <div className="bento-card">
              <div className="feature-icon icon-violet">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12h5l3-8 4 16 3-8h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>AI-powered translation</h3>
              <p>Context-aware translations that preserve tone and meaning, not just word-for-word swaps.</p>
            </div>
            <div className="bento-card">
              <div className="feature-icon icon-pink">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 17.5v-12Z" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M8 3v18" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </div>
              <h3>Personal word book</h3>
              <p>Click any word to save it. It&rsquo;s translated into every target language automatically, with the same Pro account.</p>
            </div>
            <div className="bento-card">
              <div className="feature-icon icon-amber">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3l1.9 5.8H20l-4.9 3.6L17 18l-5-3.6L7 18l1.9-5.6L4 8.8h6.1L12 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Preferred subtitles</h3>
              <p>Duplicate a subtitle, rewrite it, mark it preferred — your version overlays the video next time you watch.</p>
            </div>
            <div className="bento-card is-large">
              <div className="feature-icon icon-emerald">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Export, import, and sync everywhere</h3>
              <p>
                One JSON file backs up every subtitle, translation, and word. Move it between computers, or export CSV
                straight into Anki for spaced-repetition review.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how-it-works">
        <div className="container-x">
          <p className="eyebrow">Workflow</p>
          <h2 className="section-title">Up and running in under two minutes</h2>
          <div className="steps">
            {[
              { n: 1, t: 'Install the extension', p: 'Add it from the Chrome Web Store. No account, no sign-up.' },
              { n: 2, t: 'Pick your languages', p: 'Choose one or more target languages in the settings panel.' },
              { n: 3, t: 'Press play', p: 'Open a YouTube or Netflix video with captions on. Everything is captured and translated automatically.' },
              { n: 4, t: 'Build your vocabulary', p: 'Click words as you go, review your word book later, and export whenever you like.' }
            ].map((s) => (
              <div className="step" key={s.n}>
                <div className="step-num">{s.n}</div>
                <div>
                  <h3>{s.t}</h3>
                  <p>{s.p}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="languages">
        <div className="container-x">
          <p className="eyebrow">Language support</p>
          <h2 className="section-title">Translate into 12+ languages</h2>
          <div className="lang-grid">
            {[
              '🇨🇳 Chinese (Simplified)',
              '🇹🇼 Traditional Chinese',
              '🇭🇰 Cantonese',
              '🇯🇵 Japanese',
              '🇰🇷 Korean',
              '🇪🇸 Spanish',
              '🇫🇷 French',
              '🇩🇪 German',
              '🇷🇺 Russian',
              '🇵🇹 Portuguese',
              '🇮🇹 Italian',
              '🇸🇦 Arabic'
            ].map((l) => (
              <div className="lang-item" key={l}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container-x cta-inner">
          <h2>Start learning today</h2>
          <p>Create a free account, then pick a plan. Cancel any time.</p>
          <div className="cta-buttons">
            <Link href="/pricing" className="btn btn-primary btn-large">
              See pricing
            </Link>
            <a href="https://chrome.google.com/webstore" className="btn btn-secondary btn-large">
              Add to Chrome
            </a>
          </div>
          <p className="cta-note">✓ 7-day money back &nbsp; ✓ Cancel anytime &nbsp; ✓ Powered by Stripe</p>
        </div>
      </section>

      <section id="faq" className="faq">
        <div className="container-x">
          <p className="eyebrow">FAQ</p>
          <h2 className="section-title">Frequently asked questions</h2>
          <Faq items={faqItems} />
        </div>
      </section>
    </main>
  );
}
