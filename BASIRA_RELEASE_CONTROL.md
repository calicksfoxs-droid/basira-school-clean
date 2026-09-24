# BASIRA Release Control — Core 1.0

Status: ACTIVE  
Release model: Minimum Durable Product  
Base under execution: `aaa02d4cf11652b22a0b2a2f59813ff8338ed07e`  
Execution branch: `release/core-1.0-reset-v2`

## Release promise

Core 1.0 is the smallest supported product surface that can operate normally for 30 days without a rescue update, routine manual database cleanup, hidden operator-only workaround, or an already-known follow-up deployment required to complete a normal user journey.

Reduce breadth, never integrity.

## Release-stop severity

### P0
Authorization/security breach, cross-user disclosure, data loss/corruption, secret exposure, destructive cross-tenant behavior, or serious production outage.

### P1
A supported normal journey/lifecycle cannot complete, reaches a dead end, needs operator/database intervention, or a supported claim cannot reasonably survive 30 days.

P2/P3 do not stop Core 1.0 and belong in the Update Backlog.

## RED evidence format

Every release-blocking finding must contain:

`Actor → Preconditions → Exact Repro → Expected → Observed → Evidence → Severity → 30-day survival impact`

Unreproduced suspicion, refactor preference, non-blocking test gaps, and unsupported/deferred features are not release blockers.

## Frozen Supported Surface

### Identity / access
- Access-code login/logout.
- Current-session validation and required invalidation semantics.
- Role isolation.
- Admin creates Teacher.
- Admin creates Student.
- Teacher creates Student only inside an owned active supported Learning Core Group.
- Supported credential reset, disable, and reactivation lifecycle.
- Shared production-safe login rate limiting is a release gate.

### Learning Core
The only supported new-content lane is:

`Grade → Root Subject → Subject Group → Unit → Lesson → Asset → Publish → Student Journey`

Supported semantics:
- Teacher-owned Learning Core authoring.
- Student sees only enrolled + published content.
- Progressive journey is server-enforced, including direct URL reads.
- Lesson completion/progress is persisted.
- Legacy group-scoped content may remain for compatibility but is not a supported new-authoring lane.

### Assets
Core 1.0 supports only:
- Video: MP4 / WebM.
- Handout: PDF.
- Private storage with teacher-owned writes and authorized student reads.

Other asset variants are Disabled/Internal unless independently promoted through Release Control.

### Student enrollment
- Teacher creates a new Student in an owned active supported Group.
- Teacher enrolls an existing Student via enrollment reference.
- A newly created Student can bootstrap an enrollment reference through normal UI.
- Removal/revocation is required if membership management is claimed supported.

### Assessment
Core 1.0 assessment contract is:
- one normal active attempt;
- MCQ + True/False only;
- DB-backed auto-grade;
- immediate released result;
- answer review only after finalized submission.

Essay/manual grading/multi-attempt/review-mode behavior is Disabled/Internal for Core 1.0.

## Internal / Legacy

Allowed to remain in code/schema to preserve data or avoid regression:
- existing legacy group-scoped Subject/Lesson rows;
- compatibility RLS/helpers;
- essay/manual-grade tables and code;
- advanced assessment machinery not reachable from the supported surface.

Internal/Legacy does not mean supported.

## Disabled

A disabled capability must be unreachable through the normal UI **and** rejected at server/action/API boundary where a direct request could otherwise invoke it.

Core 1.0 disabled:
- new Legacy authoring;
- essay_text / essay_file quiz creation;
- manual grading flow;
- configurable/multiple/unlimited attempts;
- highest-score aggregation;
- review timing/modes;
- lesson aid assets;
- image handouts;
- standalone Assignments;
- unified Gradebook;
- Analytics.

## Current release blockers

Resolved for the frozen backend contract:
- F1 progressive locked Lesson direct-read enforcement.
- F2 MP4/WebM/PDF-only asset aperture.
- F3 enrollment-reference bootstrap.
- F4 objective-only assessment boundary.
- shared production login limiter, including same-key first-wave concurrency.
- Production migrations 014, 015, and 016.

Remaining release gates:
- Phase 1.7: Production Auth Admin HTTP live proof remains required; no redesign.
- Release Engineering: exact deployed application SHA parity remains unverified because the live health endpoint currently reports `commit: "local"`.
- Final deployed-candidate HTTP/UI Golden Path + Red Spine smoke.
- Exact rollback target and final residue check.

Backend Supported contracts are frozen for UI implementation. Until Release Candidate freeze, only reproducible P0/P1 fixes may change those contracts.

## Execution order

1. Release Aperture / Supported Surface Enforcement.
2. F1 locked Lesson read.
3. F2 asset aperture.
4. F3 enrollment bootstrap.
5. F4 objective-only assessment.
6. Release Engineering parity gate.
7. P0/P1 verification: Golden Path + Red Spine.

No new architecture review is opened unless a new reproducible P0/P1 is discovered.

## Golden Path

Admin creates Teacher + Student  
→ Teacher creates Learning Core Grade/Subject/Group  
→ Teacher enrolls Student  
→ Teacher creates Unit/Lesson  
→ Teacher uploads supported private Asset  
→ Teacher publishes hierarchy  
→ Student logs in  
→ Student sees only enrolled/published Subject  
→ Student opens only currently available Lesson/Asset  
→ Student completes Lesson  
→ Student takes one-attempt objective Quiz  
→ Student receives immediate released result/review  
→ access/membership revocation behaves as supported.

## Red Spine

- Student reads content not assigned to them.
- Teacher writes content they do not own.
- Student direct-opens draft/locked content.
- Student obtains answer/result before allowed release.
- Disabled/session-invalid account continues privileged use.

## Freeze rule

Once the Release Candidate is declared frozen:
- no schema redesign;
- no unrelated destructive migration;
- no scope expansion;
- only P0/P1 fixes or rollback.

Any proposed work must answer:
“What supported Core 1.0 claim becomes true or more likely to survive 30 days if this succeeds?”

If there is no clear answer, defer it.
