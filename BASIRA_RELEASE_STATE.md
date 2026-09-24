# BASIRA Release State — Core 1.0

Updated: 2026-09-24  
State: EXECUTION

## Git

Canonical base branch: `codex/final-delivery-20260729`  
Canonical base SHA before Phase 1.7: `658fdd7fe9b399f09f0970cb6e3a5dce56b24bac`  
Phase 1.7 PR #7 head used as execution base: `aaa02d4cf11652b22a0b2a2f59813ff8338ed07e`  
Core 1.0 execution branch: `release/core-1.0-reset`

PR #7 remains OPEN / UNMERGED and is not implicitly approved by this branch.

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

Database deployment and application deployment are currently separate manual operations. Repository deployment documentation uses `supabase db push --linked --dry-run` / `supabase db push --linked`; the application deploys separately to Cloudflare Workers through Vinext. No GitHub Actions workflow exists on the reviewed Phase 1.7 head.

Do not run routine `db push` against Production until migration-history reconciliation is intentionally reviewed.

## Phase 1.7

Status: HOLD — bounded.

Already passed:
- Migration 013 production apply.
- DB privilege/surface evidence.
- live DB smoke.
- zero known orphan/duplicate baseline.

Still required:
- real Production Auth Admin HTTP proof across the approved boundary.
- no Phase 1.7 redesign is authorized by Core 1.0 execution.

## RED Round 1B

Thinking phase: CLOSED.

Decisions:
- Learning Core lane: MODIFY then ADOPT.
- Teacher-created Student: MODIFY and KEEP SUPPORTED.
- Deployment/Migration Truth: MODIFY.
- Objective-only Assessment: MODIFY then ADOPT.

Release-blocking findings:
- F1 — OPEN.
- F2 — OPEN.
- F3 — OPEN.
- F4 — OPEN.

## Execution slices

### Slice 0 — Release Aperture / Supported Surface Enforcement
Status: CLOSED.

Closure criteria:
- supported/disabled capability contract exists in code, not only prose;
- legacy new-authoring entry points are not part of the supported navigation surface;
- disabled Core 1.0 capability requests are rejected server-side where applicable;
- aperture does not change stored legacy data;
- no Phase 1.7 behavior is altered.

Hard bounds:
- no schema redesign;
- no deletion/migration of legacy data;
- no feature-flag platform;
- no changes to Assignments/Gradebook/Analytics;
- no Phase 1.7 recovery redesign.

Slice 0 closure:
- code capability aperture added;
- Teacher navigation/home routed to Learning Core;
- Legacy Group/Subject/Lesson creation rejected server-side;
- manual grading routes/action disabled;
- no stored legacy data changed.

### Slice 1 — F1 locked Lesson read
Status: IN PROGRESS.

Closure criteria:
- Learning Core future/locked Lesson cannot be read by direct Lesson URL;
- its private Assets cannot be read either;
- current available/completed Lesson remains readable;
- legacy non-sequential Lesson semantics remain unchanged;
- completion ordering still passes.

### Slice 2 — F2 asset aperture
Status: QUEUED.

Closure criteria:
- Core 1.0 authoring accepts only MP4/WebM video and PDF handout;
- aid/image-handout cannot be created through supported UI/API/action path;
- existing legacy/internal asset rows are not destructively removed;
- supported upload → finalize → student read path remains intact.

### Slice 3 — F3 enrollment bootstrap
Status: QUEUED.

Closure criteria:
- Student with no current enrollment-reference row can open Settings normally;
- Student can generate the first reference through normal UI/API;
- plaintext reference is one-time reveal only;
- existing rotate/revoke behavior remains intact;
- Teacher can use the generated reference to enroll that existing Student.

### Slice 4 — F4 objective-only assessment
Status: QUEUED.

Closure criteria:
- supported quiz authoring accepts only MCQ/True-False server-side;
- direct crafted request with essay_text/essay_file is rejected;
- objective Quiz still auto-grades and releases immediately;
- answer keys remain hidden until finalized/released result;
- existing internal essay data is not deleted.

## Last-known-good rule

A Release Candidate cannot be declared until:
- its exact Git SHA is recorded here;
- required Production migrations/config are recorded here;
- Golden Path + Red Spine P0/P1 verification passes;
- rollback target is known.

Fresh rebuild from an empty Supabase project is strong evidence but is not itself a Core 1.0 release gate under the current manual deployment model.
