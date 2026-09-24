# BASIRA Release State — Core 1.0

Updated: 2026-09-24
State: EXECUTION / GREEN UI FALLBACK INTEGRATED / BACKEND CONTRACTS FROZEN
Release readiness: HOLD

## Git

Canonical base branch: `codex/final-delivery-20260729`
Canonical base SHA before Phase 1.7: `658fdd7fe9b399f09f0970cb6e3a5dce56b24bac`
Phase 1.7 PR #7 reviewed head used as execution base: `aaa02d4cf11652b22a0b2a2f59813ff8338ed07e`
Core 1.0 execution branch: `release/core-1.0-reset-v2`

Frozen UI backend executable baseline:
`8e840a067dccd09c9c442a54ee754cb78863d97b`

Latest green GitHub Actions evidence for that baseline:
- workflow run: `35998706822`
- `verify:release`: PASS
- Next production build: PASS
- Vinext/Cloudflare candidate build: PASS
- 130 tests passed; 2 live-gate tests skipped by default
- Production deep-health probe: PASS

Green Core 1.0 UI fallback baseline:
`b5a98924be735c6dc546ad341a968bf852970281`

UI fallback integration:
- PR #9 merged the exact green fallback baseline into `release/core-1.0-reset-v2`.
- release merge commit: `790e323f230da61565081acae5be689f77144513`.
- exact fallback evidence: workflow run `36004315092` passed lint, typecheck, 130 normal tests, static verification, Next build, Desktop Chromium E2E, focused Mobile Chromium smoke, Vinext build, and Production deep-health probe.
- the newer Astra redesign remains isolated on PR #8 and is not part of the fallback release candidate until it independently returns green.

PR #7 is superseded by the current release line: its head `aaa02d4cf11652b22a0b2a2f59813ff8338ed07e` is an ancestor of the release branch. It no longer represents a separate merge gate; the remaining Phase 1.7 blocker is only the bounded live Auth Admin HTTP proof.

## Production database

Supabase project: `fhedbrmdrgzvbtjvlgfu`

Verified Production migration history:
- `20260922162141 fix_learning_progress_rls`
- `20260922163013 fix_learning_progress_lesson_check`
- `20260922203101 progressive_learning_journey`
- `20260922204930 security_definer_acl_hardening`
- `20260923104752 ownership_membership_integrity`
- `20260923125110 account_creation_provisioning`
- `20260924113620 core1_locked_lesson_read`
- `20260924113623 core1_shared_login_rate_limit`
- `20260924113626 core1_asset_aperture`

Database deployment and application deployment remain separate operations. Routine blind `db push` remains disallowed until migration-history normalization is intentionally reviewed.

## Current backend contract status

- Release Aperture: CLOSED / VERIFIED.
- F1 locked Learning Core Lesson read: CLOSED / DEPLOYED / PRODUCTION VERIFIED.
- F2 asset aperture: CLOSED / DEPLOYED / PRODUCTION VERIFIED.
- F3 enrollment-reference bootstrap: CLOSED_AS_CANDIDATE.
- F4 objective-only assessment: CLOSED / PRODUCTION VERIFIED.
- Account lifecycle semantics: CLOSED_AS_CANDIDATE.
- Membership lifecycle semantics: CLOSED / PRODUCTION VERIFIED.
- Shared production login limiter: CLOSED / DEPLOYED / CONCURRENCY VERIFIED.
- Full repository verification: PASS.
- Cloudflare/Vinext candidate build: PASS.
- Production health: PASS.
- Phase 1.7 Auth Admin HTTP proof: HOLD — executable live-gate harness exists, but GitHub Actions has no `SUPABASE_SERVICE_ROLE_KEY`.
- Exact deployed application SHA parity: HOLD — build provenance is now stamped correctly, but current Production still reports `commit: "local"`.
- Cloudflare deployment metadata / rollback ID: HOLD — GitHub Actions has no Cloudflare API credentials.
- Overall Release Candidate freeze: HOLD.

The Supported backend contract shape is frozen for UI implementation. Until overall RC freeze, only reproducible P0/P1 fixes may change those contracts.

## F1 — progressive locked Lesson reads

Migration:
- `014_core1_locked_lesson_read.sql`
- deployed as `20260924113620 core1_locked_lesson_read`.

