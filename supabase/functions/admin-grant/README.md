# admin-grant edge function

Back-office API for the marketing site. Two auth modes:

1. **JWT** — a logged-in admin user with `auth.users.raw_app_meta_data.is_admin = true`. The JWT carries the claim, so no extra lookup is required at request time.
2. **Shared secret** — `x-admin-secret: $ADMIN_GRANT_SECRET` header. Used as a break-glass and for the original curl one-liner. Audit log records `actor_id = NULL` and `actor_kind = 'break_glass'`.

The UI lives at `/admin` on the marketing site and forwards requests to this function through the `app/api/admin/*` route handlers.

## Deploy

```bash
supabase functions deploy admin-grant --no-verify-jwt
supabase secrets set ADMIN_GRANT_SECRET=<generate-a-long-random-token>
```

`--no-verify-jwt` is required because the function itself validates the Bearer token with the auth admin API (and accepts the shared secret as a separate path).

## Routes

| Method | Path                          | Purpose                                                                                |
| ------ | ----------------------------- | -------------------------------------------------------------------------------------- |
| `GET`  | `/users?search=&page=&pageSize=` | Paginated user list (joins subscription row).                                       |
| `GET`  | `/users/:id`                  | Single user + subscription + last 50 audit entries.                                    |
| `POST` | `/grant`                      | Body `{ userId, days, plan? }` or `{ email, days, plan? }`. Upserts an active subscription. |
| `POST` | `/grant-by-email`             | Legacy alias of `/grant` for the original curl one-liner (email-only).                |
| `POST` | `/revoke`                     | Body `{ userId }`. Sets `status = 'canceled'`.                                          |
| `POST` | `/promote`                    | Body `{ userId }`. Sets `app_metadata.is_admin = true` (cascades session invalidation). |
| `POST` | `/demote`                     | Body `{ userId }`. Sets `app_metadata.is_admin = false`. Refuses to demote yourself.   |

### Granting (curl, JWT path)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/admin-grant/grant" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"someone@example.com","days":30,"plan":"monthly"}'
```

### Granting (curl, secret / break-glass path)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/admin-grant/grant-by-email" \
  -H "x-admin-secret: $ADMIN_GRANT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email":"someone@example.com","days":30}'
```

## Audit log

Every mutation writes a row to `public.admin_audit_log` (RLS enabled, only writable by the service role). The table is also surfaced in the per-user detail drawer in the `/admin` UI.

| column        | type        | notes                                                                                |
| ------------- | ----------- | ------------------------------------------------------------------------------------ |
| `id`          | uuid        | PK                                                                                   |
| `actor_id`    | uuid        | admin's `auth.users.id`; `NULL` for break-glass                                      |
| `actor_kind`  | text        | `admin_user` or `break_glass`                                                        |
| `action`      | text        | `grant`, `extend`, `revoke`, `promote`, `demote`                                     |
| `target_id`   | uuid        | affected `auth.users.id`                                                             |
| `metadata`    | jsonb       | before/after, days granted, etc.                                                     |
| `created_at`  | timestamptz | default `now()`                                                                      |

## Promote / demote

Promote / demote writes `is_admin: true | false` to `auth.users.raw_app_meta_data`. A trigger installed by `20260103000000_admin_console.sql` deletes the user's `auth.sessions` rows whenever `raw_app_meta_data` changes, which forces the affected user to re-authenticate and pick up the new claim.

You cannot demote yourself — the `/demote` route returns `400 self_demote_blocked` if `actor.id == userId`. Use the SQL editor or the promote/demote UI as another admin to remove yourself.

## Why this design

- `app_metadata` (vs `user_metadata`) is the right slot for an admin role: only server-side code can write it, and the change flows through the JWT automatically.
- The function is the single place that can write the `admin-grant-<uuid>` sentinel for `stripe_customer_id` / `stripe_subscription_id`, keeping the existing `app/api/extension/verify` route working without changes.
- The shared-secret path is preserved so you can still grant a subscription from a phone / CI without being signed in to the dashboard.
