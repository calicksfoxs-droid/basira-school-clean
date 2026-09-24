# Core 1.0 Multi-host Deployment Benchmark

This document keeps Cloudflare Workers as the current primary while preparing
the exact same Core 1.0 release line for Render, Vercel, and Netlify.

## Canonical source

Deploy only from:

`release/core-1.0-reset-v2`

Every accepted deployment must expose its real Git SHA through:

`GET /api/health?deep=1`

and must pass:

`npm run verify:deployment -- https://HOST.example FULL_40_CHAR_GIT_SHA`

A deployment that returns `commit: "local"` is not eligible for final acceptance.

## Required production environment

Set the same application values on every provider:

- `BASIRA_BACKEND=supabase`
- `BASIRA_APP_SECRET=<strong unique secret>`
- `NEXT_PUBLIC_SUPABASE_URL=https://fhedbrmdrgzvbtjvlgfu.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>`
- `SUPABASE_SERVICE_ROLE_KEY=<server-only secret>`
- `NEXT_PUBLIC_APP_URL=<that provider's https URL>`
- `MAX_VIDEO_UPLOAD_MB=250`
- `MAX_HANDOUT_UPLOAD_MB=25`
- `MAX_SUBMISSION_UPLOAD_MB=20`

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser/public variables.

## Cloudflare Workers

Primary adapter: Vinext.

Build:
`npm run build:vinext`

Deploy:
`npm run deploy:vinext`

After deployment, record the Cloudflare deployment/version identifier as the
rollback target and verify the exact deployed SHA.

## Render benchmark

Use `render.benchmark.yaml` as a custom Blueprint path.

The benchmark service deliberately uses Render's Free web-service plan and
has auto-deploy disabled. This is a benchmark/staging service, not the
production recommendation.

Free instances can spin down after inactivity, so cold-start behavior must be
measured separately from warm requests.

## Vercel benchmark

Use native Next.js deployment from the canonical release branch. No custom
adapter is required.

Required project environment variables are the common values above. Vercel's
system Git commit environment is consumed by
`scripts/prepare-build-info.mjs`, so the health route can prove exact
deployment provenance.

Do not accept a Vercel deployment until the deep health probe matches the
full deployment source SHA prefix.

## Netlify benchmark

Use the native Next.js/OpenNext integration. No pinned adapter is required.

Build command:
`npm run build`

The build script consumes Netlify's `COMMIT_REF` to stamp the exact source
commit.

Set the common environment variables above and set
`NEXT_PUBLIC_APP_URL` to the resulting Netlify HTTPS URL.

## Benchmark acceptance

For each provider capture:

1. provider name and public HTTPS URL;
2. exact Git SHA;
3. deep-health result;
4. first request after idle/cold response time;
5. three warm response times;
6. login success;
7. Student subject/lesson read;
8. PDF handout access;
9. objective quiz submission/result;
10. upload authorization for supported PDF/video;
11. rollback/deployment identifier where the provider exposes one.

Do not compare providers until they are serving the same release SHA and the
same Supabase backend.

## Final selection rule

The final host is chosen only after all candidate deployments pass the same
functional smoke. Provider marketing, synthetic home-page speed, or a
successful build alone is insufficient.