Production rollback-only Golden/Red probe proved:
- first published Learning Core Lesson visible;
- future published Lesson direct read hidden while locked;
- draft Lesson direct read hidden;
- Journey projected `available → locked`;
- locked completion rejected;
- completing Lesson 1 changed Journey to `completed → available`;
- Lesson 2 then became directly readable.

Legacy non-sequential compatibility remains outside the new Learning Core progression semantics.

## F2 — Core 1.0 asset aperture

Supported:
- video: MP4 / WebM;
- handout: PDF.

Disabled/Internal:
- lesson aids;
- image handouts.

Enforcement now exists at:
- upload authorization;
- upload UI;
- Lesson UI;
- upload finalize route;
- DemoStore;
- SupabaseStore;
- file serving route;
- Production `finalize_lesson_asset_phase13a`;
- Production Storage policy surface.

Migration:
- `016_core1_asset_aperture.sql`
- deployed as `20260924113626 core1_asset_aperture`.

Production evidence:
- Teacher `lesson-aids` management policy count = 0;
- authenticated Teacher direct-RPC attempts reject `aid`, image handout MIME, and unsupported video MIME;
- existing supported asset authorization uses progressive Lesson access;
- no live lesson asset/object data was present when the legacy aid write path was disabled.

## F3 — enrollment-reference bootstrap

Status: CLOSED_AS_CANDIDATE.

Behavior remains:
- absence of a current reference is a valid bootstrap state;
- Student can create the first reference through the existing rotate RPC;
- plaintext is one-time reveal only;
- persistent state contains fingerprint + mask only;
- Teacher enrollment consumes the reference through the existing enrollment RPC.

No redesign is authorized unless a reproducible P0/P1 appears.

## F4 — objective-only assessment

Core 1.0 supports:
- MCQ;
- True/False;
- one normal active attempt;
- DB auto-grade;
- immediate released result.

Production rollback-only proof:
- correct MCQ + True/False submission auto-released;
- objective score and total score matched full points;
- exactly one active attempt existed;
- a duplicate normal attempt was rejected;
- Student direct visibility of answer-key tables was zero.

Server-side result projection also keeps answer keys/auto-score hidden until release and scopes Student submission lookup to the owning Student.

## Shared login limiter

Migration:
- `015_core1_shared_login_rate_limit.sql`
- deployed as `20260924113623 core1_shared_login_rate_limit`.

Final concurrency design:
- shared private Supabase table;
- raw IP is not persisted;
- key is hashed from client-IP/publicRef context;
- `check_login_rate_limit_v1`, `record_login_failure_v1`, and `clear_login_failures_v1` are service-role-only;
- `record_login_failure_v1` owns same-key serialization with a transaction-scoped advisory lock before first-row read/insert/update;
- `check_login_rate_limit_v1` does not rely on a lock that would expire before the separate mutation RPC.

Production first-wave concurrency proof:
- shared key cleared first;
- eight same-key `record_login_failure_v1` RPCs executed concurrently;
- calls 1–7 remained allowed;
- call 8 returned blocked with 900 seconds;
- an independent follow-up check remained blocked;
- key was cleared after verification.

This closes the concurrency concern recorded in the handoff.

## Golden Path + Red Spine backend proof

A rollback-only Production probe created a synthetic Learning Core hierarchy and objective assessment, exercised authenticated identities, recorded results, then intentionally aborted the transaction.

Verified P0/P1 backend invariants:
- enrolled published Subject visible;
- current Lesson visible;
- future locked Lesson hidden on direct read;
- draft Lesson hidden;
- authorized PDF asset readable;
- progressive Journey transitions correctly after completion;
- locked completion rejected;
- objective quiz auto-releases correct result;
- duplicate active attempt rejected;
- answer-key tables hidden from Student;
- foreign Teacher update affected zero rows;
- membership removal revoked Subject/Lesson/asset access;
- re-enrollment restored Subject access;
- account disable invalidated the current session and direct Lesson read.

A separate rollback-only Red probe used a synthetic second Student Auth/Profile identity and verified:
- owner Student cannot directly read an unreleased submission/answer table row;
- another Student cannot directly read that submission/answer row;
- all synthetic Auth/Profile/curriculum/submission rows were absent after rollback.

## Repository / build verification

