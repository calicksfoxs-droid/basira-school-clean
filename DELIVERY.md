# Basira School Platform — Final Clean Delivery

## What this is

A complete clean-room rebuild of Basira Phase 13A. It does not depend on the previous repository or its broken staging deployment.

## Included

- Arabic-first Next.js application.
- Admin / Teacher / Student role separation.
- Closed access-code authentication.
- Demo backend for immediate local use.
- Supabase backend adapter, migration, RLS, private Storage, and seed script.
- Teacher-owned groups, private operational student records, subjects, lessons, optional one-level parts.
- Real video/PDF/file upload architecture.
- Four quiz question types, auto-grading, manual grading, private released results.
- Announcement carousel.
- Desktop/mobile UI and screenshots.
- Unit, integration, browser, static-security, SQL-parse, build, and audit evidence.

## Local start

```powershell
npm ci
Copy-Item .env.example .env.local
npm run reset:demo
npm run dev
```

Open `http://localhost:3000/login`.

Demo codes:

```text
Admin:   BSR-ADMN-DEMO2026
Teacher: BSR-TCHR-DEMO2026
Student: BSR-STDN-DEMO2026
```

## Production start

Read, in order:

1. `docs/SECURITY.md`
2. `docs/DEPLOYMENT.md`
3. `supabase/migrations/001_basira_clean.sql`
4. `render.yaml`
5. `docs/TEST_REPORT.md`

Use a fresh staging Supabase project first. Never commit `.env.local` or a service-role key.
