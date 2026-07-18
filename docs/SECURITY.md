# Security Model

## Invariants

- No service-role key in browser code.
- No public registration.
- Access-code secrets are never persisted in application tables or logs.
- Full access code is shown only on create/reset.
- Invalid login uses a generic message.
- Disabled/reset accounts invalidate protected sessions in both the application and direct RLS helper chain by comparing JWT `iat` with the profile session-invalidation watermark.
- Student cannot read another student, group, submission or grade.
- Teacher cannot read/write another teacher's group chain.
- Contact/payment notes are admin + owning teacher only.
- Correct-answer tables are never student-readable.
- Essays are never auto-graded.
- Storage buckets are private and signed URLs are short-lived.
- UI hiding is never treated as authorization; RLS and trusted server checks enforce access.

## Supabase

`SUPABASE_SERVICE_ROLE_KEY` is imported only by server-only modules. Admin operations create/reset Auth users and server-side grading reads isolated answer tables. Application tables and Storage objects have RLS enabled and deny by default. The `session_is_current()` helper prevents stale JWTs from retaining direct database or Storage access after reset/disable.

## Access code

Format: `BSR-<PUBLIC_REF>-<SECRET>`.

The public reference locates a credential, while the secret is used as the Supabase Auth password. Only the public reference, masked hint, role/state and timestamps are stored in application tables. Login is server-side and returns only generic failures.

## Reporting a problem

Treat any cross-role read/write, public file access, exposed secret, wrong grade, early answer reveal or data loss as `FAIL`, not a cosmetic issue.
