'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getSession, onAuthStateChange, signOut } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/config';
import type { SupabaseSession } from '@/lib/supabaseAuth';

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

function initialsFor(email: string | null | undefined): string {
  if (!email) return '?';
  const handle = email.split('@')[0] || email;
  // Take up to two alphanumeric chars, uppercase, falling back to first char.
  const letters = handle.replace(/[^a-z0-9]/gi, '');
  if (!letters) return handle.slice(0, 1).toUpperCase();
  if (letters.length === 1) return letters.toUpperCase();
  return (letters[0] + letters[1]).toUpperCase();
}

function UserMenu({ email, isAdmin, onSignOut }: { email: string; isAdmin: boolean; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="nav-user">
      <button
        ref={buttonRef}
        type="button"
        className="nav-user-chip"
        aria-label={`Account menu for ${email}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nav-user-avatar" aria-hidden="true">
          {initialsFor(email)}
        </span>
        <span className="nav-user-email">{email}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div ref={menuRef} className="nav-user-menu" role="menu" aria-label="Account">
          <Link href="/account" className="nav-user-link" role="menuitem" onClick={() => setOpen(false)}>
            Account
          </Link>
          {isAdmin && (
            <Link href="/admin" className="nav-user-link" role="menuitem" onClick={() => setOpen(false)}>
              Admin
            </Link>
          )}
          <button
            type="button"
            className="nav-user-link is-button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [scrolled, setScrolled] = useState(false);

  // `loading` means we don't yet know whether the user is signed in — used to
  // suppress flicker on first paint. `null` means signed out; a session means
  // signed in.
  const [session, setSession] = useState<SupabaseSession | null | undefined>(undefined);
  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Initial session read + subscribe to auth state changes for in-tab updates.
  useEffect(() => {
    if (!supabaseReady) {
      setSession(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const initial = await getSession();
      if (!cancelled) setSession(initial);
    })();
    const sub = onAuthStateChange((_event, next) => {
      // Subscribe to all relevant Supabase auth events so the navbar updates
      // when the user signs in / out, when their token is refreshed, or when
      // their user record is updated.
      setSession(next);
    });
    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, [supabaseReady]);

  // Cross-tab updates: localStorage changes from another tab (e.g. user signs
  // in from another tab) won't fire our in-process listener, but the browser
  // dispatches a `storage` event — re-read the session when that happens.
  useEffect(() => {
    if (!supabaseReady) return;
    function onStorage(e: StorageEvent) {
      if (e.key !== 'vst.sb_session') return;
      void getSession().then(setSession);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [supabaseReady]);

  async function handleSignOut() {
    try {
      await signOut();
      // onAuthStateChange will set session -> null and re-render the buttons.
      // We don't hard-redirect; staying on the current page matches the rest
      // of the site, which only redirects from /account.
    } catch {
      // Even if the server sign-out call fails, the localStorage write and the
      // SIGNED_OUT event already happened in signOut() itself.
    }
  }

  const email = session?.user?.email ?? null;
  const isSignedIn = Boolean(session?.access_token);
  const isAdmin =
    (session?.user as { app_metadata?: { is_admin?: boolean } } | null)?.app_metadata?.is_admin === true;

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
              {isSignedIn && email ? (
                <UserMenu email={email} isAdmin={isAdmin} onSignOut={handleSignOut} />
              ) : (
                <>
                  <Link href="/login" className="btn btn-secondary btn-sm">
                    Sign in
                  </Link>
                  <a href="https://chrome.google.com/webstore" className="btn btn-primary btn-sm">
                    Add to Chrome
                  </a>
                </>
              )}
            </>
          ) : (
            <>
              <Link href="/#features">Features</Link>
              <Link href="/pricing">Pricing</Link>
              {isSignedIn && email ? (
                <UserMenu email={email} isAdmin={isAdmin} onSignOut={handleSignOut} />
              ) : (
                <>
                  <Link href="/login" className="btn btn-secondary btn-sm">
                    Sign in
                  </Link>
                  <Link href="/signup" className="btn btn-primary btn-sm">
                    Get started
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
