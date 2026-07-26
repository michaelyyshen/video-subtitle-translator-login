import Link from 'next/link';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container-x">
        <div className="footer-grid">
          <div className="footer-section">
            <Link href="/" className="logo">
              <span className="logo-mark">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 6.5C4 5.67 4.67 5 5.5 5h13c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H13l-3.5 3v-3h-4c-.83 0-1.5-.67-1.5-1.5v-9Z"
                    fill="white"
                  />
                </svg>
              </span>
              <span>Video Subtitle Translator</span>
            </Link>
            <p style={{ marginTop: 14 }}>
              Learn languages naturally while watching your favorite content.
            </p>
          </div>
          <div className="footer-section">
            <h4>Product</h4>
            <Link href="/#features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/donate">Donate</Link>
          </div>
          <div className="footer-section">
            <h4>Resources</h4>
            <a href="https://github.com/michaelyyshen/video-subtitle-translator" target="_blank" rel="noopener">
              GitHub
            </a>
            <a
              href="https://github.com/michaelyyshen/video-subtitle-translator/blob/main/README.md"
              target="_blank"
              rel="noopener"
            >
              Documentation
            </a>
            <a
              href="https://github.com/michaelyyshen/video-subtitle-translator/issues"
              target="_blank"
              rel="noopener"
            >
              Support
            </a>
          </div>
          <div className="footer-section">
            <h4>Legal</h4>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Video Subtitle Translator. MIT License.</p>
          <p>Made for language learners</p>
        </div>
      </div>
    </footer>
  );
}
