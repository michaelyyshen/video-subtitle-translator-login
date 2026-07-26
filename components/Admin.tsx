'use client';

// Back-office console for the marketing site. Lists Supabase users with
// their subscription state, lets an admin grant / extend / revoke
// subscriptions, and surfaces a 50-row audit log per user.
//
// Auth: the Nav only shows the link to this page when the JWT session's
// `app_metadata.is_admin` is true. The edge function re-verifies the same
// claim server-side, so a stale or hand-crafted localStorage session cannot
// grant real access.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, getSession, onAuthStateChange } from '@/lib/auth';
import type { SupabaseSession } from '@/lib/supabaseAuth';
import { isSupabaseConfigured } from '@/lib/config';

// ---------- Types ----------

interface AdminUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  subscription: SubscriptionRow | null;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  status: string;
  plan: string;
  price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_kind: 'admin_user' | 'break_glass';
  action: 'grant' | 'extend' | 'revoke' | 'promote' | 'demote';
  metadata: Record<string, unknown>;
  created_at: string;
}

interface UserDetail {
  user: AdminUser;
  subscription: SubscriptionRow | null;
  audit: AuditEntry[];
}

// ---------- API helpers ----------

async function adminFetch<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not signed in.');
  const resp = await fetch(`/api/admin${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store'
  });
  const text = await resp.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!resp.ok) {
    const obj = (data && typeof data === 'object' ? (data as Record<string, unknown>) : {}) as { error?: string; code?: string };
    const err = new Error(obj.error || `Request failed (${resp.status})`) as Error & { status: number; code?: string };
    err.status = resp.status;
    err.code = obj.code;
    throw err;
  }
  return data as T;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function readAppMetadata(session: SupabaseSession | null | undefined): { is_admin: boolean } {
  const u = session?.user as { app_metadata?: { is_admin?: boolean } } | null | undefined;
  return { is_admin: u?.app_metadata?.is_admin === true };
}

// ---------- Main component ----------

export function Admin() {
  const router = useRouter();
  const supabaseReady = isSupabaseConfigured();
  const [session, setSession] = useState<SupabaseSession | null | undefined>(undefined);

  // Sign-in / permission gate
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
    const sub = onAuthStateChange((_event, next) => setSession(next));
    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, [supabaseReady]);

  const isAdmin = readAppMetadata(session).is_admin;

  // While the session is loading we render a neutral "checking" state. After
  // we know, we either bounce to /login, show "not authorized", or render
  // the console.
  if (session === undefined) {
    return (
      <main className="admin-page">
        <div className="container-x">
          <div className="admin-card">
            <p className="admin-sub">Loading…</p>
          </div>
        </div>
      </main>
    );
  }
  if (!session) {
    if (typeof window !== 'undefined') router.replace('/login');
    return (
      <main className="admin-page">
        <div className="container-x">
          <div className="admin-card">
            <h1>Sign in to use the admin console</h1>
            <p className="admin-sub">You need to be signed in to manage subscriptions.</p>
          </div>
        </div>
      </main>
    );
  }
  if (!isAdmin) {
    return (
      <main className="admin-page">
        <div className="container-x">
          <div className="admin-card">
            <h1>You don&rsquo;t have admin access</h1>
            <p className="admin-sub">
              Your account is signed in but does not have the <code>is_admin</code> claim. If you think this is
              wrong, ask an existing admin to promote you from the Supabase SQL editor.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return <AdminConsole session={session} />;
}

// ---------- Console (admin-gated) ----------

function AdminConsole({ session }: { session: SupabaseSession }) {
  const currentUserId = session.user?.id ?? '';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [modal, setModal] = useState<
    | null
    | { kind: 'grant'; user: AdminUser }
    | { kind: 'extend'; user: AdminUser }
    | { kind: 'revoke'; user: AdminUser }
    | { kind: 'promote'; user: AdminUser }
    | { kind: 'demote'; user: AdminUser }
  >(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const data = await adminFetch<{ users: AdminUser[]; page: number; pageSize: number; total: number }>(
        `/users?${params.toString()}`
      );
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const openDetail = useCallback(async (userId: string) => {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = await adminFetch<UserDetail>(`/users/${userId}`);
      setDetail(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshDetail = useCallback(async () => {
    if (!detail) return;
    try {
      const data = await adminFetch<UserDetail>(`/users/${detail.user.id}`);
      setDetail(data);
    } catch {
      /* keep stale detail open */
    }
  }, [detail]);

  // After a successful action, refresh both the list and the open detail.
  const onActionComplete = useCallback(async () => {
    await loadUsers();
    await refreshDetail();
  }, [loadUsers, refreshDetail]);

  // Top bar stats — count from the currently loaded page. Cheap and good
  // enough; we don't run aggregate queries.
  const stats = useMemo(() => {
    const active = users.filter((u) => u.subscription && (u.subscription.status === 'active' || u.subscription.status === 'trialing')).length;
    const canceled = users.filter((u) => u.subscription && u.subscription.status === 'canceled').length;
    return { total: users.length, active, canceled };
  }, [users]);

  return (
    <main className="admin-page">
      <div className="container-x">
        <div className="admin-banner">
          <span className="admin-banner-dot" aria-hidden="true" />
          <span>
            <strong>Admin console</strong> — every action is logged with your user id and timestamp.
          </span>
        </div>

        <div className="admin-card">
          <div className="admin-stats">
            <div className="admin-stat">
              <span className="admin-stat-num">{stats.total}</span>
              <span className="admin-stat-label">on this page</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-num">{stats.active}</span>
              <span className="admin-stat-label">active / trialing</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-num">{stats.canceled}</span>
              <span className="admin-stat-label">canceled</span>
            </div>
          </div>

          <div className="admin-toolbar">
            <input
              type="search"
              className="admin-search"
              placeholder="Search by email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadUsers()} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {error && <p className="form-message is-error">{error}</p>}

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Period end</th>
                  <th>Joined</th>
                  <th>Last sign-in</th>
                  <th>Role</th>
                  <th className="admin-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="admin-empty">No users found.</td>
                  </tr>
                )}
                {users.map((u) => {
                  const sub = u.subscription;
                  return (
                    <tr key={u.id}>
                      <td className="admin-td-email" title={u.email ?? u.id}>
                        {u.email ?? <span className="ink-dim">no email</span>}
                      </td>
                      <td>{sub?.plan ?? <span className="ink-dim">—</span>}</td>
                      <td>
                        {sub ? (
                          <span className={`admin-pill admin-pill-${sub.status}`}>{sub.status}</span>
                        ) : (
                          <span className="ink-dim">—</span>
                        )}
                      </td>
                      <td>{formatDate(sub?.current_period_end)}</td>
                      <td>{formatDate(u.created_at)}</td>
                      <td>{u.last_sign_in_at ? formatDate(u.last_sign_in_at) : <span className="ink-dim">never</span>}</td>
                      <td>
                        {u.is_admin ? <span className="admin-pill admin-pill-admin">admin</span> : <span className="ink-dim">user</span>}
                      </td>
                      <td className="admin-td-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void openDetail(u.id)}>
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setModal({ kind: sub ? 'extend' : 'grant', user: u })}
                        >
                          {sub ? 'Extend' : 'Grant'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="admin-pager">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              ← Prev
            </button>
            <span className="admin-pager-info">Page {page}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || users.length < pageSize}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {detail && (
        <DetailDrawer
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => setDetail(null)}
          onAction={(kind) => setModal({ kind, user: detail.user })}
          currentUserId={currentUserId}
        />
      )}

      {modal && (
        <ActionModal
          modal={modal}
          onClose={() => setModal(null)}
          onComplete={async () => {
            setModal(null);
            await onActionComplete();
          }}
        />
      )}
    </main>
  );
}

// ---------- Detail drawer ----------

function DetailDrawer({
  detail,
  loading,
  error,
  onClose,
  onAction,
  currentUserId
}: {
  detail: UserDetail;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onAction: (kind: 'grant' | 'extend' | 'revoke' | 'promote' | 'demote') => void;
  currentUserId: string;
}) {
  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const u = detail.user;
  const sub = detail.subscription;
  const isSelf = u.id === currentUserId;

  return (
    <div className="admin-drawer" role="dialog" aria-modal="true" aria-label={`Details for ${u.email ?? u.id}`}>
      <div className="admin-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="admin-drawer-panel">
        <header className="admin-drawer-head">
          <div>
            <h2>{u.email ?? <span className="ink-dim">no email</span>}</h2>
            <p className="admin-drawer-sub" title={u.id}>
              {u.id} {u.is_admin ? <span className="admin-pill admin-pill-admin">admin</span> : null}
            </p>
          </div>
          <button type="button" className="admin-drawer-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <section className="admin-drawer-body">
          {error && <p className="form-message is-error">{error}</p>}
          {loading && <p className="admin-sub">Loading…</p>}

          <div className="admin-drawer-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onAction(sub ? 'extend' : 'grant')}
            >
              {sub ? 'Extend / add days' : 'Grant subscription'}
            </button>
            {sub && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAction('revoke')}>
                Revoke
              </button>
            )}
            {u.is_admin ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onAction('demote')}
                disabled={isSelf}
                title={isSelf ? 'You cannot demote yourself.' : 'Remove admin role'}
              >
                {isSelf ? 'Demote (self — blocked)' : 'Demote'}
              </button>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAction('promote')}>
                Promote to admin
              </button>
            )}
          </div>

          <h3 className="admin-drawer-h3">User</h3>
          <dl className="admin-drawer-dl">
            <div><dt>Created</dt><dd>{formatDateTime(u.created_at)}</dd></div>
            <div><dt>Last sign-in</dt><dd>{formatDateTime(u.last_sign_in_at)}</dd></div>
            <div><dt>Email</dt><dd>{u.email ?? '—'}</dd></div>
          </dl>

          <h3 className="admin-drawer-h3">Subscription</h3>
          {sub ? (
            <dl className="admin-drawer-dl">
              <div><dt>Plan</dt><dd>{sub.plan}</dd></div>
              <div><dt>Status</dt><dd><span className={`admin-pill admin-pill-${sub.status}`}>{sub.status}</span></dd></div>
              <div><dt>Period start</dt><dd>{formatDateTime(sub.current_period_start)}</dd></div>
              <div><dt>Period end</dt><dd>{formatDateTime(sub.current_period_end)}</dd></div>
              <div><dt>Cancel at period end</dt><dd>{sub.cancel_at_period_end ? 'yes' : 'no'}</dd></div>
              <div><dt>Canceled at</dt><dd>{formatDateTime(sub.canceled_at)}</dd></div>
              <div><dt>Price id</dt><dd>{sub.price_id ?? '—'}</dd></div>
              <div><dt>Updated</dt><dd>{formatDateTime(sub.updated_at)}</dd></div>
            </dl>
          ) : (
            <p className="ink-dim">No subscription on file.</p>
          )}

          <h3 className="admin-drawer-h3">Audit log <span className="admin-drawer-h3-meta">last {detail.audit.length}</span></h3>
          {detail.audit.length === 0 ? (
            <p className="ink-dim">No actions recorded for this user yet.</p>
          ) : (
            <table className="admin-audit">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {detail.audit.map((a) => (
                  <tr key={a.id}>
                    <td title={a.created_at}>{formatDateTime(a.created_at)}</td>
                    <td><span className={`admin-pill admin-pill-action admin-pill-action-${a.action}`}>{a.action}</span></td>
                    <td title={a.actor_id ?? ''}>
                      {a.actor_kind === 'break_glass' ? <span className="ink-dim">break-glass</span> : shortId(a.actor_id ?? '')}
                    </td>
                    <td><code className="admin-audit-meta">{JSON.stringify(a.metadata)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </aside>
    </div>
  );
}

// ---------- Action modal ----------

function ActionModal({
  modal,
  onClose,
  onComplete
}: {
  modal:
    | { kind: 'grant'; user: AdminUser }
    | { kind: 'extend'; user: AdminUser }
    | { kind: 'revoke'; user: AdminUser }
    | { kind: 'promote'; user: AdminUser }
    | { kind: 'demote'; user: AdminUser };
  onClose: () => void;
  onComplete: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirm-on-type for destructive actions
  const [confirmText, setConfirmText] = useState('');

  // Grant / extend
  const [days, setDays] = useState<string>('30');
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');

  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (modal.kind === 'grant' || modal.kind === 'extend') {
        const n = Number.parseInt(days, 10);
        if (!Number.isFinite(n) || n <= 0 || n > 365) {
          throw new Error('Days must be a whole number between 1 and 365.');
        }
        await adminFetch('/grant', {
          method: 'POST',
          body: { userId: modal.user.id, days: n, plan }
        });
      } else if (modal.kind === 'revoke') {
        await adminFetch('/revoke', { method: 'POST', body: { userId: modal.user.id } });
      } else if (modal.kind === 'promote') {
        await adminFetch('/promote', { method: 'POST', body: { userId: modal.user.id } });
      } else if (modal.kind === 'demote') {
        await adminFetch('/demote', { method: 'POST', body: { userId: modal.user.id } });
      }
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      setBusy(false);
    }
  }

  const destructive = modal.kind === 'revoke' || modal.kind === 'demote';
  const canSubmit =
    !busy &&
    (destructive ? confirmText.trim().toLowerCase() === (modal.user.email ?? '').toLowerCase() : true) &&
    (modal.kind === 'grant' || modal.kind === 'extend' ? /^\d+$/.test(days) : true);

  let title = '';
  if (modal.kind === 'grant') title = 'Grant subscription';
  if (modal.kind === 'extend') title = 'Extend subscription';
  if (modal.kind === 'revoke') title = 'Revoke subscription';
  if (modal.kind === 'promote') title = 'Promote to admin';
  if (modal.kind === 'demote') title = 'Remove admin role';

  let body: React.ReactNode = null;
  if (modal.kind === 'grant' || modal.kind === 'extend') {
    body = (
      <>
        <p className="admin-sub">
          {modal.kind === 'grant'
            ? 'This gives the user an active subscription for the chosen number of days.'
            : 'This adds the chosen number of days on top of the user’s current period end.'}
        </p>
        <label className="admin-modal-label">
          <span>Days</span>
          <input
            ref={firstFieldRef}
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="admin-modal-label">
          <span>Plan</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value as 'monthly' | 'yearly')} disabled={busy}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
      </>
    );
  } else if (modal.kind === 'revoke') {
    body = (
      <>
        <p className="admin-sub">
          Soft-revokes the subscription by setting <code>status=&quot;canceled&quot;</code>. The user can re-purchase from
          the pricing page.
        </p>
        <label className="admin-modal-label">
          <span>Type <code>{modal.user.email}</code> to confirm</span>
          <input
            ref={firstFieldRef}
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </label>
      </>
    );
  } else {
    body = (
      <>
        <p className="admin-sub">
          {modal.kind === 'promote'
            ? 'Adds is_admin to the user’s app_metadata. Their next request will receive an admin JWT.'
            : 'Removes is_admin. Their existing session is invalidated on the server, so they will be signed out the next time their token is checked.'}
        </p>
        {modal.kind === 'demote' && (
          <label className="admin-modal-label">
            <span>Type <code>{modal.user.email}</code> to confirm</span>
            <input
              ref={firstFieldRef}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={busy}
              autoComplete="off"
            />
          </label>
        )}
      </>
    );
  }

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="admin-drawer-backdrop" onClick={() => !busy && onClose()} aria-hidden="true" />
      <div className="admin-modal-panel">
        <h2>{title}</h2>
        <p className="admin-sub">
          {modal.user.email ?? modal.user.id}
        </p>
        {error && <p className="form-message is-error">{error}</p>}
        {body}
        <div className="admin-modal-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${destructive ? 'btn-danger' : 'btn-primary'} btn-sm`}
            onClick={() => void submit()}
            disabled={!canSubmit}
          >
            {busy ? 'Working…' : title}
          </button>
        </div>
      </div>
    </div>
  );
}
