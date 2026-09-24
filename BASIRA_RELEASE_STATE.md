# BASIRA Release State — Core 1.0

Updated: 2026-09-24  
State: EXECUTION

## Git

Canonical base branch: `codex/final-delivery-20260729`  
Canonical base SHA before Phase 1.7: `658fdd7fe9b399f09f0970cb6e3a5dce56b24bac`  
Phase 1.7 PR #7 head used as execution base: `aaa02d4cf11652b22a0b2a2f59813ff8338ed07e`  
Core 1.0 execution branch: `release/core-1.0-reset-v2`

Verified code head before this state-only commit:
`e74e85eab00fa736cc25516c36661d8f7ac0d2d7`

PR #7 remains OPEN / UNMERGED and is not implicitly approved by Core 1.0 execution.

## Production database

Supabase project: `fhedbrmdrgzvbtjvlgfu`

Known production migration history includes:
- `20260922162141 fix_learning_progress_rls`
- `20260922163013 fix_learning_progress_lesson_check`
- `20260922203101 progressive_learning_journey`
- `20260922204930 security_definer_acl_hardening`
- `20260923104752 ownership_membership_integrity`
- `20260923125110 account_creation_provisioning`

Migration 013 content is deployed in Production.

Candidate Core 1.0 schema changes not yet deployed:
- `014_core1_locked_lesson_read.sql`
- `015_core1_shared_login_rate_limit.sql`

Database deployment and application deployment remain separate manual operations. Do not run routine `db push` against Production until migration-history reconciliation is intentionally reviewed.

## Phase 1.7

Status: HOLD — bounded.

Passed:
- Migration 013 Production apply.
- DB privilege/surface evidence.
- live DB smoke.
- zero known orphan/duplicate baseline.

Still required:
- real Production Auth Admin HTTP proof across the approved boundary.

No Phase 1.7 redesign is authorized by Core 1.0 execution.

## Severity / independence rule

P0:
security leak, authorization bypass, data loss/corruption, secret exposure, destructive cross-user behavior, or serious outage.

P1:
a frozen Supported journey/lifecycle cannot complete naturally, reaches a dead end, requires operator/DB intervention, or cannot survive 30 days.

Independent slices continue when another slice is externally blocked if they do not depend on the same file, migration, contract, or semantics and do not modify the blocked slice's behavior.

## RED Round 1B findings

- F1 — CLOSED_AS_CANDIDATE.
- F2 — P1 OPEN / BLOCKED_EXTERNAL_WRITE.
- F3 — CLOSED_AS_CANDIDATE.
- F4 — CLOSED_AS_CANDIDATE.

## Slice 0 — Release Aperture

Status: CLOSED_AS_CANDIDATE.

Implemented:
- code capability aperture;
- Teacher supported navigation routed to Learning Core;
- Legacy Group/Subject/Lesson creation rejected server-side;
- manual-grading routes/action disabled;
- no stored legacy data changed.

## Slice 1 — F1 locked Lesson read

Status: CLOSED_AS_CANDIDATE.

Claim:
Learning Core direct Lesson reads must enforce the same progressive availability semantics shown by Student Journey, while Legacy non-sequential Lesson reads remain unchanged.

Diff:
- `04ab0078f34513a61124645168d3999e735e9a26`
- candidate migration `014_core1_locked_lesson_read.sql`

Verification:
Production transactional dry-run with rollback:
- before fix: Lesson 1 = readable, Lesson 2 = readable, Legacy = readable;
- after fix: Lesson 1 = readable, Lesson 2 = denied, Legacy = readable;
- after completing Lesson 1: Lesson 1 = readable, Lesson 2 = readable, Legacy = readable.

No Production schema/data change was retained.

Release condition:
migration 014 must be reconciled/applied through the reviewed deployment path before release.

## Slice 2 — F2 asset aperture

Status: P1 OPEN / BLOCKED_EXTERNAL_WRITE.