GitHub Actions on the release branch now runs with Node 22 and proves:
- `npm ci`;
- `npm run verify:release`;
- lint;
- typecheck;
- 130 normal tests PASS;
- 2 Phase 1.7 live tests are present but skipped unless explicitly enabled with Production credentials;
- static release verification;
- Next production build;
- `npm run build:vinext`;
- generated build provenance stamp equals the checked-out Git SHA;
- current Production deep health probe.

Current integrated fallback release commit: `790e323f230da61565081acae5be689f77144513`.
The exact UI fallback content commit `b5a98924be735c6dc546ad341a968bf852970281` is already green. The release-branch push verification for the merge commit must also be green before deployment.

Latest verified live Production health response:
- `ok: true`;
- `service: basira-school-platform`;
- `backend: supabase`;
- `database: ready`;
- `commit: "local"`.

The health response proves service/database readiness but does not prove exact deployed Git SHA.

## Phase 1.7 — account creation

Status: HOLD — bounded external proof only.

Already passed:
- Migration 013 is deployed;
- DB privilege/surface checks;
- compensation/reconciliation implementation tests;
- residue baseline checks.

Latest residue baseline:
- Auth without Profile = 0;
- active Profile without current Credential = 0;
- users with duplicate current Credentials = 0;
- prepared / cleanup_pending account-creation operations = 0.

A bounded live harness now exists at `scripts/phase1-7-live-gate.test.ts` and covers:
1. real Production Auth Admin HTTP create/get with pre-known UUID and expected metadata;
2. delete + exact absence reconciliation;
3. one real `SupabaseStore.createTeacher` creation;
4. exact Auth/Profile/current-Credential/operation verification;
5. authentication of the returned access code through `loginWithAccessCode`;
6. controlled test-user cleanup.

On workflow run `35998706822`, the live step was skipped because `SUPABASE_SERVICE_ROLE_KEY` is not available in GitHub Actions. The available Supabase connector also does not expose Auth Admin HTTP primitives, so SQL substitution remains unacceptable.

Latest post-verification residue baseline remains clean:
- Auth without Profile = 0;
- active Profile without current Credential = 0;
- duplicate current Credential users = 0;
- prepared / cleanup_pending operations = 0.

## Pre-delivery verification snapshot

Verified on 2026-09-24 before deployment:
- green UI fallback integrated into the release line through PR #9;
- integrated release workflow run `36021693519`: PASS;
- checked-out/build provenance SHA in that run: `598dfde0f34b1b04254f457de1225b70a6ff71c0`;
- Next/repository verification: PASS;
- Vinext/Cloudflare candidate build: PASS;
- current Production deep-health probe: PASS for service/database readiness, but still reports `commit: "local"`;
- Phase 1.7 live Auth gate: safely skipped because GitHub still lacks `SUPABASE_SERVICE_ROLE_KEY`; therefore not counted as proof;
- Cloudflare deployment metadata audit: safely skipped because GitHub still lacks Cloudflare API credentials;
- final Production residue check: `auth_without_profile=0`, `active_profile_without_current_credential=0`, `duplicate_current_credential_users=0`, `prepared_or_cleanup_pending_operations=0`, `credential_without_profile=0`;
- Production migration ledger still includes migrations 013, 014, 015, and 016 at the expected versions.

PR hygiene:
- PR #7 closed as superseded because its head is already an ancestor of the current release line;
- PR #8 (Astra UI redesign) is intentionally Draft and isolated from the stable fallback until its own final CI/E2E/visual QA is green;
- PR #9 merged the stable fallback only.
## Remaining release gates

Backend contract work for UI may proceed now against the frozen Supported Surface.

Overall Core 1.0 Release Candidate is still HOLD until:
1. Phase 1.7 Production Auth Admin HTTP tests A/B/C run with an authorized service-role runtime and pass;
2. the candidate is deployed to Cloudflare from an authorized runtime;
3. live `/api/health?deep=1` reports the deployed candidate SHA rather than `local`;
4. exact Cloudflare deployment/version rollback target is recorded;
5. the deployed candidate receives the final app-level Golden Path / Red Spine smoke where HTTP/UI behavior is required;
6. final residue checks remain clean.

These remaining blockers are credential/runtime gates, not unresolved backend-contract design work. UI implementation may proceed against the frozen baseline above.

No architecture review is reopened. Only a reproducible P0/P1 may alter the frozen backend contracts.
