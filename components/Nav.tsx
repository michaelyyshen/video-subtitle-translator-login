'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const Logo = () => (
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
);

export function Nav() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="container-x nav-inner">
        <Logo />
        <div className="nav-links">
          {isHome ? (
            <>
              <a href="#features">Features</a>
              <a href="#faq">FAQ</a>
              <Link href="/pricing">Pricing</Link>
              <Link href="/login" className="btn btn-secondary btn-sm">
                Sign in
              </Link>
              <a href="https://chrome.google.com/webstore" className="btn btn-primary btn-sm">
                Add to Chrome
              </a>
            </>
          ) : (
            <>
              <Link href="/#features">Features</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/login" className="btn btn-secondary btn-sm">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