Already committed:
- `756a4156099a944aa53a26ea3a1d63a5e01ac70e`
- upload authorization accepts only MP4/WebM video and PDF handout;
- authorize rejects `aid` and image-handout requests.

External write blocker:
the connected GitHub writer blocked edits to the remaining upload-surface files with its safety checks.

Remaining write required:
- remove `aid` and image-handout from normal Lesson UI;
- enforce the same restriction in finalize/store defense-in-depth;
- update regression tests.

Blocker closes when those files can be written by an authorized Builder/runtime and the supported MP4/WebM/PDF path passes regression verification.

F2 does not block independent slices.

## Slice 3 — F3 enrollment bootstrap

Status: CLOSED_AS_CANDIDATE.

Implemented commits:
- `6e9ab14b45a38e3f729253ea6056448bf2d1de6e`
- `4ec9c81eab0626054741e662372ec34dda1ff365`
- `188dccac79595ff664316bbe438cbf3e2b22a446`
- `8fbd8143ae86dc902cfe27064597a2a6f47a010c`
- `c947512c2581fa76b9ae381a4e23d66151d8c87b`
- `e2509f4d6f9970cec5004b6255a16c6e02c99b5e`
- tests through `386fd47a83bc5c24c258adc7c9e06ace2a87ca2e`

Behavior:
- no current reference is a valid bootstrap state, not a 404/error;
- Student can open account/reference UI with no row;
- POST rotate creates the first reference through the existing secure RPC;
- only fingerprint + mask persist; plaintext remains one-time reveal;
- Teacher enrollment continues to use the generated reference.

Production evidence:
at least one active Student currently has no active enrollment-reference row, proving the bootstrap state exists naturally.

Production RPC definitions confirm:
- getter returns zero rows when absent;
- rotate inserts a first row for an active Student;
- enroll resolves the same fingerprint into an active membership.

## Slice 4 — F4 objective-only assessment

Status: CLOSED_AS_CANDIDATE.

Implemented chain:
- schema accepts only `mcq | true_false`;
- Quiz Builder exposes only MCQ / True-False;
- DemoStore and SupabaseStore reject essay creation directly;
- Student submission action rejects legacy essay quizzes under Core 1.0;
- regression tests added for schema/store/result behavior.

Key commits:
- `8daa061e561f48c0da57910df192d194541c6dfd`
- `6d0c098f6c7008af4dda5b932fc3b2d45b748e3e`
- `bdc315f2403ec77fa010f13021b67d1ca821aaba`
- `ad4e62cd4c50a05ace96ae5492f15b54130561d6`
- `452dd66a2d4e05a4d22e9ed348a27558cdc3f81d`
- `f9f1b65a1c4763f4a04e34a380835e4051b2ed85`
- `d8ab773168e454591a8d7c04446adaa3faead074`
- `d18934807be802d5e94f4639d91a4981b1789b25`

Production evidence:
- unique active-attempt index exists on `(quiz_id, student_id) where status <> 'void'`;
- `submit_quiz_phase13a` auto-grades objective questions and immediately sets non-manual submissions to `released`;
- answer-key tables expose zero Student SELECT policies;
- legacy DB question types remain stored for compatibility but are outside Core 1.0 authoring/submission aperture;
- current Production contains zero essay questions / zero published essay quizzes;
- authenticated table INSERT grants do not reopen authoring because RLS is enabled on quizzes/questions and there are no INSERT policies.

## Account / membership lifecycle

Status: CLOSED_AS_CANDIDATE.

Account lifecycle:
- disabled account no longer exposes normal Reset in Admin UI;
- explicit Admin-only reactivation issues a fresh credential while the Profile remains disabled;
- Profile becomes active only after credential/Auth reset succeeds;
- failure before final activation leaves the account fail-secure disabled.

