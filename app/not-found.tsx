import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="legal-page">
      <div className="container-x legal-container" style={{ textAlign: 'center' }}>
        <h1>404 — Page not found</h1>
        <p className="auth-sub">The page you&rsquo;re looking for doesn&rsquo;t exist.</p>
        <p style={{ marginTop: 24 }}>
          <Link href="/" className="btn btn-primary btn-sm">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
