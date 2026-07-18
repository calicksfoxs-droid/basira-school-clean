# Deployment

## Local demo

```powershell
npm ci
Copy-Item .env.example .env.local
npm run reset:demo
npm run dev
```

## Supabase staging

1. Create a backup/recovery point.
2. Link the correct project.
3. Review migration dry run.
4. Apply the migration.
5. Regenerate types if the project workflow requires it.
6. Seed/reset the initial admin.

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
npm run seed:supabase
```

Never use `--include-all` or migration repair without a reviewed history mismatch report.

## Required production environment

```text
BASIRA_BACKEND=supabase
BASIRA_APP_SECRET=<strong random secret>
NEXT_PUBLIC_SUPABASE_URL=<project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<server only>
NEXT_PUBLIC_APP_URL=<https URL>
MAX_VIDEO_UPLOAD_MB=250
MAX_HANDOUT_UPLOAD_MB=25
MAX_SUBMISSION_UPLOAD_MB=20
```

## Render

`render.yaml` configures a Node web service with `/api/health`. Keep secrets in Render Environment. For staged acceptance, deploy an exact commit and verify the deployed SHA in the Dashboard before merging/tagging.

## Smoke test

- Admin creates teacher.
- Teacher creates group, student, subject and lesson.
- Teacher uploads video/PDF and four-type quiz, then publishes.
- Student sees assigned content only and submits.
- Correct answers remain hidden while pending.
- Teacher grades/releases.
- Student sees own released result.
- Transfer ownership and failed file replacement adversarial checks pass.