Key commits:
- `4231a60f42f61cd5243239183558cef78630a634`
- `69960eb616453ace0651e9ee3d1b7c51cc2d3d8e`
- `2b017cf9b614a7356aca2ce52a45c2984f6b5319`
- `99a48c86af6ecb7a588d5dd74fa0b36613ae5f75`
- `5c103e896671289db34045c20e6e4a7c0344408b`
- action regression test `9cf5e21e3171c357941cf67fa6e46fdf9cb912c8`

Membership lifecycle:
- Teacher can remove an active Student from an owned Learning Core Group;
- removal changes only membership status to `removed`;
- Student identity remains active;
- existing enrollment-reference flow reactivates the same membership through its existing upsert semantics;
- Teacher Student-creation UI now receives Learning Core group options only.

Key commits:
- `b5ab1e3fd5b06e9b113d2e57de8e0422a6d0a400`
- `21afe9fe20eb7bb872348b9b039bf04cf9c865f2`
- `52047698f2ad02551e3b2fe84deee0c937f5640a`
- `06a4b4115d9bf0c8a37450c41793e151fa18c03c`
- `81a92e66fae82065784bf6cb09b04552117f40fc`
- `dfcf86b6d30e13c86f72fe2eb761cac52b4825ed`
- lifecycle regression test `fdeff3299cf525414afcd91d5fed8f4fa84ba18c`

## Shared login limiter

Status: CLOSED_AS_CANDIDATE / DEPLOYMENT REQUIRED.

Implementation:
- Demo keeps process-local limiter for local-only operation;
- Production hashes the IP + publicRef key and uses Supabase shared state;
- private counter table;
- service-role-only check/record/clear RPCs;
- no raw IP address is persisted;
- login action awaits shared check/record;
- shared check/record fail closed;
- clear after successful login is best-effort.

Key commits:
- migration 015: `696900858122df0fc0beaceb77951451b33568d7`
- runtime limiter: `14937ad038a6d7857c31f8c63ccf078b3534206a`
- login action: `2ce9442817886c5a721d2a0bde5542c72739afd8`
- Cloudflare client-IP hardening: `6280753888e339f8910cb94842679326a8d4007d`
- first-wave concurrency serialization: `e74e85eab00fa736cc25516c36661d8f7ac0d2d7`

Transactional Production verification with rollback:
- initial: allowed;
- after 7 failures: allowed;
- failure 8: blocked, retry = 900 seconds;
- separate subsequent check: blocked, retry = 900 seconds;
- after clear: allowed.

RED follow-up:
- fixed a same-key first-wave race where concurrent callers could all observe a missing row before INSERT;
- record RPC now takes a transaction-scoped advisory lock derived from the hashed key before reading/inserting;
- login now prefers Cloudflare's single-value `CF-Connecting-IP` over `X-Forwarded-For`; fallback XFF uses the last hop rather than trusting a client-controlled first value.

Supabase current documentation supports the chosen permission hardening pattern:
`security definer` with fixed search path, revoke from public/anon/authenticated, and selective execution grants.

Release condition:
migration 015 must be deployed before the app commit using the shared limiter.

## Verification limitation

The local execution runtime cannot resolve `github.com`, so a fresh clone / `npm ci` / full test suite could not be run from this session.

Therefore:
- transactional Production DB evidence is recorded where executed;
- code diffs and regression tests are present on the branch;
- no claim of full-suite PASS is made yet.

Before Release Candidate freeze:
1. run `npm run verify:release` in an environment that can access/install the repository dependencies;
2. close F2;
3. reconcile/apply required migrations 014 and 015;
4. satisfy the bounded Phase 1.7 Production Auth HTTP live proof;
5. run Golden Path + Red Spine P0/P1 verification.

## Last-known-good rule

A Release Candidate cannot be declared until:
- exact verified Git SHA is recorded;
- required Production migrations/config are recorded;
- Golden Path + Red Spine pass for P0/P1;
- rollback target is known.

Fresh rebuild from an empty Supabase project remains strong evidence, not itself a Core 1.0 gate under the current manual deployment model.
